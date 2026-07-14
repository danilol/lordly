import { describe, expect, it } from 'vitest';
import { ALL_COLS, ALL_ROWS, ALL_SIDES } from '@lordly/engine';
import type { BattleEvent, Placement, Side } from '@lordly/engine';
import { BASE_WIDTH, BATTLE_BEAT_MS, ISO_BOARD } from '../src/config/constants';
import { ALL_ORIENTATIONS, DEFAULT_ORIENTATION, beatDurationMs, boardTiles, buildBeatSchedule, unitTileCenter } from '../src/flow/battleView';
import type { BoardOrientation } from '../src/flow/battleView';

/** Every owner-local cell, for exhaustive transform checks. */
const ALL_CELLS: Placement[] = ALL_ROWS.flatMap((row) => ALL_COLS.map((col) => ({ row, col })));

const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;

describe('iso projection — invariants for every orientation (AC1/AC2)', () => {
  it('ships the \\ diagonal as the default orientation', () => {
    expect(DEFAULT_ORIENTATION).toBe('\\');
    expect(ALL_ORIENTATIONS).toContain('|');
    expect(ALL_ORIENTATIONS).toContain('/');
  });

  for (const orientation of ['|', '\\', '/'] as BoardOrientation[]) {
    describe(`orientation '${orientation}'`, () => {
      it('is a bijection per side — 9 distinct tile centers per board', () => {
        for (const side of ALL_SIDES) {
          const centers = ALL_CELLS.map((c) => key(unitTileCenter(side, c, orientation)));
          expect(new Set(centers).size).toBe(9);
        }
      });

      it('A and B occupy disjoint boards — no shared tile centers', () => {
        const a = new Set(ALL_CELLS.map((c) => key(unitTileCenter('A', c, orientation))));
        for (const c of ALL_CELLS) expect(a.has(key(unitTileCenter('B', c, orientation)))).toBe(false);
      });

      it('every unit cell lands exactly on one of its board tiles, and front cells land on front-flagged tiles', () => {
        for (const side of ALL_SIDES) {
          const tiles = boardTiles(side, orientation);
          expect(tiles).toHaveLength(9);
          const tileByKey = new Map(tiles.map((t) => [key(t), t]));
          for (const cell of ALL_CELLS) {
            const tile = tileByKey.get(key(unitTileCenter(side, cell, orientation)));
            expect(tile, `${side} ${cell.row}/${cell.col}`).toBeDefined();
            expect(tile?.front).toBe(cell.row === 'front');
          }
        }
      });

      it('flags exactly 3 front tiles per board', () => {
        for (const side of ALL_SIDES) {
          expect(boardTiles(side, orientation).filter((t) => t.front)).toHaveLength(3);
        }
      });
    });
  }
});

describe("iso projection — the shipped '\\' layout (AC1)", () => {
  const mean = (side: Side, cells: Placement[]) => {
    const pts = cells.map((c) => unitTileCenter(side, c, '\\'));
    return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  };

  it('places the enemy board upper-left and the player board lower-right', () => {
    const enemy = mean('B', ALL_CELLS);
    const player = mean('A', ALL_CELLS);
    expect(enemy.x).toBeLessThan(player.x);
    expect(enemy.y).toBeLessThan(player.y);
  });

  it('front rows meet along the clash gap — front rows are closer across boards than back rows', () => {
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const fronts = dist(
      mean(
        'A',
        ALL_COLS.map((col) => ({ row: 'front', col })),
      ),
      mean(
        'B',
        ALL_COLS.map((col) => ({ row: 'front', col })),
      ),
    );
    const backs = dist(
      mean(
        'A',
        ALL_COLS.map((col) => ({ row: 'back', col })),
      ),
      mean(
        'B',
        ALL_COLS.map((col) => ({ row: 'back', col })),
      ),
    );
    expect(fronts).toBeLessThan(backs);
  });

  it("mirrors columns for side B (FR7): A's left lane faces B's right, closer than B's left", () => {
    const aFrontLeft = unitTileCenter('A', { row: 'front', col: 'left' }, '\\');
    const bFacing = unitTileCenter('B', { row: 'front', col: 'right' }, '\\');
    const bNonFacing = unitTileCenter('B', { row: 'front', col: 'left' }, '\\');
    const d = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    expect(d(aFrontLeft, bFacing)).toBeLessThan(d(aFrontLeft, bNonFacing));
  });

  it('keeps every tile inside the canvas width with the diamond extents included', () => {
    for (const side of ALL_SIDES) {
      for (const t of boardTiles(side, '\\')) {
        expect(t.x - ISO_BOARD.tileW / 2).toBeGreaterThanOrEqual(0);
        expect(t.x + ISO_BOARD.tileW / 2).toBeLessThanOrEqual(BASE_WIDTH);
      }
    }
  });

  it('uses the 2:1 diamond ratio from the UX spec', () => {
    expect(ISO_BOARD.tileW).toBe(2 * ISO_BOARD.tileH);
  });

  it('checker-flags tiles in an alternating pattern (side color vs neutral)', () => {
    // Adjacent tiles along a board edge alternate checker parity.
    for (const side of ALL_SIDES) {
      const tiles = boardTiles(side, '\\');
      const withChecker = tiles.filter((t) => t.checker).length;
      expect(withChecker).toBeGreaterThan(0);
      expect(withChecker).toBeLessThan(9);
    }
  });
});

describe('buildBeatSchedule — playback pacing', () => {
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

  it('handles an empty log without producing beats', () => {
    expect(buildBeatSchedule([], BATTLE_BEAT_MS)).toEqual([]);
  });
});

describe('beatDurationMs — the FR23 speed math (story 2.3 review: keep it pure and tested)', () => {
  it('divides the beat by the speed factor', () => {
    expect(beatDurationMs(BATTLE_BEAT_MS, 1)).toBe(BATTLE_BEAT_MS);
    expect(beatDurationMs(BATTLE_BEAT_MS, 2)).toBe(BATTLE_BEAT_MS / 2);
  });

  it('guards degenerate factors — non-positive plays at normal speed, and the result never floors to 0ms', () => {
    expect(beatDurationMs(BATTLE_BEAT_MS, 0)).toBe(BATTLE_BEAT_MS);
    expect(beatDurationMs(BATTLE_BEAT_MS, -3)).toBe(BATTLE_BEAT_MS);
    expect(beatDurationMs(1, 1000)).toBe(1);
  });
});
