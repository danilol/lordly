import { Scene, Textures } from 'phaser';
import unitsUrl from '../assets/units.png';
import { UNIT_FRAMES, UNITS_SHEET_KEY, UNIT_FRAME_SIZE } from '../config/sprites';
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
  // DELIBERATE EXCLUSION (story 4.0): Boot is the one scene that does NOT call
  // applyHiDpiCamera — it renders no game objects (success path starts Home
  // immediately; failure paths render plain DOM via showInitFallback). If this
  // scene ever gains a rendered object (loading bar, splash), add the
  // applyHiDpiCamera(this) call like every other scene, or it will draw at
  // 1/scale in the top-left corner on any DPR>1 device.

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
    // The bar is "every frame UNIT_FRAMES references exists" — story 4.3's
    // wave-1 newcomers ride INTERIM shared frames (sprites.ts), so the sheet
    // need only cover the highest referenced index; when dedicated tiles land
    // (frames 6–10) this bar auto-tightens to the full 11.
    const requiredFrames = Math.max(...Object.values(UNIT_FRAMES)) + 1;
    const frames = this.textures.get(UNITS_SHEET_KEY).frameTotal - 1;
    if (frames < requiredFrames) {
      showInitFallback(document, new Error(`units sheet sliced to ${frames} frames, need at least ${requiredFrames}`));
      return;
    }

    // Nearest-neighbor for the pixel-art sheet ONLY (not a global pixelArt
    // flag — that degraded crispText labels on Danilo's device, see main.ts).
    // Sprites keep hard retro pixels under Scale.FIT; text stays LINEAR.
    this.textures.get(UNITS_SHEET_KEY).setFilter(Textures.FilterMode.NEAREST);
    this.scene.start('Home');
  }
}
