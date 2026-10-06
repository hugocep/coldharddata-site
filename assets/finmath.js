// Mirror of pipeline/analyses/finmath.py. tests/test_site_parity.py runs both on the same inputs.
// Returns are decimals (0.12 = 12%). A year's return is spread evenly over its 12 months.

export const arithmeticMean = (r) => r.reduce((a, b) => a + b, 0) / r.length;

export const cagr = (r) => r.reduce((p, x) => p * (1 + x), 1) ** (1 / r.length) - 1;

export const realReturns = (nominal, inflation) => nominal.map((n, i) => (1 + n) / (1 + inflation[i]) - 1);

export const monthlyRate = (annual) => (1 + annual) ** (1 / 12) - 1;

/** "monthly" = 1/12 of the rate each month (12% -> 12.68% a year); "annual" = exactly the rate a year. */
export const effectiveRate = (rate, compounding = "annual") =>
  compounding === "monthly" ? (1 + rate / 12) ** 12 - 1 : rate;

/** Year-end balances of a fixed monthly contribution (start or end of each month). */
export const contributionPath = (annualReturns, monthly, timing = "end") => {
  let balance = 0;
  const path = [];
  for (const r of annualReturns) {
    const g = 1 + monthlyRate(r);
    for (let k = 0; k < 12; k++) balance = timing === "start" ? (balance + monthly) * g : balance * g + monthly;
    path.push(balance);
  }
  return path;
};

export const annuityFv = (annual, years, monthly, timing = "end") => {
  const m = monthlyRate(annual);
  const n = 12 * years;
  if (m === 0) return monthly * n;
  const fv = (monthly * ((1 + m) ** n - 1)) / m;
  return timing === "start" ? fv * (1 + m) : fv;
};

/** Constant annual return that turns the same contributions into finalValue (money-weighted). */
export const impliedAnnualReturn = (finalValue, years, monthly, timing = "end") => {
  let lo = -0.99;
  let hi = 1.0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (annuityFv(mid, years, monthly, timing) < finalValue) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};
