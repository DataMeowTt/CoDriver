import { ClipboardList, Lightbulb, CheckCircle, Pin, HelpCircle, Copy } from 'lucide-react';
import { copyToClipboard } from '../../services/exportService';
import useUIStore from '../../stores/uiStore';
import styles from './SummaryPanel.module.css';

const SECTION_CONFIG = [
  { key: 'brief', icon: ClipboardList, title: 'Tóm tắt ngắn', type: 'text' },
  { key: 'keyPoints', icon: Lightbulb, title: 'Ý chính', type: 'list' },
  { key: 'decisions', icon: CheckCircle, title: 'Quyết định quan trọng', type: 'list' },
  { key: 'tasks', icon: Pin, title: 'Công việc cần làm', type: 'tasks' },
  { key: 'openIssues', icon: HelpCircle, title: 'Vấn đề còn mở', type: 'list' },
];

export default function SummaryPanel({ summary }) {
  const addToast = useUIStore((s) => s.addToast);

  if (!summary) {
    return (
      <div className={styles.empty}>
        <ClipboardList size={32} className={styles.emptyIcon} />
        <p className={styles.emptyText}>Chưa có tóm tắt</p>
        <p className={styles.emptyHint}>Tạo tóm tắt bằng AI để phân tích nội dung cuộc họp</p>
      </div>
    );
  }

  const handleCopy = async () => {
    let text = '';
    if (summary.brief) text += `Tóm tắt: ${summary.brief}\n\n`;
    if (summary.keyPoints?.length) text += `Ý chính:\n${summary.keyPoints.map(p => `• ${p}`).join('\n')}\n\n`;
    if (summary.decisions?.length) text += `Quyết định:\n${summary.decisions.map(d => `• ${d}`).join('\n')}\n\n`;
    if (summary.tasks?.length) text += `Công việc:\n${summary.tasks.map(t => `• ${t.task} — ${t.assignee || '?'}`).join('\n')}\n\n`;
    if (summary.openIssues?.length) text += `Vấn đề:\n${summary.openIssues.map(i => `• ${i}`).join('\n')}`;

    await copyToClipboard(text);
    addToast({ type: 'success', title: 'Đã sao chép', message: 'Tóm tắt đã được sao chép vào clipboard.' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Phân tích cuộc họp</h3>
        <button className="btn btn-secondary" onClick={handleCopy}>
          <Copy size={14} />
          <span>Sao chép</span>
        </button>
      </div>

      <div className={styles.sections}>
        {SECTION_CONFIG.map(({ key, icon: Icon, title, type }) => {
          const data = summary[key];
          if (!data || (Array.isArray(data) && data.length === 0)) return null;

          return (
            <div key={key} className={styles.section}>
              <div className={styles.sectionHeader}>
                <Icon size={16} className={styles.sectionIcon} />
                <h4 className={styles.sectionTitle}>{title}</h4>
              </div>

              <div className={styles.sectionContent}>
                {type === 'text' && <p className={styles.briefText}>{data}</p>}

                {type === 'list' && (
                  <ul className={styles.list}>
                    {data.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                )}

                {type === 'tasks' && (
                  <div className={styles.tasksTable}>
                    <div className={styles.taskHeader}>
                      <span>Công việc</span>
                      <span>Phụ trách</span>
                      <span>Thời hạn</span>
                    </div>
                    {data.map((task, i) => (
                      <div key={i} className={styles.taskRow}>
                        <span>{task.task}</span>
                        <span className={styles.taskAssignee}>{task.assignee || '—'}</span>
                        <span className={styles.taskDeadline}>{task.deadline || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
