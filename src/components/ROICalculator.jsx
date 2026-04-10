/**
 * ============================================================
 * Property ROI Calculator  (with EMI / Financing Mode)
 * ============================================================
 * Features:
 *  - All original ROI metrics: Gross Yield, Net Yield, Cap Rate,
 *    Annualised ROI, Rent compounding, Payback period
 *  - EMI Calculator toggle — financing a property with a mortgage
 *    updates every metric to a leveraged / cash-on-cash view:
 *      • EMI computed via reducing-balance formula
 *      • Monthly cash flow (rent net − EMI)
 *      • Outstanding loan at exit, net sale proceeds
 *      • Leveraged annualised ROI vs unleveraged comparison
 *      • Leveraged payback period
 *  - Multi-currency, Donut chart, KPI cards, tabbed results
 *
 * Author : Chandrashekar Mutha
 * Stack  : React 18 (hooks only) — no external libraries
 * ============================================================
 */

import { useState, useMemo } from "react";
import { CURRENCIES } from "../utils/currencies.js";
import { fmtMoney, fmtPct, fmtYrs } from "../utils/formatting.js";
import { calcROI } from "../utils/calculations.js";
import Donut from "./Donut.jsx";
import CurrencyDropdown from "./CurrencyDropdown.jsx";
import SliderRow from "./SliderRow.jsx";
import bannerImg from "../assets/banner.png";

// ─────────────────────────────────────────────────────────────
// FIELD DEFINITIONS
// ─────────────────────────────────────────────────────────────
const makeROIFields = sym => [
  {
    key: "price", label: "Property Price",
    min: 200000, max: 100000000, step: 50000,
    unit: sym, isMoney: true,
    fmt: v => v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : (v / 1000).toFixed(0) + "K",
  },
  {
    key: "rent", label: "Monthly Rent",
    min: 500, max: 100000, step: 500,
    unit: sym, isMoney: true,
    fmt: v => v >= 1000 ? (v / 1000).toFixed(1) + "K" : v,
  },
  {
    key: "rentIncrease", label: "Annual Rent Increase",
    min: 0, max: 20, step: 0.5,
    unit: "%", isMoney: false,
    fmt: v => v + "%",
  },
  {
    key: "maintenance", label: "Annual Maintenance",
    min: 0, max: 100000, step: 1000,
    unit: sym, isMoney: true,
    fmt: v => v >= 1000 ? (v / 1000).toFixed(0) + "K" : v,
  },
  {
    key: "vacancy", label: "Vacancy Rate",
    min: 0, max: 30, step: 1,
    unit: "%", isMoney: false,
    fmt: v => v + "%",
  },
  {
    key: "management", label: "Management Fee",
    min: 0, max: 20, step: 0.5,
    unit: "%", isMoney: false,
    fmt: v => v + "%",
  },
  {
    key: "appreciation", label: "Price Appreciation",
    min: 0, max: 20, step: 0.5,
    unit: "%", isMoney: false,
    fmt: v => v + "%",
  },
  {
    key: "years", label: "Holding Period",
    min: 1, max: 30, step: 1,
    unit: "yr", isMoney: false,
    fmt: v => v + "yr",
  },
];

const makeEMIFields = sym => [
  {
    key: "downPaymentPct", label: "Down Payment",
    min: 5, max: 80, step: 5,
    unit: "%", isMoney: false,
    fmt: v => v + "%",
  },
  {
    key: "interestRate", label: "Loan Interest Rate",
    min: 0.5, max: 15, step: 0.25,
    unit: "%", isMoney: false,
    fmt: v => v + "%",
  },
  {
    key: "tenureYrs", label: "Loan Tenure",
    min: 5, max: 30, step: 1,
    unit: "yr", isMoney: false,
    fmt: v => v + "yr",
  },
];

const ROI_DEFAULTS = {
  price: 1200000,
  rent: 8500,
  rentIncrease: 5,
  maintenance: 12000,
  vacancy: 8,
  management: 5,
  appreciation: 3,
  years: 10,
};

const EMI_DEFAULTS = {
  downPaymentPct: 20,
  interestRate: 4.5,
  tenureYrs: 25,
};

