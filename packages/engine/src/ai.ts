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
  classes: readonly [UnitClass, UnitClass, UnitClass];
  placement: readonly [Placement, Placement, Placement];
}

/** What the AI committed (FR24): archetype identity + board. NO elements — see `chooseSetup`. */
export interface AiChoice {
  /** The picked archetype's id; thread it back via `options.exclude` next match. */
  archetypeId: string;
  classes: [UnitClass, UnitClass, UnitClass];
  placement: [Placement, Placement, Placement];
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
 * blast massacres stacked rows) roles. Curated EMPIRICALLY against the sim
 * harness (NFR4): matchups between fixed boards are near-deterministic, so
 * the pool was selected from a ~20-candidate matchup matrix to keep every
 * member's pool-relative aggregate win rate inside a reasonable band. At
 * the CI-pinned config (test/sim.test.ts, 285 games/archetype — a sample
 * large enough to have converged past small-sample noise) that's verified
 * as ~35–61%, comfortably under the 65% acceptance band. Deliberately
 * absent: the dominant knight/archer/mage full-RPS spread family (92%
 * aggregate in probing; only one hard counter exists in the candidate
 * space) — left as discoverable player tech rather than an AI board no
 * pool could balance (see README's Balancing harness section for the
 * scope of what this band certifies).
 */
export const STRATEGY_POOL: readonly StrategyArchetype[] = [
  {
    id: 'bulwark',
    name: 'Bulwark',
    classes: ['knight', 'knight', 'knight'],
    placement: [
      { row: 'front', col: 'left' },
      { row: 'front', col: 'center' },
      { row: 'front', col: 'right' },
    ],
  },
  {
    id: 'longbows',
    name: 'Longbows',
    classes: ['archer', 'archer', 'knight'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'front', col: 'center' },
    ],
  },
  {
    id: 'three-mages',
    name: 'Three Mages',
    classes: ['mage', 'mage', 'mage'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'back', col: 'center' },
      { row: 'back', col: 'right' },
    ],
  },
  {
    id: 'talons',
    name: 'Talons',
    classes: ['archer', 'archer', 'mage'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'mid', col: 'right' },
      { row: 'back', col: 'center' },
    ],
  },
  {
    id: 'hex-coven',
    name: 'Hex Coven',
    classes: ['witch', 'witch', 'knight'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'back', col: 'center' },
      { row: 'front', col: 'center' },
    ],
  },
  {
    id: 'cabal',
    name: 'Cabal',
    classes: ['mage', 'witch', 'cleric'],
    placement: [
      { row: 'back', col: 'center' },
      { row: 'back', col: 'left' },
      { row: 'back', col: 'right' },
    ],
  },
  {
    id: 'farshot',
    name: 'Farshot',
    classes: ['archer', 'mage', 'cleric'],
    placement: [
      { row: 'mid', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'back', col: 'center' },
    ],
  },
  {
    id: 'wardens',
    name: 'Wardens',
    classes: ['mercenary', 'knight', 'witch'],
    placement: [
      { row: 'front', col: 'right' },
      { row: 'front', col: 'center' },
      { row: 'back', col: 'left' },
    ],
  },
  {
    id: 'ambushers',
    name: 'Ambushers',
    classes: ['mercenary', 'witch', 'mage'],
    placement: [
      { row: 'front', col: 'center' },
      { row: 'back', col: 'left' },
      { row: 'back', col: 'right' },
    ],
  },
  {
    id: 'gale',
    name: 'Gale',
    classes: ['witch', 'archer', 'mage'],
    placement: [
      { row: 'back', col: 'center' },
      { row: 'mid', col: 'left' },
      { row: 'back', col: 'right' },
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
