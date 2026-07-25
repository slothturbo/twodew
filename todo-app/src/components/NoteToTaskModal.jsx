import { useMemo, useRef, useState } from "react";
import { htmlToLines } from "../lib/html";
import { useFocusTrap } from "../lib/hooks";

// "Create task" dialog opened from a Brain/project note — title pre-filled by the
// caller (selection or first line), pick a destination (inbox or a project), and
// optionally spin the note's remaining lines into their own tasks too. Never touches
// the source note itself.
export function NoteToTaskModal({ note, prefillTitle, projects, onCreate, onClose }) {
  const [title, setTitle] = useState(prefillTitle);
  const [targetProjectId, setTargetProjectId] = useState(null);
  const [extractChecklist, setExtractChecklist] = useState(false);

  const otherLines = useMemo(() => htmlToLines(note.text).slice(1), [note.text]);
  const canExtract = otherLines.length >= 2;
  const panelRef = useRef(null);
  useFocusTrap(panelRef, true, onClose);

  const submit = () => {
    const clean = title.trim();
    if (!clean) return;
    onCreate(extractChecklist && canExtract ? [clean, ...otherLines] : [clean], targetProjectId);
    onClose();
  };

  return (
    <div className="pd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} className="pd-panel" role="dialog" aria-modal="true" aria-label="Create task from note" style={{ height: "auto" }}>
        <div className="pd-panel-header">
          <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 15 }}>Create task</div>
          <div className="pd-panel-actions">
            <button type="button" onClick={onClose} title="Close" aria-label="Close">✕</button>
          </div>
        </div>
        <div className="pd-panel-body pd-task-edit-body">
          <input className="pd-proj-name" style={{ fontSize: 16 }} value={title} autoFocus
            onChange={(e) => setTitle(e.target.value)} placeholder="Task title"
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />

          <div className="pd-review-section">
            <div className="pd-review-label">Destination</div>
            <div className="pd-review-chiprow">
              <button type="button" className={`pd-review-chip ${targetProjectId === null ? "active" : ""}`}
                onClick={() => setTargetProjectId(null)}>inbox</button>
              {projects.map((p) => (
                <button type="button" key={p.id} className={`pd-review-chip ${targetProjectId === p.id ? "active" : ""}`}
                  onClick={() => setTargetProjectId(p.id)}>{p.name}</button>
              ))}
            </div>
          </div>

          {canExtract && (
            <label className="pd-review-checkbox">
              <input type="checkbox" checked={extractChecklist} onChange={(e) => setExtractChecklist(e.target.checked)} />
              also create a task for each additional line ({otherLines.length})
            </label>
          )}

          <div className="pd-form-row">
            <button type="button" className="pd-nextup-btn" onClick={submit} disabled={!title.trim()}>
              {extractChecklist && canExtract ? `create ${otherLines.length + 1} tasks` : "create task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
