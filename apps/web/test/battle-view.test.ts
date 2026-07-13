import { describe, expect, it } from 'vitest';
import { ALL_COLS, ALL_ROWS, ALL_SIDES } from '@lordly/engine';
import type { BattleEvent, Placement } from '@lordly/engine';
import { BATTLE_BEAT_MS, BATTLE_FAST_FORWARD } from '../src/config/constants';
import {
  buildBeatSchedule,
  fastForwardMs,
  screenCellCenter,
  toScreenCell,
} from '../src/flow/battleView';

/** Every owner-local cell, for exhaustive transform checks. */
const ALL_CELLS: Placement[] = ALL_ROWS.flatMap((row) => ALL_COLS.map((col) => ({ row, col })));

describe('toScreenCell — AD-11 lane mirroring', () => {
  it('stacks side B on top (rows 0..2) and side A on the bottom (rows 3..5)', () => {
    for (const cell of ALL_CELLS) {
      expect(toScreenCell('B', cell).screenRow).toBeLessThanOrEqual(2);
      expect(toScreenCell('A', cell).screenRow).toBeGreaterThanOrEqual(3);
    }
  });

  it('puts the two FRONT rows adjacent in the middle (B.front row 2, A.front row 3)', () => {
    expect(toScreenCell('B', { row: 'front', col: 'center' }).screenRow).toBe(2);
    expect(toScreenCell('A', { row: 'front', col: 'center' }).screenRow).toBe(3);
  });

  it("mirrors columns for side B (your left faces the enemy's right — FR7) but not for A", () => {
    // Side A: own col index preserved.
    expect(toScreenCell('A', { row: 'front', col: 'left' }).screenCol).toBe(0);
    expect(toScreenCell('A', { row: 'front', col: 'right' }).screenCol).toBe(2);
    // Side B: col index mirrored (left→2, right→0), so A.left shares a lane with B.right.
    expect(toScreenCell('B', { row: 'front', col: 'left' }).screenCol).toBe(2);
    expect(toScreenCell('B', { row: 'front', col: 'right' }).screenCol).toBe(0);
  });

  it('is a bijection per side — 9 distinct screen cells, one per owner-local cell', () => {
    for (const side of ALL_SIDES) {
      const keys = ALL_CELLS.map((c) => {
        const s = toScreenCell(side, c);
        return `${s.screenRow},${s.screenCol}`;
      });
      expect(new Set(keys).size).toBe(9);
    }
  });

  it('A and B never collide — the two armies occupy disjoint screen cells', () => {
    const aKeys = new Set(ALL_CELLS.map((c) => JSON.stringify(toScreenCell('A', c))));
    const bKeys = ALL_CELLS.map((c) => JSON.stringify(toScreenCell('B', c)));
    for (const k of bKeys) expect(aKeys.has(k)).toBe(false);
  });
});

describe('screenCellCenter — pixel projection', () => {
  it('is a pure function of the cell (same cell → same point)', () => {
    const cell = toScreenCell('A', { row: 'front', col: 'center' });
    expect(screenCellCenter(cell)).toEqual(screenCellCenter(cell));
  });

  it('lays rows out top→bottom and columns left→right (monotonic)', () => {
    const top = screenCellCenter({ screenRow: 0, screenCol: 1 });
    const bottom = screenCellCenter({ screenRow: 5, screenCol: 1 });
    expect(bottom.y).toBeGreaterThan(top.y);
    const leftCol = screenCellCenter({ screenRow: 3, screenCol: 0 });
    const rightCol = screenCellCenter({ screenRow: 3, screenCol: 2 });
    expect(rightCol.x).toBeGreaterThan(leftCol.x);
  });

  it('opens the mid-gap: A.front (row 3) sits farther below B.front (row 2) than one cell step', () => {
    const bFront = screenCellCenter({ screenRow: 2, screenCol: 1 });
    const aFront = screenCellCenter({ screenRow: 3, screenCol: 1 });
    const bMid = screenCellCenter({ screenRow: 1, screenCol: 1 });
    const bFrontAgain = screenCellCenter({ screenRow: 2, screenCol: 1 });
    const normalStep = bFront.y - bMid.y; // a plain row step (no gap)
    const frontStep = aFront.y - bFrontAgain.y; // crosses the mid-gap
    expect(frontStep).toBeGreaterThan(normalStep);
  });
});

describe('buildBeatSchedule / fastForwardMs — playback pacing (AC2)', () => {
  const events: BattleEvent[] = [
    { type: 'BattleStarted', units: [] },
    { type: 'PassStarted', pass: 1 },
    { type: 'BattleEnded', winner: 'A', hpPct: { A: 100, B: 0 } },
  ];

  it('produces one beat per event, order preserved 1:1', () => {
    const beats = buildBeatSchedule(events, BATTLE_BEAT_MS);
    expect(beats.map((b) => b.event.type)).toEqual(['BattleStarted', 'PassStarted', 'BattleEnded']);
    expect(beats.map((b) => b.index)).toEqual([0, 1, 2]);
  });

  it('schedules beats back-to-back at the beat duration', () => {
    const beats = buildBeatSchedule(events, BATTLE_BEAT_MS);
    expect(beats[0]?.atMs).toBe(0);
    expect(beats[1]?.atMs).toBe(BATTLE_BEAT_MS);
    expect(beats[2]?.atMs).toBe(2 * BATTLE_BEAT_MS);
    expect(beats.every((b) => b.durationMs === BATTLE_BEAT_MS)).toBe(true);
  });

  it('fast-forward shortens the beat by the configured factor', () => {
    expect(fastForwardMs(BATTLE_BEAT_MS)).toBe(Math.round(BATTLE_BEAT_MS / BATTLE_FAST_FORWARD));
    expect(fastForwardMs(BATTLE_BEAT_MS)).toBeLessThan(BATTLE_BEAT_MS);
  });

  it('handles an empty log without producing beats', () => {
    expect(buildBeatSchedule([], BATTLE_BEAT_MS)).toEqual([]);
  });
});
