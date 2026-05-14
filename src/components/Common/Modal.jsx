import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import useUIStore from '../../stores/uiStore';
import styles from './Common.module.css';

export default function Modal() {
  const modalContent = useUIStore((s) => s.modalContent);
  const hideModal = useUIStore((s) => s.hideModal);
  const backdropRef = useRef(null);

  useEffect(() => {
    if (modalContent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [modalContent]);

  if (!modalContent) return null;

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) hideModal();
  };

  return (
    <div className={styles.modalBackdrop} ref={backdropRef} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{modalContent.title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={hideModal}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.modalBody}>
          {modalContent.body}
        </div>
        {modalContent.actions && (
          <div className={styles.modalActions}>
            {modalContent.actions}
          </div>
        )}
      </div>
    </div>
  );
}
