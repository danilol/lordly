import { BALANCE } from './balance';
import { nextInt } from './rng';
import type { Stream } from './rng';
import { ALL_COLS } from './types';
import type { Placement, Tactic, UnitClass } from './types';

/**
 * The tactics the AI may commit (FR24, dossier D-3b). Story 4.5 ships leader
 * designation, so `leader` is UNLOCKED here now — the AI can hunt the player's
 * crowned leader (the story's headline fantasy: "a leader my opponent will
 * hunt"), exactly as the player's picker unlocks Attack Leader once a crown
 * exists. This is `ALL_TACTICS` in full picker order.
 */
const AI_TACTICS: readonly Tactic[] = ['autonomous', 'weakest', 'strongest', 'leader'];

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
   * VARIABLE-length (story 4.8): a slot-legal army is exactly 5 units in the
   * all-smalls era, but a monster costs 2 slots — a 1-monster comp is 4
   * units (2+1+1+1), a 2-monster comp is 3 (2+2+1). The length-5 tuple from
   * story 4.2 no longer holds for every entry; `classes`/`placement` stay
   * parallel by index (AD-9's contract, unchanged). Authoring safety (every
   * entry slot-legal) is a TEST, not the type (`test/ai.test.ts`).
   */
  classes: readonly UnitClass[];
  placement: readonly Placement[];
}

