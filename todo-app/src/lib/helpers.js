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
// Approximates a project's "last touched" moment from timestamps that already exist
// (no new updatedAt bookkeeping needed at every mutation site) — the most recent of the
// project's own creation, any task's completion/creation, or any note's creation.
export function lastTouchedAt(p) {
  const stamps = [
    p.createdAt,
    ...p.tasks.map((t) => t.completedAt || t.createdAt),
    ...p.notes.map((n) => n.createdAt || 0),
  ].filter(Boolean);
  return stamps.length ? Math.max(...stamps) : p.createdAt;
}
export function relativeTimeLabel(ms) {
  if (!ms) return null;
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}
export const STALE_DAYS = 14;
// Only flags Active projects — Waiting/Someday/Completed/Archived are expected to sit
// quietly, so flagging them would be exactly the noisy, judgmental signal to avoid.
export function isStale(p) {
  return (p.status || "active") === "active" && Date.now() - lastTouchedAt(p) > STALE_DAYS * 86400000;
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
export const STATUS_LABEL = { active: "Active", waiting: "Waiting", someday: "Someday", completed: "Completed", archived: "Archived" };
export const STATUS_COLOR = {
  active: "var(--accent)", waiting: "var(--priority-high)", someday: "var(--muted)",
  completed: "var(--ok)", archived: "var(--muted)",
};
// Bucket rank for attentionSort — active/waiting sort together by soonest due date (same
// as before status existed), someday/completed/archived sink in that order beneath them.
export const STATUS_ORDER = { active: 0, waiting: 0, someday: 1, completed: 2, archived: 3 };
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
// Buckets by status first (active/waiting > someday > completed > archived), then sorts
// within a bucket by soonest due date. Replaces the old "100%-complete sinks to the
// bottom" rule now that status is an explicit, user-controlled signal instead of a
// task-count proxy for done-ness.
export function attentionSort(a, b) {
  const sa = STATUS_ORDER[a.status] ?? 0, sb = STATUS_ORDER[b.status] ?? 0;
  if (sa !== sb) return sa - sb;
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
    // A project's marked next action is relevant regardless of its own deadline (or lack
    // of one) — it's the thing to work on now, not necessarily the thing due now. Without
    // this it would never reach nextUpCandidates unless it happened to also be due today.
    if (t.isNextAction && !t.done) return true;
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

const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// Ordered "what should I do next" candidates from computeTodayView's output — first
// match wins for the Next Up card; the full order backs the "not this" replace control.
// Tiers: a task whose scheduled time window is happening right now > a high-priority
// task due today > a project's marked next action > the most-overdue task > whatever's
// simply first in the existing sort, so there's always *something* to suggest as long
// as any task is open.
export function nextUpCandidates(items) {
  const today = todayISO();
  const hm = nowHM();
  const open = items.filter((t) => !t.done);

  const dueNow = open
    .filter((t) => t.deadline === today && t.startTime && t.startTime <= hm && (!t.endTime || t.endTime > hm))
    .sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
  const dueNowIds = new Set(dueNow.map((t) => t.id));

  const highToday = open.filter((t) => !dueNowIds.has(t.id) && t.deadline === today && t.priority === "high");
  const highTodayIds = new Set(highToday.map((t) => t.id));

  const nextAction = open.filter((t) => !dueNowIds.has(t.id) && !highTodayIds.has(t.id) && t.isNextAction);
  const nextActionIds = new Set(nextAction.map((t) => t.id));

  const overdue = open
    .filter((t) => !dueNowIds.has(t.id) && !highTodayIds.has(t.id) && !nextActionIds.has(t.id) && t.deadline && t.deadline < today)
    .sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
  const overdueIds = new Set(overdue.map((t) => t.id));

  const rest = open.filter((t) => !dueNowIds.has(t.id) && !highTodayIds.has(t.id) && !nextActionIds.has(t.id) && !overdueIds.has(t.id));

  return [...dueNow, ...highToday, ...nextAction, ...overdue, ...rest];
}
export function pickNextUp(items) {
  return nextUpCandidates(items)[0] || null;
}

// Splits computeTodayView's remaining (non-next-up) open items into "Now" (due today
// with no specific future time, overdue, undated, or recurring — i.e. everything that
// isn't waiting on a later time-of-day today) and "Later today" (has a startTime that
// hasn't arrived yet). Today's completions are returned separately for a collapsed
// "Done today" section.
export function splitTodayBuckets(items, excludeId) {
  const today = todayISO();
  const hm = nowHM();
  const open = items.filter((t) => !t.done && t.id !== excludeId);
  const laterToday = open.filter((t) => t.deadline === today && t.startTime && t.startTime > hm);
  const laterTodayIds = new Set(laterToday.map((t) => t.id));
  const now = open.filter((t) => !laterTodayIds.has(t.id));
  const doneToday = items.filter((t) => t.done);
  return { now, laterToday, doneToday };
}

// Defer destinations — each returns an ISO date (or, for "later today", the deadline
// stays/becomes today so only startTime/endTime need clearing at the call site).
export function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function thisWeekendISO() {
  const d = new Date();
  const addDays = (6 - d.getDay() + 7) % 7; // 0 if today is already Saturday; 6 if Sunday (next Saturday, not the day just passed)
  d.setDate(d.getDate() + addDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function nextWeekMondayISO() {
  const start = startOfWeek(new Date()); // this week's Sunday
  const nextMon = new Date(start); nextMon.setDate(nextMon.getDate() + 8); // next week's Monday
  return `${nextMon.getFullYear()}-${pad(nextMon.getMonth() + 1)}-${pad(nextMon.getDate())}`;
}
// Next date (today included) that falls on the given day-of-week (0=Sun..6=Sat, matches DOW) —
// used by the quick-capture parser for bare weekday names like "call mom tuesday".
export function nextWeekdayISO(targetDow) {
  const d = new Date();
  d.setDate(d.getDate() + ((targetDow - d.getDay() + 7) % 7));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
