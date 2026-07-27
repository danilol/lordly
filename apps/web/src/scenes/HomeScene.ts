import { GameObjects, Scene } from 'phaser';
import { BALANCE } from '@lordly/engine';
import type { Mode } from '@lordly/engine';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BUTTON_HEIGHT,
  BUTTON_WIDTH,
  GAME_SUBTITLE,
  HOME_BG_KEY,
  WORDMARK_KEY,
  HOME_CREDITS_LABEL,
  HOME_HELP_LABEL,
  HOME_HISTORY_LABEL,
  HOME_PLAY_LABEL,
  SPUR_BUTTON_WIDTH,
  SPUR_COUNT,
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
import { addButton, addFramedPanel, applyHiDpiCamera, crispText } from '../config/ui';

export class HomeScene extends Scene {
  /** The battle mode the next match starts in (FR17/FR19) — Wipeout by default (Danilo, 2026-07-19: Wipeout is the headline experience). */
  private mode: Mode = 'wipeout';
  /** The mode toggle's dynamic objects, rebuilt on each selection change. */
  private modeUi: GameObjects.GameObject[] = [];

  constructor() {
    super('Home');
  }

  create() {
    // Phaser reuses the scene INSTANCE across restarts, so the class-field
    // initializer above only runs once — re-assert the Wipeout default on
    // every Home entry (mode persistence is story 2.3's settings gateway).
    this.mode = 'wipeout';
    this.modeUi = [];

    this.cameras.main.setBackgroundColor(PALETTE.background);
    applyHiDpiCamera(this);

    // The castle courtyard (story 5.2 — Danilo's Midjourney art, loaded in
    // Boot). Cover-scaled onto the 360×640 logical stage: the busy, beautiful
    // image is exactly right for Home, where no gameplay text sits (MJ guide
    // §3). A dark scrim under the control band keeps buttons readable over it
    // (the FR39f spirit applied to chrome; exact alpha is a device-tuning
    // value for Danilo's pass).
    const bg = this.add.image(BASE_WIDTH / 2, BASE_HEIGHT / 2, HOME_BG_KEY);
    bg.setScale(Math.max(BASE_WIDTH / bg.width, BASE_HEIGHT / bg.height));
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT * 0.76, BASE_WIDTH, BASE_HEIGHT * 0.48, PALETTE.buttonFill, 0.55);

    // The wordmark plaque (story 5.2, art drop 2026-07-27): Danilo's gold
    // blackletter LORDLY mounted on a gold-framed plate — the logo ships on
    // its own dark ground, so framing it needs no background extraction. The
    // epithet subtitle stays crisp TEXT below (a baked-in subtitle would blur
    // at this width).
    const plaqueY = BASE_HEIGHT * 0.235;
    addFramedPanel(this, BASE_WIDTH / 2, plaqueY, 320, 128);
    const wordmark = this.add.image(BASE_WIDTH / 2, plaqueY, WORDMARK_KEY);
    wordmark.setDisplaySize(288, Math.round((288 * wordmark.height) / wordmark.width));
    crispText(this, BASE_WIDTH / 2, BASE_HEIGHT * 0.365, GAME_SUBTITLE, {
      fontFamily: 'Georgia, serif',
      fontSize: '13px',
      color: PALETTE.buttonText,
    })
      .setOrigin(0.5)
      .setStroke('#10131f', 4);

    // Enabled (story 1.8): starts a fresh match and enters the Draft scene.
    addButton(this, BASE_WIDTH / 2, BASE_HEIGHT * 0.58, {
      width: BUTTON_WIDTH,
      height: BUTTON_HEIGHT,
      label: HOME_PLAY_LABEL,
      fontSize: 20,
      style: 'primary',
      onTap: () => {
        // MatchFlow owns match truth and is passed EXPLICITLY between scenes
        // (AD-5) — never via the Phaser registry. A fresh flow per Play tap;
        // Result→Rematch reuses the flow and calls startMatch again (which
        // carries the mode forward — story 1.10).
        const flow = new MatchFlow();
        flow.startMatch(this.mode);
        this.scene.start('Draft', { flow });
      },
    });

    crispText(this, BASE_WIDTH / 2, BASE_HEIGHT * 0.7, MODE_HEADING, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: PALETTE.mutedText,
    }).setOrigin(0.5);
    this.redrawModeToggle();

    // Home spurs (stories 2.4 + 3.1, FR27/FR31/FR28): Help, Credits, History;
    // Settings arrives with its own story (deferred). Height stays the 44px
    // tap-target floor; width shrinks to fit three across a 360px viewport.
    this.spurButton(0, HOME_HELP_LABEL, () => this.scene.start('Help', { from: 'Home' }));
    this.spurButton(1, HOME_CREDITS_LABEL, () => this.scene.start('Credits'));
    this.spurButton(2, HOME_HISTORY_LABEL, () => this.scene.start('History'));
  }

  /** One of the three Home spur buttons (Help / Credits / History) — 3-across row, ≥44px targets. */
  private spurButton(index: number, label: string, onTap: () => void) {
    const startX = (BASE_WIDTH - (SPUR_COUNT * SPUR_BUTTON_WIDTH + (SPUR_COUNT - 1) * MODE_BUTTON_GAP)) / 2;
    const x = startX + index * (SPUR_BUTTON_WIDTH + MODE_BUTTON_GAP) + SPUR_BUTTON_WIDTH / 2;
    addButton(this, x, BASE_HEIGHT * 0.9, { width: SPUR_BUTTON_WIDTH, height: MODE_BUTTON_HEIGHT, label, onTap });
  }

  /** The Standard/Wipeout toggle (story 1.10, AC2) — a real player-facing choice, redrawn on change. */
  private redrawModeToggle() {
    for (const obj of this.modeUi) obj.destroy();
    this.modeUi = [];

    // Wipeout on the LEFT and default-selected (Danilo, 2026-07-19); Standard right.
    const options: { mode: Mode; label: string }[] = [
      { mode: 'wipeout', label: MODE_WIPEOUT_LABEL },
      { mode: 'single', label: MODE_STANDARD_LABEL },
    ];
    const w = MODE_BUTTON_WIDTH;
    const h = MODE_BUTTON_HEIGHT;
    const gap = MODE_BUTTON_GAP;
    const startX = (BASE_WIDTH - (2 * w + gap)) / 2;
    const y = BASE_HEIGHT * 0.76;

    options.forEach((opt, i) => {
      const selected = this.mode === opt.mode;
      const x = startX + i * (w + gap) + w / 2;
      const btn = addButton(this, x, y, {
        width: w,
        height: h,
        label: opt.label,
        style: selected ? 'primary' : 'default',
        onTap: () => {
          this.mode = opt.mode;
          this.redrawModeToggle();
        },
      });
      this.modeUi.push(...btn.parts);
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
