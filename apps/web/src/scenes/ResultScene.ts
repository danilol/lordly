import { GameObjects, Input, Scene, Time } from 'phaser';
import type { BattleEnded, BattleStarted, Side, UnitId, UnitSnapshot } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BUTTON_HEIGHT,
  BUTTON_WIDTH,
  LONG_PRESS_MS,
  SUMMARY_LINK,
  TAP_DISTANCE_PX,
  PALETTE,
  RESULT_DRAW_LABEL,
  RESULT_HOME_LABEL,
  RESULT_LOSE_LABEL,
  COMP_HEADING_FONT_PX,
  groundLabelStyle,
  RESULT_ANCHORS,
  RESULT_HINT,
  RESULT_HINT_Y,
  RESULT_REMATCH_LABEL,
  RESULT_WIN_LABEL,
  MIN_FONT_PX,
  CARD_CLASS_FONT_PX,
  CLASS_ABBREVIATIONS,
} from '../config/constants';
import { addButton, addSceneGround, applyHiDpiCamera, addElementBadge, addUnitSprite, crispText, prefersReducedMotion } from '../config/ui';
import type { ButtonStyle } from '../config/constants';
import type { MatchFlow } from '../flow/MatchFlow';
import { battleStats } from '../flow/battleStats';
import type { BattleStats } from '../flow/battleStats';
import { buildStatsSheetOverlay } from '../config/statsSheetOverlay';
import { buildSummarySheetOverlay } from '../config/summarySheetOverlay';

/**
 * Result scene (FR22, FR27 — polished in story 2.3): a full-screen verdict
 * banner, an animated count-up of both final HP percentages, and both
 * compositions with real sprites, closing the loop with one-tap Rematch
 * (fresh Draft, new seed) and Home. It reads winner and HP% straight off the
 * `BattleEnded` event — it never recomputes judging (AD-2).
 */
export class ResultScene extends Scene {
  private flow!: MatchFlow;
  /** The battle's folded stats (story 5.7) — computed once per create(). */
  private stats!: BattleStats;
  /** The open per-unit stats sheet's objects. Non-empty === the sheet is up. Reset every create() (singleton scenes). */
  private sheetObjects: GameObjects.GameObject[] = [];
  /** The armed long-press timer (story 5.7 — same gesture as the 5.6 card: hold a unit, learn about it). Reset every create() (singleton scenes). */
  private longPressTimer?: Time.TimerEvent;

  constructor() {
    super('Result');
  }

  init(data: { flow: MatchFlow }) {
    this.flow = data.flow;
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.background);
    applyHiDpiCamera(this);
    addSceneGround(this); // story 5.2: the medieval stone floor under the menu chrome
    const reduceMotion = prefersReducedMotion();

    this.sheetObjects = []; // the objects died with the scene shutdown; the ARRAY must not carry stale refs (story 5.7)
    this.longPressTimer?.remove(); // no stale sheet-open fires into a fresh result (the 5.6 hygiene)
    this.longPressTimer = undefined;

    const log = this.flow.resolve();
    // The verdict moment is where the ONE live history entry gets written
    // (FR28, AD-13 — story 3.1). Idempotent in the flow, so a singleton-scene
    // restart of Result can never duplicate it; replays (3.2) won't call it.
    this.flow.recordResult();
    const roster = (log.events[0] as BattleStarted).units;
    const ended = log.events[log.events.length - 1] as BattleEnded;

