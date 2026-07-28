import { describe, expect, it } from 'vitest';
import { ALL_CLASSES, ALL_ROWS, BALANCE, SLOT_COST } from '@lordly/engine';
import { canAddUnit, canContinue, classRulesCard, draftBlockReason, hasHuman, moveLabel, movesVaryByRow } from '../src/flow/draftModel';
import { CLASS_DISPLAY_NAME } from '../src/config/constants';
import type { DraftedUnit } from '../src/flow/MatchState';

const army = (n: number): DraftedUnit[] => Array.from({ length: n }, (_, i) => ({ class: 'knight', element: 'fire', name: `Knight ${i}` }) as DraftedUnit);

describe('draft gating (FR1/FR30 — SLOT budget, AD-1)', () => {
  // All shipped classes are small (cost 1), so n knights fill n slots.
  it('can add while under the slot budget, not at it', () => {
    expect(canAddUnit(army(0), 'knight')).toBe(true);
    expect(canAddUnit(army(BALANCE.slotBudget - 1), 'knight')).toBe(true);
    expect(canAddUnit(army(BALANCE.slotBudget), 'knight')).toBe(false);
  });

  it('can continue only at exactly the filled slot budget', () => {
    expect(canContinue(army(BALANCE.slotBudget - 1))).toBe(false);
    expect(canContinue(army(BALANCE.slotBudget))).toBe(true);
    expect(canContinue(army(BALANCE.slotBudget + 1))).toBe(false);
  });

  // Device-reported bug: the UI let a 3rd monster through and let a monster
  // candidate overflow the budget by its OWN 2-slot cost — both because the
  // old signature only checked the running total, never the candidate.
  it('rejects a monster candidate that would overflow the slot budget by its OWN 2-slot cost, even though the running total alone is still under budget', () => {
    // 4 slots used (4 knights), 1 remains — a monster costs 2, so it must be
    // rejected even though `slotTotal(army) < slotBudget` is still true.
    expect(canAddUnit(army(BALANCE.slotBudget - 1), 'golem')).toBe(false);
    expect(canAddUnit(army(BALANCE.slotBudget - 2), 'golem')).toBe(true); // exactly 2 slots remain
  });

  it('rejects a THIRD monster candidate even with slots to spare (FR1/FR38 — max 2 per army)', () => {
    const twoMonsters: DraftedUnit[] = [
      { class: 'golem', element: 'fire', name: 'Ogham' },
      { class: 'golem', element: 'water', name: 'Karrick' },
    ];
    expect(canAddUnit(twoMonsters, 'golem')).toBe(false);
    expect(canAddUnit(twoMonsters, 'knight')).toBe(true); // a small is unaffected by the monster cap
  });
});

/**
 * The E5-D13 draft gate (story 5.5, review-added coverage 2026-07-28): the
 * humans-only crown means a full army with no human is a dead end at
 * Placement, so `canContinue` refuses it and `draftBlockReason` names why.
 * This is the WEB layer's own pin — the engine's `leader-not-human` check is
 * pinned in validate.test.ts, but before this suite, deleting the
 * `hasHuman` clause from `canContinue` failed NOTHING and quietly downgraded
 * the friendly gate to a commit-time crash.
 */
describe('the humans-only draft gate (E5-D13, story 5.5)', () => {
  const u = (cls: DraftedUnit['class']): DraftedUnit => ({ class: cls, element: 'fire', name: 'X' }) as DraftedUnit;

  it('hasHuman keys on RACE, not sizeClass — a Whelp-only army has no human despite being all smalls', () => {
    expect(hasHuman([u('knight')])).toBe(true);
    expect(hasHuman([u('whelp'), u('whelp')])).toBe(false); // small, but dragonkind
    expect(hasHuman([u('golem')])).toBe(false);
    expect(hasHuman([])).toBe(false);
  });

  it("Danilo's three examples, verbatim at the DRAFT layer: no-human is blocked, human-including armies continue", () => {
    // Golem + Emberdrake + Whelp: 5 slots, zero humans → blocked.
    expect(canContinue([u('golem'), u('emberdrake'), u('whelp')])).toBe(false);
    // Golem + Emberdrake + Knight: 5 slots, one human → continues.
    expect(canContinue([u('golem'), u('emberdrake'), u('knight')])).toBe(true);
    // Golem + Whelp + Knight + Cleric: 5 slots, two humans → continues.
    expect(canContinue([u('golem'), u('whelp'), u('knight'), u('cleric')])).toBe(true);
  });

  it('draftBlockReason names the no-human block ONLY on a full army — the fill counter owns the under-budget story', () => {
    expect(draftBlockReason([u('golem'), u('emberdrake'), u('whelp')])).toMatch(/human/);
    expect(draftBlockReason([u('golem'), u('emberdrake'), u('knight')])).toBeNull(); // full + human: no block
    expect(draftBlockReason([u('golem'), u('whelp')])).toBeNull(); // under budget: not this hint's job, even with no human aboard
  });

  it('the block-reason string fits ONE 10px line — two lines would touch the Continue button (review 2026-07-28)', () => {
    // The hint renders at MIN_FONT_PX (10px) centred at trayY+62 = 506 with a
    // 336px wrap; the Continue button's top edge is y=516. One line spans
    // ~500.5–511.5 (clear); a wrapped second line reaches ~517. ~4.8px/char
    // at 10px Arial against 336px ⇒ the budget is 70 characters.
    const reason = draftBlockReason([u('golem'), u('emberdrake'), u('whelp')]);
    expect(reason).not.toBeNull();
    expect((reason as string).length, 'must stay a single 336px line at 10px').toBeLessThanOrEqual(70);
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

  it('reports each class’s slot cost from SLOT_COST — 1 for a small, 2 for the monster (story 4.9, FR1/FR38)', () => {
    for (const cls of ALL_CLASSES) {
      expect(classRulesCard(cls).slotCost).toBe(SLOT_COST[BALANCE.classes[cls].sizeClass]);
    }
    expect(classRulesCard('knight').slotCost).toBe(1);
    expect(classRulesCard('golem').slotCost).toBe(2);
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
  it('exactly the row-varied classes vary by row (the DraftScene breakdown-line gate) — 5.4 added Valkyrie/Vultan/Raven, 5.5 the Gryphon and the six breath dragons', () => {
    const varying = ALL_CLASSES.filter(movesVaryByRow);
    expect(new Set(varying)).toEqual(
      new Set([
        'knight',
        'phalanx',
        'mage',
        'sorceress',
        'valkyrie',
        'vultan',
        'raven',
        // Story 5.5: the Gryphon's back-row Wind Shot, and every grown dragon
        // (front/mid Bite, back Breath). The Whelp does NOT vary — it bites
        // from every row, which is what makes it the budget dragon.
        'gryphon',
        'emberdrake',
        'frostfang',
        'stormscale',
        'cragmaw',
        'nightwing',
        'halowing',
      ]),
    );
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
