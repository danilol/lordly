import { describe, expect, it } from 'vitest';
import {
  backingScaleFor,
  BASE_HEIGHT,
  BASE_WIDTH,
  BATTLE_SPEEDS,
  battleSpeed,
  battleTurnLabel,
  CODE_STROKE_COLOR,
  DEFAULT_SPEED_ID,
  DPR_BACKING_CAP,
  GAME_NAME,
  HOME_PLAY_LABEL,
  MONSTER_LOOM_SCALE,
  PALETTE,
  turnBoundaryLine,
  unitCodeStyle,
  unitDisplaySize,
} from '../src/config/constants';

describe('web smoke test', () => {
  it('exposes the game name without booting Phaser', () => {
    expect(GAME_NAME).toBe('Lord Battle Tactics');
  });

  it('exposes the Home scene labels and portrait base resolution (FR30)', () => {
    expect(HOME_PLAY_LABEL).toBe('Play vs AI');
    expect(BASE_WIDTH).toBe(360);
    expect(BASE_HEIGHT).toBe(640);
    expect(BASE_HEIGHT).toBeGreaterThan(BASE_WIDTH);
  });
});

describe('battleSpeed sanitizer (FR23, story 2.3)', () => {
  it('resolves every known speed id to its own entry', () => {
    for (const speed of BATTLE_SPEEDS) {
      expect(battleSpeed(speed.id)).toBe(speed);
    }
  });

  it('falls back to normal speed for unknown/stale ids (forward-compat with future settings)', () => {
    expect(battleSpeed('16x')).toBe(BATTLE_SPEEDS[0]);
    expect(battleSpeed('')).toBe(BATTLE_SPEEDS[0]);
    expect(BATTLE_SPEEDS[0].id).toBe(DEFAULT_SPEED_ID);
  });

  it('keeps fast-forward opt-in: the default entry is normal speed, factor 1', () => {
    expect(battleSpeed(DEFAULT_SPEED_ID).factor).toBe(1);
  });
});

describe('PALETTE internal consistency (story 2.4 review)', () => {
  it('backgroundFill is the numeric twin of the background hex string — the Help header strip depends on it', () => {
    expect(PALETTE.backgroundFill).toBe(parseInt(PALETTE.background.slice(1), 16));
  });
});

describe('Turn wording (FR39a, story 4.0) — display rename only, the engine keeps "pass"', () => {
  it('the HUD label and log-panel boundary line both say Turn', () => {
    expect(battleTurnLabel(2)).toBe('Turn 2');
    expect(turnBoundaryLine(2)).toBe('— Turn 2 —');
  });

  it('neither player-facing string contains the engine word "pass"', () => {
    expect(battleTurnLabel(7).toLowerCase()).not.toContain('pass');
    expect(turnBoundaryLine(7).toLowerCase()).not.toContain('pass');
  });
});

describe('backingScaleFor (story 4.0 text-ceiling fix) — the DPR-sized backing store scale', () => {
  it('is a no-op at DPR 1 (desktop baseline unchanged)', () => {
    expect(backingScaleFor(1)).toBe(1);
  });

  it('rounds fractional DPRs to integers — NEAREST pixel art needs integer duplication', () => {
    expect(backingScaleFor(2)).toBe(2);
    expect(backingScaleFor(2.625)).toBe(3);
    expect(backingScaleFor(1.5)).toBe(2);
  });

  it('caps at DPR_BACKING_CAP — the fill-rate lever', () => {
    expect(backingScaleFor(3.5)).toBe(DPR_BACKING_CAP);
    expect(backingScaleFor(4)).toBe(DPR_BACKING_CAP);
    expect(DPR_BACKING_CAP).toBe(3);
  });

  it('never goes below 1, even for garbage input (missing devicePixelRatio)', () => {
    expect(backingScaleFor(0)).toBe(1);
    expect(backingScaleFor(NaN)).toBe(1);
  });
});

describe('unitCodeStyle (FR39f, story 4.0) — the label-contrast token treatment', () => {
  it('carries a dark stroke so codes read on same-hue tiles (and future busy backdrops)', () => {
    for (const side of ['A', 'B'] as const) {
      const style = unitCodeStyle(side);
      expect(style.stroke).toBe(CODE_STROKE_COLOR);
      expect(style.strokeThickness).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps side identity: the two sides get distinct fills, neither matching its own tile hex', () => {
    const you = unitCodeStyle('A');
    const enemy = unitCodeStyle('B');
    expect(you.color).not.toBe(enemy.color);
    // The shipped defect: playerText === youFront tile hue, enemyText ≈ foeFront.
    // The code fill must not be the same hex as the bright front tile it stands on.
    expect(you.color?.toLowerCase()).not.toBe('#4a8fe0');
    expect(enemy.color?.toLowerCase()).not.toBe('#c8483a');
  });
});

describe('monster loom sizing (story 4.9, D-3c — one cell, oversized sprite)', () => {
  it('renders a small unit at exactly its scene base size', () => {
    expect(unitDisplaySize('knight', 32)).toBe(32);
    expect(unitDisplaySize('archer', 28)).toBe(28);
    expect(unitDisplaySize('witch', 26)).toBe(26);
  });

  it('looms a monster larger than a small drawn at the same base size', () => {
    expect(unitDisplaySize('golem', 32)).toBe(Math.round(32 * MONSTER_LOOM_SCALE));
    expect(unitDisplaySize('golem', 32)).toBeGreaterThan(unitDisplaySize('knight', 32));
  });

  it("takes the boards' 32px small to the dossier's >=48px monster floor (D-3c)", () => {
    expect(unitDisplaySize('golem', 32)).toBeGreaterThanOrEqual(48);
  });

  it('scales proportionally so tight scenes stay bounded (never below the small base)', () => {
    for (const base of [26, 28, 32, 48]) {
      expect(unitDisplaySize('golem', base)).toBeGreaterThan(base);
    }
    expect(MONSTER_LOOM_SCALE).toBeGreaterThan(1);
  });
});
