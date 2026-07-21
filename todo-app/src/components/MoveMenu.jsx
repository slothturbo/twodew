import { createPortal } from "react-dom";

// Small project-picker popover for "move to project" — same portaled-scrim pattern as
// TaskMenu/DeferMenu. `currentProjectId` is null for an inbox task.
export function MoveMenu({ x, y, projects, currentProjectId, onSelect, onClose }) {
  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.min(y, window.innerHeight - 300);
  return createPortal(
    <>
      <div className="pd-task-menu-scrim" onClick={onClose} onTouchStart={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="pd-task-menu pd-move-menu" style={{ left, top }} role="menu">
        {currentProjectId !== null && (
          <button type="button" role="menuitem" onClick={() => onSelect(null)}>inbox</button>
        )}
        {projects.filter((p) => p.id !== currentProjectId).map((p) => (
          <button type="button" role="menuitem" key={p.id} onClick={() => onSelect(p.id)}>{p.name}</button>
        ))}
      </div>
    </>,
    document.body
  );
}
