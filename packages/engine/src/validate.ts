import { BALANCE, MAX_MONSTERS_PER_ARMY, slotTotal } from './balance';
import { MAX_SEED } from './rng';
import { ALL_CLASSES, ALL_COLS, ALL_ELEMENTS, ALL_ROWS, ALL_TACTICS } from './types';
import type { MatchSetup, Placement, Side, UnitClass } from './types';

/** Discriminant codes for every way a `MatchSetup` can be malformed (AC2, +3 for story 4.8's monster footprint rules). */
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
  | 'overlapping-placement'
  /** A side fields more than 2 monsters (FR1/FR38). */
  | 'too-many-monsters'
  /** ANY unit — human or monster — occupies one of the 8 KING-MOVE neighbors (orthogonal OR diagonal) of a monster's cell (FR4/FR38 — device-reported, confirmed against the source game: "you cannot position other characters next to large characters"). A monster is a single cell that reserves its whole Moore neighborhood — a Golem dead-center blocks the entire rest of the board; two Golems at front-left + front-right leave the back row open. */
  | 'adjacent-to-monster'
  /** A side's leader index names a monster (FR35/FR38 — only a small may be crowned). */
  | 'monster-cannot-lead';

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
    const army = (armies as Record<string, unknown>)[side] as { class: UnitClass }[];
    if (!Number.isInteger(leader) || (leader as number) < 0 || (leader as number) >= army.length) {
      throw new InvalidMatchSetupError(
        'invalid-leader',
        `side ${side} leader must be an integer index into its ${army.length}-unit army, got ${String(leader)}`,
      );
    }
    // A monster cannot be crowned (device-reported, story 4.8 follow-up): the
    // leader-fall sober package (FR35) and the Attack-Leader tactic both
    // read the leader as a single vulnerable unit — a 2-cell wall surviving
    // as its own army's leader defeats the mechanic's intent.
    if (BALANCE.classes[(army[leader as number] as { class: UnitClass }).class].sizeClass === 'monster') {
      throw new InvalidMatchSetupError('monster-cannot-lead', `side ${side} leader (index ${String(leader)}) is a monster — only a small may be crowned`);
    }
  }

  for (const side of SIDES) {
    const cells = (placements as Record<string, unknown>)[side];
    const army = (armies as Record<string, unknown>)[side] as { class: UnitClass }[];
    if (!Array.isArray(cells) || cells.length !== army.length) {
      throw new InvalidMatchSetupError(
        'placements-mismatch',
        `side ${side} placements must parallel its army (${army.length} units, got ${Array.isArray(cells) ? cells.length : typeof cells})`,
      );
    }
    // Structural shape first (object, row/col are grid members) — the shared
    // footprint predicate below assumes well-formed `Placement`s.
    cells.forEach((cell: unknown, i) => {
      if (!isObject(cell)) {
        throw new InvalidMatchSetupError('out-of-grid', `side ${side} unit ${i} placement is not an object (got ${cell === null ? 'null' : typeof cell})`);
      }
      if (!(ALL_ROWS as readonly string[]).includes(cell.row as string) || !(ALL_COLS as readonly string[]).includes(cell.col as string)) {
        throw new InvalidMatchSetupError('out-of-grid', `side ${side} unit ${i} placed outside the grid at '${String(cell.row)}/${String(cell.col)}'`);
      }
    });
    // Placement legality (story 4.8 device revision, AD-14: single-cell
    // monsters, ≤2 monsters, the 8-neighbor king-move reservation, no
    // overlapping cell — small or monster; sharing a COLUMN is legal when the
    // cells aren't adjacent, e.g. front+back) — the SAME predicate
    // `canPlace`/`legalAnchors` call below. One implementation.
    const units = cells.map((cell, i) => ({ class: (army[i] as { class: UnitClass }).class, placement: cell as Placement }));
    const violation = footprintViolation(units);
    if (violation !== undefined) {
      throw new InvalidMatchSetupError(violation.code, footprintViolationMessage(side, units, violation));
    }
  }
}

/** Human-readable message for a `footprintViolation` result — naming the offending side/unit/cell (spine errors convention). */
function footprintViolationMessage(
  side: Side,
  units: readonly { class: UnitClass; placement: Placement }[],
  violation: { code: MatchSetupViolation; index: number; cell?: string },
): string {
  const at = units[violation.index] as { class: UnitClass; placement: Placement };
  switch (violation.code) {
    case 'too-many-monsters':
      return `side ${side} fields more than ${MAX_MONSTERS_PER_ARMY} monsters`;
    case 'adjacent-to-monster':
      return `side ${side} unit ${violation.index} (${at.class}) stands directly beside a monster — no unit may occupy any of a monster's 8 neighboring cells`;
    default: // 'overlapping-placement' — the only other code footprintViolation returns
      return `side ${side} unit ${violation.index} occupies cell ${violation.cell} another unit already occupies`;
  }
}

