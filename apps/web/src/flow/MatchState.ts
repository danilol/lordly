import type { Element, MatchSetup, Mode, Placement, Tactic, UnitClass } from '@lordly/engine';

/**
 * A drafted unit before the battle: its class, its once-rolled element
 * (FR3, AD-9), and its once-rolled name (FR37, story 4.2). Element and name
 * are stored DATA — rolled exactly once at draft time on the `elements/A`
 * and `names/A` streams and never re-derived.
 */
export interface DraftedUnit {
  class: UnitClass;
  element: Element;
  name: string;
}

/** Where the match is in the Draft → Placement → committed flow (AD-5 FSM). */
export type MatchPhase = 'draft' | 'placement' | 'committed';

/**
 * The single, PLAIN, JSON-serializable source of match truth (AD-5), owned
 * and mutated only by `MatchFlow` (AD-13) and passed explicitly between
 * scenes. It holds NO live RNG `Stream`, NO Phaser object, and NO function —
 * everything here survives `JSON.parse(JSON.stringify(state))` unchanged
 * (enforced by a test), so a scene transition can never smuggle
 * unserializable state.
 *
 * The forward-only element requirement (FR3 re-add draws the NEXT value) is
 * reconciled with serializability by `elementsRolled`: a monotonic count of
 * how many `elements/A` draws have EVER been made. The live stream is never
 * stored — `MatchFlow` reconstructs it from `seed` and fast-forwards past
 * `elementsRolled` draws. Removing a unit does NOT decrement the count, so a
 * re-add always draws a fresh, never-seen value. `(seed, elementsRolled)`
 * fully determines every element drawn so far.
 */
export interface MatchState {
  /** uint32 match seed (AD-10); fresh per match, rematches included. */
  seed: number;
  /**
   * Battle mode (FR17/FR19): 'single' (Standard, the default) or 'wipeout'.
   * Chosen on Home before drafting (story 1.10); carried across rematches
   * like `lastAiArchetypeId` — changing mode means returning Home.
   */
  mode: Mode;
  /** The player's drafted units (side A — AD-11), in draft order, filling `BALANCE.slotBudget` slots (AD-1). */
  playerArmy: DraftedUnit[];
  /** Placement of each player unit, parallel to `playerArmy` by index; `null` = still in the tray. */
  playerPlacements: (Placement | null)[];
  /** Monotonic count of `elements/A` draws made this match (forward-only guard). */
  elementsRolled: number;
  /**
   * The CLASS of every `names/A` draw ever made this match, in draw order
   * (forward-only, append-only — the names twin of `elementsRolled`, story
   * 4.2). A count alone would not suffice: a name draw's bounds come from the
   * class's sex-keyed table, so replaying the fast-forward bit-identically
   * needs each past draw's class (armor for 4.8's construct table, whose
   * length may differ). Removing a unit never pops this list (AD-10
   * forward-only: discarded rolls never rewind).
   */
  nameRolls: UnitClass[];
  /**
   * The designated leader index into `playerArmy`, or `null` when unset
   * (story 4.2, AD-9). The 4.5 picker sets it; until then it stays `null`
   * and `commit()` maps `null` → 0, the explicit interim default. CLEARED
   * (→ null) by every army mutation — the leader-clearing invariant lands
   * with the hook so 4.5 only adds the picker.
   */
  playerLeader: number | null;
  /**
   * The player's army-wide target-selection tactic (FR34, story 4.4), set by
   * the Placement picker; defaults to `'autonomous'`. UNLIKE the leader, a
   * tactic is not tied to any unit, so it is NOT cleared by army mutations —
   * it persists through draft/remove. `'leader'` is only pickable once story
   * 4.5 ships leader designation (the picker greys it out until then).
   */
  playerTactic: Tactic;
  /** Current phase of the flow (AD-5). */
  phase: MatchPhase;
  /** The assembled, validated setup once committed — the handoff to story 1.9's Reveal. */
  committedSetup?: MatchSetup;
  /** The previous match's AI archetype id, threaded as `chooseSetup`'s `exclude` for rematch no-repeat (FR25). */
  lastAiArchetypeId?: string;
}
