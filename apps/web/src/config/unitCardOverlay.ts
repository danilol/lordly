import { GameObjects, Scene } from 'phaser';
import type { Element, UnitClass } from '@lordly/engine';
import { CARD_GLYPHS, CARD_GLYPH_COLORS, MIN_FONT_PX, PALETTE, UNIT_CARD } from './constants';
import { addElementBadge, crispText } from './ui';
import { addModalSheet, SHEET_CONTENT_DEPTH } from './modalSheet';
import { UNITS_SHEET_KEY } from './sprites';
import { MAX_SLOT_COST, radarPoints, STAT_AXES, statAxisRatios, unitCard } from '../flow/unitCard';

/**
 * The unit-data card overlay (story 5.6 — the OB64 UNIT DATA read), extracted
 * as a shared builder at device round 5: Danilo asked for the same card at
 * CHAR SELECTION, so Placement (units, element known) and Draft (grid tiles =
 * class previews with no element yet; tray units = full cards) now render the
 * one implementation. All CONTENT comes from the pure `unitCard` model; this
 * module is only projection — geometry lives in `UNIT_CARD` (constants.ts),
 * pinned by unit-card.test.ts.
 *
 * CONTRACT for the calling scene (the gesture and lifecycle stay ITS job):
 * - open on a matured long-press; keep the returned objects and destroy them
 *   to close — DEFERRED one tick when closing from an input handler;
 * - the chrome and the ARMED down→up close handshake live in the shared
 *   modal-sheet SHELL (config/modalSheet.ts — extracted at story 5.7 so the
 *   battle-stats sheet reuses it; the 5.6 review history that mandates the
 *   handshake is documented THERE and must survive any refactor);
 * - reset the kept array in `create()` (singleton scenes).
 */
