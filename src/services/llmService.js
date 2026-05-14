/**
 * LLM Summarization service using WebLLM
 * Runs locally in the browser via WebGPU
 */

let engine = null;
let isLoading = false;

const DEFAULT_MODEL = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

/**
 * Initialize the LLM engine
 * @param {function} onProgress - Progress callback
 */
export async function initLLM(onProgress) {
  if (engine) return;
  if (isLoading) return;

  isLoading = true;

  try {
    const webllm = await import('@mlc-ai/web-llm');
    engine = await webllm.CreateMLCEngine(DEFAULT_MODEL, {
      initProgressCallback: onProgress,
    });
  } finally {
    isLoading = false;
  }
}

/**
 * Summarize meeting transcript
 * @param {string} transcript - Full transcript text
 * @returns {Promise<object>} Summary object with brief, keyPoints, decisions, tasks, openIssues
 */
export async function summarizeMeeting(transcript) {
  if (!engine) throw new Error('LLM not initialized');

  const prompt = `Bạn là trợ lý phân tích cuộc họp. Hãy phân tích nội dung cuộc họp sau và trả về kết quả dưới dạng JSON với cấu trúc sau:
{
  "brief": "tóm tắt ngắn gọn nội dung chính của cuộc họp trong 2-3 câu",
  "keyPoints": ["ý chính 1", "ý chính 2", ...],
  "decisions": ["quyết định 1", "quyết định 2", ...],
  "tasks": [{"task": "nội dung công việc", "assignee": "người phụ trách", "deadline": "thời hạn nếu có"}],
  "openIssues": ["vấn đề còn mở 1", "vấn đề còn mở 2", ...]
}

Nếu không có thông tin cho mục nào, để mảng rỗng [].
Chỉ trả về JSON, không giải thích thêm.

Nội dung cuộc họp:
${transcript}`;

  const response = await engine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 2048,
  });

  const content = response.choices[0].message.content;

  // Try to parse JSON from response
  try {
    // Extract JSON from potential markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    return JSON.parse(jsonMatch[1].trim());
  } catch {
    // Fallback structure
    return {
      brief: content,
      keyPoints: [],
      decisions: [],
      tasks: [],
      openIssues: [],
    };
  }
}

/**
 * Check if LLM is loaded
 */
export function isLLMLoaded() {
  return engine !== null;
}

export function isLLMLoading() {
  return isLoading;
}

/**
 * Dispose of the LLM engine
 */
export async function disposeLLM() {
  if (engine) {
    await engine.unload?.();
    engine = null;
  }
}
