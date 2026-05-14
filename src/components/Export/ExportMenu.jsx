import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileJson, FileType, File, ChevronDown } from 'lucide-react';
import * as exportService from '../../services/exportService';
import useUIStore from '../../stores/uiStore';
import styles from './ExportMenu.module.css';

const FORMATS = [
  { key: 'txt', label: 'Text (.txt)', icon: FileText, fn: 'exportTXT' },
  { key: 'json', label: 'JSON (.json)', icon: FileJson, fn: 'exportJSON' },
  { key: 'pdf', label: 'PDF (.pdf)', icon: File, fn: 'exportPDF' },
  { key: 'docx', label: 'Word (.docx)', icon: FileType, fn: 'exportDOCX' },
];

export default function ExportMenu({ meeting, segments, summary }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExport = async (format) => {
    setOpen(false);
    try {
      if (format.key === 'txt') {
        exportService.exportTXT(meeting, segments || []);
      } else if (format.key === 'json') {
        exportService.exportJSON(meeting, segments || [], summary);
      } else if (format.key === 'pdf') {
        await exportService.exportPDF(meeting, segments || [], summary);
      } else if (format.key === 'docx') {
        await exportService.exportDOCX(meeting, segments || [], summary);
      }
      addToast({ type: 'success', title: 'Xuất thành công', message: `File ${format.key.toUpperCase()} đã được tải về.` });
    } catch (err) {
      console.error('Export failed:', err);
      addToast({ type: 'error', title: 'Xuất thất bại', message: 'Không thể tạo file. Vui lòng thử lại.' });
    }
  };

  return (
    <div className={styles.container} ref={ref}>
      <button
        className="btn btn-secondary"
        onClick={() => setOpen(!open)}
        id="btn-export"
      >
        <Download size={14} />
        <span>Xuất dữ liệu</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className={styles.dropdown}>
          {FORMATS.map((fmt) => {
            const Icon = fmt.icon;
            return (
              <button
                key={fmt.key}
                className={styles.dropdownItem}
                onClick={() => handleExport(fmt)}
              >
                <Icon size={14} />
                <span>{fmt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
