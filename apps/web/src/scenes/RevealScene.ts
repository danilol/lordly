import { Scene } from 'phaser';
import type { BattleStarted, UnitSnapshot } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BUTTON_HEIGHT,
  BUTTON_WIDTH,
  ELEMENT_COLORS,
  ENEMY_ARMY_LABEL,
  PALETTE,
  REVEAL_FIGHT_LABEL,
  REVEAL_HINT,
  REVEAL_TITLE,
} from '../config/constants';
import { addHomeBack, crispText } from '../config/ui';
import { screenCellCenter, toScreenCell } from '../flow/battleView';
import type { MatchFlow } from '../flow/MatchFlow';

/**
 * Reveal scene (FR6, AD-11): both committed boards shown FACE TO FACE — the
 * FR5/FR24 fence lifts here, so the AI's side B renders for the first time.
 * Positions come from the pure lane-mirror transform (`battleView`): enemy on
 * top facing down, player on the bottom. A thin renderer — it reads the
 * initial roster off the (once-)resolved `BattleLog` and evaluates no rule.
 */
export class RevealScene extends Scene {
  private flow!: MatchFlow;

  constructor() {
    super('Reveal');
  }

  init(data: { flow: MatchFlow }) {
    this.flow = data.flow;
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.background);
    addHomeBack(this);

    crispText(this, BASE_WIDTH / 2, 26, REVEAL_TITLE, { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }).setOrigin(0.5);

    // Defensive guard (not reachable via today's FSM — PlacementScene always
    // commits before starting this scene — but cheap insurance against a
    // future navigation change): resolve() throws if reached uncommitted.
    if (this.flow.getState().phase !== 'committed') {
      crispText(this, BASE_WIDTH / 2, BASE_HEIGHT * 0.4, 'No match committed.', { fontFamily: 'Arial', fontSize: '16px', color: PALETTE.bodyText }).setOrigin(0.5);
      return;
    }

    crispText(this, BASE_WIDTH / 2, 52, REVEAL_HINT, { fontFamily: 'Arial', fontSize: '11px', color: PALETTE.mutedText, align: 'center', wordWrap: { width: BASE_WIDTH - 24 } }).setOrigin(0.5);
    crispText(this, BASE_WIDTH / 2, 92, ENEMY_ARMY_LABEL, { fontFamily: 'Arial Black', fontSize: '12px', color: PALETTE.enemyText }).setOrigin(0.5);

    // resolve() runs the engine EXACTLY ONCE (AD-13); the Battle scene replays
    // the same cached log. The initial roster is the BattleStarted event.
    const roster = (this.flow.resolve().events[0] as BattleStarted).units;
    for (const unit of roster) this.drawUnit(unit);

    const btnY = BASE_HEIGHT - 44;
    const btn = this.add
      .rectangle(BASE_WIDTH / 2, btnY, BUTTON_WIDTH, BUTTON_HEIGHT, PALETTE.buttonFillEnabled)
      .setStrokeStyle(2, PALETTE.buttonStrokeEnabled)
      .setInteractive({ useHandCursor: true });
    crispText(this, btn.x, btn.y, REVEAL_FIGHT_LABEL, { fontFamily: 'Arial', fontSize: '20px', color: PALETTE.buttonText }).setOrigin(0.5);
    btn.on('pointerup', () => this.scene.start('Battle', { flow: this.flow }));
  }

  /** Draws one unit at its mirrored screen cell: box + class label + element badge, tinted by side. */
  private drawUnit(unit: UnitSnapshot) {
    const { x, y } = screenCellCenter(toScreenCell(unit.side, unit.placement));
    const stroke = unit.side === 'A' ? PALETTE.buttonStrokeEnabled : PALETTE.enemyLine;
    const nameColor = unit.side === 'A' ? PALETTE.playerText : PALETTE.enemyText;
    this.add.rectangle(x, y, 48, 40, PALETTE.unitFill).setStrokeStyle(2, stroke);
    crispText(this, x, y - 6, unit.class, { fontFamily: 'Arial Black', fontSize: '9px', color: nameColor }).setOrigin(0.5);
    crispText(this, x, y + 7, unit.element, { fontFamily: 'Arial', fontSize: '8px', color: PALETTE.bodyText }).setOrigin(0.5);
    this.add.rectangle(x + 17, y - 12, 8, 8, ELEMENT_COLORS[unit.element]).setOrigin(0.5);
  }
}
