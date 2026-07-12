import type { Element, SpellKind, UnitClass } from './types';

/**
 * An exact integer ratio. All combat arithmetic is integer math (FR15/FR20):
 * apply as `Math.floor(value * num / den)`, in the fixed order
 * base → RPS → status modifiers, so battles are bit-identical on any device.
 */
export interface Ratio {
  num: number;
  den: number;
}

/** Per-class attribute block (FR15). DEX is reserved — no miss/crit in MVP. */
export interface ClassStats {
  hp: number;
  str: number;
  vit: number;
  int: number;
  men: number;
  agi: number;
  dex: number;
  /** Actions per engagement by the row the unit starts in (FR15). */
  actions: { front: number; mid: number; back: number };
}

/** Shape of the versioned balance data (AD-4, AD-8). */
export interface BalanceData {
  /** Monotonic integer; bump on ANY change to this data (AD-8 hash guard). */
  version: number;
  /** Army size is data, never a hardcoded constant elsewhere (AD-1). */
  armySize: number;
  /** Until-wipeout anti-stalemate cap: judge by FR18 after this many engagements (FR19). */
  engagementCap: number;
  /** The FR15 class table. Initial tuning values — the rules are the requirements. */
  classes: Record<UnitClass, ClassStats>;
  /** The FR14 triangle: attacker class → the class it deals ×1.5 to (and takes ×0.75 from... see formulas). */
  rpsBeats: { mage: 'knight'; knight: 'archer'; archer: 'mage' };
  /** Element → the Witch's prepared spell (FR16). Flavor pairing, swappable during UX. */
  elementSpells: Record<Element, SpellKind>;
  /** Formula constants (FR15/FR16), integer ratios floored in fixed order. */
  formulas: {
    /** Class-advantage damage multiplier (FR14 ×1.5). */
    rpsAdvantage: Ratio;
    /** Class-disadvantage damage multiplier (FR14 ×0.75). */
    rpsDisadvantage: Ratio;
    /** Heal amount = INT × 1.25 (FR11). */
    heal: Ratio;
    /** Every damaging hit deals at least this much (FR15). */
    minDamage: number;
    /** Poison damage at engagement end, before judging (FR16). */
    poisonDamage: number;
    /** Chance a confused unit's action misfires onto its own side (FR16). */
    confusionMisfire: Ratio;
  };
}

/**
 * The balance data (FR15 class table verbatim from the PRD; initial tuning
 * values). This is DATA, not code (NFR4): tuning edits change numbers here
 * and bump `version` — the balance-hash CI test fails if the bump is
 * forgotten (AD-8).
 */
export const BALANCE: BalanceData = {
  version: 1,
  armySize: 3,
  engagementCap: 5,
  classes: {
    knight: { hp: 140, str: 30, vit: 28, int: 8, men: 14, agi: 8, dex: 16, actions: { front: 2, mid: 1, back: 1 } },
    mercenary: { hp: 110, str: 26, vit: 20, int: 10, men: 14, agi: 14, dex: 18, actions: { front: 2, mid: 1, back: 1 } },
    archer: { hp: 90, str: 24, vit: 12, int: 10, men: 12, agi: 22, dex: 24, actions: { front: 1, mid: 2, back: 2 } },
    mage: { hp: 80, str: 6, vit: 8, int: 30, men: 22, agi: 12, dex: 14, actions: { front: 1, mid: 1, back: 2 } },
    cleric: { hp: 90, str: 8, vit: 12, int: 24, men: 24, agi: 10, dex: 12, actions: { front: 1, mid: 1, back: 2 } },
    witch: { hp: 85, str: 6, vit: 10, int: 26, men: 20, agi: 26, dex: 16, actions: { front: 1, mid: 1, back: 2 } },
  },
  rpsBeats: { mage: 'knight', knight: 'archer', archer: 'mage' },
  elementSpells: { water: 'sleep', earth: 'poison', fire: 'weaken', wind: 'confusion' },
  formulas: {
    rpsAdvantage: { num: 3, den: 2 },
    rpsDisadvantage: { num: 3, den: 4 },
    heal: { num: 5, den: 4 },
    minDamage: 1,
    poisonDamage: 15,
    confusionMisfire: { num: 1, den: 2 },
  },
};
