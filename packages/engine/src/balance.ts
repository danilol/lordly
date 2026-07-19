import type { Element, Role, SpellKind, Unit, UnitClass } from './types';

/**
 * An exact integer ratio. All combat arithmetic is integer math (FR15/FR20):
 * apply as `Math.floor(value * num / den)`, in the fixed order
 * base → blast attenuation (Mage blast only, FR10) → RPS → status modifiers,
 * so battles are bit-identical on any device.
 */
export interface Ratio {
  num: number;
  den: number;
}

/**
 * A unit's physical size (FR38, dossier §1): smalls occupy one grid cell and
 * one slot; monsters occupy two cells (anchor + the cell behind, story 4.8)
 * and two slots. Slot COST derives from this — see `SLOT_COST` (one source).
 */
export type SizeClass = 'small' | 'monster';

/** Per-class attribute block (FR15). DEX is reserved — crit/dodge draws arrive in story 4.6. */
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
  /** Physical size (FR38): drives slot cost and (from 4.8) the two-cell footprint. */
  sizeClass: SizeClass;
  /** Combat role (FR14, story 4.3): the ONLY thing matchups read — see `roleRelations`. */
  role: Role;
}

/**
 * A directed role matchup (FR14, AD-4 — story 4.3). `attacker`'s role deals the
 * ×3/2 advantage to `defender`'s role.
 * - `symmetric`: the reverse direction takes the ×3/4 disadvantage (the RPS
 *   triangle — e.g. Artillery→Vanguard, and Vanguard→Artillery is penalised).
 * - `hunt`: NO reverse penalty (the FR14 one-way amendment — e.g. Sniper→Support;
 *   Support hits the Sniper back at plain ×1.0).
 */
export type RoleRelation = { attacker: Role; defender: Role; kind: 'symmetric' | 'hunt' };

/** Shape of the versioned balance data (AD-4, AD-8). */
export interface BalanceData {
  /** Monotonic integer; bump on ANY change to this data (AD-8 hash guard). */
  version: number;
  /**
   * The army's slot budget (AD-1, dossier §1 — replaces `armySize`, story
   * 4.2): legality is `slotTotal(army) === slotBudget`, NEVER `army.length` —
   * a future two-monster army is full at 3 units. Data, never a constant.
   */
  slotBudget: number;
  /** Until-wipeout anti-stalemate cap: judge by FR18 after this many engagements (FR19). */
  engagementCap: number;
  /** The FR15 class table. Initial tuning values — the rules are the requirements. */
  classes: Record<UnitClass, ClassStats>;
  /**
   * The FR14 matchup table (AD-4, story 4.3 — REPLACES `rpsBeats`/`rpsHunts`):
   * directed role relations, the SINGLE matchup source. A class deals the ×3/2
   * advantage when its role is an `attacker` here; it takes the ×3/4
   * disadvantage only when its role is the `defender` of a `symmetric` edge
   * (hunts grant no reverse penalty). Roles absent as an attacker (Skirmisher,
   * Brute) have no relation. Tunable data.
   */
  roleRelations: readonly RoleRelation[];
  /** Element → the Witch's prepared spell (FR16). Flavor pairing, swappable during UX. */
  elementSpells: Record<Element, SpellKind>;
  /** Formula constants (FR15/FR16), integer ratios floored in fixed order. */
  formulas: {
    /** Class-advantage damage multiplier (FR14 ×1.5). */
    rpsAdvantage: Ratio;
    /** Class-disadvantage damage multiplier (FR14 ×0.75). */
    rpsDisadvantage: Ratio;
    /**
     * Per-target Mage row-blast attenuation (FR10, 2026-07-14 amendment):
     * applied AFTER the base formula and BEFORE RPS — the blast trades
     * per-target power for its unmatched whole-row coverage. **Wipeout mode
     * only** (story 3.0 sweep-verified tuning, PO-approved): blasts compound
     * across engagements there (v1 sweep: three-mages 74.6% dominant), while
     * single-engagement blasts are already policed by the archer triangle —
     * attenuating them hands the meta to archer walls (longbows ~75%).
     */
    blastAttenuation: Ratio;
    /** Heal amount = INT × 1.25 (FR11). */
    heal: Ratio;
    /** Every damaging hit deals at least this much (FR15). */
    minDamage: number;
    /** Poison damage at engagement end, before judging (FR16). */
    poisonDamage: number;
    /** Chance a confused unit's action misfires onto its own side (FR16). */
    confusionMisfire: Ratio;
    /**
     * FR35 sober package (story 4.5, dossier §4): once a side's designated
     * leader falls, that side's units deal ×3/4 PHYSICAL damage for the rest
     * of the battle. PHYSICAL only — melee/archer/cleric-staff; blast/magic is
     * untouched (applied at the `physicalDamage` call sites, never inside the
     * shared `strike`). Re-clamped to `minDamage` AFTER the multiply.
     */
    leaderFallDealt: Ratio;
    /**
     * FR35 sober package (story 4.5, dossier §4): once a side's leader falls,
     * that side's units TAKE ×5/4 physical damage for the rest of the battle
     * (the demoralised twin of `leaderFallDealt`, keyed to the DEFENDER's side).
     */
    leaderFallTaken: Ratio;
    /**
     * FR36 crit (story 4.6, ADR 0003 §Chances): a critical physical hit
     * multiplies damage by ×3/2, applied in the FR15 fixed order immediately
     * AFTER RPS and BEFORE status modifiers (Weaken). PHYSICAL single-target
     * only — magic neither crits nor is dodged (OB64 rule). Sweep-policed
     * tuning value; the draw ORDER/COUNT (ADR 0003) is the frozen rule.
     */
    critMultiplier: Ratio;
    /**
     * FR36 crit/dodge chance divisor (story 4.6, ADR 0003 §Chances):
     * dodge% = floor(defender DEX / this); crit% = floor(attacker DEX / this),
     * both drawn against the frozen 0–99 percent range. Sweep-policed tuning
     * lever — raise/lower to re-price high-DEX comps (ninja/archer) if the
     * both-mode band moves.
     */
    dexChanceDivisor: number;
  };
}

