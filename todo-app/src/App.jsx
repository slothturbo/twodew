import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { storage } from "./lib/storage";
import { supabase } from "./supabaseClient";
import { css } from "./styles";
import { textToHtml, htmlToPlain, imageFileToDataURL } from "./lib/html";
import { useIsMobile, useKeyboardInset, useGreeting } from "./lib/hooks";
import { Ring } from "./components/Ring";
import { Bubble } from "./components/Bubble";
import { CommandPalette } from "./components/CommandPalette";
import { Sidebar } from "./components/Sidebar";
import { TodayScreen } from "./screens/Today";
import { CalendarScreen } from "./screens/Calendar";
import { BrainScreen } from "./screens/BrainScreen";
import { StatsScreen } from "./screens/Stats";
import {
  uid, pad, todayISO, localDateISO, colorOf, progressOf, dueLabel, fmtDate, nextDue, startedLabel,
  PRIORITY_CYCLE, PRIORITY_COLOR, liveTaskSeconds, formatDuration, currentStreak, weekBars, heatmapCells,
  parseQuickAdd, attentionSort, moveItem, moveBy, taskTimeRangeLabel, PALETTE, DOW, MONTHS,
} from "./lib/helpers";

/* ------------------------------------------------------------------ */
/*  v8 — native-feel: fixed shell, swipes, undo, FAB, bottom sheet     */
/* ------------------------------------------------------------------ */
const STORAGE_KEY = "projects-data-v1";
const OLD_HUES = ["#2E6BE6", "#0E8A7B", "#7A4FBF", "#C77D0A", "#C74A6B", "#3D7A2E"];
const NAV_ITEMS = [
  { key: "today", label: "Today", icon: "today" },
  { key: "brain", label: "Brain", icon: "brain" },
  { key: "projects", label: "Projects", icon: "projects" },
  { key: "calendar", label: "Calendar", icon: "calendar" },
  { key: "stats", label: "Insights", icon: "stats" },
];
const SCREEN_TITLES = { today: "Today", brain: "Brain", projects: "Projects", calendar: "Calendar", stats: "Insights" };
// Shared defaults for both project.tasks[] and the project-less inbox[] — additive only,
// never fabricates completedAt/history for tasks that were already done pre-redesign.
function migrateTask(t) {
  return {
    deadline: null,
    priority: "med",
    recurring: false,
    trackedSeconds: 0,
    completedAt: null,
    timeLabel: null,
    startTime: null,
    endTime: null,
    subtasks: [],
    ...t,
  };
}

function migrate(p, i) {
  const out = { ...p };
  if (typeof out.notes === "string") out.notes = out.notes.trim() ? [{ id: uid(), text: out.notes.trim() }] : [];
  if (!Array.isArray(out.notes)) out.notes = [];
  out.notes = out.notes.map((n) => ({ ...n, text: /<[a-z]/i.test(n.text) ? n.text : textToHtml(n.text) }));
  if (!out.startDate) out.startDate = new Date(out.createdAt || Date.now()).toISOString().slice(0, 10);
  if (out.client === undefined) out.client = "";
  if (out.location === undefined) out.location = "";
  if (out.phase === undefined) out.phase = "";
  if (out.colorIdx === undefined) {
    const oldIdx = OLD_HUES.indexOf(out.color);
    out.colorIdx = oldIdx >= 0 ? oldIdx : i % PALETTE.length;
  }
  delete out.deadline; delete out.color;
  out.tasks = (out.tasks || []).map(migrateTask);
  return out;
}

// Defaults for the new root-level fields (inbox, logs, timer, reset date) — called once
// alongside migrate() when loading. Never fabricates history: logs start empty.
function migrateRoot(data) {
  return {
    inbox: (data.inbox || []).map(migrateTask),
    notes: data.notes || [], // standalone notes, not tied to any project — same {id, text} shape as project.notes
    completionLog: data.completionLog || {},
    focusLog: data.focusLog || {},
    lastResetDate: data.lastResetDate || todayISO(),
    runningTaskId: data.runningTaskId || null,
    runStart: data.runStart || null,
  };
}


