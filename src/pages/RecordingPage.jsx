import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RecordButton from '../components/Recording/RecordButton';
import AudioVisualizer from '../components/Recording/AudioVisualizer';
import StatusIndicator from '../components/Recording/StatusIndicator';
import TranscriptView from '../components/Transcript/TranscriptView';
import useAudioRecorder from '../hooks/useAudioRecorder';
import useTranscription from '../hooks/useTranscription';
import { useMeetingSegments } from '../hooks/useMeetings';
import useRecordingStore from '../stores/recordingStore';
import useSettingsStore from '../stores/settingsStore';
import { TRANSCRIPT_MODES } from '../utils/constants';

export default function RecordingPage() {
  const [title, setTitle] = useState('');
  const navigate = useNavigate();
  
  const { startRecording, pauseRecording, resumeRecording, stopRecording } = useAudioRecorder();
  const { transcribeAudio } = useTranscription();
  
  const status = useRecordingStore((s) => s.status);
  const currentMeetingId = useRecordingStore((s) => s.currentMeetingId);
  const settings = useSettingsStore();
  
  // Fetch real-time segments for the current recording
  const segments = useMeetingSegments(currentMeetingId);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (status === 'recording') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }, [segments, status]);

  const handleStart = async () => {
    try {
      await startRecording(title);
    } catch (err) {
      // Error is handled in the hook via Toast
    }
  };

  const handleStop = async () => {
    try {
      const { meetingId, audioBlob } = await stopRecording();
      
      // If auto-transcribe is enabled, trigger it now (or it's already running in background for IMMEDIATE mode)
      if (meetingId && audioBlob) {
        if (settings.transcriptMode === TRANSCRIPT_MODES.AUTO_LIGHT || 
            settings.transcriptMode === TRANSCRIPT_MODES.IMMEDIATE) {
          // Fire and forget transcription
          transcribeAudio(meetingId, audioBlob).catch(console.error);
        }
        
        // Navigate to detail page
        navigate(`/meeting/${meetingId}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {!status && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <input
            className="input"
            style={{ fontSize: 'var(--font-xl)', fontWeight: 'var(--weight-bold)', padding: 'var(--space-4)', textAlign: 'center', background: 'transparent', borderStyle: 'dashed' }}
            placeholder="Nhập tên cuộc họp (không bắt buộc)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      )}

      <div className="card-glass" style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-6)' }}>
          <StatusIndicator />
          <AudioVisualizer />
          <RecordButton
            onStart={handleStart}
            onPause={pauseRecording}
            onResume={resumeRecording}
            onStop={handleStop}
          />
        </div>
      </div>

      {status && (
        <div className="card" style={{ minHeight: '300px' }}>
          <h3 className="page-title" style={{ fontSize: 'var(--font-md)', marginBottom: 'var(--space-4)' }}>
            Transcript trực tiếp
          </h3>
          <TranscriptView segments={segments || []} />
        </div>
      )}
    </div>
  );
}
