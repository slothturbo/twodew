import { useEffect, useRef } from "react";
import { dayHours, formatClockTime } from "../lib/helpers";

const HOUR_H = 48; // px per hour row — also referenced by the overlap-detection math in Calendar.jsx

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// 24-hour time-block axis, shared by day view (one column) and week view (seven) —
// one implementation of "position a task by its start/end time" rather than two.
export function HourGrid({ columns, todayIso, onOpenTask, colorFor, dragHandlers, isMobile, dragOverIso }) {
  const hours = dayHours();
  const hasAllDay = columns.some((c) => c.allDay.length > 0);
  const now = new Date();
  const nowTop = (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_H;
  const scrollRef = useRef(null);

  // Lands on something useful instead of always opening at midnight — "now" if today's
  // in view, else the earliest scheduled block, else a plain default mid-morning.
  useEffect(() => {
    if (!scrollRef.current) return;
    const earliestStart = columns.flatMap((c) => c.timed).map((t) => toMinutes(t.startTime));
    const targetMin = columns.some((c) => c.iso === todayIso)
      ? now.getHours() * 60 + now.getMinutes()
      : (earliestStart.length ? Math.min(...earliestStart) : 7 * 60);
    scrollRef.current.scrollTop = Math.max(0, (targetMin / 60) * HOUR_H - 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.map((c) => c.iso).join(",")]);

  return (
    <div className="pd-hourgrid">
      <div className="pd-hourgrid-headrow">
        <div className="pd-hourgrid-axis-spacer" />
        {columns.map((col) => (
          <div key={col.iso} className={`pd-hourgrid-colhead ${col.iso === todayIso ? "today" : ""}`}>
            <span className="pd-hourgrid-daynum">{col.date.getDate()}</span>
            <span className="pd-hourgrid-dow">{col.date.toLocaleDateString(undefined, { weekday: "short" })}</span>
          </div>
        ))}
      </div>
      {hasAllDay && (
        <div className="pd-hourgrid-alldayrow">
          <div className="pd-hourgrid-axis-spacer" />
          {columns.map((col) => (
            <div key={col.iso} className={`pd-hourgrid-alldaycell ${dragOverIso === col.iso ? "drag-over" : ""}`}
              onDragOver={dragHandlers ? (e) => dragHandlers.onDragOver(e, col.iso) : undefined}
              onDrop={dragHandlers ? (e) => dragHandlers.onDrop(col.iso, e) : undefined}
              onClick={dragHandlers ? (e) => { if (e.target === e.currentTarget) dragHandlers.onDrop(col.iso, e); } : undefined}>
              {col.allDay.map((t) => (
                <button key={t.id} type="button" className={`pd-hourgrid-allday-chip ${t.plannedDate ? "planned" : ""}`}
                  style={{ borderLeftColor: colorFor(t).fg }}
                  draggable={!isMobile && !!dragHandlers}
                  onDragStart={dragHandlers ? () => dragHandlers.onDragStart(t.id) : undefined}
                  onDragEnd={dragHandlers ? () => dragHandlers.onDragEnd?.() : undefined}
                  onClick={() => onOpenTask(t)}>
                  {t.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="pd-hourgrid-scroll" ref={scrollRef}>
        <div className="pd-hourgrid-body" style={{ height: `${24 * HOUR_H}px` }}>
          <div className="pd-hourgrid-axis">
            {hours.map((h) => <div key={h.h} className="pd-hourgrid-hourlabel" style={{ top: `${h.h * HOUR_H}px` }}>{h.label}</div>)}
          </div>
          {columns.map((col) => (
            <div key={col.iso} className={`pd-hourgrid-col ${col.iso === todayIso ? "today" : ""} ${dragOverIso === col.iso ? "drag-over" : ""}`}
              onDragOver={dragHandlers ? (e) => dragHandlers.onDragOver(e, col.iso) : undefined}
              onDrop={dragHandlers ? (e) => dragHandlers.onDrop(col.iso, e) : undefined}
              onClick={dragHandlers ? (e) => { if (e.target === e.currentTarget) dragHandlers.onDrop(col.iso, e); } : undefined}>
              {hours.map((h) => <div key={h.h} className="pd-hourgrid-hourline" style={{ top: `${h.h * HOUR_H}px` }} />)}
              {col.iso === todayIso && <div className="pd-hourgrid-now" style={{ top: `${nowTop}px` }} />}
              {col.timed.map((t) => {
                const startMin = toMinutes(t.startTime);
                const endMin = t.endTime ? toMinutes(t.endTime) : startMin + 30;
                const top = (startMin / 60) * HOUR_H;
                const height = Math.max(22, ((endMin - startMin) / 60) * HOUR_H);
                const c = colorFor(t);
                return (
                  <button key={t.id} type="button" className={`pd-hourgrid-block ${t.plannedDate ? "planned" : ""} ${t.overbooked ? "overbooked" : ""}`}
                    style={{ top, height, background: c.bg, borderLeftColor: c.fg }}
                    draggable={!isMobile && !!dragHandlers}
                    onDragStart={dragHandlers ? () => dragHandlers.onDragStart(t.id) : undefined}
                    onDragEnd={dragHandlers ? () => dragHandlers.onDragEnd?.() : undefined}
                    onClick={() => onOpenTask(t)}>
                    <span className="pd-hourgrid-block-title">{t.title}</span>
                    <span className="pd-hourgrid-block-time">{formatClockTime(t.startTime)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { HOUR_H };
