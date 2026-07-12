import type { Side } from './types';

/** The minimal per-unit view judging needs (module-internal to the engine). */
export interface JudgedUnit {
  side: Side;
  alive: boolean;
  hp: number;
  maxHp: number;
}

/**
 * The side whose units are ALL dead, if any — the FR18 instant-wipe check,
 * run after every attack. (With balance v1's melee-only story-1.5 roster a
 * wipe is arithmetically unreachable in one engagement — max 6 melee actions
 * cannot deal 3 units' HP — but the rule is implemented and unit-tested now;
 * story 1.6's casters make it reachable in real battles.)
 */
export function wipedSide(units: readonly JudgedUnit[]): Side | undefined {
  for (const side of ['A', 'B'] as const) {
    if (units.filter((u) => u.side === side).every((u) => !u.alive)) return side;
  }
  return undefined;
}

/**
 * FR18 **judging** verdict: wipe = instant win for the surviving side;
 * otherwise the side with the higher share of its starting team HP wins.
 * The comparison is EXACT integer cross-multiplication
 * (`remainingA × totalB` vs `remainingB × totalA`) — floored percentages are
 * REPORT data only in `hpPct` and never decide the winner (flooring would
 * manufacture false ties). Exact tie → `'draw'`.
 */
export function judge(units: readonly JudgedUnit[], wiped: Side | undefined): { winner: Side | 'draw'; hpPct: { A: number; B: number } } {
  const total = { A: 0, B: 0 };
  const remaining = { A: 0, B: 0 };
  for (const u of units) {
    total[u.side] += u.maxHp;
    remaining[u.side] += u.hp;
  }
  const hpPct = {
    A: Math.floor((remaining.A * 100) / total.A),
    B: Math.floor((remaining.B * 100) / total.B),
  };
  if (wiped !== undefined) {
    return { winner: wiped === 'A' ? 'B' : 'A', hpPct };
  }
  const a = remaining.A * total.B;
  const b = remaining.B * total.A;
  return { winner: a > b ? 'A' : b > a ? 'B' : 'draw', hpPct };
}
