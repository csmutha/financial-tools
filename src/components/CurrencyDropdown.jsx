import { useState } from "react";
import { CURRENCIES } from "../utils/currencies.js";

export default function CurrencyDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const cur = CURRENCIES.find(c => c.code === value);

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
          background: "#fff", border: "1px solid #dde3f0", borderRadius: 8,
          padding: "6px 10px", fontSize: 13, fontWeight: 600, color: "#1a73e8",
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        }}
      >
        <span style={{ fontSize: 16 }}>{cur.flag}</span>
        <span>{cur.code}</span>
        <span style={{ fontSize: 10, color: "#aaa", marginLeft: 2 }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
          background: "#fff", border: "1px solid #dde3f0", borderRadius: 10,
          boxShadow: "0 6px 24px rgba(0,0,0,0.12)", minWidth: 220, overflow: "hidden",
        }}>
          {CURRENCIES.map(c => (
            <div
              key={c.code}
              onClick={() => { onChange(c.code); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                cursor: "pointer",
                background: c.code === value ? "#e8f0fe" : "transparent",
                transition: "background 0.15s",
                borderBottom: "1px solid #f5f5f5",
              }}
              onMouseEnter={e => { if (c.code !== value) e.currentTarget.style.background = "#f8f9ff"; }}
              onMouseLeave={e => { if (c.code !== value) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 18 }}>{c.flag}</span>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#333", minWidth: 36 }}>{c.code}</span>
              <span style={{ fontSize: 12, color: "#888" }}>{c.symbol} · {c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
