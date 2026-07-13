import { GameObjects, Scene, Types } from 'phaser';
import { HOME_BACK_LABEL, PALETTE, TEXT_RESOLUTION } from './constants';

/**
 * Adds a text object rendered at `TEXT_RESOLUTION` so it stays sharp under
 * the Scale.FIT canvas upscaling (the base game is 360×640; the browser
 * stretches it, which blurs text drawn at 1× resolution). Every scene builds
 * its labels through this so the crispness fix lives in exactly one place.
 */
export function crispText(
  scene: Scene,
  x: number,
  y: number,
  text: string | string[],
  style?: Types.GameObjects.Text.TextStyle,
): GameObjects.Text {
  return scene.add.text(x, y, text, style).setResolution(TEXT_RESOLUTION);
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
