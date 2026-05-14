import { create } from 'zustand';
import { TRANSCRIPT_MODES, PROCESSING_DEVICES, RESOURCE_LEVELS, WHISPER_MODELS } from '../utils/constants';

const STORAGE_KEY = 'meeting-recorder-settings';

function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

const defaults = {
  transcriptMode: TRANSCRIPT_MODES.AUTO_LIGHT,
  processingDevice: PROCESSING_DEVICES.AUTO,
  resourceLevel: RESOURCE_LEVELS.BALANCED,
  whisperModel: WHISPER_MODELS.TINY,
  language: 'vi',
};

const useSettingsStore = create((set, get) => ({
  ...defaults,
  ...loadSettings(),

  setSetting: (key, value) => {
    set({ [key]: value });
    const state = get();
    const toSave = {};
    for (const k of Object.keys(defaults)) {
      toSave[k] = state[k];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  },

  resetSettings: () => {
    set(defaults);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
  },
}));

export default useSettingsStore;
