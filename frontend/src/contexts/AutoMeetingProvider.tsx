'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { appDataDir } from '@tauri-apps/api/path';
import { toast } from 'sonner';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordingState, RecordingStatus } from '@/contexts/RecordingStateContext';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { recordingService } from '@/services/recordingService';
import Analytics from '@/lib/analytics';

export interface AutoMeetingPreferences {
  enabled: boolean;
  prompt_to_start: boolean;
  prompt_to_stop: boolean;
  start_confidence_seconds: number;
  stop_grace_seconds: number;
  allowed_apps: string[];
}

export interface AutoMeetingDetectedPayload {
  session_id: string;
  app_name: string;
  confidence: number;
  signals: string[];
  detected_at: string;
}

export interface AutoMeetingEndedPayload {
  session_id: string;
  app_name: string;
  last_signal_at: string;
}

function generateAutoMeetingTitle(appName: string) {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${appName} Meeting ${day}_${month}_${year}_${hours}_${minutes}_${seconds}`;
}

export function AutoMeetingProvider({ children }: { children: React.ReactNode }) {
  const preferencesRef = useRef<AutoMeetingPreferences | null>(null);
  const promptedStartSessionsRef = useRef<Set<string>>(new Set());
  const promptedStopSessionsRef = useRef<Set<string>>(new Set());
  const activeAutoSessionRef = useRef<string | null>(null);

  const { selectedDevices } = useConfig();
  const recordingState = useRecordingState();
  const { setIsMeetingActive } = useSidebar();
  const { setMeetingTitle, clearTranscripts } = useTranscripts();

  const startAutoRecording = useCallback(async (payload: AutoMeetingDetectedPayload) => {
    if (recordingState.isRecording || recordingState.status !== RecordingStatus.IDLE) {
      toast.info('Recording already active', {
        description: 'Auto-detected meeting ignored because Meetily is already recording.',
      });
      return;
    }

    const meetingTitle = generateAutoMeetingTitle(payload.app_name);

    try {
      recordingState.setStatus(RecordingStatus.STARTING, 'Starting auto-detected meeting...');
      setMeetingTitle(meetingTitle);

      await recordingService.startRecordingWithDevices(
        selectedDevices?.micDevice || null,
        selectedDevices?.systemDevice || null,
        meetingTitle
      );

      clearTranscripts();
      setIsMeetingActive(true);
      activeAutoSessionRef.current = payload.session_id;

      await Analytics.track('auto_meeting_recording_started', {
        app_name: payload.app_name,
        confidence: payload.confidence.toFixed(2),
      });

      toast.success('Recording started', {
        description: meetingTitle,
      });
    } catch (error) {
      console.error('[AutoMeeting] Failed to start recording:', error);
      recordingState.setStatus(
        RecordingStatus.ERROR,
        error instanceof Error ? error.message : 'Failed to start auto-detected meeting'
      );
      toast.error('Failed to start recording', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    clearTranscripts,
    recordingState,
    selectedDevices,
    setIsMeetingActive,
    setMeetingTitle,
  ]);

  const stopAutoRecording = useCallback(async (payload: AutoMeetingEndedPayload) => {
    if (!recordingState.isRecording || activeAutoSessionRef.current !== payload.session_id) {
      return;
    }

    try {
      recordingState.setStatus(RecordingStatus.STOPPING, 'Stopping auto-detected meeting...');
      const dataDir = await appDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const savePath = `${dataDir}/recording-${timestamp}.wav`;

      await recordingService.stopRecording(savePath);

      const stopHandler = (window as any).handleRecordingStop;
      if (typeof stopHandler === 'function') {
        stopHandler(true);
      } else {
        console.warn('[AutoMeeting] window.handleRecordingStop is unavailable');
        recordingState.setStatus(RecordingStatus.IDLE);
      }

      activeAutoSessionRef.current = null;

      await Analytics.track('auto_meeting_recording_stopped', {
        app_name: payload.app_name,
      });
    } catch (error) {
      console.error('[AutoMeeting] Failed to stop recording:', error);
      recordingState.setStatus(
        RecordingStatus.ERROR,
        error instanceof Error ? error.message : 'Failed to stop auto-detected meeting'
      );
      toast.error('Failed to stop recording', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [recordingState]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const preferences = await invoke<AutoMeetingPreferences>('get_auto_meeting_preferences');
        if (!isMounted) return;
        preferencesRef.current = preferences;

        if (preferences.enabled) {
          await invoke('start_auto_meeting_detection');
        }
      } catch (error) {
        console.error('[AutoMeeting] Failed to initialize detector:', error);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handlePreferencesUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<AutoMeetingPreferences>;
      preferencesRef.current = customEvent.detail;
      if (!customEvent.detail.enabled) {
        activeAutoSessionRef.current = null;
      }
    };

    window.addEventListener('auto-meeting-preferences-updated', handlePreferencesUpdated);

    return () => {
      window.removeEventListener('auto-meeting-preferences-updated', handlePreferencesUpdated);
    };
  }, []);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];
    let cancelled = false;

    const setupListeners = async () => {
      const unlistenDetected = await listen<AutoMeetingDetectedPayload>('auto-meeting-detected', (event) => {
        const preferences = preferencesRef.current;
        const payload = event.payload;

        if (!preferences?.enabled || !preferences.prompt_to_start) return;
        if (promptedStartSessionsRef.current.has(payload.session_id)) return;
        promptedStartSessionsRef.current.add(payload.session_id);

        toast.info(`Meeting detected in ${payload.app_name}`, {
          description: 'Start recording this meeting?',
          action: {
            label: 'Start',
            onClick: () => startAutoRecording(payload),
          },
          duration: 15000,
        });
      });

      if (cancelled) {
        unlistenDetected();
        return;
      }
      unlisteners.push(unlistenDetected);

      const unlistenEnded = await listen<AutoMeetingEndedPayload>('auto-meeting-ended', (event) => {
        const preferences = preferencesRef.current;
        const payload = event.payload;

        if (!preferences?.enabled || !preferences.prompt_to_stop) return;
        if (activeAutoSessionRef.current !== payload.session_id) return;
        if (promptedStopSessionsRef.current.has(payload.session_id)) return;
        promptedStopSessionsRef.current.add(payload.session_id);

        toast.info('Meeting appears to have ended', {
          description: `Stop recording ${payload.app_name}?`,
          action: {
            label: 'Stop',
            onClick: () => stopAutoRecording(payload),
          },
          duration: 20000,
        });
      });

      if (cancelled) {
        unlistenEnded();
        unlisteners.forEach((unlisten) => unlisten());
        return;
      }
      unlisteners.push(unlistenEnded);
    };

    setupListeners();

    return () => {
      cancelled = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [startAutoRecording, stopAutoRecording]);

  return <>{children}</>;
}
