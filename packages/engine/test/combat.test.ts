import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import type { BattleEnded, MatchSetup, UnitAttacked, UnitDied } from '../src/types';
import { matchSetupArb } from './arbitraries';

function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, seed = 7): MatchSetup {
  return { seed, balanceVersion: BALANCE.version, mode: 'single', ...partial };
}

function attacks(log: ReturnType<typeof resolveBattle>): UnitAttacked[] {
  return log.events.filter((e): e is UnitAttacked => e.type === 'UnitAttacked');
}

function ended(log: ReturnType<typeof resolveBattle>): BattleEnded {
  const e = log.events[log.events.length - 1];
  if (e?.type !== 'BattleEnded') throw new Error('log must end with BattleEnded');
  return e;
}

describe('FR14/FR15 damage (integer math, fixed order, pinned to balance v1)', () => {
  it('knight → knight deals 16 (30 − 14, RPS neutral)', () => {
    // Lone knight duel: A front/left (own col 0) reaches enemy {1,2};
    // B knight at enemy-owner-local front/right (col 2) = A's facing column.
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'knight', element: 'fire' },
            { class: 'cleric', element: 'water' },
            { class: 'cleric', element: 'wind' },
          ],
          B: [
            { class: 'knight', element: 'earth' },
            { class: 'cleric', element: 'fire' },
            { class: 'cleric', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'right' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
          ],
        },
      }),
    );
    const knightHits = attacks(log).filter((a) => a.source === 'A:0');
    expect(knightHits.length).toBeGreaterThan(0);
    expect(knightHits[0]?.targets).toEqual([{ unit: 'B:0', damage: 16, hpAfter: 124 }]);
  });

  it('knight → archer deals 36 (24 × 3/2 advantage); mercenary is always ×1', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'knight', element: 'fire' },
            { class: 'mercenary', element: 'water' },
            { class: 'cleric', element: 'wind' },
          ],
          B: [
            { class: 'archer', element: 'earth' },
            { class: 'knight', element: 'fire' },
            { class: 'cleric', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'left' }, // knight, reaches enemy {1,2}
            { row: 'front', col: 'right' }, // mercenary, reaches enemy {0,1}
            { row: 'back', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'right' }, // archer (col 2) — knight's facing
            { row: 'front', col: 'left' }, // knight (col 0) — mercenary's facing
            { row: 'back', col: 'center' },
          ],
        },
      }),
    );
    const knightFirst = attacks(log).find((a) => a.source === 'A:0');
    expect(knightFirst?.targets[0]).toMatchObject({ unit: 'B:0', damage: 36 }); // 24 × 3/2
    const mercFirst = attacks(log).find((a) => a.source === 'A:1');
    expect(mercFirst?.targets[0]).toMatchObject({ unit: 'B:1', damage: 12 }); // 26 − 14, ×1
  });

  it('disadvantage floors: knight → mage deals 19 (floor(26 × 3/4))', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'knight', element: 'fire' },
            { class: 'cleric', element: 'water' },
            { class: 'cleric', element: 'wind' },
          ],
          B: [
            { class: 'mage', element: 'earth' },
            { class: 'cleric', element: 'fire' },
            { class: 'cleric', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'right' }, // mage in the knight's facing column
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
          ],
        },
      }),
    );
    const hit = attacks(log).find((a) => a.source === 'A:0');
    expect(hit?.targets[0]).toMatchObject({ unit: 'B:0', damage: 19 });
  });
});

