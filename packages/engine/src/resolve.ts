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

  // FR13: one coin flip per engagement decides which side wins exact ties.
  // mode 'wipeout' resolves as a single engagement here — its loop is story 1.10.
  const tieWinner: Side = nextInt(streams.battle, 0, 1) === 0 ? 'A' : 'B';
  const order = timelineComparator(tieWinner);

  let pass = 0;
  while (units.some((u) => u.alive && u.actionsLeft > 0)) {
    pass += 1;
    events.push({ type: 'PassStarted', pass });
    const acting = units.filter((u) => u.alive && u.actionsLeft > 0).sort(order);
    for (const unit of acting) {
      if (!unit.alive) continue; // deaths (1.5+) void queued turns mid-pass
      unit.actionsLeft -= 1;
      events.push({ type: 'ActionSkipped', unit: unit.id, reason: 'idle' });
    }
  }

  const hp: Record<UnitId, number> = {};
  for (const u of units) hp[u.id] = u.snapshot.hp;
  events.push({ type: 'EngagementEnded', engagement: 1, hp });

  // No damage in the chassis: exact tie → draw (FR18 real judging is 1.5).
  events.push({ type: 'BattleEnded', winner: 'draw', hpPct: { A: 100, B: 100 } });

  const log: BattleLog = { logVersion: LOG_VERSION, events: Object.freeze(events) };
  return Object.freeze(log);
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
