import { ALL_COLS, ALL_ROWS, BALANCE } from '@lordly/engine';
import type { BattleEvent, MoveKind, Placement, Side, SpellKind, UnitId, UnitSnapshot } from '@lordly/engine';
import { BASE_WIDTH, FIZZLE_PLATE_LABEL, HEAL_PLATE_LABEL, ISO_BOARD, moveDisplayName, SPELL_DISPLAY_NAME } from '../config/constants';

/**
 * Pure, Phaser-free, DOM-free presentation helpers for the Reveal/Battle
 * scenes (the story-1.8 pattern: tested correctness lives here, scenes are
 * thin renderers). Nothing in this module evaluates a combat rule (AD-2) —
 * it only maps engine data to screen geometry and paces the replay.
 *
 * Story 2.2 (ADR-0001): the flat stacked grid became two tilted isometric
 * 3×3 checkerboards. The owner-local→screen mapping is ORIENTATION-AWARE
 * from the start (the cheap seam — a player-facing toggle stays deferred):
 * `'\'` is the shipped, pixel-tuned default (enemy board upper-left, player
 * lower-right, front rows meeting along the diagonal clash gap); `'/'` is
 * its horizontal mirror; `'|'` stacks the boards vertically, untuned.
 */

export const ALL_ORIENTATIONS = ['|', '\\', '/'] as const;
export type BoardOrientation = (typeof ALL_ORIENTATIONS)[number];
export const DEFAULT_ORIENTATION: BoardOrientation = '\\';

/**
 * Owner-local placement → board-local diamond-grid coordinates. In the iso
 * projection below, increasing `r` runs down-LEFT and increasing `c` runs
 * down-RIGHT, so the board's NW edge is `c = 0` and its SE edge is `c = 2`.
 *
 * CHIRALITY (2026-07-15 device-reported fix): each board must be its owner's
 * placement ROTATED into the iso frame, never reflected — the original
 * mapping was a transpose (det −1), which mirrored the player's formation
 * left↔right versus the Placement screen. Both mappings below are rigid
 * rotations (det +1), 180° opposed:
 *
 * - Side A (player, lower-right board) fronts its NW edge (toward the enemy):
 *   `c` = row index (front = 0), `r` = 2 − column index — the player's left
 *   column stays on the screen-left, matching how they placed it.
 * - Side B (enemy, upper-left board) fronts its SE edge: `c` = 2 − row index,
 *   `r` = col index — a facing army's left is on OUR right, so A's left lane
 *   still faces B's right across the clash gap (FR7, AD-11). In the diagonal
 *   layout, facing pairs sit gap-OFFSET rather than on one collinear line —
 *   matching the UX mock's corner boards; the "lane" is conceptual, and the
 *   tests pin the facing pair as each unit's nearest cross-board front tile.
 */
function projection(side: Side, placement: Placement): { r: number; c: number } {
  const rowIndex = ALL_ROWS.indexOf(placement.row); // front=0, mid=1, back=2
  const colIndex = ALL_COLS.indexOf(placement.col); // left=0, center=1, right=2
  if (side === 'A') return { r: 2 - colIndex, c: rowIndex };
  return { r: colIndex, c: 2 - rowIndex };
}

/** The board origin (its top-corner tile center) for a side under an orientation. */
function frame(side: Side, orientation: BoardOrientation): { ox: number; oy: number } {
  if (orientation === '|') return side === 'A' ? ISO_BOARD.stackedPlayer : ISO_BOARD.stackedEnemy;
  // '\' and '/' share origins; '/' mirrors the final x instead.
  return side === 'A' ? ISO_BOARD.player : ISO_BOARD.enemy;
}

/**
 * Owner-local cell → its tile's pixel center. Standard iso math: from the
 * board origin, `x` steps ±tileW/2 with (c − r) and `y` steps +tileH/2 with
 * (c + r), producing the 2:1 diamond grid.
 */
export function unitTileCenter(side: Side, placement: Placement, orientation: BoardOrientation = DEFAULT_ORIENTATION): { x: number; y: number } {
  const { r, c } = projection(side, placement);
  const { ox, oy } = frame(side, orientation);
  const x = ox + (c - r) * (ISO_BOARD.tileW / 2);
  const y = oy + (c + r) * (ISO_BOARD.tileH / 2);
  return { x: orientation === '/' ? BASE_WIDTH - x : x, y };
}

