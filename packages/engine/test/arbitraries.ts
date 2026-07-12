import { fc } from '@fast-check/vitest';
import { BALANCE } from '../src/balance';
import { ALL_CLASSES, ALL_COLS, ALL_ELEMENTS, ALL_ROWS } from '../src/types';
import type { MatchSetup, Placement, Unit } from '../src/types';

/** Every cell of the 3×3 grid, in a fixed order. */
const ALL_CELLS: Placement[] = ALL_ROWS.flatMap((row) => ALL_COLS.map((col) => ({ row, col })));

const unitArb: fc.Arbitrary<Unit> = fc.record({
  class: fc.constantFrom(...ALL_CLASSES),
  element: fc.constantFrom(...ALL_ELEMENTS),
});

const armyArb = fc.array(unitArb, { minLength: BALANCE.armySize, maxLength: BALANCE.armySize });

/** Distinct cells for one side: a shuffled subset of the 9 grid cells. */
const placementsArb = fc
  .shuffledSubarray(ALL_CELLS, { minLength: BALANCE.armySize, maxLength: BALANCE.armySize })
  .map((cells) => cells.map((c) => ({ ...c })));

/**
 * A VALID `MatchSetup` (passes `validateMatchSetup`): armies of the balance
 * army size, distinct same-side cells, uint32 seed, either mode. Shared by
 * the chassis property tests and reused by stories 1.5/1.6.
 */
export const matchSetupArb: fc.Arbitrary<MatchSetup> = fc.record({
  seed: fc.integer({ min: 0, max: 0xffffffff }),
  balanceVersion: fc.constant(BALANCE.version),
  mode: fc.constantFrom('single', 'wipeout'),
  armies: fc.record({ A: armyArb, B: armyArb }),
  placements: fc.record({ A: placementsArb, B: placementsArb }),
});
