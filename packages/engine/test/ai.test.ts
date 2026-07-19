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
  it('holds 8–12 archetypes with unique ids', () => {
    expect(STRATEGY_POOL.length).toBeGreaterThanOrEqual(8);
    expect(STRATEGY_POOL.length).toBeLessThanOrEqual(12);
    const ids = STRATEGY_POOL.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every archetype is a legal board: slot-budget composition, distinct in-grid cells (AD-1)', () => {
    for (const a of STRATEGY_POOL) {
      // Legality is SLOTS (story 4.2): the composition fills the budget exactly.
      expect(slotTotal(a.classes.map((cls) => ({ class: cls }))), a.id).toBe(BALANCE.slotBudget);
      expect(a.placement, a.id).toHaveLength(a.classes.length);
      for (const cls of a.classes) expect(ALL_CLASSES, `${a.id}: ${cls}`).toContain(cls);
      const cells = new Set<string>();
      for (const p of a.placement) {
        expect(ALL_ROWS, `${a.id}: ${p.row}`).toContain(p.row);
        expect(ALL_COLS, `${a.id}: ${p.col}`).toContain(p.col);
        cells.add(`${p.row}/${p.col}`);
      }
      expect(cells.size, `${a.id} overlapping cells`).toBe(a.classes.length);
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
        leaders: { A: 0, B: 0 },
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
  // from the PROBED raw draws (seed 1 ai/A → pick 6, flip 0; seed 2 ai/A →
  // pick 1, flip 1; probed 2026-07-13) mapped onto the pool literal by hand
  // — NOT pasted from a test run. A silent change to stream derivation, pool
  // order, or draw order trips these loudly.
  it('anchor: seed 1 on ai/A picks farshot (index 6) with placements VERBATIM (flip 0)', () => {
    // The raw draws (seed 1 ai/A → pick 6, flip 0) are unchanged by 4.2/4.7 —
    // only the pool literals changed; expectations re-mapped by hand onto the
    // re-authored 5-slot farshot. Story 4.7 re-tune: the first archer moved
    // mid-left → front-left (a pool re-tune after Guard/Wizard-front-staff
    // shifted the wipeout band — see ai.ts's farshot comment).
    const choice = chooseSetup(STRATEGY_POOL, aiStream(1));
    expect(choice.archetypeId).toBe('farshot');
    expect(choice.classes).toEqual(['archer', 'mage', 'cleric', 'archer', 'witch']);
    expect(choice.placement).toEqual([
      { row: 'front', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'back', col: 'center' },
      { row: 'mid', col: 'right' },
      { row: 'back', col: 'left' },
    ]);
  });

  it('anchor: seed 2 on ai/A picks longbows MIRRORED left↔right (flip 1)', () => {
    const choice = chooseSetup(STRATEGY_POOL, aiStream(2));
    expect(choice.archetypeId).toBe('longbows');
    // Literal [back/left, back/right, back/center, front/center, mid/center]
    // hand-mirrored: rows untouched, left→right, right→left, center stays.
    expect(choice.placement).toEqual([
      { row: 'back', col: 'right' },
      { row: 'back', col: 'left' },
      { row: 'back', col: 'center' },
      { row: 'front', col: 'center' },
      { row: 'mid', col: 'center' },
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
