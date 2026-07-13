import type { Element, MatchSetup, Placement, UnitClass } from '@lordly/engine';

/**
 * A drafted unit before the battle: its class and its once-rolled element
 * (FR3, AD-9). The element is stored DATA — rolled exactly once at draft
 * time on the `elements/A` stream and never re-derived.
 */
export interface DraftedUnit {
  class: UnitClass;
  element: Element;
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
  /** The player's drafted units (side A — AD-11), in draft order, length 0..3. */
  playerArmy: DraftedUnit[];
  /** Placement of each player unit, parallel to `playerArmy` by index; `null` = still in the tray. */
  playerPlacements: (Placement | null)[];
  /** Monotonic count of `elements/A` draws made this match (forward-only guard). */
  elementsRolled: number;
  /** Current phase of the flow (AD-5). */
  phase: MatchPhase;
  /** The assembled, validated setup once committed — the handoff to story 1.9's Reveal. */
  committedSetup?: MatchSetup;
  /** The previous match's AI archetype id, threaded as `chooseSetup`'s `exclude` for rematch no-repeat (FR25). */
  lastAiArchetypeId?: string;
}
