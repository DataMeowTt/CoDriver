/**
 * Whisper Speech-to-Text service using Transformers.js
 * Runs locally in the browser via WebAssembly or WebGPU
 */

let whisperPipeline = null;
let isLoading = false;

/**
 * Initialize the Whisper model
 * @param {string} modelId - HuggingFace model identifier
 * @param {object} options - { device, onProgress }
 */
export async function initWhisper(modelId, options = {}) {
  if (whisperPipeline) return;
  if (isLoading) return;

  isLoading = true;

  try {
    // Dynamic import to avoid loading the heavy library upfront
    const { pipeline } = await import('@huggingface/transformers');

    whisperPipeline = await pipeline('automatic-speech-recognition', modelId, {
      device: options.device || 'wasm',
      dtype: 'q4',
      progress_callback: options.onProgress || null,
    });
  } finally {
    isLoading = false;
  }
}

/**
 * Transcribe audio data
 * @param {Float32Array} audioData - 16kHz mono audio
 * @param {string} language - Language code (default: 'vi')
 * @returns {Promise<{ text: string, chunks: Array<{ timestamp: [number, number], text: string }> }>}
 */
export async function transcribe(audioData, language = 'vi') {
  if (!whisperPipeline) {
    throw new Error('Whisper model not initialized');
  }

  const result = await whisperPipeline(audioData, {
    language,
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  return result;
}

/**
 * Check if model is loaded
 */
export function isModelLoaded() {
  return whisperPipeline !== null;
}

/**
 * Check if model is currently loading
 */
export function isModelLoading() {
  return isLoading;
}

/**
 * Dispose of the model to free memory
 */
export async function disposeWhisper() {
  if (whisperPipeline) {
    await whisperPipeline.dispose?.();
    whisperPipeline = null;
  }
}
