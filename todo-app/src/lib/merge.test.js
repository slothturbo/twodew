import { describe, it, expect } from "vitest";
import { mergeWorkspace } from "./merge";

function workspace(overrides = {}) {
  return {
    projects: [],
    inbox: [],
    notes: [],
    completionLog: {},
    focusLog: {},
    lastResetDate: "2026-01-01",
    runningTaskId: null,
    runStart: null,
    lastSelectedId: null,
    ...overrides,
  };
}

describe("mergeWorkspace", () => {
  it("keeps concurrent edits to two different tasks, with no conflict", () => {
    const base = workspace({ inbox: [{ id: "a", title: "Task A" }, { id: "b", title: "Task B" }] });
    const local = workspace({ inbox: [{ id: "a", title: "Task A (edited locally)" }, { id: "b", title: "Task B" }] });
    const remote = workspace({ inbox: [{ id: "a", title: "Task A" }, { id: "b", title: "Task B (edited remotely)" }] });

    const { merged, conflicts } = mergeWorkspace(base, local, remote);
    expect(conflicts).toHaveLength(0);
    expect(merged.inbox.find((t) => t.id === "a").title).toBe("Task A (edited locally)");
    expect(merged.inbox.find((t) => t.id === "b").title).toBe("Task B (edited remotely)");
  });

  it("records a conflict for concurrent edits to the SAME task, local wins live", () => {
    const base = workspace({ inbox: [{ id: "a", title: "Task A" }] });
    const local = workspace({ inbox: [{ id: "a", title: "Task A (local wins)" }] });
    const remote = workspace({ inbox: [{ id: "a", title: "Task A (remote version)" }] });

    const { merged, conflicts } = mergeWorkspace(base, local, remote);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ type: "task", id: "a" });
    expect(conflicts[0].local.title).toBe("Task A (local wins)");
    expect(conflicts[0].remote.title).toBe("Task A (remote version)");
    expect(merged.inbox.find((t) => t.id === "a").title).toBe("Task A (local wins)");
  });

  it("does not flag a conflict when both sides independently made the identical edit", () => {
    const base = workspace({ inbox: [{ id: "a", title: "Task A" }] });
    const local = workspace({ inbox: [{ id: "a", title: "Task A (same edit)" }] });
    const remote = workspace({ inbox: [{ id: "a", title: "Task A (same edit)" }] });

    const { merged, conflicts } = mergeWorkspace(base, local, remote);
    expect(conflicts).toHaveLength(0);
    expect(merged.inbox.find((t) => t.id === "a").title).toBe("Task A (same edit)");
  });

  it("respects a delete the other side didn't touch, but never silently destroys an edit made after a delete", () => {
    const base = workspace({ inbox: [{ id: "a", title: "Task A" }, { id: "b", title: "Task B" }] });
    const local = workspace({ inbox: [{ id: "b", title: "Task B (edited)" }] }); // deleted "a", edited "b"
    const remoteUntouched = workspace({ inbox: [{ id: "a", title: "Task A" }, { id: "b", title: "Task B" }] });

    const untouched = mergeWorkspace(base, local, remoteUntouched);
    expect(untouched.merged.inbox.some((t) => t.id === "a")).toBe(false);
    expect(untouched.merged.inbox.find((t) => t.id === "b").title).toBe("Task B (edited)");
    expect(untouched.conflicts).toHaveLength(0);

    // Remote edited "a" after local deleted it — the edit must survive and be flagged.
    const remoteEdited = workspace({
      inbox: [{ id: "a", title: "Task A (edited remotely after local delete)" }, { id: "b", title: "Task B" }],
    });
    const edited = mergeWorkspace(base, local, remoteEdited);
    expect(edited.merged.inbox.some((t) => t.id === "a")).toBe(true);
    expect(edited.conflicts).toHaveLength(1);
    expect(edited.conflicts[0].type).toBe("edit-vs-delete");
  });

  it("sums concurrent same-day completionLog increments exactly, rather than one overwriting the other", () => {
    const base = workspace({ completionLog: { "2026-07-21": 3 } });
    const local = workspace({ completionLog: { "2026-07-21": 5 } }); // +2 locally
    const remote = workspace({ completionLog: { "2026-07-21": 4 } }); // +1 remotely

    const { merged } = mergeWorkspace(base, local, remote);
    expect(merged.completionLog["2026-07-21"]).toBe(6); // 3 base + 2 local + 1 remote
  });

  it("keeps a brand-new day only one side touched as-is", () => {
    const base = workspace({ completionLog: {} });
    const local = workspace({ completionLog: { "2026-07-22": 1 } });
    const remote = workspace({ completionLog: {} });

    const { merged } = mergeWorkspace(base, local, remote);
    expect(merged.completionLog["2026-07-22"]).toBe(1);
  });

  it("merges nested project tasks independently, same as inbox", () => {
    const proj = (tasks) => ({ id: "p1", name: "Project", tasks, notes: [] });
    const base = workspace({ projects: [proj([{ id: "t1", title: "T1" }, { id: "t2", title: "T2" }])] });
    const local = workspace({ projects: [proj([{ id: "t1", title: "T1 (local)" }, { id: "t2", title: "T2" }])] });
    const remote = workspace({ projects: [proj([{ id: "t1", title: "T1" }, { id: "t2", title: "T2 (remote)" }])] });

    const { merged, conflicts } = mergeWorkspace(base, local, remote);
    expect(conflicts).toHaveLength(0);
    const p = merged.projects.find((x) => x.id === "p1");
    expect(p.tasks.find((t) => t.id === "t1").title).toBe("T1 (local)");
    expect(p.tasks.find((t) => t.id === "t2").title).toBe("T2 (remote)");
  });
});
