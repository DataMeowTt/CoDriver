export const APP_NAME = 'Meeting Recorder';

export const TRANSCRIPT_MODES = {
  AUTO_LIGHT: 'auto_light',
  AFTER_MEETING: 'after_meeting',
  IMMEDIATE: 'immediate',
};

export const TRANSCRIPT_MODE_LABELS = {
  [TRANSCRIPT_MODES.AUTO_LIGHT]: 'Tự động nhẹ',
  [TRANSCRIPT_MODES.AFTER_MEETING]: 'Chạy sau cuộc họp',
  [TRANSCRIPT_MODES.IMMEDIATE]: 'Chạy ngay',
};

export const PROCESSING_DEVICES = {
  AUTO: 'auto',
  CPU: 'cpu',
  GPU: 'gpu',
};

export const DEVICE_LABELS = {
  [PROCESSING_DEVICES.AUTO]: 'Tự động',
  [PROCESSING_DEVICES.CPU]: 'CPU',
  [PROCESSING_DEVICES.GPU]: 'GPU',
};

export const RESOURCE_LEVELS = {
  LOW: 'low',
  BALANCED: 'balanced',
  MAX: 'max',
};

export const RESOURCE_LABELS = {
  [RESOURCE_LEVELS.LOW]: 'Thấp',
  [RESOURCE_LEVELS.BALANCED]: 'Cân bằng',
  [RESOURCE_LEVELS.MAX]: 'Tối đa',
};

export const MEETING_STATUS = {
  RECORDING: 'recording',
  PAUSED: 'paused',
  COMPLETED: 'completed',
};

export const PROCESS_STATUS = {
  NONE: 'none',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
};

export const WHISPER_MODELS = {
  TINY: 'onnx-community/whisper-tiny',
  SMALL: 'onnx-community/whisper-small',
};

export const WHISPER_MODEL_LABELS = {
  [WHISPER_MODELS.TINY]: 'Tiny (~40MB, nhanh)',
  [WHISPER_MODELS.SMALL]: 'Small (~500MB, chính xác hơn)',
};

export const SUMMARY_TYPES = {
  BRIEF: 'brief',
  KEY_POINTS: 'keyPoints',
  DECISIONS: 'decisions',
  TASKS: 'tasks',
  OPEN_ISSUES: 'openIssues',
};
