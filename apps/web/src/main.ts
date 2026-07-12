import StartGame from './game/main';
import { GAME_NAME } from './config/constants';

document.addEventListener('DOMContentLoaded', () => {

    document.title = GAME_NAME;

    StartGame('game-container');

});
