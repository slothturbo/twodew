export function Ring({ pct, color, size = 52, thickness = 4, label, textStyle }) {
  const r = (size - thickness * 2) / 2, c = 2 * Math.PI * r;
  const clamped = pct === null ? null : Math.min(100, Math.max(0, pct));
  const off = clamped === null ? c : c - (clamped / 100) * c;
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
