import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Toast from './components/Common/Toast';
import Modal from './components/Common/Modal';
import RecordingPage from './pages/RecordingPage';
import HistoryPage from './pages/HistoryPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import SettingsPage from './pages/SettingsPage';
import useUIStore from './stores/uiStore';
import { requestPersistentStorage, checkStorageQuota } from './utils/storageGuard';
import './App.css';

function App() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    requestPersistentStorage(addToast);
    checkStorageQuota(addToast);
  }, []);

  return (
    <div className="app-layout fade-in">
      {sidebarOpen && <Sidebar />}
      
      <main className="main-content">
        <Header />
        
        <div className="page-content">
          <Routes>
            <Route path="/" element={<RecordingPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/meeting/:id" element={<MeetingDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>

      <Toast />
      <Modal />
    </div>
  );
}

export default App;
