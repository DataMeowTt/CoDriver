import { create } from 'zustand';
import { MEETING_STATUS } from '../utils/constants';

const useRecordingStore = create((set) => ({
  // Recording state
  status: null, // null = idle, 'recording', 'paused'
  currentMeetingId: null,
  startTime: null,
  elapsed: 0,
  timerInterval: null,

  // Audio analysis
  analyserNode: null,

  setStatus: (status) => set({ status }),
  setCurrentMeetingId: (id) => set({ currentMeetingId: id }),
  setAnalyserNode: (node) => set({ analyserNode: node }),

  startTimer: () => {
    set((state) => {
      if (state.timerInterval) clearInterval(state.timerInterval);
      const start = Date.now() - state.elapsed * 1000;
      const interval = setInterval(() => {
        set({ elapsed: Math.floor((Date.now() - start) / 1000) });
      }, 1000);
      return { timerInterval: interval, startTime: start };
    });
  },

  pauseTimer: () => {
    set((state) => {
      if (state.timerInterval) clearInterval(state.timerInterval);
      return { timerInterval: null };
    });
  },

  resumeTimer: () => {
    set((state) => {
      const start = Date.now() - state.elapsed * 1000;
      const interval = setInterval(() => {
        set({ elapsed: Math.floor((Date.now() - start) / 1000) });
      }, 1000);
      return { timerInterval: interval };
    });
  },

  resetRecording: () => {
    set((state) => {
      if (state.timerInterval) clearInterval(state.timerInterval);
      return {
        status: null,
        currentMeetingId: null,
        startTime: null,
        elapsed: 0,
        timerInterval: null,
        analyserNode: null,
      };
    });
  },
}));

export default useRecordingStore;
