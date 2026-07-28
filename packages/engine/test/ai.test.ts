import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { chooseSetup, STRATEGY_POOL } from '../src/ai';
import { BALANCE, slotTotal } from '../src/balance';
import { rollName } from '../src/names';
import { resolveBattle } from '../src/resolve';
import { createStreams, nextInt, rollElement } from '../src/rng';
import type { Stream } from '../src/rng';
import { ALL_CLASSES, ALL_COLS, ALL_ROWS } from '../src/types';
import type { MatchSetup, Placement, Unit, UnitClass } from '../src/types';
import { validateMatchSetup } from '../src/validate';

/** Fresh ai/A stream for a seed (the usual chooseSetup input). */
function aiStream(seed: number) {
  return createStreams(seed)['ai/A'];
}

describe('STRATEGY_POOL curation (FR25)', () => {
  /**
   * FR25 asks for "~8–12 archetypes". Story 5.5 crosses the upper end at 18,
   * and the reason is arithmetic, not drift: the 4.12 reverse-coverage guard
   * (below) requires EVERY class to appear in some archetype, and a monster
   * costs 2 of the 5 slots — so a monster comp carries only 3–4 units, and the
   * ten classes of the 5.5 wave need six comps to hold them without turning
   * any existing comp into a coverage vehicle instead of a tuned identity.
   * FR25's INTENT (enough board variety that the AI never repeats itself) is
   * exceeded, not weakened; what a tighter ceiling would buy is a smaller
   * sweep, and the sweep still runs inside its budget (18² × 15 = 4860
   * battles per mode in CI). RATIFIED by the PO 2026-07-29 ("we have 18 —
   * that's the reality; FR25 is the past") and FR25 amended in epics.md with
   * a dated note. The count stays pinned EXACTLY: growth is a deliberate
   * edit here, gated by the ≤65% sweep band, never a silent drift.
   */
  it('holds exactly the 18 curated archetypes, unique ids (FR25 pool-size clause amended 2026-07-29 — growth is a deliberate edit HERE)', () => {
    expect(STRATEGY_POOL.length).toBe(18);
    const ids = STRATEGY_POOL.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every archetype is a legal board: slot-budget composition, distinct in-grid cells (AD-1)', () => {
    for (const a of STRATEGY_POOL) {
      // Legality is SLOTS (story 4.2): the composition fills the budget exactly
      // — story 4.8: a monster comp's army is SHORTER than 5 units (2 slots
      // each), so this is the only length invariant that still holds.
      expect(slotTotal(a.classes.map((cls) => ({ class: cls }))), a.id).toBe(BALANCE.slotBudget);
      expect(a.placement, a.id).toHaveLength(a.classes.length);
      for (const cls of a.classes) expect(ALL_CLASSES, `${a.id}: ${cls}`).toContain(cls);
      for (const p of a.placement) {
        expect(ALL_ROWS, `${a.id}: ${p.row}`).toContain(p.row);
        expect(ALL_COLS, `${a.id}: ${p.col}`).toContain(p.col);
      }
    }
  });

  it('every archetype survives validateMatchSetup mirrored against itself — footprint-legal, incl. monster anchors/columns (AD-14, story 4.8)', () => {
    // A loose anchor-uniqueness check (as the test above ran pre-4.8) misses a
    // monster's SECOND cell entirely — dogfood the real validator instead, so
    // "legal" here means what the engine actually enforces, not a hand-rolled
    // approximation of it.
    for (const a of STRATEGY_POOL) {
      const streams = createStreams(1);
      const army: Unit[] = a.classes.map((cls) => ({ class: cls, element: rollElement(streams['elements/A']), name: rollName(streams['names/A'], cls, []) }));
      // Only a HUMAN can be crowned (E5-D13, story 5.5 — race, not sizeClass:
      // the Whelp is a small that must be refused). Every archetype fields at
      // least one human (pinned by its own test below), so this is always found.
      const smallLeader = a.classes.findIndex((cls) => BALANCE.classes[cls].race === 'human');
      const setup: MatchSetup = {
        seed: 1,
        balanceVersion: BALANCE.version,
        mode: 'single',
        tactics: { A: 'autonomous', B: 'autonomous' },
        leaders: { A: smallLeader, B: smallLeader },
        armies: { A: army, B: army.map((u) => ({ ...u })) },
        placements: { A: [...a.placement], B: [...a.placement] },
      };
      expect(() => validateMatchSetup(setup), a.id).not.toThrow();
    }
  });

  it('EVERY class appears in at least one archetype — the Open-Item-5 reverse-coverage guard (story 4.12)', () => {
    // ai.test.ts:33 checks each pool class is a VALID class; this is the
    // REVERSE — every class in ALL_CLASSES must be exercised by the sweep, so
    // the NFR4 band certifies all of them (the 4.3 smalls and 5.4 humans
    // folded in via single-unit swaps, the golem via the two 4.8 monster
    // comps, the 5.5 wave via its own six). Without this, silently dropping a
    // class from every archetype would leave it uncertified and NOTHING would
    // fail the build (story 4.12 AC1). Deliberately NOT pinned to a count:
    // the roster grows, the invariant doesn't.
    const covered = new Set<UnitClass>(STRATEGY_POOL.flatMap((a) => a.classes));
    const missing = ALL_CLASSES.filter((cls) => !covered.has(cls));
    expect(missing, `classes absent from every STRATEGY_POOL archetype: ${missing.join(', ')}`).toEqual([]);
  });

  it('every archetype carries at least one HUMAN — without it `chooseSetup` has no legal leader to draw (E5-D13, story 5.5)', () => {
    // The AI's leader draw is over the eligible HUMAN indices; an all-creature
    // archetype would make that list empty (an `undefined` index cast to
    // number) AND could never pass `validateMatchSetup` anyway. This is the
    // guard that makes the cast in `chooseSetup` honest.
    for (const a of STRATEGY_POOL) {
      const humans = a.classes.filter((cls) => BALANCE.classes[cls].race === 'human');
      expect(humans.length, `${a.id} fields no human — it can never be crowned or validated`).toBeGreaterThanOrEqual(1);
    }
  });

  it('the AI draws its leader from the HUMAN indices only, across many stream states (E5-D13, story 5.5)', () => {
    // The regression this pins: 4.8's draw filtered on sizeClass, which would
    // hand the crown to a Whelp (small, dragonkind) in `skyclaw`.
    for (let seed = 1; seed <= 60; seed++) {
      const choice = chooseSetup(STRATEGY_POOL, aiStream(seed));
      const leaderClass = choice.classes[choice.leader] as UnitClass;
      expect(BALANCE.classes[leaderClass].race, `seed ${seed} crowned a ${leaderClass}`).toBe('human');
    }
  });

  it('includes a back-row-sniper archetype: ≥2 archers, none in the front row (FR25)', () => {
    const sniper = STRATEGY_POOL.some((a) => {
      const archerRows = a.classes.flatMap((cls, i) => (cls === 'archer' ? [(a.placement[i] as Placement).row] : []));
      return archerRows.length >= 2 && archerRows.every((row) => row !== 'front');
    });
    expect(sniper).toBe(true);
  });

  it('includes an anti-front-stack archetype: ≥2 mages (row blasts punish stacked rows — FR25)', () => {
    expect(STRATEGY_POOL.some((a) => a.classes.filter((c) => c === 'mage').length >= 2)).toBe(true);
  });
});

