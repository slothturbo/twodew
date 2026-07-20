import { useRef, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  todayISO, dueLabel, PRIORITY_COLOR, liveTaskSeconds, formatDuration, currentStreak,
  computeTodayView, computeUpcoming, groupTodayByProject, taskTimeRangeLabel,
} from "../lib/helpers";

const LONG_PRESS_MS = 450;

// Small Edit/Delete popup for a long-pressed (or right-clicked) task row.
// Portaled to <body> since this screen could in principle sit under a
// backdrop-filter ancestor, which breaks position:fixed coordinate math.
function TaskMenu({ x, y, onEdit, onDelete, onClose }) {
  const left = Math.min(x, window.innerWidth - 160);
  const top = Math.min(y, window.innerHeight - 110);
  return createPortal(
    <>
      <div className="pd-task-menu-scrim" onClick={onClose} onTouchStart={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="pd-task-menu" style={{ left, top }} role="menu">
        <button type="button" role="menuitem" onClick={onEdit}>Edit</button>
        <button type="button" role="menuitem" className="danger" onClick={onDelete}>Delete</button>
      </div>
    </>,
    document.body
  );
}

function TodayTaskRow({ task, running, liveSeconds, onToggle, onCyclePriority, onToggleTrack, onOpenMenu }) {
  const trackLabel = formatDuration(liveSeconds, running);
  const subtaskLabel = task.subtasks && task.subtasks.length
    ? `${task.subtasks.filter(Boolean).length}/${task.subtasks.length} subtasks` : null;

  const pressTimer = useRef(null);
  const pressStart = useRef(null);

  const clearPress = () => { clearTimeout(pressTimer.current); pressTimer.current = null; };
  const startPress = (x, y) => {
    pressStart.current = { x, y };
    clearPress();
    pressTimer.current = setTimeout(() => onOpenMenu(task, pressStart.current), LONG_PRESS_MS);
  };
  const movePress = (x, y) => {
    if (!pressStart.current) return;
    if (Math.hypot(x - pressStart.current.x, y - pressStart.current.y) > 10) clearPress();
  };

  return (
    <li className="pd-today-row"
      onTouchStart={(e) => { const t = e.touches[0]; startPress(t.clientX, t.clientY); }}
      onTouchMove={(e) => { const t = e.touches[0]; movePress(t.clientX, t.clientY); }}
      onTouchEnd={clearPress}
      onMouseDown={(e) => { if (e.button === 0) startPress(e.clientX, e.clientY); }}
      onMouseMove={(e) => movePress(e.clientX, e.clientY)}
      onMouseUp={clearPress}
      onMouseLeave={clearPress}
      onContextMenu={(e) => { e.preventDefault(); onOpenMenu(task, { x: e.clientX, y: e.clientY }); }}>
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
export function TodayScreen({
  projects, inbox, runningTaskId, runStart, tick, completionLog, focusLog,
  onToggle, onCyclePriority, onToggleTrack, onOpenProject, onOpenTask, onDeleteTask,
}) {
  const today = todayISO();
  const items = useMemo(() => computeTodayView(projects, inbox), [projects, inbox]);
  const groups = useMemo(() => groupTodayByProject(items), [items]);
  const openCount = items.filter((t) => !t.done).length;
  const completedToday = completionLog[today] || 0;
  const streak = useMemo(() => currentStreak(completionLog), [completionLog, tick]);
  const liveDelta = runningTaskId ? (Date.now() - runStart) / 1000 : 0;
  const focusSeconds = (focusLog[today] || 0) + liveDelta;
  const upcoming = useMemo(() => computeUpcoming(projects, inbox), [projects, inbox]);
  const [menu, setMenu] = useState(null); // { task, x, y }

  return (
    <div className="pd-today">
      <div className="pd-today-col">
        <div className="pd-stat-row">
          <div className="pd-stat-tile orange">
            <div className="pd-stat-label">On deck</div>
            <div className="pd-stat-value">{openCount}</div>
          </div>
          <div className="pd-stat-tile olive">
            <div className="pd-stat-label">Done today</div>
            <div className="pd-stat-value">{completedToday}</div>
          </div>
          <div className="pd-stat-tile lilac">
            <div className="pd-stat-label">Streak</div>
            <div className="pd-stat-value">{streak}d</div>
          </div>
          <div className="pd-stat-tile coral">
            <div className="pd-stat-label">Focused</div>
            <div className="pd-stat-value">{formatDuration(focusSeconds, false) || "0m"}</div>
          </div>
        </div>

        <div className="pd-section-label">Today</div>
        {items.length === 0 ? (
          <p className="pd-empty">Nothing on deck. Add a task above, or check back tomorrow.</p>
        ) : (
          <div className="pd-today-groups">
            {groups.map((g) => (
              <div key={g.key} className="pd-today-card">
                <div className="pd-today-card-head">
                  <span className="pd-today-card-dot" style={{ background: g.color ? g.color.fg : "var(--muted)" }} />
                  <span className="pd-today-card-name">{g.name}</span>
                  <span className="pd-today-card-count">{g.tasks.filter((t) => t.done).length}/{g.tasks.length}</span>
                </div>
                <ul className="pd-today-list">
                  {g.tasks.map((t) => (
                    <TodayTaskRow key={t.id} task={t}
                      running={runningTaskId === t.id}
                      liveSeconds={liveTaskSeconds(t, runningTaskId, runStart)}
                      onToggle={() => onToggle(t.id)}
                      onCyclePriority={() => onCyclePriority(t.id)}
                      onToggleTrack={() => onToggleTrack(t.id)}
                      onOpenMenu={(task, pos) => setMenu({ task, x: pos.x, y: pos.y })} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <div className="pd-section-label" style={{ marginTop: 28 }}>Upcoming</div>
            <ul className="pd-upcoming-list">
              {upcoming.map((t) => {
                const due = dueLabel(t.deadline);
                return (
                  <li key={t.id} className="pd-upcoming-row pd-press"
                    onClick={() => (t.projectId ? onOpenProject(t.projectId) : onOpenTask(t))}>
                    <button type="button" className="pd-check pd-check-sm pd-press"
                      onClick={(e) => { e.stopPropagation(); onToggle(t.id); }} aria-label="Mark as done">
                      <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6.5L4.8 9L10 3.5" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" /></svg>
                    </button>
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

      {menu && (
        <TaskMenu x={menu.x} y={menu.y}
          onEdit={() => { onOpenTask(menu.task); setMenu(null); }}
          onDelete={() => { onDeleteTask(menu.task); setMenu(null); }}
          onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
