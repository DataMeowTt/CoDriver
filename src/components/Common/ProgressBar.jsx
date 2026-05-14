import styles from './Common.module.css';

export default function ProgressBar({ value = 0, label, size = 'md', color = 'primary' }) {
  return (
    <div className={styles.progressContainer}>
      {label && <div className={styles.progressLabel}>{label}</div>}
      <div className={`${styles.progressTrack} ${styles[`progress_${size}`]}`}>
        <div
          className={`${styles.progressFill} ${styles[`progress_${color}`]}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
