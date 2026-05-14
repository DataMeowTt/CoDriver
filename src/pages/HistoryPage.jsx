import { useState } from 'react';
import { useMeetings, deleteMeeting } from '../hooks/useMeetings';
import MeetingList from '../components/History/MeetingList';
import useUIStore from '../stores/uiStore';

export default function HistoryPage() {
  const meetings = useMeetings();
  const showModal = useUIStore((s) => s.showModal);
  const hideModal = useUIStore((s) => s.hideModal);
  const addToast = useUIStore((s) => s.addToast);

  const handleDelete = (meeting) => {
    showModal({
      title: 'Xóa cuộc họp',
      body: (
        <p>
          Bạn có chắc chắn muốn xóa cuộc họp <strong>{meeting.title}</strong> không?
          Hành động này không thể hoàn tác và toàn bộ audio, transcript, tóm tắt sẽ bị xóa.
        </p>
      ),
      actions: (
        <>
          <button className="btn btn-secondary" onClick={hideModal}>Hủy</button>
          <button 
            className="btn btn-danger" 
            onClick={async () => {
              try {
                await deleteMeeting(meeting.id);
                addToast({ type: 'success', message: 'Đã xóa cuộc họp.' });
              } catch (err) {
                console.error(err);
                addToast({ type: 'error', message: 'Không thể xóa cuộc họp.' });
              }
              hideModal();
            }}
          >
            Xóa vĩnh viễn
          </button>
        </>
      )
    });
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <MeetingList meetings={meetings} onDelete={handleDelete} />
    </div>
  );
}
