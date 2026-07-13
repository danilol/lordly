import { describe, expect, it } from 'vitest';
import { chooseSetup, STRATEGY_POOL } from '../src/ai';
import type { StrategyArchetype } from '../src/ai';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import { createStreams, rollElement } from '../src/rng';
import type { MatchSetup } from '../src/types';
import { runSweep } from '../sim/sweep';
import type { ArchetypeStats } from '../sim/sweep';

/**
 * NFR4 acceptance band, enforced deterministically in CI: a REDUCED sweep
 * (fixed base seed → bit-identical every run) must show no archetype above
 * the aggregate win-rate band. FR26's <1 s selection is evidenced here for
 * free: this sweep makes hundreds of chooseSetup calls inside the test
 * budget — no dedicated perf test needed.
 */

/** [initial acceptance band — tuning value] No archetype may exceed this aggregate win rate. */
const ACCEPTANCE_BAND = 0.65;

/**
 * Reduced-but-stable CI config: 10×10 pairings × 15 runs = 1500 battles,
 * ~285 games/archetype. Bumped from an earlier runsPerPair:5 (review
 * finding): at 5 runs/pairing the per-archetype sample is small enough
 * that `ambushers` read 63.7% — mostly SAMPLING NOISE, not signal (a
 * runs=100 check converges to ~60%) — leaving only ~1.3 points of margin
 * under the 65% band on pure variance. 15 runs/pairing still finishes in
 * well under a second but reports the converged rate reliably.
 */
const CI_CONFIG = { baseSeed: 1, runsPerPair: 15, threshold: ACCEPTANCE_BAND };

describe('sim sweep (NFR4)', () => {
  const report = runSweep(STRATEGY_POOL, CI_CONFIG);

  it('is deterministic: the same config yields the bit-identical report', () => {
    expect(runSweep(STRATEGY_POOL, CI_CONFIG)).toEqual(report);
  });

  it('accounts every game: pool² × runs battles; a self-pairing counts as ONE game, not two', () => {
    const n = STRATEGY_POOL.length;
    expect(report.totalGames).toBe(n * n * CI_CONFIG.runsPerPair);
    for (const a of report.archetypes) {
      // (n-1) cross-pairings as side A + (n-1) as side B + 1 self-pairing
      // (credited once, not twice — review fix) = (2n-1) × runsPerPair.
      expect(a.games, a.id).toBe((2 * n - 1) * CI_CONFIG.runsPerPair);
    }
  });

  it('a self-pairing contributes exactly ONE game per run at a forced-neutral 0.5 win rate', () => {
    const solo = STRATEGY_POOL.filter((a) => a.id === 'ambushers');
    const solo_report = runSweep(solo, CI_CONFIG);
    const stats = solo_report.archetypes[0]!;
    expect(stats.games).toBe(CI_CONFIG.runsPerPair);
    expect(stats.winRate).toBe(0.5);
  });

  it('composition rollup correctly SUMS multiple archetypes sharing a class multiset (not just relabels 1:1)', () => {
    // Every real STRATEGY_POOL entry has a unique composition (verified
    // below), so the actual multi-archetype merge branch has never run
    // against real data — build a synthetic 2-archetype pool that shares
    // one to exercise it (review-caught coverage gap).
    const shared: [StrategyArchetype, StrategyArchetype] = [
      { ...(STRATEGY_POOL[0] as StrategyArchetype), id: 'shared-a' },
      { ...(STRATEGY_POOL[0] as StrategyArchetype), id: 'shared-b' },
    ];
    const soloA = runSweep([shared[0]], CI_CONFIG).archetypes[0]!;
    const soloB = runSweep([shared[1]], CI_CONFIG).archetypes[0]!;
    const merged = runSweep(shared, CI_CONFIG);
    expect(merged.compositions).toHaveLength(1);
    const comp = merged.compositions[0]!;
    expect(comp.archetypeIds.sort()).toEqual(['shared-a', 'shared-b']);
    // The merged composition sums each independently-run archetype's tally —
    // proving the accumulation branch (not just the fresh-entry branch) works.
    const [a, b] = merged.archetypes;
    expect(comp.games).toBe((a as ArchetypeStats).games + (b as ArchetypeStats).games);
    expect(comp.wins).toBe((a as ArchetypeStats).wins + (b as ArchetypeStats).wins);
    expect(comp.draws).toBe((a as ArchetypeStats).draws + (b as ArchetypeStats).draws);
    expect(comp.winRate).toBeCloseTo((comp.wins + comp.draws / 2) / comp.games, 10);
    // Sanity: each archetype's own tally, run solo, matches its self-pair-only slice.
    expect(soloA.games).toBe(CI_CONFIG.runsPerPair);
    expect(soloB.games).toBe(CI_CONFIG.runsPerPair);
  });

  it('runSweep rejects a pool with duplicate archetype ids (silent tally-merge guard)', () => {
    const dup = [STRATEGY_POOL[0] as StrategyArchetype, { ...(STRATEGY_POOL[1] as StrategyArchetype), id: (STRATEGY_POOL[0] as StrategyArchetype).id }];
    expect(() => runSweep(dup, CI_CONFIG)).toThrow(/duplicate archetype id/);
  });

  it('every real STRATEGY_POOL archetype has a unique composition (documents why the merge path is otherwise untested)', () => {
    const keys = report.archetypes.map((a) => a.composition);
    expect(new Set(keys).size).toBe(keys.length);
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
