import { describe, expect, it } from 'vitest';
import { ALL_CLASSES, ALL_COLS, ALL_ELEMENTS, ALL_ROWS, ALL_SIDES } from '../src/types';
import type { Element, MatchSetup, Placement, Side, Unit, UnitClass, UnitId } from '../src/types';

describe('domain types (AD-4, AD-9, AD-11)', () => {
  it('admits the canonical MatchSetup shape fixed by AD-9', () => {
    const armyA: Unit[] = [
      { class: 'knight', element: 'fire' },
      { class: 'knight', element: 'water' },
      { class: 'mage', element: 'wind' },
    ];
    const armyB: Unit[] = [
      { class: 'archer', element: 'earth' },
      { class: 'archer', element: 'fire' },
      { class: 'cleric', element: 'water' },
    ];
    const placementsA: Placement[] = [
      { row: 'front', col: 'left' },
      { row: 'front', col: 'center' },
      { row: 'back', col: 'center' },
    ];
    const placementsB: Placement[] = [
      { row: 'mid', col: 'left' },
      { row: 'mid', col: 'right' },
      { row: 'back', col: 'left' },
    ];

    const setup: MatchSetup = {
      seed: 0xdeadbeef,
      balanceVersion: 1,
      mode: 'single',
      armies: { A: armyA, B: armyB },
      placements: { A: placementsA, B: placementsB },
    };

    expect(setup.armies.A).toHaveLength(3);
    expect(setup.placements.B[2]?.row).toBe('back');
  });

  it('unit ids are side:index (AD-11)', () => {
    const id: UnitId = 'A:0';
    const other: UnitId = 'B:2';
    expect(id).toBe('A:0');
    expect(other.startsWith('B')).toBe(true);
  });

  it('exports the runtime enumerations the unions derive from (AD-4)', () => {
    expect(ALL_CLASSES).toEqual(['knight', 'mercenary', 'archer', 'mage', 'cleric', 'witch']);
    expect(ALL_ELEMENTS).toEqual(['fire', 'water', 'wind', 'earth']);
    expect(ALL_SIDES).toEqual(['A', 'B']);
    expect(ALL_ROWS).toEqual(['front', 'mid', 'back']);
    expect(ALL_COLS).toEqual(['left', 'center', 'right']);
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
    // Runtime no-op: the assertions above live in the type system.
    expect([badClass, badElement, badSide, badId]).toBeDefined();
  });
});
