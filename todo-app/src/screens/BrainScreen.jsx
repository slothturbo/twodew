import { useMemo, useState } from "react";
import { Bubble } from "../components/Bubble";
import { colorOf } from "../lib/helpers";

// Standalone notes have no project to borrow a color from — neutral accent tint.
const STANDALONE_COLOR = { fg: "var(--accent)", bg: "rgba(255,90,46,0.07)" };

/* ------------------------------------------------------------------ */
/*  Brain screen — every note in one place: standalone captures plus    */
/*  each project's notes (tagged with their project).                   */
/*  No reordering here — order is newest-first; reorder lives on the    */
/*  per-project view.                                                   */
/* ------------------------------------------------------------------ */
export function BrainScreen({ projects, notes, isMobile, onSaveNote, onDeleteNote, onDropImages, onCreateTask }) {
  const [dragOver, setDragOver] = useState(false);

  const allNotes = useMemo(() => [
    ...notes.map((n) => ({ ...n, projectName: null, color: STANDALONE_COLOR })),
    ...projects.flatMap((p) => p.notes.map((n) => ({ ...n, projectName: p.name, color: colorOf(p) }))),
  ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [notes, projects]);

  const onDragOver = (e) => {
    if ([...(e.dataTransfer?.items || [])].some((i) => i.kind === "file")) {
      e.preventDefault();
      setDragOver(true);
    }
  };
  const onDragLeave = (e) => {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
  };
  const onDrop = (e) => {
    setDragOver(false);
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); onDropImages(files); }
  };

  return (
    <div className={`pd-notes ${dragOver ? "dragover" : ""}`}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {allNotes.length === 0 ? (
        <p className="pd-empty">No notes yet. Capture a thought in the bar above, or drop an image anywhere here.</p>
      ) : (
        <div className="pd-notes-grid">
          {allNotes.map((n) => (
            <div key={n.id} className="pd-notes-cell">
              <Bubble note={n} color={n.color} isMobile={isMobile}
                onSave={(text) => onSaveNote(n.id, text)}
                onDelete={() => onDeleteNote(n)}
                onCreateTask={onCreateTask} />
              <div className="pd-notes-source" style={n.projectName ? { color: n.color.fg } : undefined}>
                {n.projectName || "note"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
