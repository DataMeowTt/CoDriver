import { useState } from 'react';
import { Search, X } from 'lucide-react';
import styles from './TranscriptSearch.module.css';

export default function TranscriptSearch({ onSearch }) {
  const [query, setQuery] = useState('');

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };

  const clear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className={styles.container}>
      <Search size={14} className={styles.icon} />
      <input
        className={styles.input}
        type="text"
        placeholder="Tìm kiếm trong transcript..."
        value={query}
        onChange={handleChange}
        id="transcript-search"
      />
      {query && (
        <button className={styles.clearBtn} onClick={clear}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}
