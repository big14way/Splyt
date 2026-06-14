import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeYieldPoint } from './compute';
import type { MarketState } from './market';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function state(over: Partial<MarketState> = {}): MarketState {
  return {
    maturityMs: 0n,
    isMatured: false,
    principalValue: 0n,
    yieldValue: 0n,
    ptSupply: 0n,
    ytSupply: 0n,
    finalYield: 0n,
    finalYtSupply: 0n,
    ...over,
  };
}

test('implied APY: PT at par one year out is ~0', () => {
  const now = 0;
  const p = computeYieldPoint({
    nowMs: now,
    state: state({ maturityMs: BigInt(YEAR_MS) }),
    ptMid: 1,
    ytMid: 0,
  });
  assert.equal(p.impliedApy, 0);
});

test('implied APY: PT at 0.90 one year out ≈ 11.1%', () => {
  const p = computeYieldPoint({
    nowMs: 0,
    state: state({ maturityMs: BigInt(YEAR_MS) }),
    ptMid: 0.9,
    ytMid: 0.05,
  });
  // (1/0.9)^(1/1) - 1 = 0.1111...
  assert.ok(Math.abs(p.impliedApy - 0.111111) < 1e-5, `got ${p.impliedApy}`);
});

test('implied APY: shorter tenor annualizes higher', () => {
  const halfYear = BigInt(YEAR_MS / 2);
  const p = computeYieldPoint({
    nowMs: 0,
    state: state({ maturityMs: halfYear }),
    ptMid: 0.95,
    ytMid: 0.04,
  });
  // (1/0.95)^(1/0.5) - 1 = (1/0.95)^2 - 1 ≈ 0.1080
  assert.ok(p.impliedApy > 0.1 && p.impliedApy < 0.12, `got ${p.impliedApy}`);
});

test('implied APY is 0 when past maturity or PT above par', () => {
  const past = computeYieldPoint({
    nowMs: 2 * YEAR_MS,
    state: state({ maturityMs: BigInt(YEAR_MS) }),
    ptMid: 0.9,
    ytMid: 0,
  });
  assert.equal(past.impliedApy, 0);

  const abovePar = computeYieldPoint({
    nowMs: 0,
    state: state({ maturityMs: BigInt(YEAR_MS) }),
    ptMid: 1.05,
    ytMid: 0,
  });
  assert.equal(abovePar.impliedApy, 0);
});

test('underlyingIndex = 1 + yield/principal; ytMid passes through', () => {
  const p = computeYieldPoint({
    nowMs: 0,
    state: state({ maturityMs: BigInt(YEAR_MS), principalValue: 1000n, yieldValue: 41n }),
    ptMid: 0.97,
    ytMid: 0.041,
  });
  assert.equal(p.underlyingIndex, 1.041);
  assert.equal(p.ytMid, 0.041);
  assert.equal(p.ptMid, 0.97);
});

test('null mids propagate as null', () => {
  const p = computeYieldPoint({
    nowMs: 0,
    state: state({ maturityMs: BigInt(YEAR_MS) }),
    ptMid: null,
    ytMid: null,
  });
  assert.equal(p.ptMid, null);
  assert.equal(p.ytMid, null);
  assert.equal(p.impliedApy, 0);
});
