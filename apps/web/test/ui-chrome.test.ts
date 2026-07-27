import { describe, expect, it } from 'vitest';
import {
  BUTTON_FRAME_SLICE,
  buttonCenter,
  buttonPlateInset,
  buttonStyleTokens,
  CHROME_SLICE_SCALE,
  DISABLED_FRAME_ALPHA,
  MIN_BUTTON_PLATE_PX,
  PALETTE,
  PANEL_FRAME_SLICE,
} from '../src/config/constants';

// Story 5.2 (the medieval look): the chrome builders' pure seams. Every button
// in the app renders through buttonStyleTokens + buttonCenter + buttonPlateInset,
// so these pin the parts that can be tested without a Phaser scene.
describe('buttonStyleTokens (story 5.2) — the one chrome style source', () => {
  it('maps the three states onto rendered properties only', () => {
    expect(buttonStyleTokens('primary')).toEqual({
      fill: PALETTE.buttonFillEnabled,
      text: PALETTE.buttonTextOnGold,
      frameAlpha: 1,
    });
    expect(buttonStyleTokens('default')).toEqual({
      fill: PALETTE.buttonFill,
      text: PALETTE.buttonText,
      frameAlpha: 1,
    });
    expect(buttonStyleTokens('disabled')).toEqual({
      fill: PALETTE.buttonFill,
      text: PALETTE.buttonTextDisabled,
      frameAlpha: DISABLED_FRAME_ALPHA,
    });
  });

  it('every token field is one addButton actually renders (review 2026-07-27)', () => {
    // The original seam carried a `stroke` token that `addButton` never read —
    // the frame is ART, there is no stroke to set — so a test asserting the
    // three states had distinct strokes passed while nothing on screen differed.
    // Guard the shape itself: no field may be added here without a renderer.
    for (const style of ['primary', 'default', 'disabled'] as const) {
      expect(Object.keys(buttonStyleTokens(style)).sort()).toEqual(['fill', 'frameAlpha', 'text']);
    }
  });

  it('keeps the DESIGN contrast rule: ink-on-gold for primary, never the bone body text', () => {
    // A gold-filled button with the light bone label is the exact low-contrast
    // trap the one-theme restyle must avoid (DESIGN: enabled = gold fill + ink).
    expect(buttonStyleTokens('primary').text).not.toBe(PALETTE.buttonText);
    expect(buttonStyleTokens('primary').text).not.toBe(buttonStyleTokens('disabled').text);
  });

  it('keeps the three states distinguishable ON SCREEN (a disabled button must not read as tappable)', () => {
    const primary = buttonStyleTokens('primary');
    const dflt = buttonStyleTokens('default');
    const disabled = buttonStyleTokens('disabled');
    // primary is the only state that shows a gold plate…
    expect(primary.fill).not.toBe(dflt.fill);
    // …and disabled is the only state that dims the frame art.
    expect(disabled.frameAlpha).toBeLessThan(dflt.frameAlpha);
    expect(dflt.text).not.toBe(disabled.text);
  });

  it('every text token is strict #rrggbb and every fill a valid numeric colour (the statusTraceColor format lesson)', () => {
    for (const style of ['primary', 'default', 'disabled'] as const) {
      const t = buttonStyleTokens(style);
      expect(t.text, style).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.fill, style).toBeGreaterThanOrEqual(0x000000);
      expect(t.fill, style).toBeLessThanOrEqual(0xffffff);
      expect(t.frameAlpha, style).toBeGreaterThan(0);
      expect(t.frameAlpha, style).toBeLessThanOrEqual(1);
    }
  });
});

describe('buttonCenter (story 5.2) — art layers hang off the visual centre, whatever the origin', () => {
  it('is the position itself for a centred button', () => {
    expect(buttonCenter(100, 200, 48, 44, [0.5, 0.5])).toEqual({ cx: 100, cy: 200 });
  });

  it('offsets by half the size for a top-left origin (History parks its Replay control at 0,0)', () => {
    expect(buttonCenter(100, 200, 48, 44, [0, 0])).toEqual({ cx: 124, cy: 222 });
  });

  it('handles a bottom-right origin symmetrically', () => {
    expect(buttonCenter(100, 200, 48, 44, [1, 1])).toEqual({ cx: 76, cy: 178 });
  });
});

describe('buttonPlateInset (story 5.2 review) — the gold plate can never go degenerate', () => {
  const nominal = Math.round(BUTTON_FRAME_SLICE / CHROME_SLICE_SCALE) + 2;

  it('uses the nominal frame inset on every shipped button size', () => {
    for (const size of [44, 46, 48, 50, 56, 104, 128, 200, 220]) {
      expect(buttonPlateInset(size), `size ${size}`).toBe(nominal);
    }
  });

  it('leaves a real plate on sizes too small for the nominal inset (never zero or negative)', () => {
    // The unclamped version returned a 14px inset regardless, so a 24px row —
    // exactly what migrating Reveal's dropdown would have produced — yielded a
    // -4px-wide Rectangle.
    for (const size of [8, 12, 20, 24, 28]) {
      const plate = size - buttonPlateInset(size) * 2;
      expect(plate, `size ${size}`).toBeGreaterThanOrEqual(Math.min(size, MIN_BUTTON_PLATE_PX));
      expect(plate, `size ${size}`).toBeGreaterThan(0);
    }
  });

  it('never insets more than the nominal frame border', () => {
    for (const size of [8, 24, 44, 500]) expect(buttonPlateInset(size)).toBeLessThanOrEqual(nominal);
  });
});

describe('9-slice geometry (story 5.2 art drop) — corners must fit the smallest chrome', () => {
  it('button-frame corners fit the 44px tap-target floor at the slice scale', () => {
    // NineSlice corners render at TEXTURE px in game units; builders draw at
    // CHROME_SLICE_SCALE× then scale down. If two corners exceed the scaled
    // 44px minimum button height, the frame collapses/overlaps.
    expect(2 * BUTTON_FRAME_SLICE).toBeLessThanOrEqual(44 * CHROME_SLICE_SCALE);
    // Narrowest shipped button: History's 48px Replay control.
    expect(2 * BUTTON_FRAME_SLICE).toBeLessThanOrEqual(48 * CHROME_SLICE_SCALE);
  });

  it('panel-frame corners fit the smallest framed panel (Draft detail, 116px tall)', () => {
    expect(2 * PANEL_FRAME_SLICE).toBeLessThanOrEqual(116 * CHROME_SLICE_SCALE);
  });
});

describe('PALETTE hex hygiene (story 5.2) — string tokens parse blind downstream', () => {
  it('every string token in PALETTE is strict #rrggbb', () => {
    for (const [name, value] of Object.entries(PALETTE)) {
      if (typeof value === 'string') expect(value, name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('the opaque unit-card backings are the side line blended into the card body, not arbitrary colours', () => {
    // Device pass 2026-07-27 replaced the ~15%-alpha side washes with opaque
    // fills so the stone floor cannot bleed through. This pins the blend so a
    // future re-tone of either input keeps the two in agreement.
    const blend = (base: number, side: number, alpha: number) => {
      const ch = (shift: number) => Math.round(((base >> shift) & 0xff) * (1 - alpha) + ((side >> shift) & 0xff) * alpha) << shift;
      return ch(16) | ch(8) | ch(0);
    };
    expect(PALETTE.cardFillYou).toBe(blend(PALETTE.cardFill, PALETTE.playerLine, 0.15));
    expect(PALETTE.cardFillEnemy).toBe(blend(PALETTE.cardFill, PALETTE.enemyLine, 0.15));
  });
});
