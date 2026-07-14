import { AUTO, Game, Scale } from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, GAME_NAME, PALETTE } from './config/constants';
import { showInitFallback } from './flow/initFallback';
import { BootScene } from './scenes/BootScene';
import { HomeScene } from './scenes/HomeScene';
import { DraftScene } from './scenes/DraftScene';
import { PlacementScene } from './scenes/PlacementScene';
import { RevealScene } from './scenes/RevealScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';
import { HelpScene } from './scenes/HelpScene';
import { CreditsScene } from './scenes/CreditsScene';

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
      // Story 2.1: NO global `pixelArt: true`. It was tried first and FAILED
      // the on-device check (Danilo's phone): global nearest-neighbor also
      // resamples the supersampled crispText glyph textures, making labels
      // ragged and hard to read — and no `?textres=N` value can fix NEAREST's
      // fractional-phase sampling. Instead the Boot scene sets NEAREST on the
      // unit spritesheet TEXTURE alone: sprites keep hard retro pixels, text
      // keeps the story-2.0 LINEAR path that passed device acceptance.
      scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
      },
      scene: [BootScene, HomeScene, DraftScene, PlacementScene, RevealScene, BattleScene, ResultScene, HelpScene, CreditsScene],
    });
  } catch (error) {
    // `type: AUTO` already falls back Canvas→WebGL; this covers a constructor
    // that throws outright (bad config, no canvas support at all).
    showInitFallback(document, error);
  }
});
