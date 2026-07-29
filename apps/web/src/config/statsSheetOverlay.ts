import { GameObjects, Scene } from 'phaser';
import { CLASS_ABBREVIATIONS, CLASS_DISPLAY_NAME, MIN_FONT_PX, PALETTE, STATS_CARD, STATS_SHEET_ROWS } from './constants';
import { crispText } from './ui';
import { UNITS_SHEET_KEY, UNIT_FRAMES } from './sprites';
import { addModalSheet, SHEET_CONTENT_DEPTH } from './modalSheet';
import { clampStat } from '../flow/battleStats';
import type { UnitStats } from '../flow/battleStats';

/**
 * The per-unit battle-stats sheet (story 5.7 — long-press a Result comp chip,
 * learn what that soldier actually did). Second consumer of the shared
 * modal-sheet shell (config/modalSheet.ts — the armed close handshake lives
 * there); content is the `UnitStats` row the pure fold produced, laid out per
 * STATS_SHEET_ROWS so a new counter is a compile error in constants, not a
 * silently missing line here. The portrait is the RAW frame at a fixed 40
 * (the 5.6 lesson: loom is board presence, and a loomed monster would burst
 * the header).
 */
export function buildStatsSheetOverlay(scene: Scene, unit: UnitStats, requestClose: () => void): GameObjects.GameObject[] {
  const K = STATS_CARD;
  const objs: GameObjects.GameObject[] = [...addModalSheet(scene, K, requestClose)];
  const left = K.x + K.pad;
  const sideColor = unit.side === 'A' ? PALETTE.playerText : PALETTE.enemyText;

  // Header: sprite · soldier name (side-colored — whose soldier is part of the read) · class.
  objs.push(
    scene.add
      .sprite(left + 20, K.y + K.pad + 20, UNITS_SHEET_KEY, UNIT_FRAMES[unit.class])
      .setDisplaySize(40, 40)
      .setDepth(SHEET_CONTENT_DEPTH),
  );
  objs.push(
    crispText(scene, left + 48, K.y + K.pad + 10, unit.name, { fontFamily: 'Arial Black', fontSize: `${K.nameFontPx}px`, color: sideColor })
      .setOrigin(0, 0.5)
      .setDepth(SHEET_CONTENT_DEPTH),
  );
  objs.push(
    crispText(scene, left + 48, K.y + K.pad + 30, `${CLASS_DISPLAY_NAME[unit.class]} · ${CLASS_ABBREVIATIONS[unit.class]}`, {
      fontFamily: 'Arial',
      fontSize: `${MIN_FONT_PX}px`,
      color: PALETTE.mutedText,
    })
      .setOrigin(0, 0.5)
      .setDepth(SHEET_CONTENT_DEPTH),
  );

  // The counter table: label left, value right-aligned — every SideTotals
  // counter surfaced exactly once (completeness pinned in tests).
  const rowsTop = K.y + K.pad + K.headerH;
  STATS_SHEET_ROWS.forEach(([label, key], i) => {
    const y = rowsTop + i * K.rowH + K.rowH / 2;
    objs.push(
      crispText(scene, left, y, label, { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.mutedText })
        .setOrigin(0, 0.5)
        .setDepth(SHEET_CONTENT_DEPTH),
    );
    objs.push(
      crispText(scene, K.x + K.w - K.pad, y, clampStat(unit[key]), { fontFamily: 'Arial Black', fontSize: `${K.valueFontPx}px`, color: PALETTE.buttonText })
        .setOrigin(1, 0.5)
        .setDepth(SHEET_CONTENT_DEPTH),
    );
  });

  return objs;
}
