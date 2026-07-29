import { GameObjects, Scene } from 'phaser';
import { MIN_FONT_PX, PALETTE, SUMMARY_CARD, SUMMARY_HINT, SUMMARY_TITLE } from './constants';
import { crispText } from './ui';
import { UNITS_SHEET_KEY, UNIT_FRAMES } from './sprites';
import { addModalSheet, SHEET_CONTENT_DEPTH } from './modalSheet';
import { clampStat, statsBarMax, statsStripLine } from '../flow/battleStats';
import type { BattleStats } from '../flow/battleStats';

/**
 * The battle-summary sheet (story 5.7, device round 2 — Danilo's LoL-history
 * read: "bars for the damage dealt/taken", behind an OPTIONAL click). Third
 * consumer of the shared modal shell. Content: the two side-total lines (the
 * ▲▼ strip format — it moved here from the always-on Result strip), then one
 * bar row per unit in roster order (your side first): sprite avatar, a
 * side-colored DEALT bar over a thin neutral TAKEN bar — both on ONE shared
 * scale (`statsBarMax`) so lengths compare across units, sides, and metrics
 * — with the dealt value at the bar's end. Bars are plain rectangles: no
 * chart library, the dataviz is three fills per row. A footer hint points at
 * the existing per-unit drill-down (hold a chip).
 */
export function buildSummarySheetOverlay(scene: Scene, stats: BattleStats, requestClose: () => void): GameObjects.GameObject[] {
  const K = SUMMARY_CARD;
  const objs: GameObjects.GameObject[] = [...addModalSheet(scene, K, requestClose)];
  const left = K.x + K.pad;

  objs.push(
    crispText(scene, left, K.y + K.pad + 10, SUMMARY_TITLE, { fontFamily: 'Arial Black', fontSize: `${K.titleFontPx}px`, color: PALETTE.title })
      .setOrigin(0, 0.5)
      .setDepth(SHEET_CONTENT_DEPTH),
  );

  // The side totals — the compact ▲dealt ▼taken lines, side-colored.
  const totalsTop = K.y + K.pad + K.titleH;
  (['A', 'B'] as const).forEach((side, i) => {
    objs.push(
      crispText(scene, left, totalsTop + i * K.totalsLineH + K.totalsLineH / 2, statsStripLine(stats.totals[side]), {
        fontFamily: 'Courier',
        fontSize: `${MIN_FONT_PX}px`,
        fontStyle: '800',
        color: side === 'A' ? PALETTE.playerText : PALETTE.enemyText,
      })
        .setOrigin(0, 0.5)
        .setDepth(SHEET_CONTENT_DEPTH),
    );
  });

  // The per-unit bars, roster order (yours first — the same order every comp
  // surface renders). One shared scale across dealt AND taken.
  const max = statsBarMax(stats.units);
  const rowsTop = totalsTop + K.totalsH;
  const barLeft = left + K.avatarW + 4;
  const barMaxW = K.w - 2 * K.pad - K.avatarW - 4 - K.valueW;
  stats.units.forEach((unit, i) => {
    const y = rowsTop + i * K.rowH + K.rowH / 2;
    const sideFill = unit.side === 'A' ? PALETTE.playerLine : PALETTE.enemyLine;
    objs.push(
      scene.add
        .sprite(left + K.avatarW / 2, y, UNITS_SHEET_KEY, UNIT_FRAMES[unit.class])
        .setDisplaySize(20, 20)
        .setDepth(SHEET_CONTENT_DEPTH),
    );
    // DEALT: the side-colored primary bar (min 1px so a pacifist still registers as present).
    objs.push(
      scene.add
        .rectangle(barLeft, y - 5, Math.max(1, (unit.dealt / max) * barMaxW), 8, sideFill, 1)
        .setOrigin(0, 0.5)
        .setDepth(SHEET_CONTENT_DEPTH),
    );
    // TAKEN: the thin neutral bar beneath — same scale, deliberately NOT a
    // side colour (damage received has no team pride).
    objs.push(
      scene.add
        .rectangle(barLeft, y + 4, Math.max(1, (unit.taken / max) * barMaxW), 4, PALETTE.cardStroke, 1)
        .setOrigin(0, 0.5)
        .setDepth(SHEET_CONTENT_DEPTH),
    );
    objs.push(
      crispText(scene, K.x + K.w - K.pad, y, clampStat(unit.dealt), { fontFamily: 'Arial Black', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.buttonText })
        .setOrigin(1, 0.5)
        .setDepth(SHEET_CONTENT_DEPTH),
    );
  });

  // The drill-down hint — the full per-unit table lives behind the chip hold.
  objs.push(
    crispText(scene, K.x + K.w / 2, K.y + K.h - K.pad - 6, SUMMARY_HINT, {
      fontFamily: 'Arial',
      fontSize: `${MIN_FONT_PX}px`,
      color: PALETTE.mutedText,
    })
      .setOrigin(0.5)
      .setDepth(SHEET_CONTENT_DEPTH),
  );

  return objs;
}
