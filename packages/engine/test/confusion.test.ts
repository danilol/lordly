import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import type { BattleEvent, MatchSetup } from '../src/types';

/**
 * FR16 Wind→Confusion integration tests. Misfires are seeded 50/50 draws, so
 * each scenario pins a PROBED seed where the desired branch occurs (seeds
 * scanned at implementation time; determinism makes the pin permanent).
 * Every misfire must be an `ActionMisfired` marker + effect pair.
 */
function setup(armies: MatchSetup['armies'], placements: MatchSetup['placements'], seed: number): MatchSetup {
  return { seed, balanceVersion: BALANCE.version, mode: 'single', armies, placements };
}

/** All (marker, effect) pairs in the log. */
function misfirePairs(log: { events: readonly BattleEvent[] }): Array<[BattleEvent, BattleEvent]> {
  const pairs: Array<[BattleEvent, BattleEvent]> = [];
  log.events.forEach((e, i) => {
    if (e.type === 'ActionMisfired') pairs.push([e, log.events[i + 1] as BattleEvent]);
  });
  return pairs;
}

const witchA = { class: 'witch', element: 'wind' } as const;
const fillersA = [
  { class: 'knight', element: 'fire' },
  { class: 'cleric', element: 'water' },
] as const;
const placementsA = [
  { row: 'back', col: 'center' },
  { row: 'front', col: 'center' },
  { row: 'back', col: 'left' },
] as const;

describe('FR16 confusion misfires (seeded, probed pins)', () => {
  it('a confused MAGE blasts its own fullest row (itself included); a confused CLERIC heals an enemy', () => {
    const log = resolveBattle(
      setup(
        {
          A: [witchA, ...fillersA],
          B: [
            { class: 'mercenary', element: 'fire' },
            { class: 'mage', element: 'earth' },
            { class: 'cleric', element: 'water' },
          ],
        },
        {
          A: [...placementsA],
          B: [
            { row: 'front', col: 'center' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'left' },
          ],
        },
        1, // probed: mage self-blast AND cleric enemy-heal both misfire on this seed
      ),
    );
    const pairs = misfirePairs(log);
    // Confused B mage blasts its OWN back row — hitting itself and its cleric.
    const selfBlast = pairs.find(([m, e]) => m.type === 'ActionMisfired' && m.unit === 'B:1' && e.type === 'UnitAttacked');
    expect(selfBlast).toBeDefined();
    if (selfBlast && selfBlast[1].type === 'UnitAttacked') {
      expect(selfBlast[1].source).toBe('B:1');
      expect(selfBlast[1].targets.map((t) => t.unit).sort()).toEqual(['B:1', 'B:2']); // friendly fire, self included
    }
    // Confused B cleric heals an ENEMY (A-side unit).
    const enemyHeal = pairs.find(([m, e]) => m.type === 'ActionMisfired' && m.unit === 'B:2' && e.type === 'UnitHealed');
    expect(enemyHeal).toBeDefined();
    if (enemyHeal && enemyHeal[1].type === 'UnitHealed') {
      expect(enemyHeal[1].target.startsWith('A')).toBe(true);
    }
  });

  it('a confused MELEE unit strikes a random living ALLY (never itself)', () => {
    const log = resolveBattle(
      setup(
        {
          A: [witchA, ...fillersA],
          B: [
            { class: 'mercenary', element: 'fire' },
            { class: 'knight', element: 'earth' },
            { class: 'knight', element: 'water' },
          ],
        },
        {
          A: [...placementsA],
          B: [
            { row: 'front', col: 'center' },
            { row: 'back', col: 'center' },
            { row: 'mid', col: 'left' },
          ],
        },
        1, // probed: confused B:1 knight attacks its own B:2
      ),
    );
    const pairs = misfirePairs(log);
    const allyHit = pairs.find(([m, e]) => e.type === 'UnitAttacked' && m.type === 'ActionMisfired' && e.source === m.unit);
    expect(allyHit).toBeDefined();
    if (allyHit && allyHit[1].type === 'UnitAttacked') {
      const [marker, attack] = allyHit as [Extract<BattleEvent, { type: 'ActionMisfired' }>, Extract<BattleEvent, { type: 'UnitAttacked' }>];
      // Friendly fire: same side, never self.
      for (const t of attack.targets) {
        expect(t.unit.startsWith(marker.unit[0] as string)).toBe(true);
        expect(t.unit).not.toBe(marker.unit);
      }
    }
  });

  it('a confused WITCH applies her spell to a random living ally; repeat applications fizzle (no stack)', () => {
    const log = resolveBattle(
      setup(
        {
          A: [witchA, ...fillersA],
          B: [
            { class: 'witch', element: 'water' },
            { class: 'knight', element: 'earth' },
            { class: 'mercenary', element: 'water' },
          ],
        },
        {
          A: [...placementsA],
          B: [
            { row: 'back', col: 'right' }, // acts AFTER A's witch (same AGI, higher col) → gets confused first
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'right' },
          ],
        },
        1, // probed: confused B witch sleeps her OWN ally AND a later misfire fizzles
      ),
    );
    const pairs = misfirePairs(log);
    const allySpell = pairs.find(([m, e]) => m.type === 'ActionMisfired' && m.unit === 'B:0' && e.type === 'StatusApplied');
    expect(allySpell).toBeDefined();
    if (allySpell && allySpell[1].type === 'StatusApplied') {
      expect(allySpell[1].spell).toBe('sleep');
      expect(allySpell[1].target.startsWith('B')).toBe(true); // her own side
    }
    const fizzled = pairs.find(([m, e]) => m.type === 'ActionMisfired' && e.type === 'ActionFizzled');
    expect(fizzled).toBeDefined();
  });
});
