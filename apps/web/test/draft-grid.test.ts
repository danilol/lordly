import { describe, expect, it } from 'vitest';
import { ALL_CLASSES, CLASS_SEX } from '@lordly/engine';
import { BASE_WIDTH, CLASS_DISPLAY_NAME, DRAFT_DETAIL, DRAFT_GRID, draftGridBottom, draftGridTile } from '../src/config/constants';

/**
 * Story 5.4 AC2 — the Draft icon grid scales to the full class count. The
 * 12-class era's 4×80px grid measurably could NOT hold 17 (5 rows ended at
 * y=422 against a detail panel at y=300); this pins the re-laid geometry as
 * arithmetic, so the next roster wave fails HERE instead of on a device.
 */
describe('Draft grid geometry (story 5.4 re-lay) — 17 classes fit, with the detail panel and tray untouched below', () => {
  const count = ALL_CLASSES.length;

  it('the full roster’s grid ends ABOVE the detail panel (the 12-class layout collided by 122px)', () => {
    expect(draftGridBottom(count)).toBeLessThanOrEqual(DRAFT_DETAIL.y);
  });

  it('every tile stays inside the 360px canvas', () => {
    for (let i = 0; i < count; i++) {
      const { x, y } = draftGridTile(i);
      expect(x, `tile ${i} left`).toBeGreaterThanOrEqual(0);
      expect(x + DRAFT_GRID.tileW, `tile ${i} right`).toBeLessThanOrEqual(BASE_WIDTH);
      expect(y, `tile ${i} top`).toBeGreaterThanOrEqual(DRAFT_GRID.startY);
    }
  });

  it('tiles keep the FR30 44px tap floor in BOTH dimensions', () => {
    expect(DRAFT_GRID.tileW).toBeGreaterThanOrEqual(44);
    expect(DRAFT_GRID.tileH).toBeGreaterThanOrEqual(44);
  });

  it('tiles never overlap: the gaps are non-negative and columns×width+gaps stays inside the canvas', () => {
    expect(DRAFT_GRID.gapX).toBeGreaterThanOrEqual(0);
    expect(DRAFT_GRID.gapY).toBeGreaterThanOrEqual(0);
    const rowWidth = DRAFT_GRID.startX + DRAFT_GRID.cols * DRAFT_GRID.tileW + (DRAFT_GRID.cols - 1) * DRAFT_GRID.gapX;
    expect(rowWidth).toBeLessThanOrEqual(BASE_WIDTH);
  });

  it('the detail panel clears the army-tray label (y=426 — its 12px line needs headroom above)', () => {
    expect(DRAFT_DETAIL.y + DRAFT_DETAIL.h).toBeLessThanOrEqual(420);
    expect(DRAFT_DETAIL.x + DRAFT_DETAIL.w).toBeLessThanOrEqual(BASE_WIDTH);
  });

  it('every display name fits the tile in at most two 8px lines (the wordWrap budget the tile height allows)', () => {
    // ~6.2px/char at 8px Arial Black against the 58px wrap width: a single
    // WORD longer than 9 characters cannot wrap and would clip. "Mercenary"
    // (9) is the longest legal word; "Dragon Hunter" wraps at the space.
    for (const cls of ALL_CLASSES) {
      for (const word of CLASS_DISPLAY_NAME[cls].split(' ')) {
        expect(word.length, `${cls}: "${word}" must fit one 58px line at 8px`).toBeLessThanOrEqual(9);
      }
      expect(CLASS_DISPLAY_NAME[cls].split(' ').length, `${cls}: at most two lines`).toBeLessThanOrEqual(2);
    }
  });

  it('sanity: the roster really is 17 and every class has a name-table sex (the exhaustive-Record chain holds)', () => {
    expect(ALL_CLASSES.length).toBe(17);
    for (const cls of ALL_CLASSES) expect(['m', 'f', 'c']).toContain(CLASS_SEX[cls]);
  });
});
