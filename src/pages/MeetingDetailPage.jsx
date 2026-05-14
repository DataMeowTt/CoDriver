import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, ArrowLeft, RefreshCw, Wand2, FileText, LayoutDashboard } from 'lucide-react';
import { useMeeting, useMeetingSegments, useMeetingSummary, useMeetingAudio } from '../hooks/useMeetings';
import useTranscription from '../hooks/useTranscription';
import useSummary from '../hooks/useSummary';
import { formatDurationText, formatDate } from '../utils/formatTime';
import { PROCESS_STATUS } from '../utils/constants';

import TranscriptView from '../components/Transcript/TranscriptView';
import TranscriptSearch from '../components/Transcript/TranscriptSearch';
import SummaryPanel from '../components/Summary/SummaryPanel';
import ExportMenu from '../components/Export/ExportMenu';
import ProgressBar from '../components/Common/ProgressBar';

export default function MeetingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('transcript');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const meeting = useMeeting(id);
  const segments = useMeetingSegments(id);
  const summary = useMeetingSummary(id);
  const audioData = useMeetingAudio(id);

  const { isTranscribing, progress: tProgress, modelProgress: tModelProgress, transcribeAudio } = useTranscription();
  const { isSummarizing, modelProgress: sModelProgress, generateSummary } = useSummary();

  // Create audio URL when blob is loaded
  useEffect(() => {
    if (audioData?.blob) {
      const url = URL.createObjectURL(audioData.blob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioData]);

  if (meeting === undefined) return null; // loading
  if (meeting === null) return <div className="fade-in">Cuộc họp không tồn tại.</div>;

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const jumpToTime = (seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      if (!isPlaying) handlePlayPause();
    }
  };

  const handleTranscribe = () => {
    if (audioData?.blob) {
      transcribeAudio(meeting.id, audioData.blob);
    }
  };

  const handleSummarize = () => {
    if (segments && segments.length > 0) {
      const fullText = segments.map(s => s.text).join(' ');
      generateSummary(meeting.id, fullText);
      setActiveTab('summary');
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Back & Export Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/history')} style={{ paddingLeft: 0 }}>
          <ArrowLeft size={16} />
          <span>Quay lại</span>
        </button>
        <ExportMenu meeting={meeting} segments={segments} summary={summary} />
      </div>

      {/* Header Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 className="page-title" style={{ marginBottom: 'var(--space-2)' }}>{meeting.title}</h2>
        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', display: 'flex', gap: 'var(--space-4)' }}>
          <span>{formatDate(meeting.date)}</span>
          <span>•</span>
          <span>{formatDurationText(meeting.duration)}</span>
        </div>

        {/* Audio Player */}
        {audioUrl && (
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', background: 'var(--bg-tertiary)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-full)' }}>
            <button className="btn btn-primary btn-icon" onClick={handlePlayPause} style={{ borderRadius: '50%' }}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
            </button>
            <audio 
              ref={audioRef} 
              src={audioUrl} 
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              controls
              style={{ height: '32px', flex: 1, filter: 'invert(1) hue-rotate(180deg)' }} // Quick dark mode hack for native audio
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
        <button 
          className={`btn ${activeTab === 'transcript' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('transcript')}
        >
          <FileText size={16} /> Transcript
        </button>
        <button 
          className={`btn ${activeTab === 'summary' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('summary')}
        >
          <LayoutDashboard size={16} /> Tóm tắt AI
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        
        {/* === TRANSCRIPT TAB === */}
        {activeTab === 'transcript' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 'var(--space-4)' }}>
            
            {/* Status & Actions */}
            {meeting.transcriptStatus !== PROCESS_STATUS.COMPLETED && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)', textAlign: 'center' }}>
                {isTranscribing ? (
                  <div style={{ width: '100%', maxWidth: '400px' }}>
                    <p style={{ marginBottom: 'var(--space-4)', fontWeight: 'var(--weight-medium)' }}>
                      {tModelProgress ? 'Đang tải model AI...' : 'Đang phiên âm cuộc họp...'}
                    </p>
                    <ProgressBar 
                      value={tModelProgress ? tModelProgress.progress : tProgress} 
                      label={tModelProgress ? `${tModelProgress.file} (${Math.round(tModelProgress.progress)}%)` : `${tProgress}%`}
                    />
                  </div>
                ) : (
                  <>
                    <p style={{ marginBottom: 'var(--space-4)' }}>Chưa có transcript cho cuộc họp này.</p>
                    <button className="btn btn-primary" onClick={handleTranscribe} disabled={!audioData?.blob}>
                      <RefreshCw size={16} /> Tạo Transcript
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Content */}
            {meeting.transcriptStatus === PROCESS_STATUS.COMPLETED && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ width: '300px' }}>
                    <TranscriptSearch onSearch={setSearchQuery} />
                  </div>
                  {meeting.summaryStatus === PROCESS_STATUS.NONE && (
                    <button className="btn btn-primary" onClick={handleSummarize} disabled={isSummarizing}>
                      <Wand2 size={16} /> Phân tích AI
                    </button>
                  )}
                </div>
                
                <div className="card" style={{ flex: 1, overflowY: 'auto' }}>
                  <TranscriptView 
                    segments={segments} 
                    searchQuery={searchQuery} 
                    onTimestampClick={jumpToTime}
                    editable={true}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* === SUMMARY TAB === */}
        {activeTab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {meeting.summaryStatus !== PROCESS_STATUS.COMPLETED && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)', textAlign: 'center' }}>
                {isSummarizing ? (
                  <div style={{ width: '100%', maxWidth: '400px' }}>
                    <p style={{ marginBottom: 'var(--space-4)', fontWeight: 'var(--weight-medium)' }}>
                      {sModelProgress ? 'Đang tải WebLLM model...' : 'AI đang phân tích cuộc họp...'}
                    </p>
                    <ProgressBar 
                      value={sModelProgress ? sModelProgress.progress : 100} 
                      color="success"
                      label={sModelProgress ? `${Math.round(sModelProgress.progress)}%` : 'Vui lòng chờ...'}
                    />
                  </div>
                ) : (
                  <>
                    <p style={{ marginBottom: 'var(--space-4)' }}>
                      {meeting.transcriptStatus === PROCESS_STATUS.COMPLETED 
                        ? 'Chưa tạo tóm tắt AI. Hãy sử dụng WebLLM để phân tích transcript.'
                        : 'Cần có transcript trước khi có thể phân tích bằng AI.'}
                    </p>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSummarize} 
                      disabled={meeting.transcriptStatus !== PROCESS_STATUS.COMPLETED}
                    >
                      <Wand2 size={16} /> Phân tích AI
                    </button>
                  </>
                )}
              </div>
            )}

            {meeting.summaryStatus === PROCESS_STATUS.COMPLETED && (
              <div style={{ paddingBottom: 'var(--space-8)' }}>
                <SummaryPanel summary={summary} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
