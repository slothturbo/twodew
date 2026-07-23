import { useMemo, useState } from "react";
import { todayISO, colorOf, MONTHS, DOW, taskTimeRangeLabel, monthGridCells, weekCells, pad } from "../lib/helpers";
import { HourGrid, HOUR_H } from "../components/HourGrid";

const INBOX_COLOR = { fg: "var(--muted)", bg: "rgba(140,150,163,0.12)" };
const dateISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const formatMinutes = (mins) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

/* ------------------------------------------------------------------ */
/*  Calendar screen — month/week/day planning surface. A task is placed  */
/*  on plannedDate when set, falling back to deadline (identical to      */
/*  today's behavior for any task that never uses plannedDate).          */
/* ------------------------------------------------------------------ */
export function CalendarScreen({ projects, inbox, isMobile, onOpenProject, onOpenTask, onScheduleTask }) {
  const [view, setView] = useState("month"); // "month" | "week" | "day"
  const [cursor, setCursor] = useState(new Date());
  const [showUnscheduled, setShowUnscheduled] = useState(!isMobile);
  // The task currently "armed" for placement — set either by starting a desktop drag or
  // by tapping an Unscheduled task (the mobile/no-drag path). Consumed by tapping or
  // dropping on a day cell / hour slot. One mechanism serves both input styles.
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [dragOverIso, setDragOverIso] = useState(null);
  const viewY = cursor.getFullYear(), viewM = cursor.getMonth();
  const todayIso = todayISO();

  const allTasks = useMemo(() => [
    ...inbox.map((t) => ({ ...t, projectId: null, projectName: null, projectColor: null })),
    ...projects.flatMap((p) => p.tasks.map((t) => ({ ...t, projectId: p.id, projectName: p.name, projectColor: colorOf(p) }))),
  ], [projects, inbox]);

  const byDate = useMemo(() => {
    const map = {};
    allTasks.forEach((t) => {
      const iso = t.plannedDate || t.deadline;
      if (iso) (map[iso] ||= []).push(t);
    });
    return map;
  }, [allTasks]);

  // Tasks with neither a planned session nor a due date — nothing to place on the grid
  // yet. Surfaced as its own panel so there's somewhere to schedule *from*.
  const unscheduled = useMemo(
    () => allTasks.filter((t) => !t.done && !t.plannedDate && !t.deadline),
    [allTasks]
  );

  const cells = useMemo(() => {
    if (view !== "month") return [];
    return monthGridCells(viewY, viewM).map((c) => ({
      ...c,
      items: [...(byDate[c.iso] || [])].sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99")),
    }));
  }, [view, viewY, viewM, byDate]);

  // Splits a day's tasks into "all-day" (no startTime, sits in the strip above the hour
  // axis) and "timed" (positioned as a block) — shared by day view and week view.
  const buildColumn = (date) => {
    const iso = dateISO(date);
    const items = byDate[iso] || [];
    return {
      date, iso,
      allDay: items.filter((t) => !t.startTime),
      timed: [...items.filter((t) => t.startTime)].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    };
  };
  const dayColumns = useMemo(() => (view === "day" ? [buildColumn(cursor)] : []), [view, cursor, byDate]);

  // Daily planning panel: sums estimateMinutes across everything scheduled that day and
  // flags pairwise time-block overlaps. Deliberately no "available focus time" number —
  // the app has no real concept of the user's actual work-hour capacity, and fabricating
  // one would be an unearned-authority number the rest of the app avoids.
  const dayPlan = useMemo(() => {
    if (view !== "day" || !dayColumns.length) return null;
    const { allDay, timed } = dayColumns[0];
    const all = [...allDay, ...timed];
    const plannedMinutes = all.reduce((sum, t) => sum + (t.estimateMinutes || 0), 0);
    const overlapIds = new Set();
    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        const a = timed[i], b = timed[j];
        const aStart = toMin(a.startTime), aEnd = a.endTime ? toMin(a.endTime) : aStart + 30;
        const bStart = toMin(b.startTime), bEnd = b.endTime ? toMin(b.endTime) : bStart + 30;
        if (aStart < bEnd && bStart < aEnd) { overlapIds.add(a.id); overlapIds.add(b.id); }
      }
    }
    return { count: all.length, plannedMinutes, overlapIds };
  }, [view, dayColumns]);

  const dayColumnsFlagged = useMemo(() => {
    if (!dayPlan?.overlapIds.size) return dayColumns;
    return dayColumns.map((col) => ({
      ...col,
      timed: col.timed.map((t) => (dayPlan.overlapIds.has(t.id) ? { ...t, overbooked: true } : t)),
    }));
  }, [dayColumns, dayPlan]);

  const week = useMemo(() => (view === "week" ? weekCells(cursor) : []), [view, cursor]);
  // Week is a real 7-column HourGrid on desktop, but that's unusably cramped at phone
  // width — mobile gets an agenda list scoped to the same 7 days instead, reusing the
  // exact row markup the month view's mobile agenda already uses.
  const weekColumns = useMemo(() => (view === "week" && !isMobile ? week.map((c) => buildColumn(c.date)) : []), [view, isMobile, week, byDate]);
  const weekAgendaDays = useMemo(() => (view === "week" && isMobile
    ? week.map((c) => ({ ...c, items: [...(byDate[c.iso] || [])].sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99")) }))
    : []), [view, isMobile, week, byDate]);

  const nav = (delta) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + delta);
    else if (view === "week") d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCursor(d);
  };
  const goToday = () => setCursor(new Date());

  const openTask = (t) => (t.projectId ? onOpenProject(t.projectId) : onOpenTask(t));

  // Fires on either a real HTML5 drop or a tap on a target while a task is armed.
  // Dropping into an hour column also derives a startTime from the vertical position
  // (snapped to 15 minutes); dropping onto a month cell or the all-day strip doesn't.
  const handleSchedule = (iso, e) => {
    if (!pendingTaskId) return;
    e?.preventDefault?.();
    let startTime = null;
    if (e?.currentTarget?.classList?.contains("pd-hourgrid-col")) {
      const rect = e.currentTarget.getBoundingClientRect();
      const minutesFromTop = ((e.clientY - rect.top) / HOUR_H) * 60;
      const snapped = Math.max(0, Math.min(23 * 60 + 45, Math.round(minutesFromTop / 15) * 15));
      startTime = `${pad(Math.floor(snapped / 60))}:${pad(snapped % 60)}`;
    }
    onScheduleTask(pendingTaskId, iso, startTime);
    setPendingTaskId(null);
    setDragOverIso(null);
  };
  // A tap on empty cell space (not a chip inside it) while armed places the pending
  // task there; tapping an already-placed chip while armed places it on that chip's
  // day instead of opening it (see chipClick below) — both consume the arm state.
  const cellClickHandler = (iso) => (e) => {
    if (e.target !== e.currentTarget) return;
    handleSchedule(iso, e);
  };
  const chipClick = (t) => {
    if (pendingTaskId) { handleSchedule(t.plannedDate || t.deadline, null); return; }
    openTask(t);
  };
  const dragHandlers = {
    onDragStart: (taskId) => setPendingTaskId(taskId),
    onDragOver: (e, iso) => { e.preventDefault(); setDragOverIso(iso); },
    onDrop: (iso, e) => handleSchedule(iso, e),
    onDragEnd: () => { setPendingTaskId(null); setDragOverIso(null); },
  };

  const headLabel = view === "month" ? MONTHS[viewM]
    : view === "week" && week.length ? (week[0].date.getMonth() === week[6].date.getMonth()
        ? `${MONTHS[week[0].date.getMonth()]} ${week[0].date.getDate()}–${week[6].date.getDate()}`
        : `${MONTHS[week[0].date.getMonth()].slice(0, 3)} ${week[0].date.getDate()} – ${MONTHS[week[6].date.getMonth()].slice(0, 3)} ${week[6].date.getDate()}`)
    : cursor.toLocaleDateString(undefined, { month: "long", day: "numeric" });

  return (
    <div className="pd-calendar">
      <div className="pd-cal-head">
        <div className="pd-cal-monthyear">
          <div className="pd-cal-month">{headLabel}</div>
          <div className="pd-cal-year">{viewY}</div>
        </div>
        <div className="pd-viewtoggle">
          <button type="button" className={view === "month" ? "active" : ""} onClick={() => setView("month")}>month</button>
          <button type="button" className={view === "week" ? "active" : ""} onClick={() => setView("week")}>week</button>
          <button type="button" className={view === "day" ? "active" : ""} onClick={() => setView("day")}>day</button>
        </div>
        <div className="pd-cal-nav">
          <button type="button" onClick={goToday}>today</button>
          <button type="button" onClick={() => nav(-1)} aria-label="Previous">‹</button>
          <button type="button" onClick={() => nav(1)} aria-label="Next">›</button>
        </div>
      </div>

      {pendingTaskId && (
        <div className="pd-cal-arming-hint">
          tap a day to schedule it <button type="button" onClick={() => setPendingTaskId(null)}>cancel</button>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="pd-cal-unscheduled">
          <button type="button" className="pd-cal-unscheduled-toggle" onClick={() => setShowUnscheduled((s) => !s)}>
            unscheduled ({unscheduled.length}) {showUnscheduled ? "▾" : "▸"}
          </button>
          {showUnscheduled && (
            <div className="pd-cal-unscheduled-list">
              {unscheduled.map((t) => {
                const col = t.projectColor || INBOX_COLOR;
                return (
                  <button key={t.id} type="button" className={`pd-cal-unscheduled-chip ${pendingTaskId === t.id ? "armed" : ""}`}
                    style={{ borderLeftColor: col.fg }}
                    draggable={!isMobile}
                    onDragStart={() => dragHandlers.onDragStart(t.id)}
                    onDragEnd={dragHandlers.onDragEnd}
                    onClick={() => setPendingTaskId((id) => (id === t.id ? null : t.id))}>
                    {t.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "month" && (isMobile ? (
        <div className="pd-cal-agenda">
          {/* While a task is armed for placement, every day in the month becomes a tap
              target — otherwise this list only shows days that already have something on
              them, which would leave no empty day to place onto. */}
          {cells.filter((c) => c.inMonth && c.iso >= todayIso && (c.items.length > 0 || pendingTaskId)).map((day) => (
            <div key={day.iso} className={`pd-cal-agenda-day ${day.iso === todayIso ? "today" : ""}`}
              onClick={cellClickHandler(day.iso)}>
              <div className="pd-cal-agenda-date">
                <div className="pd-cal-agenda-daynum">{day.date.getDate()}</div>
                <div className="pd-cal-agenda-dow">{day.date.toLocaleDateString(undefined, { weekday: "short" })}</div>
              </div>
              <div className="pd-cal-agenda-items">
                {day.items.length === 0 && <span className="pd-cal-agenda-empty-tap">tap to schedule here</span>}
                {day.items.map((t) => {
                  const col = t.projectColor || INBOX_COLOR;
                  const time = taskTimeRangeLabel(t);
                  return (
                    <button key={t.id} type="button" className={`pd-cal-agenda-row ${t.plannedDate ? "planned" : ""}`} style={{ borderLeftColor: col.fg }}
                      onClick={() => chipClick(t)}>
                      <span className="pd-cal-agenda-title">{t.title}</span>
                      <span className="pd-cal-agenda-meta">{time ? `${time} · ` : ""}{t.projectName || "Inbox"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!pendingTaskId && cells.every((c) => !c.inMonth || c.items.length === 0 || c.iso < todayIso) && (
            <p className="pd-empty">Nothing upcoming this month.</p>
          )}
        </div>
      ) : (
        <>
          <div className="pd-cal-dow-row">
            {DOW.map((d, i) => <div key={i} className="pd-cal-dow-label">{d}</div>)}
          </div>
          <div className="pd-cal-month-grid">
            {cells.map((c) => (
              <div key={c.iso} className={`pd-cal-cell ${c.iso === todayIso ? "today" : ""} ${!c.inMonth ? "muted" : ""} ${dragOverIso === c.iso ? "drag-over" : ""}`}
                onDragOver={(e) => dragHandlers.onDragOver(e, c.iso)}
                onDrop={(e) => dragHandlers.onDrop(c.iso, e)}
                onClick={cellClickHandler(c.iso)}>
                <div className="pd-cal-cell-date">{c.date.getDate()}</div>
                <div className="pd-cal-cell-items">
                  {c.items.map((t) => {
                    const col = t.projectColor || INBOX_COLOR;
                    return (
                      <button key={t.id} type="button" className={`pd-cal-chip ${t.plannedDate ? "planned" : ""}`}
                        style={{ background: col.bg, borderLeftColor: col.fg }}
                        draggable={!isMobile}
                        onDragStart={() => dragHandlers.onDragStart(t.id)}
                        onDragEnd={dragHandlers.onDragEnd}
                        onClick={() => chipClick(t)}>
                        {t.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      ))}

      {view === "day" && (
        <>
          {dayPlan && dayPlan.count > 0 && (
            <div className="pd-cal-dayplan">
              <span>{dayPlan.count} task{dayPlan.count === 1 ? "" : "s"} planned{dayPlan.plannedMinutes > 0 ? ` · ${formatMinutes(dayPlan.plannedMinutes)} total` : ""}</span>
              {dayPlan.overlapIds.size > 0 && <span className="pd-cal-dayplan-warn">⚠ overlapping time blocks</span>}
            </div>
          )}
          <HourGrid columns={dayColumnsFlagged} todayIso={todayIso} onOpenTask={chipClick}
            colorFor={(t) => t.projectColor || INBOX_COLOR} isMobile={isMobile} dragHandlers={dragHandlers} dragOverIso={dragOverIso} />
        </>
      )}

      {view === "week" && (isMobile ? (
        <div className="pd-cal-agenda">
          {weekAgendaDays.filter((c) => c.items.length > 0 || pendingTaskId).map((day) => (
            <div key={day.iso} className={`pd-cal-agenda-day ${day.iso === todayIso ? "today" : ""}`}
              onClick={cellClickHandler(day.iso)}>
              <div className="pd-cal-agenda-date">
                <div className="pd-cal-agenda-daynum">{day.date.getDate()}</div>
                <div className="pd-cal-agenda-dow">{day.date.toLocaleDateString(undefined, { weekday: "short" })}</div>
              </div>
              <div className="pd-cal-agenda-items">
                {day.items.length === 0 && <span className="pd-cal-agenda-empty-tap">tap to schedule here</span>}
                {day.items.map((t) => {
                  const col = t.projectColor || INBOX_COLOR;
                  const time = taskTimeRangeLabel(t);
                  return (
                    <button key={t.id} type="button" className={`pd-cal-agenda-row ${t.plannedDate ? "planned" : ""}`} style={{ borderLeftColor: col.fg }}
                      onClick={() => chipClick(t)}>
                      <span className="pd-cal-agenda-title">{t.title}</span>
                      <span className="pd-cal-agenda-meta">{time ? `${time} · ` : ""}{t.projectName || "Inbox"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!pendingTaskId && weekAgendaDays.every((c) => c.items.length === 0) && (
            <p className="pd-empty">Nothing scheduled this week.</p>
          )}
        </div>
      ) : (
        <HourGrid columns={weekColumns} todayIso={todayIso} onOpenTask={chipClick}
          colorFor={(t) => t.projectColor || INBOX_COLOR} isMobile={isMobile} dragHandlers={dragHandlers} dragOverIso={dragOverIso} />
      ))}
    </div>
  );
}
