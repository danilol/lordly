import { describe, expect, it } from 'vitest';
import { ALL_CLASSES, BALANCE } from '@lordly/engine';
import { canAddUnit, canContinue, classRulesCard } from '../src/flow/draftModel';
import type { DraftedUnit } from '../src/flow/MatchState';

const army = (n: number): DraftedUnit[] => Array.from({ length: n }, () => ({ class: 'knight', element: 'fire' }) as DraftedUnit);

describe('draft gating (FR1)', () => {
  it('can add while under the army size, not at it', () => {
    expect(canAddUnit(army(0))).toBe(true);
    expect(canAddUnit(army(2))).toBe(true);
    expect(canAddUnit(army(BALANCE.armySize))).toBe(false);
  });

  it('can continue only at exactly the army size', () => {
    expect(canContinue(army(2))).toBe(false);
    expect(canContinue(army(BALANCE.armySize))).toBe(true);
    expect(canContinue(army(BALANCE.armySize + 1))).toBe(false);
  });
});

describe('rules cards derive from BALANCE data, never hardcoded (FR2 + data-must-be-read lesson)', () => {
  it('builds a card for every class', () => {
    for (const cls of ALL_CLASSES) {
      const card = classRulesCard(cls);
      expect(card.name.toLowerCase()).toBe(cls);
      expect(card.role.length).toBeGreaterThan(0);
      expect(card.behavior.length).toBeGreaterThan(0);
    }
  });

  it('reports per-row action counts straight from BALANCE.classes[c].actions', () => {
    for (const cls of ALL_CLASSES) {
      const { actions } = BALANCE.classes[cls];
      expect(classRulesCard(cls).actions).toEqual(actions);
    }
  });

  it('derives the RPS relation from BALANCE.rpsBeats (both directions)', () => {
    // knight beats archer; is beaten by mage (rpsBeats: mage->knight, knight->archer, archer->mage).
    const knight = classRulesCard('knight');
    expect(knight.beats).toBe('archer');
    expect(knight.beatenBy).toBe('mage');

    // mercenary sits outside the triangle — no relation either way.
    const merc = classRulesCard('mercenary');
    expect(merc.beats).toBeUndefined();
    expect(merc.beatenBy).toBeUndefined();
  });

  it('key stats echo BALANCE (a drift guard — no retyped numbers)', () => {
    const mage = classRulesCard('mage');
    expect(mage.stats.hp).toBe(BALANCE.classes.mage.hp);
    expect(mage.stats.str).toBe(BALANCE.classes.mage.str);
    expect(mage.stats.int).toBe(BALANCE.classes.mage.int);
  });
});
