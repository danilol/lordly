import type { Placement } from '@lordly/engine';

/**
 * The PURE 3×3 placement grid model (FR4) — the testable heart of the
 * Placement scene. A board is `(Placement | null)[]` parallel to the
 * player's army by index: entry `i` is unit `i`'s owner-local cell (AD-11),
 * or `null` when the unit is still in the tray. Every function returns a
 * FRESH board and preserves the legality invariant: no two units ever share
 * a cell. Phaser-free — the scene renders this, it does not own placement
 * logic.
 */

/** True when two cells are the same grid square (or both describe "no cell"). */
export function sameCell(a: Placement | null, b: Placement | null): boolean {
  if (a === null || b === null) return false;
  return a.row === b.row && a.col === b.col;
}

/** How many units are placed on the grid (non-null cells) — drives submit gating (AC4). */
export function placedCount(board: readonly (Placement | null)[]): number {
  return board.filter((cell) => cell !== null).length;
}

/**
 * Drops the unit at `unitIndex` onto `target` (FR4). If another unit already
 * holds `target`, the two SWAP (the displaced unit inherits `unitIndex`'s
 * prior cell, which may be the tray → `null`); otherwise the unit simply
 * moves and its old cell frees. Dropping a unit on its own current cell is a
 * no-op. The result is always a legal board (≤ 1 unit per cell).
 */
export function placeUnit(board: readonly (Placement | null)[], unitIndex: number, target: Placement): (Placement | null)[] {
  const prev = board[unitIndex] ?? null;
  if (sameCell(prev, target)) return [...board];

  const next = [...board];
  const occupant = next.findIndex((cell, i) => i !== unitIndex && sameCell(cell, target));
  next[unitIndex] = { ...target };
  if (occupant !== -1) next[occupant] = prev; // swap: displaced unit takes our old cell (or the tray)
  return next;
}
