import { useMemo } from "react";
import {
  todayISO, dueLabel, PRIORITY_COLOR, liveTaskSeconds, formatDuration, currentStreak,
  computeTodayView, computeUpcoming, taskTimeRangeLabel,
} from "../lib/helpers";

function TodayTaskRow({ task, running, liveSeconds, onToggle, onCyclePriority, onToggleTrack }) {
  const trackLabel = formatDuration(liveSeconds, running);
  const subtaskLabel = task.subtasks && task.subtasks.length
    ? `${task.subtasks.filter(Boolean).length}/${task.subtasks.length} subtasks` : null;
  return (
    <li className="pd-today-row">
      <button className={`pd-check pd-press ${task.done ? "done" : ""}`}
        onClick={onToggle} aria-label={task.done ? "Mark as not done" : "Mark as done"}>
        <svg width="13" height="13" viewBox="0 0 12 12"><path d="M2 6.5L4.8 9L10 3.5" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      <button type="button" className="pd-priority-dot" title={`Priority: ${task.priority || "med"} (click to change)`}
        style={{ background: PRIORITY_COLOR[task.priority || "med"] }}
        onClick={onCyclePriority} aria-label="Cycle task priority" />
      <div className="pd-today-info">
        <div className={`pd-today-title ${task.done ? "done" : ""}`}>{task.title}</div>
        <div className="pd-today-meta">
          <span>{taskTimeRangeLabel(task) || "Today"}</span>
          {task.projectName && <span>· {task.projectName}</span>}
          {task.recurring && <span title="Repeats daily">↻</span>}
          {subtaskLabel && <span>{subtaskLabel}</span>}
        </div>
      </div>
      <button type="button" className={`pd-track-pill ${running ? "running" : ""}`} onClick={onToggleTrack}
        aria-label={running ? "Stop tracking time" : "Start tracking time"}>
        <span>{running ? "❙❙" : "▶"}</span>
        {trackLabel && <span>{trackLabel}</span>}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Today — content-first (Things-style): a one-line stat strip, then   */
/*  the day's tasks as the hero, with what's coming up below. Charts    */
/*  live on the Insights screen, not here.                              */
/* ------------------------------------------------------------------ */
export function TodayScreen({ projects, inbox, runningTaskId, runStart, tick, completionLog, focusLog, onToggle, onCyclePriority, onToggleTrack }) {
  const today = todayISO();
  const items = useMemo(() => computeTodayView(projects, inbox), [projects, inbox]);
  const openCount = items.filter((t) => !t.done).length;
  const completedToday = completionLog[today] || 0;
  const streak = useMemo(() => currentStreak(completionLog), [completionLog, tick]);
  const liveDelta = runningTaskId ? (Date.now() - runStart) / 1000 : 0;
  const focusSeconds = (focusLog[today] || 0) + liveDelta;
  const upcoming = useMemo(() => computeUpcoming(projects, inbox), [projects, inbox]);

  return (
    <div className="pd-today">
      <div className="pd-today-col">
        <div className="pd-stat-strip">
          <span><b className="gold">{openCount}</b> on deck</span>
          <span className="pd-strip-dot">·</span>
          <span><b className="gold">{completedToday}</b> done today</span>
          <span className="pd-strip-dot">·</span>
          <span><b className="sage">{streak}d</b> streak</span>
          <span className="pd-strip-dot">·</span>
          <span><b className="coral">{formatDuration(focusSeconds, false) || "0m"}</b> focused</span>
        </div>

        <div className="pd-section-label">Today</div>
        {items.length === 0 ? (
          <p className="pd-empty">Nothing on deck. Add a task above, or check back tomorrow.</p>
        ) : (
          <ul className="pd-today-list">
            {items.map((t) => (
              <TodayTaskRow key={t.id} task={t}
                running={runningTaskId === t.id}
                liveSeconds={liveTaskSeconds(t, runningTaskId, runStart)}
                onToggle={() => onToggle(t.id)}
                onCyclePriority={() => onCyclePriority(t.id)}
                onToggleTrack={() => onToggleTrack(t.id)} />
            ))}
          </ul>
        )}

        {upcoming.length > 0 && (
          <>
            <div className="pd-section-label" style={{ marginTop: 28 }}>Upcoming</div>
            <ul className="pd-upcoming-list">
              {upcoming.map((t) => {
                const due = dueLabel(t.deadline);
                return (
                  <li key={t.id} className="pd-upcoming-row">
                    <div className="pd-priority-dot" style={{ background: PRIORITY_COLOR[t.priority || "med"], marginTop: 0 }} />
                    <div className="pd-upcoming-info">
                      <div className="pd-upcoming-title">{t.title}</div>
                      <div className="pd-upcoming-meta">{taskTimeRangeLabel(t) ? `${taskTimeRangeLabel(t)} · ` : ""}{t.projectName || "Inbox"}</div>
                    </div>
                    {due && <div className={`pd-upcoming-due ${due.overdue ? "overdue" : ""}`}>{due.text}</div>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
