import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import type { BattleEvent, MatchSetup } from '../src/types';

/**
 * FR16 Wind→Confusion integration tests. Misfires are seeded 50/50 draws, so
 * each scenario pins a PROBED seed where the desired branch occurs (seeds
 * RE-PROBED for story 4.2's 5-unit armies — the squad-era stream consumes
 * differently, so every 3-unit-era pin was stale; determinism makes the new
 * pins permanent). Every misfire must be an `ActionMisfired` marker + effect
 * pair.
 */
function setup(armies: MatchSetup['armies'], placements: MatchSetup['placements'], seed: number): MatchSetup {
  return {
    seed,
    balanceVersion: BALANCE.version,
    mode: 'single',
    tactics: { A: 'autonomous', B: 'autonomous' },
    leaders: { A: 0, B: 0 },
    armies,
    placements,
  };
}

/** All (marker, effect) pairs in the log. */
function misfirePairs(log: { events: readonly BattleEvent[] }): Array<[BattleEvent, BattleEvent]> {
  const pairs: Array<[BattleEvent, BattleEvent]> = [];
  log.events.forEach((e, i) => {
    if (e.type === 'ActionMisfired') pairs.push([e, log.events[i + 1] as BattleEvent]);
  });
  return pairs;
}

// A-side fixture (5 units, story 4.2): the wind witch at back/center reaches
// ALL enemy columns (FR7 mirrored reach) and casts on the REARMOST occupied
// enemy row, preferring unaffected units (FR12) — so she keeps landing
// confusion on B's back-row actors. The fillers stay in the FRONT row on
// purpose: melee only reaches B's nearest occupied row, keeping B's back-row
// confusion patients alive. Names are FR37 flavor, zero gameplay effect.
const witchA = { class: 'witch', element: 'wind', name: 'Sylwen' } as const;
const fillersA = [
  { class: 'knight', element: 'fire', name: 'Bramgar' },
  { class: 'cleric', element: 'water', name: 'Nerienne' },
  { class: 'knight', element: 'earth', name: 'Thorvald' },
  { class: 'mercenary', element: 'fire', name: 'Kestrel' },
] as const;
const placementsA = [
  { row: 'back', col: 'center' },
  { row: 'front', col: 'center' },
  { row: 'back', col: 'left' },
  { row: 'front', col: 'left' },
  { row: 'front', col: 'right' },
] as const;

