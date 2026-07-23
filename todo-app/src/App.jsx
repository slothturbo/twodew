import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { storage } from "./lib/storage";
import { mergeWorkspace } from "./lib/merge";
import { supabase } from "./supabaseClient";
import { css } from "./styles";
import { textToHtml, htmlToPlain, imageFileToDataURL, sanitizeHtml } from "./lib/html";
import { useIsMobile, useKeyboardInset, useGreeting } from "./lib/hooks";
import { Ring, ProgressFill } from "./components/Ring";
import { Bubble } from "./components/Bubble";
import { CommandPalette } from "./components/CommandPalette";
import { Sidebar } from "./components/Sidebar";
import { CaptureBar } from "./components/CaptureBar";
import { NoteToTaskModal } from "./components/NoteToTaskModal";
import { SyncStatus } from "./components/SyncStatus";
import { DeferMenu } from "./components/DeferMenu";
import { StatusPicker } from "./components/StatusPicker";
import { TodayScreen } from "./screens/Today";
import { CalendarScreen } from "./screens/Calendar";
import { BrainScreen } from "./screens/BrainScreen";
import { StatsScreen } from "./screens/Stats";
import {
  uid, pad, todayISO, localDateISO, colorOf, progressOf, dueLabel, fmtDate, nextDue, startedLabel,
  PRIORITY_CYCLE, PRIORITY_COLOR, liveTaskSeconds, formatDuration, currentStreak, weekBars, heatmapCells,
  parseQuickAdd, attentionSort, moveItem, moveBy, taskTimeRangeLabel, PALETTE, DOW, MONTHS,
  tomorrowISO, thisWeekendISO, nextWeekMondayISO, STATUS_LABEL, STATUS_COLOR,
  lastTouchedAt, relativeTimeLabel, isStale,
} from "./lib/helpers";
import { parseCapture } from "./lib/capture";

/* ------------------------------------------------------------------ */
/*  v8 — native-feel: fixed shell, swipes, undo, FAB, bottom sheet     */
/* ------------------------------------------------------------------ */
const STORAGE_KEY = "projects-data-v1";
// Same-device recovery cache — lets a reload/offline load recover an edit that was
// made but never confirmed written to Supabase (tab closed mid-save, network down).
const CACHE_KEY = "twodew-cache-v1";
function readCache(userId) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.userId !== userId) return null;
    return parsed; // { userId, blob, synced, cachedAt }
  } catch (e) { return null; }
}
function writeCache(userId, blob, synced) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, blob, synced, cachedAt: Date.now() })); } catch (e) { /* storage full/unavailable — cache is best-effort */ }
}
// A one-off snapshot taken right before a "Replace" import — separate from CACHE_KEY
// so an import undo can never be confused with the ordinary sync recovery copy.
const PRE_IMPORT_CACHE_KEY = "twodew-pre-import-snapshot";

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// Structural validation for an imported file — catches a corrupted/wrong-shaped file
// before anything derived from it touches app state. Not full schema validation of
// every field, just enough to refuse the shapes that would otherwise crash migrate().
function validateImportShape(parsed) {
  if (!isPlainObject(parsed)) return "That file doesn't look like a projects-export .json file.";
  for (const f of ["projects", "inbox", "notes", "templates"]) {
    if (parsed[f] !== undefined && !Array.isArray(parsed[f])) return `"${f}" should be a list in that file — it looks corrupted.`;
  }
  for (const f of ["completionLog", "focusLog"]) {
    if (parsed[f] !== undefined && !isPlainObject(parsed[f])) return `"${f}" should be a set of dates in that file — it looks corrupted.`;
  }
  for (const p of parsed.projects || []) {
    if (!isPlainObject(p) || typeof p.id !== "string" || typeof p.name !== "string") return "One of the projects in that file is missing required fields.";
  }
  for (const f of ["inbox", "notes", "templates"]) {
    for (const item of parsed[f] || []) {
      if (!isPlainObject(item) || typeof item.id !== "string") return `One of the items in "${f}" is missing an id.`;
    }
  }
  return null;
}
const OLD_HUES = ["#2E6BE6", "#0E8A7B", "#7A4FBF", "#C77D0A", "#C74A6B", "#3D7A2E"];
const INBOX_COLOR = { fg: "var(--muted)", bg: "rgba(140,150,163,0.12)" };
const NAV_ITEMS = [
  { key: "today", label: "Today", icon: "today" },
  { key: "tasks", label: "Tasks", icon: "tasks" },
  { key: "projects", label: "Projects", icon: "projects" },
  { key: "brain", label: "Brain", icon: "brain" },
  { key: "calendar", label: "Calendar", icon: "calendar" },
  { key: "stats", label: "Insights", icon: "stats" },
];
const SCREEN_TITLES = { today: "Today", tasks: "Tasks", brain: "Brain", projects: "Projects", calendar: "Calendar", stats: "Insights" };
// Seeded once (see migrateRoot below) — a project's own tasks/notes should feel
// deliberately minimal to start; a couple of built-in examples, not a library.
const DEFAULT_TEMPLATES = [
  {
    id: "tmpl-generic", name: "Generic project",
    tasks: [
      { title: "Kickoff call", priority: "med", recurring: false },
      { title: "Draft scope", priority: "high", recurring: false },
      { title: "Client review", priority: "med", recurring: false },
    ],
    notes: [],
  },
  {
    id: "tmpl-checkin", name: "Recurring check-in",
    tasks: [{ title: "Weekly status update", priority: "med", recurring: true }],
    notes: [],
  },
];
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
    estimateMinutes: null,
    contexts: [],
    sourceNoteId: null,
    isNextAction: false,
    plannedDate: null,
    ...t,
  };
}

function migrate(p, i) {
  const out = { ...p };
  if (typeof out.notes === "string") out.notes = out.notes.trim() ? [{ id: uid(), text: out.notes.trim() }] : [];
  if (!Array.isArray(out.notes)) out.notes = [];
  // Always run through sanitizeHtml as the final step, even for content that already
  // looks like HTML — that "already HTML" case used to skip sanitization entirely,
  // which is exactly the gap an imported/tampered note could exploit.
  out.notes = out.notes.map((n) => ({ ...n, text: sanitizeHtml(/<[a-z]/i.test(n.text) ? n.text : textToHtml(n.text)) }));
  if (!out.startDate) out.startDate = new Date(out.createdAt || Date.now()).toISOString().slice(0, 10);
  if (out.client === undefined) out.client = "";
  if (out.location === undefined) out.location = "";
  if (out.phase === undefined) out.phase = "";
  if (out.status === undefined) out.status = "active";
  if (out.outcome === undefined) out.outcome = "";
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
    // Standalone notes, not tied to any project — same {id, text} shape as project.notes,
    // and sanitized the same way (see migrate() above) for the same reason.
    notes: (data.notes || []).map((n) => ({ ...n, text: sanitizeHtml(/<[a-z]/i.test(n.text) ? n.text : textToHtml(n.text)) })),
    // Seeded only when the key has genuinely never been persisted (not merely empty),
    // so deleting every template doesn't resurrect the built-ins on the next load.
    templates: data.templates !== undefined ? data.templates : DEFAULT_TEMPLATES,
    completionLog: data.completionLog || {},
    focusLog: data.focusLog || {},
    lastResetDate: data.lastResetDate || todayISO(),
    runningTaskId: data.runningTaskId || null,
    runStart: data.runStart || null,
  };
}

// Normalizes a raw blob (Supabase's shape, or a persisted snapshot) into the same
// shape live app state is kept in — so a remote update can be compared/merged against
// current local state field-for-field. migrate()/migrateTask() are idempotent, so this
// is also safe to call on already-migrated data.
function toWorkspace(data) {
  const root = migrateRoot(data);
  return {
    projects: (data.projects || []).map(migrate),
    inbox: root.inbox,
    notes: root.notes,
    templates: root.templates,
    completionLog: root.completionLog,
    focusLog: root.focusLog,
    lastResetDate: root.lastResetDate,
    runningTaskId: root.runningTaskId,
    runStart: root.runStart,
    lastSelectedId: data.lastSelectedId || null,
  };
}


