# Meetily — Trợ lý cuộc họp AI chạy cục bộ

<div align="center">

**Ghi âm · Phiên âm · Tóm tắt — Hoàn toàn trên máy của bạn**

![Version](https://img.shields.io/badge/version-0.3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Rust](https://img.shields.io/badge/Rust-1.77+-orange)
![Node](https://img.shields.io/badge/Node.js-22+-brightgreen)

</div>

---

## Mục lục

- [Tổng quan](#tổng-quan)
- [Tính năng](#tính-năng)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cài đặt và chạy](#cài-đặt-và-chạy)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Luồng hoạt động](#luồng-hoạt-động)
- [Kiểm thử](#kiểm-thử)
- [Giới hạn và hướng phát triển](#giới-hạn-và-hướng-phát-triển)

---

## Tổng quan

**Meetily** là ứng dụng desktop AI hỗ trợ ghi âm, phiên âm thời gian thực và tóm tắt cuộc họp, chạy **hoàn toàn trên máy cục bộ** mà không cần kết nối internet hay gửi dữ liệu lên cloud.

### Vấn đề giải quyết

Các công cụ ghi họp phổ biến hiện nay (Otter.ai, Fireflies, Microsoft Copilot...) đều gửi âm thanh và nội dung cuộc họp lên máy chủ của nhà cung cấp, đặt ra rủi ro nghiêm trọng về bảo mật và quyền riêng tư — đặc biệt với các cuộc họp chứa thông tin nhạy cảm về kinh doanh, pháp lý hay kỹ thuật.

Meetily giải quyết vấn đề này bằng cách:

| Vấn đề | Giải pháp |
|---|---|
| Dữ liệu gửi lên cloud | Toàn bộ xử lý diễn ra trên máy người dùng |
| Chi phí API cao | Dùng Whisper.cpp + Parakeet (open source, miễn phí) |
| Phụ thuộc một LLM duy nhất | Hỗ trợ Ollama, Claude, GPT, Groq, OpenRouter, custom endpoint |
| Mất dữ liệu nếu app crash | Transcript recovery từ IndexedDB local storage |

---

## Tính năng

- **Ghi âm thời gian thực** — Capture đồng thời microphone và system audio, trộn âm thanh chuyên nghiệp với RMS ducking
- **Phiên âm tại chỗ** — Sử dụng Whisper.cpp hoặc Parakeet, hỗ trợ tăng tốc GPU (Metal/CUDA/Vulkan)
- **Tóm tắt AI** — Kết nối với Ollama (local), Claude, OpenAI, Groq, OpenRouter hoặc custom endpoint
- **Lịch sử cuộc họp** — Lưu trữ toàn bộ transcript và tóm tắt vào SQLite cục bộ
- **Import audio** — Import file âm thanh có sẵn để phiên âm lại
- **Re-transcription** — Phiên âm lại với model khác hoặc ngôn ngữ khác
- **Auto meeting detection** — Tự phát hiện khi đang vào cuộc họp (Zoom, Teams, Google Meet...) và gợi ý bắt đầu ghi
- **Ghi chú rich text** — Editor BlockNote gắn với từng cuộc họp
- **Transcript recovery** — Khôi phục transcript nếu ứng dụng bị đóng đột ngột
- **System tray** — Ghi âm ngầm từ khay hệ thống
- **Đa nền tảng** — macOS, Windows, Linux

---

## Kiến trúc hệ thống

Meetily gồm ba thành phần chạy song song:

```
┌──────────────────────────────────────────────────────────────┐
│                  Desktop App (Tauri + Next.js)                │
│                                                               │
│   Next.js UI (React/TypeScript)  ←→  Rust Core (Tauri)      │
│   - Giao diện người dùng               - Audio capture       │
│   - React Contexts (state)             - Whisper/Parakeet     │
│   - Tauri IPC calls                    - LLM summary          │
│   - IndexedDB (recovery)               - SQLite database      │
│                                        - System tray          │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP (localhost)
          ┌────────────────┴─────────────────┐
          ▼                                   ▼
┌──────────────────┐               ┌──────────────────────┐
│  FastAPI Backend │               │  Whisper.cpp Server  │
│  Python          │               │  C++ binary          │
│  port 5167       │               │  port 8178           │
│                  │               │                      │
│  Meeting CRUD    │               │  STT engine          │
│  LLM summary     │               │  GPU accelerated     │
│  SQLite (async)  │               │  REST API            │
└──────────────────┘               └──────────────────────┘
```

### Audio Pipeline

```
Microphone ──┐
             ├──→ Ring Buffer (600ms) ──→ RMS Mixing ──→ File (WAV/WebM)
System Audio─┘         │
                   VAD Filter
                        │
               Whisper / Parakeet
                        │
               Transcript Segments ──→ SQLite + UI
```

### Giao tiếp Frontend ↔ Rust

**Frontend gọi Rust (Tauri Commands):**
```typescript
await invoke('start_recording_with_devices_and_meeting', {
  mic_device_name: "Built-in Microphone",
  system_device_name: "BlackHole 2ch",
  meeting_name: "Team Standup"
});
```

**Rust phát sự kiện về Frontend (Tauri Events):**
```typescript
await listen<TranscriptUpdate>('transcript-update', (event) => {
  setTranscripts(prev => [...prev, event.payload]);
});
```

---

## Công nghệ sử dụng

### Frontend (Tauri Desktop App)

| Thành phần | Công nghệ | Phiên bản |
|---|---|---|
| Desktop framework | Tauri | 2.6.2 |
| UI framework | Next.js + React | 14 + 18 |
| Ngôn ngữ | TypeScript | 5.7 |
| Styling | Tailwind CSS + Radix UI | 3.4 |
| Rich text editor | BlockNote | 0.36 |
| Animations | Framer Motion | 11 |
| Notifications | Sonner | 2.0 |
| Package manager | pnpm | — |

### Rust Core (src-tauri)

| Thành phần | Thư viện |
|---|---|
| Speech-to-text | whisper-rs (Whisper.cpp bindings) |
| Alternative STT | ort (ONNX Runtime — Parakeet) |
| Audio I/O | cpal |
| Audio resampling | rubato |
| Database | sqlx (SQLite async) |
| Async runtime | tokio |
| HTTP client | reqwest |
| GPU acceleration | Metal / CUDA / Vulkan (qua Cargo features) |

### Backend (FastAPI)

| Thành phần | Thư viện | Phiên bản |
|---|---|---|
| Web framework | FastAPI | 0.115.9 |
| Database | aiosqlite | 0.21.0 |
| LLM client | pydantic-ai | 0.2.15 |
| Ollama client | ollama | 0.5.2 |
| ASGI server | uvicorn | 0.34.0 |

### LLM Providers hỗ trợ

| Provider | Loại | Ghi chú |
|---|---|---|
| Ollama | Local (khuyến nghị) | Chạy hoàn toàn offline |
| Claude (Anthropic) | Cloud | Cần API key |
| OpenAI (GPT) | Cloud | Cần API key |
| Groq | Cloud | Cần API key |
| OpenRouter | Cloud | Cần API key |
| Custom endpoint | Local/Cloud | Bất kỳ OpenAI-compatible API |

### Whisper Models

| Model | Kích thước | Tốc độ | Độ chính xác |
|---|---|---|---|
| tiny | ~75MB | Rất nhanh | Thấp |
| base | ~150MB | Nhanh | Trung bình thấp |
| small | ~500MB | Trung bình | Trung bình |
| medium | ~1.5GB | Chậm | Tốt |
| large-v3 | ~3GB | Chậm nhất | Tốt nhất |
| large-v3-turbo | ~1.5GB | Nhanh hơn large | Gần large-v3 |

---

## Cài đặt và chạy

### Yêu cầu hệ thống

- **Node.js** 22.12+
- **pnpm** (cài qua `npm install -g pnpm`)
- **Rust** 1.77+ (cài tại https://rustup.rs)
- **Python** 3.9+
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: Visual Studio Build Tools với C++ workload

### Bước 1 — Clone và cài Rust

```bash
git clone <repo-url>
cd meetily

# Cài Rust nếu chưa có
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Bước 2 — Build Backend + Whisper (chạy 1 lần)

```bash
cd backend
./build_whisper.sh small   # Tải model ~500MB, build Whisper.cpp từ source
```

> Thay `small` bằng `tiny` (nhanh hơn, kém chính xác) hoặc `large-v3` (chậm hơn, chính xác nhất).

### Bước 3 — Chạy Backend (Terminal 1)

```bash
cd backend
./clean_start_backend.sh
# Khi thấy "All services started" → Whisper (port 8178) + FastAPI (port 5167) đã sẵn sàng
```

### Bước 4 — Chạy Frontend (Terminal 2)

```bash
cd frontend
./clean_run.sh             # macOS (lần đầu mất 10–20 phút do compile Rust)
# Hoặc: clean_run_windows.bat trên Windows
```

### Cổng dịch vụ

| Dịch vụ | Cổng | Mô tả |
|---|---|---|
| Whisper Server | 8178 | STT engine |
| FastAPI Backend | 5167 | Meeting CRUD + LLM |
| Next.js Dev | 3118 | UI (chỉ trong dev mode) |

### Tăng tốc GPU (tuỳ chọn)

```bash
cd frontend
pnpm run tauri:dev:metal    # macOS — Apple Metal (mặc định trên Mac)
pnpm run tauri:dev:cuda     # Windows/Linux — NVIDIA CUDA
pnpm run tauri:dev:vulkan   # Windows/Linux — AMD/Intel Vulkan
```

### Docker (Cross-platform)

```bash
cd backend
./run-docker.sh start --interactive   # macOS/Linux
.\run-docker.ps1 start -Interactive   # Windows
```

---

## Cấu trúc thư mục

```
meetily/
├── frontend/                        Tauri desktop app
│   ├── src/                         Next.js frontend (TypeScript)
│   │   ├── app/                     Pages (App Router)
│   │   │   ├── page.tsx             Trang ghi âm chính
│   │   │   ├── meeting-details/     Chi tiết cuộc họp
│   │   │   ├── notes/               Ghi chú
│   │   │   └── settings/            Cài đặt
│   │   ├── components/              React UI components
│   │   ├── contexts/                Global state (Recording, Transcript, Config...)
│   │   ├── hooks/                   Custom hooks
│   │   └── services/                Tauri IPC wrappers
│   └── src-tauri/                   Rust backend
│       └── src/
│           ├── lib.rs               Entry point, đăng ký Tauri commands
│           ├── audio/               Audio pipeline (35+ modules)
│           │   ├── pipeline.rs      Ring buffer, VAD, mixing
│           │   ├── recording_manager.rs
│           │   ├── devices/         Platform-specific device discovery
│           │   └── capture/         Audio stream capture
│           ├── whisper_engine/      Whisper model management + STT
│           ├── parakeet_engine/     Parakeet ONNX model (alternative STT)
│           ├── summary/             LLM summarization engine
│           ├── database/            SQLite via sqlx
│           ├── auto_meeting.rs      Auto meeting detection
│           └── notifications/       Desktop notifications
│
├── backend/                         FastAPI Python server
│   ├── app/
│   │   ├── main.py                  API endpoints
│   │   ├── db.py                    DatabaseManager
│   │   ├── transcript_processor.py  LLM summarization (pydantic-ai)
│   │   └── schema_validator.py      DB schema validation
│   ├── build_whisper.sh             Build Whisper.cpp + tải model
│   └── clean_start_backend.sh       Start tất cả services backend
│
└── scripts/
    └── inject_transcript.py         Dev tool: inject CSV transcript vào DB
```

---

## Luồng hoạt động

### Ghi âm đến tóm tắt (end-to-end)

```
1. User nhấn Record
   └─ TypeScript: invoke('start_recording_with_devices_and_meeting')
   └─ Rust: khởi tạo AudioStreamManager + AudioPipelineManager + RecordingSaver

2. Đang ghi âm
   └─ Mic + System Audio → Ring Buffer (600ms) → RMS Mixing
   └─ VAD filter lọc khoảng lặng → Whisper Engine
   └─ Rust emit 'transcript-update' → TranscriptContext → UI realtime

3. User nhấn Stop
   └─ Rust: dừng stream, lưu file audio
   └─ TypeScript: RecordingPostProcessingProvider gửi transcript lên FastAPI
   └─ FastAPI lưu vào SQLite

4. User nhấn Generate Summary
   └─ TypeScript: invoke('generate_summary', {provider, model})
   └─ Rust: summary::service → llm_client → LLM API
   └─ Kết quả JSON → lưu DB → hiển thị AISummary component
```

### Backend API chính

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/get-meetings` | Danh sách meetings |
| GET | `/get-meeting/{id}` | Chi tiết + transcripts |
| POST | `/process-transcript` | Gọi LLM tạo summary |
| GET | `/get-summary/{id}` | Lấy summary đã lưu |
| POST | `/save-transcript` | Lưu transcript mới |
| POST | `/delete-meeting` | Xóa meeting |
| POST | `/search-transcripts` | Tìm kiếm transcript |
| GET/POST | `/get-model-config` / `/save-model-config` | Cấu hình LLM |

---

## Kiểm thử

### Rust Unit Tests — 106 test functions

Các test nằm inline trong module Rust, sử dụng `#[cfg(test)]`:

```bash
cd frontend/src-tauri
cargo test                       # Chạy tất cả
cargo test auto_meeting          # Chỉ test auto meeting detection
cargo test audio                 # Chỉ test audio pipeline
```

Phân bổ theo module:

| Module | Số test | Nội dung kiểm thử |
|---|---|---|
| `audio/decoder.rs` | 16 | Format conversion, resample 48kHz→16kHz, stereo→mono |
| `audio/import.rs` | 15 | Import pipeline, phân đoạn silence, metadata validation |
| `audio/device_detection.rs` | 9 | AirPods, Bluetooth buffer timeout, virtual device |
| `auto_meeting.rs` | 5 | PipeWire signals, browser capture, confidence window |
| `audio/vad.rs` | 5 | Chunked processing, cancellation, segmentation |
| `audio/ffmpeg_mixer.rs` | 4 | Audio mixing |
| `summary/templates/` | 3 | Template validation, serialization |
| `audio/buffer_pool.rs` | 3 | RAII, pool max size |
| `audio/hardware_detector.rs` | 3 | GPU detection |
| `summary/summary_engine/client.rs` | 3 | LLM request/response |
| Các module khác | ~40 | diagnostics, permissions, system audio... |

Ví dụ test:

```rust
// auto_meeting.rs
#[test]
fn detects_after_confidence_window() { ... }

#[test]
fn detects_browser_capture_signals() { ... }

// audio/decoder.rs
#[test]
fn test_to_whisper_format_resamples_48k_to_16k() { ... }

// audio/vad.rs
#[test]
fn test_vad_chunked_vs_single_processing() { ... }
```

### Công cụ test thủ công

**`scripts/inject_transcript.py`** — Inject CSV transcript vào database để test UI mà không cần ghi âm thật:

```bash
python scripts/inject_transcript.py \
  --csv transcript.csv \
  --title "Test Meeting"
```

**`scripts/test-update-locally.js`** — Server HTTP port 8080 phục vụ `latest.json` để test luồng auto-update:

```bash
node scripts/test-update-locally.js
```

### Phạm vi kiểm thử hiện tại

| Loại | Trạng thái |
|---|---|
| Rust unit tests (audio, STT, auto meeting) | Có — 106 tests |
| Frontend unit tests (Jest/Vitest) | Chưa có |
| Frontend E2E tests (Playwright/Cypress) | Chưa có |
| Backend Python tests (pytest) | Chưa có |
| CI tự động chạy tests | Chưa có (CI chỉ build) |

---

## Giới hạn và hướng phát triển

### Giới hạn hiện tại

- System audio trên macOS yêu cầu cài thêm **BlackHole** (virtual audio device)
- Model Whisper lớn (large-v3, ~3GB) cần tải lần đầu và RAM nhiều
- LLM tóm tắt qua Ollama cần GPU hoặc thời gian chờ dài trên CPU
- Frontend và Backend Python chưa có automated tests

### Hướng phát triển tiếp theo

- Nhận diện người nói (Speaker Diarization)
- Tích hợp lịch (Google Calendar, Outlook)
- Hỗ trợ thêm ngôn ngữ phiên âm
- Tối ưu pipeline cho máy cấu hình thấp
- Bổ sung test coverage cho Frontend và Backend

---

## Giấy phép

MIT License — xem file [LICENSE.md](LICENSE.md) để biết chi tiết.
