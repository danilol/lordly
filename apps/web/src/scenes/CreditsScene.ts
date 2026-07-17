import { Scene } from 'phaser';
import { ART_ATTRIBUTIONS } from '../assets/attribution';
import { BASE_HEIGHT, BASE_WIDTH, CREDITS_TITLE, HOME_BACK_LABEL, PALETTE } from '../config/constants';
import { applyHiDpiCamera, addBackAffordance, crispText, enableDragScroll } from '../config/ui';
import { formatCredits } from '../flow/credits';

const VIEW_TOP = 44;

/**
 * Credits scene (story 2.4, FR31, AD-5): the license-honoring surface for the
 * free/CC art that makes the zero-custom-art constraint work. Renders EVERY
 * pack from the attribution manifest via the pure `formatCredits` — a new
 * pack added to the manifest appears here with zero scene changes, and the
 * shared drag/wheel scroll (review) keeps that promise true past one screen.
 * Read-only (URLs are text, not links); dismissible by touch back to Home.
 */
export class CreditsScene extends Scene {
  constructor() {
    super('Credits');
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.background);
    applyHiDpiCamera(this);

    const content = this.add.container(0, VIEW_TOP);
    let y = 8;
    const title = crispText(this, BASE_WIDTH / 2, y, CREDITS_TITLE, { fontFamily: 'Arial Black', fontSize: '22px', color: PALETTE.title }).setOrigin(0.5, 0);
    content.add(title);
    y += title.height + 8;
    const tagline = crispText(this, BASE_WIDTH / 2, y, 'The artists whose free work makes this game possible.', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: PALETTE.mutedText,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 40 },
    }).setOrigin(0.5, 0);
    content.add(tagline);
    y += tagline.height + 28;

    for (const block of formatCredits(ART_ATTRIBUTIONS)) {
      const heading = crispText(this, 20, y, block.title, {
        fontFamily: 'Arial Black',
        fontSize: '15px',
        color: PALETTE.title,
        wordWrap: { width: BASE_WIDTH - 40 },
      }).setOrigin(0, 0);
      content.add(heading);
      y += heading.height + 6;
      for (const line of block.lines) {
        // useAdvancedWrap breaks long unbroken tokens (pack URLs) instead of overflowing the edge.
        const text = crispText(this, 28, y, line, {
          fontFamily: 'Arial',
          fontSize: '13px',
          color: PALETTE.bodyText,
          wordWrap: { width: BASE_WIDTH - 56, useAdvancedWrap: true },
        }).setOrigin(0, 0);
        content.add(text);
        y += text.height + 4;
      }
      y += 18;
    }

    const wasDrag = enableDragScroll(this, content, VIEW_TOP, y, BASE_HEIGHT - 16);
    this.add.rectangle(BASE_WIDTH / 2, VIEW_TOP / 2, BASE_WIDTH, VIEW_TOP, PALETTE.backgroundFill).setDepth(10);
    addBackAffordance(
      this,
      HOME_BACK_LABEL,
      () => {
        if (wasDrag()) return; // a scroll releasing over the affordance is not a tap
        this.scene.start('Home');
      },
      11,
    );
  }
}
