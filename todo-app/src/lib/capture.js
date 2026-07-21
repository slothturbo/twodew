// Universal quick-capture parser — turns free-typed text into structured task/note
// fields (date, time, priority, duration, #project, @context) plus a preview-friendly
// breakdown of what was detected. Pure, DOM-free, so it's directly testable.
import { todayISO, tomorrowISO, thisWeekendISO, nextWeekMondayISO, nextWeekdayISO } from "./helpers";

const WEEKDAYS = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
};
const PRIORITY_WORDS = { h: "high", high: "high", m: "med", med: "med", medium: "med", l: "low", low: "low" };
const TIME_RE = /\b(\d{1,2}(:\d{2})?\s?(am|pm))\b/i;
const DURATION_RE = /\b(\d+)\s?(mins?|minutes?|m|hrs?|hours?|h)\b/i;
const WEEKDAY_RE = /\b(sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/i;
const EXPLICIT_DATE_RE = /\b(\d{1,2})\/(\d{1,2})\b/;

function strip(text, match) {
  return text.replace(match, " ").replace(/\s{2,}/g, " ").trim();
}

function toISODate(y, mo, da) {
  const p2 = (n) => String(n).padStart(2, "0");
  return `${y}-${p2(mo)}-${p2(da)}`;
}

// Returns { deadline, matched } or null — checked in a fixed priority order (today >
// tomorrow > this weekend > next week > a bare weekday name > an explicit m/d date).
function extractDate(text) {
  if (/\btoday\b/i.test(text)) return { deadline: todayISO(), matched: text.match(/\btoday\b/i)[0] };
  if (/\btomorrow\b/i.test(text)) return { deadline: tomorrowISO(), matched: text.match(/\btomorrow\b/i)[0] };
  if (/\bthis weekend\b/i.test(text)) return { deadline: thisWeekendISO(), matched: text.match(/\bthis weekend\b/i)[0] };
  if (/\bnext week\b/i.test(text)) return { deadline: nextWeekMondayISO(), matched: text.match(/\bnext week\b/i)[0] };
  const wd = text.match(WEEKDAY_RE);
  if (wd) return { deadline: nextWeekdayISO(WEEKDAYS[wd[0].toLowerCase()]), matched: wd[0] };
  const explicit = text.match(EXPLICIT_DATE_RE);
  if (explicit) {
    const now = new Date();
    const month = Number(explicit[1]), day = Number(explicit[2]);
    let iso = toISODate(now.getFullYear(), month, day);
    if (iso < todayISO()) iso = toISODate(now.getFullYear() + 1, month, day); // already passed this year — assume next year
    return { deadline: iso, matched: explicit[0] };
  }
  return null;
}

// Parses one line of free-typed capture text into structured fields. `projects` (optional)
// enables #project fuzzy-matching by name; without it, #tags are left unmatched/untouched.
export function parseCapture(raw, projects = []) {
  let text = raw;
  let mode = "task";

  const modeMatch = text.match(/^\s*(note|idea)\s*:\s*/i);
  if (modeMatch) { mode = "note"; text = text.slice(modeMatch[0].length); }

  const contexts = [];
  text = text.replace(/@(\w+)/g, (_, tag) => { contexts.push(tag.toLowerCase()); return " "; }).replace(/\s{2,}/g, " ").trim();

  let projectId = null, projectName = null;
  const tagMatch = text.match(/#(\w+)/);
  if (tagMatch) {
    const token = tagMatch[1].toLowerCase();
    const found = projects.find((p) => p.name.toLowerCase().includes(token));
    if (found) { projectId = found.id; projectName = found.name; text = strip(text, tagMatch[0]); }
  }

  let priority = "med";
  const priMatch = text.match(/!(\w+)\b/);
  if (priMatch && PRIORITY_WORDS[priMatch[1].toLowerCase()]) {
    priority = PRIORITY_WORDS[priMatch[1].toLowerCase()];
    text = strip(text, priMatch[0]);
  }

  let timeLabel = null, startTime = null;
  const timeMatch = text.match(TIME_RE);
  if (timeMatch) {
    timeLabel = timeMatch[0].toUpperCase();
    const [, h, , ampm] = timeMatch[0].match(/(\d{1,2})(:\d{2})?\s?(am|pm)/i);
    const mm = timeMatch[0].match(/:(\d{2})/);
    let hour = Number(h) % 12;
    if (/pm/i.test(ampm)) hour += 12;
    startTime = `${String(hour).padStart(2, "0")}:${mm ? mm[1] : "00"}`;
    text = strip(text, timeMatch[0]);
  }

  let estimateMinutes = null;
  const durMatch = text.match(DURATION_RE);
  if (durMatch) {
    const n = Number(durMatch[1]);
    estimateMinutes = /^h/i.test(durMatch[2]) ? n * 60 : n;
    text = strip(text, durMatch[0]);
  }

  let deadline = null;
  const dateResult = extractDate(text);
  if (dateResult) { deadline = dateResult.deadline; text = strip(text, dateResult.matched); }

  return {
    title: text.trim(),
    mode,
    deadline,
    startTime,
    timeLabel,
    priority,
    estimateMinutes,
    projectId,
    projectName,
    contexts,
  };
}
