import type { Side } from './types';

/** The minimal per-unit view judging needs (module-internal to the engine). */
export interface JudgedUnit {
  side: Side;
  alive: boolean;
  hp: number;
  maxHp: number;
}

/** Wipe outcome: one side fully dead, both (mutual wipe), or none. */
export type WipeState = Side | 'both' | undefined;

/**
 * The wipe state — the FR18 instant-wipe check, run after every death.
 * `'both'` covers a mutual wipe (unreachable with 1.5's sequential melee
 * deaths, but 1.6's end-of-engagement poison can zero units on both sides in
 * one step — a mutual wipe judges as a draw, never a win for either side).
 * A side with no units at all is NOT considered wiped (vacuous-truth guard);
 * `validateMatchSetup` makes that unreachable through `resolveBattle`.
 *
 * (With balance v1's melee-only story-1.5 roster even a single wipe is
 * arithmetically unreachable in one engagement — max 6 melee actions cannot
 * deal 3 units' HP — but the rule is implemented and unit-tested now; story
 * 1.6's casters make it reachable in real battles.)
 */
export function wipedSide(units: readonly JudgedUnit[]): WipeState {
  const dead = { A: false, B: false };
  for (const side of ['A', 'B'] as const) {
    const sideUnits = units.filter((u) => u.side === side);
    dead[side] = sideUnits.length > 0 && sideUnits.every((u) => !u.alive);
  }
  if (dead.A && dead.B) return 'both';
  if (dead.A) return 'A';
  if (dead.B) return 'B';
  return undefined;
}

/**
 * FR18 **judging** verdict: a single wipe = instant win for the surviving
 * side; a mutual wipe = draw; otherwise the side with the higher share of its
 * starting team HP wins. The comparison is EXACT integer cross-multiplication
 * (`remainingA × totalB` vs `remainingB × totalA`) — floored percentages are
 * REPORT data only in `hpPct` and never decide the winner (flooring would
 * manufacture false ties). Exact tie → `'draw'`. A zero starting total
 * (unreachable through validation) reports 0%, never NaN.
 */
export function judge(units: readonly JudgedUnit[], wiped: WipeState): { winner: Side | 'draw'; hpPct: { A: number; B: number } } {
  const total = { A: 0, B: 0 };
  const remaining = { A: 0, B: 0 };
  for (const u of units) {
    total[u.side] += u.maxHp;
    remaining[u.side] += u.hp;
  }
  const hpPct = {
    A: total.A === 0 ? 0 : Math.floor((remaining.A * 100) / total.A),
    B: total.B === 0 ? 0 : Math.floor((remaining.B * 100) / total.B),
  };
  if (wiped === 'both') {
    return { winner: 'draw', hpPct };
  }
  if (wiped !== undefined) {
    return { winner: wiped === 'A' ? 'B' : 'A', hpPct };
  }
  const a = remaining.A * total.B;
  const b = remaining.B * total.A;
  return { winner: a > b ? 'A' : b > a ? 'B' : 'draw', hpPct };
}
