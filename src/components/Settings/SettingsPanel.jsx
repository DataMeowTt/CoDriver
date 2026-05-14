import { useState, useEffect } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import useSettingsStore from '../../stores/settingsStore';
import { detectHardware, getDeviceWarning } from '../../services/hardwareDetector';
import {
  TRANSCRIPT_MODES, TRANSCRIPT_MODE_LABELS,
  PROCESSING_DEVICES, DEVICE_LABELS,
  RESOURCE_LEVELS, RESOURCE_LABELS,
  WHISPER_MODELS, WHISPER_MODEL_LABELS,
} from '../../utils/constants';
import styles from './SettingsPanel.module.css';

export default function SettingsPanel() {
  const settings = useSettingsStore();
  const setSetting = useSettingsStore((s) => s.setSetting);
  const resetSettings = useSettingsStore((s) => s.resetSettings);

  const [hwInfo, setHwInfo] = useState(null);
  const [deviceWarning, setDeviceWarning] = useState('');

  useEffect(() => {
    detectHardware().then(setHwInfo);
  }, []);

  useEffect(() => {
    setDeviceWarning(getDeviceWarning(settings.processingDevice));
  }, [settings.processingDevice]);

  return (
    <div className={styles.container}>
      {/* Transcript Timing */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Cài đặt Transcript</h3>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="select-transcript-mode">Thời điểm chạy</label>
          <select
            id="select-transcript-mode"
            className="select"
            value={settings.transcriptMode}
            onChange={(e) => setSetting('transcriptMode', e.target.value)}
          >
            {Object.entries(TRANSCRIPT_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="hint-text">
            {settings.transcriptMode === TRANSCRIPT_MODES.AUTO_LIGHT && 'Phiên âm dần dần trong nền, giảm tải cho thiết bị.'}
            {settings.transcriptMode === TRANSCRIPT_MODES.AFTER_MEETING && 'Chỉ ghi âm, phiên âm sau khi cuộc họp kết thúc.'}
            {settings.transcriptMode === TRANSCRIPT_MODES.IMMEDIATE && 'Phiên âm nhanh nhất có thể, dùng nhiều tài nguyên hơn.'}
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="select-device">Thiết bị xử lý</label>
          <select
            id="select-device"
            className="select"
            value={settings.processingDevice}
            onChange={(e) => setSetting('processingDevice', e.target.value)}
          >
            {Object.entries(DEVICE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {deviceWarning && (
            <div className={styles.warningBox}>
              <Info size={14} />
              <span>{deviceWarning}</span>
            </div>
          )}

          {hwInfo && (
            <p className="hint-text">
              {hwInfo.hasWebGPU
                ? `✅ GPU khả dụng: ${hwInfo.gpuName}`
                : '⚠️ Không tìm thấy GPU phù hợp. Hệ thống sẽ sử dụng CPU.'
              }
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Mức sử dụng tài nguyên</label>
          <div className={styles.resourceBtns}>
            {Object.entries(RESOURCE_LABELS).map(([value, label]) => (
              <button
                key={value}
                className={`${styles.resourceBtn} ${settings.resourceLevel === value ? styles.resourceActive : ''}`}
                onClick={() => setSetting('resourceLevel', value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <hr className="separator" />

      {/* Model Settings */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Model AI</h3>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="select-model">Model Whisper</label>
          <select
            id="select-model"
            className="select"
            value={settings.whisperModel}
            onChange={(e) => setSetting('whisperModel', e.target.value)}
          >
            {Object.entries(WHISPER_MODEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="hint-text">
            Model lớn hơn cho kết quả chính xác hơn nhưng cần nhiều tài nguyên và thời gian tải hơn.
          </p>
        </div>
      </div>

      <hr className="separator" />

      {/* Reset */}
      <div className={styles.resetSection}>
        <button className="btn btn-ghost" onClick={resetSettings}>
          Khôi phục cài đặt mặc định
        </button>
      </div>
    </div>
  );
}