describe('FR18 deaths, wipe, and judging', () => {
  /**
   * Concentrated fire (migrated in 1.6: cleric victims now heal themselves
   * out of danger, so archers — who shoot back but cannot heal — take their
   * place): all archers stacked in the enemy's right column. The two knights
   * that reach it (A:0 left→{1,2}, A:1 center→all) pour 36s into the front
   * archer (90 hp): pass 1 → 54 → 18; A:0's pass-2 hit is a 36-damage
   * overkill on 18 hp.
   */
  const concentrated = () =>
    setup({
      armies: {
        A: [
          { class: 'knight', element: 'fire' },
          { class: 'knight', element: 'water' },
          { class: 'knight', element: 'wind' },
        ],
        B: [
          { class: 'archer', element: 'earth' },
          { class: 'archer', element: 'fire' },
          { class: 'archer', element: 'water' },
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
        ],
        B: [
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'right' },
          { row: 'back', col: 'right' },
        ],
      },
    });

  it('deaths emit UnitDied right after the killing hit with hpAfter 0', () => {
    const log = resolveBattle(concentrated());
    const deaths = log.events.filter((e): e is UnitDied => e.type === 'UnitDied');
    expect(deaths).toEqual([{ type: 'UnitDied', unit: 'B:0' }]); // front archer: 36+36, then the overkill
    for (const death of deaths) {
      const i = log.events.indexOf(death);
      const prev = log.events[i - 1];
      expect(prev?.type).toBe('UnitAttacked');
      if (prev?.type === 'UnitAttacked') {
        // OVERKILL SEMANTICS: the killing blow lands on 18 remaining hp but
        // reports the full computed damage (36); hpAfter (0) is authoritative.
        expect(prev.targets).toEqual([{ unit: 'B:0', damage: 36, hpAfter: 0 }]);
      }
    }
    // The dead archer's hp snapshot is 0; A:2 (front/right, reach {0,1}) found no target and idled.
    const engEnd = log.events.find((e) => e.type === 'EngagementEnded');
    if (engEnd?.type === 'EngagementEnded') expect(engEnd.hp['B:0']).toBe(0);
    expect(ended(log).winner).toBe('A');
  });

  // Note: no melee matchup in balance v1 produces a negative base (lowest melee
  // STR 26 vs highest VIT/2 = 14), so the min-1 clamp is guarded by the
  // property below rather than a specific pinned matchup; casters (1.6) will
  // exercise it concretely.
  test.prop([matchSetupArb])('every attack deals at least minDamage and hpAfter never goes below 0', (s) => {
    const log = resolveBattle(s);
    for (const a of attacks(log)) {
      for (const t of a.targets) {
        expect(t.damage).toBeGreaterThanOrEqual(BALANCE.formulas.minDamage);
        expect(t.hpAfter).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('judging: higher HP-percentage side wins (exact comparison, not floored)', () => {
    // Asymmetric knight-vs-merc trade with active cleric support on both
    // sides (1.6 migration: clerics heal/staff now). Placements chosen with
    // NO cross-side AGI tie on the same cell, so the battle is deterministic
    // without the coin flip.
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'knight', element: 'fire' },
            { class: 'cleric', element: 'water' },
            { class: 'cleric', element: 'wind' },
          ],
          B: [
            { class: 'mercenary', element: 'earth' },
            { class: 'cleric', element: 'fire' },
            { class: 'cleric', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'right' },
            { row: 'mid', col: 'left' },
            { row: 'back', col: 'right' },
          ],
        },
      }),
    );
    // Hand-verified from the event trace: A's clerics fully heal the knight
    // (140) and self-heal the staff scratches → A ends 320/320 = 100%.
    // B's merc takes 3×20 with one +20 heal → 90; B ends 270/290 = 93%.
    const verdict = ended(log);
    expect(verdict.winner).toBe('A');
    expect(verdict.hpPct).toEqual({ A: 100, B: 93 });
  });

  it('exact tie → draw: mirrored triple knights, symmetric damage, nobody dies', () => {
    const mirror = setup({
      armies: {
        A: [
          { class: 'knight', element: 'fire' },
          { class: 'knight', element: 'water' },
          { class: 'knight', element: 'wind' },
        ],
        B: [
          { class: 'knight', element: 'earth' },
          { class: 'knight', element: 'fire' },
          { class: 'knight', element: 'water' },
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
        ],
        B: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
        ],
      },
    });
    const verdict = ended(resolveBattle(mirror));
    expect(verdict.winner).toBe('draw');
    expect(verdict.hpPct.A).toBe(verdict.hpPct.B);
  });
});

describe('FR18 judging symmetry (property)', () => {
  /**
   * Swapping sides mirrors the battle exactly ONLY when no exact cross-side
   * AGI tie exists (same class on the same owner-local cell on both sides):
   * the per-engagement coin flip is not side-symmetric, so such setups are
   * filtered out (documented nuance from the story spec).
   */
  const noMirrorTieArb = matchSetupArb.filter((s) => {
    for (let i = 0; i < s.armies.A.length; i++) {
      for (let j = 0; j < s.armies.B.length; j++) {
        const sameClass = s.armies.A[i]?.class === s.armies.B[j]?.class;
        const pa = s.placements.A[i];
        const pb = s.placements.B[j];
        if (sameClass && pa?.row === pb?.row && pa?.col === pb?.col) return false;
      }
    }
    return true;
  });

  test.prop([noMirrorTieArb])('swapping sides swaps the result', (s) => {
    const swapped: MatchSetup = {
      ...s,
      armies: { A: s.armies.B, B: s.armies.A },
      placements: { A: s.placements.B, B: s.placements.A },
    };
    const v1 = ended(resolveBattle(s));
    const v2 = ended(resolveBattle(swapped));
    const flip = (w: BattleEnded['winner']) => (w === 'A' ? 'B' : w === 'B' ? 'A' : 'draw');
    expect(v2.winner).toBe(flip(v1.winner));
    expect(v2.hpPct).toEqual({ A: v1.hpPct.B, B: v1.hpPct.A });
  });
});
