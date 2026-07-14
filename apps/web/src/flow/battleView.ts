import { ALL_COLS, ALL_ROWS } from '@lordly/engine';
import type { BattleEvent, Placement, Side } from '@lordly/engine';
import { BASE_WIDTH, BATTLE_FAST_FORWARD, ISO_BOARD } from '../config/constants';

/**
 * Pure, Phaser-free, DOM-free presentation helpers for the Reveal/Battle
 * scenes (the story-1.8 pattern: tested correctness lives here, scenes are
 * thin renderers). Nothing in this module evaluates a combat rule (AD-2) —
 * it only maps engine data to screen geometry and paces the replay.
 *
 * Story 2.2 (ADR-0001): the flat stacked grid became two tilted isometric
 * 3×3 checkerboards. The owner-local→screen mapping is ORIENTATION-AWARE
 * from the start (the cheap seam — a player-facing toggle stays deferred):
 * `'\'` is the shipped, pixel-tuned default (enemy board upper-left, player
 * lower-right, front rows meeting along the diagonal clash gap); `'/'` is
 * its horizontal mirror; `'|'` stacks the boards vertically, untuned.
 */

export const ALL_ORIENTATIONS = ['|', '\\', '/'] as const;
export type BoardOrientation = (typeof ALL_ORIENTATIONS)[number];
export const DEFAULT_ORIENTATION: BoardOrientation = '\\';

/**
 * Owner-local placement → board-local diamond-grid coordinates. In the iso
 * projection below, increasing `r` runs down-LEFT and increasing `c` runs
 * down-RIGHT, so the board's NW edge is `c = 0` and its SE edge is `c = 2`.
 *
 * - Side A (player, lower-right board) fronts its NW edge (toward the enemy):
 *   `c` = row index (front = 0), `r` = column index.
 * - Side B (enemy, upper-left board) fronts its SE edge: `c` = 2 − row index,
 *   and its columns MIRROR (`r` = 2 − col index) so A's left lane faces B's
 *   right across the clash gap (FR7, AD-11). In the diagonal layout, facing
 *   pairs sit gap-OFFSET rather than on one collinear line — matching the UX
 *   mock's corner boards; the "lane" is conceptual, and the tests pin the
 *   facing pair as each unit's nearest cross-board front tile.
 */
function projection(side: Side, placement: Placement): { r: number; c: number } {
  const rowIndex = ALL_ROWS.indexOf(placement.row); // front=0, mid=1, back=2
  const colIndex = ALL_COLS.indexOf(placement.col); // left=0, center=1, right=2
  if (side === 'A') return { r: colIndex, c: rowIndex };
  return { r: 2 - colIndex, c: 2 - rowIndex };
}

/** The board origin (its top-corner tile center) for a side under an orientation. */
function frame(side: Side, orientation: BoardOrientation): { ox: number; oy: number } {
  if (orientation === '|') return side === 'A' ? ISO_BOARD.stackedPlayer : ISO_BOARD.stackedEnemy;
  // '\' and '/' share origins; '/' mirrors the final x instead.
  return side === 'A' ? ISO_BOARD.player : ISO_BOARD.enemy;
}

/**
 * Owner-local cell → its tile's pixel center. Standard iso math: from the
 * board origin, `x` steps ±tileW/2 with (c − r) and `y` steps +tileH/2 with
 * (c + r), producing the 2:1 diamond grid.
 */
export function unitTileCenter(side: Side, placement: Placement, orientation: BoardOrientation = DEFAULT_ORIENTATION): { x: number; y: number } {
  const { r, c } = projection(side, placement);
  const { ox, oy } = frame(side, orientation);
  const x = ox + (c - r) * (ISO_BOARD.tileW / 2);
  const y = oy + (c + r) * (ISO_BOARD.tileH / 2);
  return { x: orientation === '/' ? BASE_WIDTH - x : x, y };
}

/** One renderable board tile: pixel center, front-row flag, and checker parity (side color vs neutral fill). */
export interface BoardTile {
  x: number;
  y: number;
  front: boolean;
  checker: boolean;
}

/** All 9 tiles of one side's board, aligned 1:1 with `unitTileCenter` so units always stand exactly on a tile. */
export function boardTiles(side: Side, orientation: BoardOrientation = DEFAULT_ORIENTATION): BoardTile[] {
  return ALL_ROWS.flatMap((row) =>
    ALL_COLS.map((col) => {
      const placement = { row, col };
      const { r, c } = projection(side, placement);
      const { x, y } = unitTileCenter(side, placement, orientation);
      return { x, y, front: row === 'front', checker: (r + c) % 2 === 0 };
    }),
  );
}

/** One playback beat: its source event plus when it fires and for how long. */
export interface Beat {
  index: number;
  event: BattleEvent;
  atMs: number;
  durationMs: number;
}

/**
 * Turns the log's ordered events into a beat schedule — one beat per event,
 * order preserved 1:1 (AD-2: the scene never reorders or re-derives), each
 * event held for `beatMs` and starting where the previous one ended. This is
 * the whole pacing contract; press-and-hold fast-forward just shortens the
 * per-beat duration at play time (see `fastForwardMs`).
 */
export function buildBeatSchedule(events: readonly BattleEvent[], beatMs: number): Beat[] {
  return events.map((event, index) => ({
    index,
    event,
    atMs: index * beatMs,
    durationMs: beatMs,
  }));
}

/** The fast-forwarded per-beat duration for press-and-hold ×BATTLE_FAST_FORWARD (interim until FR23 / story 2.3). */
export function fastForwardMs(beatMs: number): number {
  return Math.round(beatMs / BATTLE_FAST_FORWARD);
}
