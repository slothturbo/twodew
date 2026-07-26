import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  pad, fmtDate, formatClockTime, taskTimeRangeLabel, daysLeft, dueLabel, startedLabel,
  progressOf, nextDue, lastTouchedAt, relativeTimeLabel, isStale, formatDuration, liveTaskSeconds,
  currentStreak, weekBars, heatmapCells, weeklyTotal, plannedVsCompletedThisWeek, carryoverTasks,
  completionByProject, weekdayObservations, parseQuickAdd, attentionSort, moveItem, moveBy,
  computeUpcoming, computeTodayView, nextUpCandidates, pickNextUp, splitTodayBuckets,
  tomorrowISO, thisWeekendISO, monthGridCells,
} from "./helpers";

// Thursday, so weekday-dependent helpers (thisWeekendISO, startOfWeek-based ones) have a
// predictable answer.
const NOW = new Date("2024-01-11T10:00:00");

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

function task(overrides = {}) {
  return { id: "t1", title: "task", done: false, priority: "med", recurring: false, createdAt: 0, ...overrides };
}

describe("date/format helpers", () => {
  it("pad zero-fills single digits", () => {
    expect(pad(3)).toBe("03");
    expect(pad(12)).toBe("12");
  });

  it("fmtDate reformats ISO to d/m/y", () => {
    expect(fmtDate("2024-01-11")).toBe("11/01/2024");
    expect(fmtDate(null)).toBeNull();
  });

  it("formatClockTime renders compact 12h labels", () => {
    expect(formatClockTime("14:00")).toBe("2PM");
    expect(formatClockTime("14:30")).toBe("2:30PM");
    expect(formatClockTime("00:00")).toBe("12AM");
    expect(formatClockTime(null)).toBeNull();
  });

  it("taskTimeRangeLabel prefers explicit start/end over legacy timeLabel", () => {
    expect(taskTimeRangeLabel(task({ startTime: "09:00", endTime: "10:00" }))).toBe("9AM–10AM");
    expect(taskTimeRangeLabel(task({ startTime: "09:00" }))).toBe("9AM");
    expect(taskTimeRangeLabel(task({ timeLabel: "5PM" }))).toBe("5PM");
    expect(taskTimeRangeLabel(task())).toBeNull();
  });

  it("daysLeft/dueLabel report overdue, today, and future consistently", () => {
    expect(daysLeft("2024-01-11")).toBe(0);
    expect(daysLeft("2024-01-14")).toBe(3);
    expect(daysLeft("2024-01-09")).toBe(-2);
    expect(dueLabel("2024-01-11")).toEqual({ text: "today", overdue: true });
    expect(dueLabel("2024-01-14")).toEqual({ text: "3d left", overdue: false });
    expect(dueLabel("2024-01-09")).toEqual({ text: "2d over", overdue: true });
    expect(dueLabel(null)).toBeNull();
  });

  it("startedLabel reports upcoming/today/day-N consistently with daysLeft", () => {
    expect(startedLabel("2024-01-14")).toBe("starts in 3d");
    expect(startedLabel("2024-01-11")).toBe("started today");
    expect(startedLabel("2024-01-09")).toBe("day 3");
  });
});

describe("project helpers", () => {
  it("progressOf computes done-task percentage, null when empty", () => {
    expect(progressOf({ tasks: [] })).toBeNull();
    expect(progressOf({ tasks: [task({ done: true }), task({ done: false })] })).toBe(50);
  });

  it("nextDue picks the soonest open deadline", () => {
    const p = { tasks: [task({ deadline: "2024-02-01" }), task({ deadline: "2024-01-20" }), task({ done: true, deadline: "2024-01-01" })] };
    expect(nextDue(p)).toBe("2024-01-20");
    expect(nextDue({ tasks: [] })).toBeNull();
  });

  it("lastTouchedAt takes the most recent of project/task/note timestamps", () => {
    const p = { createdAt: 100, tasks: [task({ createdAt: 100, completedAt: 500 })], notes: [{ createdAt: 300 }] };
    expect(lastTouchedAt(p)).toBe(500);
  });

  it("relativeTimeLabel buckets into today/yesterday/Nd/Nw/Nmo", () => {
    const day = 86400000;
    expect(relativeTimeLabel(NOW.getTime())).toBe("today");
    expect(relativeTimeLabel(NOW.getTime() - day)).toBe("yesterday");
    expect(relativeTimeLabel(NOW.getTime() - 3 * day)).toBe("3d ago");
    expect(relativeTimeLabel(NOW.getTime() - 14 * day)).toBe("2w ago");
    expect(relativeTimeLabel(NOW.getTime() - 60 * day)).toBe("2mo ago");
  });

  it("isStale only flags active projects untouched for 14+ days", () => {
    const day = 86400000;
    const stale = { status: "active", createdAt: NOW.getTime() - 20 * day, tasks: [], notes: [] };
    const fresh = { status: "active", createdAt: NOW.getTime() - 2 * day, tasks: [], notes: [] };
    const staleButArchived = { status: "archived", createdAt: NOW.getTime() - 20 * day, tasks: [], notes: [] };
    expect(isStale(stale)).toBe(true);
    expect(isStale(fresh)).toBe(false);
    expect(isStale(staleButArchived)).toBe(false);
  });
});

