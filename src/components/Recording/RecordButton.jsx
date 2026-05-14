import { Mic, Pause, Square, Play } from 'lucide-react';
import useRecordingStore from '../../stores/recordingStore';
import styles from './RecordButton.module.css';

export default function RecordButton({ onStart, onPause, onResume, onStop }) {
  const status = useRecordingStore((s) => s.status);

  if (!status) {
    // Idle state — big record button
    return (
      <div className={styles.container}>
        <button
          className={styles.recordBtn}
          onClick={onStart}
          id="btn-start-recording"
          aria-label="Bắt đầu ghi âm"
        >
          <Mic size={28} />
        </button>
        <span className={styles.label}>Bấm để ghi âm</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Main button: recording or paused */}
      <button
        className={`${styles.recordBtn} ${status === 'recording' ? styles.recording : styles.paused}`}
        onClick={status === 'recording' ? onPause : onResume}
        id="btn-toggle-recording"
        aria-label={status === 'recording' ? 'Tạm dừng' : 'Tiếp tục'}
      >
        {status === 'recording' ? <Pause size={28} /> : <Play size={28} />}
      </button>

      {/* Stop button */}
      <button
        className={styles.stopBtn}
        onClick={onStop}
        id="btn-stop-recording"
        aria-label="Kết thúc ghi âm"
      >
        <Square size={16} />
        <span>Kết thúc</span>
      </button>

      <span className={styles.label}>
        {status === 'recording' ? 'Đang ghi âm...' : 'Tạm dừng'}
      </span>
    </div>
  );
}
