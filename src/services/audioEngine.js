/**
 * Audio recording engine using Web Audio API + MediaRecorder
 */

let mediaRecorder = null;
let audioContext = null;
let analyserNode = null;
let sourceNode = null;
let audioChunks = [];

/**
 * Start recording from microphone
 * @returns {{ analyserNode: AnalyserNode }} for visualization
 */
export async function startRecording() {
  audioChunks = [];

  // Request microphone access
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000,
    },
  });

  // Set up audio context for visualization
  audioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 16000,
  });
  sourceNode = audioContext.createMediaStreamSource(stream);
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 2048;
  analyserNode.smoothingTimeConstant = 0.8;
  sourceNode.connect(analyserNode);

  // Determine best mime type
  const mimeType = getMimeType();

  // Create recorder
  mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    audioBitsPerSecond: 128000,
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      audioChunks.push(e.data);
    }
  };

  mediaRecorder.start(1000); // Collect chunks every 1 second

  return { analyserNode };
}

/**
 * Pause recording
 */
export function pauseRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
  }
}

/**
 * Resume recording
 */
export function resumeRecording() {
  if (mediaRecorder && mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
  }
}

/**
 * Stop recording and return audio blob
 * @returns {Promise<Blob>}
 */
export function stopRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder) {
      resolve(null);
      return;
    }

    mediaRecorder.onstop = () => {
      const mimeType = mediaRecorder.mimeType;
      const blob = new Blob(audioChunks, { type: mimeType });
      audioChunks = [];

      // Clean up
      if (sourceNode) sourceNode.disconnect();
      if (audioContext) audioContext.close();
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());

      mediaRecorder = null;
      audioContext = null;
      analyserNode = null;
      sourceNode = null;

      resolve(blob);
    };

    mediaRecorder.stop();
  });
}

/**
 * Get current recording state
 */
export function getRecordingState() {
  if (!mediaRecorder) return 'inactive';
  return mediaRecorder.state;
}

/**
 * Get the analyser node for visualization
 */
export function getAnalyserNode() {
  return analyserNode;
}

/**
 * Determine best supported MIME type
 */
function getMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

/**
 * Convert audio blob to Float32Array for Whisper
 */
export async function blobToFloat32Array(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 16000);
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  // Re-create context with proper length
  const offlineCtx = new OfflineAudioContext(
    1,
    audioBuffer.duration * 16000,
    16000
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();

  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer.getChannelData(0);
}

/**
 * Create audio URL from blob for playback
 */
export function createAudioURL(blob) {
  return URL.createObjectURL(blob);
}
