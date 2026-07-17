import { describe, expect, it } from 'vitest';
import { BALANCE, SLOT_COST, slotTotal } from '../src/balance';
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

  it('encodes the exact FR14 RPS triangle: mage > knight > archer > mage', () => {
    expect(BALANCE.rpsBeats).toEqual({ mage: 'knight', knight: 'archer', archer: 'mage' });
  });

  it('encodes the FR14 one-way caster hunts: archer → cleric + witch, and nobody hunts back', () => {
    expect(BALANCE.rpsHunts).toEqual({ archer: ['cleric', 'witch'] });
    // One-way by construction: no hunted class may itself hunt the hunter,
    // hunts must not duplicate a triangle pair (that would double-count), and
    // a hunt must not contradict the triangle — if the hunted class BEATS the
    // hunter in the triangle, the pipeline's advantage-OR would silently
    // override the ×0.75 disadvantage with ×1.5 (resolve.ts damagePipeline).
    for (const [hunter, hunted] of Object.entries(BALANCE.rpsHunts)) {
      for (const target of hunted ?? []) {
        expect(BALANCE.rpsHunts[target as UnitClass], `${target} hunts back`).toBeUndefined();
        expect(BALANCE.rpsBeats[hunter as UnitClass], `${hunter} triangle/hunt overlap`).not.toBe(target);
        expect(BALANCE.rpsBeats[target as UnitClass], `${target} beats hunter ${hunter} — hunt would flip a disadvantage to advantage`).not.toBe(hunter);
      }
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
