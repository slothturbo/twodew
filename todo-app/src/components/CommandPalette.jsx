import { useEffect, useMemo, useRef, useState } from "react";
import { colorOf } from "../lib/helpers";
import { useFocusTrap } from "../lib/hooks";

const SCREEN_RESULTS = [
  { key: "today", label: "Today" },
  { key: "tasks", label: "Tasks" },
  { key: "brain", label: "Brain" },
  { key: "projects", label: "Projects" },
  { key: "calendar", label: "Calendar" },
  { key: "stats", label: "Insights" },
];

// Global Cmd/Ctrl+K palette: jump to a screen, a project, or a task, or run a
// couple of cheap quick-actions (add task / new project) from wherever you are.
export function CommandPalette({ open, onClose, projects, inbox, onNavigateScreen, onOpenProject, onOpenTask, onAddTask, onNewProject }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  // Tab-trapping + return-focus-on-close via the shared hook; Escape is also handled
  // here (document-level) instead of only in the input's own onKeyDown, so it still
  // works if focus is ever moved off the input.
  useFocusTrap(panelRef, open, onClose);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const taskIndex = useMemo(() => [
    ...inbox.map((t) => ({ ...t, projectId: null, projectName: null, projectColor: null })),
    ...projects.flatMap((p) => p.tasks.map((t) => ({ ...t, projectId: p.id, projectName: p.name, projectColor: colorOf(p) }))),
  ], [projects, inbox]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const screens = SCREEN_RESULTS
      .filter((s) => !q || s.label.toLowerCase().includes(q))
      .map((s) => ({ type: "screen", id: s.key, title: s.label, meta: "Go to screen" }));
    const projectResults = projects
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((p) => ({ type: "project", id: p.id, title: p.name, meta: "Project", color: colorOf(p).fg }));
    const taskResults = (q ? taskIndex.filter((t) => t.title.toLowerCase().includes(q)) : [])
      .slice(0, 30)
      .map((t) => ({ type: "task", id: t.id, title: t.title, meta: t.projectName || "Inbox", task: t, color: t.projectColor?.fg }));
    const actions = [];
    if (q) {
      actions.push({ type: "action-task", id: "__new-task", title: `Add task "${query.trim()}"`, meta: "Quick action" });
      actions.push({ type: "action-project", id: "__new-project", title: `New project "${query.trim()}"`, meta: "Quick action" });
    }
    return [...screens, ...projectResults, ...taskResults, ...actions].slice(0, 40);
  }, [query, projects, taskIndex]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const select = (r) => {
    if (!r) return;
    if (r.type === "screen") onNavigateScreen(r.id);
    else if (r.type === "project") onOpenProject(r.id);
    else if (r.type === "task") { if (r.task.projectId) onOpenProject(r.task.projectId); else onOpenTask(r.task); }
    else if (r.type === "action-task") onAddTask(query.trim());
    else if (r.type === "action-project") onNewProject(query.trim());
    onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); select(results[activeIdx]); }
    // Escape is handled by useFocusTrap at the document level, not here.
  };

  if (!open) return null;

  return (
    <div className="pd-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} className="pd-panel pd-palette-panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <input ref={inputRef} className="pd-palette-input" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown} placeholder="Search or jump to…" aria-label="Command palette search" />
        <div className="pd-palette-results">
          {results.length === 0 ? (
            <div className="pd-palette-empty">No matches.</div>
          ) : (
            results.map((r, i) => (
              <button key={`${r.type}-${r.id}`} type="button"
                className={`pd-palette-row ${i === activeIdx ? "active" : ""}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => select(r)}>
                {r.color && <span className="pd-palette-dot" style={{ background: r.color }} />}
                <span className="pd-palette-title">{r.title}</span>
                <span className="pd-palette-meta">{r.meta}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
