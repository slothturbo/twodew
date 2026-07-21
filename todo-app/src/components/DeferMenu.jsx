import { createPortal } from "react-dom";

// Reusable defer/snooze popover — same portaled-scrim pattern as Today's TaskMenu, so
// it works identically wherever it's opened from (Next Up card, a task's long-press
// menu, or the task detail editor). `onPickDate` is separate from `onSelect` because
// "pick a date" doesn't compute a destination here — it hands off to whatever full
// date picker the caller already has (there's no reason to build a second one).
export function DeferMenu({ x, y, onSelect, onPickDate, onClose }) {
  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.min(y, window.innerHeight - 270);
  return createPortal(
    <>
      <div className="pd-task-menu-scrim" onClick={onClose} onTouchStart={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="pd-task-menu pd-defer-menu" style={{ left, top }} role="menu">
        <button type="button" role="menuitem" onClick={() => onSelect("later")}>later today</button>
        <button type="button" role="menuitem" onClick={() => onSelect("tomorrow")}>tomorrow</button>
        <button type="button" role="menuitem" onClick={() => onSelect("weekend")}>this weekend</button>
        <button type="button" role="menuitem" onClick={() => onSelect("nextweek")}>next week</button>
        <button type="button" role="menuitem" onClick={onPickDate}>pick a date…</button>
        <button type="button" role="menuitem" onClick={() => onSelect("inbox")}>remove date / inbox</button>
      </div>
    </>,
    document.body
  );
}
