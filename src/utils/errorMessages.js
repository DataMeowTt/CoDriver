/**
 * User-friendly error messages in Vietnamese
 */
const ERROR_MESSAGES = {
  NO_MICROPHONE: {
    title: 'Không tìm thấy microphone',
    message: 'Vui lòng kiểm tra thiết bị ghi âm hoặc cấp quyền truy cập microphone.',
    type: 'error',
  },
  PERMISSION_DENIED: {
    title: 'Quyền truy cập bị từ chối',
    message: 'Vui lòng cấp quyền truy cập microphone trong cài đặt trình duyệt.',
    type: 'error',
  },
  STORAGE_FULL: {
    title: 'Không đủ dung lượng',
    message: 'Vui lòng xóa một số cuộc họp cũ để giải phóng bộ nhớ.',
    type: 'error',
  },
  MODEL_NOT_LOADED: {
    title: 'Model AI chưa được tải',
    message: 'Vui lòng kiểm tra kết nối mạng và thử lại.',
    type: 'error',
  },
  GPU_UNAVAILABLE: {
    title: 'GPU không khả dụng',
    message: 'Hệ thống sẽ chuyển sang CPU để tiếp tục phiên âm.',
    type: 'warning',
  },
  LOW_ACCURACY: {
    title: 'Chất lượng phiên âm thấp',
    message: 'Transcript có thể không chính xác do âm thanh nhiễu. Bạn có thể chỉnh sửa thủ công.',
    type: 'warning',
  },
  WEBGPU_NOT_SUPPORTED: {
    title: 'Trình duyệt không hỗ trợ WebGPU',
    message: 'Một số tính năng AI sẽ bị giới hạn. Hãy sử dụng Chrome hoặc Edge phiên bản mới nhất.',
    type: 'warning',
  },
  RECORDING_FAILED: {
    title: 'Ghi âm thất bại',
    message: 'Đã xảy ra lỗi trong quá trình ghi âm. Vui lòng thử lại.',
    type: 'error',
  },
  TRANSCRIPT_FAILED: {
    title: 'Phiên âm thất bại',
    message: 'Đã xảy ra lỗi khi chuyển giọng nói thành văn bản. Vui lòng thử lại.',
    type: 'error',
  },
  EXPORT_FAILED: {
    title: 'Xuất dữ liệu thất bại',
    message: 'Không thể tạo file xuất. Vui lòng thử lại.',
    type: 'error',
  },
  SYSTEM_AUDIO_FAILED: {
    title: 'Không ghi được âm thanh hệ thống',
    message: 'Tính năng ghi âm thanh hệ thống có thể không khả dụng trên trình duyệt này.',
    type: 'warning',
  },
};

export function getErrorMessage(code) {
  return ERROR_MESSAGES[code] || {
    title: 'Đã xảy ra lỗi',
    message: 'Vui lòng thử lại hoặc liên hệ hỗ trợ.',
    type: 'error',
  };
}

export default ERROR_MESSAGES;