/* ------------------------------------------------------------------ */
/*  Custom themed date picker (viewport-clamped)                       */
/* ------------------------------------------------------------------ */
// Parses free-typed time text into "HH:MM" — accepts "8", "830", "8:3", "08:00", etc.
// A bare hour (no minute digits at all) is completed to :00, which is the whole point:
// native <input type="time"> can't tell JS "hour is set, minute isn't" (its .value stays
// empty until both segments are filled), so this reimplements the field as text instead.
function normalizeTimeInput(raw) {
  const cleaned = (raw || "").trim();
  if (!cleaned) return null;
  let h, m;
  if (cleaned.includes(":")) {
    const [hh, mm] = cleaned.split(":");
    h = parseInt(hh, 10);
    m = mm.trim() === "" ? 0 : parseInt(mm, 10);
  } else {
    const digits = cleaned.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length <= 2) { h = parseInt(digits, 10); m = 0; }
    else { h = parseInt(digits.slice(0, -2), 10); m = parseInt(digits.slice(-2), 10); }
  }
  if (Number.isNaN(h)) h = 0;
  if (Number.isNaN(m)) m = 0;
  h = Math.min(23, Math.max(0, h));
  m = Math.min(59, Math.max(0, m));
  return `${pad(h)}:${pad(m)}`;
}
// Default end time when only a start was given — treat it as a one-hour activity.
function addHour(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + 60) % (24 * 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// Free-typed "HH:MM" field — commits (normalizing partial input) on blur or Enter,
// rather than on every keystroke, so the user can type "8" and tab/click away or
// press Enter and have it become "08:00" instead of being rejected mid-edit.
function TimeField({ value, onCommit, onEnter, ariaLabel, placeholder }) {
  const [text, setText] = useState(value || "");
  useEffect(() => { setText(value || ""); }, [value]);
  const commit = () => {
    const normalized = normalizeTimeInput(text);
    setText(normalized || "");
    if (normalized !== value) onCommit(normalized);
    return normalized;
  };
  return (
    <input type="text" inputMode="numeric" className="pd-dp-time-input" aria-label={ariaLabel}
      placeholder={placeholder} value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); const n = commit(); onEnter?.(n); e.target.blur(); }
        else if (e.key === "Escape") { setText(value || ""); e.target.blur(); }
      }} />
  );
}

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
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="pd-dp-icon" aria-hidden="true">
          <rect x="2" y="3.5" width="12" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.3" />
          <line x1="2" y1="6.5" x2="14" y2="6.5" stroke="currentColor" strokeWidth="1.3" />
          <line x1="5.5" y1="1.5" x2="5.5" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="10.5" y1="1.5" x2="10.5" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {value ? fmtDate(value) : placeholder}{timeLabel ? ` · ${timeLabel}` : ""}
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
              <TimeField value={startTime} ariaLabel="Start time" placeholder="08:00"
                onCommit={(v) => onStartTime(v)}
                onEnter={(v) => { if (v && !endTime) onEndTime(addHour(v)); setOpen(false); }} />
              <span className="pd-dp-time-sep">–</span>
              <TimeField value={endTime} ariaLabel="End time" placeholder="09:00"
                onCommit={(v) => onEndTime(v)}
                onEnter={() => setOpen(false)} />
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
  onStartTime, onEndTime, onCyclePriority, onToggleRecurring, dragHandlers, reorderUp, reorderDown, canUp, canDown, touchReorderStart, dragClass, rkind = "task",
  running, liveSeconds, onToggleTrack, onToggleNextAction }) {
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
    <li className="pd-task-outer" data-rid={task.id} data-rkind={rkind}>
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
        <div className="pd-task-row1">
          {!completed ? (
            <>
              <span className="pd-drag-handle"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => { e.stopPropagation(); touchReorderStart?.(e, task.id, rkind); }}>⠿</span>
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
          {!completed && onToggleNextAction && (
            <button type="button" className={`pd-next-action-star ${task.isNextAction ? "on" : ""}`}
              title={task.isNextAction ? "Next action for this project (click to unmark)" : "Mark as this project's next action"}
              onClick={onToggleNextAction} aria-label={task.isNextAction ? "Unmark as next action" : "Mark as next action"}>★</button>
          )}
          <input className={`pd-task-title ${task.done ? "done" : ""}`} value={task.title}
            onChange={(e) => onTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.target.blur(); }} aria-label="Task title" />
          <button className="pd-x" aria-label="Delete task" onClick={onDelete}>×</button>
        </div>
        {(!completed || task.trackedSeconds > 0) && (
          <div className="pd-task-row2">
            {!running && task.trackedSeconds > 0 && (
              <span className="pd-task-tracked" title="Time tracked on this task">⏱ {formatDuration(task.trackedSeconds, false)}</span>
            )}
            {due && <span className={`pd-task-due ${due.overdue ? "overdue" : ""}`}>{due.text}</span>}
            {!completed && (
              <DatePicker value={task.deadline} onChange={onDeadline}
                startTime={task.startTime} endTime={task.endTime} onStartTime={onStartTime} onEndTime={onEndTime} />
            )}
            {!completed && onToggleRecurring && (
              <button type="button" className={`pd-recur-toggle ${task.recurring ? "on" : ""}`} title="Repeats daily"
                onClick={onToggleRecurring} aria-label={task.recurring ? "Stop repeating daily" : "Repeat daily"}>↻</button>
            )}
            {!completed && onToggleTrack && (
              <button type="button" className={`pd-track-pill ${running ? "running" : ""}`} onClick={onToggleTrack}
                aria-label={running ? "Stop tracking time" : "Start tracking time"}>
                <span>{running ? "❙❙" : "▶"}</span>
                {formatDuration(liveSeconds, running) && <span>{formatDuration(liveSeconds, running)}</span>}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Focus-mode banner — sticky above the topbar on every screen while a  */
/*  task is being tracked, so it's never unclear focus mode is running.  */
/* ------------------------------------------------------------------ */
function FocusBanner({ task, projectName, seconds, onStop, onOpen }) {
  return (
    <div className="pd-focus-banner" role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}>
      <span className="pd-focus-dot" />
      <span className="pd-focus-label">Focusing on</span>
      <span className="pd-focus-title">{task.title}</span>
      {projectName && <span className="pd-focus-project">· {projectName}</span>}
      <span className="pd-focus-time">{formatDuration(seconds, true)}</span>
      <button type="button" className="pd-focus-stop"
        onClick={(e) => { e.stopPropagation(); onStop(); }} aria-label="Stop tracking">
        <span>❙❙</span> Stop
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single-task editor — for inbox tasks reached from the Calendar,     */
/*  which have no project page of their own to land on.                 */
/* ------------------------------------------------------------------ */
function TaskEditModal({ task, onClose, onTitle, onDeadline, onStartTime, onEndTime, onPlannedDate, onCyclePriority, onToggleRecurring, onToggleDone, onDelete, onOpenDefer, onOpenSourceNote }) {
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
            {/* startTime/endTime belong to whichever of plannedDate/deadline is set — once a
                planned session exists, its picker owns the time fields instead of the
                deadline picker, so the two controls never fight over the same value. */}
            <DatePicker value={task.deadline} onChange={onDeadline} placeholder="Set due date"
              startTime={task.plannedDate ? null : task.startTime} endTime={task.plannedDate ? null : task.endTime}
              onStartTime={task.plannedDate ? undefined : onStartTime} onEndTime={task.plannedDate ? undefined : onEndTime} />
            <button type="button" className={`pd-recur-toggle ${task.recurring ? "on" : ""}`} style={{ opacity: 1 }}
              onClick={onToggleRecurring} title="Repeats daily">
              ↻ {task.recurring ? "Repeats daily" : "One-time"}
            </button>
          </div>
          <div className="pd-form-row">
            <div className="pd-form-label" style={{ width: "100%" }}>Plan a work session</div>
            <DatePicker value={task.plannedDate} onChange={onPlannedDate} placeholder="Not scheduled"
              startTime={task.startTime} endTime={task.endTime} onStartTime={onStartTime} onEndTime={onEndTime} />
          </div>
          <div className="pd-form-row">
            {!task.recurring && (
              <button type="button" className="pd-nextup-btn" onClick={(e) => onOpenDefer(e.currentTarget)}>defer</button>
            )}
            {task.sourceNoteId && (
              <button type="button" className="pd-nextup-btn ghost" onClick={onOpenSourceNote}>↳ view source note</button>
            )}
            <button type="button" className="pd-danger-btn pd-press" onClick={onDelete}>delete task</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ESTIMATE_PRESETS = [15, 30, 60, 120];

/* ------------------------------------------------------------------ */
/*  Inbox review — one item at a time, quick actions, keyboard-first.  */
/*  Lives inline (not a separate component file) because it reuses    */
/*  DatePicker, which is itself local to this file.                   */
/* ------------------------------------------------------------------ */
function InboxReview({
  tasks, projects, onAssignProject, onSetDeadline, onSetStartTime, onSetEndTime,
  onSetPriority, onSetEstimate, onConvertToNote, onDelete, onClose,
}) {
  const [ids] = useState(() => tasks.map((t) => t.id));
  const [idx, setIdx] = useState(0);
  const [clarifiedCount, setClarifiedCount] = useState(0);
  const total = ids.length;

  const currentId = ids[idx];
  const current = tasks.find((t) => t.id === currentId);

  const advance = (wasClarified) => {
    if (wasClarified) setClarifiedCount((c) => c + 1);
    if (idx + 1 >= total) onClose();
    else setIdx((i) => i + 1);
  };

  // A task can vanish out from under us (deleted/converted elsewhere, e.g. a synced
  // second device) — skip past a missing id rather than getting stuck.
  useEffect(() => {
    if (!current && idx < total) {
      if (idx + 1 >= total) onClose();
      else setIdx((i) => i + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, idx]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); advance(false); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      else if (e.key === "1") { onSetPriority(currentId, "low"); advance(true); }
      else if (e.key === "2") { onSetPriority(currentId, "med"); advance(true); }
      else if (e.key === "3") { onSetPriority(currentId, "high"); advance(true); }
      else if (e.key === "Backspace") { e.preventDefault(); onDelete(current); advance(true); }
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, current, idx]);

  if (!current) return null;

  return (
    <div className="pd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pd-panel pd-review-panel" role="dialog" aria-modal="true" aria-label="Inbox review">
        <div className="pd-panel-header">
          <div className="pd-review-progress">{clarifiedCount} of {total} clarified</div>
          <div className="pd-panel-actions">
            <button type="button" onClick={onClose} title="Close (Esc)">✕</button>
          </div>
        </div>
        <div className="pd-panel-body pd-review-body">
          <div className="pd-review-title">{current.title}</div>

          <div className="pd-review-section">
            <div className="pd-review-label">Project</div>
            <div className="pd-review-chiprow">
              <button type="button" className="pd-review-chip" onClick={() => advance(false)}>keep in inbox</button>
              {projects.map((p) => (
                <button type="button" key={p.id} className="pd-review-chip"
                  onClick={() => { onAssignProject(current.id, p.id); advance(true); }}>{p.name}</button>
              ))}
            </div>
          </div>

          <div className="pd-review-section">
            <div className="pd-review-label">Date</div>
            <DatePicker value={current.deadline} onChange={(iso) => onSetDeadline(current.id, iso)}
              startTime={current.startTime} endTime={current.endTime}
              onStartTime={(v) => onSetStartTime(current.id, v)} onEndTime={(v) => onSetEndTime(current.id, v)} />
          </div>

          <div className="pd-review-section">
            <div className="pd-review-label">Priority (1 low · 2 med · 3 high)</div>
            <button type="button" className="pd-priority-dot" style={{ background: PRIORITY_COLOR[current.priority || "med"] }}
              title={`Priority: ${current.priority || "med"} (click to cycle)`}
              onClick={() => onSetPriority(current.id, PRIORITY_CYCLE[current.priority] || "med")} />
          </div>

          <div className="pd-review-section">
            <div className="pd-review-label">Estimate</div>
            <div className="pd-review-chiprow">
              {ESTIMATE_PRESETS.map((m) => (
                <button type="button" key={m} className="pd-review-chip"
                  onClick={() => { onSetEstimate(current.id, m); advance(true); }}>
                  {m >= 60 ? `${m / 60}h` : `${m}m`}
                </button>
              ))}
            </div>
          </div>

          <div className="pd-review-actions">
            <button type="button" className="pd-nextup-btn ghost" onClick={() => { onConvertToNote(current); advance(true); }}>convert to note</button>
            <button type="button" className="pd-danger-btn pd-press" onClick={() => { onDelete(current); advance(true); }}>delete</button>
            <button type="button" className="pd-nextup-btn" onClick={() => advance(false)}>next →</button>
          </div>
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
  const [newProjTemplateId, setNewProjTemplateId] = useState(null);
  const [taskInput, setTaskInput] = useState("");
  const [noiseInput, setNoiseInput] = useState("");
  const [syncState, setSyncState] = useState("saved"); // 'saving' | 'saved' | 'offline' | 'conflict'
  const [syncNote, setSyncNote] = useState("");
  const [syncConflicts, setSyncConflicts] = useState([]);
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null); // { x, y } — status popover on the project detail header
  const [savingTemplateName, setSavingTemplateName] = useState(null); // draft text while the "save as template" input is open, null when closed
  const [pendingImport, setPendingImport] = useState(null);
  const [importNote, setImportNote] = useState("");
  const [toast, setToast] = useState(null);
  const [dragTaskId, setDragTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [dragInboxTaskId, setDragInboxTaskId] = useState(null);
  const [dragOverInboxTaskId, setDragOverInboxTaskId] = useState(null);
  const [dragNoteId, setDragNoteId] = useState(null);
  const [dragOverNoteId, setDragOverNoteId] = useState(null);
  const [touchDragId, setTouchDragId] = useState(null);

  // ---- redesign: project-less inbox, completion/focus history, recurring reset, time tracking ----
  const [inbox, setInbox] = useState([]);
  const [notes, setNotes] = useState([]); // standalone notes (Brain screen), parallel to inbox
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES); // project templates, seeded via migrateRoot on load
  const [completionLog, setCompletionLog] = useState({});
  const [focusLog, setFocusLog] = useState({});
  const [lastResetDate, setLastResetDate] = useState(null);
  const [runningTaskId, setRunningTaskId] = useState(null);
  const [runStart, setRunStart] = useState(null);
  const [tick, setTick] = useState(0); // forces re-render for live elapsed-time display only
  const [screen, setScreen] = useState("today"); // "today" | "projects" | "calendar" | "stats" — never persisted
  const [brainInput, setBrainInput] = useState(""); // top-bar note capture (Brain screen)
  const [editingTaskId, setEditingTaskId] = useState(null); // inbox task open in the single-task editor
  const [deferMenuAnchor, setDeferMenuAnchor] = useState(null); // { x, y } — defer popover opened from the task editor
  const [paletteOpen, setPaletteOpen] = useState(false); // command palette (Cmd/Ctrl+K)
  const [reviewOpen, setReviewOpen] = useState(false); // Inbox review modal
  const [noteToTask, setNoteToTask] = useState(null); // { note, prefillTitle } — "Create task" dialog from a Brain note
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
  const toastTimer = useRef(null);
  const importFileRef = useRef(null);
  const searchRef = useRef(null);
  const quickAddRef = useRef(null);
  const selectedIdRef = useRef(null);
  const touchDrag = useRef(null);
  const tickTimer = useRef(null);
  const lastWrittenAtRef = useRef(null);
  const pendingWriteRef = useRef(false);
  // Workspace shape as of the last point local and the server were known to agree —
  // the 3-way merge base. Updated only at sync boundaries (see applyData/attemptWrite),
  // never mid-edit.
  const syncBaseRef = useRef(null);
  const syncConflictsRef = useRef([]); syncConflictsRef.current = syncConflicts;
  selectedIdRef.current = selectedId;
  // True while a modal that owns its own keyboard scheme is open (Inbox review, the
  // single-task editor) — guards the global shortcut listener below from leaking `/`,
  // `n`, and arrow-key handling through to the Projects screen behind the modal.
  const modalOpenRef = useRef(false);
  modalOpenRef.current = reviewOpen || !!editingTaskId || !!noteToTask;

  // Mirror the redesign's root-level state into refs so the debounced persist() below
  // can always read the latest values, no matter which piece of state triggered the save.
  const projectsRef = useRef(projects); projectsRef.current = projects;
  const inboxRef = useRef(inbox); inboxRef.current = inbox;
  const notesRef = useRef(notes); notesRef.current = notes;
  const templatesRef = useRef(templates); templatesRef.current = templates;
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
    setTemplates(root.templates); templatesRef.current = root.templates;
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
    // Local now matches `data` exactly — this is a fresh sync boundary.
    syncBaseRef.current = toWorkspace(data);
  }, []);

  /* ---- debounced save (whole root blob: projects, inbox, logs, timer, last selected) ----
     Defined before the load effect below so a recovered-but-unsynced cache can call it
     directly to push itself back to the server.
     `attemptWrite` always sends whatever's in `pendingBlobRef` — not a value captured at
     call time — so the 20s offline retry loop and the `online` listener both naturally
     pick up further edits made while still offline, instead of replaying a stale blob. */
  const pendingBlobRef = useRef(null);
  const offlineRetryTimer = useRef(null);

  const attemptWrite = useCallback(async () => {
    const blob = pendingBlobRef.current;
    if (!blob) return;
    try {
      const res = await storage.set(STORAGE_KEY, blob);
      if (res?.updatedAt) lastWrittenAtRef.current = res.updatedAt;
      writeCache(userId, blob, true);
      setSyncNote(blob.length > 2_500_000 ? "data is getting large — consider removing old brain entries" : "");
      setSyncState("saved");
      pendingWriteRef.current = false;
      pendingBlobRef.current = null;
      // Server now matches what we just sent — fresh sync boundary for the merge base.
      syncBaseRef.current = JSON.parse(blob);
      if (offlineRetryTimer.current) { clearInterval(offlineRetryTimer.current); offlineRetryTimer.current = null; }
    } catch (e) {
      setSyncState("offline");
      // pendingWriteRef/pendingBlobRef deliberately stay set — there's still an
      // unconfirmed write outstanding. Poll in case the browser's `online` event
      // doesn't fire reliably (true on some mobile browsers behind captive portals).
      if (!offlineRetryTimer.current) offlineRetryTimer.current = setInterval(attemptWrite, 20000);
    }
  }, [userId]);

  useEffect(() => {
    window.addEventListener("online", attemptWrite);
    return () => { window.removeEventListener("online", attemptWrite); clearInterval(offlineRetryTimer.current); };
  }, [attemptWrite]);

  // The "local" side of a merge, and what persist() below serializes — refs, so it's
  // always the latest values regardless of which piece of state triggered the save.
  const buildSnapshot = useCallback(() => ({
    projects: projectsRef.current,
    inbox: inboxRef.current,
    notes: notesRef.current,
    templates: templatesRef.current,
    completionLog: completionLogRef.current,
    focusLog: focusLogRef.current,
    lastResetDate: lastResetDateRef.current,
    runningTaskId: runningTaskIdRef.current,
    runStart: runStartRef.current,
    lastSelectedId: selectedIdRef.current,
  }), []);

  const persist = useCallback(() => {
    clearTimeout(saveTimer.current);
    // Marked immediately (not just once the timeout fires) so a realtime event landing
    // anywhere in the debounce window — before this change has actually reached the DB —
    // can't overwrite it via applyData() and get silently persisted over on the next save.
    pendingWriteRef.current = true;
    setSyncState("saving");
    saveTimer.current = setTimeout(() => {
      const blob = JSON.stringify(buildSnapshot());
      pendingBlobRef.current = blob;
      // Written before the network call, not after — so a tab close/crash mid-save still
      // leaves a same-device recovery copy on disk, marked unsynced until it's confirmed.
      writeCache(userId, blob, false);
      attemptWrite();
    }, 500);
  }, [userId, attemptWrite, buildSnapshot]);

  /* ---- load ---- */
  useEffect(() => {
    (async () => {
      let usedCache = false;
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) {
          applyData(JSON.parse(res.value), { restoreSelection: true });
        } else {
          const today = todayISO();
          setLastResetDate(today); lastResetDateRef.current = today;
        }
      } catch (e) {
        // A real request failure (offline, Supabase unreachable) — not "no data yet",
        // storage.get() only returns null for that case. Fall back to this device's
        // own last-known copy instead of rendering an empty workspace.
        const cached = readCache(userId);
        if (cached) { applyData(JSON.parse(cached.blob), { restoreSelection: true }); usedCache = true; }
        setSyncState("offline");
      }
      // Whether or not the server load succeeded, check for an edit from a previous
      // session that never got confirmed written (closed the tab mid-save) — the cache
      // is written before the network call in persist(), so this is how it survives.
      if (!usedCache) {
        const cached = readCache(userId);
        if (cached && !cached.synced) {
          applyData(JSON.parse(cached.blob), { restoreSelection: true });
          persist();
        }
      }
      setLoaded(true);
    })();
    return () => clearInterval(tickTimer.current);
  }, [applyData, persist, userId]);

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
          // Skip our own write echoing back (compare numerically — Postgres may
          // reformat the timestamp string even though it's the same instant).
          if (lastWrittenAtRef.current && new Date(row.updated_at).getTime() <= new Date(lastWrittenAtRef.current).getTime()) return;

          if (pendingWriteRef.current) {
            // A local write hasn't reached the DB yet. Merge the incoming remote
            // change against the last known-agreed base instead of dropping it —
            // otherwise the pending local write would land moments later and
            // silently overwrite whatever this other device just did.
            const base = syncBaseRef.current || buildSnapshot();
            const { merged, conflicts } = mergeWorkspace(base, buildSnapshot(), toWorkspace(row.value));
            applyData(merged);
            if (conflicts.length) {
              setSyncConflicts((cs) => {
                const byKey = new Map(cs.map((c) => [`${c.type}:${c.id}`, c]));
                for (const c of conflicts) byKey.set(`${c.type}:${c.id}`, c);
                return [...byKey.values()];
              });
              setSyncState("conflict");
            }
            persist(); // push the merged result so both devices converge
            return;
          }

          applyData(row.value);
          setSyncState(syncConflictsRef.current.length ? "conflict" : "saved");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loaded, userId, applyData, buildSnapshot, persist]);

  const update = useCallback((fn) => {
    setProjects((prev) => { const next = fn(prev); projectsRef.current = next; persist(); return next; });
  }, [persist]);

  const updateInbox = useCallback((fn) => {
    setInbox((prev) => { const next = fn(prev); inboxRef.current = next; persist(); return next; });
  }, [persist]);

  const updateNotes = useCallback((fn) => {
    setNotes((prev) => { const next = fn(prev); notesRef.current = next; persist(); return next; });
  }, [persist]);

  const updateTemplates = useCallback((fn) => {
    setTemplates((prev) => { const next = fn(prev); templatesRef.current = next; persist(); return next; });
  }, [persist]);

  // Captures a project's current open task titles/priority/recurring + plain-text notes
  // into a new reusable template — never touches the source project.
  const saveProjectAsTemplate = (project, name) => {
    const clean = name.trim();
    if (!clean) return;
    const template = {
      id: uid(), name: clean,
      tasks: project.tasks.filter((t) => !t.done).map((t) => ({ title: t.title, priority: t.priority, recurring: t.recurring })),
      notes: project.notes.map((n) => htmlToPlain(n.text)).filter(Boolean),
    };
    updateTemplates((ts) => [...ts, template]);
  };
  const deleteTemplate = (id) => updateTemplates((ts) => ts.filter((t) => t.id !== id));

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
    // Read the task's *current* state directly from the refs — not from inside the
    // locateAndPatchTask callback below. That callback runs as a React state-updater
    // function, which isn't guaranteed to execute synchronously; reading logDelta right
    // after calling locateAndPatchTask was landing before the updater had actually run,
    // so bumpCompletionLog fired with a stale/null delta and the Insights counters never
    // moved even though the task's own done flag updated fine on the next render.
    const current = inboxRef.current.find((t) => t.id === taskId)
      || projectsRef.current.flatMap((p) => p.tasks).find((t) => t.id === taskId);
    if (!current) return;
    const today = todayISO();
    const logDelta = !current.done
      ? { day: today, delta: 1 }
      : { day: current.completedAt ? localDateISO(current.completedAt) : today, delta: -1 };
    locateAndPatchTask(taskId, (t) => (
      !t.done ? { ...t, done: true, completedAt: Date.now() } : { ...t, done: false, completedAt: null }
    ));
    bumpCompletionLog(logDelta.day, logDelta.delta);
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

  // The task/project currently being tracked, for the sticky focus banner — recomputed
  // every render so it stays in sync with `tick`'s once-a-second re-render.
  const runningProject = runningTaskId ? projects.find((p) => p.tasks.some((t) => t.id === runningTaskId)) : null;
  const runningTask = runningTaskId
    ? (runningProject ? runningProject.tasks.find((t) => t.id === runningTaskId) : inbox.find((t) => t.id === runningTaskId))
    : null;
  // Command palette "New project" quick action: prefill the Projects screen's creation form and open it.
  const startNewProject = useCallback((name) => {
    setScreen("projects"); setSelectedId(null);
    setNewProj({ name, client: "", location: "", startDate: todayISO() });
    setAdding(true);
  }, []);

  // Single-task editor (Calendar chip click on a project-less task, or the Today screen's
  // long-press "Edit" — a task can live in the inbox or any project, so lookups/patches go
  // through locateAndPatchTask rather than assuming inbox-only).
  const editingTask = inbox.find((t) => t.id === editingTaskId)
    || projects.flatMap((p) => p.tasks).find((t) => t.id === editingTaskId)
    || null;
  const editTaskTitle = useCallback((title) => {
    locateAndPatchTask(editingTaskId, (t) => ({ ...t, title }));
  }, [locateAndPatchTask, editingTaskId]);
  const editTaskDeadline = useCallback((iso) => {
    locateAndPatchTask(editingTaskId, (t) => ({ ...t, deadline: iso }));
  }, [locateAndPatchTask, editingTaskId]);
  const editTaskStartTime = useCallback((v) => {
    locateAndPatchTask(editingTaskId, (t) => ({ ...t, startTime: v }));
  }, [locateAndPatchTask, editingTaskId]);
  const editTaskEndTime = useCallback((v) => {
    locateAndPatchTask(editingTaskId, (t) => ({ ...t, endTime: v }));
  }, [locateAndPatchTask, editingTaskId]);
  const editTaskPlannedDate = useCallback((iso) => {
    locateAndPatchTask(editingTaskId, (t) => ({ ...t, plannedDate: iso }));
  }, [locateAndPatchTask, editingTaskId]);
  const deleteEditingTask = useCallback(() => {
    const task = inbox.find((t) => t.id === editingTaskId)
      || projects.flatMap((p) => p.tasks).find((t) => t.id === editingTaskId);
    if (task) deleteAnyTaskWithUndo(task);
    setEditingTaskId(null);
  }, [inbox, projects, editingTaskId]);

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
  // Archived projects stay out of the way by default (keeps the list focused on live
  // work without deleting anything) but a search still reaches them — hiding a project
  // you're actively searching for would be more confusing than helpful.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return showArchived ? sorted : sorted.filter((p) => p.status !== "archived");
    return sorted.filter((p) =>
      [p.name, p.client, p.location, p.phase, p.outcome].some((s) => (s || "").toLowerCase().includes(q)) ||
      p.tasks.some((t) => t.title.toLowerCase().includes(q)) ||
      p.notes.some((n) => htmlToPlain(n.text).toLowerCase().includes(q))
    );
  }, [sorted, query, showArchived]);
  const archivedCount = useMemo(() => projects.filter((p) => p.status === "archived").length, [projects]);
  const selected = projects.find((p) => p.id === selectedId) || null;
  // Includes inbox (standalone) tasks — not just project tasks — so "overall" reflects
  // everything checked off, including tasks added straight from the Today homepage.
  const allTasks = [...projects.flatMap((p) => p.tasks), ...inbox];
  const overallPct = allTasks.length ? Math.round((allTasks.filter((t) => t.done).length / allTasks.length) * 100) : 0;

  /* ---- actions ---- */
  const addProject = () => {
    const name = newProj.name.trim();
    if (!name) return;
    const template = templates.find((t) => t.id === newProjTemplateId);
    const proj = {
      id: uid(), name, client: newProj.client.trim(), location: newProj.location.trim(), phase: "",
      status: "active", outcome: "",
      startDate: newProj.startDate || todayISO(), colorIdx: projects.length % PALETTE.length,
      createdAt: Date.now(),
      tasks: (template?.tasks || []).map((t) => migrateTask({ id: uid(), title: t.title, priority: t.priority || "med", recurring: !!t.recurring, done: false, deadline: todayISO(), createdAt: Date.now() })),
      notes: (template?.notes || []).map((text) => ({ id: uid(), text: textToHtml(text), createdAt: Date.now() })),
    };
    update((prev) => [...prev, proj]);
    setSelectedId(proj.id); setAdding(false);
    setNewProj({ name: "", client: "", location: "", startDate: todayISO() });
    setNewProjTemplateId(null);
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
  const deleteInboxTaskWithUndo = (task) => {
    const idx = inbox.findIndex((t) => t.id === task.id);
    updateInbox((ts) => ts.filter((x) => x.id !== task.id));
    showUndo("Task deleted", () => updateInbox((ts) => {
      const next = [...ts]; next.splice(Math.min(idx, next.length), 0, task);
      return next;
    }));
  };
  // Generalized delete for a task that could live in the inbox or any project — needed by
  // the Today screen, which aggregates both and doesn't have a "selected" project in scope.
  const deleteAnyTaskWithUndo = (task) => {
    if (inboxRef.current.some((t) => t.id === task.id)) {
      deleteInboxTaskWithUndo(task);
      return;
    }
    const proj = projectsRef.current.find((p) => p.tasks.some((t) => t.id === task.id));
    if (!proj) return;
    const idx = proj.tasks.findIndex((t) => t.id === task.id);
    update((prev) => prev.map((p) => (p.id === proj.id ? { ...p, tasks: p.tasks.filter((t) => t.id !== task.id) } : p)));
    showUndo("Task deleted", () => update((prev) => prev.map((p) => {
      if (p.id !== proj.id) return p;
      const ts = [...p.tasks]; ts.splice(Math.min(idx, ts.length), 0, task);
      return { ...p, tasks: ts };
    })));
  };
  // Sync-conflict recovery: "keep mine" is the default (a no-op — local already won
  // the merge), "use theirs" applies the other device's version of that one item.
  const resolveConflict = (conflict, choice) => {
    if (choice === "remote") {
      if (conflict.type === "task") {
        if (conflict.remote) {
          locateAndPatchTask(conflict.id, () => conflict.remote);
        } else {
          const found = inboxRef.current.find((t) => t.id === conflict.id)
            || projectsRef.current.flatMap((p) => p.tasks).find((t) => t.id === conflict.id);
          if (found) deleteAnyTaskWithUndo(found);
        }
      } else if (conflict.type === "project") {
        if (conflict.remote) update((prev) => prev.map((p) => (p.id === conflict.id ? { ...p, ...conflict.remote } : p)));
        else update((prev) => prev.filter((p) => p.id !== conflict.id));
      } else if (conflict.type === "note") {
        const patchNotes = (ns) => (conflict.remote
          ? (ns.some((n) => n.id === conflict.id) ? ns.map((n) => (n.id === conflict.id ? conflict.remote : n)) : ns)
          : ns.filter((n) => n.id !== conflict.id));
        updateNotes(patchNotes);
        update((prev) => prev.map((p) => ({ ...p, notes: patchNotes(p.notes) })));
      }
    }
    setSyncConflicts((cs) => cs.filter((x) => !(x.type === conflict.type && x.id === conflict.id)));
  };

  // Moves a task to a different project, or (targetProjectId === null) back to the
  // inbox — removes it from wherever it currently lives and appends it at the target.
  // Shared by the Next Up card's "move to project" control and defer's "return to
  // Inbox" destination.
  const moveTaskToProject = (taskId, targetProjectId) => {
    const fromInbox = inboxRef.current.find((t) => t.id === taskId);
    const fromProject = projectsRef.current.find((p) => p.tasks.some((t) => t.id === taskId));
    const task = fromInbox || fromProject?.tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (fromProject?.id === targetProjectId) return; // already there
    if (fromInbox && !targetProjectId) return; // already in the inbox

    if (fromInbox) updateInbox((ts) => ts.filter((t) => t.id !== taskId));
    else update((prev) => prev.map((p) => (p.id === fromProject.id ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p)));

    if (targetProjectId) update((prev) => prev.map((p) => (p.id === targetProjectId ? { ...p, tasks: [...p.tasks, task] } : p)));
    else updateInbox((ts) => [...ts, task]);
  };

  // Marks a task as its project's next action, clearing the flag on every other task in
  // that project in the same update — enforces "one per project" atomically. Only
  // meaningful for project tasks (the inbox has no project to have a next action for).
  const setNextAction = (projectId, taskId) => {
    update((prev) => prev.map((p) => (
      p.id === projectId
        ? { ...p, tasks: p.tasks.map((t) => ({ ...t, isNextAction: t.id === taskId ? !t.isNextAction : false })) }
        : p
    )));
  };

  // Creates a brand-new task directly in an arbitrary project (or the inbox, when
  // targetProjectId is null) — neither addInboxTask nor addTaskTitled can target an
  // arbitrary project, since each is hardcoded to one destination. Shared by quick-capture,
  // Inbox review's "assign project" action, and Brain note→task conversion.
  const createTaskInTarget = (fields, targetProjectId) => {
    const task = migrateTask({ id: uid(), done: false, createdAt: Date.now(), ...fields });
    if (targetProjectId) update((prev) => prev.map((p) => (p.id === targetProjectId ? { ...p, tasks: [...p.tasks, task] } : p)));
    else updateInbox((ts) => [...ts, task]);
    return task;
  };
  // Same idea for notes — used by quick-capture's note mode and Inbox review's
  // "convert to note" action, both of which can target either a project or standalone.
  const createNoteInTarget = (text, targetProjectId) => {
    const note = { id: uid(), text: textToHtml(text), createdAt: Date.now() };
    if (targetProjectId) update((prev) => prev.map((p) => (p.id === targetProjectId ? { ...p, notes: [...p.notes, note] } : p)));
    else updateNotes((ns) => [...ns, note]);
    return note;
  };
  // The topbar CaptureBar's two commit paths — undated captures default to today,
  // matching addInboxTask/addTaskTitled's existing behavior for a bare title.
  const commitCapturedTask = (parsed) => {
    createTaskInTarget({
      title: parsed.title, deadline: parsed.deadline || todayISO(), startTime: parsed.startTime,
      timeLabel: parsed.timeLabel, priority: parsed.priority, estimateMinutes: parsed.estimateMinutes,
      contexts: parsed.contexts,
    }, parsed.projectId);
  };
  const commitCapturedNote = (title, projectId) => createNoteInTarget(title, projectId);
  // Brain note -> task conversion (NoteToTaskModal). `titles` is one entry unless the
  // "extract checklist lines" option produced more — each becomes its own task, all
  // linked back to the source note via sourceNoteId. The note itself is never touched.
  const createTasksFromNote = (titles, targetProjectId, sourceNoteId) => {
    for (const title of titles) createTaskInTarget({ title, sourceNoteId }, targetProjectId);
  };
  // Inbox review's "convert to note" — a dedicated undo (rather than reusing
  // deleteInboxTaskWithUndo) so the toast message and restore both make sense for a
  // conversion rather than a plain delete.
  const convertInboxTaskToNote = (task) => {
    const idx = inboxRef.current.findIndex((t) => t.id === task.id);
    const note = createNoteInTarget(task.title, null);
    updateInbox((ts) => ts.filter((t) => t.id !== task.id));
    showUndo("Converted to note", () => {
      updateNotes((ns) => ns.filter((n) => n.id !== note.id));
      updateInbox((ts) => {
        const next = [...ts]; next.splice(Math.min(idx, next.length), 0, task); return next;
      });
    });
  };

  // Fast defer/snooze — every destination captures the task's prior date/time (and
  // project, for "return to Inbox") before mutating, then offers the same undo-toast
  // pattern as deleteAnyTaskWithUndo above. Not offered in the UI for recurring tasks:
  // computeTodayView shows a recurring task regardless of `deadline`, so changing that
  // field has no effect on when it reappears — there's nothing sensible for "defer" to do.
  const deferTask = (taskId, destination) => {
    const found = inboxRef.current.find((t) => t.id === taskId)
      || projectsRef.current.flatMap((p) => p.tasks).find((t) => t.id === taskId);
    if (!found) return;
    const prior = { deadline: found.deadline, startTime: found.startTime, endTime: found.endTime };
    const priorProjectId = projectsRef.current.find((p) => p.tasks.some((t) => t.id === taskId))?.id || null;
    const restore = () => {
      locateAndPatchTask(taskId, (t) => ({ ...t, deadline: prior.deadline, startTime: prior.startTime, endTime: prior.endTime }));
      if (destination === "inbox" && priorProjectId) moveTaskToProject(taskId, priorProjectId);
    };

    let label;
    if (destination === "later") {
      locateAndPatchTask(taskId, (t) => ({ ...t, deadline: todayISO(), startTime: null, endTime: null }));
      label = "deferred to later today";
    } else if (destination === "tomorrow") {
      locateAndPatchTask(taskId, (t) => ({ ...t, deadline: tomorrowISO() }));
      label = "deferred to tomorrow";
    } else if (destination === "weekend") {
      locateAndPatchTask(taskId, (t) => ({ ...t, deadline: thisWeekendISO() }));
      label = "deferred to this weekend";
    } else if (destination === "nextweek") {
      locateAndPatchTask(taskId, (t) => ({ ...t, deadline: nextWeekMondayISO() }));
      label = "deferred to next week";
    } else if (destination === "inbox") {
      locateAndPatchTask(taskId, (t) => ({ ...t, deadline: null, startTime: null, endTime: null }));
      moveTaskToProject(taskId, null);
      label = "moved to inbox";
    } else {
      return; // "date" is handled by opening the DatePicker directly, not through here
    }
    showUndo(label, restore);
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
    // A complete backup: every persisted field except the running-timer state, which
    // is deliberately left out — resuming a stale timer from an old backup would be
    // actively wrong, not useful, if it were ever restored hours or days later.
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      projects, inbox, notes, templates, completionLog, focusLog, lastResetDate,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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
      const shapeError = validateImportShape(parsed);
      if (shapeError) { setImportNote(shapeError); return; }
      const incoming = {
        projects: (parsed.projects || []).map(migrate),
        inbox: (parsed.inbox || []).map(migrateTask),
        notes: (parsed.notes || []).map((n) => ({ ...n, text: sanitizeHtml(/<[a-z]/i.test(n.text) ? n.text : textToHtml(n.text)) })),
        templates: parsed.templates || [],
        completionLog: parsed.completionLog || {},
        focusLog: parsed.focusLog || {},
        lastResetDate: typeof parsed.lastResetDate === "string" ? parsed.lastResetDate : null,
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
    if (!pendingImport) return;
    // A recovery snapshot of what's about to be replaced — both a durable copy (in case
    // the tab closes before the undo toast is used) and the value the toast's undo
    // button applies directly, so undoing doesn't require a reload.
    const preSnapshot = buildSnapshot();
    try { localStorage.setItem(PRE_IMPORT_CACHE_KEY, JSON.stringify({ userId, snapshot: preSnapshot, savedAt: Date.now() })); } catch (e) { /* best-effort */ }

    const n = pendingImport.projects.length;
    update(() => pendingImport.projects);
    updateInbox(() => pendingImport.inbox);
    updateNotes(() => pendingImport.notes);
    // Only replace templates when the file actually has some — an export from before
    // this field existed has none, and silently wiping the current templates on a
    // "Replace" from an old backup would be exactly the kind of silent data loss to avoid.
    if (pendingImport.templates.length) updateTemplates(() => pendingImport.templates);
    setCompletionLog(pendingImport.completionLog); completionLogRef.current = pendingImport.completionLog;
    setFocusLog(pendingImport.focusLog); focusLogRef.current = pendingImport.focusLog;
    if (pendingImport.lastResetDate) { setLastResetDate(pendingImport.lastResetDate); lastResetDateRef.current = pendingImport.lastResetDate; }
    // A running timer that points at a task the import just replaced would be pointing
    // at nothing — clear it rather than leave a dangling reference.
    const stillExists = pendingImport.inbox.some((t) => t.id === runningTaskIdRef.current)
      || pendingImport.projects.some((p) => p.tasks.some((t) => t.id === runningTaskIdRef.current));
    if (runningTaskIdRef.current && !stillExists) {
      setRunningTaskId(null); runningTaskIdRef.current = null;
      setRunStart(null); runStartRef.current = null;
      clearInterval(tickTimer.current);
    }
    persist();
    setSelectedId(null);
    setPendingImport(null);
    setImportNote("");
    showUndo(`Replaced with ${n} imported project${n !== 1 ? "s" : ""}`, () => applyData(preSnapshot, { restoreSelection: true }));
  };
  const mergeImportData = () => {
    if (!pendingImport) return;
    const existingProjectIds = new Set(projectsRef.current.map((p) => p.id));
    const newProjects = pendingImport.projects.filter((p) => !existingProjectIds.has(p.id));
    if (newProjects.length) update((prev) => [...prev, ...newProjects]);

    const existingInboxIds = new Set(inboxRef.current.map((t) => t.id));
    const newInboxTasks = pendingImport.inbox.filter((t) => !existingInboxIds.has(t.id));
    if (newInboxTasks.length) updateInbox((ts) => [...ts, ...newInboxTasks]);

    const existingNoteIds = new Set(notesRef.current.map((n) => n.id));
    const newNotes = pendingImport.notes.filter((n) => !existingNoteIds.has(n.id));
    if (newNotes.length) updateNotes((ns) => [...ns, ...newNotes]);

    const existingTemplateIds = new Set(templatesRef.current.map((t) => t.id));
    const newTemplates = pendingImport.templates.filter((t) => !existingTemplateIds.has(t.id));
    if (newTemplates.length) updateTemplates((ts) => [...ts, ...newTemplates]);

    // The imported file's logs are treated as independent history added on top of the
    // current counts (same delta-sum spirit as the realtime merge), not a snapshot
    // that replaces today's numbers — an existing local id always wins on collision,
    // so merging can never silently overwrite live data.
    Object.entries(pendingImport.completionLog || {}).forEach(([date, count]) => { if (count) bumpCompletionLog(date, count); });
    Object.entries(pendingImport.focusLog || {}).forEach(([date, seconds]) => { if (seconds) bumpFocusLog(date, seconds); });

    const addedCount = newProjects.length + newInboxTasks.length + newNotes.length + newTemplates.length;
    setPendingImport(null);
    setImportNote(addedCount
      ? `Merged in ${addedCount} new item${addedCount !== 1 ? "s" : ""}.`
      : "Nothing new to merge — everything in that file already exists here.");
    setTimeout(() => setImportNote(""), 4000);
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
      } else if (k === "inboxtask") {
        setInbox((prev) => { const next = moveItem(prev, dragId, overId); inboxRef.current = next; persist(); return next; });
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
  }, [update, persist]);

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
      if (typing || modalOpenRef.current) return;
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
      <div className="pd-app pd-boot"><style>{css}</style>
        <div className="pd-boot-title">two::dew<span>.</span></div>
      </div>
    );
  }

  const selColor = selected ? colorOf(selected) : null;
  const selPct = selected ? progressOf(selected) : null;
  const doneCount = selected ? selected.tasks.filter((t) => t.done).length : 0;
  const selTrackedSeconds = selected ? selected.tasks.reduce((sum, t) => sum + (t.trackedSeconds || 0), 0) : 0;
  const activeTasks = selected ? selected.tasks.filter((t) => !t.done) : [];
  const completedTasks = selected ? selected.tasks.filter((t) => t.done) : [];
  const activeInboxTasks = inbox.filter((t) => !t.done);
  const completedInboxTasks = inbox.filter((t) => t.done);

  const longDateToday = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className={`pd-app ${selected ? "detail-open" : ""}`}>
      <style>{css}</style>
      {loaded && (
        <SyncStatus state={syncState} note={syncNote} conflicts={syncConflicts}
          onResolveConflict={(c) => resolveConflict(c, "remote")} />
      )}

      <div className="pd-shell">
        {!isMobile && (
          <Sidebar screen={screen} navItems={NAV_ITEMS} onNavigate={setScreen}
            projects={projects} onOpenProject={openProject}
            onOpenPalette={() => setPaletteOpen(true)}
            collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebarCollapsed} />
        )}

        <div className="pd-main">
          {runningTask && (
            <FocusBanner task={runningTask} projectName={runningProject?.name}
              seconds={liveTaskSeconds(runningTask, runningTaskId, runStart)}
              onStop={() => toggleTrack(runningTaskId)}
              onOpen={() => (runningProject ? openProject(runningProject.id) : setScreen("today"))} />
          )}
          <div className="pd-topbar">
            {screen === "projects" ? (
              <>
                <div className="pd-title">Projects<span>.</span></div>
                <div className="pd-overall">
                  <div className="pd-overall-bar"><ProgressFill className="pd-overall-fill" pct={overallPct} /></div>
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
                <div className="pd-title">
                  {screen === "today" ? greeting : <>{SCREEN_TITLES[screen]}<span>.</span></>}
                </div>
                <div className="pd-topbar-quickadd-wrap">
                  <CaptureBar projects={projects} onCommitTask={commitCapturedTask} onCommitNote={commitCapturedNote}
                    placeholder='Add a task…  try "call mom tomorrow 5pm !high #kitchen"' />
                </div>
                <div className="pd-topbar-date">{longDateToday}</div>
              </>
            )}
          </div>

          <div className="pd-screen">
            {screen === "today" && (
              <TodayScreen projects={projects} inbox={inbox} runningTaskId={runningTaskId} runStart={runStart} tick={tick}
                completionLog={completionLog} focusLog={focusLog}
                onToggle={toggleTaskDone} onCyclePriority={cycleTaskPriority} onToggleTrack={toggleTrack}
                onOpenProject={openProject} onOpenTask={(t) => setEditingTaskId(t.id)} onDeleteTask={deleteAnyTaskWithUndo}
                onDeferTask={deferTask} onMoveTask={moveTaskToProject} />
            )}
            {screen === "tasks" && (
              <div className="pd-tasks-screen">
                {activeInboxTasks.length > 0 && (
                  <button type="button" className="pd-nextup-btn pd-review-entry" onClick={() => setReviewOpen(true)}>
                    review inbox ({activeInboxTasks.length})
                  </button>
                )}
                {inbox.length === 0 ? (
                  <p className="pd-empty">No standalone tasks yet — add one above and it'll show up here (it won't belong to any project).</p>
                ) : (
                  <ul className="pd-tasklist">
                    {activeInboxTasks.map((t) => (
                      <TaskRow key={t.id} task={t} color={INBOX_COLOR} isMobile={isMobile} completed={false} rkind="inboxtask"
                        onToggle={() => toggleTaskDone(t.id)}
                        onDelete={() => deleteInboxTaskWithUndo(t)}
                        onTitle={(title) => updateInbox((ts) => ts.map((x) => x.id === t.id ? { ...x, title } : x))}
                        onDeadline={(iso) => updateInbox((ts) => ts.map((x) => x.id === t.id ? { ...x, deadline: iso } : x))}
                        onStartTime={(v) => updateInbox((ts) => ts.map((x) => x.id === t.id ? { ...x, startTime: v } : x))}
                        onEndTime={(v) => updateInbox((ts) => ts.map((x) => x.id === t.id ? { ...x, endTime: v } : x))}
                        onCyclePriority={() => cycleTaskPriority(t.id)}
                        onToggleRecurring={() => toggleTaskRecurring(t.id)}
                        reorderUp={() => updateInbox((ts) => moveBy(ts, t.id, -1))}
                        reorderDown={() => updateInbox((ts) => moveBy(ts, t.id, 1))}
                        canUp={activeInboxTasks[0]?.id !== t.id}
                        canDown={activeInboxTasks[activeInboxTasks.length - 1]?.id !== t.id}
                        touchReorderStart={touchReorderStart}
                        dragClass={`${dragInboxTaskId === t.id || touchDragId === t.id ? "dragging" : ""} ${dragOverInboxTaskId === t.id ? "drag-over" : ""}`}
                        dragHandlers={{
                          onDragStart: () => setDragInboxTaskId(t.id),
                          onDragOver: (e) => { e.preventDefault(); setDragOverInboxTaskId(t.id); },
                          onDrop: (e) => { e.preventDefault(); if (dragInboxTaskId) updateInbox((ts) => moveItem(ts, dragInboxTaskId, t.id)); setDragInboxTaskId(null); setDragOverInboxTaskId(null); },
                          onDragEnd: () => { setDragInboxTaskId(null); setDragOverInboxTaskId(null); },
                        }} />
                    ))}

                    {completedInboxTasks.length > 0 && <li className="pd-tasksep">Completed</li>}
                    {completedInboxTasks.map((t) => (
                      <TaskRow key={t.id} task={t} color={INBOX_COLOR} isMobile={isMobile} completed={true}
                        onToggle={() => toggleTaskDone(t.id)}
                        onDelete={() => deleteInboxTaskWithUndo(t)}
                        onTitle={(title) => updateInbox((ts) => ts.map((x) => x.id === t.id ? { ...x, title } : x))}
                        onDeadline={() => {}} />
                    ))}
                  </ul>
                )}
                <div style={{ height: isMobile ? 24 : 0 }} />
              </div>
            )}
            {screen === "brain" && (
              <BrainScreen projects={projects} notes={notes} isMobile={isMobile}
                onSaveNote={(id, text) => locateAndPatchNote(id, (n) => ({ ...n, text }))}
                onDeleteNote={deleteNoteGlobalWithUndo}
                onDropImages={addStandaloneImageNotes}
                onCreateTask={(note, prefillTitle) => setNoteToTask({ note, prefillTitle })} />
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
              <p>
                That file has {pendingImport.projects.length} project{pendingImport.projects.length !== 1 ? "s" : ""},{" "}
                {pendingImport.inbox.length} inbox task{pendingImport.inbox.length !== 1 ? "s" : ""}, and{" "}
                {pendingImport.notes.length} note{pendingImport.notes.length !== 1 ? "s" : ""}. Replace swaps in everything
                from the file (your current data is saved locally first, so it's undoable); merge only adds what isn't
                already here, without touching anything that exists.
              </p>
              <div className="pd-form-row">
                <button className="pd-btn" onClick={confirmImport}>Replace with imported data</button>
                <button className="pd-btn" onClick={mergeImportData}>Merge into current data</button>
                <button className="pd-btn ghost" onClick={() => setPendingImport(null)}>Cancel</button>
              </div>
            </div>
          )}

          {adding ? (
            <div className="pd-form">
              {templates.length > 0 && (
                <div className="pd-template-row">
                  <button type="button" className={`pd-review-chip ${newProjTemplateId === null ? "active" : ""}`}
                    onClick={() => setNewProjTemplateId(null)}>blank</button>
                  {templates.map((t) => (
                    <span key={t.id} className="pd-template-chip-wrap">
                      <button type="button" className={`pd-review-chip ${newProjTemplateId === t.id ? "active" : ""}`}
                        onClick={() => { setNewProjTemplateId(t.id); if (!newProj.name.trim()) setNewProj({ ...newProj, name: t.name }); }}>
                        {t.name}
                      </button>
                      <button type="button" className="pd-template-delete" aria-label={`Delete template "${t.name}"`}
                        onClick={() => { if (newProjTemplateId === t.id) setNewProjTemplateId(null); deleteTemplate(t.id); }}>×</button>
                    </span>
                  ))}
                </div>
              )}
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
              const status = p.status || "active";
              return (
                <div key={p.id} role="button" tabIndex={0}
                  className={`pd-card ${p.id === selectedId ? "selected" : ""} ${status === "archived" ? "archived" : ""}`}
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
                    {status !== "active" && (
                      <div className="pd-card-status">
                        <span className="pd-status-dot" style={{ background: STATUS_COLOR[status] }} />
                        {STATUS_LABEL[status]}
                      </div>
                    )}
                    {isStale(p) && (
                      <div className="pd-card-stale">quiet for {relativeTimeLabel(lastTouchedAt(p)).replace(" ago", "")}</div>
                    )}
                    {p.phase && <span className="pd-phase">{p.phase}</span>}
                  </div>
                </div>
              );
            })
          )}
          {!showArchived && archivedCount > 0 && !query.trim() && (
            <button type="button" className="pd-archived-reveal" onClick={() => setShowArchived(true)}>
              {archivedCount} archived — show
            </button>
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
                  <input className="pd-outcome-input" value={selected.outcome || ""}
                    placeholder="What does done look like?"
                    onChange={(e) => patchProject({ outcome: e.target.value })} aria-label="Project outcome" />
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
                    <div className="pd-field">
                      <label>Status</label>
                      <button type="button" className="pd-status-trigger"
                        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setStatusMenuAnchor({ x: r.left, y: r.bottom + 6 }); }}>
                        <span className="pd-status-dot" style={{ background: STATUS_COLOR[selected.status || "active"] }} />
                        {STATUS_LABEL[selected.status || "active"]}
                      </button>
                    </div>
                  </div>
                </div>
                <button type="button" className="pd-data-btn" onClick={() => setSavingTemplateName(selected.name)}>save as template</button>
                <button className="pd-danger-btn pd-press" onClick={deleteProjectWithUndo}>delete project</button>
              </div>
              {savingTemplateName !== null && (
                <div className="pd-form-row" style={{ marginTop: 8 }}>
                  <input type="text" value={savingTemplateName} autoFocus placeholder="Template name"
                    onChange={(e) => setSavingTemplateName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { saveProjectAsTemplate(selected, savingTemplateName); setSavingTemplateName(null); }
                      if (e.key === "Escape") setSavingTemplateName(null);
                    }} />
                  <button type="button" className="pd-btn pd-press"
                    onClick={() => { saveProjectAsTemplate(selected, savingTemplateName); setSavingTemplateName(null); }}>save</button>
                  <button type="button" className="pd-btn ghost pd-press" onClick={() => setSavingTemplateName(null)}>cancel</button>
                </div>
              )}
              {statusMenuAnchor && (
                <StatusPicker x={statusMenuAnchor.x} y={statusMenuAnchor.y} value={selected.status || "active"}
                  onSelect={(s) => { patchProject({ status: s }); setStatusMenuAnchor(null); }}
                  onClose={() => setStatusMenuAnchor(null)} />
              )}

              <div style={{ marginTop: 14 }} className="pd-overall-label">
                {selPct === null ? "not started" : `${doneCount}/${selected.tasks.length} tasks · ${selPct}%`}
                {startedLabel(selected.startDate) && <> · {startedLabel(selected.startDate)}</>}
                {selTrackedSeconds > 0 && <> · ⏱ {formatDuration(selTrackedSeconds, false)} tracked</>}
              </div>
              <div className="pd-progressbar"><ProgressFill className="pd-progressfill" pct={selPct ?? 0} style={{ background: selColor.fg }} /></div>

              <div className="pd-health-strip">
                <span>last touched {relativeTimeLabel(lastTouchedAt(selected))}</span>
                <span>next action: {selected.tasks.find((t) => t.isNextAction && !t.done)?.title || "none set"}</span>
                <span>{selected.tasks.filter((t) => !t.done).length} open</span>
                {dueLabel(nextDue(selected)) && (
                  <span className={dueLabel(nextDue(selected)).overdue ? "overdue" : ""}>
                    next due {dueLabel(nextDue(selected)).text}
                  </span>
                )}
                {isStale(selected) && <span className="pd-stale-flag">quiet for {relativeTimeLabel(lastTouchedAt(selected)).replace(" ago", "")}</span>}
              </div>

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
                      onToggleNextAction={() => setNextAction(selected.id, t.id)}
                      running={runningTaskId === t.id} liveSeconds={liveTaskSeconds(t, runningTaskId, runStart)}
                      onToggleTrack={() => toggleTrack(t.id)}
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
                      onCreateTask={(note, prefillTitle) => setNoteToTask({ note, prefillTitle })}
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
          onStartTime={editTaskStartTime} onEndTime={editTaskEndTime} onPlannedDate={editTaskPlannedDate}
          onCyclePriority={() => cycleTaskPriority(editingTask.id)}
          onToggleRecurring={() => toggleTaskRecurring(editingTask.id)}
          onToggleDone={() => toggleTaskDone(editingTask.id)}
          onDelete={deleteEditingTask}
          onOpenDefer={(el) => { const r = el.getBoundingClientRect(); setDeferMenuAnchor({ x: r.left, y: r.bottom + 6 }); }}
          onOpenSourceNote={() => { setScreen("brain"); setEditingTaskId(null); }} />
      )}
      {editingTask && deferMenuAnchor && (
        <DeferMenu x={deferMenuAnchor.x} y={deferMenuAnchor.y}
          onSelect={(destination) => { deferTask(editingTask.id, destination); setDeferMenuAnchor(null); }}
          onPickDate={() => setDeferMenuAnchor(null)}
          onClose={() => setDeferMenuAnchor(null)} />
      )}

      {reviewOpen && activeInboxTasks.length > 0 && (
        <InboxReview tasks={activeInboxTasks} projects={projects}
          onAssignProject={moveTaskToProject}
          onSetDeadline={(id, iso) => locateAndPatchTask(id, (t) => ({ ...t, deadline: iso }))}
          onSetStartTime={(id, v) => locateAndPatchTask(id, (t) => ({ ...t, startTime: v }))}
          onSetEndTime={(id, v) => locateAndPatchTask(id, (t) => ({ ...t, endTime: v }))}
          onSetPriority={(id, p) => locateAndPatchTask(id, (t) => ({ ...t, priority: p }))}
          onSetEstimate={(id, m) => locateAndPatchTask(id, (t) => ({ ...t, estimateMinutes: m }))}
          onConvertToNote={convertInboxTaskToNote}
          onDelete={deleteInboxTaskWithUndo}
          onClose={() => setReviewOpen(false)} />
      )}

      {noteToTask && (
        <NoteToTaskModal note={noteToTask.note} prefillTitle={noteToTask.prefillTitle} projects={projects}
          onCreate={(titles, targetProjectId) => createTasksFromNote(titles, targetProjectId, noteToTask.note.id)}
          onClose={() => setNoteToTask(null)} />
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
