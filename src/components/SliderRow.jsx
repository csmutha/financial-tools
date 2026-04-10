export default function SliderRow({ field, value, onChange, currencySymbol }) {
  const pct         = ((value - field.min) / (field.max - field.min)) * 100;
  const ticks       = 5;
  const displayUnit = field.isMoney ? currencySymbol : field.unit;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <label style={{ fontSize: 13, color: "#555", fontWeight: 500 }}>{field.label}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="number"
            value={value}
            min={field.min} max={field.max} step={field.step}
            onChange={e => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(Math.min(field.max, Math.max(field.min, v)));
            }}
            style={{
              width: field.isMoney ? 110 : 60, textAlign: "right",
              border: "1px solid #dde3f0", borderRadius: 5,
              padding: "3px 6px", fontSize: 14, fontWeight: 700, color: "#1a73e8",
              outline: "none", fontFamily: "inherit", background: "#f8faff",
            }}
          />
          <span style={{ fontSize: 12, color: "#999", minWidth: 20 }}>{displayUnit}</span>
        </div>
      </div>

      <div style={{ position: "relative", paddingBottom: 18 }}>
        <div style={{
          position: "absolute", top: 8, left: 0, right: 0,
          height: 4, borderRadius: 2, background: "#e4e9f5", zIndex: 0,
        }}>
          <div style={{
            width: pct + "%", height: "100%",
            background: "linear-gradient(90deg,#1a73e8,#4dabf7)",
            borderRadius: 2,
          }} />
        </div>

        <input
          type="range"
          min={field.min} max={field.max} step={field.step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{
            width: "100%", appearance: "none", background: "transparent",
            position: "relative", zIndex: 1, height: 20, cursor: "pointer",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          {Array.from({ length: ticks }, (_, i) => {
            const v = field.min + (i / (ticks - 1)) * (field.max - field.min);
            return (
              <span key={i} style={{ fontSize: 9.5, color: "#bbb" }}>
                {field.fmt(v)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
