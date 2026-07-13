import { Scene } from 'phaser';
import {
    BASE_HEIGHT,
    BASE_WIDTH,
    BUTTON_HEIGHT,
    BUTTON_WIDTH,
    GAME_NAME,
    HOME_PLAY_LABEL,
    PALETTE,
} from '../config/constants';
import { MatchFlow } from '../flow/MatchFlow';

export class HomeScene extends Scene {
    constructor() {
        super('Home');
    }

    create() {
        this.cameras.main.setBackgroundColor(PALETTE.background);

        this.add
            .text(BASE_WIDTH / 2, BASE_HEIGHT * 0.3, GAME_NAME, {
                fontFamily: 'Arial Black',
                fontSize: '32px',
                color: PALETTE.title,
                align: 'center',
                wordWrap: { width: BASE_WIDTH - 40 },
            })
            .setOrigin(0.5);

        // Enabled (story 1.8): starts a fresh match and enters the Draft scene.
        const button = this.add
            .rectangle(BASE_WIDTH / 2, BASE_HEIGHT * 0.62, BUTTON_WIDTH, BUTTON_HEIGHT, PALETTE.buttonFillEnabled)
            .setStrokeStyle(2, PALETTE.buttonStrokeEnabled)
            .setInteractive({ useHandCursor: true });

        this.add
            .text(button.x, button.y, HOME_PLAY_LABEL, {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: PALETTE.buttonText,
            })
            .setOrigin(0.5);

        button.on('pointerup', () => {
            // MatchFlow owns match truth and is passed EXPLICITLY between scenes
            // (AD-5) — never via the Phaser registry. A fresh flow per Play tap;
            // story 1.9's Result→Rematch reuses the flow and calls startMatch again.
            const flow = new MatchFlow();
            flow.startMatch();
            this.scene.start('Draft', { flow });
        });
    }
}
