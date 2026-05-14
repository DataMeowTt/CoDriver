/**
 * Hardware capability detection for GPU/CPU selection
 */

let cachedResult = null;

/**
 * Detect hardware capabilities
 * @returns {Promise<{ hasWebGPU: boolean, gpuName: string, recommendation: string }>}
 */
export async function detectHardware() {
  if (cachedResult) return cachedResult;

  const result = {
    hasWebGPU: false,
    gpuName: 'Không xác định',
    recommendation: 'cpu',
  };

  try {
    if ('gpu' in navigator) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        result.hasWebGPU = true;
        const info = await adapter.requestAdapterInfo?.();
        if (info) {
          result.gpuName = info.description || info.device || 'GPU khả dụng';
        }
        result.recommendation = 'webgpu';
      }
    }
  } catch (e) {
    console.warn('WebGPU detection failed:', e);
  }

  cachedResult = result;
  return result;
}

/**
 * Get effective device based on user preference + hardware
 */
export async function getEffectiveDevice(userPreference) {
  if (userPreference === 'cpu') return 'wasm';
  if (userPreference === 'gpu') {
    const hw = await detectHardware();
    return hw.hasWebGPU ? 'webgpu' : 'wasm';
  }
  // auto
  const hw = await detectHardware();
  return hw.hasWebGPU ? 'webgpu' : 'wasm';
}

/**
 * Get device-change warning message
 */
export function getDeviceWarning(device) {
  switch (device) {
    case 'gpu':
      return 'Chế độ GPU có thể tạo transcript nhanh hơn nhưng sẽ sử dụng nhiều tài nguyên đồ họa hơn.';
    case 'cpu':
      return 'Chế độ CPU ổn định trên nhiều thiết bị hơn nhưng thời gian tạo transcript có thể lâu hơn.';
    default:
      return 'Hệ thống sẽ tự động chọn thiết bị xử lý phù hợp nhất.';
  }
}
