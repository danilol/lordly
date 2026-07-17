import { BALANCE, slotTotal } from './balance';
import { MAX_SEED } from './rng';
import { ALL_CLASSES, ALL_COLS, ALL_ELEMENTS, ALL_ROWS, ALL_TACTICS } from './types';
import type { MatchSetup, Side } from './types';

/** Discriminant codes for every way a `MatchSetup` can be malformed (AC2). */
export type MatchSetupViolation =
  | 'not-an-object'
  | 'invalid-seed'
  | 'balance-version-mismatch'
  | 'invalid-mode'
  | 'invalid-tactic'
  | 'invalid-leader'
  | 'wrong-slot-total'
  | 'unknown-class'
  | 'unknown-element'
  | 'invalid-name'
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
 * tactics → classes/elements/names → slot totals (AD-1: classes first,
 * because slot costs read the class table) → leaders (after armies, because
 * a leader is an index into its side's army) → placement parallelism →
 * grid membership → same-side overlaps. Throws `InvalidMatchSetupError` naming the first
 * violation; returns nothing on success. Runtime callers are not bound by
 * the TS unions, so both the STRUCTURE (objects present, not null) and every
 * closed set are re-checked here — the engine's sole error type must cover
 * malformed input, never leaking a raw `TypeError` (AC2, spine errors convention).
 */
export function validateMatchSetup(setup: MatchSetup): void {
  if (!isObject(setup)) {
    throw new InvalidMatchSetupError('not-an-object', `setup must be an object, got ${setup === null ? 'null' : typeof setup}`);
  }
  const { seed, balanceVersion, mode, tactics, leaders, armies, placements } = setup as unknown as Record<string, unknown>;

  if (!Number.isInteger(seed) || (seed as number) < 0 || (seed as number) > MAX_SEED) {
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
    throw new InvalidMatchSetupError('not-an-object', `armies and placements must be objects, got armies=${typeof armies}, placements=${typeof placements}`);
  }

  // FR34 (story 4.2): both sides carry an explicit tactic from the closed set —
  // there is no implicit default at the engine boundary.
  for (const side of SIDES) {
    const tactic = isObject(tactics) ? tactics[side] : undefined;
    if (!(ALL_TACTICS as readonly string[]).includes(tactic as string)) {
      throw new InvalidMatchSetupError('invalid-tactic', `side ${side} tactic must be one of [${ALL_TACTICS.join(', ')}], got '${String(tactic)}'`);
    }
  }

  for (const side of SIDES) {
    const army = (armies as Record<string, unknown>)[side];
    if (!Array.isArray(army)) {
      throw new InvalidMatchSetupError('wrong-slot-total', `side ${side} army must be an array, got ${typeof army}`);
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
      if (typeof unit.name !== 'string' || unit.name.trim().length === 0) {
        throw new InvalidMatchSetupError('invalid-name', `side ${side} unit ${i} must carry a non-empty name (FR37), got ${JSON.stringify(unit.name)}`);
      }
    });
    // AD-1 (story 4.2): legality is SLOTS, not unit count — runs after the
    // class checks above because slot costs read the class table.
    const total = slotTotal(army as Parameters<typeof slotTotal>[0]);
    if (total !== BALANCE.slotBudget) {
      throw new InvalidMatchSetupError('wrong-slot-total', `side ${side} must fill the slot budget of ${BALANCE.slotBudget}, got a slot total of ${total}`);
    }
  }

  // FR35 (story 4.2): each side's leader is an integer index into its army.
  for (const side of SIDES) {
    const leader = isObject(leaders) ? leaders[side] : undefined;
    const army = (armies as Record<string, unknown>)[side] as unknown[];
    if (!Number.isInteger(leader) || (leader as number) < 0 || (leader as number) >= army.length) {
      throw new InvalidMatchSetupError(
        'invalid-leader',
        `side ${side} leader must be an integer index into its ${army.length}-unit army, got ${String(leader)}`,
      );
    }
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
        throw new InvalidMatchSetupError('out-of-grid', `side ${side} unit ${i} placed outside the grid at '${String(cell.row)}/${String(cell.col)}'`);
      }
      const key = `${cell.row}/${cell.col}`;
      if (seen.has(key)) {
        throw new InvalidMatchSetupError('overlapping-placement', `side ${side} has two units on cell ${key}`);
      }
      seen.add(key);
    });
  }
}
