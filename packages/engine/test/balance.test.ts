import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import type { UnitClass } from '../src/types';

const ALL_CLASSES: UnitClass[] = ['knight', 'mercenary', 'archer', 'mage', 'cleric', 'witch'];

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
        expect(c.actions[row], `${cls}.actions.${row}`).toBeGreaterThanOrEqual(1);
      }
    }
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

  it('keeps formula constants as integer ratios (FR15 integer math)', () => {
    expect(BALANCE.formulas.rpsAdvantage).toEqual({ num: 3, den: 2 });
    expect(BALANCE.formulas.rpsDisadvantage).toEqual({ num: 3, den: 4 });
    expect(BALANCE.formulas.heal).toEqual({ num: 5, den: 4 });
    expect(BALANCE.formulas.minDamage).toBe(1);
    expect(BALANCE.formulas.poisonDamage).toBe(15);
    expect(BALANCE.formulas.confusionMisfire).toEqual({ num: 1, den: 2 });
    expect(BALANCE.armySize).toBe(3);
    expect(BALANCE.engagementCap).toBe(5);
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
