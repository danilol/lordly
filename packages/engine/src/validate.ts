import { BALANCE } from './balance';
import { ALL_CLASSES, ALL_COLS, ALL_ELEMENTS, ALL_ROWS } from './types';
import type { MatchSetup, Side } from './types';

/** Discriminant codes for every way a `MatchSetup` can be malformed (AC2). */
export type MatchSetupViolation =
  | 'invalid-seed'
  | 'balance-version-mismatch'
  | 'invalid-mode'
  | 'wrong-army-size'
  | 'unknown-class'
  | 'unknown-element'
  | 'placements-mismatch'
  | 'out-of-grid'
  | 'overlapping-placement';

/**
 * The engine's ONLY error type (spine errors convention): thrown by
 * `validateMatchSetup` when input is malformed, never mid-battle. The
 * `violation` code discriminates programmatically; the message names the
 * offending side/index/value for humans.
 */
export class InvalidMatchSetupError extends Error {
  readonly violation: MatchSetupViolation;

  constructor(violation: MatchSetupViolation, message: string) {
    super(message);
    this.name = 'InvalidMatchSetupError';
    this.violation = violation;
  }
}

const SIDES: readonly Side[] = ['A', 'B'];

/**
 * Validates a `MatchSetup` against the AD-9 contract and the balance data,
 * in a fixed documented order: seed → balanceVersion → mode → army sizes →
 * classes/elements → placement parallelism → grid membership → same-side
 * overlaps. Throws `InvalidMatchSetupError` naming the first violation;
 * returns nothing on success. Runtime callers are not bound by the TS
 * unions, so every closed set is re-checked here (AC2).
 */
export function validateMatchSetup(setup: MatchSetup): void {
  const { seed, balanceVersion, mode, armies, placements } = setup;

  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new InvalidMatchSetupError('invalid-seed', `seed must be a uint32, got ${seed}`);
  }
  if (balanceVersion !== BALANCE.version) {
    throw new InvalidMatchSetupError(
      'balance-version-mismatch',
      `setup balanceVersion ${balanceVersion} does not match engine balance version ${BALANCE.version}`,
    );
  }
  if (mode !== 'single' && mode !== 'wipeout') {
    throw new InvalidMatchSetupError('invalid-mode', `unknown mode '${String(mode)}'`);
  }

  for (const side of SIDES) {
    const army = armies[side];
    if (!Array.isArray(army) || army.length !== BALANCE.armySize) {
      throw new InvalidMatchSetupError(
        'wrong-army-size',
        `side ${side} must field exactly ${BALANCE.armySize} units, got ${Array.isArray(army) ? army.length : typeof army}`,
      );
    }
    army.forEach((unit, i) => {
      if (!(ALL_CLASSES as readonly string[]).includes(unit.class)) {
        throw new InvalidMatchSetupError('unknown-class', `side ${side} unit ${i} has unknown class '${String(unit.class)}'`);
      }
      if (!(ALL_ELEMENTS as readonly string[]).includes(unit.element)) {
        throw new InvalidMatchSetupError('unknown-element', `side ${side} unit ${i} has unknown element '${String(unit.element)}'`);
      }
    });
  }

  for (const side of SIDES) {
    const cells = placements[side];
    if (!Array.isArray(cells) || cells.length !== armies[side].length) {
      throw new InvalidMatchSetupError(
        'placements-mismatch',
        `side ${side} placements must parallel its army (${armies[side].length} units, got ${Array.isArray(cells) ? cells.length : typeof cells})`,
      );
    }
    const seen = new Set<string>();
    cells.forEach((cell, i) => {
      if (!(ALL_ROWS as readonly string[]).includes(cell.row) || !(ALL_COLS as readonly string[]).includes(cell.col)) {
        throw new InvalidMatchSetupError(
          'out-of-grid',
          `side ${side} unit ${i} placed outside the grid at '${String(cell.row)}/${String(cell.col)}'`,
        );
      }
      const key = `${cell.row}/${cell.col}`;
      if (seen.has(key)) {
        throw new InvalidMatchSetupError('overlapping-placement', `side ${side} has two units on cell ${key}`);
      }
      seen.add(key);
    });
  }
}
