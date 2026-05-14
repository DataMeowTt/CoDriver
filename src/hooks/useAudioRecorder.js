import { useCallback } from 'react';
import * as audioEngine from '../services/audioEngine';
import useRecordingStore from '../stores/recordingStore';
import useUIStore from '../stores/uiStore';
import { createMeeting, updateMeeting, saveAudioBlob } from './useMeetings';
import { getErrorMessage } from '../utils/errorMessages';

export default function useAudioRecorder() {
  const store = useRecordingStore();
  const addToast = useUIStore((s) => s.addToast);

  const startRecording = useCallback(
    async (title) => {
      try {
        const meetingId = await createMeeting(title);
        const { analyserNode } = await audioEngine.startRecording();

        store.setCurrentMeetingId(meetingId);
        store.setStatus('recording');
        store.setAnalyserNode(analyserNode);
        store.startTimer();

        return meetingId;
      } catch (err) {
        console.error('Failed to start recording:', err);
        let errorCode = 'RECORDING_FAILED';
        if (err.name === 'NotFoundError') errorCode = 'NO_MICROPHONE';
        if (err.name === 'NotAllowedError') errorCode = 'PERMISSION_DENIED';

        const msg = getErrorMessage(errorCode);
        addToast({ type: msg.type, title: msg.title, message: msg.message });
        throw err;
      }
    },
    [store, addToast]
  );

  const pauseRecording = useCallback(() => {
    audioEngine.pauseRecording();
    store.setStatus('paused');
    store.pauseTimer();
  }, [store]);

  const resumeRecording = useCallback(() => {
    audioEngine.resumeRecording();
    store.setStatus('recording');
    store.resumeTimer();
  }, [store]);

  const stopRecording = useCallback(async () => {
    const meetingId = store.currentMeetingId;
    const elapsed = store.elapsed;

    store.pauseTimer();
    store.setStatus(null);

    const blob = await audioEngine.stopRecording();

    if (meetingId && blob) {
      await saveAudioBlob(meetingId, blob);
      await updateMeeting(meetingId, {
        status: 'completed',
        duration: elapsed,
      });
    }

    const resultId = meetingId;
    store.resetRecording();
    return { meetingId: resultId, audioBlob: blob };
  }, [store]);

  return {
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}
