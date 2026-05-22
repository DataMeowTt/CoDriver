use chrono::{DateTime, Utc};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_store::StoreExt;
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use uuid::Uuid;

const STORE_FILE: &str = "auto_meeting_preferences.json";
const STORE_KEY: &str = "preferences";
const POLL_INTERVAL_SECONDS: u64 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoMeetingPreferences {
    pub enabled: bool,
    pub prompt_to_start: bool,
    pub prompt_to_stop: bool,
    pub start_confidence_seconds: u64,
    pub stop_grace_seconds: u64,
    pub allowed_apps: Vec<String>,
}

impl Default for AutoMeetingPreferences {
    fn default() -> Self {
        Self {
            enabled: false,
            prompt_to_start: true,
            prompt_to_stop: true,
            start_confidence_seconds: 6,
            stop_grace_seconds: 30,
            allowed_apps: vec![
                "Zoom".to_string(),
                "Microsoft Teams".to_string(),
                "Google Meet".to_string(),
                "Slack".to_string(),
                "Discord".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AutoMeetingState {
    Idle,
    Candidate,
    Detected,
}

impl Default for AutoMeetingState {
    fn default() -> Self {
        Self::Idle
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AutoMeetingStatus {
    pub enabled: bool,
    pub state: AutoMeetingState,
    pub detected_app: Option<String>,
    pub confidence: f32,
    pub last_signal_at: Option<DateTime<Utc>>,
    pub auto_started_recording: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AutoMeetingDetectedPayload {
    pub session_id: String,
    pub app_name: String,
    pub confidence: f32,
    pub signals: Vec<String>,
    pub detected_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AutoMeetingEndedPayload {
    pub session_id: String,
    pub app_name: String,
    pub last_signal_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
struct MeetingSignal {
    app_name: String,
    signals: Vec<String>,
}

#[derive(Debug)]
pub struct DetectorRuntime {
    task: Option<JoinHandle<()>>,
    status: AutoMeetingStatus,
}

pub type AutoMeetingDetectorState = Arc<Mutex<DetectorRuntime>>;

pub fn init_auto_meeting_state() -> AutoMeetingDetectorState {
    Arc::new(Mutex::new(DetectorRuntime {
        task: None,
        status: AutoMeetingStatus::default(),
    }))
}

#[tauri::command]
pub async fn get_auto_meeting_preferences(
    app: AppHandle,
) -> Result<AutoMeetingPreferences, String> {
    load_auto_meeting_preferences(&app).await
}

#[tauri::command]
pub async fn set_auto_meeting_preferences(
    app: AppHandle,
    detector_state: State<'_, AutoMeetingDetectorState>,
    preferences: AutoMeetingPreferences,
) -> Result<(), String> {
    save_auto_meeting_preferences(&app, &preferences).await?;

    if preferences.enabled {
        start_auto_meeting_detection(app, detector_state).await
    } else {
        stop_auto_meeting_detection(app, detector_state).await
    }
}

#[tauri::command]
pub async fn get_auto_meeting_status(
    detector_state: State<'_, AutoMeetingDetectorState>,
) -> Result<AutoMeetingStatus, String> {
    let runtime = detector_state.lock().await;
    Ok(runtime.status.clone())
}

#[tauri::command]
pub async fn start_auto_meeting_detection(
    app: AppHandle,
    detector_state: State<'_, AutoMeetingDetectorState>,
) -> Result<(), String> {
    let preferences = load_auto_meeting_preferences(&app).await?;
    if !preferences.enabled {
        let mut runtime = detector_state.lock().await;
        runtime.status.enabled = false;
        runtime.status.state = AutoMeetingState::Idle;
        emit_status(&app, &runtime.status);
        return Ok(());
    }

    let mut runtime = detector_state.lock().await;
    if runtime.task.is_some() {
        runtime.status.enabled = true;
        emit_status(&app, &runtime.status);
        return Ok(());
    }

    info!("Starting auto meeting detection");
    runtime.status = AutoMeetingStatus {
        enabled: true,
        state: AutoMeetingState::Idle,
        detected_app: None,
        confidence: 0.0,
        last_signal_at: None,
        auto_started_recording: false,
    };
    emit_status(&app, &runtime.status);

    let app_for_task = app.clone();
    let state_for_task = detector_state.inner().clone();
    runtime.task = Some(tokio::spawn(async move {
        detector_loop(app_for_task, state_for_task, preferences).await;
    }));

    Ok(())
}

#[tauri::command]
pub async fn stop_auto_meeting_detection(
    app: AppHandle,
    detector_state: State<'_, AutoMeetingDetectorState>,
) -> Result<(), String> {
    let mut runtime = detector_state.lock().await;
    if let Some(task) = runtime.task.take() {
        task.abort();
    }

    runtime.status = AutoMeetingStatus {
        enabled: false,
        state: AutoMeetingState::Idle,
        detected_app: None,
        confidence: 0.0,
        last_signal_at: None,
        auto_started_recording: false,
    };
    emit_status(&app, &runtime.status);
    info!("Stopped auto meeting detection");
    Ok(())
}

pub async fn load_auto_meeting_preferences(
    app: &AppHandle,
) -> Result<AutoMeetingPreferences, String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to open auto meeting store: {}", e))?;

    if let Some(value) = store.get(STORE_KEY) {
        match serde_json::from_value::<AutoMeetingPreferences>(value.clone()) {
            Ok(preferences) => Ok(preferences),
            Err(e) => {
                warn!("Invalid auto meeting preferences, using defaults: {}", e);
                Ok(AutoMeetingPreferences::default())
            }
        }
    } else {
        Ok(AutoMeetingPreferences::default())
    }
}

async fn save_auto_meeting_preferences(
    app: &AppHandle,
    preferences: &AutoMeetingPreferences,
) -> Result<(), String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to open auto meeting store: {}", e))?;
    let value = serde_json::to_value(preferences)
        .map_err(|e| format!("Failed to serialize auto meeting preferences: {}", e))?;

    store.set(STORE_KEY, value);
    store
        .save()
        .map_err(|e| format!("Failed to save auto meeting preferences: {}", e))?;
    Ok(())
}

async fn detector_loop(
    app: AppHandle,
    detector_state: AutoMeetingDetectorState,
    preferences: AutoMeetingPreferences,
) {
    let mut tracker = DetectionTracker::new(preferences.start_confidence_seconds);
    let mut interval = tokio::time::interval(Duration::from_secs(POLL_INTERVAL_SECONDS));

    loop {
        interval.tick().await;

        let signal = match detect_meeting_signal(&preferences.allowed_apps).await {
            Ok(signal) => signal,
            Err(e) => {
                warn!("Auto meeting detection poll failed: {}", e);
                None
            }
        };

        let transition = tracker.update(signal, preferences.stop_grace_seconds);

        let mut runtime = detector_state.lock().await;
        runtime.status = tracker.status(true);
        emit_status(&app, &runtime.status);
        drop(runtime);

        match transition {
            DetectionTransition::Detected(payload) => {
                info!("Auto meeting detected: {}", payload.app_name);
                if let Err(e) = app.emit("auto-meeting-detected", payload) {
                    error!("Failed to emit auto-meeting-detected: {}", e);
                }
            }
            DetectionTransition::Ended(payload) => {
                info!("Auto meeting ended: {}", payload.app_name);
                if let Err(e) = app.emit("auto-meeting-ended", payload) {
                    error!("Failed to emit auto-meeting-ended: {}", e);
                }
            }
            DetectionTransition::None => {}
        }
    }
}

fn emit_status(app: &AppHandle, status: &AutoMeetingStatus) {
    let _ = app.emit("auto-meeting-status-changed", status);
}

#[derive(Debug)]
enum DetectionTransition {
    None,
    Detected(AutoMeetingDetectedPayload),
    Ended(AutoMeetingEndedPayload),
}

#[derive(Debug)]
struct DetectionTracker {
    state: AutoMeetingState,
    candidate_app: Option<String>,
    candidate_since: Option<Instant>,
    current_session_id: Option<String>,
    current_signals: Vec<String>,
    detected_at: Option<DateTime<Utc>>,
    last_signal_at: Option<DateTime<Utc>>,
    last_signal_instant: Option<Instant>,
    confidence: f32,
    start_confidence_seconds: u64,
}

impl DetectionTracker {
    fn new(start_confidence_seconds: u64) -> Self {
        Self {
            state: AutoMeetingState::Idle,
            candidate_app: None,
            candidate_since: None,
            current_session_id: None,
            current_signals: Vec::new(),
            detected_at: None,
            last_signal_at: None,
            last_signal_instant: None,
            confidence: 0.0,
            start_confidence_seconds,
        }
    }

    fn update(
        &mut self,
        signal: Option<MeetingSignal>,
        stop_grace_seconds: u64,
    ) -> DetectionTransition {
        let now = Instant::now();
        let now_utc = Utc::now();

        if let Some(signal) = signal {
            self.last_signal_at = Some(now_utc);
            self.last_signal_instant = Some(now);
            self.current_signals = signal.signals.clone();

            match self.state {
                AutoMeetingState::Idle => {
                    self.state = AutoMeetingState::Candidate;
                    self.candidate_app = Some(signal.app_name);
                    self.candidate_since = Some(now);
                    self.confidence = 0.0;
                }
                AutoMeetingState::Candidate => {
                    if self.candidate_app.as_deref() != Some(signal.app_name.as_str()) {
                        self.candidate_app = Some(signal.app_name);
                        self.candidate_since = Some(now);
                        self.confidence = 0.0;
                    } else if let Some(candidate_since) = self.candidate_since {
                        let elapsed = now.duration_since(candidate_since).as_secs_f32();
                        let required = self.start_confidence_seconds as f32;
                        self.confidence = if required <= 0.0 {
                            1.0
                        } else {
                            (elapsed / required).min(1.0)
                        };

                        if required <= 0.0 || elapsed >= required {
                            self.state = AutoMeetingState::Detected;
                            self.current_session_id = Some(Uuid::new_v4().to_string());
                            self.detected_at = Some(now_utc);
                            self.confidence = 1.0;
                            return DetectionTransition::Detected(AutoMeetingDetectedPayload {
                                session_id: self.current_session_id.clone().unwrap_or_default(),
                                app_name: self
                                    .candidate_app
                                    .clone()
                                    .unwrap_or_else(|| "Meeting".to_string()),
                                confidence: self.confidence,
                                signals: self.current_signals.clone(),
                                detected_at: now_utc,
                            });
                        }
                    }
                }
                AutoMeetingState::Detected => {
                    self.candidate_app = Some(signal.app_name);
                    self.confidence = 1.0;
                }
            }

            return DetectionTransition::None;
        }

        match self.state {
            AutoMeetingState::Candidate => {
                self.reset();
                DetectionTransition::None
            }
            AutoMeetingState::Detected => {
                if let Some(last_signal_instant) = self.last_signal_instant {
                    if now.duration_since(last_signal_instant).as_secs() >= stop_grace_seconds {
                        let payload = AutoMeetingEndedPayload {
                            session_id: self.current_session_id.clone().unwrap_or_default(),
                            app_name: self
                                .candidate_app
                                .clone()
                                .unwrap_or_else(|| "Meeting".to_string()),
                            last_signal_at: self.last_signal_at.unwrap_or_else(Utc::now),
                        };
                        self.reset();
                        return DetectionTransition::Ended(payload);
                    }
                }
                DetectionTransition::None
            }
            AutoMeetingState::Idle => DetectionTransition::None,
        }
    }

    fn status(&self, enabled: bool) -> AutoMeetingStatus {
        AutoMeetingStatus {
            enabled,
            state: self.state.clone(),
            detected_app: self.candidate_app.clone(),
            confidence: self.confidence,
            last_signal_at: self.last_signal_at,
            auto_started_recording: false,
        }
    }

    fn reset(&mut self) {
        self.state = AutoMeetingState::Idle;
        self.candidate_app = None;
        self.candidate_since = None;
        self.current_session_id = None;
        self.current_signals.clear();
        self.detected_at = None;
        self.last_signal_at = None;
        self.last_signal_instant = None;
        self.confidence = 0.0;
    }
}

async fn detect_meeting_signal(allowed_apps: &[String]) -> Result<Option<MeetingSignal>, String> {
    #[cfg(target_os = "linux")]
    {
        detect_linux_meeting_signal(allowed_apps).await
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = allowed_apps;
        Ok(None)
    }
}

#[cfg(target_os = "linux")]
async fn detect_linux_meeting_signal(
    allowed_apps: &[String],
) -> Result<Option<MeetingSignal>, String> {
    let process_output = run_command("ps", &["-eo", "pid=,comm=,args="]).await?;
    let pipewire_output = run_command("pw-cli", &["ls", "Node"])
        .await
        .unwrap_or_default();
    let wpctl_output = run_command("wpctl", &["status"]).await.unwrap_or_default();

    let process_signal = find_meeting_process(&process_output, allowed_apps);
    let has_media_stream = has_pipewire_media_stream(&pipewire_output, &wpctl_output);
    let has_communication_stream =
        has_pipewire_communication_stream(&pipewire_output, &wpctl_output);
    let has_browser_capture_signal =
        has_browser_capture_signal(&process_output, &pipewire_output, &wpctl_output);

    if let Some((app_name, mut signals)) = process_signal {
        let generic_browser_meet =
            app_name == "Google Meet" && signals.iter().any(|signal| signal == "process:browser");
        let has_specific_meet_signal = signals.iter().any(|signal| signal == "process:google-meet");

        if has_media_stream
            && (!generic_browser_meet
                || has_specific_meet_signal
                || has_communication_stream
                || has_browser_capture_signal)
        {
            signals.push("pipewire-media-stream".to_string());
            if has_communication_stream {
                signals.push("pipewire-communication-stream".to_string());
            }
            if has_browser_capture_signal {
                signals.push("browser-capture-signal".to_string());
            }
            return Ok(Some(MeetingSignal { app_name, signals }));
        }
    }

    Ok(None)
}

#[cfg(target_os = "linux")]
async fn run_command(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to run {}: {}", program, e))?;

    if !output.status.success() {
        return Err(format!("{} exited with status {}", program, output.status));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(target_os = "linux")]
fn find_meeting_process(
    process_output: &str,
    allowed_apps: &[String],
) -> Option<(String, Vec<String>)> {
    let allowed = allowed_apps
        .iter()
        .map(|app| app.to_lowercase())
        .collect::<Vec<_>>();

    let is_allowed = |name: &str| allowed.iter().any(|app| app == &name.to_lowercase());

    for line in process_output.lines() {
        let lower = line.to_lowercase();

        if is_allowed("Zoom") && (lower.contains("zoom") || lower.contains("zoom.us")) {
            return Some(("Zoom".to_string(), vec!["process:zoom".to_string()]));
        }

        if is_allowed("Microsoft Teams")
            && (lower.contains("teams")
                || lower.contains("microsoft teams")
                || lower.contains("msteams"))
        {
            return Some((
                "Microsoft Teams".to_string(),
                vec!["process:teams".to_string()],
            ));
        }

        if is_allowed("Slack") && lower.contains("slack") {
            return Some(("Slack".to_string(), vec!["process:slack".to_string()]));
        }

        if is_allowed("Discord") && lower.contains("discord") {
            return Some(("Discord".to_string(), vec!["process:discord".to_string()]));
        }

        if is_allowed("Google Meet")
            && (lower.contains("meet.google.com")
                || (is_browser_process(&lower)
                    && lower.contains("google")
                    && lower.contains("meet")))
        {
            return Some((
                "Google Meet".to_string(),
                vec!["process:google-meet".to_string()],
            ));
        }

        if is_allowed("Google Meet") && is_browser_process(&lower) {
            return Some((
                "Google Meet".to_string(),
                vec!["process:browser".to_string()],
            ));
        }
    }

    None
}

#[cfg(target_os = "linux")]
fn is_browser_process(line: &str) -> bool {
    line.contains("chrome")
        || line.contains("chromium")
        || line.contains("brave")
        || line.contains("firefox")
}

#[cfg(target_os = "linux")]
fn has_pipewire_media_stream(pipewire_output: &str, wpctl_output: &str) -> bool {
    let combined = format!("{}\n{}", pipewire_output, wpctl_output).to_lowercase();
    combined.contains("stream/input/audio")
        || combined.contains("stream/output/audio")
        || combined.contains("media.class = \"stream/")
        || combined.contains("media.role = \"communication\"")
        || combined.contains("media.role = \"phone\"")
}

#[cfg(target_os = "linux")]
fn has_pipewire_communication_stream(pipewire_output: &str, wpctl_output: &str) -> bool {
    let combined = format!("{}\n{}", pipewire_output, wpctl_output).to_lowercase();
    combined.contains("media.role = \"communication\"")
        || combined.contains("media.role = \"phone\"")
}

#[cfg(target_os = "linux")]
fn has_browser_capture_signal(
    process_output: &str,
    pipewire_output: &str,
    wpctl_output: &str,
) -> bool {
    let process_lower = process_output.to_lowercase();
    let pipewire_lower = format!("{}\n{}", pipewire_output, wpctl_output).to_lowercase();

    let browser_has_capture_service = is_browser_process(&process_lower)
        && (process_lower.contains("video_capture")
            || process_lower.contains("audio.mojom.audioservice"));
    let pipewire_has_browser_input = pipewire_lower.contains("brave input")
        || pipewire_lower.contains("chrome input")
        || pipewire_lower.contains("chromium input")
        || pipewire_lower.contains("firefox input");

    browser_has_capture_service || pipewire_has_browser_input
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "linux")]
    #[test]
    fn matches_allowed_meeting_apps() {
        let allowed = AutoMeetingPreferences::default().allowed_apps;
        assert_eq!(
            find_meeting_process("123 zoom zoom --url", &allowed)
                .unwrap()
                .0,
            "Zoom"
        );
        assert_eq!(
            find_meeting_process("123 teams msteams", &allowed)
                .unwrap()
                .0,
            "Microsoft Teams"
        );
        assert_eq!(
            find_meeting_process("123 slack /usr/bin/slack", &allowed)
                .unwrap()
                .0,
            "Slack"
        );
        assert_eq!(
            find_meeting_process("123 Discord /opt/Discord/Discord", &allowed)
                .unwrap()
                .0,
            "Discord"
        );
        assert_eq!(
            find_meeting_process("123 brave --app=https://meet.google.com/abc", &allowed)
                .unwrap()
                .0,
            "Google Meet"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn detects_pipewire_communication_streams() {
        let output = r#"
            media.class = "Stream/Input/Audio"
            media.role = "Communication"
        "#;

        assert!(has_pipewire_media_stream(output, ""));
        assert!(has_pipewire_communication_stream(output, ""));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn detects_browser_capture_signals() {
        let process_output =
            "/opt/brave.com/brave/brave --utility-sub-type=video_capture.mojom.VideoCaptureService";
        let wpctl_output = "92. Brave input [pid:117718]";

        assert!(has_browser_capture_signal(process_output, "", wpctl_output));
    }

    #[test]
    fn ignores_short_blips() {
        let mut tracker = DetectionTracker::new(6);
        let signal = MeetingSignal {
            app_name: "Zoom".to_string(),
            signals: vec!["process:zoom".to_string()],
        };

        assert!(matches!(
            tracker.update(Some(signal), 30),
            DetectionTransition::None
        ));
        assert_eq!(tracker.state, AutoMeetingState::Candidate);
        assert!(matches!(
            tracker.update(None, 30),
            DetectionTransition::None
        ));
        assert_eq!(tracker.state, AutoMeetingState::Idle);
    }

    #[test]
    fn detects_after_confidence_window() {
        let mut tracker = DetectionTracker::new(0);
        let signal = MeetingSignal {
            app_name: "Zoom".to_string(),
            signals: vec![
                "process:zoom".to_string(),
                "pipewire-media-stream".to_string(),
            ],
        };

        assert!(matches!(
            tracker.update(Some(signal.clone()), 30),
            DetectionTransition::None
        ));
        assert!(matches!(
            tracker.update(Some(signal), 30),
            DetectionTransition::Detected(_)
        ));
        assert_eq!(tracker.state, AutoMeetingState::Detected);
    }
}
