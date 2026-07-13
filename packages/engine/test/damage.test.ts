import { describe, expect, it } from 'vitest';
import { healAmount, magicDamage, physicalDamage } from '../src/resolve';
import type { UnitClass } from '../src/types';

/**
 * Direct table-driven FR14/FR15 arithmetic tests, isolated from initiative
 * and targeting. physicalDamage is class-agnostic pure math, so non-melee
 * attackers exercise branches (like the min-1 clamp) that no melee matchup
 * in balance v1 can reach.
 */
describe('physicalDamage (FR14/FR15, balance v1)', () => {
  const cases: Array<[UnitClass, UnitClass, number, string]> = [
    ['knight', 'knight', 16, '30 − 14, neutral'],
    ['knight', 'archer', 36, '30 − 6 = 24, ×3/2 advantage (knight beats archer)'],
    ['knight', 'mage', 19, '30 − 4 = 26, ×3/4 disadvantage (mage beats knight), floor(19.5)'],
    ['knight', 'mercenary', 20, '30 − 10, neutral'],
    ['knight', 'cleric', 24, '30 − 6, neutral'],
    ['mercenary', 'knight', 12, '26 − 14, neutral'],
    ['mercenary', 'mercenary', 16, '26 − 10, neutral'],
    ['archer', 'mage', 30, '24 − 4 = 20, ×3/2 advantage (archer beats mage)'],
    ['archer', 'knight', 7, '24 − 14 = 10, ×3/4 disadvantage (knight beats archer), floor(7.5)'],
  ];

  for (const [attacker, defender, expected, why] of cases) {
    it(`${attacker} → ${defender} = ${expected} (${why})`, () => {
      expect(physicalDamage(attacker, defender)).toBe(expected);
    });
  }

  it('REAL min-1 clamp on a negative neutral base: cleric → knight = 1 (8 − 14 = −6)', () => {
    expect(physicalDamage('cleric', 'knight')).toBe(1);
  });

  it('clamp after RPS on a negative base: mage → knight = 1 (6 − 14 = −8, ×3/2 advantage → −12, clamp last)', () => {
    expect(physicalDamage('mage', 'knight')).toBe(1);
  });
});

describe('magicDamage (FR10/FR14/FR15, balance v1 — mage INT 30)', () => {
  const cases: Array<[UnitClass, number, string]> = [
    ['knight', 34, '30 − 7 = 23, ×3/2 advantage (mage beats knight), floor(34.5)'],
    ['archer', 18, '30 − 6 = 24, ×3/4 disadvantage (archer beats mage)'],
    ['mage', 19, '30 − 11, neutral'],
    ['cleric', 18, '30 − 12, neutral'],
    ['witch', 20, '30 − 10, neutral'],
    ['mercenary', 23, '30 − 7, neutral'],
  ];
  for (const [defender, expected, why] of cases) {
    it(`mage → ${defender} = ${expected} (${why})`, () => {
      expect(magicDamage('mage', defender)).toBe(expected);
    });
  }
});

describe('Weaken halves damage in the FIXED order: base → RPS → halve → min-1 (FR16)', () => {
  it('weakened mage → knight = 17 (23 → ×3/2 = 34 → floor(34/2))', () => {
    expect(magicDamage('mage', 'knight', true)).toBe(17);
  });

  it('weakened knight → archer = 18 (24 → ×3/2 = 36 → 18)', () => {
    expect(physicalDamage('knight', 'archer', true)).toBe(18);
  });

  it('weakened knight → knight = 8 (16 → halve)', () => {
    expect(physicalDamage('knight', 'knight', true)).toBe(8);
  });

  it('weaken cannot push below the min-1 clamp (weakened cleric staff → knight = 1)', () => {
    expect(physicalDamage('cleric', 'knight', true)).toBe(1);
  });
});

describe('healAmount (FR11)', () => {
  it('cleric heal = 30 (floor(24 × 5/4))', () => {
    expect(healAmount('cleric')).toBe(30);
  });
});
