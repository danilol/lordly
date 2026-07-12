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

        // Disabled until story 1.8 wires the Draft scene.
        const button = this.add
            .rectangle(BASE_WIDTH / 2, BASE_HEIGHT * 0.62, BUTTON_WIDTH, BUTTON_HEIGHT, PALETTE.buttonFill)
            .setStrokeStyle(2, PALETTE.buttonStroke);

        this.add
            .text(button.x, button.y, HOME_PLAY_LABEL, {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: PALETTE.buttonTextDisabled,
            })
            .setOrigin(0.5);
    }
}