export function buildUnitCardOverlay(scene: Scene, cls: UnitClass, element: Element | undefined, requestClose: () => void): GameObjects.GameObject[] {
  const card = unitCard(cls, element);
  const K = UNIT_CARD;
  // Chrome + armed close handshake: the shared shell (story 5.7 extraction).
  const objs: GameObjects.GameObject[] = [...addModalSheet(scene, K, requestClose)];

  // Header: the interim portrait at a FIXED 64 (deliberately NOT
  // addUnitSprite — the loom is board presence, and a 96px monster portrait
  // would burst this header; the raw frame is why the model exports
  // `portraitFrame`), the name in gold, and the subline.
  const left = K.x + K.pad;
  objs.push(
    scene.add
      .sprite(left + K.portraitW / 2, K.y + K.pad + K.portraitW / 2, UNITS_SHEET_KEY, card.portraitFrame)
      .setDisplaySize(K.portraitW, K.portraitW)
      .setDepth(SHEET_CONTENT_DEPTH),
  );
  const nameX = left + K.portraitW + K.nameGapX;
  objs.push(
    crispText(scene, nameX, K.y + K.pad + 18, card.name.toUpperCase(), { fontFamily: 'Arial Black', fontSize: '16px', color: PALETTE.title })
      .setOrigin(0, 0.5)
      .setDepth(SHEET_CONTENT_DEPTH),
  );
  // The subline (device rounds 2+3 — "something visual…", then "1 out of 2"):
  // `HP 120 ·` then the unit's SIZE as a FIXED row of MAX_SLOT_COST
  // board-cell squares with this unit's cost FILLED (a small reads ■□, a
  // monster ■■ — the frame of reference is always on screen), then the
  // element as the shared colored dot — SKIPPED on a class-preview card
  // (round 5): elements are rolled at draft, so a grid tile has none yet.
  const subY = K.y + K.pad + 42;
  const hpText = crispText(scene, nameX, subY, `HP ${card.hp} · `, { fontFamily: 'Arial', fontSize: '11px', color: PALETTE.bodyText })
    .setOrigin(0, 0.5)
    .setDepth(SHEET_CONTENT_DEPTH);
  objs.push(hpText);
  let cursorX = nameX + hpText.width + 2;
  for (let sq = 0; sq < MAX_SLOT_COST; sq += 1) {
    const filled = sq < card.slotCost;
    objs.push(
      scene.add
        .rectangle(cursorX, subY, 11, 11, filled ? PALETTE.boneFill : 0, filled ? 1 : 0) // empty = hollow outline
        .setOrigin(0, 0.5)
        .setStrokeStyle(1, filled ? PALETTE.boneFill : PALETTE.unitStroke)
        .setDepth(SHEET_CONTENT_DEPTH),
    );
    cursorX += 14;
  }
  if (card.element !== undefined) {
    objs.push(addElementBadge(scene, cursorX + 10, subY, card.element).setDepth(SHEET_CONTENT_DEPTH));
  }

  // The three move rows, LEFT column below the header — the OB64 read: a
  // row-position mini-grid (three stacked bars, the firing row lit — front
  // on top, the board's own orientation), the verb ×count, and the
  // damage-type glyph INLINE right after it at 15px (device round 3: parked
  // in its own far column at 13px it read as "an extra X").
  const bandTop = K.y + K.pad + K.headerH;
  card.rows.forEach((row, i) => {
    const y = bandTop + i * K.rowH + K.rowH / 2;
    for (let bar = 0; bar < 3; bar += 1) {
      objs.push(
        scene.add
          .rectangle(left, y - 5 + bar * 5, K.rowIconW, 3, bar === i ? PALETTE.boneFill : PALETTE.cardStroke, 1) // lit bar = bone
          .setOrigin(0, 0.5)
          .setDepth(SHEET_CONTENT_DEPTH),
      );
    }
    const verb = crispText(scene, left + K.rowIconW + 8, y, `${row.label} ×${row.count}`, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: PALETTE.bodyText,
    })
      .setOrigin(0, 0.5)
      .setDepth(SHEET_CONTENT_DEPTH);
    objs.push(verb);
    objs.push(
      crispText(scene, verb.x + verb.width + 8, y, CARD_GLYPHS[row.glyph], {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: CARD_GLYPH_COLORS[row.glyph],
      })
        .setOrigin(0, 0.5)
        .setDepth(SHEET_CONTENT_DEPTH),
    );
  });

  // The stat SPIDER CHART, RIGHT column, anchored to the card top so it
  // climbs into the header's empty right half (device round 4 — the
  // staggered columns are what shrank the sheet to 184). Six axes scaled
  // per-axis to the roster's best (the web's edge = "best in the game at
  // this"), name-only labels (round 2), Graphics path calls (the board.ts
  // precedent — Phaser 4's add.polygon mangles shapes), value shape in
  // side-blue (the card shows YOUR unit).
  const radarCY = K.y + K.radarCYOffset;
  // The unit web/spokes/labels all derive their vertex count from STAT_AXES
  // (review 2026-07-29: hardcoded six-element arrays would silently diverge
  // from the value polygon if the axes ever grew).
  const ONES = STAT_AXES.map(() => 1);
  const g = scene.add.graphics().setDepth(SHEET_CONTENT_DEPTH);
  const ring = (scale: number) => {
    const pts = radarPoints(K.radarCX, radarCY, K.radarR * scale, ONES);
    g.beginPath();
    pts.forEach((pt, i) => (i === 0 ? g.moveTo(pt.x, pt.y) : g.lineTo(pt.x, pt.y)));
    g.closePath();
    g.strokePath();
  };
  g.lineStyle(1, PALETTE.cardStroke, 1);
  ring(1 / 3);
  ring(2 / 3);
  ring(1);
  for (const spoke of radarPoints(K.radarCX, radarCY, K.radarR, ONES)) {
    g.lineBetween(K.radarCX, radarCY, spoke.x, spoke.y);
  }
  const shape = radarPoints(K.radarCX, radarCY, K.radarR, statAxisRatios(cls));
  g.fillStyle(PALETTE.playerLine, 0.3);
  g.lineStyle(2, PALETTE.playerLine, 1);
  g.beginPath();
  shape.forEach((pt, i) => (i === 0 ? g.moveTo(pt.x, pt.y) : g.lineTo(pt.x, pt.y)));
  g.closePath();
  g.fillPath();
  g.strokePath();
  objs.push(g);
  radarPoints(K.radarCX, radarCY, K.radarR + K.radarLabelPad, ONES).forEach((pt, i) => {
    objs.push(
      crispText(scene, pt.x, pt.y, (STAT_AXES[i] as string).toUpperCase(), {
        fontFamily: 'Arial',
        fontSize: `${MIN_FONT_PX}px`,
        color: PALETTE.mutedText,
      })
        .setOrigin(0.5)
        .setDepth(SHEET_CONTENT_DEPTH),
    );
  });

  return objs;
}
