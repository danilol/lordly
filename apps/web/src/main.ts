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

  try {
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
  } catch (error) {
    // Total init failure (story 2.0 AC5): `type: AUTO` already falls back to
    // Canvas, but if Game construction itself throws the player used to get a
    // silent blank page. Plain-DOM fallback — no Phaser on this path.
    console.error('[lordly] game init failed', error);
    const container = document.getElementById('game-container');
    if (container) {
      container.innerHTML = '';
      const message = document.createElement('p');
      message.textContent = `${GAME_NAME} failed to start — your browser may not support it. Try a different or updated browser.`;
      message.style.cssText = `color: ${PALETTE.bodyText}; background: ${PALETTE.background}; font: 16px Arial, sans-serif; padding: 24px; text-align: center; margin: 0;`;
      container.appendChild(message);
    }
  }
});