/**
 * The balance data (FR15 class table verbatim from the PRD; initial tuning
 * values). This is DATA, not code (NFR4): tuning edits change numbers here
 * and bump `version` — the balance-hash CI test fails if the bump is
 * forgotten (AD-8).
 */
export const BALANCE: BalanceData = {
  version: 7,
  slotBudget: 5,
  engagementCap: 10,
  classes: {
    knight: { hp: 140, str: 30, vit: 28, int: 8, men: 14, agi: 8, dex: 16, actions: { front: 2, mid: 1, back: 1 }, sizeClass: 'small', role: 'vanguard' },
    mercenary: {
      hp: 110,
      str: 26,
      vit: 20,
      int: 10,
      men: 14,
      agi: 14,
      dex: 18,
      actions: { front: 2, mid: 1, back: 1 },
      sizeClass: 'small',
      role: 'skirmisher',
    },
    archer: { hp: 90, str: 24, vit: 12, int: 10, men: 12, agi: 22, dex: 24, actions: { front: 1, mid: 2, back: 2 }, sizeClass: 'small', role: 'sniper' },
    mage: { hp: 80, str: 6, vit: 8, int: 30, men: 22, agi: 12, dex: 14, actions: { front: 1, mid: 1, back: 2 }, sizeClass: 'small', role: 'artillery' },
    cleric: { hp: 90, str: 8, vit: 12, int: 24, men: 24, agi: 10, dex: 12, actions: { front: 1, mid: 1, back: 2 }, sizeClass: 'small', role: 'support' },
    witch: { hp: 85, str: 6, vit: 10, int: 26, men: 20, agi: 26, dex: 16, actions: { front: 1, mid: 1, back: 2 }, sizeClass: 'small', role: 'control' },
    // Wave-1 additions (story 4.3, dossier §1 — TUNING DRAFTS, sweep-policed). Golem (monster) ships in 4.8.
    berserker: { hp: 120, str: 34, vit: 14, int: 6, men: 10, agi: 12, dex: 18, actions: { front: 2, mid: 1, back: 1 }, sizeClass: 'small', role: 'vanguard' },
    phalanx: { hp: 150, str: 22, vit: 34, int: 6, men: 18, agi: 6, dex: 12, actions: { front: 2, mid: 1, back: 1 }, sizeClass: 'small', role: 'vanguard' },
    ninja: { hp: 85, str: 22, vit: 10, int: 8, men: 12, agi: 28, dex: 30, actions: { front: 2, mid: 1, back: 1 }, sizeClass: 'small', role: 'skirmisher' },
    valkyrie: { hp: 105, str: 24, vit: 16, int: 12, men: 16, agi: 20, dex: 20, actions: { front: 2, mid: 1, back: 1 }, sizeClass: 'small', role: 'skirmisher' },
    sorceress: { hp: 78, str: 6, vit: 8, int: 28, men: 20, agi: 16, dex: 15, actions: { front: 1, mid: 1, back: 2 }, sizeClass: 'small', role: 'artillery' },
  },
  // FR14 role relations (story 4.3) — the shipped-six triangle + hunts, verbatim:
  // Artillery→Vanguard→Sniper→Artillery (symmetric RPS); Sniper hunts Support &
  // Control one-way (the 2026-07-14 amendment). Skirmisher/Brute have none.
  roleRelations: [
    { attacker: 'artillery', defender: 'vanguard', kind: 'symmetric' },
    { attacker: 'vanguard', defender: 'sniper', kind: 'symmetric' },
    { attacker: 'sniper', defender: 'artillery', kind: 'symmetric' },
    { attacker: 'sniper', defender: 'support', kind: 'hunt' },
    { attacker: 'sniper', defender: 'control', kind: 'hunt' },
  ],
  elementSpells: { water: 'sleep', earth: 'poison', fire: 'weaken', wind: 'confusion' },
  formulas: {
    rpsAdvantage: { num: 3, den: 2 },
    rpsDisadvantage: { num: 3, den: 4 },
    blastAttenuation: { num: 3, den: 4 },
    heal: { num: 5, den: 4 },
    minDamage: 1,
    poisonDamage: 15,
    confusionMisfire: { num: 1, den: 2 },
    leaderFallDealt: { num: 3, den: 4 },
    leaderFallTaken: { num: 5, den: 4 },
    // Story 4.6 (ADR 0003 §Chances) — crit/dodge tuning data (sweep-policed; the
    // draw ORDER/COUNT is the frozen rule, these magnitudes are balance data).
    // dodge% = floor(defender DEX / dexChanceDivisor); crit% = floor(attacker
    // DEX / dexChanceDivisor); both drawn against the frozen 0–99 percent range
    // (DEX_CHANCE_DEN in resolve.ts). Crit multiplies post-RPS damage by ×3/2.
    critMultiplier: { num: 3, den: 2 },
    dexChanceDivisor: 3,
  },
};

