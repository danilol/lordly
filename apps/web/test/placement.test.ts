import { describe, expect, it } from 'vitest';
import type { Placement } from '@lordly/engine';
import { placeUnit, placedCount, sameCell } from '../src/flow/placement';

const FRONT_C: Placement = { row: 'front', col: 'center' };
const BACK_L: Placement = { row: 'back', col: 'left' };
const BACK_R: Placement = { row: 'back', col: 'right' };

describe('placement grid model (FR4, AD-11)', () => {
  it('sameCell compares by row AND col', () => {
    expect(sameCell(FRONT_C, { row: 'front', col: 'center' })).toBe(true);
    expect(sameCell(FRONT_C, { row: 'front', col: 'left' })).toBe(false);
    expect(sameCell(FRONT_C, null)).toBe(false);
  });

  it('places a tray unit onto an empty cell (move, no occupant)', () => {
    const before: (Placement | null)[] = [null, null, null];
    const after = placeUnit(before, 0, FRONT_C);
    expect(after[0]).toEqual(FRONT_C);
    expect(after[1]).toBeNull();
    expect(before[0]).toBeNull(); // input not mutated (returns a fresh board)
  });

  it('moves a placed unit to another EMPTY cell, freeing its old cell', () => {
    const before: (Placement | null)[] = [FRONT_C, null, null];
    const after = placeUnit(before, 0, BACK_L);
    expect(after[0]).toEqual(BACK_L);
  });

  it('SWAPS when the target cell is occupied by another unit', () => {
    const before: (Placement | null)[] = [FRONT_C, BACK_L, null];
    const after = placeUnit(before, 0, BACK_L); // unit 0 → BACK_L (held by unit 1)
    expect(after[0]).toEqual(BACK_L);
    expect(after[1]).toEqual(FRONT_C); // unit 1 takes unit 0's old cell
  });

  it('SWAP from the tray sends the displaced unit to the tray', () => {
    const before: (Placement | null)[] = [null, BACK_L, null]; // unit 0 in tray, unit 1 on BACK_L
    const after = placeUnit(before, 0, BACK_L); // unit 0 (tray) → BACK_L
    expect(after[0]).toEqual(BACK_L);
    expect(after[1]).toBeNull(); // displaced unit 1 returns to the tray (unit 0's prior "cell" = null)
  });

  it('placing a unit onto its OWN current cell is a no-op (idempotent, no self-swap loss)', () => {
    const before: (Placement | null)[] = [FRONT_C, BACK_L, null];
    const after = placeUnit(before, 0, FRONT_C);
    expect(after).toEqual(before);
  });

  it('never produces an illegal board: at most one unit per cell after any drop', () => {
    let board: (Placement | null)[] = [null, null, null];
    board = placeUnit(board, 0, FRONT_C);
    board = placeUnit(board, 1, BACK_L);
    board = placeUnit(board, 2, BACK_R);
    board = placeUnit(board, 2, FRONT_C); // swap 2 with 0
    const occupied = board.filter((c): c is Placement => c !== null).map((c) => `${c.row}/${c.col}`);
    expect(new Set(occupied).size).toBe(occupied.length); // all distinct
    expect(placedCount(board)).toBe(3);
  });

  it('placedCount counts only non-null cells', () => {
    expect(placedCount([FRONT_C, null, BACK_L])).toBe(2);
    expect(placedCount([null, null, null])).toBe(0);
  });
});
