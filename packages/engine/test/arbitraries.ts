import { fc } from '@fast-check/vitest';
import { BALANCE } from '../src/balance';
import { FEMALE_NAMES, MALE_NAMES } from '../src/names';
import { ALL_CLASSES, ALL_COLS, ALL_ELEMENTS, ALL_ROWS, ALL_TACTICS } from '../src/types';
import type { MatchSetup, Placement, Unit } from '../src/types';

/** Every cell of the 3×3 grid, in a fixed order. */
const ALL_CELLS: Placement[] = ALL_ROWS.flatMap((row) => ALL_COLS.map((col) => ({ row, col })));

/** Real table names plus arbitrary non-blank strings — validation only demands non-blank (FR37). */
const nameArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...MALE_NAMES, ...FEMALE_NAMES),
  fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
);

const unitArb: fc.Arbitrary<Unit> = fc.record({
  class: fc.constantFrom(...ALL_CLASSES),
  element: fc.constantFrom(...ALL_ELEMENTS),
  name: nameArb,
});

/**
 * A slot-legal army (AD-1, story 4.2): `slotTotal(army) === BALANCE.slotBudget`.
 * Every shipped class is `sizeClass: 'small'` (cost 1) this era, so a legal
 * army is exactly `slotBudget` units — story 4.8's monsters extend this
 * arbitrary with mixed-cost compositions.
 */
const armyArb = fc.array(unitArb, { minLength: BALANCE.slotBudget, maxLength: BALANCE.slotBudget });

/** Distinct cells for one side: a shuffled subset of the 9 grid cells. */
const placementsArb = fc
  .shuffledSubarray(ALL_CELLS, { minLength: BALANCE.slotBudget, maxLength: BALANCE.slotBudget })
  .map((cells) => cells.map((c) => ({ ...c })));

/** A leader index into an all-smalls army (army length === slotBudget this era). */
const leaderArb = fc.integer({ min: 0, max: BALANCE.slotBudget - 1 });

/**
 * A VALID `MatchSetup` (passes `validateMatchSetup`): slot-legal named
 * armies, explicit tactics and leaders (story 4.2, AD-9), distinct same-side
 * cells, uint32 seed, either mode. Shared by the chassis property tests and
 * reused by stories 1.5/1.6/4.2.
 */
export const matchSetupArb: fc.Arbitrary<MatchSetup> = fc.record({
  seed: fc.integer({ min: 0, max: 0xffffffff }),
  balanceVersion: fc.constant(BALANCE.version),
  mode: fc.constantFrom('single', 'wipeout'),
  tactics: fc.record({ A: fc.constantFrom(...ALL_TACTICS), B: fc.constantFrom(...ALL_TACTICS) }),
  leaders: fc.record({ A: leaderArb, B: leaderArb }),
  armies: fc.record({ A: armyArb, B: armyArb }),
  placements: fc.record({ A: placementsArb, B: placementsArb }),
});
