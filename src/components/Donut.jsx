export default function Donut({ slices, size = 156 }) {
  const r    = 50;
  const cx   = size / 2;
  const cy   = size / 2;
  const circ = 2 * Math.PI * r;
  const total = slices.reduce((s, sl) => s + Math.max(0, sl.value), 0);

  let offset = 0;
  const arcs = slices.map((sl, i) => {
    const pct  = total > 0 ? Math.max(0, sl.value) / total : 0;
    const dash = pct * circ;
    const gap  = circ - dash;
    const el = (
      <circle
        key={i}
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={sl.color}
        strokeWidth={26}
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
    );
    offset += dash;
    return el;
  });

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0f0" strokeWidth={26} />
      {arcs}
    </svg>
  );
}
