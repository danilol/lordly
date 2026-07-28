import type { Element, Race, Role, RowMove, SpellKind, Unit, UnitClass } from './types';

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
  /**
   * The move the class performs from each row (FR32/FR33, story 4.7, dossier
   * §4 — DATA, not code): `act()` dispatches on the looked-up value, never on
   * `class` alone. Total over all three rows — classes whose move is
   * row-invariant repeat the same `MoveKind` in all three slots so the table
   * stays total and the FR2 drift guard can read it as real data.
   */
  moves: { front: RowMove; mid: RowMove; back: RowMove };
  /** Physical size (FR38): drives slot cost and (from 4.8) the two-cell footprint. */
  sizeClass: SizeClass;
  /** Race (E5-D13, story 5.5): the leader-eligibility axis — only 'human' may be crowned. See `Race` in types.ts for why it is neither `sizeClass` nor `role`. */
  race: Race;
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
    /**
     * FR33 Half Guard (Knight, story 4.7, dossier §4): the next landed
     * single-target physical hit on a shielded cell is reduced to
     * `max(minDamage, floor(dmg × num/den))`, applied as the OUTERMOST
     * post-pipeline step (after `physicalDamage`/`leaderPenaltyPhysical`
     * return). Full Guard (Phalanx) needs no ratio — it sets damage to `0`.
     */
    guardHalf: Ratio;
  };
}

/**
 * The balance data (FR15 class table verbatim from the PRD; initial tuning
 * values). This is DATA, not code (NFR4): tuning edits change numbers here
 * and bump `version` — the balance-hash CI test fails if the bump is
 * forgotten (AD-8).
 */
