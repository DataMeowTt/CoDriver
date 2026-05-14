import useRecordingStore from '../../stores/recordingStore';
import { formatDuration } from '../../utils/formatTime';
import styles from './StatusIndicator.module.css';

export default function StatusIndicator() {
  const status = useRecordingStore((s) => s.status);
  const elapsed = useRecordingStore((s) => s.elapsed);

  if (!status) return null;

  const statusConfig = {
    recording: { label: 'Đang ghi âm', dotClass: styles.dotRecording },
    paused: { label: 'Tạm dừng', dotClass: styles.dotPaused },
  };

  const config = statusConfig[status] || statusConfig.recording;

  return (
    <div className={styles.container}>
      <div className={styles.statusRow}>
        <span className={`${styles.dot} ${config.dotClass}`} />
        <span className={styles.statusLabel}>{config.label}</span>
      </div>
      <div className={styles.timer}>{formatDuration(elapsed)}</div>
    </div>
  );
}
