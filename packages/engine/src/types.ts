/**
 * Domain vocabulary for Lord Battle Tactics (AD-4: the engine owns these
 * types; no app redeclares them). Wording follows the PRD Glossary verbatim:
 * a **match** is one full loop draft → placement → reveal → battle → result;
 * a **battle** is the automated combat between the two revealed boards,
 * made of one **engagement** (MVP mode) or several (until-wipeout mode);
 * an engagement resolves in **passes** on the AGI initiative timeline, each
 * unit spending **actions**. New domain words go to the PRD Glossary first.
 *
 * Runtime enumerations are exported as `ALL_*` const arrays and the unions
 * derive from them — apps and tests iterate the arrays instead of
 * redeclaring the sets (AD-4).
 */

/**
 * The unit classes (FR1, FR15), shipped-six first, then the wave-1 smalls
 * (story 4.3), then the Golem (story 4.8) — the 12th and final wave-1 class,
 * the roster's only `sizeClass: 'monster'` (a single-cell unit that RESERVES
 * its 8 king-move neighbors at placement — device revision, 2026-07-20 —
 * never a two-cell body; AD-14). Dragons and beasts are DEFERRED to a later
 * wave together with their slayer classes (dossier D-1b) — wave 1 ships
 * Golem only, despite the epics/PRD's stale "dragon and golem" wording.
 */
export const ALL_CLASSES = [
  'knight',
  'mercenary',
  'archer',
  'mage',
  'cleric',
  'witch',
  'berserker',
  'phalanx',
  'ninja',
  'valkyrie',
  'sorceress',
  'golem',
] as const;

/** One unit class. Matchups derive from the class's `role` and the role-relation table (FR14, AD-4 — story 4.3). */
export type UnitClass = (typeof ALL_CLASSES)[number];

/**
 * The seven combat roles (FR14, dossier §1 — story 4.3). Matchups live on the
 * ROLE, not the class: new classes inherit relations by role, so the rule count
 * stays flat as the roster grows. The shipped-six role assignments reproduce the
 * old `rpsBeats`/`rpsHunts` triangle exactly (the FR14 degenerate case).
 */
export const ALL_ROLES = ['vanguard', 'skirmisher', 'sniper', 'artillery', 'support', 'control', 'brute'] as const;

/** One of the seven combat roles (FR14). */
export type Role = (typeof ALL_ROLES)[number];

/**
 * The four elements (FR3) in FIXED roll order — this order is part of the
 * determinism contract (FR20): `rollElement` indexes into it, so reordering
 * is an engine API change that breaks replays.
 */
export const ALL_ELEMENTS = ['fire', 'water', 'wind', 'earth'] as const;

/**
 * One of the four elements (FR3), rolled per unit at draft from the owner's
 * element stream. A Witch's prepared spell is keyed to her element (FR16);
 * for every other class the element is cosmetic in the MVP.
 */
export type Element = (typeof ALL_ELEMENTS)[number];

/** Both sides of a battle (AD-11). */
export const ALL_SIDES = ['A', 'B'] as const;

/**
 * A side of the battle (AD-11). The engine knows only 'A' and 'B';
 * in vs-AI play the human is always side 'A'.
 */
export type Side = (typeof ALL_SIDES)[number];

/** Grid rows in near-to-far order from the owner's perspective (AD-11). */
export const ALL_ROWS = ['front', 'mid', 'back'] as const;

/**
 * A grid row, owner-local (AD-11): 'front' is the row nearest the enemy from
 * the owner's own perspective. Lane mirroring is renderer math, never data.
 */
export type Row = (typeof ALL_ROWS)[number];

/** Grid columns in left-to-right order from the owner's perspective (AD-11). */
export const ALL_COLS = ['left', 'center', 'right'] as const;

/**
 * A grid column, owner-local (AD-11), from the owner's own perspective.
 * A unit's **facing column** is the enemy column directly across its lane;
 * its **reach** is that column plus adjacent ones (FR7).
 */
export type Col = (typeof ALL_COLS)[number];

/** Battle mode (FR17, FR19): one engagement, or engagements until wipeout. */
export type Mode = 'single' | 'wipeout';

/**
 * The four army-wide tactics (FR34, dossier §4), in picker order. Story 4.2
 * lands the vocabulary; the resolution pipeline arrives in 4.4 and leader
 * designation in 4.5 — until then flows commit 'autonomous' explicitly.
 */
export const ALL_TACTICS = ['autonomous', 'weakest', 'strongest', 'leader'] as const;

