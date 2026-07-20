import { useEffect, useRef, useState } from "react";

export function Ring({ pct, color, size = 52, thickness = 4, label, textStyle }) {
  const r = (size - thickness * 2) / 2, c = 2 * Math.PI * r;
  const clamped = pct === null ? null : Math.min(100, Math.max(0, pct));
  // Fill animates from 0 -> clamped on first mount (page/screen open), then tracks
  // clamped directly on later updates — the stroke-dashoffset transition below does the rest.
  const [fillPct, setFillPct] = useState(0);
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      const raf = requestAnimationFrame(() => setFillPct(clamped ?? 0));
      return () => cancelAnimationFrame(raf);
    }
    setFillPct(clamped ?? 0);
  }, [clamped]);

  const off = c - (Math.max(0, Math.min(100, fillPct)) / 100) * c;
  const display = label !== undefined ? label : (clamped === null ? "—" : `${clamped}%`);
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }} role="img"
      aria-label={clamped === null ? "Not started" : `${clamped} percent complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={thickness} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fill={clamped === null ? "var(--muted)" : "var(--ink)"}
        style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, ...textStyle }}>
        {display}
      </text>
    </svg>
  );
}

// Linear counterpart of Ring — a fill bar that animates from 0 -> pct on mount, then
// tracks pct directly (so later updates still transition via the CSS width rule
// already on .pd-progressfill/.pd-overall-fill).
export function ProgressFill({ className, pct, style }) {
  const clamped = Math.min(100, Math.max(0, pct || 0));
  const [fillPct, setFillPct] = useState(0);
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      const raf = requestAnimationFrame(() => setFillPct(clamped));
      return () => cancelAnimationFrame(raf);
    }
    setFillPct(clamped);
  }, [clamped]);
  return <div className={className} style={{ ...style, width: `${fillPct}%` }} />;
}
