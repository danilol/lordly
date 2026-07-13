import { Scene } from 'phaser';
import type { BattleEnded, BattleStarted, Side, UnitSnapshot } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BUTTON_HEIGHT,
  BUTTON_WIDTH,
  ELEMENT_COLORS,
  PALETTE,
  RESULT_DRAW_LABEL,
  RESULT_HOME_LABEL,
  RESULT_LOSE_LABEL,
  RESULT_REMATCH_LABEL,
  RESULT_WIN_LABEL,
} from '../config/constants';
import { crispText } from '../config/ui';
import type { MatchFlow } from '../flow/MatchFlow';

/**
 * Result scene (FR18/FR22 functional, FR27): declares the winner (or draw)
 * with both final HP percentages and both compositions, and closes the loop
 * with Rematch (one tap → fresh Draft, new seed) and Home. It reads winner and
 * HP% straight off the `BattleEnded` event — it never recomputes judging.
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

    const log = this.flow.resolve();
    const roster = (log.events[0] as BattleStarted).units;
    const ended = log.events[log.events.length - 1] as BattleEnded;

    // Winner banner (side A is the human — AD-11).
    const [label, color] =
      ended.winner === 'draw'
        ? [RESULT_DRAW_LABEL, PALETTE.drawText]
        : ended.winner === 'A'
          ? [RESULT_WIN_LABEL, PALETTE.winText]
          : [RESULT_LOSE_LABEL, PALETTE.loseText];
    crispText(this, BASE_WIDTH / 2, BASE_HEIGHT * 0.16, label, { fontFamily: 'Arial Black', fontSize: '34px', color }).setOrigin(0.5);

    // Final HP percentages, read from the event (floored, report-only ints).
    crispText(this, BASE_WIDTH / 2, BASE_HEIGHT * 0.27, `You ${ended.hpPct.A}%      Enemy ${ended.hpPct.B}%`, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: PALETTE.bodyText,
    }).setOrigin(0.5);

    this.drawComposition('A', roster, 'Your army', BASE_HEIGHT * 0.4, PALETTE.playerText);
    this.drawComposition('B', roster, 'Enemy army', BASE_HEIGHT * 0.56, PALETTE.enemyText);

    this.button(BASE_HEIGHT * 0.79, RESULT_REMATCH_LABEL, PALETTE.buttonFillEnabled, PALETTE.buttonStrokeEnabled, () => {
      this.flow.startMatch(); // fresh seed (AD-10), carries lastAiArchetypeId forward (FR25)
      this.scene.start('Draft', { flow: this.flow });
    });
    this.button(BASE_HEIGHT * 0.9, RESULT_HOME_LABEL, PALETTE.buttonFill, PALETTE.buttonStroke, () => {
      this.scene.start('Home'); // Home builds a fresh MatchFlow on Play
    });
  }

  /** One side's composition line: heading + a class/element chip per unit. */
  private drawComposition(side: Side, roster: UnitSnapshot[], heading: string, y: number, headingColor: string) {
    crispText(this, BASE_WIDTH / 2, y, heading, { fontFamily: 'Arial Black', fontSize: '13px', color: headingColor }).setOrigin(0.5);
    const units = roster.filter((u) => u.side === side);
    const chipW = 96;
    const gap = 10;
    const totalW = units.length * chipW + (units.length - 1) * gap;
    const startX = (BASE_WIDTH - totalW) / 2;
    units.forEach((unit, i) => {
      const x = startX + i * (chipW + gap) + chipW / 2;
      const cy = y + 34;
      this.add.rectangle(x, cy, chipW, 40, PALETTE.cardFill).setStrokeStyle(1, PALETTE.cardStroke);
      crispText(this, x - 8, cy - 8, unit.class, { fontFamily: 'Arial Black', fontSize: '10px', color: PALETTE.title }).setOrigin(0.5);
      crispText(this, x - 8, cy + 8, unit.element, { fontFamily: 'Arial', fontSize: '9px', color: PALETTE.bodyText }).setOrigin(0.5);
      this.add.rectangle(x + chipW / 2 - 12, cy, 10, 10, ELEMENT_COLORS[unit.element]).setOrigin(0.5);
    });
  }

  private button(y: number, text: string, fill: number, stroke: number, onTap: () => void) {
    const btn = this.add
      .rectangle(BASE_WIDTH / 2, y, BUTTON_WIDTH, BUTTON_HEIGHT, fill)
      .setStrokeStyle(2, stroke)
      .setInteractive({ useHandCursor: true });
    crispText(this, btn.x, btn.y, text, { fontFamily: 'Arial', fontSize: '20px', color: PALETTE.buttonText }).setOrigin(0.5);
    btn.on('pointerup', onTap);
  }
}