describe("duration/tracking", () => {
  it("formatDuration renders running vs. resting durations, null at zero", () => {
    expect(formatDuration(0, false)).toBeNull();
    expect(formatDuration(65, false)).toBe("1m");
    expect(formatDuration(3665, false)).toBe("1h 1m");
    expect(formatDuration(5, true)).toBe("0:05");
    expect(formatDuration(3605, true)).toBe("1:00:05");
  });

  it("liveTaskSeconds adds elapsed time only for the currently-running task", () => {
    const t = task({ id: "a", trackedSeconds: 100 });
    expect(liveTaskSeconds(t, "a", NOW.getTime() - 30000)).toBeCloseTo(130, 0);
    expect(liveTaskSeconds(t, "b", NOW.getTime() - 30000)).toBe(100);
    expect(liveTaskSeconds(t, "a", null)).toBe(100);
  });
});

describe("streak / week bar / heatmap / weekly totals", () => {
  it("currentStreak counts consecutive days ending today or yesterday", () => {
    const log = { "2024-01-11": 1, "2024-01-10": 2, "2024-01-09": 1, "2024-01-07": 1 };
    expect(currentStreak(log)).toBe(3);
    expect(currentStreak({})).toBe(0);
  });

  it("currentStreak doesn't zero out yesterday's streak before today logs anything", () => {
    const log = { "2024-01-10": 1, "2024-01-09": 1 };
    expect(currentStreak(log)).toBe(2);
  });

  it("weekBars returns 7 Sun-Sat entries reflecting the log", () => {
    const bars = weekBars({ "2024-01-11": 4 });
    expect(bars).toHaveLength(7);
    const thu = bars.find((b) => b.iso === "2024-01-11");
    expect(thu.value).toBe(4);
    expect(thu.label).toBe("T");
  });

  it("heatmapCells returns `days` cells ending today with on/count derived from the log", () => {
    const cells = heatmapCells({ "2024-01-11": 3 }, 7);
    expect(cells).toHaveLength(7);
    expect(cells[cells.length - 1]).toEqual({ iso: "2024-01-11", on: true, count: 3 });
    expect(cells[0].count).toBe(0);
  });

  it("weeklyTotal sums the current Sun-Sat week only", () => {
    // 2024-01-07 is the Sunday starting this week; 2024-01-06 is the prior Saturday.
    const log = { "2024-01-07": 2, "2024-01-11": 3, "2024-01-06": 100 };
    expect(weeklyTotal(log)).toBe(5);
  });
});

