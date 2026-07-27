import { describe, expect, it } from 'vitest';
import { buttonStyleTokens, PALETTE } from '../src/config/constants';

// Story 5.2 (the medieval look): the chrome builders' style seam. Every button
// in the app renders through buttonStyleTokens — these pins keep the three
// states distinct and the DESIGN.md night-theme contrast rules honest, without
// pinning exact hexes (values stay device-tunable).
describe('buttonStyleTokens (story 5.2) — the one chrome style source', () => {
  it('maps the three states onto the PALETTE button tokens', () => {
    expect(buttonStyleTokens('primary')).toEqual({
      fill: PALETTE.buttonFillEnabled,
      stroke: PALETTE.buttonStrokeEnabled,
      text: PALETTE.buttonTextOnGold,
    });
    expect(buttonStyleTokens('default')).toEqual({
      fill: PALETTE.buttonFill,
      stroke: PALETTE.buttonStroke,
      text: PALETTE.buttonText,
    });
    expect(buttonStyleTokens('disabled')).toEqual({
      fill: PALETTE.buttonFill,
      stroke: PALETTE.buttonStrokeDisabled,
      text: PALETTE.buttonTextDisabled,
    });
  });

  it('keeps the DESIGN contrast rule: ink-on-gold for primary, never the bone body text', () => {
    // A gold-filled button with the light bone label is the exact low-contrast
    // trap the one-theme restyle must avoid (DESIGN: enabled = gold fill + ink).
    expect(buttonStyleTokens('primary').text).not.toBe(PALETTE.buttonText);
    expect(buttonStyleTokens('primary').text).not.toBe(buttonStyleTokens('disabled').text);
  });

  it('keeps the three states visually distinct (a disabled button must not read as tappable)', () => {
    const primary = buttonStyleTokens('primary');
    const dflt = buttonStyleTokens('default');
    const disabled = buttonStyleTokens('disabled');
    expect(primary.fill).not.toBe(dflt.fill);
    expect(dflt.stroke).not.toBe(disabled.stroke);
    expect(dflt.text).not.toBe(disabled.text);
  });

  it('every text token is strict #rrggbb and every fill/stroke a valid numeric color (the statusTraceColor format lesson)', () => {
    for (const style of ['primary', 'default', 'disabled'] as const) {
      const t = buttonStyleTokens(style);
      expect(t.text, style).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.fill, style).toBeGreaterThanOrEqual(0x000000);
      expect(t.fill, style).toBeLessThanOrEqual(0xffffff);
      expect(t.stroke, style).toBeGreaterThanOrEqual(0x000000);
      expect(t.stroke, style).toBeLessThanOrEqual(0xffffff);
    }
  });
});

describe('PALETTE hex hygiene (story 5.2) — string tokens parse blind downstream', () => {
  it('every string token in PALETTE is strict #rrggbb', () => {
    for (const [name, value] of Object.entries(PALETTE)) {
      if (typeof value === 'string') expect(value, name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
