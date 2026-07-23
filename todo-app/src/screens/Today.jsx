import { useRef, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DeferMenu } from "../components/DeferMenu";
import { MoveMenu } from "../components/MoveMenu";
import {
  todayISO, dueLabel, PRIORITY_COLOR, liveTaskSeconds, formatDuration, currentStreak,
  computeTodayView, computeUpcoming, nextUpCandidates, splitTodayBuckets, taskTimeRangeLabel,
} from "../lib/helpers";

const LONG_PRESS_MS = 450;

// Small Edit/Defer/Delete popup for a long-pressed (or right-clicked) task row.
// Portaled to <body> since this screen could in principle sit under a
// backdrop-filter ancestor, which breaks position:fixed coordinate math.
function TaskMenu({ x, y, onEdit, onDefer, onDelete, onClose }) {
  const left = Math.min(x, window.innerWidth - 160);
  const top = Math.min(y, window.innerHeight - 140);
  return createPortal(
    <>
      <div className="pd-task-menu-scrim" onClick={onClose} onTouchStart={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="pd-task-menu" style={{ left, top }} role="menu">
        <button type="button" role="menuitem" onClick={onEdit}>Edit</button>
        {onDefer && <button type="button" role="menuitem" onClick={onDefer}>Defer</button>}
        <button type="button" role="menuitem" className="danger" onClick={onDelete}>Delete</button>
      </div>
    </>,
    document.body
  );
}

function TodayTaskRow({ task, running, liveSeconds, onToggle, onCyclePriority, onToggleTrack, onOpenMenu, onOpenProject, onOpenTask }) {
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
        <div className={`pd-today-title pd-today-title-link ${task.done ? "done" : ""}`}
          onClick={(e) => { e.stopPropagation(); (task.projectId ? onOpenProject(task.projectId) : onOpenTask(task)); }}>
          {task.title}
        </div>
        <div className="pd-today-meta">
          <span>{taskTimeRangeLabel(task) || "Today"}</span>
          {task.projectName && <span>· {task.projectName}</span>}
          {task.recurring && <span title="Repeats daily">↻</span>}
          {task.isNextAction && <span title="This project's next action">★</span>}
          {task.plannedDate === todayISO() && <span title="Planned for today">planned</span>}
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

// A section of task rows sharing one label — Now / Later today / Done today (collapsible).
function TaskSection({ label, tasks, collapsible, open, onToggleOpen, ...rowProps }) {
  if (!tasks.length) return null;
  const showList = !collapsible || open;
  return (
    <div className="pd-today-section">
      <button type="button" className={`pd-section-label pd-section-toggle ${collapsible ? "clickable" : ""}`}
        onClick={collapsible ? onToggleOpen : undefined} disabled={!collapsible}>
        {label} <span className="pd-section-count">{tasks.length}</span>
        {collapsible && <span className={`pd-section-caret ${open ? "open" : ""}`}>▾</span>}
      </button>
      {showList && (
        <ul className="pd-today-list">
          {tasks.map((t) => (
            <TodayTaskRow key={t.id} task={t}
              running={rowProps.runningTaskId === t.id}
              liveSeconds={liveTaskSeconds(t, rowProps.runningTaskId, rowProps.runStart)}
              onToggle={() => rowProps.onToggle(t.id)}
              onCyclePriority={() => rowProps.onCyclePriority(t.id)}
              onToggleTrack={() => rowProps.onToggleTrack(t.id)}
              onOpenMenu={rowProps.onOpenMenu}
              onOpenProject={rowProps.onOpenProject} onOpenTask={rowProps.onOpenTask} />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Today — led by a single "next up" suggestion so the first screen   */
/*  answers "what should I do next" in one glance, with the rest of    */
/*  today's work bucketed by urgency below. Charts live on Insights.   */
/* ------------------------------------------------------------------ */
export function TodayScreen({
  projects, inbox, runningTaskId, runStart, tick, completionLog, focusLog,
  onToggle, onCyclePriority, onToggleTrack, onOpenProject, onOpenTask, onDeleteTask,
  onDeferTask, onMoveTask,
}) {
  const today = todayISO();
  const items = useMemo(() => computeTodayView(projects, inbox), [projects, inbox]);
  const candidates = useMemo(() => nextUpCandidates(items), [items]);
  const [nextUpIndex, setNextUpIndex] = useState(0);
  const nextUp = candidates.length ? candidates[nextUpIndex % candidates.length] : null;

  const { now, laterToday, doneToday } = useMemo(
    () => splitTodayBuckets(items, nextUp?.id),
    [items, nextUp]
  );

  const openCount = items.filter((t) => !t.done).length;
  const completedToday = completionLog[today] || 0;
  const streak = useMemo(() => currentStreak(completionLog), [completionLog, tick]);
  const liveDelta = runningTaskId ? (Date.now() - runStart) / 1000 : 0;
  const focusSeconds = (focusLog[today] || 0) + liveDelta;
  const upcoming = useMemo(() => computeUpcoming(projects, inbox), [projects, inbox]);
  const [menu, setMenu] = useState(null); // { task, x, y }
  const [deferMenu, setDeferMenu] = useState(null); // { task, x, y }
  const [moveMenu, setMoveMenu] = useState(null); // { task, x, y }
  const [doneOpen, setDoneOpen] = useState(false); // collapsed by default

  // Master focus control: stops whatever's running, or — if nothing is — starts the
  // suggested next-up task, so there's always one obvious button to jump into focus.
  const masterFocusTarget = runningTaskId || nextUp?.id;
  const focusRunning = !!runningTaskId;

  const openDefer = (task, anchorEl) => {
    const r = anchorEl.getBoundingClientRect();
    setDeferMenu({ task, x: r.left, y: r.bottom + 6 });
  };
  const openMove = (task, anchorEl) => {
    const r = anchorEl.getBoundingClientRect();
    setMoveMenu({ task, x: r.left, y: r.bottom + 6 });
  };

  const rowProps = {
    runningTaskId, runStart, onToggle, onCyclePriority, onToggleTrack,
    onOpenMenu: (task, pos) => setMenu({ task, x: pos.x, y: pos.y }),
    onOpenProject, onOpenTask,
  };

  return (
    <div className="pd-today">
      <div className="pd-today-col">
        <div className="pd-today-topline">
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
          <button type="button" className={`pd-focus-fab ${focusRunning ? "running" : ""}`}
            disabled={!masterFocusTarget} onClick={() => masterFocusTarget && onToggleTrack(masterFocusTarget)}
            title={focusRunning ? "Stop focus" : "Start focus on your next-up task"}
            aria-label={focusRunning ? "Stop focus" : "Start focus"}>
            <span>::</span>
          </button>
        </div>

        {nextUp && (
          <div className="pd-nextup-card">
            <div className="pd-section-label">Next up</div>
            <ul className="pd-today-list pd-nextup-list">
              <TodayTaskRow key={nextUp.id} task={nextUp}
                running={runningTaskId === nextUp.id}
                liveSeconds={liveTaskSeconds(nextUp, runningTaskId, runStart)}
                onToggle={() => onToggle(nextUp.id)}
                onCyclePriority={() => onCyclePriority(nextUp.id)}
                onToggleTrack={() => onToggleTrack(nextUp.id)}
                onOpenMenu={(task, pos) => setMenu({ task, x: pos.x, y: pos.y })}
                onOpenProject={onOpenProject} onOpenTask={onOpenTask} />
            </ul>
            <div className="pd-nextup-actions">
              {!nextUp.recurring && (
                <button type="button" className="pd-nextup-btn" onClick={(e) => openDefer(nextUp, e.currentTarget)}>defer</button>
              )}
              <button type="button" className="pd-nextup-btn" onClick={(e) => openMove(nextUp, e.currentTarget)}>move</button>
              {candidates.length > 1 && (
                <button type="button" className="pd-nextup-btn ghost" onClick={() => setNextUpIndex((i) => i + 1)}>not this</button>
              )}
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="pd-empty">Nothing on deck. Add a task above, or check back tomorrow.</p>
        ) : (
          <>
            <TaskSection label="Now" tasks={now} {...rowProps} />
            <TaskSection label="Later today" tasks={laterToday} {...rowProps} />
            <TaskSection label="Done today" tasks={doneToday} collapsible open={doneOpen}
              onToggleOpen={() => setDoneOpen((o) => !o)} {...rowProps} />
          </>
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
          onDefer={menu.task.recurring ? null : () => { setDeferMenu({ task: menu.task, x: menu.x, y: menu.y }); setMenu(null); }}
          onDelete={() => { onDeleteTask(menu.task); setMenu(null); }}
          onClose={() => setMenu(null)} />
      )}
      {deferMenu && (
        <DeferMenu x={deferMenu.x} y={deferMenu.y}
          onSelect={(destination) => { onDeferTask(deferMenu.task.id, destination); setDeferMenu(null); }}
          onPickDate={() => { onOpenTask(deferMenu.task); setDeferMenu(null); }}
          onClose={() => setDeferMenu(null)} />
      )}
      {moveMenu && (
        <MoveMenu x={moveMenu.x} y={moveMenu.y} projects={projects} currentProjectId={moveMenu.task.projectId}
          onSelect={(targetId) => { onMoveTask(moveMenu.task.id, targetId); setMoveMenu(null); }}
          onClose={() => setMoveMenu(null)} />
      )}
    </div>
  );
}
