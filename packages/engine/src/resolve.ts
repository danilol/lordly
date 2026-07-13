import { BALANCE } from './balance';
import { judge, wipedSide } from './judging';
import type { WipeState } from './judging';
import { createStreams, nextInt } from './rng';
import type { Stream } from './rng';
import { selectBlastRow, selectMeleeTarget, selectRearmostTarget } from './targeting';
import { ALL_COLS, ALL_ROWS, LOG_VERSION } from './types';
import type { AttackTarget, BattleEvent, BattleLog, MatchSetup, Side, SpellKind, UnitClass, UnitId, UnitSnapshot } from './types';
import { validateMatchSetup } from './validate';

/**
 * Mutable per-unit resolution state (module-private; AD-1: never escapes).
 *
 * Structurally satisfies BOTH `MeleeCandidate` (targeting) and `JudgedUnit`
 * (judging), so units pass to those modules DIRECTLY — the per-action
 * `candidatesOf` and per-scan `judgedView` projections were pure allocation
 * churn on the sim harness's hot path and were removed (story 2.0 AC4,
 * measured; behavior bit-identical — all goldens untouched).
 */
interface UnitState {
  id: UnitId;
  side: Side;
  class: UnitClass;
  agi: number;
  rowIndex: number;
  colIndex: number;
  alive: boolean;
  hp: number;
  /** Immutable copy of `snapshot.maxHp` so judging (FR18) reads this state directly. */
  maxHp: number;
  actionsLeft: number;
  /** Active Witch spells on this unit (FR16); same spell never stacks. */
  statuses: Set<SpellKind>;
  /** The spell this unit casts if it is a Witch (keyed to her element — FR16). */
  witchSpell: SpellKind;
  snapshot: UnitSnapshot;
}

