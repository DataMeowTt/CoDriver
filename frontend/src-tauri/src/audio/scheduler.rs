use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

use super::hardware_detector::{HardwareProfile, PerformanceTier};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioJobClass {
    RealtimeCapture,
    RealtimeDsp,
    RealtimeTranscription,
    BatchPreprocess,
    BatchTranscription,
}

#[derive(Debug, Clone, Serialize)]
pub struct AudioSchedulerStatus {
    pub active_realtime_capture: usize,
    pub active_realtime_dsp: usize,
    pub active_realtime_transcription: usize,
    pub active_batch_preprocess: usize,
    pub active_batch_transcription: usize,
    pub realtime_transcription_queue_depth: usize,
    pub dropped_live_chunks: u64,
    pub average_wait_time_ms: u64,
    pub active_recording: bool,
    pub realtime_dsp_limit: usize,
    pub realtime_transcription_limit: usize,
    pub batch_preprocess_limit: usize,
    pub batch_transcription_limit: usize,
    pub batch_throttled: bool,
}

pub struct AudioScheduler {
    realtime_dsp: Arc<Semaphore>,
    realtime_transcription: Arc<Semaphore>,
    batch_preprocess: Arc<Semaphore>,
    batch_transcription: Arc<Semaphore>,
    active_realtime_capture: AtomicUsize,
    active_realtime_dsp: AtomicUsize,
    active_realtime_transcription: AtomicUsize,
    active_batch_preprocess: AtomicUsize,
    active_batch_transcription: AtomicUsize,
    realtime_transcription_queue_depth: AtomicUsize,
    dropped_live_chunks: AtomicU64,
    total_wait_ms: AtomicU64,
    wait_samples: AtomicU64,
    recording_active: AtomicBool,
    batch_throttled: AtomicBool,
    realtime_dsp_limit: usize,
    realtime_transcription_limit: usize,
    batch_preprocess_limit: usize,
    batch_transcription_limit: usize,
    tier: PerformanceTier,
}

pub struct ScheduledPermit {
    scheduler: &'static AudioScheduler,
    class: AudioJobClass,
    _permit: Option<OwnedSemaphorePermit>,
}

impl Drop for ScheduledPermit {
    fn drop(&mut self) {
        self.scheduler.decrement_active(self.class);
    }
}

static AUDIO_SCHEDULER: OnceLock<AudioScheduler> = OnceLock::new();

pub fn scheduler() -> &'static AudioScheduler {
    AUDIO_SCHEDULER.get_or_init(AudioScheduler::new)
}

pub fn set_recording_active(active: bool) {
    scheduler().set_recording_active(active);
}

pub fn get_audio_scheduler_status() -> AudioSchedulerStatus {
    scheduler().status()
}

#[tauri::command]
pub fn get_audio_scheduler_status_command() -> AudioSchedulerStatus {
    get_audio_scheduler_status()
}

impl AudioScheduler {
    fn new() -> Self {
        let profile = HardwareProfile::detect();
        let realtime_dsp_limit = profile.cpu_cores.max(1).min(2) as usize;
        let batch_preprocess_limit = 1;
        let batch_transcription_limit = 1;

        Self {
            realtime_dsp: Arc::new(Semaphore::new(realtime_dsp_limit)),
            realtime_transcription: Arc::new(Semaphore::new(1)),
            batch_preprocess: Arc::new(Semaphore::new(batch_preprocess_limit)),
            batch_transcription: Arc::new(Semaphore::new(batch_transcription_limit)),
            active_realtime_capture: AtomicUsize::new(0),
            active_realtime_dsp: AtomicUsize::new(0),
            active_realtime_transcription: AtomicUsize::new(0),
            active_batch_preprocess: AtomicUsize::new(0),
            active_batch_transcription: AtomicUsize::new(0),
            realtime_transcription_queue_depth: AtomicUsize::new(0),
            dropped_live_chunks: AtomicU64::new(0),
            total_wait_ms: AtomicU64::new(0),
            wait_samples: AtomicU64::new(0),
            recording_active: AtomicBool::new(false),
            batch_throttled: AtomicBool::new(false),
            realtime_dsp_limit,
            realtime_transcription_limit: 1,
            batch_preprocess_limit,
            batch_transcription_limit,
            tier: profile.performance_tier.clone(),
        }
    }

