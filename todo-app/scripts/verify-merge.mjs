// Deterministic checks for the 3-way merge in src/lib/merge.js — no test framework,
// no browser needed. Run with: node scripts/verify-merge.mjs
import assert from "node:assert/strict";
import { mergeWorkspace } from "../src/lib/merge.js";

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

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`ok  - ${name}`);
}

// ---- Scenario 1: concurrent edits to two different tasks — both must survive ----
check("concurrent edits to different tasks both survive, no conflict", () => {
  const base = workspace({ inbox: [{ id: "a", title: "Task A" }, { id: "b", title: "Task B" }] });
  const local = workspace({ inbox: [{ id: "a", title: "Task A (edited locally)" }, { id: "b", title: "Task B" }] });
  const remote = workspace({ inbox: [{ id: "a", title: "Task A" }, { id: "b", title: "Task B (edited remotely)" }] });

  const { merged, conflicts } = mergeWorkspace(base, local, remote);
  assert.equal(conflicts.length, 0);
  assert.equal(merged.inbox.find((t) => t.id === "a").title, "Task A (edited locally)");
  assert.equal(merged.inbox.find((t) => t.id === "b").title, "Task B (edited remotely)");
});

// ---- Scenario 2: concurrent edits to the SAME task, differently — a real conflict ----
check("concurrent edits to the same task: local wins live, conflict recorded with both versions", () => {
  const base = workspace({ inbox: [{ id: "a", title: "Task A" }] });
  const local = workspace({ inbox: [{ id: "a", title: "Task A (local wins)" }] });
  const remote = workspace({ inbox: [{ id: "a", title: "Task A (remote version)" }] });

  const { merged, conflicts } = mergeWorkspace(base, local, remote);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].type, "task");
  assert.equal(conflicts[0].id, "a");
  assert.equal(conflicts[0].local.title, "Task A (local wins)");
  assert.equal(conflicts[0].remote.title, "Task A (remote version)");
  assert.equal(merged.inbox.find((t) => t.id === "a").title, "Task A (local wins)");
});

check("same content on both sides after a change is not a conflict", () => {
  const base = workspace({ inbox: [{ id: "a", title: "Task A" }] });
  const local = workspace({ inbox: [{ id: "a", title: "Task A (same edit)" }] });
  const remote = workspace({ inbox: [{ id: "a", title: "Task A (same edit)" }] });

  const { merged, conflicts } = mergeWorkspace(base, local, remote);
  assert.equal(conflicts.length, 0);
  assert.equal(merged.inbox.find((t) => t.id === "a").title, "Task A (same edit)");
});

check("a delete respected when the other side didn't touch the item; a delete vs an edit is flagged", () => {
  const base = workspace({ inbox: [{ id: "a", title: "Task A" }, { id: "b", title: "Task B" }] });
  const local = workspace({ inbox: [{ id: "b", title: "Task B (edited)" }] }); // deleted "a", edited "b"
  const remote = workspace({ inbox: [{ id: "a", title: "Task A" }, { id: "b", title: "Task B" }] }); // untouched

  const { merged, conflicts } = mergeWorkspace(base, local, remote);
  assert.equal(merged.inbox.some((t) => t.id === "a"), false, "untouched-remote deletion should be respected");
  assert.equal(merged.inbox.find((t) => t.id === "b").title, "Task B (edited)");
  assert.equal(conflicts.length, 0);

  // Now: remote edited "a" after local deleted it — never silently destroy the edit.
  const remote2 = workspace({ inbox: [{ id: "a", title: "Task A (edited remotely after local delete)" }, { id: "b", title: "Task B" }] });
  const result2 = mergeWorkspace(base, local, remote2);
  assert.equal(result2.merged.inbox.some((t) => t.id === "a"), true, "an edit after a delete must not be silently destroyed");
  assert.equal(result2.conflicts.length, 1);
  assert.equal(result2.conflicts[0].type, "edit-vs-delete");
});

// ---- Scenario 3: concurrent same-day completionLog increments — must sum, not overwrite ----
check("concurrent completionLog increments on the same day sum exactly", () => {
  const base = workspace({ completionLog: { "2026-07-21": 3 } });
  const local = workspace({ completionLog: { "2026-07-21": 5 } }); // +2 locally
  const remote = workspace({ completionLog: { "2026-07-21": 4 } }); // +1 remotely

  const { merged } = mergeWorkspace(base, local, remote);
  assert.equal(merged.completionLog["2026-07-21"], 6, "3 base + 2 local + 1 remote = 6");
});

check("a brand-new day only one side touched is kept as-is", () => {
  const base = workspace({ completionLog: {} });
  const local = workspace({ completionLog: { "2026-07-22": 1 } });
  const remote = workspace({ completionLog: {} });

  const { merged } = mergeWorkspace(base, local, remote);
  assert.equal(merged.completionLog["2026-07-22"], 1);
});

// ---- Nested: project tasks merge the same way as top-level entities ----
check("nested project tasks merge independently, same as inbox", () => {
  const proj = (tasks) => ({ id: "p1", name: "Project", tasks, notes: [] });
  const base = workspace({ projects: [proj([{ id: "t1", title: "T1" }, { id: "t2", title: "T2" }])] });
  const local = workspace({ projects: [proj([{ id: "t1", title: "T1 (local)" }, { id: "t2", title: "T2" }])] });
  const remote = workspace({ projects: [proj([{ id: "t1", title: "T1" }, { id: "t2", title: "T2 (remote)" }])] });

  const { merged, conflicts } = mergeWorkspace(base, local, remote);
  assert.equal(conflicts.length, 0);
  const p = merged.projects.find((x) => x.id === "p1");
  assert.equal(p.tasks.find((t) => t.id === "t1").title, "T1 (local)");
  assert.equal(p.tasks.find((t) => t.id === "t2").title, "T2 (remote)");
});

console.log(`\n${passed} passed.`);