    // Full-screen verdict banner (FR22): a side-colored band owning the top of
    // the screen (win = blue-side, lose = red-side, draw = neutral — the
    // DESIGN outcome rule) with a brief procedural entrance. Zero art.
    const [label, color, band, bannerFill] =
      ended.winner === 'draw'
        ? [RESULT_DRAW_LABEL, PALETTE.drawText, PALETTE.cardStroke, PALETTE.cardFill]
        : ended.winner === 'A'
          ? [RESULT_WIN_LABEL, PALETTE.winText, PALETTE.playerLine, PALETTE.cardFillYou]
          : [RESULT_LOSE_LABEL, PALETTE.loseText, PALETTE.enemyLine, PALETTE.cardFillEnemy];
    const bannerY = BASE_HEIGHT * 0.16;
    // Opaque band + solid rules (review 2026-07-27): the old 0.16/0.6 washes
    // dissolved the match's primary outcome signal into the story-5.2 stone
    // floor. Same side-blended tokens the comp chips below already use.
    this.add.rectangle(BASE_WIDTH / 2, bannerY, BASE_WIDTH, 76, bannerFill);
    this.add.rectangle(BASE_WIDTH / 2, bannerY - 38, BASE_WIDTH, 2, band);
    this.add.rectangle(BASE_WIDTH / 2, bannerY + 38, BASE_WIDTH, 2, band);
    const banner = crispText(this, BASE_WIDTH / 2, bannerY, label, { fontFamily: 'Arial Black', fontSize: '40px', color }).setOrigin(0.5);
    if (!reduceMotion) {
      banner.setScale(0.6).setAlpha(0);
      this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 350, ease: 'Back.easeOut' });
    }

    // Animated count-up of both final HP percentages (FR22) — values come
    // ONLY from the BattleEnded payload; the tween just paces the reveal.
    // Under reduced motion the numbers land instantly (they ARE the info).
    const pctY = BASE_HEIGHT * RESULT_ANCHORS.pctFrac;
    const pctText = crispText(this, BASE_WIDTH / 2, pctY, this.pctLine(0, 0), {
      fontFamily: 'Courier',
      fontSize: `${RESULT_ANCHORS.pctFontPx}px`,
      fontStyle: '800',
      color: PALETTE.bodyText,
    }).setOrigin(0.5);
    if (reduceMotion) {
      pctText.setText(this.pctLine(ended.hpPct.A, ended.hpPct.B));
    } else {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 800,
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 1;
          pctText.setText(this.pctLine(Math.round(ended.hpPct.A * t), Math.round(ended.hpPct.B * t)));
        },
        onComplete: () => pctText.setText(this.pctLine(ended.hpPct.A, ended.hpPct.B)),
      });
    }

    // The battle-stats fold (story 5.7): once, from the same memoized log.
    // Device round 2 (Danilo): the summary is OPTIONAL — a link you click to
    // see, not an always-on strip you learn to ignore. The link takes the
    // measured free band the strip briefly held; the read lives in the sheet.
    this.stats = battleStats(log);
    crispText(this, BASE_WIDTH / 2, SUMMARY_LINK.y, '▸ BATTLE SUMMARY', groundLabelStyle(PALETTE.title, SUMMARY_LINK.fontPx)).setOrigin(0.5);
    this.add
      .rectangle(BASE_WIDTH / 2, SUMMARY_LINK.y, SUMMARY_LINK.tapW, SUMMARY_LINK.tapH, 0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', (pointer: Input.Pointer) => {
        if (pointer.getDistance() > TAP_DISTANCE_PX) return; // a stray drag-release is not a tap (the scene family's one discipline — 5.7 review)
        this.cancelLongPress(); // a pending chip timer must not fire under the scrim we are about to raise (5.7 review)
        this.closeSheetNow(); // never two sheets
        this.sheetObjects = buildSummarySheetOverlay(this, this.stats, () => this.closeSheet());
      });

    this.drawComposition('A', roster, 'Your army', BASE_HEIGHT * RESULT_ANCHORS.yourArmyFrac, PALETTE.playerText);
    this.drawComposition('B', roster, 'Enemy army', BASE_HEIGHT * RESULT_ANCHORS.enemyArmyFrac, PALETTE.enemyText);

    // The drill-down hint (story 5.8, device round 4) — it lives HERE, not in
    // the summary sheet, because this is the screen where the gesture works: the
    // chips it names are on screen and holdable while you read it. Inside the
    // modal it read as a broken link (Danilo). BONE, not muted grey and not gold
    // (round 5: "the press and hold hint could be in white though… grey is still
    // a bit difficult") — bright enough to read at 10px over the stone, but not
    // the gold that means 'control'.
    crispText(this, BASE_WIDTH / 2, RESULT_HINT_Y, RESULT_HINT, groundLabelStyle(PALETTE.bodyText, MIN_FONT_PX, 'Arial')).setOrigin(0.5);

    this.button(BASE_HEIGHT * RESULT_ANCHORS.rematchFrac, RESULT_REMATCH_LABEL, 'primary', () => {
      this.flow.startMatch(); // fresh seed (AD-10), carries lastAiArchetypeId forward (FR25)
      this.scene.start('Draft', { flow: this.flow });
    });
    this.button(BASE_HEIGHT * RESULT_ANCHORS.homeFrac, RESULT_HOME_LABEL, 'default', () => {
      this.scene.start('Home'); // Home builds a fresh MatchFlow on Play
    });
  }

  /** "You 62% · Enemy 38%" with stable widths (mono + 800 keeps the count-up from jittering). */
  private pctLine(a: number, b: number): string {
    return `You ${a}%   ·   Enemy ${b}%`;
  }

  /**
   * One side's composition line: heading + a compact chip per unit (story
   * 4.2, Danilo's device catch: the 104px 3-unit-era chips put five units at
   * 560px — off the 360 base). Same 64px card language as the draft/placement
   * trays: sprite over code over the soldier NAME (a name surface — cards
   * show names, the battle board keeps sprites), element as the shared dot
   * (the word dropped with the width).
   */
  private drawComposition(side: Side, roster: UnitSnapshot[], heading: string, y: number, headingColor: string) {
    crispText(this, BASE_WIDTH / 2, y, heading, groundLabelStyle(headingColor, COMP_HEADING_FONT_PX)).setOrigin(0.5);
    const units = roster.filter((u) => u.side === side);
    const chipW = 64;
    const chipH = RESULT_ANCHORS.chipH;
    const gap = 8;
    const totalW = units.length * chipW + (units.length - 1) * gap;
    const startX = (BASE_WIDTH - totalW) / 2;
    const sideLine = side === 'A' ? PALETTE.playerLine : PALETTE.enemyLine;
    units.forEach((unit, i) => {
      const x = startX + i * (chipW + gap) + chipW / 2;
      const cy = y + RESULT_ANCHORS.chipCYOffset;
      // Opaque side-blended backing (device pass 2026-07-27): the 0.12 wash let the stone floor swallow the chip.
      const chip = this.add.rectangle(x, cy, chipW, chipH, side === 'A' ? PALETTE.cardFillYou : PALETTE.cardFillEnemy).setStrokeStyle(1, sideLine);
      // Story 5.7: hold a unit, learn about it — the 5.6 gesture generalized.
      // The chips were display-only before, so the audit here is light: no
      // tap meaning exists to collide with; the timer cancels on release,
      // pointer-out, or a wander past the shared threshold (checked at fire —
      // Result has no drag to cancel it for free), and the sheet's armed
      // close handshake (config/modalSheet.ts) consumes both bounding
      // releases, exactly as at Draft/Placement.
      chip.setInteractive({ useHandCursor: true });
      chip.on('pointerdown', (pointer: Input.Pointer) => {
        this.longPressTimer?.remove();
        this.longPressTimer = this.time.delayedCall(LONG_PRESS_MS, () => {
          this.longPressTimer = undefined;
          if (this.sheetObjects.length > 0) return; // a sheet is up — its scrim blocked this press's cancel events (5.7 review)
          if (pointer.getDistance() > TAP_DISTANCE_PX) return;
          this.openSheet(unit.id);
        });
      });
      chip.on('pointerout', () => this.cancelLongPress());
      chip.on('pointerup', () => this.cancelLongPress());
      addUnitSprite(this, x, cy - 14, unit.class, 28);
      crispText(this, x, cy + 8, CLASS_ABBREVIATIONS[unit.class], {
        fontFamily: 'Arial Black',
        fontSize: `${CARD_CLASS_FONT_PX}px`,
        color: PALETTE.title,
      }).setOrigin(0.5);
      if (unit.name) {
        crispText(this, x, cy + 23, unit.name, { fontFamily: 'Arial', fontSize: `${MIN_FONT_PX}px`, color: PALETTE.bodyText }).setOrigin(0.5);
      }
      addElementBadge(this, x + chipW / 2 - 10, cy - 22, unit.element);
    });
  }

  /** Kills any armed (not yet fired) sheet-open timer (story 5.7 — the 5.6 hygiene). */
  private cancelLongPress() {
    this.longPressTimer?.remove();
    this.longPressTimer = undefined;
  }

  /** Opens the per-unit stats sheet for `id` — the fold row is already computed; the shared modal shell owns chrome and dismissal. */
  private openSheet(id: UnitId) {
    this.cancelLongPress(); // no timer may straddle a sheet boundary (5.7 review)
    this.closeSheetNow(); // never two sheets
    const unit = this.stats.units.find((entry) => entry.id === id);
    if (!unit) return; // unreachable — chips are built from the same roster the fold keys on
    this.sheetObjects = buildStatsSheetOverlay(this, unit, () => this.closeSheet());
  }

  /** Closes ONE TICK later — the caller is an input handler on an object about to be destroyed (the 5.5/5.6 lesson). Identity-guarded (5.7 review): if a NEW sheet opened inside the deferred window, this close belongs to the old one and must not kill it. */
  private closeSheet() {
    const closing = this.sheetObjects;
    this.time.delayedCall(0, () => {
      if (this.sheetObjects === closing) this.closeSheetNow();
      else for (const o of closing) o.destroy(); // the superseded sheet still needs its own teardown
    });
  }

  private closeSheetNow() {
    for (const o of this.sheetObjects) o.destroy();
    this.sheetObjects = [];
  }

  private button(y: number, text: string, style: ButtonStyle, onTap: () => void) {
    addButton(this, BASE_WIDTH / 2, y, { width: BUTTON_WIDTH, height: BUTTON_HEIGHT, label: text, fontSize: 20, style, onTap });
  }
}
