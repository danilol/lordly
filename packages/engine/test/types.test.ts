import { describe, expect, it } from 'vitest';
import { ALL_CLASSES, ALL_COLS, ALL_ELEMENTS, ALL_ROWS, ALL_SIDES, ALL_TACTICS } from '../src/types';
import type { Element, MatchSetup, Placement, Side, Tactic, Unit, UnitClass, UnitId } from '../src/types';

describe('domain types (AD-4, AD-9, AD-11)', () => {
  it('admits the canonical MatchSetup shape fixed by AD-9 (story 4.2: names, tactics, leaders)', () => {
    const armyA: Unit[] = [
      { class: 'knight', element: 'fire', name: 'Kain' },
      { class: 'knight', element: 'water', name: 'Aldric' },
      { class: 'mage', element: 'wind', name: 'Magnus' },
      { class: 'cleric', element: 'earth', name: 'Sela' },
      { class: 'archer', element: 'fire', name: 'Lyra' },
    ];
    const armyB: Unit[] = [
      { class: 'archer', element: 'earth', name: 'Vess' },
      { class: 'archer', element: 'fire', name: 'Rowena' },
      { class: 'cleric', element: 'water', name: 'Ithil' },
      { class: 'witch', element: 'wind', name: 'Morwen' },
      { class: 'mercenary', element: 'water', name: 'Brand' },
    ];
    const placementsA: Placement[] = [
      { row: 'front', col: 'left' },
      { row: 'front', col: 'center' },
      { row: 'back', col: 'center' },
      { row: 'back', col: 'left' },
      { row: 'mid', col: 'center' },
    ];
    const placementsB: Placement[] = [
      { row: 'mid', col: 'left' },
      { row: 'mid', col: 'right' },
      { row: 'back', col: 'left' },
      { row: 'back', col: 'center' },
      { row: 'front', col: 'center' },
    ];

    const setup: MatchSetup = {
      seed: 0xdeadbeef,
      balanceVersion: 1,
      mode: 'single',
      tactics: { A: 'autonomous', B: 'autonomous' },
      leaders: { A: 0, B: 0 },
      armies: { A: armyA, B: armyB },
      placements: { A: placementsA, B: placementsB },
    };

    expect(setup.armies.A).toHaveLength(5);
    expect(setup.placements.B[2]?.row).toBe('back');
    expect(setup.armies.B[3]?.name).toBe('Morwen');
  });

  it('unit ids are side:index (AD-11)', () => {
    const id: UnitId = 'A:0';
    const other: UnitId = 'B:2';
    expect(id).toBe('A:0');
    expect(other.startsWith('B')).toBe(true);
  });

  it('exports the runtime enumerations the unions derive from (AD-4)', () => {
    expect(ALL_CLASSES).toEqual([
      'knight',
      'mercenary',
      'archer',
      'mage',
      'cleric',
      'witch',
      'berserker',
      'phalanx',
      'ninja',
      'valkyrie',
      'sorceress',
      'golem',
    ]);
    expect(ALL_ELEMENTS).toEqual(['fire', 'water', 'wind', 'earth']);
    expect(ALL_SIDES).toEqual(['A', 'B']);
    expect(ALL_ROWS).toEqual(['front', 'mid', 'back']);
    expect(ALL_COLS).toEqual(['left', 'center', 'right']);
    expect(ALL_TACTICS).toEqual(['autonomous', 'weakest', 'strongest', 'leader']);
  });

  it('the closed unions reject invalid members (compile-time, via @ts-expect-error)', () => {
    // @ts-expect-error — 'paladin' is not a UnitClass
    const badClass: UnitClass = 'paladin';
    // @ts-expect-error — 'void' is not an Element
    const badElement: Element = 'void';
    // @ts-expect-error — 'C' is not a Side
    const badSide: Side = 'C';
    // @ts-expect-error — UnitId requires the side:index shape
    const badId: UnitId = 'first-knight';
    // @ts-expect-error — 'berserk' is not a Tactic (story 4.2 closed set)
    const badTactic: Tactic = 'berserk';
    // Runtime no-op: the assertions above live in the type system.
    expect([badClass, badElement, badSide, badId, badTactic]).toBeDefined();
  });
});