/**
 * Resolves an entire **battle** from a validated `MatchSetup` into an
 * immutable ordered `BattleLog` (AD-1, AD-2, AD-12): the shell replays this
 * log and never evaluates a combat rule. Identical setups yield bit-identical
 * logs on any platform (FR20) — all randomness comes from the setup's seed
 * via the named streams (AD-10).
 *
 * Story 1.6: the full roster acts — melee (FR8), Archer (FR9), Mage blast
 * (FR10), Cleric heal/staff (FR11), Witch spells (FR12/FR16: sleep, poison,
 * weaken, confusion) — over the FR13 timeline with FR18 judging.
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

  // The engagement loop (FR17/FR19): 'single' runs exactly one engagement;
  // 'wipeout' repeats until a side is wiped, bounded by BALANCE.engagementCap —
  // the anti-stalemate TERMINATION guarantee, not just a judging rule (a
  // Cleric can offset chip damage indefinitely). Engagement 1 consumes the
  // exact same stream draws in both modes, so single-mode logs (and every
  // golden/seed pin) are bit-identical to before the loop existed.
  const maxEngagements = setup.mode === 'wipeout' ? BALANCE.engagementCap : 1;
  let wiped: WipeState = undefined;
  for (let engagement = 1; engagement <= maxEngagements; engagement++) {
    if (engagement > 1) {
      // FR19 between-engagement reset: living units replenish their per-row
      // action counts and shed every status EXCEPT poison, which persists for
      // the rest of the battle. HP, deaths, and placements carry over.
      for (const u of units) {
        u.actionsLeft = u.alive ? BALANCE.classes[u.class].actions[u.snapshot.placement.row] : 0;
        const poisoned = u.statuses.has('poison');
        u.statuses.clear();
        if (poisoned) u.statuses.add('poison');
      }
    }

    // STREAM-ORDERING INVARIANT (FR20 replay stability): battle-stream draws
    // happen in EXACTLY this order — ① the engagement tie flip (always the
    // first draw of EVERY engagement — FR13: one flip per engagement), then
    // ② per confused action in timeline order: one misfire draw, then
    // (only when the misfire needs a uniform pick) one target draw. Nothing
    // else draws. Reordering ANY of these changes every existing seed's battle.
    const tieWinner: Side = nextInt(streams.battle, 0, 1) === 0 ? 'A' : 'B';
    const order = timelineComparator(tieWinner);

    // Recorded decision (1.10): `PassStarted.pass` restarts at 1 each
    // engagement — the shell disambiguates via `EngagementEnded.engagement`.
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
          // A unit killed earlier THIS pass loses its queued turn (FR13).
          unit.actionsLeft -= 1;
          events.push({ type: 'ActionSkipped', unit: unit.id, reason: 'dead' });
          continue;
        }
        if (unit.statuses.has('sleep')) {
          // Sleep voids remaining actions (FR16), narrated turn by turn (FR13).
          unit.actionsLeft -= 1;
          events.push({ type: 'ActionSkipped', unit: unit.id, reason: 'asleep' });
          continue;
        }
        unit.actionsLeft -= 1;
        const turnEvents = takeTurn(unit, units, streams.battle);
        events.push(...turnEvents);
        // Only a death can change the alive-set — skip the wipe scan otherwise.
        if (turnEvents.some((e) => e.type === 'UnitDied')) {
          wiped = wipedSide(units);
          if (wiped !== undefined) break battle; // FR18: wipe ends it, unspent actions lost
        }
      }
    }

    // Poison ticks at the NATURAL end of an engagement only, before judging
    // (FR16; recorded decision, confirmed for wipeout in 1.10: an instant wipe
    // short-circuits per FR18's "instant win" and skips poison — coherent in
    // BOTH modes, because a wipe ends the whole battle. Every engagement that
    // reaches its natural end ticks — INCLUDING the cap-reached last one, whose
    // ticks feed the FR18 verdict — so poison compounds across a wipeout
    // battle, FR19's Witch synergy. Only a wipe ever skips the tick.)
    // Ticks run in unit order; the EngagementEnded snapshot includes them.
    // A poison mutual wipe becomes WipeState 'both' → judge() returns a draw.
    if (wiped === undefined) {
      for (const unit of units) {
        if (!unit.alive || !unit.statuses.has('poison')) continue;
        const damage = BALANCE.formulas.poisonDamage;
        unit.hp = Math.max(0, unit.hp - damage);
        events.push({ type: 'PoisonTicked', unit: unit.id, damage, hpAfter: unit.hp });
        if (unit.hp === 0) {
          unit.alive = false;
          events.push({ type: 'UnitDied', unit: unit.id });
        }
      }
      wiped = wipedSide(units);
    }

    const hp: Record<UnitId, number> = {};
    for (const u of units) hp[u.id] = u.hp;
    events.push({ type: 'EngagementEnded', engagement, hp });

    // A wipe (mid-pass or by poison) ends the battle; otherwise the next
    // engagement begins — or the cap is reached and FR18 judges what remains.
    if (wiped !== undefined) break;
  }

  const verdict = judge(units, wiped);
  events.push({ type: 'BattleEnded', winner: verdict.winner, hpPct: verdict.hpPct });

  const log: BattleLog = { logVersion: LOG_VERSION, events };
  return deepFreeze(log);
}

/**
 * One unit's action (FR13). A confused unit first draws the misfire check
 * (FR16); on a calm draw (and for everyone else) it acts by class: melee
 * (FR8), Archer (FR9), Mage blast (FR10), Cleric heal/staff (FR11), Witch
 * cast (FR12). Targeting is re-evaluated per attack — this runs fresh each
 * turn.
 */
function takeTurn(unit: UnitState, units: UnitState[], battle: Stream): BattleEvent[] {
  if (unit.statuses.has('confusion')) {
    // Data-driven misfire chance (AD-8): P(misfire) = num/den. The draw spans
    // [0, den-1] and misfires on the TOP `num` values, so at the shipped 1/2
    // tuning this is bit-identical to the historical `nextInt(0,1) === 1` —
    // same stream consumption, same outcome — and existing goldens/seed pins
    // hold. Tuning the ratio now actually changes the roll (was hardcoded).
    const { num, den } = BALANCE.formulas.confusionMisfire;
    const misfires = nextInt(battle, 0, den - 1) >= den - num;
    if (misfires) {
      return [{ type: 'ActionMisfired', unit: unit.id }, ...misfire(unit, units, battle)];
    }
  }
  return act(unit, units);
}

