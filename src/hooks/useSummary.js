import { useState, useCallback } from 'react';
import * as llmService from '../services/llmService';
import { saveSummary, updateMeeting } from './useMeetings';
import useUIStore from '../stores/uiStore';
import { getErrorMessage } from '../utils/errorMessages';

export default function useSummary() {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [modelProgress, setModelProgress] = useState(null);
  const addToast = useUIStore((s) => s.addToast);

  const loadModel = useCallback(async () => {
    if (llmService.isLLMLoaded()) return;

    try {
      await llmService.initLLM((progress) => {
        setModelProgress(progress);
      });
      setModelProgress(null);
    } catch (err) {
      console.error('Failed to load LLM:', err);
      const msg = getErrorMessage('MODEL_NOT_LOADED');
      addToast({ type: msg.type, title: msg.title, message: msg.message });
      throw err;
    }
  }, [addToast]);

  const generateSummary = useCallback(
    async (meetingId, transcriptText) => {
      setIsSummarizing(true);
      try {
        await loadModel();
        await updateMeeting(meetingId, { summaryStatus: 'processing' });

        const summary = await llmService.summarizeMeeting(transcriptText);
        await saveSummary(meetingId, summary);
        await updateMeeting(meetingId, { summaryStatus: 'completed' });

        addToast({
          type: 'success',
          title: 'Phân tích hoàn tất',
          message: 'Tóm tắt cuộc họp đã được tạo.',
        });
      } catch (err) {
        console.error('Summary failed:', err);
        await updateMeeting(meetingId, { summaryStatus: 'error' });
        addToast({
          type: 'error',
          title: 'Phân tích thất bại',
          message: 'Không thể tạo tóm tắt. Vui lòng thử lại.',
        });
      } finally {
        setIsSummarizing(false);
      }
    },
    [loadModel, addToast]
  );

  return {
    isSummarizing,
    modelProgress,
    generateSummary,
    isLLMLoaded: llmService.isLLMLoaded,
  };
}
