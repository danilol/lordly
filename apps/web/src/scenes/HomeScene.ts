import { GameObjects, Scene } from 'phaser';
import { BALANCE } from '@lordly/engine';
import type { Mode } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BUTTON_HEIGHT,
  BUTTON_WIDTH,
  GAME_NAME,
  HOME_CREDITS_LABEL,
  HOME_HELP_LABEL,
  HOME_PLAY_LABEL,
  MODE_BUTTON_GAP,
  MODE_BUTTON_HEIGHT,
  MODE_BUTTON_WIDTH,
  MODE_HEADING,
  MODE_STANDARD_HINT,
  MODE_STANDARD_LABEL,
  MODE_WIPEOUT_LABEL,
  modeWipeoutHint,
  PALETTE,
} from '../config/constants';
import { MatchFlow } from '../flow/MatchFlow';
import { crispText } from '../config/ui';

export class HomeScene extends Scene {
  /** The battle mode the next match starts in (FR17/FR19) — Standard by default. */
  private mode: Mode = 'single';
  /** The mode toggle's dynamic objects, rebuilt on each selection change. */
  private modeUi: GameObjects.GameObject[] = [];

  constructor() {
    super('Home');
  }

  create() {
    // Phaser reuses the scene INSTANCE across restarts, so the class-field
    // initializer above only runs once — re-assert the Standard default on
    // every Home entry (mode persistence is story 2.3's settings gateway).
    this.mode = 'single';
    this.modeUi = [];

    this.cameras.main.setBackgroundColor(PALETTE.background);

    crispText(this, BASE_WIDTH / 2, BASE_HEIGHT * 0.3, GAME_NAME, {
      fontFamily: 'Arial Black',
      fontSize: '32px',
      color: PALETTE.title,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 40 },
    }).setOrigin(0.5);

    // Enabled (story 1.8): starts a fresh match and enters the Draft scene.
    const button = this.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT * 0.58, BUTTON_WIDTH, BUTTON_HEIGHT, PALETTE.buttonFillEnabled)
      .setStrokeStyle(2, PALETTE.buttonStrokeEnabled)
      .setInteractive({ useHandCursor: true });

    crispText(this, button.x, button.y, HOME_PLAY_LABEL, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: PALETTE.buttonText,
    }).setOrigin(0.5);

    button.on('pointerup', () => {
      // MatchFlow owns match truth and is passed EXPLICITLY between scenes
      // (AD-5) — never via the Phaser registry. A fresh flow per Play tap;
      // Result→Rematch reuses the flow and calls startMatch again (which
      // carries the mode forward — story 1.10).
      const flow = new MatchFlow();
      flow.startMatch(this.mode);
      this.scene.start('Draft', { flow });
    });

    crispText(this, BASE_WIDTH / 2, BASE_HEIGHT * 0.7, MODE_HEADING, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: PALETTE.mutedText,
    }).setOrigin(0.5);
    this.redrawModeToggle();

    // Home spurs (story 2.4, FR27/FR31): Help and Credits — exactly these
    // two; History and Settings arrive with their own stories (Epic 3 /
    // deferred). Same metrics as the mode toggle (≥44px targets).
    this.spurButton(0, HOME_HELP_LABEL, () => this.scene.start('Help', { from: 'Home' }));
    this.spurButton(1, HOME_CREDITS_LABEL, () => this.scene.start('Credits'));
  }

  /** One of the two Home spur buttons (Help / Credits), laid out like the mode toggle row. */
  private spurButton(index: number, label: string, onTap: () => void) {
    const startX = (BASE_WIDTH - (2 * MODE_BUTTON_WIDTH + MODE_BUTTON_GAP)) / 2;
    const x = startX + index * (MODE_BUTTON_WIDTH + MODE_BUTTON_GAP) + MODE_BUTTON_WIDTH / 2;
    const y = BASE_HEIGHT * 0.9;
    this.add
      .rectangle(x, y, MODE_BUTTON_WIDTH, MODE_BUTTON_HEIGHT, PALETTE.buttonFill)
      .setStrokeStyle(2, PALETTE.buttonStroke)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', onTap);
    crispText(this, x, y, label, { fontFamily: 'Arial', fontSize: '15px', color: PALETTE.buttonText }).setOrigin(0.5);
  }

  /** The Standard/Wipeout toggle (story 1.10, AC2) — a real player-facing choice, redrawn on change. */
  private redrawModeToggle() {
    for (const obj of this.modeUi) obj.destroy();
    this.modeUi = [];

    const options: { mode: Mode; label: string }[] = [
      { mode: 'single', label: MODE_STANDARD_LABEL },
      { mode: 'wipeout', label: MODE_WIPEOUT_LABEL },
    ];
    const w = MODE_BUTTON_WIDTH;
    const h = MODE_BUTTON_HEIGHT;
    const gap = MODE_BUTTON_GAP;
    const startX = (BASE_WIDTH - (2 * w + gap)) / 2;
    const y = BASE_HEIGHT * 0.76;

    options.forEach((opt, i) => {
      const selected = this.mode === opt.mode;
      const x = startX + i * (w + gap) + w / 2;
      const btn = this.add
        .rectangle(x, y, w, h, selected ? PALETTE.buttonFillEnabled : PALETTE.buttonFill)
        .setStrokeStyle(2, selected ? PALETTE.buttonStrokeEnabled : PALETTE.buttonStroke)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          this.mode = opt.mode;
          this.redrawModeToggle();
        });
      const label = crispText(this, x, y, opt.label, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: selected ? PALETTE.buttonText : PALETTE.buttonTextDisabled,
      }).setOrigin(0.5);
      this.modeUi.push(btn, label);
    });

    // One-line description of the selected mode; the wipeout cap is READ
    // from BALANCE (the hardcoded-"3" lesson from 1.8's review, verbatim).
    const hint = this.mode === 'wipeout' ? modeWipeoutHint(BALANCE.engagementCap) : MODE_STANDARD_HINT;
    this.modeUi.push(
      crispText(this, BASE_WIDTH / 2, y + 38, hint, {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: PALETTE.mutedText,
        align: 'center',
        wordWrap: { width: BASE_WIDTH - 32 },
      }).setOrigin(0.5),
    );
  }
}
