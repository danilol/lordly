import { GameObjects, Scene, Types } from 'phaser';
import { TEXT_RESOLUTION } from './constants';

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
