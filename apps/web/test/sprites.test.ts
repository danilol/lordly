import { describe, expect, it } from 'vitest';
import { ALL_CLASSES } from '@lordly/engine';
import type { UnitClass } from '@lordly/engine';
import { UNITS_SHEET_KEY, UNIT_FRAME_SIZE, UNIT_FRAMES, UNIT_TWEENS, ALL_REPRESENTATIONS } from '../src/config/sprites';

describe('unit sprite lookup (story 2.1, AC1/AC5)', () => {
  it('maps every engine class to a frame — keyed by the union, so this is belt-and-braces', () => {
    for (const cls of ALL_CLASSES) {
      expect(UNIT_FRAMES[cls], `frame for ${cls}`).toBeTypeOf('number');
    }
  });

  it('the shipped six + the Golem have unique in-sheet frames; every class points at a real frame (AC1)', () => {
    // The units sheet is SEVEN 32×32 frames: frames 0–5 are the CC0 DCSS tiles,
    // frame 6 is the Golem (Danilo's original art, story 4.9). The 5 wave-1
    // newcomers (Berserker/Phalanx/Ninja/Valkyrie/Sorceress) still ride INTERIM
    // sprites — they reuse an existing frame (see sprites.ts) until dedicated
    // tiles are sourced. Every class maps to a valid frame so there is never a
    // missing sprite at runtime.
    const SHEET_FRAMES = 7;
    const dedicated: UnitClass[] = ['knight', 'mercenary', 'archer', 'mage', 'cleric', 'witch', 'golem'];
    const dedicatedFrames = dedicated.map((cls) => UNIT_FRAMES[cls]);
    expect(new Set(dedicatedFrames).size).toBe(dedicated.length); // all seven distinct (the Golem no longer shares the Knight tile — story 4.9)
    expect(UNIT_FRAMES.golem).not.toBe(UNIT_FRAMES.knight); // the Golem has its OWN frame now (was an interim Knight share)
    for (const cls of ALL_CLASSES) {
      const f = UNIT_FRAMES[cls];
      expect(Number.isInteger(f), `frame for ${cls}`).toBe(true);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f, `frame for ${cls} within the sheet`).toBeLessThan(SHEET_FRAMES);
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
