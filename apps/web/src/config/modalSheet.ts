import { GameObjects, Scene } from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH, PALETTE } from './constants';
import { addFramedPanel, crispText } from './ui';

/** The geometry a modal sheet needs — UNIT_CARD, STATS_CARD, and SUMMARY_CARD all satisfy it (any consumer's constant can). */
export interface SheetGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
  pad: number;
  closeSize: number;
}

/**
 * The modal-sheet SHELL (story 5.7 extraction from the 5.6 unit-data card;
 * consumers: the unit-data card, the per-unit stats sheet, the battle summary): scrim + opaque plate +
 * gold 9-slice frame + sheet input-blocker + the ✕, with the ARMED close
 * handshake the 5.6 review mandated. Content is the caller's job; this shell
 * owns only chrome and dismissal.
 *
 * THE CLOSE HANDSHAKE (5.6 review, 2026-07-29 — the history is load-bearing):
 * `armed` flips on a pointerDOWN that happens while the sheet is up, and only
 * an armed pointerUP closes. The press that OPENED the sheet (a long-press —
 * its pointerdown predates the scrim) releases unarmed and is swallowed by
 * the live scrim; a dismissing tap is consumed down AND up by the scrim/✕
 * BEFORE the caller's one-tick-deferred destroy, so its release can never
 * fall through onto live controls beneath (the pre-review bug: a scene-side
 * consume flag went stale — the opening release never reached the unit — and
 * was accidentally masking exactly that fall-through, whose worst case
 * REMOVED a Draft tray unit on dismiss). Do not "simplify" this to a
 * pointerdown-close or a scene-side flag.
 *
 * CALLER CONTRACT: keep the returned objects and destroy them to close —
 * DEFERRED one tick when closing from an input handler (never destroy the
 * dispatching object); reset the kept array in `create()` (singleton scenes);
 * and render ALL content at `SHEET_CONTENT_DEPTH` — the shell's depth band is
 * load-bearing: scrim 300, plate/frame/blocker 301, content 302, ✕ 303. A
 * consumer above 303 buries the close button under its own content; below
 * 302, under the plate. The shell appears statically — nothing to damp under
 * reduced motion.
 */
/** The depth every consumer renders its content at — between the shell's input blocker (301) and its ✕ (303). */
export const SHEET_CONTENT_DEPTH = 302;

export function addModalSheet(scene: Scene, geom: SheetGeometry, requestClose: () => void): GameObjects.GameObject[] {
  const objs: GameObjects.GameObject[] = [];
  let armed = false;
  const arm = () => {
    armed = true;
  };
  // Consume-on-read (5.7 review): `armed` must never survive a pair that
  // didn't close — a down on the scrim whose release lands on the sheet
  // blocker used to leave the flag set, and a LATER sheet-to-scrim drag
  // release would then close unexpectedly.
  const closeIfArmed = () => {
    const wasArmed = armed;
    armed = false;
    if (wasArmed) requestClose();
  };

  // The modal scrim: swallows every tap outside the sheet (topOnly input —
  // nothing beneath can hear anything) and closes on an armed pair.
  objs.push(
    scene.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000, 0.6)
      .setDepth(300)
      .setInteractive()
      .on('pointerdown', arm)
      .on('pointerup', closeIfArmed),
  );
  // An OPAQUE plate first (the 5.6 device pass: the frame art's dark centre
  // is not load-bearing over busy content), then the gold 9-slice frame,
  // then an input blocker so a tap ON the sheet is a no-op rather than
  // falling through to the scrim's close.
  objs.push(
    scene.add
      .rectangle(geom.x + 3, geom.y + 3, geom.w - 6, geom.h - 6, PALETTE.buttonFill, 1)
      .setOrigin(0, 0)
      .setDepth(301),
  );
  objs.push(addFramedPanel(scene, geom.x, geom.y, geom.w, geom.h, { origin: [0, 0] }).setDepth(301));
  // The sheet blocker also DISARMS (5.7 review): a down that ends up on the
  // sheet is not a dismissal pair, whichever half of it the sheet received.
  objs.push(
    scene.add
      .rectangle(geom.x, geom.y, geom.w, geom.h, 0, 0)
      .setOrigin(0, 0)
      .setDepth(301)
      .setInteractive()
      .on('pointerdown', () => {
        armed = false;
      }),
  );

  // The ✕ — FR30's 44px floor as an invisible zone over an 18px glyph.
  objs.push(
    crispText(scene, geom.x + geom.w - geom.pad - 8, geom.y + geom.pad + 8, '✕', { fontFamily: 'Arial', fontSize: '18px', color: PALETTE.mutedText })
      .setOrigin(0.5)
      .setDepth(303),
  );
  objs.push(
    scene.add
      .rectangle(geom.x + geom.w - geom.pad - 8, geom.y + geom.pad + 8, geom.closeSize, geom.closeSize, 0, 0)
      .setDepth(303)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', arm)
      .on('pointerup', closeIfArmed),
  );

  return objs;
}
