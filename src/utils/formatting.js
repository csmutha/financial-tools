import { CURRENCIES } from "./currencies.js";

export const parse = s => {
  const n = parseFloat(String(s).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

export const fmtMoney = (v, cur) => {
  if (v == null) return "—";
  const c = CURRENCIES.find(c => c.code === cur) || CURRENCIES[0];
  return `${c.symbol} ${Math.round(v).toLocaleString(c.locale)}`;
};

export const fmtPct = v => (v == null ? "—" : v.toFixed(2) + "%");

export const fmtYrs = v => (v == null ? "—" : v.toFixed(1) + " yrs");
