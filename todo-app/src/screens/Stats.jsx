import { useMemo } from "react";
import { todayISO, currentStreak, weekBars, heatmapCells, formatDuration } from "../lib/helpers";

/* ------------------------------------------------------------------ */
/*  Stats screen — stat tiles + week bar chart + 28-day heatmap,        */
/*  all read only from completionLog/focusLog (durable, deletion-safe)  */
/* ------------------------------------------------------------------ */
export function StatsScreen({ completionLog, focusLog, runningTaskId, runStart, tick }) {
  const today = todayISO();
  const completedToday = completionLog[today] || 0;
  const streak = useMemo(() => currentStreak(completionLog), [completionLog]);
  const liveDelta = runningTaskId ? (Date.now() - runStart) / 1000 : 0;
  const focusSeconds = (focusLog[today] || 0) + liveDelta;
  const bars = useMemo(() => weekBars(completionLog), [completionLog]);
  const maxBar = Math.max(1, ...bars.map((b) => b.value));
  const cells = useMemo(() => heatmapCells(completionLog), [completionLog]);

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
