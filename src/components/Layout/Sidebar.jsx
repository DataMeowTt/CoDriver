import { NavLink, useLocation } from 'react-router-dom';
import { Mic, Clock, Settings, Shield } from 'lucide-react';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { path: '/', icon: Mic, label: 'Ghi âm' },
  { path: '/history', icon: Clock, label: 'Lịch sử' },
  { path: '/settings', icon: Settings, label: 'Cài đặt' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <Mic size={20} />
        </div>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>Meeting</span>
          <span className={styles.logoSubtitle}>Recorder</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
            end={path === '/'}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Privacy Badge */}
      <div className={styles.privacyBadge}>
        <Shield size={16} className={styles.privacyIcon} />
        <div className={styles.privacyText}>
          <div className={styles.privacyTitle}>Xử lý cục bộ</div>
          <div className={styles.privacyDesc}>Dữ liệu không rời thiết bị</div>
        </div>
      </div>
    </aside>
  );
}
