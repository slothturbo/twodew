import { useMemo, useState } from "react";
import { todayISO, colorOf, pad, MONTHS, DOW, taskTimeRangeLabel } from "../lib/helpers";

const INBOX_COLOR = { fg: "var(--muted)", bg: "rgba(140,150,163,0.12)" };

/* ------------------------------------------------------------------ */
/*  Calendar screen — full month grid of tasks by deadline, across      */
/*  everything                                                          */
/* ------------------------------------------------------------------ */
export function CalendarScreen({ projects, inbox, isMobile, onOpenProject, onOpenTask }) {
  const today = new Date();
  const [viewY, setViewY] = useState(today.getFullYear());
  const [viewM, setViewM] = useState(today.getMonth());
  const todayIso = todayISO();

  const allTasks = useMemo(() => [
    ...inbox.map((t) => ({ ...t, projectId: null, projectName: null, projectColor: null })),
    ...projects.flatMap((p) => p.tasks.map((t) => ({ ...t, projectId: p.id, projectName: p.name, projectColor: colorOf(p) }))),
  ], [projects, inbox]);

  const byDate = useMemo(() => {
    const map = {};
    allTasks.forEach((t) => { if (t.deadline) (map[t.deadline] ||= []).push(t); });
    return map;
  }, [allTasks]);

  const cells = useMemo(() => {
    const first = new Date(viewY, viewM, 1);
    const gridStart = new Date(viewY, viewM, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const items = [...(byDate[iso] || [])].sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));
      return { date: d, iso, inMonth: d.getMonth() === viewM, items };
    });
  }, [viewY, viewM, byDate]);

  const nav = (delta) => {
    let m = viewM + delta, y = viewY;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setViewM(m); setViewY(y);
  };
  const goToday = () => { const t = new Date(); setViewY(t.getFullYear()); setViewM(t.getMonth()); };

  return (
    <div className="pd-calendar">
      <div className="pd-cal-head">
        <div className="pd-cal-monthyear">
          <div className="pd-cal-month">{MONTHS[viewM]}</div>
          <div className="pd-cal-year">{viewY}</div>
        </div>
        <div className="pd-cal-nav">
          <button type="button" onClick={goToday}>today</button>
          <button type="button" onClick={() => nav(-1)} aria-label="Previous month">‹</button>
          <button type="button" onClick={() => nav(1)} aria-label="Next month">›</button>
        </div>
      </div>
      {isMobile ? (
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
                    <button key={t.id} type="button" className="pd-cal-agenda-row" style={{ borderLeftColor: col.fg }}
                      onClick={() => (t.projectId ? onOpenProject(t.projectId) : onOpenTask(t))}>
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
                      <button key={t.id} type="button" className="pd-cal-chip" style={{ background: col.bg, borderLeftColor: col.fg }}
                        onClick={() => (t.projectId ? onOpenProject(t.projectId) : onOpenTask(t))}>
                        {t.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
