import { Scene } from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, PALETTE, REVEAL_PLACEHOLDER } from '../config/constants';
import { crispText } from '../config/ui';
import type { MatchFlow } from '../flow/MatchFlow';

/**
 * Story 1.8 post-submit SEAM (scope fence): the match is committed, but the
 * real Reveal → Battle → Result arrives in story 1.9. This stub renders NO
 * part of the AI's board (FR5/FR24 — nothing of the opponent shows before
 * the real Reveal); it only confirms the commit so the app stays runnable
 * and demonstrable end to end.
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

    // Read state ONLY to confirm a setup was committed — never to render the
    // opponent's composition/placement (that is story 1.9's Reveal).
    const committed = this.flow.getState().phase === 'committed';

    crispText(this, BASE_WIDTH / 2, BASE_HEIGHT * 0.4, committed ? REVEAL_PLACEHOLDER : 'No match committed.', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: PALETTE.bodyText,
      align: 'center',
      wordWrap: { width: BASE_WIDTH - 48 },
    }).setOrigin(0.5);
  }
}
