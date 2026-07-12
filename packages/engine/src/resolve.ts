import { BALANCE } from './balance';
import { createStreams, nextInt } from './rng';
import { ALL_COLS, ALL_ROWS, LOG_VERSION } from './types';
import type { BattleEvent, BattleLog, MatchSetup, Side, UnitId, UnitSnapshot } from './types';
import { validateMatchSetup } from './validate';

/** Mutable per-unit resolution state (module-private; AD-1: never escapes). */
interface UnitState {
  id: UnitId;
  side: Side;
  agi: number;
  rowIndex: number;
  colIndex: number;
  alive: boolean;
  actionsLeft: number;
  snapshot: UnitSnapshot;
}

/**
 * Resolves an entire **battle** from a validated `MatchSetup` into an
 * immutable ordered `BattleLog` (AD-1, AD-2, AD-12): the shell replays this
 * log and never evaluates a combat rule. Identical setups yield bit-identical
 * logs on any platform (FR20) — all randomness comes from the setup's seed
 * via the named streams (AD-10).
 *
 * Chassis scope (story 1.4): the FR13 initiative timeline with multihit
 * split and tie-breaking, over FR17's single engagement. Every taken turn
 * emits `ActionSkipped { reason: 'idle' }`; combat mechanics (stories
 * 1.5/1.6) replace acted turns with real events. With no damage yet, every
 * battle judges as an exact all-full-HP draw; FR18's real judging is 1.5.
 *
 * @throws InvalidMatchSetupError on malformed input — the engine's only
 * throw path (spine errors convention).
 */
export function resolveBattle(setup: MatchSetup): BattleLog {
  validateMatchSetup(setup);

  const streams = createStreams(setup.seed);
  const events: BattleEvent[] = [];

  const units = buildUnits(setup);
  events.push({ type: 'BattleStarted', units: units.map((u) => ({ ...u.snapshot })) });

  // The single engagement (FR17). Story 1.10 wraps this in a per-engagement
  // loop for wipeout mode (currently rejected by validation until then), so
  // the tie coin flip is drawn INSIDE engagement scope — one draw per
  // engagement (FR13), not once per battle.
  const engagement = 1;

  // STREAM-ORDERING INVARIANT (FR20 replay stability): the tie coin flip must
  // remain the FIRST draw from `streams.battle` in an engagement. Stories
  // 1.5/1.6 draw damage/confusion from this stream AFTER this point — inserting
  // any battle-stream draw before the flip changes every existing seed's
  // outcome. The determinism-anchor test guards the observable result.
  const tieWinner: Side = nextInt(streams.battle, 0, 1) === 0 ? 'A' : 'B';
  const order = timelineComparator(tieWinner);

  let pass = 0;
  while (units.some((u) => u.alive && u.actionsLeft > 0)) {
    pass += 1;
    events.push({ type: 'PassStarted', pass });
    // Re-filter and re-sort every pass: this is the load-bearing mechanism for
    // mid-pass deaths in stories 1.5+ (a unit killed earlier in the pass is
    // gone from the next pass). Do NOT cache the order.
    const acting = units.filter((u) => u.alive && u.actionsLeft > 0).sort(order);
    for (const unit of acting) {
      if (!unit.alive) {
        // A unit killed earlier THIS pass loses its queued turn (FR13). Nothing
        // dies in the chassis, but stories 1.5+ reach here — the type promises
        // this event, so emit it rather than dropping the turn silently.
        unit.actionsLeft -= 1;
        events.push({ type: 'ActionSkipped', unit: unit.id, reason: 'dead' });
        continue;
      }
      unit.actionsLeft -= 1;
      events.push({ type: 'ActionSkipped', unit: unit.id, reason: 'idle' });
    }
  }

  const hp: Record<UnitId, number> = {};
  for (const u of units) hp[u.id] = u.snapshot.hp;
  events.push({ type: 'EngagementEnded', engagement, hp });

  // No damage in the chassis: exact tie → draw (FR18 real judging is 1.5).
  events.push({ type: 'BattleEnded', winner: 'draw', hpPct: { A: 100, B: 100 } });

  const log: BattleLog = { logVersion: LOG_VERSION, events };
  return deepFreeze(log);
}

/**
 * Recursively freezes the log so the immutable-narration contract (AD-1/AD-2)
 * holds all the way down — a shell consumer cannot mutate a nested event
 * field (e.g. a unit's hp or the hp snapshot). Plain data only (no cycles).
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** Builds initial unit states from armies + placements + balance data (AD-11 ids). */
function buildUnits(setup: MatchSetup): UnitState[] {
  const units: UnitState[] = [];
  for (const side of ['A', 'B'] as const) {
    setup.armies[side].forEach((unit, index) => {
      const placement = setup.placements[side][index] as NonNullable<(typeof setup.placements)[typeof side][number]>;
      const stats = BALANCE.classes[unit.class];
      units.push({
        id: `${side}:${index}`,
        side,
        agi: stats.agi,
        rowIndex: ALL_ROWS.indexOf(placement.row),
        colIndex: ALL_COLS.indexOf(placement.col),
        alive: true,
        actionsLeft: stats.actions[placement.row],
        snapshot: {
          id: `${side}:${index}`,
          side,
          class: unit.class,
          element: unit.element,
          placement: { ...placement },
          hp: stats.hp,
          maxHp: stats.hp,
        },
      });
    });
  }
  return units;
}

/**
 * The FR13 total order for one pass: AGI descending → front row before back
 * (owner-local rows) → left before right (owner-local columns) → the
 * engagement's coin-flip side first. Total by construction: two units of the
 * same side can never share a cell (validated), so side is the final key.
 */
function timelineComparator(tieWinner: Side) {
  return (a: UnitState, b: UnitState): number => {
    if (a.agi !== b.agi) return b.agi - a.agi;
    if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
    if (a.colIndex !== b.colIndex) return a.colIndex - b.colIndex;
    if (a.side === b.side) return 0; // unreachable: same side + same cell is invalid
    return a.side === tieWinner ? -1 : 1;
  };
}
