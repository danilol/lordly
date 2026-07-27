import { Scene } from 'phaser';
import type { BattleEnded, BattleStarted, Side, UnitSnapshot } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BUTTON_HEIGHT,
  BUTTON_WIDTH,
  PALETTE,
  RESULT_DRAW_LABEL,
  RESULT_HOME_LABEL,
  RESULT_LOSE_LABEL,
  RESULT_REMATCH_LABEL,
  RESULT_WIN_LABEL,
  MIN_FONT_PX,
  CARD_CLASS_FONT_PX,
  CLASS_ABBREVIATIONS,
} from '../config/constants';
import { addButton, addSceneGround, applyHiDpiCamera, addElementBadge, addUnitSprite, crispText, prefersReducedMotion } from '../config/ui';
import type { ButtonStyle } from '../config/constants';
import type { MatchFlow } from '../flow/MatchFlow';

/**
 * Result scene (FR22, FR27 — polished in story 2.3): a full-screen verdict
 * banner, an animated count-up of both final HP percentages, and both
 * compositions with real sprites, closing the loop with one-tap Rematch
 * (fresh Draft, new seed) and Home. It reads winner and HP% straight off the
 * `BattleEnded` event — it never recomputes judging (AD-2).
 */
export class ResultScene extends Scene {
  private flow!: MatchFlow;

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
    const pctY = BASE_HEIGHT * 0.27;
    const pctText = crispText(this, BASE_WIDTH / 2, pctY, this.pctLine(0, 0), {
      fontFamily: 'Courier',
      fontSize: '16px',
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

    this.drawComposition('A', roster, 'Your army', BASE_HEIGHT * 0.4, PALETTE.playerText);
    this.drawComposition('B', roster, 'Enemy army', BASE_HEIGHT * 0.56, PALETTE.enemyText);

    this.button(BASE_HEIGHT * 0.79, RESULT_REMATCH_LABEL, 'primary', () => {
      this.flow.startMatch(); // fresh seed (AD-10), carries lastAiArchetypeId forward (FR25)
      this.scene.start('Draft', { flow: this.flow });
    });
    this.button(BASE_HEIGHT * 0.9, RESULT_HOME_LABEL, 'default', () => {
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
    crispText(this, BASE_WIDTH / 2, y, heading, { fontFamily: 'Arial Black', fontSize: '13px', color: headingColor }).setOrigin(0.5);
    const units = roster.filter((u) => u.side === side);
    const chipW = 64;
    const chipH = 64;
    const gap = 8;
    const totalW = units.length * chipW + (units.length - 1) * gap;
    const startX = (BASE_WIDTH - totalW) / 2;
    const sideLine = side === 'A' ? PALETTE.playerLine : PALETTE.enemyLine;
    units.forEach((unit, i) => {
      const x = startX + i * (chipW + gap) + chipW / 2;
      const cy = y + 44;
      // Opaque side-blended backing (device pass 2026-07-27): the 0.12 wash let the stone floor swallow the chip.
      this.add.rectangle(x, cy, chipW, chipH, side === 'A' ? PALETTE.cardFillYou : PALETTE.cardFillEnemy).setStrokeStyle(1, sideLine);
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

  private button(y: number, text: string, style: ButtonStyle, onTap: () => void) {
    addButton(this, BASE_WIDTH / 2, y, { width: BUTTON_WIDTH, height: BUTTON_HEIGHT, label: text, fontSize: 20, style, onTap });
  }
}
