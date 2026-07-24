import { useMemo } from "react";
import {
  todayISO, currentStreak, weekBars, heatmapCells, formatDuration,
  weeklyTotal, plannedVsCompletedThisWeek, carryoverTasks, completionByProject,
} from "../lib/helpers";
import { Ring } from "../components/Ring";

/* ------------------------------------------------------------------ */
/*  Stats screen — stat tiles + week bar chart + 28-day heatmap,        */
/*  all read only from completionLog/focusLog (durable, deletion-safe)  */
/* ------------------------------------------------------------------ */
export function StatsScreen({ projects, inbox, completionLog, focusLog, runningTaskId, runStart, tick }) {
  const today = todayISO();
  const completedToday = completionLog[today] || 0;
  const streak = useMemo(() => currentStreak(completionLog), [completionLog]);
  const liveDelta = runningTaskId ? (Date.now() - runStart) / 1000 : 0;
  const focusSeconds = (focusLog[today] || 0) + liveDelta;
  const bars = useMemo(() => weekBars(completionLog), [completionLog]);
  const maxBar = Math.max(1, ...bars.map((b) => b.value));
  const cells = useMemo(() => heatmapCells(completionLog), [completionLog]);
  const weeklyCompleted = useMemo(() => weeklyTotal(completionLog), [completionLog]);
  const weeklyFocus = useMemo(() => weeklyTotal(focusLog), [focusLog]);
  const plannedVsCompleted = useMemo(() => plannedVsCompletedThisWeek(projects, inbox), [projects, inbox]);
  const plannedPct = plannedVsCompleted.planned > 0
    ? Math.round((plannedVsCompleted.completed / plannedVsCompleted.planned) * 100) : null;
  const carryover = useMemo(() => carryoverTasks(projects, inbox), [projects, inbox]);
  const byProject = useMemo(() => completionByProject(projects), [projects]);
  const maxByProject = Math.max(1, ...byProject.map((p) => p.count));

  return (
    <div className="pd-stats">
      <div className="pd-stat-row">
        <div className="pd-stat-tile orange">
          <div className="pd-stat-label">Completed today</div>
          <div className="pd-stat-value">{completedToday}</div>
        </div>
        <div className="pd-stat-tile olive">
          <div className="pd-stat-label">Current streak</div>
          <div className="pd-stat-value">{streak}d</div>
        </div>
        <div className="pd-stat-tile lilac">
          <div className="pd-stat-label">Focus time</div>
          <div className="pd-stat-value">{formatDuration(focusSeconds, false) || "0m"}</div>
        </div>
      </div>

      <div className="pd-stats-panel">
        <div className="pd-section-label">This week</div>
        <div className="pd-week-summary">
          <div className="pd-week-stat">
            <div className="pd-week-stat-value">{weeklyCompleted}</div>
            <div className="pd-week-stat-label">completed</div>
          </div>
          <div className="pd-week-stat">
            <div className="pd-week-stat-value">{formatDuration(weeklyFocus, false) || "0m"}</div>
            <div className="pd-week-stat-label">focused</div>
          </div>
          <div className="pd-week-ring">
            <Ring pct={plannedPct} color="var(--accent)" size={56} thickness={5} />
            <div className="pd-week-ring-label">{plannedVsCompleted.completed} of {plannedVsCompleted.planned} planned done</div>
          </div>
        </div>
        {carryover.length > 0 && (
          <div className="pd-week-carryover">{carryover.length} task{carryover.length === 1 ? "" : "s"} carried over from earlier</div>
        )}
      </div>

      {byProject.length > 0 && (
        <div className="pd-stats-panel">
          <div className="pd-section-label">Completed by project this week</div>
          <div className="pd-projectbar-list">
            {byProject.map((p) => (
              <div key={p.id} className="pd-projectbar-row">
                <div className="pd-projectbar-name">{p.name}</div>
                <div className="pd-projectbar-track">
                  <div className="pd-projectbar-fill" style={{ width: `${(p.count / maxByProject) * 100}%`, background: p.color.fg }} />
                </div>
                <div className="pd-projectbar-count">{p.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pd-stats-panel">
        <div className="pd-section-label">Tasks completed this week</div>
        <div className="pd-daybar-row">
          {bars.map((b) => (
            <div key={b.iso} className="pd-daybar-col">
              <div className="pd-daybar-track"><div className="pd-daybar-fill" style={{ height: `${(b.value / maxBar) * 100}%` }} /></div>
              <div className="pd-daybar-label">{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pd-stats-panel">
        <div className="pd-section-label">28-day streak</div>
        <div className="pd-heat-grid">
          {cells.map((c) => <div key={c.iso} className={`pd-heatcell ${c.on ? "on" : ""}`} title={c.iso} />)}
        </div>
      </div>
    </div>
  );
}