/** An army-wide targeting tactic (FR34). 'autonomous' is the shipped FR7-FR12 behavior. */
export type Tactic = (typeof ALL_TACTICS)[number];

/**
 * The Witch's four spells, keyed to her element (FR16):
 * water→sleep, earth→poison, fire→weaken, wind→confusion.
 * The mapping itself lives in the balance data.
 */
export type SpellKind = 'sleep' | 'poison' | 'weaken' | 'confusion';

/**
 * Unit identity: `side:index`, assigned by the engine from the order of
 * `MatchSetup.armies` (AD-11). Display names and sprites are shell-side.
 */
export type UnitId = `${Side}:${number}`;

/**
 * One drafted unit: a class, its rolled element (FR1, FR3), and its rolled
 * name (FR37, story 4.2). The name is FLAVOR — rolled once at draft on the
 * owner's `names/*` stream (AD-10), stored here as data (AD-9), never a
 * gameplay input.
 */
export interface Unit {
  class: UnitClass;
  element: Element;
  name: string;
}

/**
 * One cell of the owner's 3×3 grid (FR4), owner-local coordinates (AD-11).
 *
 * ANCHOR SEMANTICS (AD-9/AD-14, story 4.2): a placement is the unit's ANCHOR
 * cell. Smalls occupy exactly their anchor — structurally nothing changed for
 * them. A monster (story 4.8) anchors at its front-most cell and DERIVES its
 * second cell (the cell behind) in the engine; the stored data stays one cell
 * per unit.
 */
export interface Placement {
  row: Row;
  col: Col;
}

/**
 * The canonical battle input, exactly as AD-9 fixes it. A battle is a pure
 * function of this object (FR20): same `MatchSetup` → bit-identical battle.
 *
 * - `seed` — the single 32-bit unsigned **seed** all randomness derives from
 *   (AD-10 named streams); generated by the shell, fresh per match.
 * - `balanceVersion` — must match the engine's balance data version (AD-8).
 * - `armies` — both drafted armies; elements are **stored data**, rolled once
 *   at draft via the engine's roll function, never re-derived (AD-9).
 * - `placements` — parallel-indexed to `armies` (unit index → ANCHOR cell),
 *   owner-local (AD-11).
 * - `tactics` — each side's committed army-wide tactic (FR34, story 4.2).
 *   The picker ships in 4.4; until then flows commit 'autonomous' explicitly.
 * - `leaders` — each side's leader as an index into that side's army (FR35,
 *   story 4.2 SHAPE). Designation UI + the leader-fall sober package shipped
 *   in story 4.5 — both flows now always supply a real crowned index.
 */
export interface MatchSetup {
  seed: number;
  balanceVersion: number;
  mode: Mode;
  tactics: { A: Tactic; B: Tactic };
  leaders: { A: number; B: number };
  armies: { A: Unit[]; B: Unit[] };
  placements: { A: Placement[]; B: Placement[] };
}

/**
 * Version of the `BattleEvent` union below (AD-12). Extending the union
 * bumps this integer: v1 = chassis envelope (story 1.4); v2 = +UnitAttacked,
 * +UnitDied (story 1.5); v3 = the full closed set (+UnitHealed,
 * +StatusApplied, +ActionMisfired, +ActionFizzled, +PoisonTicked — story 1.6);
 * v4 = the squad-era extension, landed COMPLETE in ONE bump (story 4.2,
 * AD-15/dossier §5): +GuardRaised, +GuardEnded, +StatusCleared, +LeaderFell,
 * `UnitAttacked.kind`/`redirectedFrom?`, per-target `outcome`, and
 * `PassStarted.actionsRemaining`.
 */
export const LOG_VERSION = 4;

/**
 * The physical shape of an attack (FR32, story 4.2): the renderer's flavor
 * reads THIS, never the class — story 4.7's row-varied moves make class
 * inference wrong. 'bash' joins with the Phalanx (4.7).
 */
export type MoveKind = 'slash' | 'arrow' | 'blast' | 'staff' | 'bash';

/**
 * A class's per-row move (FR32/FR33, story 4.7, dossier §4 — DATA, not code):
 * either an attack (`MoveKind`, carried on the `UnitAttacked` it produces) or
 * a Guard stance (`'guard-full'` | `'guard-half'`) — a non-attack behavior
 * that raises a shield instead, so it deliberately is NOT a `MoveKind` and
 * never rides `UnitAttacked.kind`.
 */
export type RowMove = MoveKind | 'guard-full' | 'guard-half';

