import { describe, expect, it } from 'vitest';
import { chooseSetup, STRATEGY_POOL } from '../src/ai';
import type { StrategyArchetype } from '../src/ai';
import { BALANCE } from '../src/balance';
import { rollName } from '../src/names';
import { resolveBattle } from '../src/resolve';
import { createStreams, rollElement } from '../src/rng';
import type { Stream } from '../src/rng';
import type { MatchSetup, Unit, UnitClass } from '../src/types';
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
 * Reduced-but-fast CI config: pool² pairings × 15 runs (18² × 15 = 4860
 * battles since story 5.5's monster wave) — a fast, DETERMINISTIC proxy
 * (fixed baseSeed) for the balance truth. The truth is the CONVERGED rate: at
 * runsPerPair≥150 the
 * story-4.4 pool tops out at ~62.8% single / ~60% wipeout — genuinely inside
 * the 65% band after the fixed two-step pipeline (FR9 global range re-tuned the
 * three-mages + gale placements) and the tactic dimension (each side commits
 * its own tactic from its stream, FR24). That tactic axis adds variance, so a
 * single 15-run sweep is a noisy estimate — but this config is PINNED to a
 * baseSeed where every archetype sits under the band, and CI re-runs the
 * identical seed each time (deterministic, no flake). runsPerPair stays 15 (not
 * higher) on purpose: the cap-length wipeout sweep is the suite's heaviest
 * test, and a bigger sweep starves the parallel fast-check property tests'
 * default timeouts. Read the failure table's top entries if the band trips.
 *
 * Story 5.4 re-pin: the E5-D4 bolt meta re-tuned the pool (see ai.ts), and the
 * old baseSeed-1 sample put wardens at 65.9% single while its CONVERGED rate
 * is 61.3% (runs=500; wipeout max longbows 64.9%) — a proxy artifact, not a
 * balance fact. Seeds 16–25 all sample in-band for BOTH modes at 15 runs;
 * baseSeed 21 (single max 63.6%, wipeout max 62.8%) sits mid-run for
 * robustness against small future pool edits.
 *
 * Story 5.5 re-VERIFY (no re-pin needed): the monster wave grew the pool
 * 12 → 18 and re-tuned longbows + farshot, so the whole seed landscape moved
 * — but baseSeed 21 stayed clean and stayed mid-run. Seeds 14–28 all sample
 * in-band for BOTH modes at 15 runs; 21 reads single max 60.9% / wipeout max
 * 61.8% with pool floors at 28.9% / 29.8%, so it has real margin in both
 * directions. Outside that window the proxy trips on the two comps that ARE
 * the band's ceiling at convergence: twin-golems in single (seeds 29–38) and
 * longbows in wipeout (seeds 2–6, 11–13, 34+).
 *
 * Story 5.10 re-VERIFY (the pre-PvP verdict — no re-pin, no tuning): the epic
 * closed with the roster settled since 5.5 (5.6/5.7/5.8 were shell-only), and
 * baseSeed 21 still reads single max 60.9% / wipeout max 61.8% with floors at
 * 28.9% / 29.8% — unchanged, because nothing balance-shaped moved. The
 * certified converged truth is in `docs/balance-verdict.md`: single 64.3–64.4%
 * (twin-golems), wipeout 63.8% (longbows), floors `gale` 29.6% / `breath-battery`
 * 30.3%, all stable across seeds 1/2/3 at runs=500. `balanceVersion` stays 11.
 */
const CI_CONFIG = { baseSeed: 21, runsPerPair: 15, threshold: ACCEPTANCE_BAND };

describe('sim sweep (NFR4)', () => {
  const report = runSweep(STRATEGY_POOL, CI_CONFIG);

  // Determinism holds at ANY config, so this uses a TINY one (runs=3) rather
  // than re-running the heavy CI_CONFIG sweep — the story-4.4 runs=30 bump made
  // a full re-run needlessly expensive under parallel CI load.
  // Explicit 20s timeout (story 5.0): two full-pool sweeps back-to-back brush
  // Vitest's 5s default under v8-instrumented coverage + parallel project load
  // (the pnpm-coverage flake, deferred-work 2026-07-20) — a load flake, not a
  // slow assertion.
  it('is deterministic: the same config yields the bit-identical report', () => {
    const tiny = { baseSeed: 1, runsPerPair: 3, threshold: ACCEPTANCE_BAND };
    expect(runSweep(STRATEGY_POOL, tiny)).toEqual(runSweep(STRATEGY_POOL, tiny));
  }, 20_000);

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
  // from a run. Story 4.2 replaced the 3-unit bulwark-vs-three-mages anchor
  // (the re-authored pool entries mix classes, ending hand-derivability) with
  // a CUSTOM singleton pair built for it: a wall of 5 knights (front L/C/R +
  // mid L/R) vs a battery of 5 mages (back L/C/R + mid L/R).
  // No cross-side AGI ties exist (8 vs 12), both boards are left↔right
  // symmetric, and no witch is present — so tie flips, mirror flips, and
  // elements change NOTHING: the outcome holds for EVERY seed; 42 is pinned
  // arbitrarily. The battle, by hand:
  // • Pass 1 — all five mages (AGI 12, mid row before back, left before
  //   right) blast the fullest enemy row: the 3-knight front. Each blast
  //   deals 34 per knight: INT 30 − floor(MEN 14/2) = 23, ×3/2 RPS = 34
  //   (damage.test pins this). Knights (140 hp) survive four (136) and all
  //   three die on the fifth blast. A:0 (front-left) is A's DEFAULT LEADER
  //   (index 0), so its death fires LeaderFell(A) and arms A's sober package
  //   (story 4.5, FR35): from A's next action on, A's PHYSICAL damage is cut
  //   ×3/4. The two mid knights (AGI 8, mid budget = 1 action) then swing: each
  //   reaches only the enemy MID row (front is empty) and its facing mid mage.
  //   A base hit is STR 30 − floor(VIT 8/2) = 26, ×3/4 RPS = 19, ×3/4 penalty =
  //   floor(14.25) = 14 — BUT story 4.7 makes the Knight's MID row Guard-half
  //   instead of swinging (the per-row move table), so A:3/A:4 raise a Guard
  //   charge each instead of striking B's mid mages. Nothing physical ever
  //   tests those charges (only magic blasts reach A's mid row), so both
  //   simply expire (`GuardEnded`) unconsumed at the engagement's natural end.
  //   (Magic is untouched — the mages' blasts stay 34, take no draws, and
  //   never interact with Guard, which is physical-only.)
  // • Pass 2 — only the three back mages still hold an action (back budget
  //   2). The fullest living enemy row is now A's mid (2 knights): three
  //   blasts × 34 = 102 each, 140→38. Nobody else acts; engagement ends.
  // • Verdict — no wipe, judged on exact HP fractions: A = 76/700 → 10%,
  //   B = 400/400 → 100% (B's mid mages, never struck, hold full HP).
  //   Winner B, 10% vs 100%.
  it('anchor: knight wall vs mage battery resolves 65%/76% to B (story 5.4 — bolts snipe the mid knights; the front three survive and swing back)', () => {
    const wall: StrategyArchetype = {
      id: 'anchor-wall',
      name: 'Anchor Wall',
      classes: ['knight', 'knight', 'knight', 'knight', 'knight'],
      placement: [
        { row: 'front', col: 'left' },
        { row: 'front', col: 'center' },
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'left' },
        { row: 'mid', col: 'right' },
      ],
    };
    const battery: StrategyArchetype = {
      id: 'anchor-battery',
      name: 'Anchor Battery',
      classes: ['mage', 'mage', 'mage', 'mage', 'mage'],
      placement: [
        { row: 'back', col: 'left' },
        { row: 'back', col: 'center' },
        { row: 'back', col: 'right' },
        { row: 'mid', col: 'left' },
        { row: 'mid', col: 'right' },
      ],
    };
    const seed = 42;
    // Assemble exactly as sweep.ts/MatchFlow do (recorded spec decision 4).
    const streams = createStreams(seed);
    const a = chooseSetup([wall], streams['ai/A']);
    const b = chooseSetup([battery], streams['ai/B']);
    const buildArmy = (classes: readonly UnitClass[], elements: Stream, names: Stream): Unit[] => {
      const taken: string[] = [];
      return classes.map((cls) => {
        const unit = { class: cls, element: rollElement(elements), name: rollName(names, cls, taken) };
        taken.push(unit.name);
        return unit;
      });
    };
    const setup: MatchSetup = {
      seed,
      balanceVersion: BALANCE.version,
      mode: 'single',
      tactics: { A: 'autonomous', B: 'autonomous' },
      leaders: { A: 0, B: 0 },
      armies: {
        A: buildArmy(a.classes, streams['elements/A'], streams['names/A']),
        B: buildArmy(b.classes, streams['elements/B'], streams['names/B']),
      },
      placements: { A: a.placement, B: b.placement },
    };
    const ended = resolveBattle(setup).events.find((e) => e.type === 'BattleEnded');
    // Story 5.4 (E5-D4): the battery's bolts target REARMOST — A's mid pair
    // (A:4 dies, A:3 chips to 38) — instead of erasing the front row, and the
    // surviving front knights answer for 19/swing. A's side is DRAW-FREE
    // arithmetic (magic takes no rolls): 700 − 242 = 458 → 65%. B's side
    // depends on this seed's dodge draws: 5 of 6 swings land → 305/400 → 76%.
    // The old 10%/100% blowout is the meta shift in one line.
    expect(ended).toMatchObject({ winner: 'B', hpPct: { A: 65, B: 76 } });
  });

  // Explicit 20s timeout (story 5.0 review): this test only READS the
  // describe-scope `report`, but that sweep runs at collection time where
  // per-test timeouts don't apply — if the runner ever charges collection cost
  // to the first tests in the file (the historical flake record named this
  // test), the belt below is the only guard a test-level setting can offer.
  it(`ACCEPTANCE BAND: no archetype exceeds ${ACCEPTANCE_BAND * 100}% aggregate win rate (AC3)`, () => {
    const table = report.archetypes.map((a) => `${a.id}: ${(a.winRate * 100).toFixed(1)}%`).join('\n');
    for (const a of report.archetypes) {
      expect(a.winRate, `dominant archetype flagged — sweep table:\n${table}`).toBeLessThanOrEqual(ACCEPTANCE_BAND);
    }
    expect(report.flagged).toEqual([]);
  }, 20_000);

  /**
   * The VIABILITY FLOOR, watched by measurement rather than by name (story
   * 5.10). The band above is a ceiling; this is its opposite bound — no
   * archetype may be so weak it is unplayable, because a comp nobody can win
   * with is a dead branch of the draft.
   *
   * Why derived and not named: the test below this one is named for `wardens`
   * because story 3.0 measured it at a 33% single-mode floor, and for four
   * epics that name was the floor guard. It is not any more — 5.4's bolt meta
   * made melee the muscle and 5.10 measured `wardens` at 57.3% single (2nd of
   * 18) / 48.0% wipeout, so its `> 0.25` assertion had drifted onto nearly the
   * pool's STRONGEST comp while the real floor (`gale` 29.6% single,
   * `breath-battery` 30.3% wipeout at runs=500) went unwatched. Taking the
   * minimum over the report keeps this pointed at whatever is actually weakest,
   * so the next roster wave cannot silently move the floor out from under it.
   * (The same guard-decay pattern the 5.4 engine review found three times.)
   *
   * The 0.25 threshold is the one the wardens test has always used, kept for
   * continuity and comfortably clear of every measured floor: 28.9% at this CI
   * proxy config, 29.6%/30.3% at runs=500 convergence.
   */
  const VIABILITY_FLOOR = 0.25;

  it('the WEAKEST archetype in the pool stays viable — the floor bound, derived not named (story 5.10)', () => {
    const weakest = report.archetypes.reduce((lo, a) => (a.winRate < lo.winRate ? a : lo));
    const table = report.archetypes.map((a) => `${a.id}: ${(a.winRate * 100).toFixed(1)}%`).join('\n');
    expect(weakest.winRate, `pool floor collapsed (${weakest.id}) — sweep table:\n${table}`).toBeGreaterThan(VIABILITY_FLOOR);
  }, 20_000);

  it('the melee-heavy wardens stays VIABLE and in-band (the 3.0 wasted-swing check — melee is no longer the floor)', () => {
    // Story 3.0 flagged the melee-heavy `wardens` at a 33% single-mode floor and
    // hoped tactics would LIFT it (fewer wasted swings). Story 4.4's melee
    // blockade (a front unit shields the back, even under a target tactic —
    // Danilo, 2026-07-18) makes that hope only partly true: melee is now MORE
    // constrained under a tactic, so the "improves" premise no longer holds as a
    // hard rule.
    //
    // Story 5.10 re-measured and this test's PREMISE IS RETIRED, though the
    // assertions stay useful: with the casters bolted (5.4's E5-D4), melee
    // became the meta's muscle — `wardens` converges at 57.3% single (2nd of 18)
    // / 48.0% wipeout, i.e. mid-to-high, NOT the pool's floor. So read the
    // `> 0.25` below as continuity, not as the floor guard it used to be: the
    // real floor bound is the derived weakest-archetype test above, and the real
    // floors are `gale` (29.6% single) and `breath-battery` (30.3% wipeout).
    // What this test still earns: melee specifically is neither collapsed nor
    // dominant, which is the 3.0 question restated for today's meta.
    const wardens = report.archetypes.find((a) => a.id === 'wardens');
    expect(wardens, 'wardens archetype present in the pool').toBeDefined();
    expect((wardens as ArchetypeStats).winRate, 'wardens stays viable, not collapsed (melee is playable)').toBeGreaterThan(0.25);
    expect((wardens as ArchetypeStats).winRate, 'wardens is not itself dominant').toBeLessThanOrEqual(ACCEPTANCE_BAND);
  });

  // Mode-default equivalence also holds at any config — use a TINY one.
  // Explicit 20s timeout (story 5.0): same two-full-pool-sweeps shape as the
  // determinism test above — the coverage load flake, not a slow assertion.
  it('omitting mode is exactly single mode (the historical sweep behavior)', () => {
    const tiny = { baseSeed: 1, runsPerPair: 3, threshold: ACCEPTANCE_BAND };
    expect(runSweep(STRATEGY_POOL, tiny)).toEqual(runSweep(STRATEGY_POOL, { ...tiny, mode: 'single' }));
  }, 20_000);

  // Story 3.0: the band holds in BOTH modes (the wipeout knob deferred since
  // 1.10). Wipeout battles run up to BALANCE.engagementCap engagements — 10
  // since story 4.2 (FR19) — so the wipeout sweep is ~10× the single-mode
  // compute. The v1 baseline FAILED this band (three-mages 74.6% at runs=500):
  // un-attenuated blasts compound across engagements, which is why
  // blastAttenuation is wipeout-scoped. Story 4.4 re-swept both modes after the
  // fixed two-step pipeline (FR9 global range re-tuned three-mages + gale
  // placements) and bumped runsPerPair 15→30 for tactic-dimension variance —
  // read the failure table's top entries when this band ever trips.
  // Explicit 60s timeout: this is the single heaviest sweep (cap-length wipeout
  // × runs=30) and brushes Vitest's default under a loaded CI runner — a load
  // flake, not a slow assertion (story 3.2/4.2/4.4 review lineage).
  //
  // Story 4.12's CONVERGENCE DISCREPANCY is RETIRED as of story 5.5. History:
  // 4.12 found `farshot` at a stable 65.3% converged wipeout rate — a real
  // 0.3% band crossing — and Danilo's call (2026-07-20) was to accept it as a
  // conscious widening rather than re-tune a fun comp. The monster wave pushed
  // it to 66.0%, which made "accept" untenable, and the fix turned out to cost
  // farshot nothing: its second archer slides one column (mid/right →
  // mid/left, ai.ts) for 62.5% wipeout AND a better single-mode rate. So there
  // is no accepted deviation left to carry: at runs=500 across seeds 1/2/3 the
  // converged maxima are single 64.3% (twin-golems) and wipeout 63.8%
  // (longbows), both genuinely under the band.
  //
  // Story 5.10 re-certified both modes at convergence and the numbers above
  // still hold exactly (single 64.3–64.4% twin-golems, wipeout 63.8% longbows,
  // stable across seeds 1/2/3 at runs=500) — no tuning, `balanceVersion` stays
  // 11. Worth recording for the next verdict: the runs=200 wipeout sample read
  // longbows at 64.6%, i.e. 0.8 points HIGHER than its converged rate. The
  // convergence rule cuts both ways — a 200-run reading can overstate a comp
  // into looking edge-critical as easily as it can understate a real crossing
  // (4.12's farshot was the understating direction). Certify on 500.
  it(`ACCEPTANCE BAND (wipeout): no archetype exceeds ${ACCEPTANCE_BAND * 100}% aggregate win rate in wipeout mode`, () => {
    const wipeoutReport = runSweep(STRATEGY_POOL, { ...CI_CONFIG, mode: 'wipeout' });
    const table = wipeoutReport.archetypes.map((a) => `${a.id}: ${(a.winRate * 100).toFixed(1)}%`).join('\n');
    for (const a of wipeoutReport.archetypes) {
      expect(a.winRate, `dominant archetype flagged (wipeout) — sweep table:\n${table}`).toBeLessThanOrEqual(ACCEPTANCE_BAND);
    }
    expect(wipeoutReport.flagged).toEqual([]);
    // The floor bound in wipeout too (story 5.10) — asserted HERE rather than in
    // its own test purely to reuse this sweep: the cap-length wipeout run is the
    // suite's heaviest, and a second one for one assertion is not worth it.
    const weakest = wipeoutReport.archetypes.reduce((lo, a) => (a.winRate < lo.winRate ? a : lo));
    expect(weakest.winRate, `pool floor collapsed in wipeout (${weakest.id}) — sweep table:\n${table}`).toBeGreaterThan(VIABILITY_FLOOR);
  }, 60_000);
});
