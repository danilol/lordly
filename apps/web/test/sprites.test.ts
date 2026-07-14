import { describe, expect, it } from 'vitest';
import { ALL_CLASSES } from '@lordly/engine';
import { UNITS_SHEET_KEY, UNIT_FRAME_SIZE, UNIT_FRAMES, UNIT_TWEENS, ALL_REPRESENTATIONS } from '../src/config/sprites';

describe('unit sprite lookup (story 2.1, AC1/AC5)', () => {
  it('maps every engine class to a frame — keyed by the union, so this is belt-and-braces', () => {
    for (const cls of ALL_CLASSES) {
      expect(UNIT_FRAMES[cls], `frame for ${cls}`).toBeTypeOf('number');
    }
  });

  it('frame indices are unique (visually distinct sprites — AC1) and within the sheet', () => {
    const frames = ALL_CLASSES.map((cls) => UNIT_FRAMES[cls]);
    expect(new Set(frames).size).toBe(ALL_CLASSES.length);
    for (const f of frames) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(ALL_CLASSES.length);
      expect(Number.isInteger(f)).toBe(true);
    }
  });

  it('declares the shared sheet key and the 32px native frame size (2.2 ≥32px floor at ×1)', () => {
    expect(UNITS_SHEET_KEY).toBeTruthy();
    expect(UNIT_FRAME_SIZE).toBe(32);
  });

  it('provides idle, attack, hurt, and death representations (FR31 — tween-based)', () => {
    expect([...ALL_REPRESENTATIONS].sort()).toEqual(['attack', 'death', 'hurt', 'idle']);
    for (const rep of ALL_REPRESENTATIONS) {
      const recipe = UNIT_TWEENS[rep];
      expect(recipe.duration, `${rep} duration`).toBeGreaterThan(0);
      expect(Object.keys(recipe.props).length, `${rep} animates something`).toBeGreaterThan(0);
    }
  });

  it('idle loops forever; death is one-way (no yoyo back to life)', () => {
    expect(UNIT_TWEENS.idle.repeat).toBe(-1);
    expect(UNIT_TWEENS.idle.yoyo).toBe(true);
    expect(UNIT_TWEENS.death.repeat).toBe(0);
    expect(UNIT_TWEENS.death.yoyo).toBe(false);
  });
});
