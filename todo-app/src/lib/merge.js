// 3-way merge for the workspace blob — used when a realtime update arrives while a
// local write is still pending, so a concurrent edit on another device gets folded in
// instead of either being dropped or blindly overwriting local state.
//
// `base` is the workspace as of the last point local and the server were known to
// agree (see syncBaseRef in App.jsx). Entity arrays (projects, inbox, notes, and each
// project's nested tasks/notes) merge by id; date-keyed logs merge by summing each
// side's delta from base (exact for "both devices independently incremented the same
// day," not a heuristic); scalar fields prefer whichever side actually changed,
// local winning if both did — losing "which task was highlighted" isn't data loss.
//
// Pure and DOM-free on purpose, so it can be exercised directly from a plain Node
// script (see scripts/verify-merge.mjs) without a browser.

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function titleOf(item) {
  if (!item) return "";
  if (item.title) return item.title;
  if (item.name) return item.name;
  if (item.text) return item.text.replace(/<[^>]+>/g, "").slice(0, 60) || "(note)";
  return "";
}

// Generic leaf merge for anything compared as a whole (a task, a note, a project's
// own fields). Returns the item to keep plus any conflict found (empty array if none).
function mergeGenericLeaf(type, base, local, remote) {
  const localChanged = !deepEqual(local, base);
  const remoteChanged = !deepEqual(remote, base);
  if (!localChanged) return { item: remote, conflicts: [] };
  if (!remoteChanged) return { item: local, conflicts: [] };
  if (deepEqual(local, remote)) return { item: local, conflicts: [] };
  return { item: local, conflicts: [{ type, id: local.id, title: titleOf(local), base, local, remote }] };
}

// 3-way merge of an array of {id, ...}-shaped entities.
function mergeById(baseArr, localArr, remoteArr, mergeLeaf) {
  const baseMap = new Map((baseArr || []).map((x) => [x.id, x]));
  const localMap = new Map((localArr || []).map((x) => [x.id, x]));
  const remoteMap = new Map((remoteArr || []).map((x) => [x.id, x]));
  // Local's order first (so a device's own reordering sticks), then any remote-only
  // new items appended at the end.
  const orderedIds = [...localMap.keys(), ...[...remoteMap.keys()].filter((id) => !localMap.has(id))];

  const merged = [];
  const conflicts = [];
  for (const id of orderedIds) {
    const b = baseMap.get(id), l = localMap.get(id), r = remoteMap.get(id);
    if (l && !b && !r) { merged.push(l); continue; } // new local item
    if (r && !b && !l) { merged.push(r); continue; } // new remote item
    if (b && !l && !r) { continue; } // deleted on both sides
    if (!b && l && r) {
      // Same id created independently on both sides (uid() collision — vanishingly
      // rare, but don't silently drop one if it somehow happens).
      if (!deepEqual(l, r)) conflicts.push({ type: "create-conflict", id, title: titleOf(l), base: null, local: l, remote: r });
      merged.push(l);
      continue;
    }
    if (b && !l && r) {
      // Deleted locally; still present remotely — respect the deletion unless remote
      // edited it after local's delete, in which case keep the edit and flag it
      // (never let a delete silently destroy work the other device just did).
      if (!deepEqual(r, b)) { merged.push(r); conflicts.push({ type: "edit-vs-delete", id, title: titleOf(r), base: b, local: null, remote: r }); }
      continue;
    }
    if (b && l && !r) {
      // Deleted remotely; still present locally — same rule, mirrored.
      if (!deepEqual(l, b)) { merged.push(l); conflicts.push({ type: "edit-vs-delete", id, title: titleOf(l), base: b, local: l, remote: null }); }
      continue;
    }
    // Present in base, local, and remote.
    const { item, conflicts: c } = mergeLeaf(b, l, r);
    merged.push(item);
    conflicts.push(...c);
  }
  return { merged, conflicts };
}

function mergeProjectLeaf(base, local, remote) {
  const strip = (p) => { const { tasks, notes, ...rest } = p; return rest; };
  const shallow = mergeGenericLeaf("project", strip(base), strip(local), strip(remote));
  const tasksResult = mergeById(base.tasks, local.tasks, remote.tasks, (b, l, r) => mergeGenericLeaf("task", b, l, r));
  const notesResult = mergeById(base.notes, local.notes, remote.notes, (b, l, r) => mergeGenericLeaf("note", b, l, r));
  return {
    item: { ...shallow.item, tasks: tasksResult.merged, notes: notesResult.merged },
    conflicts: [...shallow.conflicts, ...tasksResult.conflicts, ...notesResult.conflicts],
  };
}

// Date-keyed counters (completionLog/focusLog) merge by summing each side's delta
// from base — exact for two devices independently incrementing the same day.
function mergeLog(base, local, remote) {
  base = base || {}; local = local || {}; remote = remote || {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  const merged = {};
  for (const k of keys) {
    const b = base[k] || 0, l = local[k] || 0, r = remote[k] || 0;
    const v = b + (l - b) + (r - b); // = l + r - b
    if (v > 0) merged[k] = v;
  }
  return merged;
}

// Single-owner fields — prefer whichever side actually changed; local wins if both did.
function mergeScalar(base, local, remote) {
  return local !== base ? local : remote;
}

export function mergeWorkspace(base, local, remote) {
  const b = base || {}, l = local || {}, r = remote || {};
  const projects = mergeById(b.projects, l.projects, r.projects, mergeProjectLeaf);
  const inbox = mergeById(b.inbox, l.inbox, r.inbox, (bb, ll, rr) => mergeGenericLeaf("task", bb, ll, rr));
  const notes = mergeById(b.notes, l.notes, r.notes, (bb, ll, rr) => mergeGenericLeaf("note", bb, ll, rr));

  return {
    merged: {
      projects: projects.merged,
      inbox: inbox.merged,
      notes: notes.merged,
      completionLog: mergeLog(b.completionLog, l.completionLog, r.completionLog),
      focusLog: mergeLog(b.focusLog, l.focusLog, r.focusLog),
      lastResetDate: mergeScalar(b.lastResetDate, l.lastResetDate, r.lastResetDate),
      runningTaskId: mergeScalar(b.runningTaskId, l.runningTaskId, r.runningTaskId),
      runStart: mergeScalar(b.runStart, l.runStart, r.runStart),
      lastSelectedId: mergeScalar(b.lastSelectedId, l.lastSelectedId, r.lastSelectedId),
    },
    conflicts: [...projects.conflicts, ...inbox.conflicts, ...notes.conflicts],
  };
}
