import { useState, useRef, useEffect } from 'react';
import { Edit3, Check, X } from 'lucide-react';
import { formatTimestamp } from '../../utils/formatTime';
import { updateSegment } from '../../hooks/useMeetings';
import styles from './TranscriptView.module.css';

export default function TranscriptView({ segments = [], searchQuery = '', onTimestampClick, editable = false }) {
  const containerRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const startEdit = (seg) => {
    setEditingId(seg.id);
    setEditText(seg.text);
  };

  const saveEdit = async () => {
    if (editingId && editText.trim()) {
      await updateSegment(editingId, editText.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const highlightText = (text) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className={styles.highlight}>{part}</mark>
      ) : (
        part
      )
    );
  };

  if (!segments || segments.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>Chưa có transcript</p>
        <p className={styles.emptyHint}>Transcript sẽ hiển thị ở đây sau khi phiên âm</p>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      {segments.map((seg) => (
        <div key={seg.id} className={styles.segment}>
          <button
            className={styles.timestamp}
            onClick={() => onTimestampClick?.(seg.startTime)}
            title="Nghe lại từ đây"
          >
            {formatTimestamp(seg.startTime)}
          </button>

          {seg.speaker && <span className={styles.speaker}>{seg.speaker}</span>}

          {editingId === seg.id ? (
            <div className={styles.editRow}>
              <input
                className={`input ${styles.editInput}`}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                autoFocus
              />
              <button className="btn btn-ghost btn-icon" onClick={saveEdit}><Check size={14} /></button>
              <button className="btn btn-ghost btn-icon" onClick={cancelEdit}><X size={14} /></button>
            </div>
          ) : (
            <span className={styles.text}>
              {highlightText(seg.text)}
              {editable && (
                <button
                  className={styles.editBtn}
                  onClick={() => startEdit(seg)}
                  title="Chỉnh sửa"
                >
                  <Edit3 size={12} />
                </button>
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
