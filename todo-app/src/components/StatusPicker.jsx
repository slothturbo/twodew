import { createPortal } from "react-dom";
import { STATUS_LABEL, STATUS_COLOR } from "../lib/helpers";

const STATUS_VALUES = ["active", "waiting", "someday", "completed", "archived"];

// Small fixed-set popover for a project's status — same portaled-scrim pattern as
// MoveMenu/DeferMenu, but a closed 5-value enum rather than a project/task list.
export function StatusPicker({ x, y, value, onSelect, onClose }) {
  const left = Math.min(x, window.innerWidth - 180);
  const top = Math.min(y, window.innerHeight - 220);
  return createPortal(
    <>
      <div className="pd-task-menu-scrim" onClick={onClose} onTouchStart={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="pd-task-menu pd-status-menu" style={{ left, top }} role="menu">
        {STATUS_VALUES.map((s) => (
          <button type="button" role="menuitem" key={s} className={s === value ? "active" : ""}
            onClick={() => onSelect(s)}>
            <span className="pd-status-dot" style={{ background: STATUS_COLOR[s] }} />
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
    </>,
    document.body
  );
}