describe('FR16 confusion misfires (seeded, probed pins)', () => {
  it('a confused MAGE blasts its own fullest row (itself included); a confused CLERIC heals an enemy', () => {
    // B's back row holds EXACTLY the mage (B:1) and cleric (B:2): rows count
    // front 2 / mid 1 / back 2, and FR10's fullest-row tie breaks REARMOST —
    // so the misfired blast strikes the mage's own back row, itself included.
    const log = resolveBattle(
      setup(
        {
          A: [witchA, ...fillersA],
          B: [
            { class: 'mercenary', element: 'fire', name: 'Dorn' },
            { class: 'mage', element: 'earth', name: 'Vexalia' },
            { class: 'cleric', element: 'water', name: 'Miriel' },
            { class: 'knight', element: 'fire', name: 'Hargen' },
            { class: 'mercenary', element: 'earth', name: 'Rooke' },
          ],
        },
        {
          A: [...placementsA],
          B: [
            { row: 'front', col: 'center' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'left' },
            { row: 'front', col: 'left' },
            { row: 'mid', col: 'center' },
          ],
        },
        3, // probed (re-probed for 4.6's crit/dodge draws): mage self-blast AND cleric enemy-heal both misfire on this seed
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

  it('a confused FRONT-row Wizard misfires as a single-target STAFF on an ally, NOT a self-blast (story 4.7 review — row-consistent)', () => {
    // A front-row mage's normal action is a physical single-target staff (story
    // 4.7), so its misfire must be a single-target staff on a random ally — not
    // the mid/back mage's self-blast. Getting the enemy witch to confuse a FRONT
    // mage needs the rearmost rows cleared first (she snipes rearmost-unafflicted):
    // A's two back archers kill B's two back clerics over the opening engagements,
    // after which the witch's cast reaches B's now-rearmost front row (the mage).
    const log = resolveBattle({
      // Built inline (not the single-mode `setup` helper): the front mage only
      // becomes rearmost — and thus confusable — once B's back clerics die, which
      // takes several WIPEOUT engagements.
      seed: 1, // probed: on this seed the confused front mage B:0 misfires as a staff onto an ally
      balanceVersion: BALANCE.version,
      mode: 'wipeout',
      tactics: { A: 'autonomous', B: 'autonomous' },
      leaders: { A: 0, B: 0 },
      armies: {
        A: [
          witchA,
          { class: 'archer', element: 'fire', name: 'Lyra' },
          { class: 'archer', element: 'water', name: 'Vess' },
          { class: 'knight', element: 'earth', name: 'Thor' },
          { class: 'knight', element: 'fire', name: 'Bram' },
        ],
        B: [
          { class: 'mage', element: 'earth', name: 'Vexalia' }, // B:0 front-center → 'staff' move
          { class: 'knight', element: 'fire', name: 'Hargen' },
          { class: 'knight', element: 'water', name: 'Ulf' },
          { class: 'cleric', element: 'wind', name: 'Miriel' }, // back — the archers snipe it
          { class: 'cleric', element: 'earth', name: 'Sela' }, // back — the archers snipe it
        ],
      },
      placements: {
        A: [
          { row: 'back', col: 'center' },
          { row: 'back', col: 'left' },
          { row: 'back', col: 'right' },
          { row: 'front', col: 'left' },
          { row: 'front', col: 'right' },
        ],
        B: [
          { row: 'front', col: 'center' },
          { row: 'front', col: 'left' },
          { row: 'front', col: 'right' },
          { row: 'back', col: 'center' },
          { row: 'back', col: 'left' },
        ],
      },
    });
    const pairs = misfirePairs(log);
    const staffMisfire = pairs.find(([m, e]) => m.type === 'ActionMisfired' && m.unit === 'B:0' && e.type === 'UnitAttacked' && e.kind === 'staff');
    expect(staffMisfire, 'a confused front mage should produce a single-target staff misfire').toBeDefined();
    if (staffMisfire && staffMisfire[1].type === 'UnitAttacked') {
      const attack = staffMisfire[1];
      expect(attack.source).toBe('B:0');
      expect(attack.targets).toHaveLength(1); // single-target staff, NOT a multi-target self-blast
      const target = attack.targets[0];
      expect(target?.unit.startsWith('B')).toBe(true); // friendly fire
      expect(target?.unit).not.toBe('B:0'); // misfire ally picks exclude self
    }
    // And it never self-blasts: no multi-target UnitAttacked from the front mage.
    const selfBlast = log.events.find((e) => e.type === 'UnitAttacked' && e.source === 'B:0' && e.targets.length > 1);
    expect(selfBlast, 'a front mage never self-blasts — its move is a staff').toBeUndefined();
  });

  it('a confused MELEE unit strikes a random living ALLY (never itself)', () => {
    const log = resolveBattle(
      setup(
        {
          A: [witchA, ...fillersA],
          B: [
            { class: 'mercenary', element: 'fire', name: 'Dorn' },
            { class: 'knight', element: 'earth', name: 'Hargen' },
            { class: 'knight', element: 'water', name: 'Ulfric' },
            { class: 'archer', element: 'fire', name: 'Fenwick' },
            { class: 'mercenary', element: 'earth', name: 'Rooke' },
          ],
        },
        {
          A: [...placementsA],
          B: [
            { row: 'front', col: 'center' },
            { row: 'back', col: 'center' },
            { row: 'mid', col: 'left' },
            { row: 'mid', col: 'right' },
            { row: 'front', col: 'left' },
          ],
        },
        1, // probed (re-probed for 4.2's 5-unit armies): a confused B striker attacks one of its own on this seed
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
    // B:0 is the ONLY back-row B unit, so A's witch confuses her first; she
    // stays water-element — her misfired cast must land 'sleep' on her own side.
    const log = resolveBattle(
      setup(
        {
          A: [witchA, ...fillersA],
          B: [
            { class: 'witch', element: 'water', name: 'Morwenna' },
            { class: 'knight', element: 'earth', name: 'Hargen' },
            { class: 'mercenary', element: 'water', name: 'Skarn' },
            { class: 'mercenary', element: 'fire', name: 'Dorn' },
            { class: 'archer', element: 'earth', name: 'Fenwick' },
          ],
        },
        {
          A: [...placementsA],
          B: [
            { row: 'back', col: 'right' }, // acts AFTER A's witch (same AGI, higher col) → gets confused first
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'right' },
            { row: 'front', col: 'right' },
            { row: 'mid', col: 'center' },
          ],
        },
        20, // probed (re-probed for 4.6's crit/dodge draws): confused B witch sleeps her OWN ally AND a later misfire fizzles
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
