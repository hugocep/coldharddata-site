// "Average vs Real Return" calculator: the same computation as pipeline/analyses/ramsey_12_percent.py
// (compute + _plan), so the site reproduces the video's numbers. No DOM here: the page imports it.
import {
  annuityFv,
  arithmeticMean,
  cagr,
  contributionPath,
  effectiveRate,
  impliedAnnualReturn,
  realReturns,
} from "./finmath.js";

/**
 * @param data  {years: number[], nominal: number[], inflation: number[]} (decimals, consecutive years)
 * @param p     {monthly, years, claimedPct, compounding: "annual"|"monthly", feePct, timing?: "end"|"start"}
 */
export const compute = (data, p) => {
  const timing = p.timing ?? "end";
  const fee = p.feePct / 100;
  const nominal = data.nominal.map((r) => (1 + r) * (1 - fee) - 1);
  const real = realReturns(nominal, data.inflation);
  const n = nominal.length;
  const h = p.years;
  if (n < h) throw new Error(`Need at least ${h} years of data`);

  const windows = [];
  for (let i = 0; i + h <= n; i++) {
    const fvNominal = contributionPath(nominal.slice(i, i + h), p.monthly, timing).at(-1);
    const fvReal = contributionPath(real.slice(i, i + h), p.monthly, timing).at(-1);
    windows.push({
      startYear: data.years[i],
      endYear: data.years[i + h - 1],
      fvNominal,
      fvReal,
      irrReal: impliedAnnualReturn(fvReal, h, p.monthly, timing),
    });
  }
  const projection = annuityFv(effectiveRate(p.claimedPct / 100, p.compounding), h, p.monthly, timing);
  // Same ranking as the Python module: stable sort by ending balance in today's dollars, median = middle window.
  const ranked = windows.map((w, i) => ({ w, i })).sort((a, b) => a.w.fvReal - b.w.fvReal || a.i - b.i).map((x) => x.w);
  return {
    period: [data.years[0], data.years[n - 1]],
    avgNominal: arithmeticMean(nominal),
    cagrNominal: cagr(nominal),
    avgReal: arithmeticMean(real),
    cagrReal: cagr(real),
    inflation: cagr(data.inflation),
    projection,
    contributed: p.monthly * 12 * h,
    windows,
    worst: ranked[0],
    median: ranked[Math.floor((ranked.length - 1) / 2)],
    best: ranked[ranked.length - 1],
    reachedNominal: windows.filter((w) => w.fvNominal >= projection).length,
    reachedReal: windows.filter((w) => w.fvReal >= projection).length,
  };
};

// Display rules shared with the video (ramsey_12_percent.pct / usd).
export const pct = (x, decimals = 1) => `${(100 * x).toFixed(decimals)}%`;
export const usd = (x) => {
  if (Math.abs(x) >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
  if (Math.abs(x) >= 1e4) return `$${Math.round(x / 1e3).toLocaleString("en-US")}K`;
  return `$${Math.round(x).toLocaleString("en-US")}`;
};
