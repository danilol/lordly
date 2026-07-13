import { GameObjects, Scene, Types } from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, HOME_BACK_LABEL, PALETTE, TEXT_RESOLUTION } from './constants';

/**
 * The text render resolution (story 2.0 AC2 — the accessibility fix for the
 * real-device blur). A glyph texture is only sharp when it carries at least
 * one texture pixel per PHYSICAL screen pixel, and the physical magnification
 * of the 360×640 base ≈ `Scale.FIT zoom × devicePixelRatio` — NOT DPR alone.
 * (The 1.8 fixed ×3 was blind to both; a DPR-only fix still blurs on a large
 * window, where FIT zoom runs well past 1 — Danilo's laptop.) `TEXT_RESOLUTION`
 * is the floor, 8 caps texture memory. `?textres=N` overrides for on-device
 * comparison (a diagnostic, not a player setting).
 *
 * Resolved LAZILY on first use and memoized: `crispText` first runs inside a
 * scene's `create()`, which is well after layout, so `innerWidth/innerHeight`
 * are real. Computing at module-import time (before layout) risked a 0×0
 * viewport flooring `fitZoom` to 1 and locking a blurry resolution for the
 * session. `fitZoom` is approximated from the viewport rather than the Phaser
 * parent element; any error is in the safe direction (over-estimate → sharper,
 * capped at 8 — never blur). NOTE: memoized once — a resize/rotation that
 * changes the zoom does not re-sharpen existing labels (deferred; see
 * deferred-work.md → story-2.0 review).
 */
let cachedResolution: number | undefined;
function textResolution(): number {
  if (cachedResolution !== undefined) return cachedResolution;
  if (typeof window === 'undefined') return TEXT_RESOLUTION; // SSR/test: don't memoize
  const param = new URLSearchParams(window.location.search).get('textres');
  const override = param === null ? NaN : Number(param);
  const fitZoom = Math.max(1, Math.min(window.innerWidth / BASE_WIDTH, window.innerHeight / BASE_HEIGHT));
  const dpr = window.devicePixelRatio || 1;
  cachedResolution = Number.isFinite(override) && override >= 1 && override <= 8 ? override : Math.min(8, Math.max(TEXT_RESOLUTION, fitZoom * dpr));
  // Diagnostic gated behind ?textres so the device comparison keeps its
  // readout without polluting the normal production console (story 2.0 review).
  if (param !== null) {
    console.info(`[lordly] textResolution=${cachedResolution.toFixed(2)} (devicePixelRatio=${dpr}, fitZoom=${fitZoom.toFixed(2)})`);
  }
  return cachedResolution;
}

/**
 * Adds a text object rendered at the resolved resolution so it stays sharp
 * under the Scale.FIT canvas upscaling (the base game is 360×640; the browser
 * stretches it, which blurs text drawn at 1× resolution). Every scene builds
 * its labels through this so the crispness fix lives in exactly one place.
 */
export function crispText(scene: Scene, x: number, y: number, text: string | string[], style?: Types.GameObjects.Text.TextStyle): GameObjects.Text {
  return scene.add.text(x, y, text, style).setResolution(textResolution());
}

/**
 * Adds a top-left "‹ Home" tap target that returns to the Home scene. Every
 * post-Home scene calls this so there is a Home affordance from everywhere —
 * closing the one-way dead-end story 1.8 deferred to 1.9. Home builds a fresh
 * `MatchFlow` on its Play button, so returning here safely abandons the match.
 *
 * The hit area is a padded rectangle behind the label, not the bare text —
 * matching FR30's "large tap targets" and every other button in this codebase.
 */
export function addHomeBack(scene: Scene): GameObjects.Rectangle {
  const label = crispText(scene, 44, 22, HOME_BACK_LABEL, {
    fontFamily: 'Arial',
    fontSize: '13px',
    color: PALETTE.mutedText,
  }).setOrigin(0.5);
  const hitArea = scene.add
    .rectangle(label.x, label.y, 72, 36, 0, 0)
    .setInteractive({ useHandCursor: true })
    .on('pointerup', () => scene.scene.start('Home'));
  return hitArea;
}
