import { useNavigate } from 'react-router-dom';
import { Clock, FileText, Brain, ChevronRight, Trash2 } from 'lucide-react';
import { formatDate, formatDurationText } from '../../utils/formatTime';
import { PROCESS_STATUS } from '../../utils/constants';
import styles from './MeetingList.module.css';

const STATUS_BADGES = {
  [PROCESS_STATUS.NONE]: { label: 'Chưa xử lý', class: 'badge' },
  [PROCESS_STATUS.PROCESSING]: { label: 'Đang xử lý', class: 'badge badge-warning' },
  [PROCESS_STATUS.COMPLETED]: { label: 'Hoàn tất', class: 'badge badge-success' },
  [PROCESS_STATUS.ERROR]: { label: 'Lỗi', class: 'badge badge-danger' },
};

export default function MeetingList({ meetings = [], onDelete }) {
  const navigate = useNavigate();

  if (!meetings || meetings.length === 0) {
    return (
      <div className={styles.empty}>
        <Clock size={40} className={styles.emptyIcon} />
        <p className={styles.emptyText}>Chưa có cuộc họp nào</p>
        <p className={styles.emptyHint}>Bắt đầu ghi âm cuộc họp đầu tiên</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {/* Header */}
      <div className={styles.headerRow}>
        <span>Cuộc họp</span>
        <span>Ngày</span>
        <span>Thời lượng</span>
        <span>Transcript</span>
        <span>Tóm tắt</span>
        <span></span>
      </div>

      {meetings.map((meeting) => {
        const tBadge = STATUS_BADGES[meeting.transcriptStatus] || STATUS_BADGES[PROCESS_STATUS.NONE];
        const sBadge = STATUS_BADGES[meeting.summaryStatus] || STATUS_BADGES[PROCESS_STATUS.NONE];

        return (
          <div
            key={meeting.id}
            className={styles.row}
            onClick={() => navigate(`/meeting/${meeting.id}`)}
          >
            <div className={styles.titleCell}>
              <span className={styles.meetingTitle}>{meeting.title}</span>
            </div>
            <span className={styles.cell}>{formatDate(meeting.date)}</span>
            <span className={styles.cell}>{formatDurationText(meeting.duration)}</span>
            <span className={styles.cell}>
              <span className={tBadge.class}>{tBadge.label}</span>
            </span>
            <span className={styles.cell}>
              <span className={sBadge.class}>{sBadge.label}</span>
            </span>
            <div className={styles.actions}>
              <button
                className={styles.deleteBtn}
                onClick={(e) => { e.stopPropagation(); onDelete?.(meeting); }}
                title="Xóa cuộc họp"
              >
                <Trash2 size={14} />
              </button>
              <ChevronRight size={16} className={styles.chevron} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