// ─────────────────────────────────────────────────────────────
// TOGGLE SWITCH (reusable)
// ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11, position: "relative",
          background: checked ? "#1a73e8" : "#cdd4e0",
          transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute", top: 3, left: checked ? 21 : 3,
          width: 16, height: 16, borderRadius: "50%",
          background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 0.2s",
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: checked ? "#1a73e8" : "#888" }}>{label}</span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION HEADER (reused in left panel)
// ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, text }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "#1a73e8",
      textTransform: "uppercase", letterSpacing: "0.08em",
      marginBottom: 18, borderBottom: "2px solid #e8f0fe", paddingBottom: 8,
      display: "flex", alignItems: "center", gap: 6,
    }}>
      <span>{icon}</span> {text}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function ROICalculator() {
  const [vals, setVals]       = useState(ROI_DEFAULTS);
  const [emiVals, setEmiVals] = useState(EMI_DEFAULTS);
  const [currency, setCurrency] = useState("AED");
  const [tab, setTab]         = useState("summary");
  const [emiEnabled, setEmiEnabled] = useState(false);

  const set    = k => v => setVals(prev => ({ ...prev, [k]: v }));
  const setEmi = k => v => setEmiVals(prev => ({ ...prev, [k]: v }));

  const cur    = CURRENCIES.find(c => c.code === currency);
  const fm     = v => fmtMoney(v, currency);
  const FIELDS = makeROIFields(cur.symbol);
  const EMI_FIELDS = makeEMIFields(cur.symbol);

  // ── All financial computations ──────────────────────────────
  const r = useMemo(
    () => calcROI(vals, emiEnabled ? emiVals : null),
    [vals, emiVals, emiEnabled]
  );

  // ── Colour helpers ──────────────────────────────────────────
  const primaryROI = emiEnabled ? r.annualisedLeveragedROI : r.annualisedROI;
  const roiColor   = primaryROI >= 8 ? "#34a853" : primaryROI >= 5 ? "#fbbc05" : "#ea4335";
  const cfColor    = r.monthlyCashFlow >= 0 ? "#34a853" : "#ea4335";

  const tabs = ["summary", "yearly", "breakdown"];

  // ── Donut slices change based on financing mode ─────────────
  const donutSlices = emiEnabled
    ? [
        { value: Math.max(0, r.totalRentalIncome - r.totalEMIPaid), color: "#1a73e8", label: "Net Rental CF" },
        { value: Math.max(0, r.capitalGain),                         color: "#34a853", label: "Capital Gain" },
        { value: r.totalEMIPaid,                                     color: "#fbbc05", label: "EMI Paid" },
      ]
    : [
        { value: r.totalRentalIncome, color: "#1a73e8", label: "Total Rental Income" },
        { value: r.capitalGain,        color: "#34a853", label: "Capital Gain" },
      ];

  return (
    <div style={{
      background: "#f0f4fb", minHeight: "100vh",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      padding: "20px 14px 60px",
    }}>

      {/* ── Global CSS ── */}
      <style>{`
        input[type=range]{-webkit-appearance:none;appearance:none}
        input[type=range]::-webkit-slider-thumb{
          -webkit-appearance:none;width:18px;height:18px;border-radius:50%;
          background:#1a73e8;border:2.5px solid #fff;
          box-shadow:0 1px 5px rgba(26,115,232,0.35);cursor:pointer;margin-top:-7px
        }
        input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:transparent}
        input[type=number]::-webkit-inner-spin-button{opacity:.5}
        .tab-btn{border:none;cursor:pointer;padding:7px 16px;border-radius:20px;
          font-size:12px;font-family:inherit;font-weight:600;transition:all .2s}
        .tab-btn.active{background:#1a73e8;color:#fff;box-shadow:0 2px 8px rgba(26,115,232,0.3)}
        .tab-btn:not(.active){background:#e8f0fe;color:#1a73e8}
        .tab-btn:not(.active):hover{background:#d2e3fc}
        tr:hover td{background:rgba(26,115,232,0.03)!important}
        .emi-panel{border-left:3px solid #1a73e8;padding-left:14px;margin-left:2px}
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", marginBottom: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
            <img
              src={bannerImg}
              alt="Property ROI Calculator"
              style={{ width: "100%", display: "block", borderRadius: 14 }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <CurrencyDropdown value={currency} onChange={setCurrency} />
          </div>
        </div>

        {/* ── Main 2-column layout ── */}
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, alignItems: "start" }}>

          {/* ════ LEFT: Inputs ════ */}
          <div style={{
            background: "#fff", borderRadius: 14,
            padding: "20px 18px", boxShadow: "0 2px 14px rgba(0,0,0,0.07)",
          }}>
            <SectionHeader icon="📋" text="Investment Inputs" />
            {FIELDS.slice(0, 4).map(f => (
              <SliderRow key={f.key} field={f} value={vals[f.key]} onChange={set(f.key)} currencySymbol={cur.symbol} />
            ))}

            <SectionHeader icon="📈" text="Growth & Costs" />
            {FIELDS.slice(4).map(f => (
              <SliderRow key={f.key} field={f} value={vals[f.key]} onChange={set(f.key)} currencySymbol={cur.symbol} />
            ))}

            {/* ── EMI / Financing Section ── */}
            <div style={{ marginTop: 6 }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                borderBottom: "2px solid #e8f0fe", paddingBottom: 8, marginBottom: emiEnabled ? 18 : 0,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#1a73e8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <span>🏦</span> Mortgage / EMI
                </div>
                <Toggle checked={emiEnabled} onChange={setEmiEnabled} label={emiEnabled ? "On" : "Off"} />
              </div>

              {emiEnabled && (
                <div className="emi-panel">
                  {EMI_FIELDS.map(f => (
                    <SliderRow key={f.key} field={f} value={emiVals[f.key]} onChange={setEmi(f.key)} currencySymbol={cur.symbol} />
                  ))}

                  {/* Live EMI preview inside the input panel */}
                  <div style={{
                    background: "linear-gradient(135deg,#e8f0fe,#f0e8ff)",
                    borderRadius: 10, padding: "12px 14px",
                    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
                  }}>
                    {[
                      { label: "Loan Amount",    value: fm(r.loanAmount) },
                      { label: "Monthly EMI",    value: fm(r.emi) },
                      { label: "Total Interest", value: fm(r.totalInterest) },
                      { label: "Total Loan Cost",value: fm(r.loanAmount + r.totalInterest) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{ fontSize: 9.5, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a73e8", marginTop: 1 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ════ RIGHT: Results ════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── KPI Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: emiEnabled ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
              {[
                {
                  label: emiEnabled ? "Leveraged ROI" : "Annualised ROI",
                  value: fmtPct(primaryROI),
                  color: roiColor,
                  sub: `over ${vals.years} yrs`,
                },
                {
                  label: "Gross Yield",
                  value: fmtPct(r.grossYield),
                  color: "#1a73e8",
                  sub: "Year 1",
                },
                {
                  label: emiEnabled ? "Cash-on-Cash" : "Net Yield",
                  value: fmtPct(emiEnabled ? r.cashOnCashROI : r.netYield),
                  color: "#9334e6",
                  sub: emiEnabled ? "Yr 1 on equity" : "After expenses",
                },
                ...(emiEnabled ? [{
                  label: "Monthly Cash Flow",
                  value: fm(r.monthlyCashFlow),
                  color: cfColor,
                  sub: "Rent net − EMI (Yr 1)",
                }] : []),
              ].map(({ label, value, color, sub }) => (
                <div key={label} style={{
                  background: "#fff", borderRadius: 10, padding: "14px 10px",
                  textAlign: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                  borderTop: `3px solid ${color}`,
                }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#444", marginTop: 3 }}>{label}</div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* ── Leveraged vs Unleveraged comparison banner (only when EMI on) ── */}
            {emiEnabled && (
              <div style={{
                background: "#fff", borderRadius: 12, padding: "14px 18px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center",
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Cash Purchase ROI</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#555" }}>{fmtPct(r.annualisedROI)}</div>
                  <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>p.a. unleveraged</div>
                </div>
                <div style={{ fontSize: 22, color: "#dde3f0", fontWeight: 300 }}>vs</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Leveraged (EMI) ROI</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: roiColor }}>{fmtPct(r.annualisedLeveragedROI)}</div>
                  <div style={{ fontSize: 10, color: "#bbb", marginTop: 2 }}>p.a. on {emiVals.downPaymentPct}% equity</div>
                </div>
              </div>
            )}

            {/* ── Monthly Rent Projection ── */}
            <div style={{
              background: "linear-gradient(135deg, #1a73e8 0%, #4dabf7 100%)",
              borderRadius: 12, padding: "16px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              boxShadow: "0 4px 16px rgba(26,115,232,0.25)",
            }}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Monthly Rent in Year {vals.years}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginTop: 2 }}>
                  {fm(r.monthlyRentLastYr)}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>
                  Annual: {fm(r.annualRentLastYr)} · up from {fm(vals.rent)}/mo today
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {emiEnabled ? (
                  <>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Monthly EMI
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginTop: 2 }}>
                      {fm(r.emi)}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                      {emiVals.interestRate}% over {emiVals.tenureYrs} yrs
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Rent Growth
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginTop: 2 }}>
                      +{(((r.monthlyRentLastYr / vals.rent) - 1) * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                      {vals.rentIncrease}% p.a. compounded
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Donut chart + legend ── */}
            <div style={{ background: "#fff", borderRadius: 12, padding: "18px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Donut slices={donutSlices} />
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{ fontSize: 9, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {emiEnabled ? "NET GAIN" : "TOTAL"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#222" }}>
                      {emiEnabled ? fm(r.totalLeveragedReturn) : fm(r.totalReturn)}
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  {donutSlices.map(({ dot, label, value, color }) => (
                    <div key={label || dot} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 0", borderBottom: "1px solid #f3f3f3",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{fm(value)}</div>
                        <div style={{ fontSize: 10, color: "#aaa" }}>
                          {(() => {
                            const total = donutSlices.reduce((s, sl) => s + Math.max(0, sl.value), 0);
                            return total > 0 ? ((Math.max(0, value) / total) * 100).toFixed(1) + "%" : "—";
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Payback row */}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f3f3" }}>
                    <span style={{ fontSize: 12, color: "#888" }}>Payback Period{emiEnabled ? " (cash)" : ""}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: r.payback && r.payback < 20 ? "#34a853" : "#ea4335" }}>
                      {fmtYrs(r.payback)}
                    </span>
                  </div>

                  {emiEnabled && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                      <span style={{ fontSize: 12, color: "#888" }}>Leveraged Payback</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: r.leveragedPayback && r.leveragedPayback < 15 ? "#34a853" : "#ea4335" }}>
                        {r.leveragedPayback ? fmtYrs(r.leveragedPayback) : ">" + vals.years + " yrs"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Tabbed Results Panel ── */}
            <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ display: "flex", gap: 8, padding: "12px 14px", borderBottom: "1px solid #f0f0f0" }}>
                {tabs.map(t => (
                  <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                    {t === "summary" ? "Summary" : t === "yearly" ? "Year-by-Year" : "Breakdown"}
                  </button>
                ))}
              </div>

              <div style={{ padding: "14px" }}>

                {/* ── TAB: Summary ── */}
                {tab === "summary" && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <tbody>
                      {[
                        ["Property Price",                    fm(vals.price)],
                        ["Gross Annual Rent (Yr 1)",          fm(r.grossAnnualRent)],
                        ["Vacancy Loss",                      `− ${fm(r.vacancyLoss)}`],
                        ["Maintenance",                       `− ${fm(vals.maintenance)}`],
                        ["Management Fee",                    `− ${fm(r.mgmtFee)}`],
                        ["Net Operating Income (Yr 1)",       fm(r.noi), true],
                        null,
                        ...(emiEnabled ? [
                          ["Down Payment",                    fm(r.downPayment), false, "#e67e22"],
                          ["Loan Amount",                     fm(r.loanAmount)],
                          ["Monthly EMI",                     fm(r.emi), true, "#1a73e8"],
                          ["Annual EMI",                      fm(r.annualEMI)],
                          ["Total Interest Paid",             fm(r.totalInterest), false, "#ea4335"],
                          ["Monthly Cash Flow (Yr 1)",        fm(r.monthlyCashFlow), true, r.monthlyCashFlow >= 0 ? "#34a853" : "#ea4335"],
                          null,
                        ] : []),
                        [`Monthly Rent — Year ${vals.years}`, fm(r.monthlyRentLastYr), true, "#9334e6"],
                        [`Annual Rent — Year ${vals.years}`,  fm(r.annualRentLastYr)],
                        null,
                        ["Future Property Value",             fm(r.futureValue)],
                        ...(emiEnabled ? [
                          ["Outstanding Loan at Exit",        `− ${fm(r.outstandingLoanAtExit)}`, false, "#ea4335"],
                          ["Net Sale Proceeds",               fm(r.netExitProceeds), true],
                        ] : []),
                        ["Capital Gain",                      fm(r.capitalGain)],
                        null,
                        [`Total Rental Income (${vals.years} yr)`, fm(r.totalRentalIncome)],
                        emiEnabled
                          ? ["Leveraged Total Return",        fm(r.totalLeveragedReturn), true]
                          : ["Total Return",                  fm(r.totalReturn), true],
                        ["Total ROI (unleveraged)",           fmtPct(r.totalROI)],
                        ["Annualised ROI (unleveraged)",      fmtPct(r.annualisedROI), !emiEnabled],
                        ...(emiEnabled ? [
                          ["Annualised Leveraged ROI",        fmtPct(r.annualisedLeveragedROI), true],
                          ["Cash-on-Cash Yield (Yr 1)",       fmtPct(r.cashOnCashROI)],
                        ] : []),
                        ["Payback Period",                    fmtYrs(r.payback)],
                        ...(emiEnabled ? [
                          ["Leveraged Payback",               r.leveragedPayback ? fmtYrs(r.leveragedPayback) : `>${vals.years} yrs`],
                        ] : []),
                      ].map((row, i) => row ? (
                        <tr key={i} style={{ background: row[2] ? "#f8f9ff" : "transparent" }}>
                          <td style={{ padding: "6px 4px", color: "#666", borderBottom: "1px solid #f5f5f5", fontSize: 12 }}>{row[0]}</td>
                          <td style={{
                            padding: "6px 4px", textAlign: "right",
                            fontWeight: row[2] ? 700 : 500,
                            color: row[3] || (row[2] ? "#1a73e8" : "#333"),
                            borderBottom: "1px solid #f5f5f5",
                          }}>{row[1]}</td>
                        </tr>
                      ) : (
                        <tr key={i}><td colSpan={2} style={{ padding: "3px" }} /></tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* ── TAB: Year-by-Year ── */}
                {tab === "yearly" && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8f9ff" }}>
                        {["Yr", "Monthly Rent", "Net Income", ...(emiEnabled ? ["EMI", "Cash Flow"] : []), "Cumulative"].map(h => (
                          <th key={h} style={{
                            padding: "7px 5px",
                            textAlign: h === "Yr" ? "center" : "right",
                            color: "#1a73e8", fontWeight: 600,
                            borderBottom: "2px solid #e8f0fe",
                            fontSize: 11, whiteSpace: "nowrap",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.yearlyData.map(({ yr, yrMonthly, yrNet, yrEMI, yrCashFlow, cumulativeNet, cumulativeCF }) => {
                        const recovered = emiEnabled
                          ? cumulativeCF >= r.downPayment
                          : cumulativeNet >= vals.price;
                        const isLast = yr === vals.years;
                        return (
                          <tr key={yr} style={{
                            background: isLast ? "rgba(147,52,230,0.05)"
                                      : recovered ? "#f0faf4"
                                      : yr % 2 === 0 ? "#fafafa" : "#fff",
                          }}>
                            <td style={{ padding: "6px 5px", textAlign: "center", borderBottom: "1px solid #f0f0f0", color: isLast ? "#9334e6" : "#999", fontWeight: isLast ? 700 : 400 }}>
                              {yr}{isLast ? " ★" : ""}
                            </td>
                            <td style={{ padding: "6px 5px", textAlign: "right", borderBottom: "1px solid #f0f0f0", color: isLast ? "#9334e6" : "#555", fontWeight: isLast ? 700 : 400 }}>
                              {fm(yrMonthly)}
                            </td>
                            <td style={{ padding: "6px 5px", textAlign: "right", borderBottom: "1px solid #f0f0f0", color: "#1a73e8", fontWeight: 600 }}>
                              {fm(yrNet)}
                            </td>
                            {emiEnabled && (
                              <>
                                <td style={{ padding: "6px 5px", textAlign: "right", borderBottom: "1px solid #f0f0f0", color: "#fbbc05", fontWeight: 500 }}>
                                  {yrEMI > 0 ? `− ${fm(yrEMI)}` : "—"}
                                </td>
                                <td style={{ padding: "6px 5px", textAlign: "right", borderBottom: "1px solid #f0f0f0", color: yrCashFlow >= 0 ? "#34a853" : "#ea4335", fontWeight: 700 }}>
                                  {fm(yrCashFlow)}
                                </td>
                              </>
                            )}
                            <td style={{ padding: "6px 5px", textAlign: "right", borderBottom: "1px solid #f0f0f0", color: recovered ? "#34a853" : "#333", fontWeight: recovered ? 700 : 400 }}>
                              {fm(emiEnabled ? cumulativeCF : cumulativeNet)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* ── TAB: Breakdown ── */}
                {tab === "breakdown" && (
                  <div>
                    {/* Bar charts */}
                    {[
                      ...(emiEnabled
                        ? [
                            { label: "Net Rental Cash Flow", value: Math.max(0, r.totalRentalIncome - r.totalEMIPaid), color: "#1a73e8" },
                            { label: "Capital Gain",          value: Math.max(0, r.capitalGain),                        color: "#34a853" },
                            { label: "Total EMI Paid",        value: r.totalEMIPaid,                                    color: "#fbbc05" },
                          ]
                        : [
                            { label: "Total Rental Income", value: r.totalRentalIncome, color: "#1a73e8" },
                            { label: "Capital Gain",         value: r.capitalGain,       color: "#34a853" },
                          ]
                      ),
                    ].map(({ label, value, color }) => {
                      const total = emiEnabled
                        ? r.totalRentalIncome + r.capitalGain + r.totalEMIPaid
                        : r.totalReturn;
                      const pct = total > 0 ? (Math.max(0, value) / total) * 100 : 0;
                      return (
                        <div key={label} style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                            <span style={{ fontSize: 12, color: "#555", fontWeight: 500 }}>{label}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color }}>
                              {fm(value)}{" "}
                              <span style={{ color: "#aaa", fontWeight: 400 }}>({pct.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div style={{ height: 9, background: "#eff0f5", borderRadius: 5, overflow: "hidden" }}>
                            <div style={{ width: pct + "%", height: "100%", background: color, borderRadius: 5, transition: "width 0.4s ease" }} />
                          </div>
                        </div>
                      );
                    })}

                    {/* Metric tiles */}
                    <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { label: "Gross Yield (Yr 1)",              value: fmtPct(r.grossYield) },
                        { label: "Net Yield (Yr 1)",                 value: fmtPct(r.netYield) },
                        { label: emiEnabled ? "Leveraged ROI p.a." : "Annualised ROI", value: fmtPct(primaryROI), highlight: true },
                        { label: "Payback Period",                   value: fmtYrs(r.payback) },
                        ...(emiEnabled ? [
                          { label: "Cash-on-Cash (Yr 1)",            value: fmtPct(r.cashOnCashROI), highlight: true },
                          { label: "Leveraged Payback",              value: r.leveragedPayback ? fmtYrs(r.leveragedPayback) : `>${vals.years} yrs` },
                          { label: "Monthly Cash Flow",              value: fm(r.monthlyCashFlow), highlight: r.monthlyCashFlow >= 0 },
                          { label: "Outstanding Loan at Exit",       value: fm(r.outstandingLoanAtExit) },
                        ] : [
                          { label: `Monthly Rent — Yr ${vals.years}`, value: fm(r.monthlyRentLastYr), highlight: true },
                          { label: `Annual Rent — Yr ${vals.years}`,  value: fm(r.annualRentLastYr) },
                        ]),
                      ].map(({ label, value, highlight }) => (
                        <div key={label} style={{
                          background: highlight ? "#e8f0fe" : "#f8f9ff",
                          borderRadius: 8, padding: "10px 11px",
                          border: highlight ? "1px solid #c5d9f9" : "none",
                        }}>
                          <div style={{ fontSize: 10, color: "#999", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {label}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: highlight ? "#1a73e8" : "#333" }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "#bbb" }}>
          {cur.flag} All values in {cur.code} ({cur.name}) · Rent compounded at {vals.rentIncrease}% p.a. · Yields based on Year 1
          {emiEnabled && ` · EMI at ${emiVals.interestRate}% over ${emiVals.tenureYrs} yrs`}
        </div>
      </div>
    </div>
  );
}
