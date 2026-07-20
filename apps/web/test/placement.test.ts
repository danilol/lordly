import { describe, expect, it } from 'vitest';
import type { Placement, UnitClass } from '@lordly/engine';
import { bannedCells, occupiedCells, placeUnit, placedCount, sameCell, unplaceUnit } from '../src/flow/placement';

const FRONT_C: Placement = { row: 'front', col: 'center' };
const FRONT_L: Placement = { row: 'front', col: 'left' };
const FRONT_R: Placement = { row: 'front', col: 'right' };
const MID_C: Placement = { row: 'mid', col: 'center' };
const BACK_C: Placement = { row: 'back', col: 'center' };
const BACK_L: Placement = { row: 'back', col: 'left' };
const BACK_R: Placement = { row: 'back', col: 'right' };

/** 3 small units (all knights — cost/footprint-irrelevant for these tests). */
const SMALLS: UnitClass[] = ['knight', 'knight', 'knight'];

describe('placement grid model (FR4, AD-11)', () => {
  it('sameCell compares by row AND col', () => {
    expect(sameCell(FRONT_C, { row: 'front', col: 'center' })).toBe(true);
    expect(sameCell(FRONT_C, { row: 'front', col: 'left' })).toBe(false);
    expect(sameCell(FRONT_C, null)).toBe(false);
  });

  it('places a tray unit onto an empty cell (move, no occupant)', () => {
    const before: (Placement | null)[] = [null, null, null];
    const after = placeUnit(before, SMALLS, 0, FRONT_C);
    expect(after[0]).toEqual(FRONT_C);
    expect(after[1]).toBeNull();
    expect(before[0]).toBeNull(); // input not mutated (returns a fresh board)
  });

  it('moves a placed unit to another EMPTY cell, freeing its old cell', () => {
    const before: (Placement | null)[] = [FRONT_C, null, null];
    const after = placeUnit(before, SMALLS, 0, BACK_L);
    expect(after[0]).toEqual(BACK_L);
  });

  it('SWAPS when the target cell is occupied by another SMALL unit', () => {
    const before: (Placement | null)[] = [FRONT_C, BACK_L, null];
    const after = placeUnit(before, SMALLS, 0, BACK_L); // unit 0 → BACK_L (held by unit 1)
    expect(after[0]).toEqual(BACK_L);
    expect(after[1]).toEqual(FRONT_C); // unit 1 takes unit 0's old cell
  });

  it('SWAP from the tray sends the displaced unit to the tray', () => {
    const before: (Placement | null)[] = [null, BACK_L, null]; // unit 0 in tray, unit 1 on BACK_L
    const after = placeUnit(before, SMALLS, 0, BACK_L); // unit 0 (tray) → BACK_L
    expect(after[0]).toEqual(BACK_L);
    expect(after[1]).toBeNull(); // displaced unit 1 returns to the tray (unit 0's prior "cell" = null)
  });

  it('placing a unit onto its OWN current cell is a no-op (idempotent, no self-swap loss)', () => {
    const before: (Placement | null)[] = [FRONT_C, BACK_L, null];
    const after = placeUnit(before, SMALLS, 0, FRONT_C);
    expect(after).toEqual(before);
  });

  it('unplaceUnit returns a placed unit to the tray (double-tap-to-remove); a fresh board, others untouched', () => {
    const before: (Placement | null)[] = [FRONT_C, BACK_L, null];
    const after = unplaceUnit(before, 0);
    expect(after[0]).toBeNull(); // back to the tray
    expect(after[1]).toEqual(BACK_L); // others untouched
    expect(before[0]).toEqual(FRONT_C); // input not mutated
  });

  it('unplaceUnit on a tray unit is a harmless no-op', () => {
    const before: (Placement | null)[] = [null, BACK_L, null];
    expect(unplaceUnit(before, 0)).toEqual(before);
  });

  it('never produces an illegal board: at most one unit per cell after any drop', () => {
    let board: (Placement | null)[] = [null, null, null];
    board = placeUnit(board, SMALLS, 0, FRONT_C);
    board = placeUnit(board, SMALLS, 1, BACK_L);
    board = placeUnit(board, SMALLS, 2, BACK_R);
    board = placeUnit(board, SMALLS, 2, FRONT_C); // swap 2 with 0
    const occupied = board.filter((c): c is Placement => c !== null).map((c) => `${c.row}/${c.col}`);
    expect(new Set(occupied).size).toBe(occupied.length); // all distinct
    expect(placedCount(board)).toBe(3);
  });

  it('placedCount counts only non-null cells', () => {
    expect(placedCount([FRONT_C, null, BACK_L])).toBe(2);
    expect(placedCount([null, null, null])).toBe(0);
  });
});

