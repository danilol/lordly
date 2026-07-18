import { nextInt } from './rng';
import type { Stream } from './rng';
import { ALL_COLS } from './types';
import type { Placement, UnitClass } from './types';

/**
 * One curated AI strategy (FR25): a composition + formation the AI can
 * commit. `placement` is parallel to `classes` by index — the same
 * parallelism contract as `MatchSetup.armies`/`placements` (AD-9). Pool
 * entries are DATA: curated against the sim harness (NFR4), freely editable
 * without an engine API change.
 */
export interface StrategyArchetype {
  /** Stable kebab-case identity — appears in sim reports and no-repeat threading. */
  id: string;
  /** Human-readable name for reports and (later) debug UI. */
  name: string;
  /**
   * Length-5 tuples (story 4.2 — all-smalls era, 5 slots = 5 units): the
   * tuple keeps archetype authoring compile-checked. Story 4.8's two-slot
   * Golem comps revisit this shape together with their placements.
   */
  classes: readonly [UnitClass, UnitClass, UnitClass, UnitClass, UnitClass];
  placement: readonly [Placement, Placement, Placement, Placement, Placement];
}

/** What the AI committed (FR24): archetype identity + board. NO elements, NO names — see `chooseSetup`. */
export interface AiChoice {
  /** The picked archetype's id; thread it back via `options.exclude` next match. */
  archetypeId: string;
  classes: [UnitClass, UnitClass, UnitClass, UnitClass, UnitClass];
  placement: [Placement, Placement, Placement, Placement, Placement];
}

/** Options for `chooseSetup`. Deliberately admits nothing player-derived (AD-6). */
export interface ChooseSetupOptions {
  /**
   * An archetype id to exclude from the pick — the previous match's
   * `archetypeId`, threaded by the CALLER (FR25's "not the same board twice
   * in a row"; a pure function cannot remember — recorded spec decision).
   * An id not in the pool (or one that would empty it) leaves the whole
   * pool eligible.
   */
  exclude?: string;
}

/**
 * The curated strategy pool (FR25): 8–12 archetypes spanning the roster's
 * answers to each other — including the required back-row-sniper
 * (`longbows`, `talons`) and anti-front-stack (`three-mages`: triple row
 * blast massacres stacked rows) roles. Story 4.2 re-authored every entry as
 * a 5-slot composition, EXTENDING each archetype's identity (bulwark stays a
 * wall, longbows stays an archer line) rather than redesigning it. Curated
 * EMPIRICALLY against the sim harness (NFR4): matchups between fixed boards
 * are near-deterministic, so each member's pool-relative aggregate win rate
 * must stay inside the ≤65% acceptance band at the CI-pinned config
 * (test/sim.test.ts) in BOTH modes — the 5-unit meta was re-swept at 4.2
 * over a ~40-variant identity-preserving search (comp support slots +
 * placements). Converged rates at runs=200: single 30.9–62.3% (top cabal),
 * wipeout 24.8–62.8% (top wardens). 5-unit meta lessons encoded below: a
 * front screen absorbs a whole engagement of melee (single mode is a ranged
 * damage race), back-row casters double their actions, and spread
 * formations (≤2 per row) starve the blast. Deliberately absent
 * (3-unit-era probe, kept as a caution): dominant full-RPS spread families
 * are left as discoverable player tech rather than an AI board no pool
 * could balance (see README's Balancing harness section).
 */
