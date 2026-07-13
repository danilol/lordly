import { describe, expect, it } from 'vitest';
import { chooseSetup, STRATEGY_POOL } from '../src/ai';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import { createStreams, rollElement } from '../src/rng';
import type { MatchSetup } from '../src/types';
import { runSweep } from '../sim/sweep';

/**
 * NFR4 acceptance band, enforced deterministically in CI: a REDUCED sweep
 * (fixed base seed → bit-identical every run) must show no archetype above
 * the aggregate win-rate band. FR26's <1 s selection is evidenced here for
 * free: this sweep makes hundreds of chooseSetup calls inside the test
 * budget — no dedicated perf test needed.
 */

/** [initial acceptance band — tuning value] No archetype may exceed this aggregate win rate. */
const ACCEPTANCE_BAND = 0.65;

/** Reduced-but-stable CI config: 10×10 pairings × 5 runs = 500 battles, ~100 games/archetype. */
const CI_CONFIG = { baseSeed: 1, runsPerPair: 5, threshold: ACCEPTANCE_BAND };

describe('sim sweep (NFR4)', () => {
  const report = runSweep(STRATEGY_POOL, CI_CONFIG);

  it('is deterministic: the same config yields the bit-identical report', () => {
    expect(runSweep(STRATEGY_POOL, CI_CONFIG)).toEqual(report);
  });

  it('accounts every game: pool² × runs battles, each archetype fielded on both sides', () => {
    const n = STRATEGY_POOL.length;
    expect(report.totalGames).toBe(n * n * CI_CONFIG.runsPerPair);
    for (const a of report.archetypes) {
      // Side A in n pairings + side B in n pairings, runsPerPair each.
      expect(a.games, a.id).toBe(2 * n * CI_CONFIG.runsPerPair);
    }
  });

  it('win rates are draw-half-credit and internally consistent', () => {
    for (const a of report.archetypes) {
      expect(a.winRate, a.id).toBeCloseTo((a.wins + a.draws / 2) / a.games, 10);
      expect(a.wins + a.draws, a.id).toBeLessThanOrEqual(a.games);
    }
  });

  it('rolls archetypes up into compositions (class multisets — the NFR4 balance question)', () => {
    const compGames = report.compositions.reduce((sum, c) => sum + c.games, 0);
    const archGames = report.archetypes.reduce((sum, a) => sum + a.games, 0);
    expect(compGames).toBe(archGames);
    for (const c of report.compositions) {
      expect(c.archetypeIds.length, c.composition).toBeGreaterThanOrEqual(1);
    }
  });

  // DETERMINISM ANCHOR (rng-lessons convention), hand-derived — NOT pasted
  // from a run: bulwark (3 knights, front row) vs three-mages (3 mages, back
  // row). Mages (AGI 12) act before knights (AGI 8) every pass; each blast
  // hits the whole knight row for 34: INT 30 − floor(MEN 14 / 2) = 23, ×3/2
  // RPS (mage beats knight) = 34 (damage.test pins this). Knights (140 hp)
  // survive 4 blasts (136) and die on the 5th, early in pass 2, before
  // their AGI-8 turns — so they land EXACTLY 3 swings in pass 1, each 19 on
  // its facing mage (26 base, ×3/4 disadvantage). Verdict: side A wiped;
  // hpPct B = floor((3 × (80 − 19)) / 240 × 100) = 76. Both boards are
  // left↔right symmetric, so mirror flips and elements (no witch) change
  // NOTHING — the outcome holds for EVERY seed; 42 is pinned arbitrarily.
  it('anchor: bulwark vs three-mages resolves to a B wipe at 0%/76% (hand-derived)', () => {
    const bulwark = STRATEGY_POOL.find((a) => a.id === 'bulwark')!;
    const mages = STRATEGY_POOL.find((a) => a.id === 'three-mages')!;
    const seed = 42;
    // Assemble exactly as sweep.ts/MatchFlow do (recorded spec decision 4).
    const streams = createStreams(seed);
    const a = chooseSetup([bulwark], streams['ai/A']);
    const b = chooseSetup([mages], streams['ai/B']);
    const setup: MatchSetup = {
      seed,
      balanceVersion: BALANCE.version,
      mode: 'single',
      armies: {
        A: a.classes.map((cls) => ({ class: cls, element: rollElement(streams['elements/A']) })),
        B: b.classes.map((cls) => ({ class: cls, element: rollElement(streams['elements/B']) })),
      },
      placements: { A: a.placement, B: b.placement },
    };
    const ended = resolveBattle(setup).events.find((e) => e.type === 'BattleEnded');
    expect(ended).toMatchObject({ winner: 'B', hpPct: { A: 0, B: 76 } });
  });

  it(`ACCEPTANCE BAND: no archetype exceeds ${ACCEPTANCE_BAND * 100}% aggregate win rate (AC3)`, () => {
    const table = report.archetypes.map((a) => `${a.id}: ${(a.winRate * 100).toFixed(1)}%`).join('\n');
    for (const a of report.archetypes) {
      expect(a.winRate, `dominant archetype flagged — sweep table:\n${table}`).toBeLessThanOrEqual(ACCEPTANCE_BAND);
    }
    expect(report.flagged).toEqual([]);
  });
});
