import { useMemo, useState } from "react";
import { todayISO, colorOf, MONTHS, DOW, taskTimeRangeLabel, monthGridCells } from "../lib/helpers";

const INBOX_COLOR = { fg: "var(--muted)", bg: "rgba(140,150,163,0.12)" };

/* ------------------------------------------------------------------ */
/*  Calendar screen — month/week/day planning surface. A task is placed  */
/*  on plannedDate when set, falling back to deadline (identical to      */
/*  today's behavior for any task that never uses plannedDate).          */
/* ------------------------------------------------------------------ */
export function CalendarScreen({ projects, inbox, isMobile, onOpenProject, onOpenTask }) {
  const [view, setView] = useState("month"); // "month" | "week" | "day"
  const [cursor, setCursor] = useState(new Date());
  const [showUnscheduled, setShowUnscheduled] = useState(!isMobile);
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

  const nav = (delta) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + delta);
    else if (view === "week") d.setDate(d.getDate() + delta * 7);
    else d.setDate(d.getDate() + delta);
    setCursor(d);
  };
  const goToday = () => setCursor(new Date());

  const openTask = (t) => (t.projectId ? onOpenProject(t.projectId) : onOpenTask(t));

  const headLabel = view === "month" ? `${MONTHS[viewM]}` : cursor.toLocaleDateString(undefined, { month: "long", day: view === "day" ? "numeric" : undefined });

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
                  <button key={t.id} type="button" className="pd-cal-unscheduled-chip" style={{ borderLeftColor: col.fg }}
                    onClick={() => openTask(t)}>
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
          {cells.filter((c) => c.inMonth && c.items.length > 0 && c.iso >= todayIso).map((day) => (
            <div key={day.iso} className={`pd-cal-agenda-day ${day.iso === todayIso ? "today" : ""}`}>
              <div className="pd-cal-agenda-date">
                <div className="pd-cal-agenda-daynum">{day.date.getDate()}</div>
                <div className="pd-cal-agenda-dow">{day.date.toLocaleDateString(undefined, { weekday: "short" })}</div>
              </div>
              <div className="pd-cal-agenda-items">
                {day.items.map((t) => {
                  const col = t.projectColor || INBOX_COLOR;
                  const time = taskTimeRangeLabel(t);
                  return (
                    <button key={t.id} type="button" className={`pd-cal-agenda-row ${t.plannedDate ? "planned" : ""}`} style={{ borderLeftColor: col.fg }}
                      onClick={() => openTask(t)}>
                      <span className="pd-cal-agenda-title">{t.title}</span>
                      <span className="pd-cal-agenda-meta">{time ? `${time} · ` : ""}{t.projectName || "Inbox"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {cells.every((c) => !c.inMonth || c.items.length === 0 || c.iso < todayIso) && (
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
              <div key={c.iso} className={`pd-cal-cell ${c.iso === todayIso ? "today" : ""} ${!c.inMonth ? "muted" : ""}`}>
                <div className="pd-cal-cell-date">{c.date.getDate()}</div>
                <div className="pd-cal-cell-items">
                  {c.items.map((t) => {
                    const col = t.projectColor || INBOX_COLOR;
                    return (
                      <button key={t.id} type="button" className={`pd-cal-chip ${t.plannedDate ? "planned" : ""}`}
                        style={{ background: col.bg, borderLeftColor: col.fg }}
                        onClick={() => openTask(t)}>
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

      {(view === "week" || view === "day") && (
        <p className="pd-empty">{view === "week" ? "Week" : "Day"} view — coming next.</p>
      )}
    </div>
  );
}