/** What the AI committed (FR24): archetype identity + board + tactic. NO elements, NO names — see `chooseSetup`. */
export interface AiChoice {
  /** The picked archetype's id; thread it back via `options.exclude` next match. */
  archetypeId: string;
  classes: UnitClass[];
  placement: Placement[];
  /** The AI's army-wide target-selection tactic (FR34/FR24), drawn from its own stream. */
  tactic: Tactic;
  /** The AI's designated leader as an index into its own army (FR35/FR24, story 4.5), drawn from its own stream — seeded variation, never always 0. A monster comp's army may be as short as 3 units (story 4.8). */
  leader: number;
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
    // Story 5.4 re-tune: with the casters bolted (E5-D4) the pure wall lost
    // its predator and sat at ~69%; the front-right knight becomes a Phalanx
    // (guard-full, 1 action) — two slash actions per turn traded for a
    // shield. Still every unit a Vanguard (the wall identity, and bolts keep
    // their ×3/2 way in); a skirmisher swap here would have PROTECTED the
    // wall from its own predator instead.
    classes: ['knight', 'berserker', 'phalanx', 'knight', 'knight'],
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
    // Story 5.4: one line-mate is a Vultan (back-row Wind Shot ×2 — an
    // archer-shaped hybrid) — single-unit swap, identity intact, covers the
    // newcomer (the 4.3 method). Re-tune (same pass): with the caster comps
    // nerfed (E5-D4), the 3-sniper + heal-behind-a-wall shape shot to ~73% —
    // one archer steps to the exposed FRONT row (farshot's 4.7 move: still
    // snipes globally, now melee food), pulling it back toward band.
    classes: ['vultan', 'archer', 'archer', 'knight', 'cleric'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'front', col: 'right' },
      { row: 'back', col: 'center' },
      { row: 'front', col: 'center' },
      { row: 'mid', col: 'center' },
    ],
  },
  {
    id: 'three-mages',
    name: 'Three Mages',
    // Story 4.4 re-tune: FR9 global range let the triple-blast battery hide
    // behind a full front screen and dominate (70% single) — the mages were
    // pulled to the exposed MID row. Story 5.4 REVERSES that: E5-D4's bolt is
    // a single-target attack (~1/3 the wall-clearing throughput of the row
    // blast), and the mid-row exposure collapsed the comp to 17% while
    // handing every melee wall a free win. The battery moves BACK behind its
    // knight screens again — identity intact (the triple artillery battery;
    // "anti-front-stack" is now the ×3/2 vanguard hunt, not a row wipe).
    classes: ['mage', 'mage', 'mage', 'knight', 'knight'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'back', col: 'center' },
      { row: 'back', col: 'right' },
      { row: 'front', col: 'center' },
      { row: 'mid', col: 'center' },
    ],
  },
  {
    id: 'talons',
    name: 'Talons',
    // Story 4.3: one archer line-mate is a Valkyrie (Skirmisher) — single-unit swap, covers the newcomer (sweep-placed).
    // Story 5.4: the front screen is a Hawkman now (the budget skirmisher) — covers the newcomer.
    classes: ['archer', 'archer', 'archer', 'valkyrie', 'hawkman'],
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
    // Story 5.4: the coven's front-center screen is a Dragon Hunter — the
    // dragonslayer needs pool representation before 5.5's dragons land.
    // Re-tune (same pass): the mid witch joins the back line — three witches
    // fully screened behind the two-melee front (37% exposed at mid).
    classes: ['witch', 'witch', 'dragonhunter', 'witch', 'knight'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'back', col: 'center' },
      { row: 'front', col: 'center' },
      { row: 'back', col: 'right' },
      { row: 'front', col: 'left' },
    ],
  },
  {
    id: 'cabal',
    name: 'Cabal',
    // Story 4.3: the coven's flank is a Ninja (Skirmisher) now — single-unit swap, covers the newcomer (sweep-placed).
    // Story 5.4 re-tune: the bolt's throughput cut (E5-D4) left the coven at
    // 20% as everyone's fodder. Two moves: the ninja steps up as a FRONT
    // screen (10% dodge — a slippery one), and the cleric becomes a KNIGHT —
    // the bolt era's caster battery is preyed on by snipers, and only a
    // vanguard (×3/2 vs snipers) punishes them; a heal couldn't. Identity
    // intact: the caster cabal, now with a bodyguard. (Cleric stays covered
    // via longbows/farshot/twin-golems.)
    classes: ['mage', 'witch', 'knight', 'mage', 'ninja'],
    placement: [
      { row: 'back', col: 'left' },
      { row: 'mid', col: 'center' },
      { row: 'front', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'front', col: 'center' },
    ],
  },
  {
    id: 'farshot',
    name: 'Farshot',
    // Story 4.7 re-tune: Guard tankifies knight-heavy comps' fronts and the
    // Wizard-front staff loses its blast, both of which weakened farshot's
    // rivals — farshot itself has no front-row melee at all, so its RELATIVE
    // wipeout win rate rose above band. One archer steps to the front (a
    // screen, exposed to melee) — identity intact (still the two-archer
    // snipe-and-support comp). Story 5.4 probe note: fully retracting this
    // exposure sent WIPEOUT to 68.5% (the cleric's sustain compounds across
    // engagements — the very thing 4.7 was policing) while single sat at 48%,
    // so the one-archer exposure STAYS.
    classes: ['archer', 'mage', 'cleric', 'archer', 'witch'],
    placement: [
      { row: 'front', col: 'left' },
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
    // Story 5.4: the front-right mercenary is a Fencer (the crit/dodge duelist) — covers the newcomer.
    classes: ['fencer', 'knight', 'archer', 'mercenary', 'phalanx'],
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
    // Story 4.4 re-tune (after the melee-blockade fix): the all-back-caster
    // ambush over-performed once FR9 gave it global range; one mercenary steps
    // to the front and the mage exposes from back to mid, pulling it back into
    // band. Identity intact — a mixed skirmish-and-cast ambush.
    // Story 5.4: the front-center mercenary is a Raven (the aggressive
    // talon skirmisher) — single-unit swap, covers the newcomer. Re-tune
    // (same pass): the casters retreat to the BACK row behind the two-melee
    // screen — the 4.4 exposure that policed row blasts just bleeds a
    // single-target-era comp (35% before this).
    classes: ['raven', 'witch', 'archer', 'mercenary', 'mage'],
    placement: [
      { row: 'front', col: 'center' },
      { row: 'back', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'front', col: 'left' },
      { row: 'back', col: 'center' },
    ],
  },
  {
    id: 'gale',
    name: 'Gale',
    // Story 4.3: one of the storm's artillery is a Sorceress (the Wizard's twin) — single-unit swap, covers the newcomer (sweep-placed).
    // Story 4.4 re-tune: FR9 global range over-buffed the all-back storm — the
    // archers were exposed on the FRONT row. Story 5.4 re-tune: with the
    // bolt's throughput cut (E5-D4) that exposure collapsed gale to 17%; the
    // archers step back to the MID row (a soft screen, no longer sacrificial)
    // — identity intact (the mixed caster/archer storm), rate back in band.
    classes: ['witch', 'archer', 'mage', 'archer', 'sorceress'],
    placement: [
      { row: 'mid', col: 'center' },
      { row: 'mid', col: 'left' },
      { row: 'back', col: 'center' },
      { row: 'mid', col: 'right' },
      { row: 'back', col: 'left' },
    ],
  },
  {
    id: 'golem-wall',
    name: 'Golem Wall',
    // Story 4.8 — the wave's ONE-monster comp: a single-cell Golem at
    // front-center (2 slots) is the sole front-line screen; the remaining 3
    // units fill the BACK row — the only cells left once the Golem's
    // king-move ban (device-reported, confirmed against the source game)
    // reserves all 5 of its on-grid neighbors (front/left, front/right,
    // mid/left, mid/center, mid/right). The back row is 2 rows away, so it
    // stays entirely free. 2 (golem) + 1 + 1 + 1 = 5 slots. Re-tune note: an
    // EARLIER cleric+knight support pair (a healer behind a 2nd melee front)
    // dominated both modes (74–77%, sweep-caught) — the sustain-behind-a-
    // wall shape is systematically overtuned regardless of Golem's raw
    // stats; swapping to no-sustain ranged/control support pulled it back
    // into band at the dossier's HP 300.
    // Story 5.4 re-tune: with the caster comps bolted (E5-D4) the wall
    // converged just over band (65.3% single at runs=500). The golem anchors
    // the front-LEFT CORNER now instead of center: its king-move ban frees
    // the right lane, so enemy melee in the far column can walk PAST the
    // wall onto the shooters (a front-center golem made the whole board
    // melee-unreachable). Identity intact — the golem wall, cornered.
    // (A vultan-for-archer swap was probed first and BUFFED it to 69.5%:
    // the skirmisher's unpenalized raw damage into vanguards outweighed the
    // lost sniper hunts.)
    classes: ['golem', 'archer', 'archer', 'witch'],
    placement: [
      { row: 'front', col: 'left' },
      { row: 'back', col: 'left' },
      { row: 'back', col: 'center' },
      { row: 'back', col: 'right' },
    ],
  },
  {
    id: 'twin-golems',
    name: 'Twin Golems',
    // Story 4.8 — the wave's TWO-monster comp: single-cell Golems at
    // front-left and front-right (2 columns apart, so neither is a king-move
    // neighbor of the other — FR38). Their combined king-move bans cover
    // front/center, mid/left, mid/center, mid/right; the whole BACK row stays
    // free, and the cleric takes back/center. 2 + 2 + 1 = 5 slots.
    classes: ['golem', 'golem', 'cleric'],
    placement: [
      { row: 'front', col: 'left' },
      { row: 'front', col: 'right' },
      { row: 'back', col: 'center' },
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
 * over the eligible pool, ② one placement-mirror coin flip, ③ one tactic
 * pick (story 4.4, FR24), ④ one leader-index pick (story 4.5, FR35 — appended
 * LAST so the archetype/board/tactic choices for a given stream state are
 * unchanged). Nothing else draws. Story 1.8's shell and the sim harness must
 * produce identical boards from identical stream states; reordering any draw
 * breaks that.
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

  // ③ the tactic draw (FR24). AI_TACTICS is the full picker set now that story
  // 4.5 unlocked Attack Leader for both sides.
  const tactic = AI_TACTICS[nextInt(stream, 0, AI_TACTICS.length - 1)] as Tactic;

  // ④ the leader draw (FR35, story 4.5) — LAST, so archetype/board/tactic are
  // unchanged for a given stream state. A uniform index into the picked
  // archetype's OWN army length (story 4.8: a monster comp's army may be
  // shorter than 5 — the bound already reads `.length`, not a hardcoded 5):
  // seeded variation, never always unit 0 (FR24). Story 4.8 follow-up: a
  // monster can never be crowned (`validateMatchSetup` rejects it), so the
  // draw is over the eligible SMALL indices only — exactly one draw either
  // way (never a redraw-on-reject), so a monster-free archetype's draw is
  // unchanged bit-for-bit from before this fix.
  const eligibleLeaderIndices = picked.classes.reduce<number[]>((acc, cls, i) => {
    if (BALANCE.classes[cls].sizeClass !== 'monster') acc.push(i);
    return acc;
  }, []);
  const leader = eligibleLeaderIndices[nextInt(stream, 0, eligibleLeaderIndices.length - 1)] as number;

  return { archetypeId: picked.id, classes: [...picked.classes], placement, tactic, leader };
}
