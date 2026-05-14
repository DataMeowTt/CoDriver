import { useEffect, useRef } from 'react';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import useUIStore from '../../stores/uiStore';
import styles from './Common.module.css';

const ICONS = {
  error: AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function Toast() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || Info;
        return (
          <div
            key={toast.id}
            className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}
            role="alert"
          >
            <Icon size={18} className={styles.toastIcon} />
            <div className={styles.toastContent}>
              {toast.title && <div className={styles.toastTitle}>{toast.title}</div>}
              {toast.message && <div className={styles.toastMessage}>{toast.message}</div>}
            </div>
            <button
              className={styles.toastClose}
              onClick={() => removeToast(toast.id)}
              aria-label="Đóng thông báo"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