/**
 * Slot cost by size class (AD-1, dossier §1): the ONE source the legality
 * arithmetic derives from — small = 1, monster = 2. Story 4.8's Golem pays 2
 * through this table with no further code change.
 */
export const SLOT_COST: Record<SizeClass, number> = { small: 1, monster: 2 };

/**
 * Total slots an army occupies (AD-1, story 4.2): THE legality arithmetic.
 * Army legality everywhere is `slotTotal(army) === BALANCE.slotBudget` —
 * never `army.length`, which a two-slot monster silently breaks.
 */
export function slotTotal(army: readonly Pick<Unit, 'class'>[]): number {
  return army.reduce((sum, unit) => sum + SLOT_COST[BALANCE.classes[unit.class].sizeClass], 0);
}

/**
 * Whether `attacker` deals the FR14 class-advantage (×3/2) to `defender`,
 * by role relation (AD-4, story 4.3 — the SINGLE matchup source). True when
 * the attacker's role is an `attacker` of any relation whose `defender` is the
 * defender's role (symmetric OR hunt).
 */
export function dealsAdvantage(attacker: UnitClass, defender: UnitClass): boolean {
  const att = BALANCE.classes[attacker].role;
  const def = BALANCE.classes[defender].role;
  return BALANCE.roleRelations.some((r) => r.attacker === att && r.defender === def);
}

/**
 * The FR14 damage multiplier `attacker` applies to `defender` (story 4.3):
 * ×3/2 on advantage; ×3/4 on disadvantage (the defender's role holds a
 * SYMMETRIC edge over the attacker's — hunts grant NO reverse penalty);
 * `undefined` when the roles are unrelated. Advantage is checked first, so a
 * role pair never reads as both.
 */
export function rpsRatio(attacker: UnitClass, defender: UnitClass): Ratio | undefined {
  if (dealsAdvantage(attacker, defender)) return BALANCE.formulas.rpsAdvantage;
  const att = BALANCE.classes[attacker].role;
  const def = BALANCE.classes[defender].role;
  const disadvantaged = BALANCE.roleRelations.some((r) => r.kind === 'symmetric' && r.attacker === def && r.defender === att);
  return disadvantaged ? BALANCE.formulas.rpsDisadvantage : undefined;
}
