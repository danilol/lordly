import { BALANCE } from './balance';
import { ALL_CLASSES, ALL_COLS, ALL_ELEMENTS, ALL_ROWS } from './types';
import type { MatchSetup, Side } from './types';

/** Discriminant codes for every way a `MatchSetup` can be malformed (AC2). */
export type MatchSetupViolation =
  | 'not-an-object'
  | 'invalid-seed'
  | 'balance-version-mismatch'
  | 'invalid-mode'
  | 'wrong-army-size'
  | 'unknown-class'
  | 'unknown-element'
  | 'placements-mismatch'
  | 'out-of-grid'
  | 'overlapping-placement';

/** True for a non-null plain object — used to reject malformed runtime input as a typed error. */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

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
 * in a fixed documented order: structure → seed → balanceVersion → mode →
 * army sizes → classes/elements → placement parallelism → grid membership →
 * same-side overlaps. Throws `InvalidMatchSetupError` naming the first
 * violation; returns nothing on success. Runtime callers are not bound by
 * the TS unions, so both the STRUCTURE (objects present, not null) and every
 * closed set are re-checked here — the engine's sole error type must cover
 * malformed input, never leaking a raw `TypeError` (AC2, spine errors convention).
 */
export function validateMatchSetup(setup: MatchSetup): void {
  if (!isObject(setup)) {
    throw new InvalidMatchSetupError('not-an-object', `setup must be an object, got ${setup === null ? 'null' : typeof setup}`);
  }
  const { seed, balanceVersion, mode, armies, placements } = setup as unknown as Record<string, unknown>;

  if (!Number.isInteger(seed) || (seed as number) < 0 || (seed as number) > 0xffffffff) {
    throw new InvalidMatchSetupError('invalid-seed', `seed must be a uint32, got ${String(seed)}`);
  }
  if (balanceVersion !== BALANCE.version) {
    throw new InvalidMatchSetupError(
      'balance-version-mismatch',
      `setup balanceVersion ${String(balanceVersion)} does not match engine balance version ${BALANCE.version}`,
    );
  }
  if (mode !== 'single' && mode !== 'wipeout') {
    throw new InvalidMatchSetupError('invalid-mode', `unknown mode '${String(mode)}'`);
  }
  if (!isObject(armies) || !isObject(placements)) {
    throw new InvalidMatchSetupError(
      'not-an-object',
      `armies and placements must be objects, got armies=${typeof armies}, placements=${typeof placements}`,
    );
  }

  for (const side of SIDES) {
    const army = (armies as Record<string, unknown>)[side];
    if (!Array.isArray(army) || army.length !== BALANCE.armySize) {
      throw new InvalidMatchSetupError(
        'wrong-army-size',
        `side ${side} must field exactly ${BALANCE.armySize} units, got ${Array.isArray(army) ? army.length : typeof army}`,
      );
    }
    army.forEach((unit: unknown, i) => {
      if (!isObject(unit)) {
        throw new InvalidMatchSetupError('unknown-class', `side ${side} unit ${i} is not an object (got ${unit === null ? 'null' : typeof unit})`);
      }
      if (!(ALL_CLASSES as readonly string[]).includes(unit.class as string)) {
        throw new InvalidMatchSetupError('unknown-class', `side ${side} unit ${i} has unknown class '${String(unit.class)}'`);
      }
      if (!(ALL_ELEMENTS as readonly string[]).includes(unit.element as string)) {
        throw new InvalidMatchSetupError('unknown-element', `side ${side} unit ${i} has unknown element '${String(unit.element)}'`);
      }
    });
  }

  for (const side of SIDES) {
    const cells = (placements as Record<string, unknown>)[side];
    const army = (armies as Record<string, unknown>)[side] as unknown[];
    if (!Array.isArray(cells) || cells.length !== army.length) {
      throw new InvalidMatchSetupError(
        'placements-mismatch',
        `side ${side} placements must parallel its army (${army.length} units, got ${Array.isArray(cells) ? cells.length : typeof cells})`,
      );
    }
    const seen = new Set<string>();
    cells.forEach((cell: unknown, i) => {
      if (!isObject(cell)) {
        throw new InvalidMatchSetupError('out-of-grid', `side ${side} unit ${i} placement is not an object (got ${cell === null ? 'null' : typeof cell})`);
      }
      if (!(ALL_ROWS as readonly string[]).includes(cell.row as string) || !(ALL_COLS as readonly string[]).includes(cell.col as string)) {
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
