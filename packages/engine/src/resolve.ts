import { BALANCE } from './balance';
import { judge, wipedSide } from './judging';
import type { WipeState } from './judging';
import { createStreams, nextInt } from './rng';
import { selectMeleeTarget } from './targeting';
import { ALL_COLS, ALL_ROWS, LOG_VERSION } from './types';
import type { BattleEvent, BattleLog, MatchSetup, Side, UnitClass, UnitId, UnitSnapshot } from './types';
import { validateMatchSetup } from './validate';

/** Mutable per-unit resolution state (module-private; AD-1: never escapes). */
interface UnitState {
  id: UnitId;
  side: Side;
  class: UnitClass;
  agi: number;
  rowIndex: number;
  colIndex: number;
  alive: boolean;
  hp: number;
  actionsLeft: number;
  snapshot: UnitSnapshot;
}

/** The two melee classes (FR8); every other class stays idle until story 1.6. */
const MELEE_CLASSES: ReadonlySet<UnitClass> = new Set(['knight', 'mercenary']);

/**
 * Resolves an entire **battle** from a validated `MatchSetup` into an
 * immutable ordered `BattleLog` (AD-1, AD-2, AD-12): the shell replays this
 * log and never evaluates a combat rule. Identical setups yield bit-identical
 * logs on any platform (FR20) — all randomness comes from the setup's seed
 * via the named streams (AD-10).
 *
 * Story 1.5 scope: melee combat (Knight, Mercenary — FR7/FR8 targeting,
 * FR14/FR15 damage), deaths and the FR18 instant wipe, and real judging.
 * Ranged/magic/heal/status classes stay `ActionSkipped { reason: 'idle' }`
 * until story 1.6.
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
  // remain the FIRST draw from `streams.battle` in an engagement. Story 1.6
  // draws confusion misfires from this stream AFTER this point — inserting
  // any battle-stream draw before the flip changes every existing seed's
  // outcome. Melee damage (1.5) is fully deterministic and draws nothing.
  const tieWinner: Side = nextInt(streams.battle, 0, 1) === 0 ? 'A' : 'B';
  const order = timelineComparator(tieWinner);

  let wiped: WipeState;
  let pass = 0;
  battle: while (units.some((u) => u.alive && u.actionsLeft > 0)) {
    pass += 1;
    events.push({ type: 'PassStarted', pass });
    // Re-filter and re-sort every pass: this is the load-bearing mechanism for
    // mid-pass deaths (a unit killed earlier in the pass is gone from the next
    // pass). Do NOT cache the order.
    const acting = units.filter((u) => u.alive && u.actionsLeft > 0).sort(order);
    for (const unit of acting) {
      if (!unit.alive) {
        // A unit killed earlier THIS pass loses its queued turn (FR13). The
        // type promises this event — emit it rather than dropping the turn.
        unit.actionsLeft -= 1;
        events.push({ type: 'ActionSkipped', unit: unit.id, reason: 'dead' });
        continue;
      }
      unit.actionsLeft -= 1;
      const turnEvents = takeTurn(unit, units);
      events.push(...turnEvents);
      // Only a death can change the alive-set — skip the wipe scan otherwise.
      if (turnEvents.some((e) => e.type === 'UnitDied')) {
        wiped = wipedSide(judgedView(units));
        if (wiped !== undefined) break battle; // FR18: wipe ends it, unspent actions lost
      }
    }
  }

  const hp: Record<UnitId, number> = {};
  for (const u of units) hp[u.id] = u.hp;
  events.push({ type: 'EngagementEnded', engagement, hp });

  const verdict = judge(judgedView(units), wiped);
  events.push({ type: 'BattleEnded', winner: verdict.winner, hpPct: verdict.hpPct });

  const log: BattleLog = { logVersion: LOG_VERSION, events };
  return deepFreeze(log);
}

/** Projects resolution state onto the minimal shape judging reads (FR18). */
function judgedView(units: readonly UnitState[]) {
  return units.map((u) => ({ side: u.side, alive: u.alive, hp: u.hp, maxHp: u.snapshot.maxHp }));
}

/**
 * One unit's action (FR13): melee classes attack per FR7/FR8; every other
 * class idles until story 1.6. Returns the events the turn produced.
 * Targeting is re-evaluated per attack (FR8) — this runs fresh every swing.
 */
function takeTurn(unit: UnitState, units: UnitState[]): BattleEvent[] {
  if (!MELEE_CLASSES.has(unit.class)) {
    return [{ type: 'ActionSkipped', unit: unit.id, reason: 'idle' }];
  }

  const enemies = units.filter((u) => u.side !== unit.side);
  const targetIdx = selectMeleeTarget(
    unit.colIndex,
    enemies.map((e) => ({ rowIndex: e.rowIndex, colIndex: e.colIndex, alive: e.alive })),
  );
  if (targetIdx === undefined) {
    // No living reachable enemy (FR8 no-bypass): the action is spent unused.
    return [{ type: 'ActionSkipped', unit: unit.id, reason: 'idle' }];
  }

  const target = enemies[targetIdx] as UnitState;
  const damage = physicalDamage(unit.class, target.class);
  target.hp = Math.max(0, target.hp - damage);
  const out: BattleEvent[] = [
    { type: 'UnitAttacked', source: unit.id, targets: [{ unit: target.id, damage, hpAfter: target.hp }] },
  ];
  if (target.hp === 0) {
    target.alive = false;
    out.push({ type: 'UnitDied', unit: target.id });
  }
  return out;
}

/**
 * FR14/FR15 physical damage, integer math in FIXED order (FR20):
 * base = STR − floor(VIT/2) → RPS floor (×3/2 advantage, ×3/4 disadvantage,
 * ×1 neutral) → [status modifiers, story 1.6] → min-damage clamp LAST.
 * Class-agnostic pure arithmetic (exported for direct table-driven tests);
 * combat callers only ever pass melee attackers.
 */
export function physicalDamage(attacker: UnitClass, defender: UnitClass): number {
  const { formulas, rpsBeats, classes } = BALANCE;
  const base = classes[attacker].str - Math.floor(classes[defender].vit / 2);
  const rps = rpsBeats[attacker] === defender ? formulas.rpsAdvantage : rpsBeats[defender] === attacker ? formulas.rpsDisadvantage : undefined;
  const modified = rps === undefined ? base : Math.floor((base * rps.num) / rps.den);
  return Math.max(formulas.minDamage, modified);
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
        class: unit.class,
        agi: stats.agi,
        rowIndex: ALL_ROWS.indexOf(placement.row),
        colIndex: ALL_COLS.indexOf(placement.col),
        alive: true,
        hp: stats.hp,
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