export const STRATEGY_POOL: readonly StrategyArchetype[] = [
  {
    id: 'bulwark',
    name: 'Bulwark',
    // Story 4.3: one of the wall is a Berserker (Vanguard bruiser) — single-unit swap, identity intact, covers the newcomer (sweep-placed).
    classes: ['knight', 'berserker', 'knight', 'knight', 'knight'],
    placement: [
      { row: 'front', col: 'left' },
      { row: 'front', col: 'center' },
      { row: 'front', col: 'right' },
      { row: 'mid', col: 'center' },
      { row: 'back', col: 'center' },
    ],
  },
  {
    id: 'longbows',
    name: 'Longbows',
    classes: ['archer', 'archer', 'archer', 'knight', 'cleric'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'back', col: 'center' },
      { row: 'front', col: 'center' },
      { row: 'mid', col: 'center' },
    ],
  },
  {
    id: 'three-mages',
    name: 'Three Mages',
    classes: ['mage', 'mage', 'mage', 'knight', 'knight'],
    placement: [
      { row: 'mid', col: 'left' },
      { row: 'mid', col: 'center' },
      { row: 'mid', col: 'right' },
      { row: 'front', col: 'center' },
      { row: 'front', col: 'left' },
    ],
  },
  {
    id: 'talons',
    name: 'Talons',
    // Story 4.3: one archer line-mate is a Valkyrie (Skirmisher) — single-unit swap, covers the newcomer (sweep-placed).
    classes: ['archer', 'archer', 'archer', 'valkyrie', 'mercenary'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'mid', col: 'right' },
      { row: 'back', col: 'right' },
      { row: 'mid', col: 'left' },
      { row: 'front', col: 'center' },
    ],
  },
  {
    id: 'hex-coven',
    name: 'Hex Coven',
    classes: ['witch', 'witch', 'knight', 'witch', 'knight'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'mid', col: 'center' },
      { row: 'front', col: 'center' },
      { row: 'back', col: 'right' },
      { row: 'front', col: 'left' },
    ],
  },
  {
    id: 'cabal',
    name: 'Cabal',
    // Story 4.3: the coven's flank is a Ninja (Skirmisher) now — single-unit swap, covers the newcomer (sweep-placed).
    classes: ['mage', 'witch', 'cleric', 'mage', 'ninja'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'mid', col: 'center' },
      { row: 'back', col: 'center' },
      { row: 'back', col: 'right' },
      { row: 'mid', col: 'left' },
    ],
  },
  {
    id: 'farshot',
    name: 'Farshot',
    classes: ['archer', 'mage', 'cleric', 'archer', 'witch'],
    placement: [
      { row: 'mid', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'back', col: 'center' },
      { row: 'mid', col: 'right' },
      { row: 'back', col: 'left' },
    ],
  },
  {
    id: 'wardens',
    name: 'Wardens',
    // Story 4.3: one line-mate is a Phalanx (Vanguard wall) now — single-unit swap keeps the tuned identity, covers the newcomer (sweep-placed).
    classes: ['mercenary', 'knight', 'archer', 'mercenary', 'phalanx'],
    placement: [
      { row: 'front', col: 'right' },
      { row: 'front', col: 'center' },
      { row: 'mid', col: 'left' },
      { row: 'front', col: 'left' },
      { row: 'mid', col: 'right' },
    ],
  },
  {
    id: 'ambushers',
    name: 'Ambushers',
    classes: ['mercenary', 'witch', 'archer', 'mercenary', 'mage'],
    placement: [
      { row: 'front', col: 'center' },
      { row: 'back', col: 'left' },
      { row: 'mid', col: 'right' },
      { row: 'mid', col: 'center' },
      { row: 'back', col: 'center' },
    ],
  },
  {
    id: 'gale',
    name: 'Gale',
    // Story 4.3: one of the storm's artillery is a Sorceress (the Wizard's twin) — single-unit swap, covers the newcomer (sweep-placed).
    classes: ['witch', 'archer', 'mage', 'archer', 'sorceress'],
    placement: [
      { row: 'back', col: 'center' },
      { row: 'mid', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'mid', col: 'right' },
      { row: 'back', col: 'left' },
    ],
  },
];

/**
 * The AI's commitment (FR24, AD-6): picks an archetype and a board, purely
 * from (pool, its own `ai/A` or `ai/B` stream, optional exclude). There is
 * NO parameter through which the player's draft or placement could pass —
 * FR24 holds by construction, not discipline.
 *
 * Elements are NOT chosen here (recorded spec decision): the caller rolls
 * them on `elements/<side>` per AD-9 — one flow for human and AI sides.
 * Consequence: the AI cannot adapt its placement to its Witch's element
 * (a human can, FR3); accepted MVP asymmetry.
 *
 * AI-STREAM ORDERING INVARIANT (FR20 replay stability): per call, draws
 * from the ai stream happen in EXACTLY this order — ① one archetype pick
 * over the eligible pool, ② one placement-mirror coin flip. Nothing else
 * draws. Story 1.8's shell and the sim harness must produce identical
 * boards from identical stream states; reordering either draw breaks that.
 *
 * The mirror flip (recorded spec decision): on 1, every placement's col is
 * mirrored left↔right (owner-local; rows untouched) — doubling board
 * variety per archetype while preserving its row intent.
 */
export function chooseSetup(pool: readonly StrategyArchetype[], stream: Stream, options?: ChooseSetupOptions): AiChoice {
  if (pool.length === 0) {
    throw new Error('chooseSetup: pool must be non-empty');
  }

  const remaining = pool.filter((a) => a.id !== options?.exclude);
  const eligible = remaining.length > 0 ? remaining : pool;

  const picked = eligible[nextInt(stream, 0, eligible.length - 1)] as StrategyArchetype;
  const mirrored = nextInt(stream, 0, 1) === 1;

  const placement = picked.placement.map(({ row, col }) => {
    // Owner-local left↔right mirror: col index i → 2 − i (center is its own mirror).
    const colIndex = ALL_COLS.indexOf(col);
    if (colIndex === -1) {
      throw new Error(`chooseSetup: archetype "${picked.id}" has invalid col "${String(col)}"`);
    }
    return { row, col: mirrored ? (ALL_COLS[ALL_COLS.length - 1 - colIndex] as Placement['col']) : col };
  }) as AiChoice['placement'];

  return { archetypeId: picked.id, classes: [...picked.classes], placement };
}
