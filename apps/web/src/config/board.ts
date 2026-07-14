import { Scene } from 'phaser';
import type { Side } from '@lordly/engine';
import { boardTiles, DEFAULT_ORIENTATION } from '../flow/battleView';
import type { BoardOrientation } from '../flow/battleView';
import { ISO_BOARD, ISO_TILES } from './constants';

/**
 * Draws one side's tilted 3×3 iso checkerboard (story 2.2, ADR-0001) — pure
 * procedural geometry, zero art. Tiles color-code the side (blue = you,
 * red = enemy) alternating with the neutral tile, stroked in gold-deep; the
 * three FRONT tiles are brighter with a gold-lite edge (the front-row
 * indicator). Shared by the Reveal and Battle scenes so the component cannot
 * drift. One static Graphics object per board, drawn ONCE at create (NFR1:
 * no per-frame work). Graphics path calls are used deliberately — Phaser 4's
 * Polygon shape rendered these quads as triangles (verified by screenshot).
 */
export function drawIsoBoard(scene: Scene, side: Side, orientation: BoardOrientation = DEFAULT_ORIENTATION): void {
  const halfW = ISO_BOARD.tileW / 2;
  const halfH = ISO_BOARD.tileH / 2;
  const g = scene.add.graphics().setDepth(-10); // always beneath units (unit depth = screen y)

  // Front tiles draw LAST so their gold-lite edge is never overdrawn by a neighbor.
  const tiles = [...boardTiles(side, orientation)].sort((a, b) => Number(a.front) - Number(b.front));
  for (const tile of tiles) {
    const sideFill = side === 'A' ? ISO_TILES.you : ISO_TILES.foe;
    const frontFill = side === 'A' ? ISO_TILES.youFront : ISO_TILES.foeFront;
    const fill = tile.front ? frontFill : tile.checker ? sideFill : ISO_TILES.neutral;
    g.fillStyle(fill, 1);
    g.lineStyle(tile.front ? 2 : 1, tile.front ? ISO_TILES.frontStroke : ISO_TILES.stroke, 1);
    g.beginPath();
    g.moveTo(tile.x, tile.y - halfH);
    g.lineTo(tile.x + halfW, tile.y);
    g.lineTo(tile.x, tile.y + halfH);
    g.lineTo(tile.x - halfW, tile.y);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }
}