/** One renderable board tile: pixel center, front-row flag, and checker parity (side color vs neutral fill). */
export interface BoardTile {
  x: number;
  y: number;
  front: boolean;
  checker: boolean;
}

/** All 9 tiles of one side's board, aligned 1:1 with `unitTileCenter` so units always stand exactly on a tile. */
export function boardTiles(side: Side, orientation: BoardOrientation = DEFAULT_ORIENTATION): BoardTile[] {
  return ALL_ROWS.flatMap((row) =>
    ALL_COLS.map((col) => {
      const placement = { row, col };
      const { r, c } = projection(side, placement);
      const { x, y } = unitTileCenter(side, placement, orientation);
      return { x, y, front: row === 'front', checker: (r + c) % 2 === 0 };
    }),
  );
}

/**
 * The visual family of an origin→target trace (story 4.10). For an attack it
 * is the engine's own `MoveKind` — branch the flavor on THIS, never on the
 * attacker's class (story 4.7's per-row moves make class inference wrong). A
 * heal and a spell get their own discriminants (the events carry no `MoveKind`).
 */
export type TraceKind = MoveKind | 'heal' | 'spell';

/**
 * Which unit an action travels FROM and which unit(s) it travels TO — a beat's
 * from→to reading. `toIds` has one entry for a single-target move; the whole
 * struck row for a blast fan-out. A discriminated union so a `spell` trace
 * carries its `SpellKind` — the scene styles the travel from the trace ALONE,
 * never re-reading the raw event (review: the second `event.type` switch was
 * a drift seam).
 */
export type EventTrace = { fromId: UnitId; toIds: UnitId[]; kind: MoveKind | 'heal' } | { fromId: UnitId; toIds: UnitId[]; kind: 'spell'; spell: SpellKind };

/**
 * The from→to reading of a battle event (story 4.10, FR39d, AD-2): derived
 * PURELY from the event payload — the scene animates the trace, it computes no
 * origin (this is the one honest, testable seam behind the Battle scene's
 * travel animations). Returns an origin + target(s) for the three events that
 * carry a `source` (`UnitAttacked`, `UnitHealed`, `StatusApplied`), and `null`
 * for every origin-less event — `PoisonTicked` (victim only), `UnitDied`, the
 * Guard markers, `StatusCleared`, the skip/fizzle/misfire markers, `LeaderFell`,
 * and the framing events. Those MUST render on-unit (AC2): there is no origin to
 * trace, and fabricating one would be a lie about what the engine reported. The
 * `default` return keeps that honest by construction — a future event shape
 * gets no fabricated travel until it is explicitly given a source→target here.
 */
export function eventTrace(event: BattleEvent): EventTrace | null {
  switch (event.type) {
    case 'UnitAttacked':
      return { fromId: event.source, toIds: event.targets.map((t) => t.unit), kind: event.kind };
    case 'UnitHealed':
      return { fromId: event.source, toIds: [event.target], kind: 'heal' };
    case 'StatusApplied':
      return { fromId: event.source, toIds: [event.target], kind: 'spell', spell: event.spell };
    default:
      return null;
  }
}

/** What the FR39b move-plate needs beyond the event: the pass snapshot + the roster's static facts. */
export interface MovePlateContext {
  /** The CURRENT pass's `PassStarted.actionsRemaining` snapshot (dead units read 0). */
  actionsRemaining: Record<UnitId, number>;
  /** The `BattleStarted` roster by id — class/element/row are AD-2's static-facts channel. */
  roster: ReadonlyMap<UnitId, UnitSnapshot>;
}

/** One rendered plate: who acted, what the move is called, and the ●○ pip math. */
export interface MovePlateData {
  unitId: UnitId;
  label: string;
  /** Actions left AFTER this act — snapshot − 1, clamped ≥ 0 (the ● count). */
  remaining: number;
  /** The engagement budget for this unit's row (● + ○ total), from BALANCE. */
  max: number;
}

