import { describe, expect, it } from 'vitest';
import { ALL_CLASSES, ALL_RACES, BALANCE, CLASS_SEX } from '@lordly/engine';
import { BASE_WIDTH, CLASS_DISPLAY_NAME, DRAFT_DETAIL, DRAFT_GRID, DRAFT_HINT_Y, DRAFT_TABS, draftGridBottom, draftGridTile } from '../src/config/constants';
import { ALL_DRAFT_TABS, DRAFT_TAB_LABELS, draftTabClasses, draftTabOf } from '../src/flow/draftModel';

/**
 * Story 5.5 AC2 — the Draft picker holds the roster through TABS, not through
 * one ever-taller grid. The measurement that forced this: 27 classes in the 5.4
 * geometry (5×62, five per row) need six rows and end at y=418, deep inside the
 * detail panel at y=310. Splitting into Humans/Monsters caps the tallest grid
 * at 16 tiles — four rows — which is what let the tiles go back to being WIDE
 * (4×80), the size the 10-character monster names actually need.
 *
 * Everything below is pinned PER TAB. The next roster wave fails here, on
 * arithmetic, instead of on a device.
 */
describe('Draft grid geometry (story 5.5 tabs) — every tab fits, with the detail panel and tray untouched below', () => {
  const tabCounts = ALL_DRAFT_TABS.map((tab) => draftTabClasses(tab).length);
  const largestTab = Math.max(...tabCounts);

  it('EVERY tab’s grid ends above the detail panel — the bound is now per-tab, never the whole roster', () => {
    for (const tab of ALL_DRAFT_TABS) {
      expect(draftGridBottom(draftTabClasses(tab).length), `${tab} tab`).toBeLessThanOrEqual(DRAFT_DETAIL.y);
    }
    // And the whole roster in ONE grid still does NOT fit — the measurement
    // that justifies the tabs. If a future wave makes this pass (a shorter
    // roster, a taller canvas), the tab split is no longer load-bearing and
    // this assertion is the place that says so.
    expect(draftGridBottom(ALL_CLASSES.length), 'the whole roster in one grid').toBeGreaterThan(DRAFT_DETAIL.y);
  });

  it('every tile of the largest tab stays inside the 360px canvas', () => {
    for (let i = 0; i < largestTab; i++) {
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
    // ~6.2px/char at 8px Arial Black against the (tileW − 4) wrap width.
    // Phaser's word wrap never breaks INSIDE a word, so a single word wider
    // than one line hangs outside the tile rather than wrapping — which is
    // exactly what "Emberdrake"/"Stormscale" (10 chars, ~62px) did on the 5.4
    // 58px tile. Derived from DRAFT_GRID so re-laying the grid re-derives the
    // budget instead of dating this comment.
    const maxChars = Math.floor((DRAFT_GRID.tileW - 4) / 6.2);
    expect(maxChars, 'the wrap budget must carry the longest single-word class name').toBeGreaterThanOrEqual(10);
    for (const cls of ALL_CLASSES) {
      for (const word of CLASS_DISPLAY_NAME[cls].split(' ')) {
        expect(word.length, `${cls}: "${word}" must fit one ${DRAFT_GRID.tileW - 4}px line at 8px`).toBeLessThanOrEqual(maxChars);
      }
      expect(CLASS_DISPLAY_NAME[cls].split(' ').length, `${cls}: at most two lines`).toBeLessThanOrEqual(2);
    }
  });

  it('every class is reachable through EXACTLY ONE tab — no class is stranded, none is listed twice', () => {
    const seen = new Map<string, string[]>();
    for (const tab of ALL_DRAFT_TABS) {
      for (const cls of draftTabClasses(tab)) seen.set(cls, [...(seen.get(cls) ?? []), tab]);
    }
    for (const cls of ALL_CLASSES) {
      expect(seen.get(cls), `${cls} is not reachable from any tab`).toBeDefined();
      expect(seen.get(cls), `${cls} appears in more than one tab`).toHaveLength(1);
    }
    expect(seen.size, 'a tab lists a class that is not in ALL_CLASSES').toBe(ALL_CLASSES.length);
    // The counts, stated once so a drifting split is visible in the diff.
    expect(draftTabClasses('humans')).toHaveLength(16);
    expect(draftTabClasses('monsters')).toHaveLength(11); // the Golem + the ten of the 5.5 wave
  });

  it('the split axis is RACE, not sizeClass — the 1-slot Whelp lives on the MONSTERS tab', () => {
    for (const cls of ALL_CLASSES) {
      expect(draftTabOf(cls), cls).toBe(BALANCE.classes[cls].race === 'human' ? 'humans' : 'monsters');
    }
    expect(draftTabOf('whelp')).toBe('monsters'); // small, but dragonkind
    expect(BALANCE.classes.whelp.sizeClass).toBe('small'); // …and this is why the axis matters
    expect(draftTabOf('golem')).toBe('monsters');
    expect(draftTabOf('dragonhunter')).toBe('humans');
  });

  it('every tab has a label, and no tab is empty (an empty tab would render as a dead target)', () => {
    for (const tab of ALL_DRAFT_TABS) {
      expect(DRAFT_TAB_LABELS[tab], `${tab} label`).toMatch(/\S/);
      expect(draftTabClasses(tab).length, `${tab} is empty`).toBeGreaterThan(0);
    }
    expect(new Set(ALL_DRAFT_TABS).size).toBe(ALL_DRAFT_TABS.length);
  });

  it('the tab strip clears the FR30 44px tap floor and sits entirely ABOVE the grid and BELOW the hint line', () => {
    // Tabs are primary navigation, so unlike the header's Rules spur they do
    // not get the smaller-affordance pass. This is the constraint that pushed
    // the grid's top to y=98 and the tile height to 48.
    expect(DRAFT_TABS.tapH, 'tab tap height').toBeGreaterThanOrEqual(44);
    expect(DRAFT_TABS.tapW, 'tab tap width floor').toBeGreaterThanOrEqual(44);
    expect(DRAFT_TABS.y + DRAFT_TABS.tapH / 2, 'the tab target must not overlap the first tile row').toBeLessThanOrEqual(DRAFT_GRID.startY);
    expect(DRAFT_TABS.underlineY, 'the active underline sits under the label, above the grid').toBeGreaterThan(DRAFT_TABS.y);
    expect(DRAFT_TABS.underlineY).toBeLessThan(DRAFT_GRID.startY);
    // The zones' TOP edge clears the hint line (review 2026-07-28: at hint
    // y=50 the 11px line's bottom grazed the zones by ~1.5px, so a tap on the
    // hint's last pixels silently switched tabs). 11px centred at DRAFT_HINT_Y
    // ends at +5.5; 6 is that with the half-pixel rounded up.
    expect(DRAFT_TABS.y - DRAFT_TABS.tapH / 2, 'tab zone top must clear the hint line bottom').toBeGreaterThanOrEqual(DRAFT_HINT_Y + 6);
  });

  it('the two tab targets never overlap AT THE CEILING, and both stay inside the canvas', () => {
    // The scene grows each zone with its label, clamped to tapMaxW — so the
    // ceiling, not the floor, is what proves no-overlap (review 2026-07-28:
    // "MONSTERS" at 13px Arial Black already exceeds the 88px floor, and the
    // old floor-only assertion tested an envelope the scene didn't obey).
    expect(DRAFT_TABS.tapMaxW).toBeGreaterThanOrEqual(DRAFT_TABS.tapW);
    const centres = [BASE_WIDTH / 2 - DRAFT_TABS.offsetX, BASE_WIDTH / 2 + DRAFT_TABS.offsetX];
    expect(centres[1]! - centres[0]!, 'centre-to-centre gap must exceed one MAX tap width').toBeGreaterThan(DRAFT_TABS.tapMaxW);
    for (const cx of centres) {
      expect(cx - DRAFT_TABS.tapMaxW / 2).toBeGreaterThanOrEqual(0);
      expect(cx + DRAFT_TABS.tapMaxW / 2).toBeLessThanOrEqual(BASE_WIDTH);
    }
    // Two tabs today; if a third is added the ±offset layout stops working and
    // this is the assertion that says so rather than a device pass.
    expect(ALL_DRAFT_TABS).toHaveLength(2);
  });

  it('sanity: the roster is 27 and every class has a name-table key + a known race (the exhaustive-Record chain holds)', () => {
    expect(ALL_CLASSES.length).toBe(27);
    for (const cls of ALL_CLASSES) {
      expect(['m', 'f', 'c', 'b', 'd']).toContain(CLASS_SEX[cls]);
      expect(ALL_RACES).toContain(BALANCE.classes[cls].race);
    }
  });
});
