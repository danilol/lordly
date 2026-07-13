import { AUTO, Game, Scale } from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, GAME_NAME, PALETTE } from './config/constants';
import { showInitFallback } from './flow/initFallback';
import { HomeScene } from './scenes/HomeScene';
import { DraftScene } from './scenes/DraftScene';
import { PlacementScene } from './scenes/PlacementScene';
import { RevealScene } from './scenes/RevealScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';

document.addEventListener('DOMContentLoaded', () => {
  document.title = GAME_NAME;

  // Phaser boots ASYNCHRONOUSLY: `new Game()` returns before WebGL-context
  // acquisition and scene `create()` run, so the sync try/catch below catches
  // only constructor-time throws. This backstop catches the async failure
  // modes (context loss, a throwing create()) that are the real "silent blank
  // page" causes AC5 targets. Registered before construction so nothing races.
  window.addEventListener('error', (event) => showInitFallback(document, event.error ?? event.message));

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
    // `type: AUTO` already falls back Canvas→WebGL; this covers a constructor
    // that throws outright (bad config, no canvas support at all).
    showInitFallback(document, error);
  }
});
