// Shared pure helpers/constants used across App.jsx and the screens in src/screens/.
export const PALETTE = [
  { fg: "#8FB4FF", bg: "rgba(143,180,255,0.09)" },
  { fg: "#7DD8C6", bg: "rgba(125,216,198,0.09)" },
  { fg: "#C2A6F5", bg: "rgba(194,166,245,0.09)" },
  { fg: "#F2A6BC", bg: "rgba(242,166,188,0.09)" },
  { fg: "#ABDB8C", bg: "rgba(171,219,140,0.09)" },
  { fg: "#8AD2EA", bg: "rgba(138,210,234,0.09)" },
];
export const DOW = ["S", "M", "T", "W", "T", "F", "S"];
export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const pad = (n) => String(n).padStart(2, "0");
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// Local calendar date for a ms timestamp — NOT toISOString(), which is UTC and drifts a
// day off todayISO() for anyone outside UTC during the hours near local midnight.
export const localDateISO = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const colorOf = (p) => PALETTE[(p.colorIdx ?? 0) % PALETTE.length];

export function progressOf(p) {
  if (!p.tasks.length) return null;
  return Math.round((p.tasks.filter((t) => t.done).length / p.tasks.length) * 100);
}
export function daysLeft(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
}
export function dueLabel(dateStr) {
  const dl = daysLeft(dateStr);
  if (dl === null) return null;
  if (dl < 0) return { text: `${Math.abs(dl)}d over`, overdue: true };
  if (dl === 0) return { text: "today", overdue: true };
  return { text: `${dl}d left`, overdue: false };
}
export function fmtDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
// "14:00" -> "2PM", "14:30" -> "2:30PM" — matches the compact style parseQuickAdd already uses.
export function formatClockTime(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${pad(m)}${period}` : `${h12}${period}`;
}
// Prefers the explicit start/end time fields; falls back to the legacy quick-add timeLabel.
export function taskTimeRangeLabel(t) {
  if (t.startTime) {
    const s = formatClockTime(t.startTime);
    const e = t.endTime ? formatClockTime(t.endTime) : null;
    return e ? `${s}–${e}` : s;
  }
  return t.timeLabel || null;
}
export function nextDue(p) {
  const dates = p.tasks.filter((t) => !t.done && t.deadline).map((t) => t.deadline);
  if (!dates.length) return null;
  return dates.sort()[0];
}
export function startedLabel(startDate) {
  const dl = daysLeft(startDate);
  if (dl === null) return null;
  if (dl > 0) return `starts in ${dl}d`;
  if (dl === 0) return "started today";
  return `day ${Math.abs(dl) + 1}`;
}
export const PRIORITY_ORDER = { high: 0, med: 1, low: 2 };
export const PRIORITY_CYCLE = { med: "high", high: "low", low: "med" };
export const PRIORITY_COLOR = { high: "var(--priority-high)", med: "var(--accent)", low: "var(--muted)" };
export function liveTaskSeconds(t, runningTaskId, runStart) {
  return t.trackedSeconds + (runningTaskId === t.id && runStart ? (Date.now() - runStart) / 1000 : 0);
}
export function formatDuration(totalSeconds, running) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (running) return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  if (s === 0) return null;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ---- Stats: streak / week bar chart / 28-day heatmap — read only from completionLog ---- */
export function currentStreak(completionLog) {
  const hasToday = (completionLog[todayISO()] || 0) > 0;
  let count = 0;
  const d = new Date();
  if (!hasToday) d.setDate(d.getDate() - 1); // nothing logged yet today shouldn't zero out yesterday's streak
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if ((completionLog[iso] || 0) > 0) { count++; d.setDate(d.getDate() - 1); } else break;
  }
  return count;
}
export function startOfWeek(d) {
  const out = new Date(d); out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay()); // Sunday-start, matches the app's existing DOW/DatePicker convention
  return out;
}
export function weekBars(completionLog) {
  const start = startOfWeek(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { label: DOW[i], value: completionLog[iso] || 0, iso };
  });
}
export function heatmapCells(completionLog, days = 28) {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (days - 1 - i));
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { iso, on: (completionLog[iso] || 0) > 0 };
  });
}
// Ports the mockup's quick-add regex: strip a trailing time like "5pm"/"11:30am" out of
// the typed text into a display label, title becomes whatever's left.
export function parseQuickAdd(raw) {
  const title = raw.trim();
  const m = title.match(/\b(\d{1,2}(:\d{2})?\s?(am|pm))\b/i);
  if (!m) return { title, timeLabel: null };
  return { title: title.replace(m[0], "").replace(/\s{2,}/g, " ").trim(), timeLabel: m[0].toUpperCase() };
}
export function attentionSort(a, b) {
  const doneA = progressOf(a) === 100, doneB = progressOf(b) === 100;
  if (doneA !== doneB) return doneA ? 1 : -1;
  const da = daysLeft(nextDue(a)), db = daysLeft(nextDue(b));
  if (da === null && db === null) return a.createdAt - b.createdAt;
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}
export function moveItem(list, fromId, toId) {
  const items = [...list];
  const fromIdx = items.findIndex((i) => i.id === fromId);
  const toIdx = items.findIndex((i) => i.id === toId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return list;
  const [moved] = items.splice(fromIdx, 1);
  items.splice(toIdx, 0, moved);
  return items;
}
export function moveBy(list, id, dir) {
  const items = [...list];
  const idx = items.findIndex((i) => i.id === id);
  const swapIdx = idx + dir;
  if (idx === -1 || swapIdx < 0 || swapIdx >= items.length) return list;
  [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
  return items;
}

// Tasks due strictly after today — computeTodayView already covers today/overdue/recurring,
// this gives the Today screen a look further ahead without duplicating that list.
export function computeUpcoming(projects, inbox, limit = 6) {
  const today = todayISO();
  const all = [
    ...inbox.map((t) => ({ ...t, projectId: null, projectName: null })),
    ...projects.flatMap((p) => p.tasks.map((t) => ({ ...t, projectId: p.id, projectName: p.name }))),
  ];
  return all
    .filter((t) => !t.recurring && !t.done && t.deadline && t.deadline > today)
    .sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0))
    .slice(0, limit);
}

/* ---- Today aggregation: pulls tasks across every project + the inbox ---- */
export function computeTodayView(projects, inbox) {
  const today = todayISO();
  const all = [
    ...inbox.map((t) => ({ ...t, projectId: null, projectName: null, projectColor: null })),
    ...projects.flatMap((p) => p.tasks.map((t) => ({ ...t, projectId: p.id, projectName: p.name, projectColor: colorOf(p) }))),
  ];
  const relevant = all.filter((t) => {
    if (t.recurring) return true;
    if (!t.done) return !t.deadline || t.deadline <= today;
    return t.completedAt && localDateISO(t.completedAt) === today;
  });
  return relevant.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pr = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
    if (pr !== 0) return pr;
    if (a.deadline !== b.deadline) {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline < b.deadline ? -1 : 1;
    }
    return a.createdAt - b.createdAt;
  });
}

// Buckets computeTodayView's flat list into one group per project (+ an Inbox
// group for project-less tasks), preserving each task's relative order —
// group order falls out naturally from whichever task in a group is most
// urgent, since the input list is already priority/deadline sorted.
export function groupTodayByProject(items) {
  const groups = new Map();
  for (const t of items) {
    const key = t.projectId || "inbox";
    if (!groups.has(key)) {
      groups.set(key, { key, name: t.projectName || "Tasks", color: t.projectColor, tasks: [] });
    }
    groups.get(key).tasks.push(t);
  }
  return [...groups.values()];
}
