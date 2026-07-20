import { ALL_CLASSES, ALL_COLS, ALL_ROWS, BALANCE, canPlace, footprintCells, legalAnchors } from '@lordly/engine';
import type { Placement, UnitClass } from '@lordly/engine';

/** Any small class — used only to probe cell legality; footprint shape is identical (1 cell) for every small. */
const A_SMALL_CLASS = ALL_CLASSES.find((c) => BALANCE.classes[c].sizeClass === 'small') as UnitClass;

/**
 * The PURE 3×3 placement grid model (FR4) — the testable heart of the
 * Placement scene. A board is `(Placement | null)[]` parallel to the
 * player's army by index: entry `i` is unit `i`'s owner-local cell (AD-11),
 * or `null` when the unit is still in the tray. EVERY unit — small or
 * monster — occupies exactly ONE cell (story 4.8 device revision: a monster
 * is a single tile that reserves its 8 king-move neighbors at placement, not
 * a two-cell body). Every function returns a FRESH board and preserves the
 * legality invariant (no two units share a cell, no unit sits beside a
 * monster). Phaser-free — the scene renders this, it does not own placement
 * logic.
 */

/** True when two cells are the same grid square (or both describe "no cell"). */
export function sameCell(a: Placement | null, b: Placement | null): boolean {
  if (a === null || b === null) return false;
  return a.row === b.row && a.col === b.col;
}

/**
 * Identity passthrough — a unit's cell IS its cell (story 4.8 device
 * revision: a monster is a single-cell unit, no derived anchor). Kept only
 * so call sites written during the earlier 2-cell design don't have to
 * change; safe to inline away.
 */
export function toAnchor(_cls: UnitClass, cell: Placement): Placement {
  return cell;
}

/** How many units are placed on the grid (non-null cells) — drives submit gating (AC4). */
export function placedCount(board: readonly (Placement | null)[]): number {
  return board.filter((cell) => cell !== null).length;
}

/**
 * Every cell occupied by a placed unit (one cell per unit) — the scene uses
 * this to distinguish an occupied cell from a merely `bannedCells`-reserved
 * neighbor when rendering.
 */
export function occupiedCells(board: readonly (Placement | null)[], classes: readonly UnitClass[]): Set<string> {
  const cells = new Set<string>();
  board.forEach((cell, i) => {
    if (cell === null) return;
    const cls = classes[i] as UnitClass;
    for (const fc of footprintCells(cls, toAnchor(cls, cell))) cells.add(`${fc.row}/${fc.col}`);
  });
  return cells;
}

/**
 * Every EMPTY cell that is currently illegal to drop anything into — banned
 * by adjacency to a monster's footprint, not occupied by one (device-
 * reported: these looked like ordinary open cells, indistinguishable from a
 * genuinely free one, so a rejected drop read as an "unseen" reason instead
 * of a visible rule — e.g. two Golems anchored mid-left/mid-right both ban
 * mid/center AND back/center for anyone, but neither cell shows anything
 * today). Derived from the engine's own `legalAnchors` for a placeholder
 * small (any small class — footprint shape is uniform) rather than
 * re-deriving the adjacency math a second time (AD-14): a cell is banned iff
 * it is not already occupied and a small could not legally go there.
 */
export function bannedCells(board: readonly (Placement | null)[], classes: readonly UnitClass[]): Set<string> {
  const existing = board.reduce<{ class: UnitClass; placement: Placement }[]>((acc, cell, i) => {
    const cls = classes[i] as UnitClass;
    if (cell !== null) acc.push({ class: cls, placement: toAnchor(cls, cell) });
    return acc;
  }, []);
  const occupied = occupiedCells(board, classes);
  const legalForSmall = new Set(legalAnchors(A_SMALL_CLASS, existing).map((c) => `${c.row}/${c.col}`));
  const banned = new Set<string>();
  for (const row of ALL_ROWS) {
    for (const col of ALL_COLS) {
      const key = `${row}/${col}`;
      if (!occupied.has(key) && !legalForSmall.has(key)) banned.add(key);
    }
  }
  return banned;
}

/**
 * Drops the unit at `unitIndex` onto `target` (FR4) — `target` becomes the
 * unit's new DISPLAY cell verbatim on success (device-reported: dropping a
 * Golem on the back row must show it in the back row, not silently move it
 * to mid — only the engine-facing ANCHOR reads differently, via `toAnchor`,
 * never the board). Legality is checked via the engine's `canPlace` against
 * every OTHER currently-placed unit's ANCHOR-derived footprint (AD-14: the
 * SAME predicate `validateMatchSetup` uses, so this model never accepts a
 * drop the engine would reject) — if legal, the unit simply moves there and
 * its old cell frees. The one exception is the classic SWAP: dropping a
 * SMALL directly onto another SMALL's cell exchanges them (both are
 * single-cell footprints, so this can never produce an illegal board). Any
 * other collision — onto a monster's cell (display or its other footprint
 * cell), a monster onto an occupied cell, two monsters left closer than one
 * free column apart — is REJECTED: the SAME board reference is returned
 * unchanged, so a caller can detect a no-op via `===` and surface "you can't
 * place it there" instead of silently corrupting the board (device-reported:
 * this used to swap/overlap blindly and only fail much later, uncaught, when
 * the match tried to start).
 */
export function placeUnit(board: readonly (Placement | null)[], classes: readonly UnitClass[], unitIndex: number, target: Placement): (Placement | null)[] {
  const cls = classes[unitIndex] as UnitClass;
  const prev = board[unitIndex] ?? null;
  if (sameCell(prev, target)) return [...board];

  const others = board.reduce<{ class: UnitClass; placement: Placement }[]>((acc, cell, i) => {
    if (i !== unitIndex && cell !== null) acc.push({ class: classes[i] as UnitClass, placement: toAnchor(classes[i] as UnitClass, cell) });
    return acc;
  }, []);

  if (canPlace(cls, toAnchor(cls, target), others)) {
    const next = [...board];
    next[unitIndex] = { ...target };
    return next;
  }

  // Only exception to a rejection: a clean small-for-small swap at the exact
  // display cell — `canPlace` reports false here purely because that ONE
  // cell is already taken by the occupant, not because of any real footprint
  // rule. (`cls` is a small whenever this branch is reachable — its display
  // cell IS its anchor, so `toAnchor` above was already a no-op.)
  const occupantIndex = board.findIndex((cell, i) => i !== unitIndex && sameCell(cell, target));
  const bothSmall =
    occupantIndex !== -1 && BALANCE.classes[cls].sizeClass === 'small' && BALANCE.classes[classes[occupantIndex] as UnitClass].sizeClass === 'small';
  if (!bothSmall) return board as (Placement | null)[]; // rejected — unchanged reference

  const next = [...board];
  next[unitIndex] = { ...target };
  next[occupantIndex] = prev;
  return next;
}

/** Returns the unit at `unitIndex` to the tray (its cell → `null`); a no-op if already there. Fresh board. */
export function unplaceUnit(board: readonly (Placement | null)[], unitIndex: number): (Placement | null)[] {
  const next = [...board];
  next[unitIndex] = null;
  return next;
}

/**
 * Per-row action counts for a class (FR39c, story 4.11) — the informed-placement
 * read: "Mage: back row 2×, front row 1×". A straight projection of
 * `BALANCE.classes[cls].actions` (AD-2's static-facts channel, AD-4 one
 * source) — the seam exists so the Placement scene renders a tested fact
 * instead of reaching into balance data itself.
 */
export function rowActionCounts(cls: UnitClass): { front: number; mid: number; back: number } {
  return { ...BALANCE.classes[cls].actions };
}