export const BALANCE: BalanceData = {
  version: 11, // story 5.5: the monster wave (dossier ROSTER.md) — 10 monsters, `breath`, the `race` field, dragonslayer hunt goes live

  slotBudget: 5,
  engagementCap: 10,
  classes: {
    // Per-row moves (FR32/FR33, story 4.7, dossier §4 — the frozen START-GENERIC
    // table, TUNABLE with Danilo as a follow-up pass): only Knight, Phalanx,
    // Wizard(mage), Sorceress vary by row — everyone else repeats its uniform
    // attack kind in all three slots (row only changes ACTION COUNT for them,
    // FR15, unchanged).
    knight: {
      hp: 140,
      str: 30,
      vit: 28,
      int: 8,
      men: 14,
      agi: 8,
      dex: 16,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'guard-half', back: 'slash' },
      sizeClass: 'small',
      race: 'human',
      role: 'vanguard',
    },
    mercenary: {
      hp: 110,
      str: 26,
      vit: 20,
      int: 10,
      men: 14,
      agi: 14,
      dex: 18,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'slash' },
      sizeClass: 'small',
      race: 'human',
      role: 'skirmisher',
    },
    archer: {
      hp: 90,
      str: 24,
      vit: 12,
      int: 10,
      men: 12,
      agi: 22,
      dex: 24,
      actions: { front: 1, mid: 2, back: 2 },
      moves: { front: 'arrow', mid: 'arrow', back: 'arrow' },
      sizeClass: 'small',
      race: 'human',
      role: 'sniper',
    },
    // Story 5.4 (dossier E5-D4): casters LOSE the row splash — mid/back is the
    // single-target magic `bolt` now; row AoE is reserved for a future Archmage.
    mage: {
      hp: 80,
      str: 6,
      vit: 8,
      int: 30,
      men: 22,
      agi: 12,
      dex: 14,
      actions: { front: 1, mid: 1, back: 2 },
      moves: { front: 'staff', mid: 'bolt', back: 'bolt' },
      sizeClass: 'small',
      race: 'human',
      role: 'artillery',
    },
    cleric: {
      hp: 90,
      str: 8,
      vit: 12,
      int: 24,
      men: 24,
      agi: 10,
      dex: 12,
      actions: { front: 1, mid: 1, back: 2 },
      moves: { front: 'staff', mid: 'staff', back: 'staff' },
      sizeClass: 'small',
      race: 'human',
      role: 'support',
    },
    witch: {
      hp: 85,
      str: 6,
      vit: 10,
      int: 26,
      men: 20,
      agi: 26,
      dex: 16,
      actions: { front: 1, mid: 1, back: 2 },
      // Unreachable in play (the Witch casts/fizzles, never strikes) — kept
      // total, mirroring the retired CLASS_MOVE_KIND convention.
      moves: { front: 'staff', mid: 'staff', back: 'staff' },
      sizeClass: 'small',
      race: 'human',
      role: 'control',
    },
    // Wave-1 additions (story 4.3, dossier §1 — TUNING DRAFTS, sweep-policed). Golem (monster) ships in 4.8.
    berserker: {
      hp: 120,
      str: 34,
      vit: 14,
      int: 6,
      men: 10,
      agi: 12,
      dex: 18,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'slash' },
      sizeClass: 'small',
      race: 'human',
      role: 'vanguard',
    },
    // Story 5.4 (dossier E5-P2): guard rows carry ONE action now (2/1/1 →
    // 1/1/1) — a second same-turn Guard raise re-armed nothing but a spent
    // charge, so the extra front action was a phantom. Back-row bash keeps 1.
    phalanx: {
      hp: 150,
      str: 22,
      vit: 34,
      int: 6,
      men: 18,
      agi: 6,
      dex: 12,
      actions: { front: 1, mid: 1, back: 1 },
      moves: { front: 'guard-full', mid: 'guard-full', back: 'bash' },
      sizeClass: 'small',
      race: 'human',
      role: 'vanguard',
    },
    ninja: {
      hp: 85,
      str: 22,
      vit: 10,
      int: 8,
      men: 12,
      agi: 28,
      dex: 30,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'slash' },
      sizeClass: 'small',
      race: 'human',
      role: 'skirmisher',
    },
    // Story 5.4 (dossier E5-D10 + the approved Valkyrie amendment): back row
    // is the magic `bolt` ("Lightning") ×2 — her side-gun row; INT 12 → 18 so
    // it lands as real damage (INT 18 − MEN/2 ≈ 11 vs MEN 14), not a nerf-trap.
    valkyrie: {
      hp: 105,
      str: 24,
      vit: 16,
      int: 18,
      men: 16,
      agi: 20,
      dex: 20,
      actions: { front: 2, mid: 1, back: 2 },
      moves: { front: 'slash', mid: 'slash', back: 'bolt' },
      sizeClass: 'small',
      race: 'human',
      role: 'skirmisher',
    },
    // Story 5.4 (dossier E5-D4): same splash removal as the mage — see above.
    sorceress: {
      hp: 78,
      str: 6,
      vit: 8,
      int: 28,
      men: 20,
      agi: 16,
      dex: 15,
      actions: { front: 1, mid: 1, back: 2 },
      moves: { front: 'staff', mid: 'bolt', back: 'bolt' },
      sizeClass: 'small',
      race: 'human',
      role: 'artillery',
    },
    // Story 4.8 (dossier §1/§2, D-1b) — the wave's ONLY monster (the dragon is
    // deferred to a later wave with its slayer classes; "dragon and golem" in
    // the epics/PRD is STALE). A physical WALL (VIT 36, HP 300) that MELTS to
    // magic — pure stats (low MEN), no Artillery→Brute relation (D-1e).
    // Uniform melee move across all three rows ("everyone else uniform",
    // dossier §4) — only its acting row (action count) varies; `sizeClass:
    // 'monster'` drives its 2-slot cost (SLOT_COST) and its single-cell
    // king-move footprint (device revision, 2026-07-20 — `footprintCells`
    // returns one cell for every class; the monster instead RESERVES its 8
    // king-move neighbors via `validateMatchSetup`/`canPlace`) with no
    // further code change.
    golem: {
      hp: 300,
      str: 28,
      vit: 36,
      int: 4,
      men: 8,
      agi: 4,
      dex: 10,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'slash' },
      sizeClass: 'monster',
      race: 'golem',
      role: 'brute',
    },
    // Story 5.4 — the human wave (epic-5 dossier, ROSTER.md's approved
    // engine-scale rows E5-D15; sweep-policed like every tuning value).
    // The duelist: wins 1v1s on crit/dodge (DEX 24); dies to focus fire.
    fencer: {
      hp: 100,
      str: 27,
      vit: 16,
      int: 8,
      men: 13,
      agi: 20,
      dex: 24,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'slash' },
      sizeClass: 'small',
      race: 'human',
      role: 'skirmisher',
    },
    // Anti-dragon (E5-P1): Skewer lands the one-way ×1.5 dragonslayer→dragon
    // hunt; ordinary stats vs everyone else. INERT until 5.5 ships a dragon.
    dragonhunter: {
      hp: 100,
      str: 24,
      vit: 16,
      int: 8,
      men: 14,
      agi: 18,
      dex: 22,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'slash' },
      sizeClass: 'small',
      race: 'human',
      role: 'dragonslayer',
    },
    // Reliable filler skirmisher — the budget mercenary. Flying is FLAVOR only (E5-D10).
    hawkman: {
      hp: 105,
      str: 24,
      vit: 18,
      int: 8,
      men: 12,
      agi: 16,
      dex: 16,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'slash' },
      sizeClass: 'small',
      race: 'human',
      role: 'skirmisher',
    },
    // Hybrid: melee up close, "Wind Shot" ×2 from the back — a physical Skill
    // riding the shipped `arrow` kind (E5-D14), NOT a bolt.
    vultan: {
      hp: 110,
      str: 26,
      vit: 18,
      int: 8,
      men: 14,
      agi: 24,
      dex: 18,
      actions: { front: 2, mid: 1, back: 2 },
      moves: { front: 'slash', mid: 'slash', back: 'arrow' },
      sizeClass: 'small',
      race: 'human',
      role: 'skirmisher',
    },
    // Aggressive hybrid: hits harder and crits more than the Vultan, thinner.
    // Back-row "Thunder Arrow" is the same physical `arrow` Skill (E5-D14).
    raven: {
      hp: 105,
      str: 26,
      vit: 16,
      int: 8,
      men: 13,
      agi: 22,
      dex: 20,
      actions: { front: 2, mid: 1, back: 2 },
      moves: { front: 'slash', mid: 'slash', back: 'arrow' },
      sizeClass: 'small',
      race: 'human',
      role: 'skirmisher',
    },
    // ── Story 5.5: the monster wave (epic-5 dossier, ROSTER.md's approved
    // engine-scale rows, E5-D15; sweep-policed like every tuning value).
    // Monsters are 2-slot single-cell units reserving their king-move ring
    // (the shipped Golem model) — except the Whelp, a 1-slot SMALL (E5-P3).
    // Bites/claws are display verbs over `slash`; the dragons' back row is
    // the physical row-AoE `breath` (E5-D7); the Gryphon's Wind Shot rides
    // `arrow` (E5-D14). None can be crowned (race, E5-D13).
    // The fast monster: acts early (AGI 26), Wind Shot ×2 from the back.
    gryphon: {
      hp: 220,
      str: 26,
      vit: 24,
      int: 6,
      men: 14,
      agi: 26,
      dex: 18,
      actions: { front: 2, mid: 1, back: 2 },
      moves: { front: 'slash', mid: 'slash', back: 'arrow' },
      sizeClass: 'monster',
      race: 'beast',
      role: 'beast',
    },
    // All-row pressure (bites 2/2/1) — the mid-row monster.
    wyrm: {
      hp: 240,
      str: 30,
      vit: 28,
      int: 4,
      men: 10,
      agi: 20,
      dex: 14,
      actions: { front: 2, mid: 2, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'slash' },
      sizeClass: 'monster',
      race: 'beast',
      role: 'beast',
    },
    // Glass-cannon monster: front Bite ×3 — the game's first 3-action row.
    hellhound: {
      hp: 220,
      str: 28,
      vit: 24,
      int: 6,
      men: 10,
      agi: 18,
      dex: 12,
      actions: { front: 3, mid: 2, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'slash' },
      sizeClass: 'monster',
      race: 'beast',
      role: 'beast',
    },
    // The budget dragon (E5-P3): a 1-slot SMALL mini-bruiser with NO
    // reservation ring — but still dragonkind: hunter bait, never crowned.
    whelp: {
      hp: 130,
      str: 26,
      vit: 22,
      int: 4,
      men: 10,
      agi: 8,
      dex: 10,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'slash' },
      sizeClass: 'small',
      race: 'dragon',
      role: 'dragon',
    },
    // The damage dragon (STR 34; Ember Breath from the back).
    emberdrake: {
      hp: 270,
      str: 34,
      vit: 26,
      int: 6,
      men: 14,
      agi: 16,
      dex: 16,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'breath' },
      sizeClass: 'monster',
      race: 'dragon',
      role: 'dragon',
    },
    // The magic-resistant dragon (MEN 18 — casters struggle).
    frostfang: {
      hp: 265,
      str: 30,
      vit: 26,
      int: 6,
      men: 18,
      agi: 12,
      dex: 18,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'breath' },
      sizeClass: 'monster',
      race: 'dragon',
      role: 'dragon',
    },
    // The fast dragon: early action + crit-leaning DEX.
    stormscale: {
      hp: 260,
      str: 30,
      vit: 25,
      int: 6,
      men: 14,
      agi: 18,
      dex: 20,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'breath' },
      sizeClass: 'monster',
      race: 'dragon',
      role: 'dragon',
    },
    // The wall dragon — closest to the Golem, but it bites back harder.
    cragmaw: {
      hp: 290,
      str: 30,
      vit: 30,
      int: 6,
      men: 14,
      agi: 10,
      dex: 14,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'breath' },
      sizeClass: 'monster',
      race: 'dragon',
      role: 'dragon',
    },
    // The assassin dragon: high STR + a DEX lean.
    nightwing: {
      hp: 265,
      str: 32,
      vit: 26,
      int: 8,
      men: 14,
      agi: 12,
      dex: 18,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'breath' },
      sizeClass: 'monster',
      race: 'dragon',
      role: 'dragon',
    },
    // The balanced holy dragon — no weakness, no spike.
    halowing: {
      hp: 270,
      str: 30,
      vit: 28,
      int: 8,
      men: 16,
      agi: 10,
      dex: 14,
      actions: { front: 2, mid: 1, back: 1 },
      moves: { front: 'slash', mid: 'slash', back: 'breath' },
      sizeClass: 'monster',
      race: 'dragon',
      role: 'dragon',
    },
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
    // Story 5.4 (dossier E5-P1): the Dragon Hunter's one-way ×1.5 vs the
    // dragon role — no reverse penalty (a dragon mauls her back at ×1.0).
    // INERT until story 5.5 ships a class with `role: 'dragon'`.
    { attacker: 'dragonslayer', defender: 'dragon', kind: 'hunt' },
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
    // Story 4.7 (dossier §4, D-2a revised) — Half Guard halves a landed hit;
    // Full Guard (no ratio needed) negates it outright.
    guardHalf: { num: 1, den: 2 },
  },
};

/**
 * Slot cost by size class (AD-1, dossier §1): the ONE source the legality
 * arithmetic derives from — small = 1, monster = 2. Story 4.8's Golem pays 2
 * through this table with no further code change.
 */
export const SLOT_COST: Record<SizeClass, number> = { small: 1, monster: 2 };

/**
 * The most monster-sized units one army may ever field (FR1/FR38, story
 * 4.8) — the ONE source `validate.ts`'s `footprintViolation` and the Draft
 * shell's slot-gating both read, so the cap can never drift between the
 * engine's enforcement and the UI's preview of it.
 */
export const MAX_MONSTERS_PER_ARMY = 2;

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
