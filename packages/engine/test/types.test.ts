import { describe, expect, it } from 'vitest';
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

  it('closed unions carry the PRD vocabulary', () => {
    const classes: UnitClass[] = ['knight', 'mercenary', 'archer', 'mage', 'cleric', 'witch'];
    const elements: Element[] = ['fire', 'water', 'wind', 'earth'];
    const sides: Side[] = ['A', 'B'];
    expect(classes).toHaveLength(6);
    expect(elements).toHaveLength(4);
    expect(sides).toHaveLength(2);
  });
});
