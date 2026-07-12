import { AUTO, Game, Scale } from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, GAME_NAME } from './config/constants';
import { HomeScene } from './scenes/HomeScene';

document.addEventListener('DOMContentLoaded', () => {

    document.title = GAME_NAME;

    new Game({
        type: AUTO,
        parent: 'game-container',
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        backgroundColor: '#1a1a2e',
        scale: {
            mode: Scale.FIT,
            autoCenter: Scale.CENTER_BOTH,
        },
        scene: [HomeScene],
    });

});