/**
 * One unit's full initial render state, carried by `BattleStarted` so the
 * shell never re-derives anything (AD-2, AD-12).
 */
export interface UnitSnapshot {
  id: UnitId;
  side: Side;
  class: UnitClass;
  element: Element;
  /** The unit's rolled name (FR37, story 4.2) — narration reads it from here. */
  name: string;
  placement: Placement;
  hp: number;
  maxHp: number;
}

/** The battle began; carries the complete initial roster (AD-2). */
export interface BattleStarted {
  type: 'BattleStarted';
  units: UnitSnapshot[];
}

/**
 * A new **pass** of the initiative timeline began (FR13). Multihit units act
 * once per pass, so the pass boundaries make the multihit split visible.
 * `actionsRemaining` (story 4.2, FR39b) snapshots every unit's unspent
 * actions as the pass opens (dead units read 0) — the action ledger's
 * per-turn anchor; per-beat decrements derive from the observed events.
 */
export interface PassStarted {
  type: 'PassStarted';
  pass: number;
  actionsRemaining: Record<UnitId, number>;
}

/**
 * A unit's turn came up and no acted event was produced. In the chassis
 * (story 1.4) every taken turn is `'idle'` — combat stories replace acted
 * turns with real events; `'asleep'` (Sleep status, FR16) and `'dead'`
 * (lost unspent actions, FR13) keep their meanings from 1.5/1.6 on.
 */
export interface ActionSkipped {
  type: 'ActionSkipped';
  unit: UnitId;
  reason: 'dead' | 'asleep' | 'idle';
}

/**
 * One target's share of an attack: the **damage** dealt (post-RPS, post-clamp
 * integer — FR14/FR15) and the target's HP after it landed. The shell renders
 * these numbers directly and never recomputes them (AD-2).
 *
 * OVERKILL SEMANTICS: `damage` is the attack's full computed value — on a
 * killing blow it may exceed the HP actually removed (a 24-damage hit on an
 * 18-hp unit reports `damage: 24, hpAfter: 0`). Popup numbers render
 * `damage` (OB64 style); HP bars are driven by `hpAfter`, which is
 * authoritative.
 */
export interface AttackTarget {
  unit: UnitId;
  damage: number;
  hpAfter: number;
  /**
   * How the hit resolved (FR36, story 4.2): 'hit' is unconditional until
   * story 4.6 lands ADR 0003's dodge/crit draws ('dodged' reports damage 0;
   * 'missed' is reserved, unused in wave 1).
   */
  outcome: 'hit' | 'crit' | 'dodged' | 'missed';
}

/**
 * A unit attacked (one **action**, one event — AD-12). Melee swings carry a
 * single target; the Mage's row blast (story 1.6) carries one entry per unit
 * in the struck row — the array shape is fixed now so 1.6 extends without a
 * breaking change.
 */
export interface UnitAttacked {
  type: 'UnitAttacked';
  source: UnitId;
  /** The move's physical shape (FR32, story 4.2) — render flavor reads this, never the class. */
  kind: MoveKind;
  /**
   * Present when a Guard shield reduced this landed hit (FR33, emitted from
   * story 4.7): the id of the unit whose Guard charge absorbed it — NOT a
   * retarget (Danilo 2026-07-19 revision, supersedes the dossier's original
   * redirect design). The attacked unit stays `targets[].unit`; this field
   * only attributes the block so the shell can flash the guarding unit.
   */
  redirectedFrom?: UnitId;
  targets: AttackTarget[];
}

/** A unit's HP reached 0 (FR18 wipe input); it loses its unspent actions (FR13). */
export interface UnitDied {
  type: 'UnitDied';
  unit: UnitId;
}

/**
 * A heal landed (FR11). Unlike `AttackTarget.damage` (which reports the full
 * computed value even on overkill), `amount` is the EFFECTIVE hp restored —
 * FR11 explicitly caps healing at max HP, so the cap is part of the rule,
 * not a rendering concern. `hpAfter` is authoritative for bars either way.
 */
export interface UnitHealed {
  type: 'UnitHealed';
  source: UnitId;
  target: UnitId;
  amount: number;
  hpAfter: number;
}

/** A Witch spell landed on a unit (FR12/FR16). Same spell never stacks. */
export interface StatusApplied {
  type: 'StatusApplied';
  source: UnitId;
  target: UnitId;
  spell: SpellKind;
}