describe('chooseSetup guards (review-caught defensive gaps)', () => {
  it('throws a clear, attributable error on an empty pool rather than a cryptic rng.ts RangeError', () => {
    expect(() => chooseSetup([], aiStream(1))).toThrow(/chooseSetup: pool must be non-empty/);
  });

  it('throws a clear error if an archetype placement has a col outside ALL_COLS', () => {
    const bad = { ...(STRATEGY_POOL[0] as (typeof STRATEGY_POOL)[number]) };
    const badArchetype = {
      ...bad,
      placement: [{ row: 'front', col: 'nowhere' }, ...bad.placement.slice(1)],
    } as unknown as (typeof STRATEGY_POOL)[number];
    expect(() => chooseSetup([badArchetype], aiStream(1))).toThrow(/invalid col/);
  });

  it('throws a clear error for a human-less archetype instead of an opaque nextInt RangeError (E5-D13, story 5.5 review)', () => {
    // `pool` is a PARAMETER: sim probes and tests pass custom pools that the
    // STRATEGY_POOL ≥1-human guard never sees. Without this, the leader draw
    // hits `nextInt(stream, 0, -1)` — an empty-range error with no archetype
    // name in it.
    const noHuman = {
      id: 'all-creatures',
      name: 'All Creatures',
      classes: ['golem', 'emberdrake', 'whelp'],
      placement: [
        { row: 'front', col: 'left' },
        { row: 'back', col: 'right' },
        { row: 'front', col: 'right' },
      ],
    } as unknown as (typeof STRATEGY_POOL)[number];
    expect(() => chooseSetup([noHuman], aiStream(1))).toThrow(/all-creatures.*no human|no human.*all-creatures/);
  });
});