/** The unit's NORMAL action by class. */
function act(unit: UnitState, units: UnitState[]): BattleEvent[] {
  const enemies = units.filter((u) => u.side !== unit.side);

  switch (unit.class) {
    case 'knight':
    case 'mercenary': {
      const idx = selectMeleeTarget(unit.colIndex, enemies);
      if (idx === undefined) return skip(unit);
      return strike(unit, [enemies[idx] as UnitState], physicalDamage);
    }
    case 'archer': {
      const idx = selectRearmostTarget(unit.colIndex, enemies);
      if (idx === undefined) return skip(unit);
      return strike(unit, [enemies[idx] as UnitState], physicalDamage);
    }
    case 'mage': {
      const row = selectBlastRow(enemies);
      if (row === undefined) return skip(unit);
      const targets = enemies.filter((e) => e.alive && e.rowIndex === row);
      return strike(unit, targets, magicDamage);
    }
    case 'cleric': {
      const allies = units.filter((u) => u.side === unit.side && u.alive);
      const patient = lowestHpFraction(allies);
      if (patient !== undefined && patient.hp < patient.snapshot.maxHp) {
        const amount = Math.min(healAmount(unit.class), patient.snapshot.maxHp - patient.hp);
        patient.hp += amount;
        return [{ type: 'UnitHealed', source: unit.id, target: patient.id, amount, hpAfter: patient.hp }];
      }
      // Nobody damaged: the weak STR staff attack with magic targeting (FR11).
      const idx = selectRearmostTarget(unit.colIndex, enemies);
      if (idx === undefined) return skip(unit);
      return strike(unit, [enemies[idx] as UnitState], physicalDamage);
    }
    case 'witch': {
      // Prefer unaffected targets (FR12): magic targeting over the unaffected
      // pool first; if every reachable enemy already bears her spell, the
      // cast is wasted — no stack (FR16) — and fizzles (recorded decision).
      const unaffected = enemies.map((e) => ({
        rowIndex: e.rowIndex,
        colIndex: e.colIndex,
        alive: e.alive && !e.statuses.has(unit.witchSpell),
      }));
      const preferredIdx = selectRearmostTarget(unit.colIndex, unaffected);
      if (preferredIdx !== undefined) {
        const target = enemies[preferredIdx] as UnitState;
        target.statuses.add(unit.witchSpell);
        return [{ type: 'StatusApplied', source: unit.id, target: target.id, spell: unit.witchSpell }];
      }
      const anyIdx = selectRearmostTarget(unit.colIndex, enemies);
      if (anyIdx === undefined) return skip(unit);
      return [{ type: 'ActionFizzled', unit: unit.id }];
    }
  }
}

/**
 * FR16 Wind→Confusion misfire redirects, per the confused unit's class.
 * The caller has already emitted the `ActionMisfired` marker and consumed
 * the misfire draw; a uniform target pick (when needed) is the SECOND draw.
 * Misfire ally picks EXCLUDE the confused unit itself; the cleric's enemy
 * pick is any living enemy (recorded decisions).
 */
function misfire(unit: UnitState, units: UnitState[], battle: Stream): BattleEvent[] {
  const allies = units.filter((u) => u.side === unit.side && u.alive && u.id !== unit.id);
  const enemies = units.filter((u) => u.side !== unit.side && u.alive);

  switch (unit.class) {
    case 'knight':
    case 'mercenary':
    case 'archer': {
      if (allies.length === 0) return [{ type: 'ActionFizzled', unit: unit.id }];
      const target = allies[nextInt(battle, 0, allies.length - 1)] as UnitState;
      return strike(unit, [target], physicalDamage);
    }
    case 'mage': {
      // Blasts its OWN fullest row (recorded decision: the mage itself counts
      // and can be struck by its own blast).
      const own = units.filter((u) => u.side === unit.side);
      const row = selectBlastRow(own);
      if (row === undefined) return [{ type: 'ActionFizzled', unit: unit.id }];
      const targets = own.filter((u) => u.alive && u.rowIndex === row);
      return strike(unit, targets, magicDamage);
    }
    case 'cleric': {
      if (enemies.length === 0) return [{ type: 'ActionFizzled', unit: unit.id }];
      const patient = enemies[nextInt(battle, 0, enemies.length - 1)] as UnitState;
      const amount = Math.min(healAmount(unit.class), patient.snapshot.maxHp - patient.hp);
      patient.hp += amount;
      return [{ type: 'UnitHealed', source: unit.id, target: patient.id, amount, hpAfter: patient.hp }];
    }
    case 'witch': {
      if (allies.length === 0) return [{ type: 'ActionFizzled', unit: unit.id }];
      const target = allies[nextInt(battle, 0, allies.length - 1)] as UnitState;
      if (target.statuses.has(unit.witchSpell)) return [{ type: 'ActionFizzled', unit: unit.id }]; // no stack
      target.statuses.add(unit.witchSpell);
      return [{ type: 'StatusApplied', source: unit.id, target: target.id, spell: unit.witchSpell }];
    }
  }
}

