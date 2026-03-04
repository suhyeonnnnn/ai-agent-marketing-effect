// ──────────────────────────────────────────────
//  Statistical Analysis — B2A Experiment
//  Chi-square, Fisher's exact, effect sizes,
//  position analysis, manipulation check rates
// ──────────────────────────────────────────────

import type { TrialResult, Condition } from "./products";

// ──────────────────────────────────────────────
//  Chi-Square Test of Independence
// ──────────────────────────────────────────────

export interface ChiSquareResult {
  statistic: number;
  df: number;
  pValue: number;
  significant: boolean;   // p < 0.05
  cramersV: number;       // effect size
}

/**
 * Chi-square test for condition × choice (target vs non-target).
 * Tests H0: choice is independent of condition.
 */
export function chiSquareTest(results: TrialResult[]): ChiSquareResult | null {
  const conditions = [...new Set(results.map((r) => r.condition))];
  if (conditions.length < 2) return null;

  // Build 2×k contingency table: [target, non-target] × conditions
  const observed: number[][] = conditions.map((c) => {
    const trials = results.filter((r) => r.condition === c);
    const hits = trials.filter((r) => r.choseTarget).length;
    return [hits, trials.length - hits];
  });

  const rowTotals = observed.map((r) => r[0] + r[1]);
  const colTotals = [
    observed.reduce((s, r) => s + r[0], 0),
    observed.reduce((s, r) => s + r[1], 0),
  ];
  const total = colTotals[0] + colTotals[1];
  if (total === 0) return null;

  // Expected frequencies
  let chi2 = 0;
  for (let i = 0; i < conditions.length; i++) {
    for (let j = 0; j < 2; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / total;
      if (expected > 0) {
        chi2 += Math.pow(observed[i][j] - expected, 2) / expected;
      }
    }
  }

  const df = conditions.length - 1;
  const pValue = 1 - chiSquaredCDF(chi2, df);
  const n = total;
  const k = Math.min(2, conditions.length);
  const cramersV = Math.sqrt(chi2 / (n * (k - 1)));

  return {
    statistic: Math.round(chi2 * 1000) / 1000,
    df,
    pValue: Math.round(pValue * 10000) / 10000,
    significant: pValue < 0.05,
    cramersV: Math.round(cramersV * 1000) / 1000,
  };
}

// ──────────────────────────────────────────────
//  Pairwise Proportion Tests (Z-test)
// ──────────────────────────────────────────────

export interface PairwiseResult {
  condA: string;
  condB: string;
  rateA: number;
  rateB: number;
  diff: number;
  zStat: number;
  pValue: number;
  significant: boolean;
  oddsRatio: number;
}

export function pairwiseProportionTests(results: TrialResult[]): PairwiseResult[] {
  const conditions = [...new Set(results.map((r) => r.condition))];
  const pairs: PairwiseResult[] = [];

  for (let i = 0; i < conditions.length; i++) {
    for (let j = i + 1; j < conditions.length; j++) {
      const a = results.filter((r) => r.condition === conditions[i]);
      const b = results.filter((r) => r.condition === conditions[j]);
      if (a.length === 0 || b.length === 0) continue;

      const hitsA = a.filter((r) => r.choseTarget).length;
      const hitsB = b.filter((r) => r.choseTarget).length;
      const rateA = hitsA / a.length;
      const rateB = hitsB / b.length;

      // Pooled proportion z-test
      const pooledP = (hitsA + hitsB) / (a.length + b.length);
      const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / a.length + 1 / b.length));
      const z = se > 0 ? (rateA - rateB) / se : 0;
      const p = 2 * (1 - normalCDF(Math.abs(z)));

      // Odds ratio
      const or_num = (hitsA + 0.5) * (b.length - hitsB + 0.5);
      const or_den = (a.length - hitsA + 0.5) * (hitsB + 0.5);
      const oddsRatio = or_den > 0 ? or_num / or_den : Infinity;

      pairs.push({
        condA: conditions[i],
        condB: conditions[j],
        rateA: Math.round(rateA * 1000) / 1000,
        rateB: Math.round(rateB * 1000) / 1000,
        diff: Math.round((rateA - rateB) * 1000) / 1000,
        zStat: Math.round(z * 1000) / 1000,
        pValue: Math.round(p * 10000) / 10000,
        significant: p < 0.05,
        oddsRatio: Math.round(oddsRatio * 100) / 100,
      });
    }
  }

  return pairs;
}

// ──────────────────────────────────────────────
//  Position Analysis
// ──────────────────────────────────────────────

export interface PositionStats {
  position: number;      // 1-8
  timesChosen: number;
  totalAppearances: number;
  choiceRate: number;
  expectedRate: number;  // 1/8 = 12.5%
  overRepresented: boolean;
}

