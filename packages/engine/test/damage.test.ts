import { describe, expect, it } from 'vitest';
import { blastDamage, healAmount, magicDamage, physicalDamage } from '../src/resolve';
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
    ['archer', 'cleric', 27, '24 − 6 = 18, ×3/2 one-way hunt (FR14 amendment: archer hunts casters)'],
    ['archer', 'witch', 28, '24 − 5 = 19, ×3/2 one-way hunt, floor(28.5)'],
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

describe('the hunt is ONE-WAY (FR14 amendment): hunted casters take no penalty attacking the archer', () => {
  it('cleric staff → archer = 2 (8 − 6, NEUTRAL — a symmetric ×3/4 penalty would floor it to 1)', () => {
    expect(physicalDamage('cleric', 'archer')).toBe(2);
  });

  it('witch → archer magic arithmetic = 20 (26 − 6, NEUTRAL — a leaked penalty would give 15)', () => {
    // The Witch never deals damage in play (FR12); this pins the PIPELINE
    // rule so no future refactor can re-derive disadvantage from the hunts.
    expect(magicDamage('witch', 'archer')).toBe(20);
  });

  it('mage → archer stays the TRIANGLE ×3/4 disadvantage = 18 (the triangle is unchanged)', () => {
    expect(magicDamage('mage', 'archer')).toBe(18);
  });
});

describe('magicDamage — the UNATTENUATED magic arithmetic (FR14/FR15; FR10 blasts use blastDamage)', () => {
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

describe('blastDamage (FR10 amendment, MODE-SCOPED): ×3/4 attenuation in wipeout only, AFTER base, BEFORE RPS', () => {
  const wipeoutCases: Array<[UnitClass, number, string]> = [
    ['knight', 25, '30 − 7 = 23 → att floor(17.25) = 17 → ×3/2 advantage floor(25.5)'],
    ['archer', 13, '30 − 6 = 24 → att 18 → ×3/4 disadvantage floor(13.5)'],
    ['mage', 14, '30 − 11 = 19 → att floor(14.25), neutral'],
    ['cleric', 13, '30 − 12 = 18 → att floor(13.5), neutral'],
    ['witch', 15, '30 − 10 = 20 → att 15, neutral'],
    ['mercenary', 17, '30 − 7 = 23 → att floor(17.25), neutral'],
  ];
  for (const [defender, expected, why] of wipeoutCases) {
    it(`WIPEOUT mage blast → ${defender} = ${expected} (${why})`, () => {
      expect(blastDamage('mage', defender, false, 'wipeout')).toBe(expected);
    });
  }

  it('SINGLE-mode blast is unattenuated — identical to magicDamage for every matchup (sweep-verified tuning: the triangle polices single-mode blasts)', () => {
    for (const attacker of ['mage', 'knight', 'witch', 'cleric'] as const) {
      for (const defender of ['knight', 'archer', 'mage', 'cleric', 'witch', 'mercenary'] as const) {
        expect(blastDamage(attacker, defender, false, 'single'), `${attacker}→${defender}`).toBe(magicDamage(attacker, defender));
      }
    }
  });

  it('ORDER DISCRIMINATOR — attenuation before RPS, not after: wipeout knight-INT blast → archer = 1 (2 → att 1 → adv 1; the after-RPS order would give 2 → adv 3 → att 2)', () => {
    // blastDamage is class-agnostic pure math like physicalDamage, so a
    // knight-INT blast legally exercises the small-base branch no real mage
    // matchup reaches at this tuning (where both orders happen to collide).
    expect(blastDamage('knight', 'archer', false, 'wipeout')).toBe(1);
  });

  it('weakened wipeout blast keeps the full fixed order: base 23 → att 17 → RPS 25 → halve = 12 (weakened mage → knight)', () => {
    expect(blastDamage('mage', 'knight', true, 'wipeout')).toBe(12);
  });

  it('min-1 clamp stays LAST: negative base survives attenuation to clamp (wipeout knight-INT blast → cleric: −4 → att −3 → clamp 1)', () => {
    expect(blastDamage('knight', 'cleric', false, 'wipeout')).toBe(1);
  });
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
