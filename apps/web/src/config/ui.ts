import { GameObjects, Scene, Types } from 'phaser';
import type { Element, UnitClass } from '@lordly/engine';
import { backingScaleFor, BASE_HEIGHT, BASE_WIDTH, ELEMENT_BADGE_RADIUS, ELEMENT_COLORS, HOME_BACK_LABEL, PALETTE, TEXT_RESOLUTION } from './constants';
import { UNITS_SHEET_KEY, UNIT_FRAMES } from './sprites';

/**
 * The backing-store scale (story 4.0 text-ceiling fix): the pure rule is
 * `backingScaleFor` (config/constants.ts — rounded DPR, capped, tested); this
 * wrapper feeds it the real devicePixelRatio. Read at boot for the Game size
 * and per scene for the camera zoom — the two MUST agree, so the first
 * real-window read is MEMOIZED for the session (the `textResolution` pattern
 * below): the Game's backing store is fixed at construction and cannot follow
 * a later devicePixelRatio change (browser zoom, cross-monitor drag), so the
 * per-scene camera zoom must keep using the boot-time value or the two desync
 * — a stale-DPR camera would clip or shrink the stage (4.0 review). A resize/
 * DPR-change re-sharpen pass stays deferred (deferred-work.md, story-2.0
 * review) — this freeze is that same fence, applied consistently.
 */
let cachedBackingScale: number | undefined;
export function backingScale(): number {
  if (cachedBackingScale !== undefined) return cachedBackingScale;
  if (typeof window === 'undefined') return 1; // SSR/test: don't memoize
  cachedBackingScale = backingScaleFor(window.devicePixelRatio || 1);
  return cachedBackingScale;
}

/**
 * Points a scene's main camera at the 360×640 LOGICAL stage on the DPR-sized
 * backing store (story 4.0): zoom = backingScale, centered on the logical
 * midpoint, so every existing coordinate keeps meaning what it always meant.
 * Called in every scene's create() right after the background color — a scene
 * that skips it would render its content at 1/scale size in the corner.
 * At scale 1 (DPR-1 desktop) this is exactly a no-op.
 */
export function applyHiDpiCamera(scene: Scene): void {
  const scale = backingScale();
  if (scale === 1) return;
  scene.cameras.main.setZoom(scale);
  scene.cameras.main.centerOn(BASE_WIDTH / 2, BASE_HEIGHT / 2);
}

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
/**
 * Reduced-motion preference (EXPERIENCE.md Accessibility Floor): scenes damp
 * non-essential travel/flourishes while keeping the information-bearing
 * beats/values. Read at each scene's create() so an OS change applies from
 * the next scene entry (2.2 review). Guarded for node/test environments.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia !== undefined && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The FR3 element badge — one solid 12px dot, identical in every scene
 * (story 2.1). Always a dot, never a border or fill: side identity owns
 * borders and HP fills; this dot is the ONLY place element color appears
 * on a unit. Building it here keeps the treatment from drifting per scene.
 */
export function addElementBadge(scene: Scene, x: number, y: number, element: Element): GameObjects.Arc {
  return scene.add.circle(x, y, ELEMENT_BADGE_RADIUS, ELEMENT_COLORS[element]);
}

/**
 * A unit's class sprite off the shared spritesheet (story 2.1, AD-11: sprites
 * are shell-side lookups keyed by engine class). Callers pass a display size
 * that is an INTEGER multiple of UNIT_FRAME_SIZE (32/64/…) — pixel art blurs
 * at fractional scales.
 */
export function addUnitSprite(scene: Scene, x: number, y: number, cls: UnitClass, displaySize: number): GameObjects.Sprite {
  const sprite = scene.add.sprite(x, y, UNITS_SHEET_KEY, UNIT_FRAMES[cls]);
  sprite.setDisplaySize(displaySize, displaySize);
  return sprite;
}

export function addHomeBack(scene: Scene): GameObjects.Rectangle {
  return addBackAffordance(scene, HOME_BACK_LABEL, () => scene.scene.start('Home'));
}

/**
 * The generalized top-left back affordance (story 2.4): same padded hit-area
 * pattern as `addHomeBack`, but with a caller-chosen label and destination —
 * the Help scene dismisses to its ORIGIN (Home or Draft), not always Home.
 */
export function addBackAffordance(scene: Scene, label: string, onTap: () => void, depth = 0): GameObjects.Rectangle {
  const text = crispText(scene, 44, 22, label, {
    fontFamily: 'Arial',
    fontSize: '13px',
    color: PALETTE.mutedText,
  })
    .setOrigin(0.5)
    .setDepth(depth);
  // 44px tall — the FR30 minimum tap target (review: 36px fell short of AC4's explicit floor).
  const hitArea = scene.add.rectangle(text.x, text.y, 72, 44, 0, 0).setDepth(depth).setInteractive({ useHandCursor: true }).on('pointerup', onTap);
  return hitArea;
}

/**
 * Touch-drag + mouse-wheel scrolling for a content container (story 2.4
 * review — extracted from Help so Credits scrolls too, and desktop gets a
 * wheel path). Clamped to [viewTop − overflow, viewTop]; content shorter
 * than the viewport pins in place. Returns `wasDrag()` — true when the
 * current pointer gesture moved beyond the tap threshold — so tap targets
 * (e.g. the back affordance) can ignore a pointerup that ends a scroll
 * (review: a drag releasing over ‹ Back ejected the reader mid-scroll).
 */
export function enableDragScroll(scene: Scene, content: GameObjects.Container, viewTop: number, contentHeight: number, viewBottom: number): () => boolean {
  const minY = Math.min(viewTop, viewBottom - contentHeight);
  const clamp = (y: number) => Math.max(minY, Math.min(viewTop, y));
  let dragStartY = 0;
  let contentStartY = 0;
  let dragDistance = 0;
  // Raw pointer coords are BACKING-store pixels; content.y is LOGICAL. Under
  // the story-4.0 hi-DPI camera the two differ by the zoom factor — divide
  // deltas so a finger-length drag scrolls the same distance at any DPR.
  // (Deltas only: the camera's centerOn offset cancels out of differences.)
  const logicalDelta = (rawDelta: number) => rawDelta / (scene.cameras.main.zoom || 1);
  scene.input.on('pointerdown', (pointer: { y: number }) => {
    dragStartY = pointer.y;
    contentStartY = content.y;
    dragDistance = 0;
  });
  scene.input.on('pointermove', (pointer: { y: number; isDown: boolean }) => {
    if (!pointer.isDown) return;
    dragDistance = Math.max(dragDistance, Math.abs(logicalDelta(pointer.y - dragStartY)));
    content.y = clamp(contentStartY + logicalDelta(pointer.y - dragStartY));
  });
  scene.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
    content.y = clamp(content.y - dy);
  });
  return () => dragDistance > 8;
}