export function analyzePositionBias(results: TrialResult[]): PositionStats[] {
  const positions = Array.from({ length: 8 }, (_, i) => i + 1);
  const expectedRate = 1 / 8;

  return positions.map((pos) => {
    const chosen = results.filter((r) => r.chosenPosition === pos).length;
    const rate = results.length > 0 ? chosen / results.length : 0;
    return {
      position: pos,
      timesChosen: chosen,
      totalAppearances: results.length,
      choiceRate: Math.round(rate * 1000) / 1000,
      expectedRate,
      overRepresented: rate > expectedRate * 1.5,
    };
  });
}

// ──────────────────────────────────────────────
//  Manipulation Check Analysis
// ──────────────────────────────────────────────

export interface ManipCheckStats {
  condition: string;
  totalTrials: number;
  checksDone: number;
  badgeNoticed: number;
  noticeRate: number;
  correctIdentification: number; // noticed badge on the correct product
  correctRate: number;
}

export function analyzeManipulationChecks(results: TrialResult[]): ManipCheckStats[] {
  const conditions = [...new Set(results.map((r) => r.condition))];

  return conditions.map((c) => {
    const trials = results.filter((r) => r.condition === c);
    const withChecks = trials.filter((r) => r.manipulationCheck != null);
    const noticed = withChecks.filter((r) => r.manipulationCheck!.noticed);
    const correct = noticed.filter((r) =>
      r.manipulationCheck!.mentionedProductId === r.targetProductId
    );

    return {
      condition: c,
      totalTrials: trials.length,
      checksDone: withChecks.length,
      badgeNoticed: noticed.length,
      noticeRate: withChecks.length > 0 ? Math.round((noticed.length / withChecks.length) * 1000) / 1000 : 0,
      correctIdentification: correct.length,
      correctRate: noticed.length > 0 ? Math.round((correct.length / noticed.length) * 1000) / 1000 : 0,
    };
  });
}

// ──────────────────────────────────────────────
//  Cross-tabulation: Condition × Input Mode
// ──────────────────────────────────────────────

export interface CrossTab {
  condition: string;
  inputMode: string;
  trials: number;
  targetHits: number;
  targetRate: number;
  avgLatency: number;
}

export function crossTabulation(results: TrialResult[]): CrossTab[] {
  const conditions = [...new Set(results.map((r) => r.condition))];
  const modes = [...new Set(results.map((r) => r.inputMode))];
  const tabs: CrossTab[] = [];

  for (const c of conditions) {
    for (const m of modes) {
      const trials = results.filter((r) => r.condition === c && r.inputMode === m);
      if (trials.length === 0) continue;
      const hits = trials.filter((r) => r.choseTarget).length;
      tabs.push({
        condition: c,
        inputMode: m,
        trials: trials.length,
        targetHits: hits,
        targetRate: Math.round((hits / trials.length) * 1000) / 1000,
        avgLatency: Math.round((trials.reduce((s, t) => s + t.latencySec, 0) / trials.length) * 10) / 10,
      });
    }
  }

  return tabs;
}

// ──────────────────────────────────────────────
//  Cost Summary
// ──────────────────────────────────────────────

export interface CostSummary {
  model: string;
  totalTrials: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgCostPerTrial: number;
}

export function summarizeCosts(results: TrialResult[]): CostSummary[] {
  const models = [...new Set(results.map((r) => r.model))];
  return models.map((m) => {
    const trials = results.filter((r) => r.model === m);
    const totalInput = trials.reduce((s, t) => s + (t.inputTokens || 0), 0);
    const totalOutput = trials.reduce((s, t) => s + (t.outputTokens || 0), 0);
    const totalCost = trials.reduce((s, t) => s + (t.estimatedCostUsd || 0), 0);
    return {
      model: m,
      totalTrials: trials.length,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
      avgCostPerTrial: trials.length > 0 ? Math.round((totalCost / trials.length) * 10000) / 10000 : 0,
    };
  });
}

// ──────────────────────────────────────────────
//  Statistical Utility Functions
// ──────────────────────────────────────────────

/** Standard normal CDF (Abramowitz & Stegun approximation) */
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

/** Chi-squared CDF via regularized lower incomplete gamma */
function chiSquaredCDF(x: number, k: number): number {
  if (x <= 0) return 0;
  return regularizedGammaP(k / 2, x / 2);
}

/** Regularized lower incomplete gamma function P(a, x) */
function regularizedGammaP(a: number, x: number): number {
  if (x < a + 1) {
    // Series expansion
    let sum = 1 / a, term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-10) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  } else {
    // Continued fraction (Lentz)
    return 1 - regularizedGammaQ(a, x);
  }
}

function regularizedGammaQ(a: number, x: number): number {
  let f = 1e-30, c = 1e-30, d = 1 / (x + 1 - a);
  let h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    const bn = x + 2 * i + 1 - a;
    d = bn + an * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = bn + an / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = c * d;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-10) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** Log-gamma function (Lanczos approximation) */
function lnGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
