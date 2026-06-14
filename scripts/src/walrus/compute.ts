/**
 * Pure computation of one yield-curve data point from on-chain market state and
 * the DeepBook mids. Kept side-effect-free so it is trivial to unit test.
 */
import type { MarketState } from './market';
import type { YieldPoint } from './walrus';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function round(x: number, dp = 6): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

export function computeYieldPoint(params: {
  nowMs: number;
  state: MarketState;
  ptMid: number | null;
  ytMid: number | null;
}): YieldPoint {
  const { nowMs, state, ptMid, ytMid } = params;

  const ttmMs = Number(state.maturityMs) - nowMs;
  const ttmYears = ttmMs / YEAR_MS;

  // PT redeems 1:1 at maturity, so buying PT at a mid below par locks a fixed
  // yield to maturity: impliedApy = (1 / ptMid)^(1 / ttmYears) - 1.
  let impliedApy = 0;
  if (ptMid !== null && ptMid > 0 && ptMid <= 1 && ttmYears > 0) {
    impliedApy = Math.pow(1 / ptMid, 1 / ttmYears) - 1;
  }

  // Accrual proxy derived purely from on-chain state: cumulative yield over
  // principal. Swap for a real underlying index (Scallop/LST) when wired.
  const principal = Number(state.principalValue);
  const accrued = Number(state.yieldValue);
  const underlyingIndex = principal > 0 ? 1 + accrued / principal : 1;

  return {
    t: Math.floor(nowMs / 1000),
    impliedApy: round(impliedApy),
    underlyingIndex: round(underlyingIndex),
    ptMid: ptMid === null ? null : round(ptMid),
    ytMid: ytMid === null ? null : round(ytMid),
  };
}
