import { useState, useCallback } from 'react';
import * as whisperService from '../services/whisperService';
import { getEffectiveDevice } from '../services/hardwareDetector';
import { addSegment, updateMeeting } from './useMeetings';
import { blobToFloat32Array } from '../services/audioEngine';
import useSettingsStore from '../stores/settingsStore';
import useUIStore from '../stores/uiStore';
import { getErrorMessage } from '../utils/errorMessages';

export default function useTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [modelProgress, setModelProgress] = useState(null);

  const addToast = useUIStore((s) => s.addToast);
  const settings = useSettingsStore();

  const loadModel = useCallback(async () => {
    if (whisperService.isModelLoaded()) return;

    try {
      const device = await getEffectiveDevice(settings.processingDevice);
      await whisperService.initWhisper(settings.whisperModel, {
        device,
        onProgress: (p) => {
          setModelProgress(p);
        },
      });
      setModelProgress(null);
    } catch (err) {
      console.error('Failed to load Whisper:', err);
      const msg = getErrorMessage('MODEL_NOT_LOADED');
      addToast({ type: msg.type, title: msg.title, message: msg.message });
      throw err;
    }
  }, [settings.whisperModel, settings.processingDevice, addToast]);

  const transcribeAudio = useCallback(
    async (meetingId, audioBlob) => {
      setIsTranscribing(true);
      setProgress(0);

      try {
        await loadModel();
        await updateMeeting(meetingId, { transcriptStatus: 'processing' });

        // Convert audio to Float32Array
        const audioData = await blobToFloat32Array(audioBlob);
        setProgress(30);

        // Transcribe
        const result = await whisperService.transcribe(audioData, settings.language);
        setProgress(80);

        // Save segments
        if (result.chunks) {
          for (const chunk of result.chunks) {
            await addSegment(meetingId, {
              startTime: chunk.timestamp[0] || 0,
              endTime: chunk.timestamp[1] || 0,
              text: chunk.text.trim(),
            });
          }
        } else if (result.text) {
          await addSegment(meetingId, {
            startTime: 0,
            endTime: 0,
            text: result.text.trim(),
          });
        }

        await updateMeeting(meetingId, { transcriptStatus: 'completed' });
        setProgress(100);

        addToast({
          type: 'success',
          title: 'Phiên âm hoàn tất',
          message: 'Transcript đã được tạo thành công.',
        });
      } catch (err) {
        console.error('Transcription failed:', err);
        await updateMeeting(meetingId, { transcriptStatus: 'error' });
        const msg = getErrorMessage('TRANSCRIPT_FAILED');
        addToast({ type: msg.type, title: msg.title, message: msg.message });
      } finally {
        setIsTranscribing(false);
      }
    },
    [loadModel, settings.language, addToast]
  );

  return {
    isTranscribing,
    progress,
    modelProgress,
    transcribeAudio,
    loadModel,
    isModelLoaded: whisperService.isModelLoaded,
  };
}
