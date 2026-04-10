/**
 * calcEMI — Equated Monthly Instalment (standard reducing-balance formula)
 *
 * @param {number} principal  — Loan amount (price − down payment)
 * @param {number} annualRate — Annual interest rate in % (e.g. 4.5)
 * @param {number} tenureYrs  — Loan tenure in years
 * @returns {number} Monthly EMI payment
 */
export function calcEMI(principal, annualRate, tenureYrs) {
  if (principal <= 0 || annualRate <= 0 || tenureYrs <= 0) return 0;
  const r = annualRate / 100 / 12;            // monthly rate
  const n = tenureYrs * 12;                   // total months
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * calcOutstandingBalance — remaining principal after k months of repayment
 *
 * @param {number} principal  — Original loan amount
 * @param {number} annualRate — Annual rate in %
 * @param {number} tenureYrs  — Loan tenure in years
 * @param {number} monthsPaid — Months elapsed since loan disbursement
 * @returns {number} Outstanding principal balance
 */
export function calcOutstandingBalance(principal, annualRate, tenureYrs, monthsPaid) {
  if (principal <= 0 || annualRate <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = tenureYrs * 12;
  const k = Math.min(monthsPaid, n);
  return principal * (Math.pow(1 + r, n) - Math.pow(1 + r, k)) / (Math.pow(1 + r, n) - 1);
}

/**
 * calcROI — Full year-by-year ROI model.
 * When `emiVals` is provided the cash-flow model switches to a leveraged view:
 *   - Only the down payment is treated as invested capital
 *   - Each year's net income = rental net income − annual EMI payments
 *   - Exit equity = future sale price − outstanding loan at exit
 *
 * @param {object} vals    — Slider values (price, rent, maintenance, vacancy, management, appreciation, years, rentIncrease)
 * @param {object|null} emiVals — { downPaymentPct, interestRate, tenureYrs } or null for cash purchase
 * @returns {object} All computed metrics needed for the UI
 */
export function calcROI(vals, emiVals) {
  const {
    price, rent, maintenance, vacancy,
    management, appreciation, years, rentIncrease,
  } = vals;

  // ── Year 1 base figures ──────────────────────────────────────
  const grossAnnualRent = rent * 12;
  const vacancyLoss     = grossAnnualRent * (vacancy / 100);
  const effectiveRent   = grossAnnualRent - vacancyLoss;
  const mgmtFee         = effectiveRent * (management / 100);
  const noi             = effectiveRent - maintenance - mgmtFee;

  const grossYield = (grossAnnualRent / price) * 100;
  const netYield   = (noi / price) * 100;

  // ── EMI / financing figures ─────────────────────────────────
  const isFinanced   = !!emiVals;
  const downPayment  = isFinanced ? price * (emiVals.downPaymentPct / 100) : price;
  const loanAmount   = isFinanced ? price - downPayment : 0;
  const emi          = isFinanced ? calcEMI(loanAmount, emiVals.interestRate, emiVals.tenureYrs) : 0;
  const annualEMI    = emi * 12;
  const totalEMIPaid = emi * Math.min(years, emiVals?.tenureYrs ?? 0) * 12;
  const totalInterest = isFinanced
    ? (emi * (emiVals.tenureYrs * 12)) - loanAmount
    : 0;

  // ── Year-by-Year Projection ─────────────────────────────────
  const yearlyData = [];
  let cumulativeNet   = 0;
  let cumulativeCF    = 0;   // cash-flow based cumulative (leveraged)
  let payback         = null;
  let leveragedPayback = null;

  for (let yr = 1; yr <= years; yr++) {
    const f = Math.pow(1 + rentIncrease / 100, yr - 1);

    const yrGross = grossAnnualRent * f;
    const yrEff   = yrGross * (1 - vacancy / 100);
    const yrNet   = yrEff - maintenance - yrEff * (management / 100);

    // EMI paid this year (0 after loan tenure ends)
    const yrEMI   = isFinanced && yr <= (emiVals?.tenureYrs ?? 0) ? annualEMI : 0;

    // Net cash flow to investor after debt service
    const yrCashFlow = yrNet - yrEMI;

    const prevNet = cumulativeNet;
    const prevCF  = cumulativeCF;
    cumulativeNet += yrNet;
    cumulativeCF  += yrCashFlow;

    yearlyData.push({
      yr,
      yrGross,
      yrMonthly: yrGross / 12,
      yrNet,
      yrEMI,
      yrCashFlow,
      cumulativeNet,
      cumulativeCF,
    });

    // Payback (unleveraged) — cumulative net income recovers full price
    if (!payback && cumulativeNet >= price) {
      payback = yr - 1 + (price - prevNet) / yrNet;
    }

    // Leveraged payback — cumulative cash flow recovers down payment
    if (isFinanced && !leveragedPayback && cumulativeCF >= downPayment) {
      leveragedPayback = yr - 1 + (downPayment - prevCF) / yrCashFlow;
    }
  }

  // Extend payback search up to 60 years if not reached in holding period
  if (!payback) {
    let cum = cumulativeNet;
    for (let yr = years + 1; yr <= 60; yr++) {
      const yrNet = noi * Math.pow(1 + rentIncrease / 100, yr - 1);
      const prev  = cum;
      cum += yrNet;
      if (cum >= price) { payback = yr - 1 + (price - prev) / yrNet; break; }
    }
  }

  // ── Last Year figures ────────────────────────────────────────
  const lastYrData        = yearlyData[yearlyData.length - 1];
  const monthlyRentLastYr = lastYrData ? lastYrData.yrMonthly  : rent;
  const annualRentLastYr  = lastYrData ? lastYrData.yrGross    : grossAnnualRent;

  // ── Totals ───────────────────────────────────────────────────
  const totalRentalIncome = yearlyData.reduce((s, d) => s + d.yrNet, 0);
  const futureValue       = price * Math.pow(1 + appreciation / 100, years);
  const capitalGain       = futureValue - price;

  // ── Unleveraged (cash) total return ─────────────────────────
  const totalReturn    = totalRentalIncome + capitalGain;
  const totalROI       = (totalReturn / price) * 100;
  const annualisedROI  = (Math.pow(1 + totalROI / 100, 1 / years) - 1) * 100;

  // ── Leveraged return (EMI scenario) ─────────────────────────
  let cashOnCashROI       = netYield;  // falls back to net yield for cash purchase
  let totalLeveragedReturn = null;
  let annualisedLeveragedROI = null;
  let outstandingLoanAtExit  = 0;
  let netExitProceeds        = futureValue;

  if (isFinanced) {
    const monthsAtExit    = years * 12;
    outstandingLoanAtExit = calcOutstandingBalance(
      loanAmount, emiVals.interestRate, emiVals.tenureYrs, monthsAtExit
    );
    netExitProceeds = futureValue - outstandingLoanAtExit;

    // Total rental cash flow during hold (rent net − EMI each year)
    const totalRentalCF = yearlyData.reduce((s, d) => s + d.yrCashFlow, 0);

    // Total gain on the invested down payment
    totalLeveragedReturn = netExitProceeds - downPayment + totalRentalCF;

    const leveragedROIPct = (totalLeveragedReturn / downPayment) * 100;
    annualisedLeveragedROI = (Math.pow(1 + leveragedROIPct / 100, 1 / years) - 1) * 100;

    // Cash-on-Cash: Year 1 net rent / down payment
    cashOnCashROI = (noi - annualEMI) / downPayment * 100;
  }

  return {
    // Base
    grossAnnualRent, vacancyLoss, effectiveRent, mgmtFee, noi,
    grossYield, netYield,
    futureValue, capitalGain,
    totalRentalIncome, totalReturn, totalROI, annualisedROI,
    payback, cashOnCashROI,
    monthlyRentLastYr, annualRentLastYr,
    yearlyData,

    // EMI / leveraged
    isFinanced,
    downPayment, loanAmount, emi, annualEMI, totalEMIPaid, totalInterest,
    outstandingLoanAtExit, netExitProceeds,
    totalLeveragedReturn, annualisedLeveragedROI,
    leveragedPayback,
    monthlyCashFlow: (noi / 12) - emi,   // Year 1 monthly cash flow after EMI
  };
}