describe('chooseSetup (FR24/FR25, AD-6, AD-10)', () => {
  it('is deterministic: the same seed and stream label give the identical choice', () => {
    const first = chooseSetup(STRATEGY_POOL, aiStream(0xc0ffee));
    const second = chooseSetup(STRATEGY_POOL, aiStream(0xc0ffee));
    expect(second).toEqual(first);
  });

  it('draws EXACTLY four ints — archetype pick, mirror flip, tactic, leader — and nothing else (stream-ordering invariant)', () => {
    const consumed = aiStream(42);
    chooseSetup(STRATEGY_POOL, consumed);
    const manual = aiStream(42);
    nextInt(manual, 0, STRATEGY_POOL.length - 1); // ① archetype pick
    nextInt(manual, 0, 1); // ② mirror flip
    nextInt(manual, 0, 3); // ③ tactic pick over the 4 tactics (story 4.5 unlocked `leader`)
    nextInt(manual, 0, 4); // ④ leader index over the 5-unit army (story 4.5)
    // Both streams must now sit at the same position: the next draw agrees.
    expect(nextInt(consumed, 0, 0xffff)).toBe(nextInt(manual, 0, 0xffff));
  });

  it('commits a tactic from its own stream: any of the four tactics — `leader` unlocked in story 4.5 (FR24)', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const { tactic } = chooseSetup(STRATEGY_POOL, aiStream(seed));
      expect(['autonomous', 'weakest', 'strongest', 'leader']).toContain(tactic);
      seen.add(tactic);
    }
    expect(seen).toEqual(new Set(['autonomous', 'weakest', 'strongest', 'leader'])); // all four appear (coverage)
  });

  it('commits a leader index from its own stream: always a valid army index, deterministic, with seeded variation — never always 0 (FR24/FR35, story 4.5)', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const choice = chooseSetup(STRATEGY_POOL, aiStream(seed));
      expect(Number.isInteger(choice.leader)).toBe(true);
      expect(choice.leader).toBeGreaterThanOrEqual(0);
      expect(choice.leader).toBeLessThan(choice.classes.length); // in range for the 5-unit army
      seen.add(choice.leader);
    }
    expect(seen.size).toBeGreaterThan(1); // seeded variation, not pinned to unit 0
    expect(chooseSetup(STRATEGY_POOL, aiStream(123)).leader).toBe(chooseSetup(STRATEGY_POOL, aiStream(123)).leader); // deterministic
  });

  test.prop([fc.integer({ min: 0, max: 0xffffffff })])('never picks the excluded archetype (no repeat — FR25)', (seed) => {
    const excluded = (STRATEGY_POOL[0] as (typeof STRATEGY_POOL)[number]).id;
    const choice = chooseSetup(STRATEGY_POOL, aiStream(seed), { exclude: excluded });
    expect(choice.archetypeId).not.toBe(excluded);
  });

  it('an exclude id not in the pool leaves the whole pool eligible', () => {
    const choice = chooseSetup(STRATEGY_POOL, aiStream(7), { exclude: 'no-such-archetype' });
    expect(STRATEGY_POOL.map((a) => a.id)).toContain(choice.archetypeId);
  });

  it('a singleton pool whose only archetype is excluded falls back to the whole pool (never throws)', () => {
    const solo = [STRATEGY_POOL[0] as (typeof STRATEGY_POOL)[number]];
    const choice = chooseSetup(solo, aiStream(7), { exclude: solo[0]!.id });
    expect(choice.archetypeId).toBe(solo[0]!.id);
  });

  it('does not mutate or alias the pool: returned placement is a fresh copy', () => {
    const solo = [STRATEGY_POOL[0] as (typeof STRATEGY_POOL)[number]];
    const before = JSON.stringify(solo);
    const choice = chooseSetup(solo, aiStream(11));
    expect(JSON.stringify(solo)).toBe(before);
    expect(choice.placement[0]).not.toBe(solo[0]!.placement[0]);
  });

  test.prop([fc.integer({ min: 0, max: 0xffffffff })])(
    'its output + caller-rolled elements and names always assemble into a VALID MatchSetup (AD-9 flow)',
    (seed) => {
      const streams = createStreams(seed);
      const a = chooseSetup(STRATEGY_POOL, streams['ai/A']);
      const b = chooseSetup(STRATEGY_POOL, streams['ai/B']);
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
        leaders: { A: a.leader, B: b.leader },
        armies: {
          A: buildArmy(a.classes, streams['elements/A'], streams['names/A']),
          B: buildArmy(b.classes, streams['elements/B'], streams['names/B']),
        },
        placements: { A: a.placement, B: b.placement },
      };
      expect(() => validateMatchSetup(setup)).not.toThrow();
      // ...and RESOLVES: termination holds over the AI assembly path, and the
      // log ends with a verdict (AD-12) — the sim/MatchFlow consumption contract.
      const log = resolveBattle(setup);
      expect(log.events.at(-1)?.type).toBe('BattleEnded');
    },
  );

  // DETERMINISM ANCHORS (rng-lessons convention): expectations hand-derived
  // from the PROBED raw draws, mapped onto the pool literal by hand — NOT
  // pasted from a test run. A silent change to stream derivation, pool order,
  // or draw order trips these loudly.
  //
  // Story 4.8 re-tune: `nextInt`'s draw for a given stream state depends on
  // the RANGE passed in (`eligible.length - 1`), so growing the pool from 10
  // to 12 (the two new monster archetypes, golem-wall/twin-golems, appended
  // at the END) shifts which INDEX these two seeds land on — even though the
  // archetype pick and the mirror-flip are two SEPARATE draws, and the flip
  // draw's own range (`0, 1`) never changed. Re-probed 2026-07-19: seed 1 →
  // three-mages (flip 0); seed 2 → gale (flip 1, same flip value as before).
  it('anchor: seed 1 on ai/A picks three-mages, unmirrored (flip 0)', () => {
    const choice = chooseSetup(STRATEGY_POOL, aiStream(1));
    expect(choice.archetypeId).toBe('three-mages');
    expect(choice.classes).toEqual(['mage', 'mage', 'mage', 'knight', 'knight']);
    // Literal placement verbatim (flip 0 — no mirroring; the 5.4 re-screened
    // battery: mages back, knight screens front/mid).
    expect(choice.placement).toEqual([
      { row: 'back', col: 'left' },
      { row: 'back', col: 'center' },
      { row: 'back', col: 'right' },
      { row: 'front', col: 'center' },
      { row: 'mid', col: 'center' },
    ]);
  });

  it('anchor: seed 2 on ai/A picks talons MIRRORED left↔right (flip 1)', () => {
    // Story 5.5 re-probe (2026-07-28): the pool grew 12 → 18 (six monster
    // archetypes appended at the END), so the index draw's RANGE changed from
    // [0,11] to [0,17] and seed 2 lands on a different index — the same
    // range-dependence 4.8 documented. Raw draws probed directly off
    // `aiStream(2)`: index draw over [0,17] = 3 → talons; flip draw over
    // [0,1] = 1 (the flip's own range never changed, and its value didn't
    // either). Seed 1's anchor is untouched: index 2 → three-mages, flip 0.
    const choice = chooseSetup(STRATEGY_POOL, aiStream(2));
    expect(choice.archetypeId).toBe('talons');
    expect(choice.classes).toEqual(['archer', 'archer', 'archer', 'valkyrie', 'hawkman']);
    // Literal [back/left, mid/right, back/right, mid/left, front/center]
    // hand-mirrored: rows untouched, left→right, right→left, center stays.
    expect(choice.placement).toEqual([
      { row: 'back', col: 'right' },
      { row: 'mid', col: 'left' },
      { row: 'back', col: 'left' },
      { row: 'mid', col: 'right' },
      { row: 'front', col: 'center' },
    ]);
  });

  it('ai/A and ai/B pick independently from the same match seed (no mirror-match artifact — AD-10)', () => {
    let differing = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const streams = createStreams(seed);
      const a = chooseSetup(STRATEGY_POOL, streams['ai/A']);
      const b = chooseSetup(STRATEGY_POOL, streams['ai/B']);
      if (a.archetypeId !== b.archetypeId) differing += 1;
    }
    // Independent uniform picks over ~10 archetypes agree ~10% of the time;
    // identical streams would agree 100%. Any sane pool size keeps these far apart.
    expect(differing).toBeGreaterThan(50);
  });
});
