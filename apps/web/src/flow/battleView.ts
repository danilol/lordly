import { ALL_COLS, ALL_ROWS } from '@lordly/engine';
import type { BattleEvent, Placement, Side } from '@lordly/engine';
import { BASE_WIDTH, BATTLE_BOARD, BATTLE_FAST_FORWARD } from '../config/constants';

/**
 * Pure, Phaser-free, DOM-free presentation helpers for the Reveal/Battle
 * scenes (mirrors the story-1.8 pattern of `placement.ts`/`draftModel.ts`:
 * the tested correctness lives here, the scenes are thin renderers). Nothing
 * in this module evaluates a combat rule (AD-2) — it only maps engine data to
 * screen geometry and paces the replay.
 */

/** A cell on the shared battle board: `screenRow` 0..5 top→bottom, `screenCol` 0..2 left→right. */
export interface ScreenCell {
  screenRow: number;
  screenCol: number;
}

/**
 * Owner-local placement → shared-screen cell — the AD-11 lane-mirroring
 * transform, confined to presentation and first needed here. Both armies share
 * one board: side B (enemy) occupies the top three rows facing DOWN, side A
 * (player) the bottom three facing UP, so the two `front` rows meet in the
 * middle. Columns mirror for B ("your left column faces the enemy's right,
 * rendered as one straight lane" — FR7): own col `i` faces enemy col `2 − i`.
 *
 * Layout, top→bottom: B.back, B.mid, B.front | A.front, A.mid, A.back.
 */
export function toScreenCell(side: Side, placement: Placement): ScreenCell {
  const rowIndex = ALL_ROWS.indexOf(placement.row); // front=0, mid=1, back=2
  const colIndex = ALL_COLS.indexOf(placement.col); // left=0, center=1, right=2
  if (side === 'A') {
    // Bottom half: front (nearest the middle) is row 3, back is row 5.
    return { screenRow: 3 + rowIndex, screenCol: colIndex };
  }
  // Top half, facing down and column-mirrored: B.front is row 2, B.back is row 0.
  return { screenRow: 2 - rowIndex, screenCol: 2 - colIndex };
}

/**
 * Screen cell → pixel center, using the single `BATTLE_BOARD` geometry so the
 * Reveal and Battle scenes position identically. Pure (depends only on
 * constants). The `midGap` opens a lane between the two facing front rows.
 */
export function screenCellCenter(cell: ScreenCell): { x: number; y: number } {
  const { cell: size, gap, top, midGap } = BATTLE_BOARD;
  const boardWidth = 3 * size + 2 * gap;
  const left = (BASE_WIDTH - boardWidth) / 2;
  const x = left + cell.screenCol * (size + gap) + size / 2;
  // Rows 0..2 (side B) sit above the gap; rows 3..5 (side A) are pushed down by it.
  const midOffset = cell.screenRow >= 3 ? midGap : 0;
  const y = top + cell.screenRow * (size + gap) + midOffset + size / 2;
  return { x, y };
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

/** The fast-forwarded per-beat duration for press-and-hold ×BATTLE_FAST_FORWARD (AC2). */
export function fastForwardMs(beatMs: number): number {
  return Math.round(beatMs / BATTLE_FAST_FORWARD);
}
