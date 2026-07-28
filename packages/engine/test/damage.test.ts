import { describe, expect, it } from 'vitest';
import { blastDamage, breathDamage, healAmount, leaderPenaltyBreath, magicDamage, physicalDamage } from '../src/resolve';
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

describe('story 4.7 — the Wizard/Sorceress FRONT-row staff is PHYSICAL (STR-based), not the magic blast', () => {
  // Wizard(mage)/Sorceress STR is 6 — far below any class's floor(VIT/2) — so
  // the staff clamps to minDamage against almost every defender; only the
  // lowest-VIT casters (8) leave a small positive base before RPS.
  it('clamps to minDamage against high/mid-VIT defenders regardless of role relation: mage/sorceress staff → knight = 1 (6 − 14 = −8, ×3/2 advantage still clamps)', () => {
    expect(physicalDamage('mage', 'knight')).toBe(1);
    expect(physicalDamage('sorceress', 'knight')).toBe(1);
  });

  it('a real positive base survives against the lowest-VIT casters: mage staff → mage/sorceress = 2 (6 − floor(8/2) = 2, neutral — no artillery-vs-artillery relation)', () => {
    expect(physicalDamage('mage', 'mage')).toBe(2);
    expect(physicalDamage('mage', 'sorceress')).toBe(2);
    expect(physicalDamage('sorceress', 'mage')).toBe(2);
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

/**
 * `breathDamage` (story 5.5, dossier E5-D7) — the dragons' row-AoE. It is the
 * blast's structure with the PHYSICAL stat pair: power STR, mitigation VIT.
 * The mode-scoped ×3/4 attenuation carries over unchanged, because what it
 * compensates is ROW COVERAGE compounding across wipeout engagements, and
 * coverage doesn't care which stat produced the number (ROSTER.md's 5.5
 * carry: "the blast rule applies to `breath`").
 *
 * Like every other damage helper here, `breathDamage` is class-agnostic pure
 * math, so non-dragon attackers are legal fixtures that reach branches no
 * shipped dragon matchup can (the min-1 clamp, the small-base order cases).
 */
describe('breathDamage (story 5.5, E5-D7): PHYSICAL row-AoE — STR vs VIT, wipeout-attenuated like the blast', () => {
  const singleCases: Array<[UnitClass, number, string]> = [
    ['knight', 20, '34 − 14, neutral (dragon has no relation to vanguard)'],
    ['archer', 28, '34 − 6, neutral'],
    ['mage', 30, '34 − 4, neutral'],
    ['cleric', 28, '34 − 6, neutral'],
    ['witch', 29, '34 − 5, neutral'],
    ['mercenary', 24, '34 − 10, neutral'],
    ['phalanx', 17, '34 − 17, neutral — the VIT-34 wall is the best answer to breath'],
    ['dragonhunter', 26, '34 − 8, neutral — the hunt is ONE-WAY (E5-P1): the dragon gets no bonus back'],
  ];
  for (const [defender, expected, why] of singleCases) {
    it(`SINGLE emberdrake breath → ${defender} = ${expected} (${why})`, () => {
      expect(breathDamage('emberdrake', defender, false, 'single')).toBe(expected);
    });
  }

  it('SINGLE-mode breath is unattenuated — identical to physicalDamage for every matchup (the attenuation is wipeout-scoped, exactly as for the blast)', () => {
    for (const attacker of ['emberdrake', 'cragmaw', 'halowing', 'knight'] as const) {
      for (const defender of ['knight', 'archer', 'mage', 'cleric', 'witch', 'mercenary', 'phalanx', 'whelp'] as const) {
        expect(breathDamage(attacker, defender, false, 'single'), `${attacker}→${defender}`).toBe(physicalDamage(attacker, defender));
      }
    }
  });

  const wipeoutCases: Array<[UnitClass, number, string]> = [
    ['knight', 15, '34 − 14 = 20 → att 15, neutral'],
    ['archer', 21, '34 − 6 = 28 → att 21, neutral'],
    ['mercenary', 18, '34 − 10 = 24 → att 18, neutral'],
    ['phalanx', 12, '34 − 17 = 17 → att floor(12.75), neutral'],
  ];
  for (const [defender, expected, why] of wipeoutCases) {
    it(`WIPEOUT emberdrake breath → ${defender} = ${expected} (${why})`, () => {
      expect(breathDamage('emberdrake', defender, false, 'wipeout')).toBe(expected);
    });
  }

  it('the DRAGONSLAYER hunt reads through breath too — it keys on class, not on move (E5-P1)', () => {
    // Not a shipped board (no dragonslayer has a breath row), but the hunt is
    // pure class arithmetic inside the shared pipeline, so this pins that the
    // relation is not accidentally special-cased per MoveKind.
    expect(breathDamage('dragonhunter', 'whelp', false, 'single')).toBe(19); // 24 − 11 = 13 → ×3/2 floor(19.5)
    expect(breathDamage('dragonhunter', 'emberdrake', false, 'single')).toBe(16); // 24 − 13 = 11 → ×3/2 floor(16.5)
  });

  it('ORDER DISCRIMINATOR — attenuation BEFORE RPS, not after: wipeout dragonhunter breath → whelp = 13 (13 → att 9 → hunt floor(13.5); the after-RPS order would give 13 → hunt 19 → att 14)', () => {
    expect(breathDamage('dragonhunter', 'whelp', false, 'wipeout')).toBe(13);
    // A second, independent witness at a different base, so the pin isn't one
    // lucky rounding: halowing VIT 28 → base 10 → att 7 → hunt 10 (vs 11).
    expect(breathDamage('dragonhunter', 'halowing', false, 'wipeout')).toBe(10);
  });

  it('weakened wipeout breath keeps the full fixed order: base 20 → att 15 → RPS (none) → halve = 7', () => {
    expect(breathDamage('emberdrake', 'knight', true, 'wipeout')).toBe(7);
    expect(breathDamage('emberdrake', 'knight', true, 'single')).toBe(10); // unattenuated: 20 → halve
  });

  it('min-1 clamp stays LAST: a STR-6 breath into VIT 34 survives attenuation to clamp (mage-STR breath → phalanx = 1 in both modes)', () => {
    expect(breathDamage('mage', 'phalanx', false, 'single')).toBe(1); // 6 − 17 = −11 → clamp
    expect(breathDamage('mage', 'phalanx', false, 'wipeout')).toBe(1); // −11 → att −9 → clamp
  });
});

/**
 * `leaderPenaltyBreath` (story 5.5) — the FR35 sober package composed OUTSIDE
 * the damage pipeline, exactly like `leaderPenaltyPhysical`. The decision this
 * pins (recorded in resolve.ts): breath IS physical, so a fallen leader cuts
 * it — while crit, dodge and Guard stay out, because those three gate on the
 * single-target ROLL that an AoE never makes.
 */
describe('leaderPenaltyBreath (story 5.5, FR35): fixed-order dealt ×3/4 then taken ×5/4, re-clamped LAST', () => {
  const base = 20; // emberdrake breath → knight, single mode, no penalty
  it('no leader has fallen: the raw breath number, untouched', () => {
    expect(leaderPenaltyBreath('A', 'B', { A: false, B: false }, 'single')('emberdrake', 'knight')).toBe(base);
  });

  it('ATTACKER’s leader fell: dealt ×3/4 only — floor(20 × 3/4) = 15', () => {
    expect(leaderPenaltyBreath('A', 'B', { A: true, B: false }, 'single')('emberdrake', 'knight')).toBe(15);
  });

  it('DEFENDER’s leader fell: taken ×5/4 only — floor(20 × 5/4) = 25', () => {
    expect(leaderPenaltyBreath('A', 'B', { A: false, B: true }, 'single')('emberdrake', 'knight')).toBe(25);
  });

  it('BOTH leaders fell: dealt THEN taken, each floored separately — 20 → 15 → floor(18.75) = 18, NOT floor(20 × 15/16) = 18 by luck', () => {
    // The two orders happen to agree at 18 here, so the real discriminator is
    // the pair above: 15 and 25 are only reachable if each multiplication is
    // applied and floored independently.
    expect(leaderPenaltyBreath('A', 'B', { A: true, B: true }, 'single')('emberdrake', 'knight')).toBe(18);
  });

  it('the MISFIRE case (attacker and defender are the SAME side): both multipliers apply to one fallen leader — 20 → 15 → 18', () => {
    // A confused dragon breathes on its own row, so its side is both the
    // dealer and the taker; the composed order is unchanged.
    expect(leaderPenaltyBreath('A', 'A', { A: true, B: false }, 'single')('emberdrake', 'knight')).toBe(18);
  });

  it('composes ON TOP of the wipeout attenuation, not instead of it: 20 → att 15 → dealt floor(11.25) = 11', () => {
    expect(leaderPenaltyBreath('A', 'B', { A: true, B: false }, 'wipeout')('emberdrake', 'knight')).toBe(11);
  });

  it('re-clamps to minDamage AFTER the penalty: a 1-damage breath cut ×3/4 stays 1, never 0', () => {
    expect(leaderPenaltyBreath('A', 'B', { A: true, B: false }, 'single')('mage', 'phalanx')).toBe(1);
  });

  it('honours Weaken through the wrapper (the `weakened` flag reaches breathDamage): 20 → halve 10 → dealt floor(7.5) = 7', () => {
    expect(leaderPenaltyBreath('A', 'B', { A: true, B: false }, 'single')('emberdrake', 'knight', true)).toBe(7);
  });
});
