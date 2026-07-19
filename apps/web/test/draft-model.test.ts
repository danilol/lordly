import { describe, expect, it } from 'vitest';
import { ALL_CLASSES, ALL_ROWS, BALANCE } from '@lordly/engine';
import { canAddUnit, canContinue, classRulesCard, moveLabel, movesVaryByRow } from '../src/flow/draftModel';
import { CLASS_DISPLAY_NAME } from '../src/config/constants';
import type { DraftedUnit } from '../src/flow/MatchState';

const army = (n: number): DraftedUnit[] => Array.from({ length: n }, (_, i) => ({ class: 'knight', element: 'fire', name: `Knight ${i}` }) as DraftedUnit);

describe('draft gating (FR1/FR30 — SLOT budget, AD-1)', () => {
  // All shipped classes are small (cost 1), so n knights fill n slots.
  it('can add while under the slot budget, not at it', () => {
    expect(canAddUnit(army(0))).toBe(true);
    expect(canAddUnit(army(BALANCE.slotBudget - 1))).toBe(true);
    expect(canAddUnit(army(BALANCE.slotBudget))).toBe(false);
  });

  it('can continue only at exactly the filled slot budget', () => {
    expect(canContinue(army(BALANCE.slotBudget - 1))).toBe(false);
    expect(canContinue(army(BALANCE.slotBudget))).toBe(true);
    expect(canContinue(army(BALANCE.slotBudget + 1))).toBe(false);
  });
});

describe('rules cards derive from BALANCE data, never hardcoded (FR2 + data-must-be-read lesson)', () => {
  it('builds a card for every class', () => {
    for (const cls of ALL_CLASSES) {
      const card = classRulesCard(cls);
      expect(card.name).toBe(CLASS_DISPLAY_NAME[cls]); // story 4.3: card shows the display name (mage → "Wizard", D-1d)
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

  it('derives matchups from the role relations (arrays — story 4.3, may be several)', () => {
    // Knight is a Vanguard: beats Snipers (archer), loses to Artillery (Wizard/mage + Sorceress).
    const knight = classRulesCard('knight');
    expect(knight.beats).toEqual(['archer']);
    expect(knight.beatenBy).toEqual(['mage', 'sorceress']);

    // Mercenary is a Skirmisher — fully neutral, no relation either way.
    const merc = classRulesCard('mercenary');
    expect(merc.beats).toEqual([]);
    expect(merc.beatenBy).toEqual([]);

    // A newcomer inherits its matchups BY ROLE: Berserker is a Vanguard, same as the Knight.
    expect(classRulesCard('berserker').beats).toEqual(['archer']);
    expect(classRulesCard('berserker').beatenBy).toEqual(['mage', 'sorceress']);
  });

  it('key stats echo BALANCE (a drift guard — no retyped numbers)', () => {
    const mage = classRulesCard('mage');
    expect(mage.stats.hp).toBe(BALANCE.classes.mage.hp);
    expect(mage.stats.str).toBe(BALANCE.classes.mage.str);
    expect(mage.stats.int).toBe(BALANCE.classes.mage.int);
  });

  it('reports per-row moves straight from BALANCE.classes[c].moves (story 4.7, FR32/FR33)', () => {
    for (const cls of ALL_CLASSES) {
      expect(classRulesCard(cls).moves).toEqual(BALANCE.classes[cls].moves);
    }
  });
});

describe('per-row move labels (story 4.7, FR32/FR33)', () => {
  it('exactly Knight, Phalanx, Wizard(mage), Sorceress vary by row (the DraftScene breakdown-line gate)', () => {
    const varying = ALL_CLASSES.filter(movesVaryByRow);
    expect(new Set(varying)).toEqual(new Set(['knight', 'phalanx', 'mage', 'sorceress']));
    for (const cls of ALL_CLASSES) {
      const uniform = new Set(ALL_ROWS.map((row) => BALANCE.classes[cls].moves[row])).size === 1;
      expect(movesVaryByRow(cls), cls).toBe(!uniform);
    }
  });

  it('names Guard by tier and Title-Cases every other move', () => {
    expect(moveLabel('guard-full')).toBe('Guard (full)');
    expect(moveLabel('guard-half')).toBe('Guard (half)');
    expect(moveLabel('slash')).toBe('Slash');
    expect(moveLabel('bash')).toBe('Bash');
    expect(moveLabel('arrow')).toBe('Arrow');
    expect(moveLabel('blast')).toBe('Blast');
    expect(moveLabel('staff')).toBe('Staff');
  });
});