describe('placement grid model — single-cell monster + king-move block (device revision, 2026-07-20)', () => {
  const classes: UnitClass[] = ['golem', 'knight', 'knight', 'archer'];

  it('a monster occupies exactly ONE cell (occupiedCells) — no derived body cell', () => {
    const board: (Placement | null)[] = [FRONT_C, null, null, null];
    expect(occupiedCells(board, classes)).toEqual(new Set(['front/center']));
  });

  it("rejects dropping a small onto a monster's king-neighbor cell — board unchanged", () => {
    const board: (Placement | null)[] = [FRONT_C, null, null, null]; // golem front/center blocks mid/center (below it)
    const after = placeUnit(board, classes, 1, MID_C); // knight tries a blocked neighbor
    expect(after).toBe(board); // same reference — rejected, not silently accepted
    expect(after[1]).toBeNull();
  });

  it('rejects a SECOND monster king-adjacent to the first', () => {
    const board: (Placement | null)[] = [FRONT_C, null, null, null];
    const twoMonsters: UnitClass[] = ['golem', 'golem', 'knight', 'archer'];
    const after = placeUnit(board, twoMonsters, 1, FRONT_R); // king-adjacent to front/center
    expect(after).toBe(board); // rejected
    expect(after[1]).toBeNull();
  });

  it('accepts a second monster at a non-adjacent cell', () => {
    const board: (Placement | null)[] = [{ row: 'front', col: 'left' }, null, null, null];
    const twoMonsters: UnitClass[] = ['golem', 'golem', 'knight', 'archer'];
    const after = placeUnit(board, twoMonsters, 1, FRONT_R); // 2 columns away — not king-adjacent
    expect(after[1]).toEqual(FRONT_R);
  });

  it('a monster may be placed on the BACK row — it is a single cell, so there is nothing to run off the grid', () => {
    const board: (Placement | null)[] = [null, null, null, null];
    const after = placeUnit(board, classes, 0, BACK_C);
    expect(after[0]).toEqual(BACK_C); // exactly where dropped
    expect(occupiedCells(after, classes)).toEqual(new Set(['back/center'])); // one cell
  });

  it('a monster and a small move around each other freely when there is no adjacency conflict', () => {
    const board: (Placement | null)[] = [FRONT_C, BACK_L, null, null];
    const after = placeUnit(board, classes, 1, BACK_R); // an unrelated free cell (not king-adjacent to front/center)
    expect(after[1]).toEqual(BACK_R);
    expect(after[0]).toEqual(FRONT_C); // golem untouched
  });

  it('rejects a SMALL standing directly beside a monster (orthogonal) — the source-game scenario', () => {
    const board: (Placement | null)[] = [FRONT_C, null, null, null];
    const after = placeUnit(board, classes, 1, FRONT_L); // king-adjacent to front/center
    expect(after).toBe(board);
    expect(after[1]).toBeNull();
  });

  it('rejects a SMALL standing DIAGONALLY beside a monster (king move includes diagonals)', () => {
    const board: (Placement | null)[] = [{ row: 'front', col: 'left' }, null, null, null];
    const after = placeUnit(board, classes, 1, MID_C); // mid/center is diagonal to front/left
    expect(after).toBe(board);
    expect(after[1]).toBeNull();
  });
});

describe('bannedCells — every EMPTY cell a monster reserves via its 8 king-move neighbors (device revision)', () => {
  it('an empty board bans nothing', () => {
    expect(bannedCells([null, null, null, null], ['golem', 'knight', 'knight', 'archer'])).toEqual(new Set());
  });

  it('a Golem at front-center reserves its 5 on-grid king neighbors; the whole back row stays free', () => {
    const board: (Placement | null)[] = [FRONT_C, null, null, null];
    const classes: UnitClass[] = ['golem', 'knight', 'knight', 'archer'];
    const banned = bannedCells(board, classes);
    expect(banned).toEqual(new Set(['front/left', 'front/right', 'mid/left', 'mid/center', 'mid/right']));
    // The Golem's OWN cell is occupied, not banned.
    expect(banned.has('front/center')).toBe(false);
    // Back row entirely free — none of it is king-adjacent to front/center.
    expect(banned.has('back/left')).toBe(false);
    expect(banned.has('back/center')).toBe(false);
    expect(banned.has('back/right')).toBe(false);
  });

  it('a Golem at dead center (mid/center) reserves all 8 other cells — the whole rest of the board', () => {
    const board: (Placement | null)[] = [MID_C, null, null, null];
    const classes: UnitClass[] = ['golem', 'knight', 'knight', 'archer'];
    const banned = bannedCells(board, classes);
    expect(banned).toEqual(new Set(['front/left', 'front/center', 'front/right', 'mid/left', 'mid/right', 'back/left', 'back/center', 'back/right']));
  });

  it('two Golems at mid-left and mid-right leave only front/center free (their king neighbors fill the rest)', () => {
    const board: (Placement | null)[] = [{ row: 'mid', col: 'left' }, { row: 'mid', col: 'right' }, null, null];
    const classes: UnitClass[] = ['golem', 'golem', 'archer', 'archer'];
    const banned = bannedCells(board, classes);
    // mid/left blocks front/left, front/center, mid/center, back/left, back/center;
    // mid/right blocks front/center, front/right, mid/center, back/center, back/right.
    expect(banned).toEqual(new Set(['front/left', 'front/center', 'front/right', 'mid/center', 'back/left', 'back/center', 'back/right']));
  });
});
