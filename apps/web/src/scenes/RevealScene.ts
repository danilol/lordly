import { Scene } from 'phaser';
import type { BattleStarted, UnitSnapshot } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BUTTON_HEIGHT,
  BUTTON_WIDTH,
  ENEMY_ARMY_LABEL,
  PALETTE,
  REVEAL_FIGHT_LABEL,
  REVEAL_HINT,
  REVEAL_TITLE,
  CLASS_ABBREVIATIONS,
  unitCodeStyle,
} from '../config/constants';
import { addElementBadge, addHomeBack, addUnitSprite, applyHiDpiCamera, crispText } from '../config/ui';
import { drawIsoBoard } from '../config/board';
import { unitTileCenter } from '../flow/battleView';
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
    applyHiDpiCamera(this);
    addHomeBack(this);

    crispText(this, BASE_WIDTH / 2, 26, REVEAL_TITLE, { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }).setOrigin(0.5);

    // Defensive guard (not reachable via today's FSM — PlacementScene always
    // commits before starting this scene — but cheap insurance against a
    // future navigation change): resolve() throws if reached uncommitted.
    if (this.flow.getState().phase !== 'committed') {
      crispText(this, BASE_WIDTH / 2, BASE_HEIGHT * 0.4, 'No match committed.', { fontFamily: 'Arial', fontSize: '16px', color: PALETTE.bodyText }).setOrigin(
        0.5,
      );
      return;
    }

    crispText(this, BASE_WIDTH / 2, 52, REVEAL_HINT, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: PALETTE.mutedText,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 24 },
    }).setOrigin(0.5);
    // Above the enemy board (tiles start ~y86 in the iso layout — story 2.2).
    crispText(this, BASE_WIDTH / 2, 70, ENEMY_ARMY_LABEL, { fontFamily: 'Arial Black', fontSize: '12px', color: PALETTE.enemyText }).setOrigin(0.5);

    // The shared iso boards (story 2.2, ADR-0001) — the same component the
    // Battle scene stages, so Reveal → Battle reads as one continuous place.
    drawIsoBoard(this, 'B');
    drawIsoBoard(this, 'A');

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

  /**
   * Draws one unit standing on its iso tile (story 2.2): the 32px billboard
   * sprite, side-colored 3-letter class code, and the shared element dot —
   * matching the Battle scene's unit treatment exactly, so Reveal → Battle
   * is the same stage. Side identity lives in the tile color + code color +
   * board position (the non-color anchor); the 2.1 card wash is retired here.
   * Story 4.2 (FR37, dossier §7): Reveal is a NAME surface — the soldier's
   * name sits under the code (the battle board keeps codes only). The name
   * inherits the code's FR39f stroke treatment so it survives the tile fill.
   */
  private drawUnit(unit: UnitSnapshot) {
    const { x, y } = unitTileCenter(unit.side, unit.placement);
    addUnitSprite(this, x, y - 12, unit.class, 32).setDepth(y);
    crispText(this, x, y + 8, CLASS_ABBREVIATIONS[unit.class], unitCodeStyle(unit.side))
      .setOrigin(0.5)
      .setDepth(y);
    if (unit.name) {
      crispText(this, x, y + 21, unit.name, { ...unitCodeStyle(unit.side), fontFamily: 'Arial', fontSize: '10px' })
        .setOrigin(0.5)
        .setDepth(y);
    }
    addElementBadge(this, x + 16, y - 26, unit.element).setDepth(y);
  }
}