/** The 8 KING-MOVE neighbors of `cell` — orthogonal AND diagonal — excluding `cell` itself and anything off the grid. */
function adjacentCells(cell: Placement): Placement[] {
  const rowIndex = ALL_ROWS.indexOf(cell.row);
  const colIndex = ALL_COLS.indexOf(cell.col);
  const neighbors: Placement[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const row = ALL_ROWS[rowIndex + dr];
      const col = ALL_COLS[colIndex + dc];
      if (row !== undefined && col !== undefined) neighbors.push({ row, col });
    }
  }
  return neighbors;
}

/**
 * The shared placement-legality CORE (story 4.8 device revision, 2026-07-20):
 * checks one side's full (class, cell) list in placement order — at most 2
 * monsters, no cell claimed twice, and (Danilo's confirmed model, replacing
 * the earlier 2-cell footprint) NO unit of EITHER kind may occupy any of the
 * 8 KING-MOVE neighbors — orthogonal OR diagonal — of a monster's cell. A
 * monster is now a SINGLE-cell unit that reserves its whole Moore
 * neighborhood: a Golem dead-center blocks the entire rest of the board; two
 * Golems at front-left + front-right leave the whole back row open. A monster
 * may anchor ANYWHERE (no more back-row restriction — there is no derived
 * second cell). Returns the FIRST violation found (with the offending unit's
 * index), or `undefined` if legal. `validateMatchSetup` throws it with a
 * message; `canPlace`/`legalAnchors` just check for `undefined` — the SAME
 * predicate, never re-derived (AD-14's "one legality implementation").
 */
function footprintViolation(
  units: readonly { class: UnitClass; placement: Placement }[],
): { code: MatchSetupViolation; index: number; cell?: string } | undefined {
  const seenCells = new Set<string>();
  const monsterBannedCells = new Set<string>(); // the 8 king-move neighbors of every ALREADY-processed monster
  let monsterCount = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i] as { class: UnitClass; placement: Placement };
    const isMonster = BALANCE.classes[u.class].sizeClass === 'monster';

    if (isMonster) {
      monsterCount++;
      if (monsterCount > MAX_MONSTERS_PER_ARMY) return { code: 'too-many-monsters', index: i };
    }

    const cell = u.placement;
    const key = `${cell.row}/${cell.col}`;

    // Do I sit on a cell an earlier monster already reserved?
    if (monsterBannedCells.has(key)) return { code: 'adjacent-to-monster', index: i };
    // If I'M a monster, does any of my 8 neighbors hit a cell someone earlier already occupies?
    if (isMonster) {
      for (const neighbor of adjacentCells(cell)) {
        if (seenCells.has(`${neighbor.row}/${neighbor.col}`)) return { code: 'adjacent-to-monster', index: i };
      }
    }
    // Two units on the exact same cell.
    if (seenCells.has(key)) return { code: 'overlapping-placement', index: i, cell: key };
    seenCells.add(key);

    // Register my own ban zone (all 8 king-move neighbors) for units still to come.
    if (isMonster) {
      for (const neighbor of adjacentCells(cell)) monsterBannedCells.add(`${neighbor.row}/${neighbor.col}`);
    }
  }
  return undefined;
}

/**
 * Whether `cls` may be legally added at `anchor`, given the units already
 * placed on that side (AD-14, FR4/FR38). Shares `footprintViolation` with
 * `validateMatchSetup` — the placement scene's live drag feedback (story 4.9)
 * calls this and never re-implements the column/verticality rules itself.
 */
export function canPlace(cls: UnitClass, anchor: Placement, existing: readonly { class: UnitClass; placement: Placement }[]): boolean {
  return footprintViolation([...existing, { class: cls, placement: anchor }]) === undefined;
}

/**
 * Every anchor at which `cls` may legally be added, given the units already
 * placed (AD-14). A small's legal anchors are every cell not already
 * occupied; a monster's exclude `back` (illegal anchor), any column already
 * holding a monster, and any anchor whose footprint would overlap.
 */
export function legalAnchors(cls: UnitClass, existing: readonly { class: UnitClass; placement: Placement }[]): Placement[] {
  const anchors: Placement[] = [];
  for (const row of ALL_ROWS) {
    for (const col of ALL_COLS) {
      const anchor: Placement = { row, col };
      if (canPlace(cls, anchor, existing)) anchors.push(anchor);
    }
  }
  return anchors;
}
