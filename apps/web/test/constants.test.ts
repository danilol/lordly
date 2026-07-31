import { describe, expect, it } from 'vitest';
import { ALL_ELEMENTS } from '@lordly/engine';
import type { SpellKind } from '@lordly/engine';
import {
  backingScaleFor,
  BASE_HEIGHT,
  BASE_WIDTH,
  BATTLE_SPEEDS,
  battleSpeed,
  battleTurnLabel,
  BLAST_ELEMENT_WORD,
  CODE_STROKE_COLOR,
  CODE_STROKE_THICKNESS,
  DEFAULT_SPEED_ID,
  DPR_BACKING_CAP,
  GAME_NAME,
  HEAL_TRACE_COLOR,
  HOME_PLAY_LABEL,
  MONSTER_LOOM_SCALE,
  MOVE_PLATE_NAMES,
  moveDisplayName,
  PALETTE,
  SPELL_DISPLAY_NAME,
  STATUS_COLORS,
  statusTraceColor,
  turnBoundaryLine,
  unitCodeStyle,
  unitDisplaySize,
} from '../src/config/constants';

describe('web smoke test', () => {
  it('exposes the game name without booting Phaser', () => {
    expect(GAME_NAME).toBe('Lordly: Ruler of the Board, Master of Tactics');
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
  // Story 5.8 re-pointed this suite's SUBJECT without weakening it. The class
  // codes these tokens were built for left the board (units identify by sprite
  // now), but the Reveal soldier NAME still stands on a solid side-coloured
  // tile and spreads this exact style — so every assertion below is still
  // load-bearing, just about the name rather than a code.
  it('carries a dark stroke so tile text reads on same-hue tiles (and busy backdrops)', () => {
    // The thickness pins the TOKEN, not a literal (2026-07-28 dead-export
    // sweep: the constant existed but the test asserted `>= 3` beside it,
    // leaving the export with no consumer); the floor is asserted once on
    // the token itself so a future thinning still fails here.
    expect(CODE_STROKE_THICKNESS, 'the FR39f stroke must stay readable').toBeGreaterThanOrEqual(3);
    for (const side of ['A', 'B'] as const) {
      const style = unitCodeStyle(side);
      expect(style.stroke).toBe(CODE_STROKE_COLOR);
      expect(style.strokeThickness).toBe(CODE_STROKE_THICKNESS);
    }
  });

  it('keeps side identity: the two sides get distinct fills, neither matching its own tile hex', () => {
    const you = unitCodeStyle('A');
    const enemy = unitCodeStyle('B');
    expect(you.color).not.toBe(enemy.color);
    // The shipped defect: playerText === youFront tile hue, enemyText ≈ foeFront.
    // The fill must not be the same hex as the bright front tile the text stands on.
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

describe('travel-trace colors (story 4.10 review) — the format statusTraceColor depends on', () => {
  it('every STATUS_COLORS token is strict #rrggbb — statusTraceColor parses it blind', () => {
    // statusTraceColor does `parseInt(hex.slice(1), 16)` with no guard: a
    // future named color / #rgb / rgb() token would silently become NaN
    // (Phaser renders that as black). This pin makes the format a test
    // failure instead of a wrong-colored spell trace.
    for (const [spell, hex] of Object.entries(STATUS_COLORS)) {
      expect(hex, spell).toMatch(/^#[0-9a-f]{6}$/i);
      expect(statusTraceColor(spell as SpellKind)).toBe(parseInt(hex.slice(1), 16));
      expect(Number.isNaN(statusTraceColor(spell as SpellKind))).toBe(false);
    }
  });

  it('HEAL_TRACE_COLOR is a valid numeric color and not a side hue (side identity never rides a heal trace)', () => {
    expect(HEAL_TRACE_COLOR).toBeGreaterThanOrEqual(0x000000);
    expect(HEAL_TRACE_COLOR).toBeLessThanOrEqual(0xffffff);
    expect(HEAL_TRACE_COLOR).not.toBe(PALETTE.playerLine);
    expect(HEAL_TRACE_COLOR).not.toBe(PALETTE.enemyLine);
  });
});

describe('move-plate display vocabulary (story 4.11, FR39b/D-3a; class verbs since 5.4/E5-D10) — union-keyed drift guards', () => {
  it('names every non-blast move in the OB64 plate register', () => {
    expect(MOVE_PLATE_NAMES).toEqual({ slash: 'Sword Slash', arrow: 'Arrow', staff: 'Staff', bash: 'Bash', bolt: 'Magic Bolt', breath: 'Breath' });
  });

  it('flavors the blast by element — the EXPERIENCE "Ice Blast" mapping (open Q2 default)', () => {
    for (const element of ALL_ELEMENTS) {
      expect(moveDisplayName('blast', element, 'mage')).toBe(`${BLAST_ELEMENT_WORD[element]} Blast`);
    }
    expect(moveDisplayName('blast', 'water', 'mage')).toBe('Ice Blast');
    expect(moveDisplayName('blast', 'earth', 'sorceress')).toBe('Stone Blast');
  });

  it('passes non-blast kinds straight through regardless of element when the class has no named verb', () => {
    expect(moveDisplayName('slash', 'fire', 'knight')).toBe('Sword Slash');
    expect(moveDisplayName('arrow', 'water', 'archer')).toBe('Arrow');
  });

  it('the dossier-named class verbs override the generic plate (story 5.4, E5-D10) — same kind, class-specific name', () => {
    expect(moveDisplayName('slash', 'fire', 'berserker')).toBe('Cleave');
    expect(moveDisplayName('slash', 'fire', 'ninja')).toBe('Rend');
    expect(moveDisplayName('slash', 'fire', 'mercenary')).toBe('Cut Throat');
    expect(moveDisplayName('slash', 'fire', 'golem')).toBe('Smash');
    expect(moveDisplayName('bash', 'fire', 'phalanx')).toBe('Pierce');
    expect(moveDisplayName('slash', 'fire', 'fencer')).toBe('Lunge');
    expect(moveDisplayName('slash', 'fire', 'dragonhunter')).toBe('Skewer');
    expect(moveDisplayName('slash', 'fire', 'hawkman')).toBe('Talon Strike');
    // The E5-D14 Skills: the same physical `arrow` kind, per-class verbs.
    expect(moveDisplayName('arrow', 'wind', 'vultan')).toBe('Wind Shot');
    expect(moveDisplayName('arrow', 'wind', 'raven')).toBe('Thunder Arrow');
    // The bolt: casters ride the generic plate; the Valkyrie's is "Lightning".
    expect(moveDisplayName('bolt', 'fire', 'mage')).toBe('Magic Bolt');
    expect(moveDisplayName('bolt', 'fire', 'sorceress')).toBe('Magic Bolt');
    expect(moveDisplayName('bolt', 'fire', 'valkyrie')).toBe('Lightning');
    // And her melee spear reads "Pierce" (E5-D10) — element never matters off-blast.
    expect(moveDisplayName('slash', 'earth', 'valkyrie')).toBe('Pierce');
  });

  it('surfaces the FR16 spell names, Title-Cased, one per SpellKind', () => {
    expect(SPELL_DISPLAY_NAME).toEqual({ sleep: 'Sleep', poison: 'Poison', weaken: 'Weaken', confusion: 'Confusion' });
  });
});
