import type { UnitClass } from '@lordly/engine';

// Unit spritesheet lookup (story 2.1, FR31/AD-11): sprites are a SHELL-SIDE
// lookup keyed off the engine class — the engine never knows art exists.
// The sheet is a single 192×32 texture of six 32×32 frames composed from the
// CC0 Dungeon Crawl Stone Soup tiles (provenance: src/assets/attribution.ts),
// in ALL_CLASSES order. Keyed by the engine union (AD-4): a new class is a
// compile error here, never a missing sprite at runtime.
export const UNITS_SHEET_KEY = 'units';

/** Native frame size. 32px meets story 2.2's ≥32px-on-360px floor at ×1 — always draw at integer multiples to keep pixel art crisp. */
export const UNIT_FRAME_SIZE = 32;

export const UNIT_FRAMES: Record<UnitClass, number> = {
  knight: 0,
  mercenary: 1,
  archer: 2,
  mage: 3,
  cleric: 4,
  witch: 5,
  // STORY 4.3 — INTERIM sprites (flagged for Danilo's device veto): the units
  // sheet still has only the six original CC0 DCSS frames. Until 5 dedicated
  // CC0 tiles are sourced and composited (a 352×32 sheet + attribution.ts +
  // BootScene frame count), the newcomers REUSE the closest existing frame so
  // the full 11-class loop runs and reads: Berserker/Phalanx borrow the Knight
  // (Vanguard melee), Ninja/Valkyrie the Mercenary (Skirmisher), Sorceress the
  // Wizard/mage (Artillery). These are placeholders, NOT final art.
  berserker: 0,
  phalanx: 0,
  ninja: 1,
  valkyrie: 1,
  sorceress: 3,
};

// FR31 animation representations — tween-based (the CC0 tiles are single-frame,
// which FR31 explicitly allows). These are DATA recipes shared by every class:
// story 2.1 makes the representations available; the Battle scene (story 2.2)
// plays attack/hurt/death off BattleLog events (AD-2). Durations are tuning
// constants in the same spirit as BATTLE_BEAT_MS.
export const ALL_REPRESENTATIONS = ['idle', 'attack', 'hurt', 'death'] as const;
export type UnitRepresentation = (typeof ALL_REPRESENTATIONS)[number];

export interface TweenRecipe {
  /** Property deltas applied to the sprite (relative where it makes sense — 2.2 resolves them against the unit's rest pose). */
  props: Record<string, number>;
  duration: number;
  yoyo: boolean;
  /** -1 loops forever (idle); 0 plays once. */
  repeat: number;
}

export const UNIT_TWEENS: Record<UnitRepresentation, TweenRecipe> = {
  /** Gentle breathing bob — available for story 2.2; Draft/Placement/Reveal currently render the STATIC idle frame (AC5), no scene plays this tween yet. */
  idle: { props: { y: -2 }, duration: 700, yoyo: true, repeat: -1 },
  /** Short lunge toward the target (2.2 mirrors the x-delta for side B). */
  attack: { props: { x: 10 }, duration: 140, yoyo: true, repeat: 0 },
  /** Flinch flash — alpha dip, twice. */
  hurt: { props: { alpha: 0.3 }, duration: 90, yoyo: true, repeat: 1 },
  /** Fade + topple; one-way — the corpse leaves the lane (story 2.2). */
  death: { props: { alpha: 0, angle: 90 }, duration: 320, yoyo: false, repeat: 0 },
};