/**
 * The FR39b action ledger's pure seam (story 4.11, dossier D-3a: the ledger IS
 * the move-name plate). Maps one `BattleEvent` to the transient plate shown
 * over the ACTING unit — or `null` for beats that consume no action or have no
 * actor (framing, deaths, poison, marker-only beats). Everything derives from
 * the payload + AD-2's static facts; the scene computes no combat state:
 *
 * - `UnitAttacked` → the move's display name (element-flavored blast) + pips.
 * - `UnitHealed` / `StatusApplied` → "Heal" / the FR16 spell name + pips.
 * - `GuardRaised` → the Guard tier from the BALANCE move table (static fact).
 * - `ActionFizzled` → "Fizzle" (a fizzled action is SPENT).
 * - `ActionMisfired` → `null`. THE PAIR'S ONE PLATE RIDES THE EFFECT: the
 *   marker is a narrative preamble (wiggle + "confused!" popup already own that
 *   beat); the redirected effect that follows is a normal acting event from the
 *   SAME confused unit carrying the actual move's `kind`/`spell` — so the plate
 *   it produces names the misfired move with zero shell-side re-derivation of
 *   the move table (the story's double-plate hazard is eliminated structurally:
 *   one action, one plate, single decrement by construction).
 * - `ActionSkipped` → `null` (open Q3 default: the Zzz/waits popup already
 *   reads; a skip plate would add chrome to a non-act).
 *
 * Pips: `remaining` = snapshot − 1 (each unit acts at most once per pass —
 * FR13); `max` = `BALANCE.classes[cls].actions[row]` — the budget is per
 * ENGAGEMENT, so the pips visibly deplete across passes and refill only at the
 * engagement seam.
 */
export function movePlate(event: BattleEvent, ctx: MovePlateContext): MovePlateData | null {
  let unitId: UnitId;
  let label: string;
  switch (event.type) {
    case 'UnitAttacked': {
      const actor = ctx.roster.get(event.source);
      if (!actor) return null;
      unitId = event.source;
      label = moveDisplayName(event.kind, actor.element);
      break;
    }
    case 'UnitHealed':
      unitId = event.source;
      label = HEAL_PLATE_LABEL;
      break;
    case 'StatusApplied':
      unitId = event.source;
      label = SPELL_DISPLAY_NAME[event.spell];
      break;
    case 'GuardRaised': {
      const actor = ctx.roster.get(event.unit);
      if (!actor) return null;
      const move = BALANCE.classes[actor.class].moves[actor.placement.row];
      unitId = event.unit;
      // The tier is a static fact (Q4 default); the plain fallback is defensive —
      // GuardRaised only ever comes from a guard row.
      label = move === 'guard-full' ? 'Guard (full)' : move === 'guard-half' ? 'Guard (half)' : 'Guard';
      break;
    }
    case 'ActionFizzled':
      unitId = event.unit;
      label = FIZZLE_PLATE_LABEL;
      break;
    default:
      return null; // no actor / no consumed action — no plate (AC2's honesty rule, applied to the ledger)
  }
  const actor = ctx.roster.get(unitId);
  if (!actor) return null;
  const max = BALANCE.classes[actor.class].actions[actor.placement.row];
  const remaining = Math.max(0, (ctx.actionsRemaining[unitId] ?? 0) - 1);
  return { unitId, label, remaining, max };
}

/** One playback beat: its source event plus when it fires and for how long. */
export interface Beat {
  index: number;
  event: BattleEvent;
  atMs: number;
  durationMs: number;
}

/**
 * Turns the log's ordered events into a beat schedule — one beat per event,
 * order preserved 1:1 (AD-2: the scene never reorders or re-derives), each
 * event held for `beatMs` and starting where the previous one ended. This is
 * the whole pacing contract; the FR23 speed control just divides the
 * per-beat duration at play time (story 2.3 — the scene owns the factor).
 */
export function buildBeatSchedule(events: readonly BattleEvent[], beatMs: number): Beat[] {
  return events.map((event, index) => ({
    index,
    event,
    atMs: index * beatMs,
    durationMs: beatMs,
  }));
}

/**
 * Per-beat duration at an FR23 speed factor — the speed feature's whole math,
 * pure and tested here (story 2.3 review: the divide had gone inline in the
 * smoke-free scene when press-and-hold's tested helper was retired). Guards:
 * a non-positive factor plays at normal speed; the result never floors to 0ms.
 */
export function beatDurationMs(beatMs: number, factor: number): number {
  return Math.max(1, Math.round(beatMs / Math.max(1, factor)));
}