describe("insights helpers", () => {
  it("plannedVsCompletedThisWeek counts tasks planned this week and how many are done", () => {
    const inbox = [
      task({ id: "a", plannedDate: "2024-01-11", done: true }),
      task({ id: "b", deadline: "2024-01-12", done: false }),
      task({ id: "c", deadline: "2023-12-01", done: false }), // outside this week
    ];
    expect(plannedVsCompletedThisWeek([], inbox)).toEqual({ planned: 2, completed: 1 });
  });

  it("carryoverTasks returns still-open tasks scheduled before today", () => {
    const inbox = [
      task({ id: "a", deadline: "2024-01-09", done: false }),
      task({ id: "b", deadline: "2024-01-09", done: true }), // done, excluded
      task({ id: "c", deadline: "2024-01-11", done: false }), // today, not carryover
    ];
    const result = carryoverTasks([], inbox);
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });

  it("completionByProject counts this-week completions per project and drops zero-count ones", () => {
    const projects = [
      { id: "p1", name: "Alpha", colorIdx: 0, tasks: [task({ done: true, completedAt: NOW.getTime() })] },
      { id: "p2", name: "Beta", colorIdx: 1, tasks: [task({ done: false })] },
    ];
    const result = completionByProject(projects);
    expect(result).toEqual([{ id: "p1", name: "Alpha", color: expect.any(Object), count: 1 }]);
  });

  it("weekdayObservations stays silent without a clearly-ahead, well-supported weekday", () => {
    expect(weekdayObservations({}, {})).toEqual([]);
  });

  it("weekdayObservations surfaces a completion-day claim once one weekday is clearly ahead of a second qualifying weekday", () => {
    // Needs >=2 weekdays with >=3 non-zero occurrences to compare at all — a single busy
    // weekday with everything else silent isn't enough evidence per topWeekdayObservation.
    const log = {};
    const isoFor = (daysAgo) => {
      const d = new Date(NOW); d.setDate(d.getDate() - daysAgo);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    for (const w of [0, 1, 2, 3]) log[isoFor(w * 7)] = 6; // Thursdays: high, well-supported
    for (const w of [0, 1, 2]) log[isoFor(w * 7 + 3)] = 1; // Mondays: low, still qualifies
    expect(weekdayObservations(log, {})).toEqual(["You complete more on Thursdays."]);
  });
});

describe("capture/sort/list helpers", () => {
  it("parseQuickAdd strips a trailing time into its own label", () => {
    expect(parseQuickAdd("call mom 5pm")).toEqual({ title: "call mom", timeLabel: "5PM" });
    expect(parseQuickAdd("call mom 11:30am")).toEqual({ title: "call mom", timeLabel: "11:30AM" });
    expect(parseQuickAdd("just a task")).toEqual({ title: "just a task", timeLabel: null });
  });

  it("attentionSort buckets by status then by soonest due date", () => {
    const a = { status: "active", createdAt: 1, tasks: [task({ deadline: "2024-01-20" })] };
    const b = { status: "active", createdAt: 2, tasks: [task({ deadline: "2024-01-15" })] };
    const archived = { status: "archived", createdAt: 0, tasks: [] };
    const sorted = [a, archived, b].sort(attentionSort);
    expect(sorted).toEqual([b, a, archived]);
  });

  it("moveItem repositions an entry relative to another by id", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(moveItem(list, "a", "c").map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(moveItem(list, "x", "c")).toBe(list); // missing id: no-op, same reference
  });

  it("moveBy swaps an item with its neighbor in the given direction", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(moveBy(list, "b", -1).map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(moveBy(list, "a", -1)).toBe(list); // already at the edge: no-op
  });
});

describe("Today aggregation", () => {
  it("computeTodayView includes due-today/overdue/recurring/next-action/planned-for-today, excludes future-dated", () => {
    const inbox = [
      task({ id: "due-today", deadline: "2024-01-11" }),
      task({ id: "overdue", deadline: "2024-01-09" }),
      task({ id: "future", deadline: "2024-01-20" }),
      task({ id: "recurring", recurring: true, deadline: "2024-01-20" }),
      task({ id: "next-action", isNextAction: true, deadline: "2024-01-20" }),
      task({ id: "planned-today", plannedDate: "2024-01-11", deadline: "2024-01-20" }),
      task({ id: "undated" }),
    ];
    const ids = computeTodayView([], inbox).map((t) => t.id);
    expect(ids).toContain("due-today");
    expect(ids).toContain("overdue");
    expect(ids).toContain("recurring");
    expect(ids).toContain("next-action");
    expect(ids).toContain("planned-today");
    expect(ids).toContain("undated");
    expect(ids).not.toContain("future");
  });

  it("computeUpcoming only includes non-recurring open tasks strictly after today", () => {
    const inbox = [
      task({ id: "today", deadline: "2024-01-11" }),
      task({ id: "future", deadline: "2024-01-20" }),
      task({ id: "recurring-future", recurring: true, deadline: "2024-01-20" }),
    ];
    expect(computeUpcoming([], inbox).map((t) => t.id)).toEqual(["future"]);
  });

  it("nextUpCandidates/pickNextUp rank due-now above high-priority-today above overdue above the rest", () => {
    const items = [
      task({ id: "rest" }),
      task({ id: "overdue", deadline: "2024-01-09" }),
      task({ id: "high-today", deadline: "2024-01-11", priority: "high" }),
      task({ id: "due-now", plannedDate: "2024-01-11", startTime: "09:00", endTime: "11:00" }),
    ];
    const order = nextUpCandidates(items).map((t) => t.id);
    expect(order).toEqual(["due-now", "high-today", "overdue", "rest"]);
    expect(pickNextUp(items).id).toBe("due-now");
    expect(pickNextUp([])).toBeNull();
  });

  it("splitTodayBuckets separates a later-today startTime from everything else, and done items separately", () => {
    const items = [
      task({ id: "now-task", deadline: "2024-01-11" }),
      task({ id: "later", plannedDate: "2024-01-11", startTime: "23:00" }),
      task({ id: "done", done: true }),
    ];
    const { now, laterToday, doneToday } = splitTodayBuckets(items);
    expect(now.map((t) => t.id)).toEqual(["now-task"]);
    expect(laterToday.map((t) => t.id)).toEqual(["later"]);
    expect(doneToday.map((t) => t.id)).toEqual(["done"]);
  });
});

describe("defer-destination date helpers", () => {
  it("tomorrowISO/thisWeekendISO resolve relative to the frozen 'now'", () => {
    expect(tomorrowISO()).toBe("2024-01-12");
    expect(thisWeekendISO()).toBe("2024-01-13"); // Thursday -> upcoming Saturday
  });
});

describe("calendar grid math", () => {
  it("monthGridCells returns a 42-cell Sunday-start grid flagging in-month days", () => {
    const cells = monthGridCells(2024, 0); // January 2024
    expect(cells).toHaveLength(42);
    const jan11 = cells.find((c) => c.iso === "2024-01-11");
    expect(jan11.inMonth).toBe(true);
    expect(cells[0].inMonth).toBe(false); // Dec 31 2023 spills into the grid
  });
});