/**
 * A confused unit's action misfired onto its own side (FR16 Wind→Confusion).
 * MARKER + EFFECT PAIR (recorded spec decision, story 1.6): this event is
 * immediately followed by the redirected effect event(s) — a `UnitAttacked`
 * on an ally, a `UnitHealed` on an enemy, a `StatusApplied` on an ally, or
 * an `ActionFizzled` when no valid misfire target exists. AD-12's "one event
 * per (actor, action)" governs blast fan-out, not this narration pair.
 */
export interface ActionMisfired {
  type: 'ActionMisfired';
  unit: UnitId;
}

/**
 * A spent action with no valid effect (FR16): a misfire with no target on
 * the required side, or a Witch cast whose every reachable enemy already
 * bears her spell (no-stack — the application is wasted).
 */
export interface ActionFizzled {
  type: 'ActionFizzled';
  unit: UnitId;
}

/**
 * Poison damage at the natural end of an engagement, before judging
 * (FR16 Earth→Poison). Kills emit `UnitDied` after; an instant wipe
 * short-circuits the engagement and skips poison entirely (recorded spec
 * decision — FR18's "instant win"; confirmed for wipeout mode in 1.10: a
 * wipe ends the whole battle, so the skip is coherent in both modes, and
 * poison persists between engagements and ticks at every NATURAL end — FR19).
 */
export interface PoisonTicked {
  type: 'PoisonTicked';
  unit: UnitId;
  damage: number;
  hpAfter: number;
}

/**
 * A unit entered its engagement-long Guard stance (FR33, dossier §4).
 * IN THE UNION FROM v4, EMITTED FROM STORY 4.7 (AD-15: the union lands
 * complete in one bump; the Guard move itself is 4.7's).
 */
export interface GuardRaised {
  type: 'GuardRaised';
  unit: UnitId;
}

/**
 * A unit's Guard stance expired at engagement end (FR33) — an explicit event,
 * NO shell-side lifecycle rule (the story-2.2 StatusCleared lesson, applied
 * from birth). In the union from v4, emitted from story 4.7.
 */
export interface GuardEnded {
  type: 'GuardEnded';
  unit: UnitId;
}

/**
 * A Witch status lifted at the between-engagement reset (FR19, story 4.2):
 * the log narrates every clear the engine performs — poison persists and is
 * NEVER cleared. Kills the shell's `clearStatusIconsExceptPoison` rule (the
 * sanctioned AD-2 exception from story 2.2 dies here).
 */
export interface StatusCleared {
  type: 'StatusCleared';
  unit: UnitId;
  spell: SpellKind;
}

/**
 * A side's designated leader died (FR35, dossier §4): the sober-package
 * penalty onset beat (the ratios themselves are static balance facts).
 * In the union from v4, emitted from story 4.5.
 */
export interface LeaderFell {
  type: 'LeaderFell';
  side: Side;
  unit: UnitId;
}

/**
 * An **engagement** finished: every unit spent its actions (FR17). Carries
 * the per-unit HP snapshot judging and the wipeout loop will read (FR18/19).
 */
export interface EngagementEnded {
  type: 'EngagementEnded';
  engagement: number;
  hp: Record<UnitId, number>;
}

/** The battle is decided (FR18 **judging**): winner or draw with both HP percentages. */
export interface BattleEnded {
  type: 'BattleEnded';
  winner: Side | 'draw';
  hpPct: { A: number; B: number };
}

/**
 * The closed, versioned battle event union (AD-12): past-tense, one event
 * per (actor, action) — blast fan-out lives inside `UnitAttacked.targets`,
 * and a confusion redirect is an `ActionMisfired` marker + its effect event.
 * v4 (story 4.2, AD-15) is the COMPLETE squad-era set: every observable rule
 * of PRD Features 3–6b narrates through these — GuardRaised/GuardEnded and
 * LeaderFell sit unemitted until 4.7/4.5 by design (one bump, whole union);
 * the shell renders from these and never re-derives state (AD-2).
 */
export type BattleEvent =
  | BattleStarted
  | PassStarted
  | UnitAttacked
  | UnitHealed
  | StatusApplied
  | ActionMisfired
  | ActionFizzled
  | ActionSkipped
  | PoisonTicked
  | UnitDied
  | GuardRaised
  | GuardEnded
  | StatusCleared
  | LeaderFell
  | EngagementEnded
  | BattleEnded;

/**
 * The engine's entire output (AD-1, AD-2): an immutable ordered narration of
 * the battle. The shell replays it; it never evaluates a combat rule.
 */
export interface BattleLog {
  logVersion: number;
  events: readonly BattleEvent[];
}
