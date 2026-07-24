import { formatDuration } from "../lib/helpers";

// Distraction-free focus overlay, opened by tapping the sticky FocusBanner's body (its
// own Stop button keeps the old fast single-click stop). Pause/resume is a companion
// control, not an end of session — Stop is separate and shows what-next choices instead
// of just vanishing the task. No countdown, no urgency color: estimateMinutes (when set)
// is shown as a plain "elapsed of planned" readout, never a shrinking timer.
export function FocusScreen({ task, projectName, seconds, paused, endedSession, onPauseResume, onStop, onClose, onMarkDone, onKeepGoing, onBackToToday }) {
  if (endedSession) {
    return (
      <div className="pd-overlay pd-focusscreen-overlay">
        <div className="pd-focusscreen pd-focusscreen-ended">
          <div className="pd-focusscreen-ended-title">{endedSession.title}</div>
          {endedSession.projectName && <div className="pd-focusscreen-project">{endedSession.projectName}</div>}
          <div className="pd-focusscreen-ended-time">{formatDuration(endedSession.seconds, false) || "0m"} tracked</div>
          <div className="pd-focusscreen-choices">
            <button type="button" className="pd-focusscreen-choice primary" onClick={onMarkDone}>Mark done</button>
            <button type="button" className="pd-focusscreen-choice" onClick={onKeepGoing}>Keep going</button>
            <button type="button" className="pd-focusscreen-choice" onClick={onBackToToday}>Back to Today</button>
          </div>
        </div>
      </div>
    );
  }

  if (!task) return null;
  const elapsedMin = Math.floor(seconds / 60);
  const estimateLabel = task.estimateMinutes ? `${elapsedMin}m of ${task.estimateMinutes}m planned` : null;

  return (
    <div className="pd-overlay pd-focusscreen-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pd-focusscreen">
        <button type="button" className="pd-focusscreen-close" onClick={onClose} aria-label="Close">×</button>
        <div className="pd-focusscreen-label">{paused ? "Paused" : "Focusing on"}</div>
        <div className="pd-focusscreen-title">{task.title}</div>
        {projectName && <div className="pd-focusscreen-project">{projectName}</div>}
        <div className="pd-focusscreen-time">{formatDuration(seconds, true)}</div>
        {estimateLabel && <div className="pd-focusscreen-estimate">{estimateLabel}</div>}
        <div className="pd-focusscreen-controls">
          <button type="button" className="pd-focusscreen-pause" onClick={onPauseResume}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="pd-focusscreen-stop" onClick={onStop}>Stop</button>
        </div>
      </div>
    </div>
  );
}
