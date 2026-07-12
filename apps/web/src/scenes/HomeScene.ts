import { Scene } from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, GAME_NAME, HOME_PLAY_LABEL } from '../config/constants';

export class HomeScene extends Scene {
    constructor() {
        super('Home');
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        this.add
            .text(BASE_WIDTH / 2, BASE_HEIGHT * 0.3, GAME_NAME, {
                fontFamily: 'Arial Black',
                fontSize: '32px',
                color: '#e8d5a3',
                align: 'center',
                wordWrap: { width: BASE_WIDTH - 40 },
            })
            .setOrigin(0.5);

        // Disabled until story 1.8 wires the Draft scene.
        const button = this.add
            .rectangle(BASE_WIDTH / 2, BASE_HEIGHT * 0.62, 220, 56, 0x3a3a4e)
            .setStrokeStyle(2, 0x55556a);

        this.add
            .text(button.x, button.y, HOME_PLAY_LABEL, {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#77778a',
            })
            .setOrigin(0.5);

        this.add
            .text(button.x, button.y + 48, 'coming soon', {
                fontFamily: 'Arial',
                fontSize: '12px',
                color: '#55556a',
            })
            .setOrigin(0.5);
    }
}
