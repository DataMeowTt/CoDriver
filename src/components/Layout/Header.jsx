import { useLocation } from 'react-router-dom';
import { Shield, Lock } from 'lucide-react';
import styles from './Header.module.css';

const PAGE_TITLES = {
  '/': 'Ghi âm cuộc họp',
  '/history': 'Lịch sử cuộc họp',
  '/settings': 'Cài đặt',
};

export default function Header() {
  const location = useLocation();

  // For meeting detail pages
  let title = PAGE_TITLES[location.pathname] || 'Chi tiết cuộc họp';
  if (location.pathname.startsWith('/meeting/')) {
    title = 'Chi tiết cuộc họp';
  }

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.privacyIndicator}>
        <Lock size={13} />
        <span>Dữ liệu được xử lý trên thiết bị của bạn</span>
      </div>
    </header>
  );
}
