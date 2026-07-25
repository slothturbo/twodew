import { useRef, useState } from "react";
import { useFocusTrap } from "../lib/hooks";

const LABEL = { saving: "saving…", saved: "saved", offline: "offline", conflict: "sync conflict" };

// Small persistent status pill, fixed to a corner on every screen — replaces the old
// savedFlash toast, which only ever reported after the fact and never showed in-flight
// or offline state. Clicking it while there are unresolved conflicts opens a recovery
// panel so a merge that couldn't be resolved automatically doesn't just quietly happen.
export function SyncStatus({ state, note, conflicts = [], onResolveConflict }) {
  const [open, setOpen] = useState(false);
  const hasConflicts = conflicts.length > 0;
  const panelRef = useRef(null);
  useFocusTrap(panelRef, open && hasConflicts, () => setOpen(false));

  return (
    <div className="pd-sync-wrap">
      <button type="button" className={`pd-sync-pill ${state}`}
        onClick={() => hasConflicts && setOpen((o) => !o)}
        aria-label={`Sync status: ${LABEL[state] || state}`}
        title={hasConflicts ? "Click to review conflicting edits" : (note || LABEL[state])}>
        <span className="pd-sync-dot" />
        <span>{LABEL[state] || state}</span>
      </button>

      {open && hasConflicts && (
        <div ref={panelRef} className="pd-sync-panel" role="dialog" aria-label="Sync conflicts">
          <div className="pd-sync-panel-head">
            <span>{conflicts.length} item{conflicts.length !== 1 ? "s" : ""} need review</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <p className="pd-sync-panel-hint">
            These were edited on two devices at once. Your version is kept by default —
            switch to the other device's version if that one's actually right.
          </p>
          <ul className="pd-sync-conflict-list">
            {conflicts.map((c) => (
              <li key={c.id} className="pd-sync-conflict-row">
                <div className="pd-sync-conflict-title">{c.title || "(untitled)"}</div>
                <div className="pd-sync-conflict-actions">
                  <button type="button" className="pd-sync-conflict-btn active" disabled>keeping mine</button>
                  <button type="button" className="pd-sync-conflict-btn" onClick={() => onResolveConflict?.(c, "remote")}>use other device's</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
