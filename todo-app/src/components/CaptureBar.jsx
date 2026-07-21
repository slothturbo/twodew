import { useMemo, useState } from "react";
import { parseCapture } from "../lib/capture";
import { fmtDate, todayISO, tomorrowISO, PRIORITY_COLOR } from "../lib/helpers";

function relativeDateLabel(iso) {
  if (iso === todayISO()) return "today";
  if (iso === tomorrowISO()) return "tomorrow";
  return fmtDate(iso);
}

// Universal quick-capture bar: free-typed text -> parseCapture() -> a live chip row
// previewing every detected field before commit. Each chip is dismissable (click to
// discard that one field, in case of a false-positive parse). A task/note mode pill
// lets the user override parseCapture's own note:/idea: prefix detection.
export function CaptureBar({ projects, onCommitTask, onCommitNote, placeholder }) {
  const [text, setText] = useState("");
  const [modeOverride, setModeOverride] = useState(null); // null | "task" | "note"
  const [dismissed, setDismissed] = useState(() => new Set());

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    const p = parseCapture(text, projects);
    if (modeOverride) p.mode = modeOverride;
    if (dismissed.has("deadline")) p.deadline = null;
    if (dismissed.has("time")) { p.startTime = null; p.timeLabel = null; }
    if (dismissed.has("priority")) p.priority = "med";
    if (dismissed.has("estimate")) p.estimateMinutes = null;
    if (dismissed.has("project")) { p.projectId = null; p.projectName = null; }
    if (dismissed.has("contexts")) p.contexts = [];
    return p;
  }, [text, projects, modeOverride, dismissed]);

  const reset = () => { setText(""); setModeOverride(null); setDismissed(new Set()); };

  const commit = () => {
    if (!parsed || !parsed.title) return;
    if (parsed.mode === "note") {
      onCommitNote(parsed.title, parsed.projectId);
    } else {
      onCommitTask(parsed);
    }
    reset();
  };

  const toggleDismiss = (field) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  };

  const effectiveMode = modeOverride || (parsed?.mode ?? "task");
  const toggleMode = () => setModeOverride(effectiveMode === "task" ? "note" : "task");

  const chips = [];
  if (parsed) {
    if (parsed.deadline) chips.push({ field: "deadline", label: relativeDateLabel(parsed.deadline) });
    if (parsed.timeLabel) chips.push({ field: "time", label: parsed.timeLabel.toLowerCase() });
    if (parsed.priority !== "med") chips.push({ field: "priority", label: parsed.priority, color: PRIORITY_COLOR[parsed.priority] });
    if (parsed.estimateMinutes) chips.push({ field: "estimate", label: parsed.estimateMinutes >= 60 ? `~${Math.round(parsed.estimateMinutes / 60)}h` : `~${parsed.estimateMinutes}m` });
    if (parsed.projectId) chips.push({ field: "project", label: parsed.projectName });
    for (const c of parsed.contexts) chips.push({ field: "contexts", label: `@${c}` });
  }

  return (
    <div className="pd-capturebar">
      <div className="pd-capturebar-row">
        <button type="button" className={`pd-capture-mode ${effectiveMode}`} onClick={toggleMode}
          title={effectiveMode === "task" ? "Capturing a task — click for a note" : "Capturing a note — click for a task"}>
          {effectiveMode === "task" ? "task" : "note"}
        </button>
        <input className="pd-topbar-quickadd" placeholder={placeholder}
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") reset();
          }} />
      </div>
      {chips.length > 0 && (
        <div className="pd-capture-chips">
          {chips.map((c, i) => (
            <button type="button" key={`${c.field}-${i}`} className="pd-capture-chip"
              style={c.color ? { color: c.color, borderColor: c.color } : undefined}
              onClick={() => toggleDismiss(c.field)} title="Click to discard this field">
              {c.label} <span>×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
