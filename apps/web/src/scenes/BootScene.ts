import { Scene, Textures } from 'phaser';
import { ALL_CLASSES } from '@lordly/engine';
import unitsUrl from '../assets/units.png';
import { UNITS_SHEET_KEY, UNIT_FRAME_SIZE } from '../config/sprites';
import { showInitFallback } from '../flow/initFallback';

/**
 * Boot scene (story 2.1, AC4): the codebase's first asset-loading path. Loads
 * the unit spritesheet BEFORE any scene that renders units, then hands off to
 * Home. First in the FSM (main.ts scene list) so every later scene can assume
 * the texture exists. The sheet is Vite-imported from src/assets — the spine's
 * declared asset home (at its current size it ships INLINED as a data-URI, so
 * a load failure implies the whole bundle is broken — rare, but guarded).
 *
 * A failed or wrong-shaped load is a real "silent broken game" risk (the very
 * failure mode the story 2.0 backstop targets), so both paths route to the
 * plain-DOM fallback AND stop the FSM — create() never boots a game whose
 * units would render as missing-texture placeholders (review finding, 2.1).
 */
export class BootScene extends Scene {
  /** Set by the loaderror handler; create() must not boot a spriteless game. */
  private loadFailed = false;

  constructor() {
    super('Boot');
  }

  preload() {
    this.load.once('loaderror', (file: { key?: string }) => {
      this.loadFailed = true;
      showInitFallback(document, new Error(`asset failed to load: ${file?.key ?? 'unknown'}`));
    });
    this.load.spritesheet(UNITS_SHEET_KEY, unitsUrl, { frameWidth: UNIT_FRAME_SIZE, frameHeight: UNIT_FRAME_SIZE });
  }

  create() {
    if (this.loadFailed) return; // fallback already shown — do not also start a broken game

    // A wrong-sized sheet loads WITHOUT loaderror and silently slices the
    // wrong frame count (missing frames fall back to frame 0, so classes
    // would render duplicate sprites). Validate the slice before booting.
    // frameTotal counts Phaser's synthetic __BASE frame, hence the -1.
    const frames = this.textures.get(UNITS_SHEET_KEY).frameTotal - 1;
    if (frames !== ALL_CLASSES.length) {
      showInitFallback(document, new Error(`units sheet sliced to ${frames} frames, expected ${ALL_CLASSES.length}`));
      return;
    }

    // Nearest-neighbor for the pixel-art sheet ONLY (not a global pixelArt
    // flag — that degraded crispText labels on Danilo's device, see main.ts).
    // Sprites keep hard retro pixels under Scale.FIT; text stays LINEAR.
    this.textures.get(UNITS_SHEET_KEY).setFilter(Textures.FilterMode.NEAREST);
    this.scene.start('Home');
  }
}
