import { AUTO, Game, Scale } from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, GAME_NAME, PALETTE } from './config/constants';
import { HomeScene } from './scenes/HomeScene';
import { DraftScene } from './scenes/DraftScene';
import { PlacementScene } from './scenes/PlacementScene';
import { RevealScene } from './scenes/RevealScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';

document.addEventListener('DOMContentLoaded', () => {

    document.title = GAME_NAME;

    new Game({
        type: AUTO,
        parent: 'game-container',
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        backgroundColor: PALETTE.background,
        scale: {
            mode: Scale.FIT,
            autoCenter: Scale.CENTER_BOTH,
        },
        scene: [HomeScene, DraftScene, PlacementScene, RevealScene, BattleScene, ResultScene],
    });

});