/** An action spent with no valid target (FR8/FR9 no-bypass). */
function skip(unit: UnitState): BattleEvent[] {
  return [{ type: 'ActionSkipped', unit: unit.id, reason: 'idle' }];
}

/**
 * Applies one attack from `source` to `targets` (one entry for melee/ranged/
 * staff; the whole struck row for a blast — AD-12 one event per action).
 * Damage runs the FIXED pipeline with the source's Weaken status; each kill
 * appends a `UnitDied` after the single `UnitAttacked`, in target order.
 */
function strike(source: UnitState, targets: UnitState[], formula: (a: UnitClass, d: UnitClass, weakened?: boolean) => number): BattleEvent[] {
  const weakened = source.statuses.has('weaken');
  const hits: AttackTarget[] = [];
  const deaths: BattleEvent[] = [];
  for (const target of targets) {
    const damage = formula(source.class, target.class, weakened);
    target.hp = Math.max(0, target.hp - damage);
    hits.push({ unit: target.id, damage, hpAfter: target.hp });
    if (target.hp === 0 && target.alive) {
      target.alive = false;
      deaths.push({ type: 'UnitDied', unit: target.id });
    }
  }
  return [{ type: 'UnitAttacked', source: source.id, targets: hits }, ...deaths];
}

/**
 * FR11's patient: the living ally with the LOWEST exact HP fraction —
 * compared by integer cross-multiplication (hp_i × maxHp_j vs hp_j × maxHp_i),
 * never floored percents; ties go to the lowest unit order (recorded decision).
 */
function lowestHpFraction(allies: readonly UnitState[]): UnitState | undefined {
  let best: UnitState | undefined;
  for (const u of allies) {
    if (best === undefined || u.hp * best.snapshot.maxHp < best.hp * u.snapshot.maxHp) {
      best = u;
    }
  }
  return best;
}

/**
 * FR14/FR15 physical damage, integer math in FIXED order (FR20):
 * base = STR − floor(VIT/2) → RPS floor (×3/2 advantage, ×3/4 disadvantage,
 * ×1 neutral) → Weaken halving if the attacker is weakened (FR16, floor) →
 * min-damage clamp LAST. Class-agnostic pure arithmetic (exported for
 * direct table-driven tests).
 */
export function physicalDamage(attacker: UnitClass, defender: UnitClass, weakened = false): number {
  return damagePipeline(BALANCE.classes[attacker].str, attacker, defender, weakened, 'vit');
}

/**
 * FR10 magic damage: INT − floor(MEN/2), then the same FIXED order as
 * physical (RPS → Weaken → min-1). Per-target — the Mage blast calls this
 * once per unit in the struck row.
 */
export function magicDamage(attacker: UnitClass, defender: UnitClass, weakened = false): number {
  return damagePipeline(BALANCE.classes[attacker].int, attacker, defender, weakened, 'men');
}

/** FR11 heal amount: floor(INT × 5/4); the EFFECTIVE restore is capped at max HP by the caller. */
export function healAmount(healer: UnitClass): number {
  const { heal } = BALANCE.formulas;
  return Math.floor((BALANCE.classes[healer].int * heal.num) / heal.den);
}

/** Shared FIXED-order damage pipeline (FR15/FR16/FR20): base → RPS → weaken → min clamp. */
function damagePipeline(power: number, attacker: UnitClass, defender: UnitClass, weakened: boolean, mitigation: 'vit' | 'men'): number {
  const { formulas, rpsBeats, classes } = BALANCE;
  const base = power - Math.floor(classes[defender][mitigation] / 2);
  const rps = rpsBeats[attacker] === defender ? formulas.rpsAdvantage : rpsBeats[defender] === attacker ? formulas.rpsDisadvantage : undefined;
  let modified = rps === undefined ? base : Math.floor((base * rps.num) / rps.den);
  if (weakened) modified = Math.floor(modified / 2);
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
        maxHp: stats.hp,
        actionsLeft: stats.actions[placement.row],
        statuses: new Set(),
        witchSpell: BALANCE.elementSpells[unit.element],
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
