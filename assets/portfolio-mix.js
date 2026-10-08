// "Portfolio Mix Backtest": the same computation as pipeline/analyses/buffett_90_10.py (compute), so the site
// reproduces the video's numbers (tests/test_site_parity.py). No DOM here: the page imports it.
import { cagr, realReturns } from "./finmath.js";

/** Nominal yearly return of a mix rebalanced every year to its weights, after a yearly fee. */
export const mixReturns = (data, w, fee) =>
  data.sp500.map((s, i) => (1 + (w.stocks * s + w.bills * data.tbill[i] + w.bonds * data.tbond[i])) * (1 - fee) - 1);

/** Deepest fall from a year-end peak in today's dollars, with its peak/trough indexes and the year it got back. */
export const drawdown = (real) => {
  const wealth = [1];
  for (const r of real) wealth.push(wealth.at(-1) * (1 + r));
  let peakSoFar = -Infinity;
  const dd = wealth.map((w) => ((peakSoFar = Math.max(peakSoFar, w)), w / peakSoFar - 1));
  let trough = 0;
  dd.forEach((d, i) => { if (d < dd[trough]) trough = i; });
  let peak = 0;
  for (let i = 0; i <= trough; i++) if (wealth[i] > wealth[peak]) peak = i;
  let back = null;
  for (let i = trough; i < wealth.length; i++) if (wealth[i] >= wealth[peak]) { back = i; break; }
  return { deepest: dd[trough], peak, trough, back };
};

/** $1 at the start; each year take `rate` first (constant in today's dollars), then earn the year's real return. */
export const withdraw = (real, rate) => {
  let bal = 1;
  for (let k = 0; k < real.length; k++) {
    if (bal < rate - 1e-12) return { value: 0, ranOut: k + 1 };
    bal = (bal - rate) * (1 + real[k]);
  }
  return { value: bal, ranOut: null };
};

const MIX_DEFAULTS = { yours: null, allStocks: { stocks: 1, bills: 0, bonds: 0 }, sixtyForty: { stocks: 0.6, bills: 0, bonds: 0.4 } };

/**
 * @param data {years, sp500, tbill, tbond, inflation} decimals, consecutive calendar years
 * @param p    {stocksPct, billsPct, bondsPct, indexFeePct, managerFeePct, lump, years, withdrawalPct}
 */
export const compute = (data, p) => {
  const n = data.years.length;
  const h = p.years;
  if (n < h) throw new Error(`Need at least ${h} years of data`);
  const indexFee = p.indexFeePct / 100;
  const managerFee = p.managerFeePct / 100;
  const rate = p.withdrawalPct / 100;
  const start = data.years[0];
  const k = n - h + 1;
  const weights = { ...MIX_DEFAULTS, yours: { stocks: p.stocksPct / 100, bills: p.billsPct / 100, bonds: p.bondsPct / 100 } };
  const product = (r, i) => r.slice(i, i + h).reduce((a, x) => a * (1 + x), 1);
  const mixes = {};
  for (const [key, w] of Object.entries(weights)) {
    const real = realReturns(mixReturns(data, w, indexFee), data.inflation);
    const worst = real.reduce((m, r, i) => (r < real[m] ? i : m), 0);
    const d = drawdown(real);
    const ends = Array.from({ length: k }, (_, i) => product(real, i));
    const ranked = ends.map((e, i) => ({ e, i })).sort((a, b) => a.e - b.e || a.i - b.i).map((x) => x.i);
    const paid = Array.from({ length: k }, (_, i) => withdraw(real.slice(i, i + h), rate));
    const failed = paid.map((x, i) => ({ ...x, start: data.years[i] })).filter((x) => x.ranOut !== null);
    const fastest = failed.reduce((m, x) => (m === null || x.ranOut < m.ranOut ? x : m), null);
    const window = (i) => ({ startYear: data.years[i], endYear: data.years[i + h - 1], value: p.lump * ends[i] });
    mixes[key] = {
      real,
      realCagr: cagr(real),
      worstYear: { year: data.years[worst], r: real[worst] },
      drawdown: { deepest: d.deepest, peakYear: start - 1 + d.peak, troughYear: start - 1 + d.trough,
                  recoveryYears: d.back === null ? null : d.back - d.peak },
      worst: window(ranked[0]),
      median: window(ranked[Math.floor((k - 1) / 2)]),
      best: window(ranked[k - 1]),
      survived: paid.filter((x) => x.ranOut === null).length,
      fastestRunOut: fastest,
      income: paid.map((x, i) => ({ startYear: data.years[i], value: p.lump * x.value })),
    };
  }
  const manager = realReturns(mixReturns(data, weights.allStocks, managerFee), data.inflation);
  const yours = mixes.yours.real;
  return {
    period: [start, data.years[n - 1]],
    inflation: cagr(data.inflation),
    windows: k,
    mixes,
    managerRealCagr: cagr(manager),
    yoursBeatManager: Array.from({ length: k }, (_, i) => product(yours, i) >= product(manager, i)).filter(Boolean).length,
    feeShareLost: 1 - ((1 - managerFee) / (1 - indexFee)) ** h,
  };
};

// Display rules shared with the video (ramsey_12_percent.pct / usd).
export const pct = (x, decimals = 1) => `${(100 * x).toFixed(decimals)}%`;
export const usd = (x) => {
  if (Math.abs(x) >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
  if (Math.abs(x) >= 1e4) return `$${Math.round(x / 1e3).toLocaleString("en-US")}K`;
  return `$${Math.round(x).toLocaleString("en-US")}`;
};
