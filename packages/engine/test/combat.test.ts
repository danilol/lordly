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
   * Concentrated fire: all clerics stacked in the enemy's right column so the
   * two knights that reach it (A:0 left→{1,2}, A:1 center→all) pour 4 × 24
   * into the front cleric (90 hp) — it dies on the 4th hit. A full WIPE is
   * arithmetically unreachable with 1.5's melee-only roster (max 6 melee
   * actions × 39 max damage = 234 < 240 min team HP), so the instant-wipe
   * branch is unit-tested directly in judging.test.ts and becomes integration-
   * reachable with 1.6's casters.
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
          { class: 'cleric', element: 'earth' },
          { class: 'cleric', element: 'fire' },
          { class: 'cleric', element: 'water' },
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
    expect(deaths).toEqual([{ type: 'UnitDied', unit: 'B:0' }]); // front cleric, 4 × 24 = 96 > 90
    for (const death of deaths) {
      const i = log.events.indexOf(death);
      const prev = log.events[i - 1];
      expect(prev?.type).toBe('UnitAttacked');
      if (prev?.type === 'UnitAttacked') {
        expect(prev.targets.some((t) => t.unit === death.unit && t.hpAfter === 0)).toBe(true);
      }
    }
    // The dead cleric's hp snapshot is 0; A:2 (front/right, reach {0,1}) found no target and idled.
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
    // Asymmetric: A knight+2 clerics-back vs B mercenary+2 clerics-back, melee only in front.
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
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
          ],
        },
      }),
    );
    // knight deals 2×20=40 to merc (30 − floor(20/2), ×1); merc deals 2×12=24 to knight.
    // A remaining: (140-24)+90+90 = 296/320; B: (110-40)+90+90 = 250/290. 296×290 vs 250×320 → A wins.
    const verdict = ended(log);
    expect(verdict.winner).toBe('A');
    expect(verdict.hpPct.A).toBe(Math.floor((296 * 100) / 320)); // 92
    expect(verdict.hpPct.B).toBe(Math.floor((250 * 100) / 290)); // 86
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