/* ------------------------------------------------------------------ */
/*  Custom themed date picker (viewport-clamped)                       */
/* ------------------------------------------------------------------ */
function DatePicker({ value, onChange, placeholder = "Set date", startTime, endTime, onStartTime, onEndTime }) {
  const showTime = !!onStartTime;
  const [open, setOpen] = useState(false);
  const base = value ? new Date(value + "T00:00:00") : new Date();
  const [viewY, setViewY] = useState(base.getFullYear());
  const [viewM, setViewM] = useState(base.getMonth());
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const POP_W = 280, POP_H = showTime && value ? 410 : 360, margin = 8;
    const place = () => {
      const r = btnRef.current.getBoundingClientRect();
      let left = r.left;
      let top = r.bottom + 6;
      if (left + POP_W > window.innerWidth - margin) left = window.innerWidth - POP_W - margin;
      if (left < margin) left = margin;
      if (top + POP_H > window.innerHeight - margin) {
        const above = r.top - POP_H - 6;
        top = above > margin ? above : Math.max(margin, window.innerHeight - POP_H - margin);
      }
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(viewY, viewM, 1);
    const startOffset = first.getDay();
    const gridStart = new Date(viewY, viewM, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [viewY, viewM]);

  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayIso = todayISO();

  const nav = (delta) => {
    let m = viewM + delta, y = viewY;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setViewM(m); setViewY(y);
  };

  const timeLabel = showTime && value ? taskTimeRangeLabel({ startTime, endTime }) : null;

  return (
    <div className="pd-dp-wrap" ref={ref}>
      <button type="button" ref={btnRef} className={`pd-dp-btn pd-press ${!value ? "empty" : ""}`} onClick={() => setOpen((o) => !o)}>
        📅 {value ? fmtDate(value) : placeholder}{timeLabel ? ` · ${timeLabel}` : ""}
      </button>
      {open && createPortal(
        <div className="pd-dp-pop" ref={popRef} role="dialog" aria-label="Choose date"
          style={pos ? { position: "fixed", top: pos.top, left: pos.left } : { visibility: "hidden" }}>
          <div className="pd-dp-head">
            <div className="pd-dp-month">{MONTHS[viewM]} {viewY}</div>
            <div className="pd-dp-nav">
              <button type="button" onClick={() => nav(-1)} aria-label="Previous month">↑</button>
              <button type="button" onClick={() => nav(1)} aria-label="Next month">↓</button>
            </div>
          </div>
          <div className="pd-dp-grid">
            {DOW.map((d, i) => <div key={i} className="pd-dp-dow">{d}</div>)}
            {cells.map((d, i) => {
              const iso = toISO(d);
              const muted = d.getMonth() !== viewM;
              return (
                <button type="button" key={i}
                  className={`pd-dp-cell ${muted ? "muted" : ""} ${iso === todayIso ? "today" : ""} ${iso === value ? "selected" : ""}`}
                  onClick={() => { onChange(iso); setViewM(d.getMonth()); setViewY(d.getFullYear()); if (!showTime) setOpen(false); }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {showTime && value && (
            <div className="pd-dp-time-row">
              <input type="time" className="pd-dp-time-input" value={startTime || ""} aria-label="Start time"
                onChange={(e) => onStartTime(e.target.value || null)} />
              <span className="pd-dp-time-sep">–</span>
              <input type="time" className="pd-dp-time-input" value={endTime || ""} aria-label="End time"
                onChange={(e) => onEndTime(e.target.value || null)} />
            </div>
          )}
          <div className="pd-dp-foot">
            <button type="button" className="pd-dp-link" onClick={() => { onChange(null); onStartTime?.(null); onEndTime?.(null); setOpen(false); }}>Clear</button>
            <button type="button" className="pd-dp-link" onClick={() => { onChange(todayIso); if (!showTime) setOpen(false); }}>Today</button>
            {showTime && <button type="button" className="pd-dp-link" onClick={() => setOpen(false)}>Done</button>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Phase combobox                                                     */
/* ------------------------------------------------------------------ */
function PhaseCombo({ value, onChange, suggestions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const q = (value || "").toLowerCase();
  const filtered = suggestions.filter((s) => s.toLowerCase().includes(q) && s !== value);

  return (
    <div className="pd-combo" ref={ref}>
      <input type="text" value={value || ""} placeholder="—"
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") { setOpen(false); e.target.blur(); } }} />
      {open && filtered.length > 0 && (
        <div className="pd-combo-pop">
          {filtered.map((s) => (
            <button type="button" key={s}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s); setOpen(false); }}>{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline — horizontal Gantt from startDate → task deadlines        */
/* ------------------------------------------------------------------ */
function Timeline({ projects, selectedId, onSelect }) {
  const today = todayISO();
  const range = useMemo(() => {
    let min = today, max = today;
    projects.forEach((p) => {
      if (p.startDate && p.startDate < min) min = p.startDate;
      p.tasks.forEach((t) => { if (t.deadline && t.deadline > max) max = t.deadline; });
    });
    const padDays = (iso, days) => {
      const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    return { min: padDays(min, -3), max: padDays(max, 5) };
  }, [projects, today]);

  const toDays = (iso) => new Date(iso + "T00:00:00").getTime() / 86400000;
  const span = Math.max(1, toDays(range.max) - toDays(range.min));
  const xPct = (iso) => ((toDays(iso) - toDays(range.min)) / span) * 100;
  const clamp = (v) => Math.min(100, Math.max(0, v));

  if (!projects.length) return <p className="pd-empty">No projects to plot yet.</p>;

  return (
    <div className="pd-tl">
      <div className="pd-tl-axis">
        <span>{fmtDate(range.min)}</span>
        <span>today</span>
        <span>{fmtDate(range.max)}</span>
      </div>
      {projects.map((p) => {
        const c = colorOf(p);
        const start = p.startDate || today;
        const deadlines = p.tasks.filter((t) => t.deadline);
        const lastDl = deadlines.length ? deadlines.map((t) => t.deadline).sort().slice(-1)[0] : null;
        const barEnd = lastDl && lastDl > start ? lastDl : today > start ? today : start;
        const left = clamp(xPct(start));
        const width = Math.max(0.8, clamp(xPct(barEnd)) - left);
        return (
          <div key={p.id} className={`pd-tl-row ${p.id === selectedId ? "selected" : ""}`}
            role="button" tabIndex={0} onClick={() => onSelect(p.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id); } }}>
            <div className="pd-tl-name" title={p.name}>{p.name}</div>
            <div className="pd-tl-track">
              <div className="pd-tl-line" />
              <div className="pd-tl-today" style={{ left: `${clamp(xPct(today))}%` }} />
              <div className="pd-tl-bar" style={{ left: `${left}%`, width: `${width}%`, background: c.bg, border: `1px solid ${c.fg}` }} />
              {deadlines.map((t) => (
                <div key={t.id} className="pd-tl-dot" title={`${t.title} · ${fmtDate(t.deadline)}`}
                  style={{
                    left: `${clamp(xPct(t.deadline))}%`,
                    background: t.done ? "var(--muted)" : (t.deadline < today ? "var(--danger)" : c.fg),
                    opacity: t.done ? 0.5 : 1,
                  }} />
              ))}
            </div>
          </div>
        );
      })}
      <div className="pd-tl-legend">
        <span><i className="pd-tl-swatch" style={{ background: "var(--danger)" }} />overdue</span>
        <span><i className="pd-tl-swatch" style={{ background: "var(--muted)", opacity: .5 }} />done</span>
        <span><i className="pd-tl-swatch" style={{ background: "var(--accent)" }} />today line</span>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Task row with swipe gestures (mobile) + HTML5 drag (desktop)       */
/* ------------------------------------------------------------------ */
function TaskRow({ task, color, isMobile, completed, onToggle, onDelete, onTitle, onDeadline,
  onStartTime, onEndTime, onCyclePriority, onToggleRecurring, dragHandlers, reorderUp, reorderDown, canUp, canDown, touchReorderStart, dragClass }) {
  const [dx, setDx] = useState(0);
  const [snap, setSnap] = useState(false);
  const start = useRef(null);
  const due = completed ? null : dueLabel(task.deadline);

  const onTouchStart = (e) => {
    if (!isMobile) return;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, mode: null };
    setSnap(false);
  };
  const onTouchMove = (e) => {
    if (!isMobile || !start.current) return;
    const t = e.touches[0];
    const ddx = t.clientX - start.current.x;
    const ddy = t.clientY - start.current.y;
    if (start.current.mode === null) {
      if (Math.abs(ddx) > Math.abs(ddy) + 6) start.current.mode = "swipe";
      else if (Math.abs(ddy) > 8) start.current.mode = "scroll";
    }
    if (start.current.mode === "swipe") setDx(Math.max(-130, Math.min(130, ddx)));
  };
  const onTouchEnd = () => {
    if (!isMobile || !start.current) return;
    const final = dx;
    start.current = null;
    setSnap(true);
    if (final >= 80) { setDx(0); onToggle(); }
    else if (final <= -80) { setDx(0); onDelete(); }
    else setDx(0);
  };

  return (
    <li className="pd-task-outer" data-rid={task.id} data-rkind="task">
      {isMobile && (
        <div className="pd-task-bg" aria-hidden="true">
          <span className="bg-done" style={{ opacity: Math.min(1, Math.max(0, dx / 80)) }}>✓</span>
          <span className="bg-del" style={{ opacity: Math.min(1, Math.max(0, -dx / 80)) }}>✕</span>
        </div>
      )}
      <div className={`pd-task ${completed ? "completed" : ""} ${snap ? "snapback" : ""} ${dragClass || ""}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        draggable={!isMobile && !completed}
        onDragStart={dragHandlers?.onDragStart} onDragOver={dragHandlers?.onDragOver}
        onDrop={dragHandlers?.onDrop} onDragEnd={dragHandlers?.onDragEnd}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {!completed ? (
          <>
            <span className="pd-drag-handle"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => { e.stopPropagation(); touchReorderStart?.(e, task.id, "task"); }}>⠿</span>
            <div className="pd-reorder">
              <button onClick={reorderUp} disabled={!canUp} aria-label="Move up">▲</button>
              <button onClick={reorderDown} disabled={!canDown} aria-label="Move down">▼</button>
            </div>
          </>
        ) : (
          <span className="pd-drag-handle" style={{ visibility: "hidden" }}>⠿</span>
        )}
        <button className={`pd-check pd-press ${task.done ? "done" : ""}`}
          style={task.done ? { background: color.fg, borderColor: color.fg } : {}}
          onClick={onToggle} aria-label={task.done ? "Mark as not done" : "Mark as done"}>
          <svg width="13" height="13" viewBox="0 0 12 12"><path d="M2 6.5L4.8 9L10 3.5" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        {!completed && onCyclePriority && (
          <button type="button" className="pd-priority-dot" title={`Priority: ${task.priority || "med"} (click to change)`}
            style={{ background: PRIORITY_COLOR[task.priority || "med"] }}
            onClick={onCyclePriority} aria-label="Cycle task priority" />
        )}
        <input className={`pd-task-title ${task.done ? "done" : ""}`} value={task.title}
          onChange={(e) => onTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }} aria-label="Task title" />
        <div className="pd-task-meta">
          {due && <span className={`pd-task-due ${due.overdue ? "overdue" : ""}`}>{due.text}</span>}
          {!completed && (
            <DatePicker value={task.deadline} onChange={onDeadline}
              startTime={task.startTime} endTime={task.endTime} onStartTime={onStartTime} onEndTime={onEndTime} />
          )}
          {!completed && onToggleRecurring && (
            <button type="button" className={`pd-recur-toggle ${task.recurring ? "on" : ""}`} title="Repeats daily"
              onClick={onToggleRecurring} aria-label={task.recurring ? "Stop repeating daily" : "Repeat daily"}>↻</button>
          )}
          <button className="pd-x" aria-label="Delete task" onClick={onDelete}>×</button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Single-task editor — for inbox tasks reached from the Calendar,     */
/*  which have no project page of their own to land on.                 */
/* ------------------------------------------------------------------ */
function TaskEditModal({ task, onClose, onTitle, onDeadline, onStartTime, onEndTime, onCyclePriority, onToggleRecurring, onToggleDone, onDelete }) {
  return (
    <div className="pd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pd-panel" role="dialog" aria-modal="true" aria-label="Task details" style={{ height: "auto" }}>
        <div className="pd-panel-header">
          <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 15 }}>Task</div>
          <div className="pd-panel-actions">
            <button type="button" onClick={onClose} title="Close">✕</button>
          </div>
        </div>
        <div className="pd-panel-body pd-task-edit-body">
          <div className="pd-task-edit-row">
            <button className={`pd-check pd-press ${task.done ? "done" : ""}`}
              style={task.done ? { background: "var(--accent)", borderColor: "var(--accent)" } : {}}
              onClick={onToggleDone} aria-label={task.done ? "Mark as not done" : "Mark as done"}>
              <svg width="13" height="13" viewBox="0 0 12 12"><path d="M2 6.5L4.8 9L10 3.5" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            <button type="button" className="pd-priority-dot" title={`Priority: ${task.priority || "med"} (click to change)`}
              style={{ background: PRIORITY_COLOR[task.priority || "med"] }} onClick={onCyclePriority} aria-label="Cycle task priority" />
            <input className="pd-proj-name" style={{ fontSize: 18 }} value={task.title}
              onChange={(e) => onTitle(e.target.value)} aria-label="Task title" />
          </div>
          <div className="pd-form-row">
            <DatePicker value={task.deadline} onChange={onDeadline}
              startTime={task.startTime} endTime={task.endTime} onStartTime={onStartTime} onEndTime={onEndTime} />
            <button type="button" className={`pd-recur-toggle ${task.recurring ? "on" : ""}`} style={{ opacity: 1 }}
              onClick={onToggleRecurring} title="Repeats daily">
              ↻ {task.recurring ? "Repeats daily" : "One-time"}
            </button>
          </div>
          <button type="button" className="pd-danger-btn pd-press" style={{ alignSelf: "flex-start" }} onClick={onDelete}>delete task</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main app                                                           */
/* ------------------------------------------------------------------ */
function AppShell({ userId }) {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newProj, setNewProj] = useState({ name: "", client: "", location: "", startDate: todayISO() });
  const [taskInput, setTaskInput] = useState("");
  const [noiseInput, setNoiseInput] = useState("");
  const [savedFlash, setSavedFlash] = useState("");
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const [importNote, setImportNote] = useState("");
  const [toast, setToast] = useState(null);
  const [dragTaskId, setDragTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [dragNoteId, setDragNoteId] = useState(null);
  const [dragOverNoteId, setDragOverNoteId] = useState(null);
  const [touchDragId, setTouchDragId] = useState(null);

  // ---- redesign: project-less inbox, completion/focus history, recurring reset, time tracking ----
  const [inbox, setInbox] = useState([]);
  const [notes, setNotes] = useState([]); // standalone notes (Brain screen), parallel to inbox
  const [completionLog, setCompletionLog] = useState({});
  const [focusLog, setFocusLog] = useState({});
  const [lastResetDate, setLastResetDate] = useState(null);
  const [runningTaskId, setRunningTaskId] = useState(null);
  const [runStart, setRunStart] = useState(null);
  const [tick, setTick] = useState(0); // forces re-render for live elapsed-time display only
  const [screen, setScreen] = useState("today"); // "today" | "projects" | "calendar" | "stats" — never persisted
  const [inboxInput, setInboxInput] = useState(""); // top-bar quick-add text
  const [brainInput, setBrainInput] = useState(""); // top-bar note capture (Brain screen)
  const [editingTaskId, setEditingTaskId] = useState(null); // inbox task open in the single-task editor
  const [paletteOpen, setPaletteOpen] = useState(false); // command palette (Cmd/Ctrl+K)
  // Sidebar collapse is a device-local UI preference, not app data — localStorage, not the Supabase blob.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("pd-sidebar-collapsed") === "1");
  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("pd-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }, []);

  const isMobile = useIsMobile();
  const greeting = useGreeting(); // Timezone-aware dynamic greeting for Today screen

  // Lock zoom for a native-app feel. Note for accessibility: this removes the
  // user's ability to pinch-zoom text, which WCAG normally recommends against —
  // acceptable tradeoff here since every field already renders at 16px+.
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    const prev = meta ? meta.getAttribute("content") : null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
    meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
    return () => { if (prev !== null) meta.setAttribute("content", prev); };
  }, []);

  const kbInset = useKeyboardInset();
  const saveTimer = useRef(null);
  const flashTimer = useRef(null);
  const toastTimer = useRef(null);
  const importFileRef = useRef(null);
  const searchRef = useRef(null);
  const quickAddRef = useRef(null);
  const selectedIdRef = useRef(null);
  const touchDrag = useRef(null);
  const tickTimer = useRef(null);
  const lastWrittenAtRef = useRef(null);
  selectedIdRef.current = selectedId;

  // Mirror the redesign's root-level state into refs so the debounced persist() below
  // can always read the latest values, no matter which piece of state triggered the save.
  const projectsRef = useRef(projects); projectsRef.current = projects;
  const inboxRef = useRef(inbox); inboxRef.current = inbox;
  const notesRef = useRef(notes); notesRef.current = notes;
  const completionLogRef = useRef(completionLog); completionLogRef.current = completionLog;
  const focusLogRef = useRef(focusLog); focusLogRef.current = focusLog;
  const lastResetDateRef = useRef(lastResetDate); lastResetDateRef.current = lastResetDate;
  const runningTaskIdRef = useRef(runningTaskId); runningTaskIdRef.current = runningTaskId;
  const runStartRef = useRef(runStart); runStartRef.current = runStart;

  // Applies a full data blob to state — used both for the initial load and for
  // remote changes that arrive over the Realtime subscription below. `restoreSelection`
  // is only true on initial load: a live remote update shouldn't yank the project
  // you're currently looking at just because another device last had something else open.
  const applyData = useCallback((data, { restoreSelection = false } = {}) => {
    const projs = (data.projects || []).map(migrate);
    setProjects(projs); projectsRef.current = projs;
    if (restoreSelection && data.lastSelectedId && projs.some((p) => p.id === data.lastSelectedId) && !window.matchMedia("(max-width: 860px)").matches) {
      setSelectedId(data.lastSelectedId);
    }
    const root = migrateRoot(data);
    setInbox(root.inbox); inboxRef.current = root.inbox;
    setNotes(root.notes); notesRef.current = root.notes;
    setCompletionLog(root.completionLog); completionLogRef.current = root.completionLog;
    setFocusLog(root.focusLog); focusLogRef.current = root.focusLog;
    setLastResetDate(root.lastResetDate); lastResetDateRef.current = root.lastResetDate;
    if (root.runningTaskId && root.runStart) {
      setRunningTaskId(root.runningTaskId); runningTaskIdRef.current = root.runningTaskId;
      setRunStart(root.runStart); runStartRef.current = root.runStart;
      clearInterval(tickTimer.current);
      tickTimer.current = setInterval(() => setTick((t) => t + 1), 1000);
    } else {
      setRunningTaskId(null); runningTaskIdRef.current = null;
      setRunStart(null); runStartRef.current = null;
      clearInterval(tickTimer.current);
    }
  }, []);

  /* ---- load ---- */
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) {
          applyData(JSON.parse(res.value), { restoreSelection: true });
        } else {
          const today = todayISO();
          setLastResetDate(today); lastResetDateRef.current = today;
        }
      } catch (e) { /* first run */ }
      setLoaded(true);
    })();
    return () => clearInterval(tickTimer.current);
  }, [applyData]);

  /* ---- live sync: pick up changes made on another device within ~1s ---- */
  useEffect(() => {
    if (!loaded || !userId) return;
    const channel = supabase
      .channel(`kv_store_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kv_store", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new;
          if (!row || row.key !== STORAGE_KEY) return;
          if (lastWrittenAtRef.current && row.updated_at === lastWrittenAtRef.current) return; // our own write echoing back
          applyData(row.value);
          setSavedFlash("synced from another device");
          clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setSavedFlash(""), 2000);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loaded, userId, applyData]);

  /* ---- debounced save (whole root blob: projects, inbox, logs, timer, last selected) ---- */
  const persist = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const blob = JSON.stringify({
          projects: projectsRef.current,
          inbox: inboxRef.current,
          notes: notesRef.current,
          completionLog: completionLogRef.current,
          focusLog: focusLogRef.current,
          lastResetDate: lastResetDateRef.current,
          runningTaskId: runningTaskIdRef.current,
          runStart: runStartRef.current,
          lastSelectedId: selectedIdRef.current,
        });
        const res = await storage.set(STORAGE_KEY, blob);
        if (res?.updatedAt) lastWrittenAtRef.current = res.updatedAt;
        clearTimeout(flashTimer.current);
        if (blob.length > 2_500_000) {
          // Inline images are the usual culprit — surface it before saves get sluggish.
          setSavedFlash("saved — data is getting large; consider removing old brain entries");
          flashTimer.current = setTimeout(() => setSavedFlash(""), 5000);
        } else {
          setSavedFlash("saved");
          flashTimer.current = setTimeout(() => setSavedFlash(""), 1200);
        }
      } catch (e) { setSavedFlash("save failed — will retry on next change"); }
    }, 500);
  }, []);

  const update = useCallback((fn) => {
    setProjects((prev) => { const next = fn(prev); projectsRef.current = next; persist(); return next; });
  }, [persist]);

  const updateInbox = useCallback((fn) => {
    setInbox((prev) => { const next = fn(prev); inboxRef.current = next; persist(); return next; });
  }, [persist]);

  const updateNotes = useCallback((fn) => {
    setNotes((prev) => { const next = fn(prev); notesRef.current = next; persist(); return next; });
  }, [persist]);

  // ---- generalized note lookup: a note can be standalone or live in any project ----
  const locateAndPatchNote = useCallback((noteId, fn) => {
    if (notesRef.current.some((n) => n.id === noteId)) {
      updateNotes((ns) => ns.map((n) => (n.id === noteId ? fn(n) : n)));
      return;
    }
    update((prev) => prev.map((p) => (
      p.notes.some((n) => n.id === noteId)
        ? { ...p, notes: p.notes.map((n) => (n.id === noteId ? fn(n) : n)) }
        : p
    )));
  }, [update, updateNotes]);

  // Durable per-day counters — survive task deletion, the only source of truth for streak/heatmap/week-bar.
  const bumpCompletionLog = useCallback((date, delta) => {
    setCompletionLog((prev) => {
      const next = { ...prev, [date]: Math.max(0, (prev[date] || 0) + delta) };
      completionLogRef.current = next;
      persist();
      return next;
    });
  }, [persist]);
  const bumpFocusLog = useCallback((date, seconds) => {
    setFocusLog((prev) => {
      const next = { ...prev, [date]: (prev[date] || 0) + seconds };
      focusLogRef.current = next;
      persist();
      return next;
    });
  }, [persist]);

  // ---- generalized task lookup: a task can live in the inbox or in any project ----
  const locateAndPatchTask = useCallback((taskId, fn) => {
    if (inboxRef.current.some((t) => t.id === taskId)) {
      updateInbox((ts) => ts.map((t) => (t.id === taskId ? fn(t) : t)));
      return;
    }
    update((prev) => prev.map((p) => (
      p.tasks.some((t) => t.id === taskId)
        ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? fn(t) : t)) }
        : p
    )));
  }, [update, updateInbox]);

  const toggleTaskDone = useCallback((taskId) => {
    // Compute the log delta outside the state-updater callback — React (StrictMode in
    // particular) may invoke that callback more than once per call, and bumpCompletionLog
    // is a side effect that must only run once per real toggle.
    const today = todayISO();
    let logDelta = null;
    locateAndPatchTask(taskId, (t) => {
      if (!t.done) {
        logDelta = { day: today, delta: 1 };
        return { ...t, done: true, completedAt: Date.now() };
      }
      logDelta = { day: t.completedAt ? localDateISO(t.completedAt) : today, delta: -1 };
      return { ...t, done: false, completedAt: null };
    });
    if (logDelta) bumpCompletionLog(logDelta.day, logDelta.delta);
  }, [locateAndPatchTask, bumpCompletionLog]);

  const cycleTaskPriority = useCallback((taskId) => {
    locateAndPatchTask(taskId, (t) => ({ ...t, priority: PRIORITY_CYCLE[t.priority] || "med" }));
  }, [locateAndPatchTask]);

  const toggleTaskRecurring = useCallback((taskId) => {
    locateAndPatchTask(taskId, (t) => ({ ...t, recurring: !t.recurring }));
  }, [locateAndPatchTask]);

  // ---- time tracking: one global runner; starting a new task flushes the previous one ----
  const flushRunning = useCallback(() => {
    const id = runningTaskIdRef.current;
    const start = runStartRef.current;
    if (!id || !start) return;
    const elapsed = (Date.now() - start) / 1000;
    locateAndPatchTask(id, (t) => ({ ...t, trackedSeconds: t.trackedSeconds + elapsed }));
    bumpFocusLog(todayISO(), elapsed);
  }, [locateAndPatchTask, bumpFocusLog]);

  const toggleTrack = useCallback((taskId) => {
    const stopping = runningTaskIdRef.current === taskId;
    flushRunning();
    clearInterval(tickTimer.current);
    if (stopping) {
      setRunningTaskId(null); runningTaskIdRef.current = null;
      setRunStart(null); runStartRef.current = null;
      persist();
      return;
    }
    const start = Date.now();
    setRunningTaskId(taskId); runningTaskIdRef.current = taskId;
    setRunStart(start); runStartRef.current = start;
    persist();
    tickTimer.current = setInterval(() => setTick((t) => t + 1), 1000);
  }, [flushRunning, persist]);

  // Top-bar quick-add target: a project-less task, visible in Today/Calendar but not the Projects grid.
  const addInboxTask = useCallback((raw) => {
    const { title, timeLabel } = parseQuickAdd(raw);
    if (!title) return false;
    updateInbox((ts) => [...ts, migrateTask({ id: uid(), title, done: false, deadline: todayISO(), createdAt: Date.now(), timeLabel })]);
    return true;
  }, [updateInbox]);

  // Jump to a project's detail view — shared by Today/Calendar's inline links and the command palette.
  const openProject = useCallback((id) => { setScreen("projects"); setSelectedId(id); }, []);
  // Command palette "New project" quick action: prefill the Projects screen's creation form and open it.
  const startNewProject = useCallback((name) => {
    setScreen("projects"); setSelectedId(null);
    setNewProj({ name, client: "", location: "", startDate: todayISO() });
    setAdding(true);
  }, []);

  // Single-task editor (Calendar chip click on a project-less task — it has no project
  // page to land on, so it gets a small standalone editor instead).
  const editingTask = inbox.find((t) => t.id === editingTaskId) || null;
  const editTaskTitle = useCallback((title) => {
    updateInbox((ts) => ts.map((t) => (t.id === editingTaskId ? { ...t, title } : t)));
  }, [updateInbox, editingTaskId]);
  const editTaskDeadline = useCallback((iso) => {
    updateInbox((ts) => ts.map((t) => (t.id === editingTaskId ? { ...t, deadline: iso } : t)));
  }, [updateInbox, editingTaskId]);
  const editTaskStartTime = useCallback((v) => {
    updateInbox((ts) => ts.map((t) => (t.id === editingTaskId ? { ...t, startTime: v } : t)));
  }, [updateInbox, editingTaskId]);
  const editTaskEndTime = useCallback((v) => {
    updateInbox((ts) => ts.map((t) => (t.id === editingTaskId ? { ...t, endTime: v } : t)));
  }, [updateInbox, editingTaskId]);
  const deleteEditingTask = useCallback(() => {
    updateInbox((ts) => ts.filter((t) => t.id !== editingTaskId));
    setEditingTaskId(null);
  }, [updateInbox, editingTaskId]);

  // Daily reset for recurring tasks — flips done back to false so they reappear tomorrow.
  // Never touches completionLog: that day's completion was already recorded when it happened.
  const runRecurringReset = useCallback(() => {
    const today = todayISO();
    if (lastResetDateRef.current === today) return;
    const resetTask = (t) => {
      if (!t.recurring || !t.done) return t;
      const completedDay = t.completedAt ? localDateISO(t.completedAt) : null;
      if (completedDay === today) return t; // already completed today — leave it
      return { ...t, done: false, completedAt: null };
    };
    updateInbox((ts) => ts.map(resetTask));
    update((prev) => prev.map((p) => ({ ...p, tasks: p.tasks.map(resetTask) })));
    setLastResetDate(today); lastResetDateRef.current = today;
    persist();
  }, [updateInbox, update, persist]);

  useEffect(() => {
    if (!loaded) return;
    runRecurringReset();
    const onVisible = () => { if (document.visibilityState === "visible") runRecurringReset(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loaded, runRecurringReset]);

  // Persist selection changes too (so reload restores your place)
  useEffect(() => {
    if (loaded) update((prev) => prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /* ---- undo toast system ---- */
  const showUndo = useCallback((msg, undoFn) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, undo: undoFn });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const runUndo = () => {
    clearTimeout(toastTimer.current);
    if (toast?.undo) toast.undo();
    setToast(null);
  };

  /* ---- derived ---- */
  const sorted = useMemo(() => [...projects].sort(attentionSort), [projects]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) =>
      [p.name, p.client, p.location, p.phase].some((s) => (s || "").toLowerCase().includes(q)) ||
      p.tasks.some((t) => t.title.toLowerCase().includes(q)) ||
      p.notes.some((n) => htmlToPlain(n.text).toLowerCase().includes(q))
    );
  }, [sorted, query]);
  const selected = projects.find((p) => p.id === selectedId) || null;
  const allTasks = projects.flatMap((p) => p.tasks);
  const overallPct = allTasks.length ? Math.round((allTasks.filter((t) => t.done).length / allTasks.length) * 100) : 0;

  /* ---- actions ---- */
  const addProject = () => {
    const name = newProj.name.trim();
    if (!name) return;
    const proj = {
      id: uid(), name, client: newProj.client.trim(), location: newProj.location.trim(), phase: "",
      startDate: newProj.startDate || todayISO(), notes: [], colorIdx: projects.length % PALETTE.length,
      tasks: [], createdAt: Date.now(),
    };
    update((prev) => [...prev, proj]);
    setSelectedId(proj.id); setAdding(false);
    setNewProj({ name: "", client: "", location: "", startDate: todayISO() });
  };

  const patchProject = (patch) => update((prev) => prev.map((p) => (p.id === selected.id ? { ...p, ...patch } : p)));
  const patchTasks = (fn) => update((prev) => prev.map((p) => (p.id === selected.id ? { ...p, tasks: fn(p.tasks) } : p)));

  const addTaskTitled = (raw) => {
    const { title, timeLabel } = parseQuickAdd(raw);
    if (!title || !selected) return false;
    patchTasks((ts) => [...ts, migrateTask({ id: uid(), title, done: false, deadline: todayISO(), createdAt: Date.now(), timeLabel })]);
    return true;
  };
  const addNoiseText = (text) => {
    const clean = text.trim();
    if (!clean || !selected) return false;
    patchProject({ notes: [...selected.notes, { id: uid(), text: textToHtml(clean) }] });
    return true;
  };

  const deleteTaskWithUndo = (task) => {
    const projId = selected.id;
    const idx = selected.tasks.findIndex((t) => t.id === task.id);
    patchTasks((ts) => ts.filter((x) => x.id !== task.id));
    showUndo("Task deleted", () => update((prev) => prev.map((p) => {
      if (p.id !== projId) return p;
      const ts = [...p.tasks]; ts.splice(Math.min(idx, ts.length), 0, task);
      return { ...p, tasks: ts };
    })));
  };
  const deleteNoteWithUndo = (note) => {
    const projId = selected.id;
    const idx = selected.notes.findIndex((n) => n.id === note.id);
    patchProject({ notes: selected.notes.filter((x) => x.id !== note.id) });
    showUndo("Note deleted", () => update((prev) => prev.map((p) => {
      if (p.id !== projId) return p;
      const ns = [...p.notes]; ns.splice(Math.min(idx, ns.length), 0, note);
      return { ...p, notes: ns };
    })));
  };

  /* ---- Notes screen actions — must NOT touch `selected` (it can be stale on other screens) ---- */
  const addStandaloneNote = (text) => {
    const clean = text.trim();
    if (!clean) return false;
    updateNotes((ns) => [...ns, { id: uid(), text: textToHtml(clean), createdAt: Date.now() }]);
    return true;
  };
  const addStandaloneImageNotes = async (files) => {
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      try {
        const dataUrl = await imageFileToDataURL(f);
        updateNotes((ns) => [...ns, { id: uid(), text: `<img src="${dataUrl}">`, createdAt: Date.now() }]);
      } catch (err) { /* unreadable file — skip */ }
    }
  };
  const deleteNoteGlobalWithUndo = (note) => {
    // Capture the note's home (root list or a specific project) at delete time.
    const rootIdx = notesRef.current.findIndex((n) => n.id === note.id);
    if (rootIdx !== -1) {
      updateNotes((ns) => ns.filter((n) => n.id !== note.id));
      showUndo("Note deleted", () => updateNotes((ns) => {
        const out = [...ns]; out.splice(Math.min(rootIdx, out.length), 0, note); return out;
      }));
      return;
    }
    const proj = projectsRef.current.find((p) => p.notes.some((n) => n.id === note.id));
    if (!proj) return;
    const idx = proj.notes.findIndex((n) => n.id === note.id);
    update((prev) => prev.map((p) => (p.id === proj.id ? { ...p, notes: p.notes.filter((n) => n.id !== note.id) } : p)));
    showUndo("Note deleted", () => update((prev) => prev.map((p) => {
      if (p.id !== proj.id) return p;
      const ns = [...p.notes]; ns.splice(Math.min(idx, ns.length), 0, note);
      return { ...p, notes: ns };
    })));
  };
  const deleteProjectWithUndo = () => {
    const proj = selected;
    const idx = projects.findIndex((p) => p.id === proj.id);
    update((prev) => prev.filter((p) => p.id !== proj.id));
    setSelectedId(null);
    showUndo(`Deleted "${proj.name}"`, () => update((prev) => {
      const ps = [...prev]; ps.splice(Math.min(idx, ps.length), 0, proj);
      return ps;
    }));
  };

  /* ---- export / import ---- */
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ projects, inbox, notes }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `projects-export-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const openImportPicker = () => { setImportNote(""); importFileRef.current?.click(); };
  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = {
        projects: (parsed.projects || []).map(migrate),
        inbox: (parsed.inbox || []).map(migrateTask),
        notes: parsed.notes || [],
      };
      if (!incoming.projects.length && !incoming.inbox.length && !incoming.notes.length) {
        setImportNote("That file has no projects, tasks, or notes in it."); return;
      }
      setPendingImport(incoming);
    } catch (err) {
      setImportNote("Couldn't read that file — make sure it's a projects-export .json file.");
    }
  };
  const confirmImport = () => {
    const n = pendingImport.projects.length;
    update(() => pendingImport.projects);
    updateInbox(() => pendingImport.inbox);
    updateNotes(() => pendingImport.notes);
    setSelectedId(null);
    setPendingImport(null);
    setImportNote(`Imported ${n} project${n !== 1 ? "s" : ""}.`);
    setTimeout(() => setImportNote(""), 3000);
  };

  /* ---- touch reorder (long list drag via handle, works on phones) ---- */
  const touchReorderStart = useCallback((e, id, kind) => {
    touchDrag.current = { id, kind };
    setTouchDragId(id);
    const move = (ev) => {
      if (!touchDrag.current) return;
      if (ev.cancelable) ev.preventDefault();
      const t = ev.touches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const target = el && el.closest(`[data-rkind="${touchDrag.current.kind}"]`);
      if (!target) return;
      const overId = target.getAttribute("data-rid");
      if (!overId || overId === touchDrag.current.id) return;
      const { id: dragId, kind: k } = touchDrag.current;
      if (k === "task") {
        update((prev) => prev.map((p) => p.id === selectedIdRef.current ? { ...p, tasks: moveItem(p.tasks, dragId, overId) } : p));
      } else {
        update((prev) => prev.map((p) => p.id === selectedIdRef.current ? { ...p, notes: moveItem(p.notes, dragId, overId) } : p));
      }
    };
    const end = () => {
      touchDrag.current = null;
      setTouchDragId(null);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
  }, [update]);

  /* ---- edge swipe back (mobile) — pane follows the finger, velocity decides ---- */
  const edge = useRef(null);
  const [edgeDx, setEdgeDx] = useState(0);
  const [edgeDrag, setEdgeDrag] = useState(false);
  const onDetailTouchStart = (e) => {
    if (!isMobile || !selectedIdRef.current) return;
    const t = e.touches[0];
    if (t.clientX < 36) edge.current = { x: t.clientX, y: t.clientY, t: Date.now(), active: null };
  };
  const onDetailTouchMove = (e) => {
    if (!edge.current) return;
    const t = e.touches[0];
    const dx = t.clientX - edge.current.x;
    const dy = t.clientY - edge.current.y;
    if (edge.current.active === null) {
      if (dx > 10 && Math.abs(dx) > Math.abs(dy)) { edge.current.active = true; setEdgeDrag(true); }
      else if (Math.abs(dy) > 10) edge.current.active = false;
    }
    if (edge.current.active) setEdgeDx(Math.max(0, dx));
  };
  const onDetailTouchEnd = () => {
    if (!edge.current) return;
    if (edge.current.active) {
      const dt = Math.max(1, Date.now() - edge.current.t);
      const velocity = edgeDx / dt; // px per ms
      const w = window.innerWidth;
      setEdgeDrag(false);
      if (edgeDx > w * 0.3 || (edgeDx > 50 && velocity > 0.45)) { setEdgeDx(0); setSelectedId(null); }
      else setEdgeDx(0);
    }
    edge.current = null;
  };

  /* ---- keyboard shortcuts (desktop) ---- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); return; }
      if (typing) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "n" && selectedIdRef.current) { e.preventDefault(); quickAddRef.current?.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = filtered;
        if (!list.length) return;
        const idx = list.findIndex((p) => p.id === selectedIdRef.current);
        const nextIdx = e.key === "ArrowDown" ? Math.min(list.length - 1, idx + 1) : Math.max(0, idx - 1);
        setSelectedId(list[idx === -1 ? 0 : nextIdx].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered]);

  /* ---- render ---- */
  if (!loaded) {
    return (
      <div className="pd-app"><style>{css}</style>
        <div className="pd-topbar"><div className="pd-title">Projects<span>.</span></div></div>
        <div className="pd-skel">
          <div className="pd-skel-row" /><div className="pd-skel-row" /><div className="pd-skel-row" style={{ animationDelay: ".15s" }} />
        </div>
      </div>
    );
  }

  const selColor = selected ? colorOf(selected) : null;
  const selPct = selected ? progressOf(selected) : null;
  const doneCount = selected ? selected.tasks.filter((t) => t.done).length : 0;
  const activeTasks = selected ? selected.tasks.filter((t) => !t.done) : [];
  const completedTasks = selected ? selected.tasks.filter((t) => t.done) : [];

  const longDateToday = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className={`pd-app ${selected ? "detail-open" : ""}`}>
      <style>{css}</style>

      <div className="pd-shell">
        {!isMobile && (
          <Sidebar screen={screen} navItems={NAV_ITEMS} onNavigate={setScreen}
            projects={projects} onOpenProject={openProject}
            onOpenPalette={() => setPaletteOpen(true)}
            collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebarCollapsed} />
        )}

        <div className="pd-main">
          <div className="pd-topbar">
            {screen === "projects" ? (
              <>
                <div className="pd-title">Projects<span>.</span></div>
                <div className="pd-overall">
                  <div className="pd-overall-bar"><div className="pd-overall-fill" style={{ width: `${overallPct}%` }} /></div>
                  <span className="pd-overall-label">
                    {allTasks.length ? `${overallPct}% overall · ${projects.length} project${projects.length !== 1 ? "s" : ""}` : "no tasks yet"}
                  </span>
                </div>
              </>
            ) : screen === "brain" ? (
              <>
                <div className="pd-title">{SCREEN_TITLES[screen]}<span>.</span></div>
                <div className="pd-topbar-quickadd-wrap">
                  <input className="pd-topbar-quickadd" placeholder="Capture a thought and press Enter…"
                    value={brainInput} onChange={(e) => setBrainInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && addStandaloneNote(brainInput)) setBrainInput(""); }} />
                </div>
                <div className="pd-topbar-date">{longDateToday}</div>
              </>
            ) : (
              <>
                <div className="pd-title">{screen === "today" ? greeting : SCREEN_TITLES[screen]}<span>.</span></div>
                <div className="pd-topbar-quickadd-wrap">
                  <input className="pd-topbar-quickadd" placeholder='Add a task…  try "call mom tomorrow 5pm"'
                    value={inboxInput} onChange={(e) => setInboxInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && addInboxTask(inboxInput)) setInboxInput(""); }} />
                </div>
                <div className="pd-topbar-date">{longDateToday}</div>
              </>
            )}
          </div>

          <div className="pd-screen">
            {screen === "today" && (
              <TodayScreen projects={projects} inbox={inbox} runningTaskId={runningTaskId} runStart={runStart} tick={tick}
                completionLog={completionLog} focusLog={focusLog}
                onToggle={toggleTaskDone} onCyclePriority={cycleTaskPriority} onToggleTrack={toggleTrack} />
            )}
            {screen === "brain" && (
              <BrainScreen projects={projects} notes={notes} isMobile={isMobile}
                onSaveNote={(id, text) => locateAndPatchNote(id, (n) => ({ ...n, text }))}
                onDeleteNote={deleteNoteGlobalWithUndo}
                onDropImages={addStandaloneImageNotes} />
            )}
            {screen === "calendar" && (
              <CalendarScreen projects={projects} inbox={inbox} isMobile={isMobile}
                onOpenProject={openProject}
                onOpenTask={(t) => setEditingTaskId(t.id)} />
            )}
            {screen === "stats" && (
              <StatsScreen completionLog={completionLog} focusLog={focusLog} runningTaskId={runningTaskId} runStart={runStart} tick={tick} />
            )}
            {screen === "projects" && (
      <div className="pd-body">
        {/* left: dashboard */}
        <div className="pd-left">
          <input ref={searchRef} className="pd-search" enterKeyHint="search" placeholder="Search projects, tasks, Brain entries  ( / )"
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); e.target.blur(); } }} />

          <div className="pd-viewtoggle">
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>list</button>
            <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}>timeline</button>
          </div>

          <div className="pd-datarow">
            <button className="pd-data-btn" onClick={exportData}>Export data</button>
            <button className="pd-data-btn" onClick={openImportPicker}>Import data</button>
            <input ref={importFileRef} type="file" accept="application/json" style={{ display: "none" }} onChange={onImportFile} />
          </div>
          {importNote && <div className={`pd-import-note ${pendingImport ? "" : "err"}`}>{importNote}</div>}
          {pendingImport && (
            <div className="pd-import-banner">
              <p>Import {pendingImport.projects.length} project{pendingImport.projects.length !== 1 ? "s" : ""}? This replaces everything currently in this app.</p>
              <div className="pd-form-row">
                <button className="pd-btn" onClick={confirmImport}>Replace with imported data</button>
                <button className="pd-btn ghost" onClick={() => setPendingImport(null)}>Cancel</button>
              </div>
            </div>
          )}

          {adding ? (
            <div className="pd-form">
              <input type="text" placeholder="Project name" value={newProj.name} autoFocus enterKeyHint="next"
                onChange={(e) => setNewProj({ ...newProj, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addProject(); if (e.key === "Escape") setAdding(false); }} />
              <input type="text" placeholder="Client name" value={newProj.client} enterKeyHint="next"
                onChange={(e) => setNewProj({ ...newProj, client: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addProject(); }} />
              <input type="text" placeholder="Location" value={newProj.location} enterKeyHint="done"
                onChange={(e) => setNewProj({ ...newProj, location: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") addProject(); }} />
              <div className="pd-form-label">Start date</div>
              <div className="pd-form-row">
                <DatePicker value={newProj.startDate} onChange={(iso) => setNewProj({ ...newProj, startDate: iso || todayISO() })} />
                <button className="pd-btn pd-press" onClick={addProject}>Create</button>
                <button className="pd-btn ghost pd-press" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="pd-addproj pd-press" onClick={() => setAdding(true)}>+ New project</button>
          )}

          {sorted.length === 0 && !adding && <p className="pd-empty">No projects yet. Create your first one to start tracking progress.</p>}
          {sorted.length > 0 && filtered.length === 0 && <p className="pd-empty">No matches for "{query}".</p>}

          {view === "timeline" ? (
            <Timeline projects={filtered} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            filtered.map((p) => {
              const pct = progressOf(p), c = colorOf(p), due = dueLabel(nextDue(p));
              const clientLoc = [p.client, p.location].filter(Boolean).join(" · ");
              return (
                <div key={p.id} role="button" tabIndex={0}
                  className={`pd-card ${p.id === selectedId ? "selected" : ""}`}
                  style={{ background: c.bg, "--pfg": c.fg }}
                  onClick={() => setSelectedId(p.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(p.id); } }}>
                  <Ring pct={pct} color={c.fg} />
                  <div className="pd-card-info">
                    <div className="pd-card-name">{p.name}</div>
                    {clientLoc && <div className="pd-card-client">{clientLoc}</div>}
                    <div className="pd-card-meta">
                      {pct === null ? "not started" : `${p.tasks.filter((t) => t.done).length}/${p.tasks.length} tasks`}
                      {due && <> · <span className={due.overdue ? "overdue" : ""}>next due {due.text}</span></>}
                      {!due && startedLabel(p.startDate) && <> · {startedLabel(p.startDate)}</>}
                    </div>
                    {p.phase && <span className="pd-phase">{p.phase}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* right: detail */}
        <div className={`pd-right ${edgeDrag ? "edge-dragging" : ""}`}
          style={edgeDx > 0 ? { transform: `translateX(${edgeDx}px)` } : undefined}
          onTouchStart={onDetailTouchStart} onTouchMove={onDetailTouchMove} onTouchEnd={onDetailTouchEnd}>
          {!selected ? (
            <p className="pd-empty">Select a project or create one above.</p>
          ) : (
            <>
              <button className="pd-back pd-press" onClick={() => setSelectedId(null)}>← all projects</button>

              <div className="pd-detail-head">
                <div style={{ flex: 1, minWidth: 240 }}>
                  <input className="pd-proj-name" value={selected.name}
                    onChange={(e) => patchProject({ name: e.target.value })} aria-label="Project name" />
                  <div className="pd-meta-grid">
                    <div className="pd-field">
                      <label>Client</label>
                      <input type="text" value={selected.client} placeholder="—" onChange={(e) => patchProject({ client: e.target.value })} />
                    </div>
                    <div className="pd-field">
                      <label>Location</label>
                      <input type="text" value={selected.location} placeholder="—" onChange={(e) => patchProject({ location: e.target.value })} />
                    </div>
                    <div className="pd-field">
                      <label>Phase</label>
                      <PhaseCombo value={selected.phase || ""}
                        onChange={(v) => patchProject({ phase: v })}
                        suggestions={[...new Set(projects.map((p) => p.phase).filter(Boolean))]} />
                    </div>
                    <div className="pd-field">
                      <label>Started</label>
                      <DatePicker value={selected.startDate} onChange={(iso) => patchProject({ startDate: iso || todayISO() })} />
                    </div>
                  </div>
                </div>
                <button className="pd-danger-btn pd-press" onClick={deleteProjectWithUndo}>delete project</button>
              </div>

              <div style={{ marginTop: 14 }} className="pd-overall-label">
                {selPct === null ? "not started" : `${doneCount}/${selected.tasks.length} tasks · ${selPct}%`}
                {startedLabel(selected.startDate) && <> · {startedLabel(selected.startDate)}</>}
              </div>
              <div className="pd-progressbar"><div className="pd-progressfill" style={{ width: `${selPct ?? 0}%`, background: selColor.fg }} /></div>

              <div className="pd-inputrow pd-quickadd-row">
                <input ref={quickAddRef} className="pd-quickadd" style={{ marginTop: 0 }} enterKeyHint="send"
                  placeholder="Add a task and press Enter…  ( n )"
                  value={taskInput} onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && addTaskTitled(taskInput)) setTaskInput(""); }} />
                <button className="pd-send" aria-label="Add task" disabled={!taskInput.trim()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { if (addTaskTitled(taskInput)) setTaskInput(""); }}>↑</button>
              </div>

              {selected.tasks.length === 0 ? (
                <p className="pd-empty">Add your first task above — progress starts counting from there.</p>
              ) : (
                <ul className="pd-tasklist">
                  {activeTasks.map((t) => (
                    <TaskRow key={t.id} task={t} color={selColor} isMobile={isMobile} completed={false}
                      onToggle={() => toggleTaskDone(t.id)}
                      onDelete={() => deleteTaskWithUndo(t)}
                      onTitle={(title) => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, title } : x))}
                      onDeadline={(iso) => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, deadline: iso } : x))}
                      onStartTime={(v) => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, startTime: v } : x))}
                      onEndTime={(v) => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, endTime: v } : x))}
                      onCyclePriority={() => cycleTaskPriority(t.id)}
                      onToggleRecurring={() => toggleTaskRecurring(t.id)}
                      reorderUp={() => patchTasks((ts) => moveBy(ts, t.id, -1))}
                      reorderDown={() => patchTasks((ts) => moveBy(ts, t.id, 1))}
                      canUp={activeTasks[0]?.id !== t.id}
                      canDown={activeTasks[activeTasks.length - 1]?.id !== t.id}
                      touchReorderStart={touchReorderStart}
                      dragClass={`${dragTaskId === t.id || touchDragId === t.id ? "dragging" : ""} ${dragOverTaskId === t.id ? "drag-over" : ""}`}
                      dragHandlers={{
                        onDragStart: () => setDragTaskId(t.id),
                        onDragOver: (e) => { e.preventDefault(); setDragOverTaskId(t.id); },
                        onDrop: (e) => { e.preventDefault(); if (dragTaskId) patchTasks((ts) => moveItem(ts, dragTaskId, t.id)); setDragTaskId(null); setDragOverTaskId(null); },
                        onDragEnd: () => { setDragTaskId(null); setDragOverTaskId(null); },
                      }} />
                  ))}

                  {completedTasks.length > 0 && <li className="pd-tasksep">Completed</li>}
                  {completedTasks.map((t) => (
                    <TaskRow key={t.id} task={t} color={selColor} isMobile={isMobile} completed={true}
                      onToggle={() => toggleTaskDone(t.id)}
                      onDelete={() => deleteTaskWithUndo(t)}
                      onTitle={(title) => patchTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, title } : x))}
                      onDeadline={() => {}} />
                  ))}
                </ul>
              )}

              <div className="pd-section-label">Brain Noises</div>
              <div className="pd-inputrow">
                <input className="pd-noise-input" style={{ flex: 1 }} enterKeyHint="send"
                  placeholder="Drop a thought and press Enter…"
                  value={noiseInput} onChange={(e) => setNoiseInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && addNoiseText(noiseInput)) setNoiseInput(""); }} />
                <button className="pd-send" aria-label="Add thought" disabled={!noiseInput.trim()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { if (addNoiseText(noiseInput)) setNoiseInput(""); }}>↑</button>
              </div>
              {selected.notes.length === 0 ? (
                <p className="pd-empty">Empty head. Add thoughts, doubts, ideas — one bubble each.</p>
              ) : (
                <div className="pd-bubbles">
                  {selected.notes.map((n) => (
                    <Bubble key={n.id} note={n} color={selColor} isMobile={isMobile}
                      onSave={(text) => patchProject({ notes: selected.notes.map((x) => (x.id === n.id ? { ...x, text } : x)) })}
                      onDelete={() => deleteNoteWithUndo(n)}
                      touchReorderStart={touchReorderStart}
                      dragProps={{
                        className: `${dragNoteId === n.id || touchDragId === n.id ? "dragging" : ""} ${dragOverNoteId === n.id ? "drag-over" : ""}`,
                        onDragStart: () => setDragNoteId(n.id),
                        onDragOver: (e) => { e.preventDefault(); setDragOverNoteId(n.id); },
                        onDrop: (e) => { e.preventDefault(); if (dragNoteId) patchProject({ notes: moveItem(selected.notes, dragNoteId, n.id) }); setDragNoteId(null); setDragOverNoteId(null); },
                        onDragEnd: () => { setDragNoteId(null); setDragOverNoteId(null); },
                      }} />
                  ))}
                </div>
              )}
              <div className="pd-saved">{savedFlash}</div>
              <div style={{ height: isMobile ? 24 : 0 }} />
            </>
          )}
        </div>
      </div>
            )}
          </div>
        </div>
      </div>

      {isMobile && (
        <nav className="pd-tabbar">
          {NAV_ITEMS.map((n) => (
            <button key={n.key} type="button" className={`pd-tabbar-btn ${screen === n.key ? "active" : ""}`} onClick={() => setScreen(n.key)}>
              <span className={`pd-navicon pd-navicon-${n.icon}`} />
              <span className="pd-tabbar-label">{n.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* undo toast */}
      {toast && (
        <div className="pd-toast" role="status"
          style={{ bottom: `calc(${kbInset + 24}px + max(0px, env(safe-area-inset-bottom)))` }}>
          <span>{toast.msg}</span>
          <button onClick={runUndo}>Undo</button>
        </div>
      )}

      {editingTask && (
        <TaskEditModal task={editingTask} onClose={() => setEditingTaskId(null)}
          onTitle={editTaskTitle} onDeadline={editTaskDeadline}
          onStartTime={editTaskStartTime} onEndTime={editTaskEndTime}
          onCyclePriority={() => cycleTaskPriority(editingTask.id)}
          onToggleRecurring={() => toggleTaskRecurring(editingTask.id)}
          onToggleDone={() => toggleTaskDone(editingTask.id)}
          onDelete={deleteEditingTask} />
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)}
        projects={projects} inbox={inbox}
        onNavigateScreen={(key) => setScreen(key)}
        onOpenProject={openProject}
        onOpenTask={(t) => setEditingTaskId(t.id)}
        onAddTask={(title) => addInboxTask(title)}
        onNewProject={startNewProject} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Login gate — email code typed in-app                                */
/* ------------------------------------------------------------------ */
const gateCss = `
.pd-gate{
  position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
  background:#050505; color:#F5F6F1; font-family:'Plus Jakarta Sans',system-ui,sans-serif; padding:24px;
  padding-top:max(24px, env(safe-area-inset-top)); -webkit-tap-highlight-color:transparent;
}
.pd-gate-card{width:100%; max-width:340px; text-align:center; box-sizing:border-box;}
.pd-gate-title{font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; font-size:36px; letter-spacing:-0.02em; margin-bottom:8px;}
.pd-gate-title span{color:#FF5A2E;}
.pd-gate-sub{color:#8B8E93; font-size:13px; margin-bottom:22px;}
.pd-gate-input{
  box-sizing:border-box; width:100%; padding:11px 14px; font-size:16px; border:1px solid #26282C; border-radius:14px;
  background:#1D1F22; color:#F5F6F1; margin-bottom:10px;
}
.pd-gate-input:focus{outline:none; border-color:#FF5A2E;}
.pd-gate-btn{
  box-sizing:border-box; width:100%; border:none; background:#FF5A2E; color:#0A0A0A; border-radius:14px; padding:12px 14px;
  font-size:14px; font-weight:700; cursor:pointer;
}
.pd-gate-btn:active{transform:scale(.98);}
.pd-gate-btn:disabled{opacity:.6; cursor:default;}
.pd-gate-msg{font-size:12px; color:#8B8E93; margin-top:14px; font-family:'IBM Plex Mono',monospace;}
.pd-gate-msg.err{color:#FF6B85;}
.pd-gate-link{background:none; border:none; color:#FF5A2E; cursor:pointer; font-family:inherit; font-size:inherit; text-decoration:underline; padding:0;}
.pd-gate-link:disabled{opacity:.5; cursor:default;}
`;

function LoginGate() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    if (!email.trim()) return;
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  };

  const verifyCode = async () => {
    if (!code.trim()) return;
    setBusy(true); setError("");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setError(error.message);
  };

  return (
    <div className="pd-gate">
      <style>{gateCss}</style>
      <div className="pd-gate-card">
        <div className="pd-gate-title">two::dew<span>.</span></div>
        <div className="pd-gate-sub">
          {sent
            ? "Enter the code from your email — right here in this window."
            : "Sign in with your email — no password needed."}
        </div>
        {!sent ? (
          <>
            <input className="pd-gate-input" type="email" enterKeyHint="send" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendCode(); }} />
            <button className="pd-gate-btn" onClick={sendCode} disabled={busy}>
              {busy ? "Sending…" : "Send sign-in code"}
            </button>
          </>
        ) : (
          <>
            <input className="pd-gate-input" type="text" inputMode="numeric" enterKeyHint="done" placeholder="123456" value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") verifyCode(); }} />
            <button className="pd-gate-btn" onClick={verifyCode} disabled={busy || code.trim().length < 4}>
              {busy ? "Verifying…" : "Verify & sign in"}
            </button>
          </>
        )}
        {error && <div className="pd-gate-msg err">{error}</div>}
        {sent && <div className="pd-gate-msg">Didn't get it? <button className="pd-gate-link" onClick={sendCode} disabled={busy}>Send a new code</button></div>}
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="pd-gate"><style>{gateCss}</style></div>;
  }
  if (!session) return <LoginGate />;
  return <AppShell userId={session.user.id} />;
}
