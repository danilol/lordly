import { describe, expect, it } from 'vitest';
import { BALANCE, dealsAdvantage, rpsRatio, SLOT_COST, slotTotal } from '../src/balance';
import type { Ratio } from '../src/balance';
import { ALL_CLASSES } from '../src/types';
import type { UnitClass } from '../src/types';

describe('balance data (FR14, FR15, FR16, AD-4)', () => {
  it('declares a positive integer balanceVersion', () => {
    expect(Number.isInteger(BALANCE.version)).toBe(true);
    expect(BALANCE.version).toBeGreaterThanOrEqual(1);
  });

  it('has exactly the six classes, each with all attributes and per-row action counts', () => {
    expect(Object.keys(BALANCE.classes).sort()).toEqual([...ALL_CLASSES].sort());
    for (const cls of ALL_CLASSES) {
      const c = BALANCE.classes[cls];
      for (const attr of ['hp', 'str', 'vit', 'int', 'men', 'agi', 'dex'] as const) {
        expect(Number.isInteger(c[attr]), `${cls}.${attr}`).toBe(true);
        expect(c[attr], `${cls}.${attr}`).toBeGreaterThan(0);
      }
      for (const row of ['front', 'mid', 'back'] as const) {
        expect(Number.isInteger(c.actions[row]), `${cls}.actions.${row} integer`).toBe(true);
        expect(c.actions[row], `${cls}.actions.${row}`).toBeGreaterThanOrEqual(1);
      }
      expect(['small', 'monster'], `${cls}.sizeClass`).toContain(c.sizeClass);
    }
  });

  it('slot schema (AD-1, story 4.2): budget 5, all six shipped classes small, costs derived from sizeClass', () => {
    expect(BALANCE.slotBudget).toBe(5);
    expect(SLOT_COST).toEqual({ small: 1, monster: 2 });
    for (const cls of ALL_CLASSES) {
      expect(BALANCE.classes[cls].sizeClass, `${cls} ships small`).toBe('small');
    }
  });

  it('slotTotal sums per-class slot costs — THE legality arithmetic, never army.length (AD-1)', () => {
    expect(slotTotal([])).toBe(0);
    const five = (['knight', 'archer', 'mage', 'cleric', 'witch'] as const).map((cls) => ({ class: cls, element: 'fire' as const }));
    expect(slotTotal(five)).toBe(5);
    // A future monster (sizeClass 'monster') costs 2: a two-monster army is
    // full at 3 units — the cost table above is what validation trusts.
    expect(SLOT_COST.monster).toBe(2);
  });

  it('structural invariants survive tuning: ratios are positive-integer fractions', () => {
    const ratios: Record<string, Ratio> = {
      rpsAdvantage: BALANCE.formulas.rpsAdvantage,
      rpsDisadvantage: BALANCE.formulas.rpsDisadvantage,
      blastAttenuation: BALANCE.formulas.blastAttenuation,
      heal: BALANCE.formulas.heal,
      confusionMisfire: BALANCE.formulas.confusionMisfire,
    };
    for (const [name, ratio] of Object.entries(ratios)) {
      expect(Number.isInteger(ratio.num), `${name}.num integer`).toBe(true);
      expect(Number.isInteger(ratio.den), `${name}.den integer`).toBe(true);
      expect(ratio.num, `${name}.num >= 0`).toBeGreaterThanOrEqual(0);
      expect(ratio.den, `${name}.den > 0 (division by zero)`).toBeGreaterThan(0);
    }
    expect(BALANCE.slotBudget).toBeGreaterThan(0);
    expect(BALANCE.engagementCap).toBeGreaterThan(0);
    expect(BALANCE.formulas.minDamage).toBeGreaterThanOrEqual(1);
  });

  it('spot-checks PRD FR15 values', () => {
    expect(BALANCE.classes.knight.hp).toBe(140);
    expect(BALANCE.classes.knight.actions).toEqual({ front: 2, mid: 1, back: 1 });
    expect(BALANCE.classes.witch.agi).toBe(26);
    expect(BALANCE.classes.mage.int).toBe(30);
    expect(BALANCE.classes.archer.actions).toEqual({ front: 1, mid: 2, back: 2 });
    expect(BALANCE.classes.cleric.str).toBe(8);
  });

  it('assigns the shipped-six roles (FR14, dossier §1)', () => {
    expect(BALANCE.classes.knight.role).toBe('vanguard');
    expect(BALANCE.classes.mercenary.role).toBe('skirmisher');
    expect(BALANCE.classes.archer.role).toBe('sniper');
    expect(BALANCE.classes.mage.role).toBe('artillery');
    expect(BALANCE.classes.cleric.role).toBe('support');
    expect(BALANCE.classes.witch.role).toBe('control');
  });

  it('encodes the FR14 role relations: the RPS triangle (symmetric) + the caster hunts (one-way)', () => {
    expect(BALANCE.roleRelations).toEqual([
      { attacker: 'artillery', defender: 'vanguard', kind: 'symmetric' },
      { attacker: 'vanguard', defender: 'sniper', kind: 'symmetric' },
      { attacker: 'sniper', defender: 'artillery', kind: 'symmetric' },
      { attacker: 'sniper', defender: 'support', kind: 'hunt' },
      { attacker: 'sniper', defender: 'control', kind: 'hunt' },
    ]);
  });

  it('CONTINUITY (FR14 degenerate case): role relations reproduce the pre-4.3 rpsBeats/rpsHunts matchups EXACTLY over the shipped six', () => {
    // The known pre-4.3 truth, hardcoded: advantage (×3/2) pairs and the
    // disadvantage (×3/4) reverses of the SYMMETRIC triangle only. The archer's
    // caster hunts (archer→cleric, archer→witch) are one-way: cleric/witch hit
    // the archer back at plain ×1.0 (no reverse penalty).
    const advantage: ReadonlyArray<readonly [UnitClass, UnitClass]> = [
      ['mage', 'knight'],
      ['knight', 'archer'],
      ['archer', 'mage'],
      ['archer', 'cleric'],
      ['archer', 'witch'],
    ];
    const disadvantage: ReadonlyArray<readonly [UnitClass, UnitClass]> = [
      ['knight', 'mage'],
      ['archer', 'knight'],
      ['mage', 'archer'],
    ];
    const adv = new Set(advantage.map(([a, d]) => `${a}>${d}`));
    const dis = new Set(disadvantage.map(([a, d]) => `${a}>${d}`));
    const six: UnitClass[] = ['knight', 'mercenary', 'archer', 'mage', 'cleric', 'witch'];
    for (const attacker of six) {
      for (const defender of six) {
        const key = `${attacker}>${defender}`;
        const ratio = rpsRatio(attacker, defender);
        if (adv.has(key)) {
          expect(ratio, `${key} should be advantage`).toEqual({ num: 3, den: 2 });
          expect(dealsAdvantage(attacker, defender), `${key} dealsAdvantage`).toBe(true);
        } else if (dis.has(key)) {
          expect(ratio, `${key} should be disadvantage`).toEqual({ num: 3, den: 4 });
        } else {
          expect(ratio, `${key} should be neutral`).toBeUndefined();
        }
      }
    }
  });

  it('new classes inherit matchups BY ROLE — no per-class rules (story 4.3, the flat-rule-count goal)', () => {
    // Berserker & Phalanx are Vanguard, so they share Knight's relations.
    expect(rpsRatio('berserker', 'archer')).toEqual({ num: 3, den: 2 }); // Vanguard beats Sniper
    expect(rpsRatio('phalanx', 'archer')).toEqual({ num: 3, den: 2 });
    expect(rpsRatio('berserker', 'sorceress')).toEqual({ num: 3, den: 4 }); // Vanguard disadvantaged vs Artillery
    // Sorceress is Artillery, so it beats every Vanguard (like the Wizard/mage).
    expect(rpsRatio('sorceress', 'knight')).toEqual({ num: 3, den: 2 });
    expect(rpsRatio('sorceress', 'berserker')).toEqual({ num: 3, den: 2 });
    expect(rpsRatio('archer', 'sorceress')).toEqual({ num: 3, den: 2 }); // Sniper beats Artillery
    // Ninja & Valkyrie are Skirmisher — fully neutral, no relations either way.
    for (const other of ALL_CLASSES) {
      expect(rpsRatio('ninja', other), `ninja>${other}`).toBeUndefined();
      expect(rpsRatio('valkyrie', other), `valkyrie>${other}`).toBeUndefined();
      expect(rpsRatio(other, 'ninja'), `${other}>ninja`).toBeUndefined();
      expect(rpsRatio(other, 'valkyrie'), `${other}>valkyrie`).toBeUndefined();
    }
  });

  it('keeps formula constants as integer ratios (FR15 integer math)', () => {
    expect(BALANCE.formulas.rpsAdvantage).toEqual({ num: 3, den: 2 });
    expect(BALANCE.formulas.rpsDisadvantage).toEqual({ num: 3, den: 4 });
    expect(BALANCE.formulas.blastAttenuation).toEqual({ num: 3, den: 4 });
    expect(BALANCE.formulas.heal).toEqual({ num: 5, den: 4 });
    expect(BALANCE.formulas.minDamage).toBe(1);
    expect(BALANCE.formulas.poisonDamage).toBe(15);
    expect(BALANCE.formulas.confusionMisfire).toEqual({ num: 1, den: 2 });
    expect(BALANCE.slotBudget).toBe(5);
    expect(BALANCE.engagementCap).toBe(10);
  });

  it('maps elements to Witch spells per FR16', () => {
    expect(BALANCE.elementSpells).toEqual({
      water: 'sleep',
      earth: 'poison',
      fire: 'weaken',
      wind: 'confusion',
    });
  });
});