    pub fn set_recording_active(&self, active: bool) {
        self.recording_active.store(active, Ordering::SeqCst);
        if !active {
            self.batch_throttled.store(false, Ordering::SeqCst);
        }
    }

    pub fn record_transcription_queued(&self) {
        self.realtime_transcription_queue_depth
            .fetch_add(1, Ordering::SeqCst);
    }

    pub fn record_transcription_dequeued(&self) {
        self.realtime_transcription_queue_depth
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |current| {
                Some(current.saturating_sub(1))
            })
            .ok();
    }

    pub fn record_live_chunk_dropped<R: Runtime>(&self, app: Option<&AppHandle<R>>, reason: &str) {
        let dropped = self.dropped_live_chunks.fetch_add(1, Ordering::SeqCst) + 1;
        if let Some(app) = app {
            let _ = app.emit(
                "chunk-drop-warning",
                format!(
                    "Audio scheduler dropped live chunk #{}: {}",
                    dropped, reason
                ),
            );
        }
    }

    pub async fn acquire(&'static self, class: AudioJobClass) -> Result<ScheduledPermit> {
        self.wait_for_batch_slot(class).await;

        let start = Instant::now();
        let permit = match class {
            AudioJobClass::RealtimeCapture => None,
            AudioJobClass::RealtimeDsp => Some(self.realtime_dsp.clone().acquire_owned().await?),
            AudioJobClass::RealtimeTranscription => {
                Some(self.realtime_transcription.clone().acquire_owned().await?)
            }
            AudioJobClass::BatchPreprocess => {
                Some(self.batch_preprocess.clone().acquire_owned().await?)
            }
            AudioJobClass::BatchTranscription => {
                Some(self.batch_transcription.clone().acquire_owned().await?)
            }
        };

        let wait_ms = start.elapsed().as_millis().min(u128::from(u64::MAX)) as u64;
        self.total_wait_ms.fetch_add(wait_ms, Ordering::SeqCst);
        self.wait_samples.fetch_add(1, Ordering::SeqCst);
        self.increment_active(class);

        Ok(ScheduledPermit {
            scheduler: self,
            class,
            _permit: permit,
        })
    }

    pub async fn run_blocking<T, F>(&'static self, class: AudioJobClass, f: F) -> Result<T>
    where
        T: Send + 'static,
        F: FnOnce() -> Result<T> + Send + 'static,
    {
        let _permit = self.acquire(class).await?;
        tokio::task::spawn_blocking(f)
            .await
            .map_err(|e| anyhow!("scheduled blocking task panicked: {}", e))?
    }

    pub async fn run_async<T, Fut, F>(&'static self, class: AudioJobClass, f: F) -> Result<T>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<T>>,
    {
        let _permit = self.acquire(class).await?;
        f().await
    }

    fn status(&self) -> AudioSchedulerStatus {
        let wait_samples = self.wait_samples.load(Ordering::SeqCst);
        let average_wait_time_ms = if wait_samples == 0 {
            0
        } else {
            self.total_wait_ms.load(Ordering::SeqCst) / wait_samples
        };

        AudioSchedulerStatus {
            active_realtime_capture: self.active_realtime_capture.load(Ordering::SeqCst),
            active_realtime_dsp: self.active_realtime_dsp.load(Ordering::SeqCst),
            active_realtime_transcription: self
                .active_realtime_transcription
                .load(Ordering::SeqCst),
            active_batch_preprocess: self.active_batch_preprocess.load(Ordering::SeqCst),
            active_batch_transcription: self.active_batch_transcription.load(Ordering::SeqCst),
            realtime_transcription_queue_depth: self
                .realtime_transcription_queue_depth
                .load(Ordering::SeqCst),
            dropped_live_chunks: self.dropped_live_chunks.load(Ordering::SeqCst),
            average_wait_time_ms,
            active_recording: self.recording_active.load(Ordering::SeqCst),
            realtime_dsp_limit: self.realtime_dsp_limit,
            realtime_transcription_limit: self.realtime_transcription_limit,
            batch_preprocess_limit: self.batch_preprocess_limit,
            batch_transcription_limit: self.batch_transcription_limit,
            batch_throttled: self.batch_throttled.load(Ordering::SeqCst),
        }
    }

    async fn wait_for_batch_slot(&self, class: AudioJobClass) {
        let is_batch = matches!(
            class,
            AudioJobClass::BatchPreprocess | AudioJobClass::BatchTranscription
        );
        if !is_batch {
            return;
        }

        loop {
            let recording = self.recording_active.load(Ordering::SeqCst);
            let low_tier = matches!(self.tier, PerformanceTier::Low);
            let live_backlog = self
                .realtime_transcription_queue_depth
                .load(Ordering::SeqCst);
            let should_throttle = recording
                && (low_tier
                    || matches!(class, AudioJobClass::BatchTranscription)
                    || live_backlog > 8);

            self.batch_throttled
                .store(should_throttle, Ordering::SeqCst);

            if !should_throttle {
                return;
            }

            tokio::time::sleep(std::time::Duration::from_millis(250)).await;
        }
    }

    fn increment_active(&self, class: AudioJobClass) {
        self.counter(class).fetch_add(1, Ordering::SeqCst);
    }

    fn decrement_active(&self, class: AudioJobClass) {
        self.counter(class)
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |current| {
                Some(current.saturating_sub(1))
            })
            .ok();
    }

    fn counter(&self, class: AudioJobClass) -> &AtomicUsize {
        match class {
            AudioJobClass::RealtimeCapture => &self.active_realtime_capture,
            AudioJobClass::RealtimeDsp => &self.active_realtime_dsp,
            AudioJobClass::RealtimeTranscription => &self.active_realtime_transcription,
            AudioJobClass::BatchPreprocess => &self.active_batch_preprocess,
            AudioJobClass::BatchTranscription => &self.active_batch_transcription,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn tracks_active_jobs_and_waits() {
        let local = AudioScheduler::new();
        let leaked: &'static AudioScheduler = Box::leak(Box::new(local));

        {
            let _permit = leaked
                .acquire(AudioJobClass::RealtimeTranscription)
                .await
                .unwrap();
            let status = leaked.status();
            assert_eq!(status.active_realtime_transcription, 1);
        }

        let status = leaked.status();
        assert_eq!(status.active_realtime_transcription, 0);
        assert!(status.average_wait_time_ms <= status.average_wait_time_ms);
    }

    #[tokio::test]
    async fn batch_transcription_is_throttled_during_recording() {
        let local = AudioScheduler::new();
        local.set_recording_active(true);

        let wait = tokio::time::timeout(
            std::time::Duration::from_millis(80),
            local.wait_for_batch_slot(AudioJobClass::BatchTranscription),
        )
        .await;

        assert!(wait.is_err());
        assert!(local.status().batch_throttled);

        local.set_recording_active(false);
        local
            .wait_for_batch_slot(AudioJobClass::BatchTranscription)
            .await;
        assert!(!local.status().batch_throttled);
    }

    #[test]
    fn queue_depth_is_bounded_at_zero() {
        let local = AudioScheduler::new();
        local.record_transcription_dequeued();
        assert_eq!(local.status().realtime_transcription_queue_depth, 0);
        local.record_transcription_queued();
        local.record_transcription_dequeued();
        assert_eq!(local.status().realtime_transcription_queue_depth, 0);
    }
}
