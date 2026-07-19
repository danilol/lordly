import { BALANCE, rpsRatio } from './balance';
import type { Ratio } from './balance';
import { judge, wipedSide } from './judging';
import type { WipeState } from './judging';
import { createStreams, nextInt } from './rng';
import type { Stream } from './rng';
import { selectBlastRow, selectMeleeTarget, selectRangedTarget } from './targeting';
import { ALL_COLS, ALL_ROWS, LOG_VERSION } from './types';
import type { AttackTarget, BattleEvent, BattleLog, MatchSetup, MoveKind, Side, SpellKind, UnitClass, UnitId, UnitSnapshot } from './types';
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
  // FR35 sober package (story 4.5): once a side's designated leader falls it
  // stays fallen for the WHOLE battle — like `wiped`, this persists across
  // every engagement, so a leader lost in engagement 1 keeps its side penalised
  // (and its tactic reverted) through the wipeout loop. Mutated in place by
  // `strike()` and the poison-tick kill as the leader's death is observed.
  const leaderFallen: Record<Side, boolean> = { A: false, B: false };
  for (let engagement = 1; engagement <= maxEngagements; engagement++) {
    if (engagement > 1) {
      // FR19 between-engagement reset: living units replenish their per-row
      // action counts and shed every status EXCEPT poison, which persists for
      // the rest of the battle. HP, deaths, and placements carry over.
      // Each shed status narrates as StatusCleared BEFORE the clear (story
      // 4.2, dossier §5 — the 2.2 deferral: clears are log-driven now). Only
      // LIVING units emit: a dead unit's statuses clear silently — they have
      // no observable effect and no icon on screen.
      for (const u of units) {
        u.actionsLeft = u.alive ? BALANCE.classes[u.class].actions[u.snapshot.placement.row] : 0;
        if (u.alive) {
          for (const spell of u.statuses) {
            if (spell !== 'poison') events.push({ type: 'StatusCleared', unit: u.id, spell });
          }
        }
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
      // FR39b (story 4.2): snapshot every unit's unspent actions as the pass
      // opens — dead units read 0 (their queued turns are lost narration, not
      // budget). The ledger UI (4.11) derives per-beat decrements from events.
      const actionsRemaining: Record<UnitId, number> = {};
      for (const u of units) actionsRemaining[u.id] = u.alive ? u.actionsLeft : 0;
      events.push({ type: 'PassStarted', pass, actionsRemaining });
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
        const turnEvents = takeTurn(unit, units, streams.battle, setup, leaderFallen);
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
          // FR35: a leader lost to poison triggers the sober package too — the
          // penalty has no more actions to bite at the natural engagement end,
          // but the beat still narrates (banner/history). Same guard as strike().
          if (isLeaderFall(unit, setup, leaderFallen)) {
            events.push({ type: 'LeaderFell', side: unit.side, unit: unit.id });
            leaderFallen[unit.side] = true;
          }
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
function takeTurn(unit: UnitState, units: UnitState[], battle: Stream, setup: MatchSetup, leaderFallen: Record<Side, boolean>): BattleEvent[] {
  if (unit.statuses.has('confusion')) {
    // Data-driven misfire chance (AD-8): P(misfire) = num/den. The draw spans
    // [0, den-1] and misfires on the TOP `num` values, so at the shipped 1/2
    // tuning this is bit-identical to the historical `nextInt(0,1) === 1` —
    // same stream consumption, same outcome — and existing goldens/seed pins
    // hold. Tuning the ratio now actually changes the roll (was hardcoded).
    const { num, den } = BALANCE.formulas.confusionMisfire;
    const misfires = nextInt(battle, 0, den - 1) >= den - num;
    if (misfires) {
      return [{ type: 'ActionMisfired', unit: unit.id }, ...misfire(unit, units, battle, setup, leaderFallen)];
    }
  }
  return act(unit, units, setup, leaderFallen);
}

/**
 * The unit's NORMAL action by class, under the acting side's tactic (FR34).
 * Targeting is the fixed two-step (targeting.ts): legal list → tactic. Melee
 * is reach-filtered with Last Stand (FR7); ranged/magic is global (FR9). The
 * `leader` tactic reads the enemy leader's unit id (`${enemySide}:${index}`).
 */
function act(unit: UnitState, units: UnitState[], setup: MatchSetup, leaderFallen: Record<Side, boolean>): BattleEvent[] {
  const enemies = units.filter((u) => u.side !== unit.side);
  const mode = setup.mode;
  // FR35 tactic reversion (story 4.5): once THIS unit's side has lost its
  // leader, the whole army fights on plain Autonomous for the rest of the
  // battle (the "sober package" — deterministic, zero new stream draws). The
  // override lives at this ONE read so every branch (melee/ranged/blast/witch)
  // reverts uniformly. `setup` itself is never mutated (validated input, AD-9).
  const tactic = leaderFallen[unit.side] ? 'autonomous' : setup.tactics[unit.side];
  const enemySide: Side = unit.side === 'A' ? 'B' : 'A';
  const enemyLeaderId: UnitId = `${enemySide}:${setup.leaders[enemySide]}`;
  // Physical-only sober-package multiplier (dossier §4): wrap `physicalDamage`
  // only when a leader has actually fallen — otherwise pass the bare function
  // so the no-fall autonomous path stays allocation-free AND bit-identical
  // (blast/magic never wraps — the penalty is physical-only).
  const physical = leaderFallen.A || leaderFallen.B ? leaderPenaltyPhysical(unit.side, enemySide, leaderFallen) : physicalDamage;

  switch (unit.class) {
    // Vanguard + Skirmisher all melee the nearest reachable target (story 4.3
    // "start generic" — Berserker/Phalanx are Vanguard, Ninja/Valkyrie are
    // Skirmisher; their unique moves/Guard arrive in 4.7). Role only shifts the
    // RPS multiplier, applied inside damagePipeline.
    case 'knight':
    case 'mercenary':
    case 'berserker':
    case 'phalanx':
    case 'ninja':
    case 'valkyrie': {
      const idx = selectMeleeTarget(unit.colIndex, enemies, tactic, enemyLeaderId);
      if (idx === undefined) return skip(unit);
      return strike(unit, [enemies[idx] as UnitState], physical, setup.leaders, leaderFallen);
    }
    case 'archer': {
      const idx = selectRangedTarget(unit.colIndex, enemies, tactic, enemyLeaderId);
      if (idx === undefined) return skip(unit);
      return strike(unit, [enemies[idx] as UnitState], physical, setup.leaders, leaderFallen);
    }
    // Artillery row-blast (Sorceress = Wizard's Artillery twin, story 4.3).
    // Tactic interaction (D-2c): under `leader` the blast targets the enemy
    // leader's ROW (AoE treats the leader as the focal point); under every
    // other tactic — and when the leader is not alive — it keeps its own rule
    // (row with most living, tie rearmost).
    case 'mage':
    case 'sorceress': {
      const leaderRow = tactic === 'leader' ? enemies.find((e) => e.id === enemyLeaderId && e.alive)?.rowIndex : undefined;
      const row = leaderRow ?? selectBlastRow(enemies);
      if (row === undefined) return skip(unit);
      const targets = enemies.filter((e) => e.alive && e.rowIndex === row);
      // Blast is MAGIC — no leader-fall penalty (dossier §4: physical only).
      return strike(unit, targets, (a, d, w) => blastDamage(a, d, w ?? false, mode), setup.leaders, leaderFallen);
    }
    case 'cleric': {
      // Heals ignore tactics entirely (dossier §4). The staff fallback is a
      // single-target ranged attack and DOES obey the tactic.
      const allies = units.filter((u) => u.side === unit.side && u.alive);
      const patient = lowestHpFraction(allies);
      if (patient !== undefined && patient.hp < patient.snapshot.maxHp) {
        const amount = Math.min(healAmount(unit.class), patient.snapshot.maxHp - patient.hp);
        patient.hp += amount;
        return [{ type: 'UnitHealed', source: unit.id, target: patient.id, amount, hpAfter: patient.hp }];
      }
      // Nobody damaged: the weak STR staff attack with magic targeting (FR11/FR9).
      // The staff is PHYSICAL (STR-based) — it carries the sober-package penalty.
      const idx = selectRangedTarget(unit.colIndex, enemies, tactic, enemyLeaderId);
      if (idx === undefined) return skip(unit);
      return strike(unit, [enemies[idx] as UnitState], physical, setup.leaders, leaderFallen);
    }
    case 'witch': {
      // Prefer-unafflicted (FR12) filters the legal list BEFORE the tactic sort
      // (dossier §4): the candidate is "alive" only if unafflicted by her spell,
      // so the two-step pipeline picks over the unafflicted pool. Under `leader`
      // she casts on the leader if it is unafflicted, else Autonomous — the
      // applyTactic leader→autonomous fallback handles it. If every living enemy
      // already bears her spell the cast is wasted — no stack (FR16), fizzle;
      // only a truly empty enemy grid is an idle skip.
      const unaffected = enemies.map((e) => ({
        rowIndex: e.rowIndex,
        colIndex: e.colIndex,
        alive: e.alive && !e.statuses.has(unit.witchSpell),
        hp: e.hp,
        id: e.id,
      }));
      const preferredIdx = selectRangedTarget(unit.colIndex, unaffected, tactic, enemyLeaderId);
      if (preferredIdx !== undefined) {
        const target = enemies[preferredIdx] as UnitState;
        target.statuses.add(unit.witchSpell);
        return [{ type: 'StatusApplied', source: unit.id, target: target.id, spell: unit.witchSpell }];
      }
      if (!enemies.some((e) => e.alive)) return skip(unit);
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
function misfire(unit: UnitState, units: UnitState[], battle: Stream, setup: MatchSetup, leaderFallen: Record<Side, boolean>): BattleEvent[] {
  const mode = setup.mode;
  const allies = units.filter((u) => u.side === unit.side && u.alive && u.id !== unit.id);
  const enemies = units.filter((u) => u.side !== unit.side && u.alive);
  // Friendly-fire is a PHYSICAL strike on an ALLY: both attacker and defender
  // are this unit's own side, so the sober package applies dealt AND taken to
  // the same side uniformly (dossier §4 — no special-casing). Same guard as
  // act(): wrap only after a leader has fallen so the common path is unchanged.
  const physical = leaderFallen.A || leaderFallen.B ? leaderPenaltyPhysical(unit.side, unit.side, leaderFallen) : physicalDamage;

  switch (unit.class) {
    // Every physical attacker misfires as a melee strike on a random ally
    // (story 4.3: the melee newcomers join the shipped physical trio).
    case 'knight':
    case 'mercenary':
    case 'archer':
    case 'berserker':
    case 'phalanx':
    case 'ninja':
    case 'valkyrie': {
      if (allies.length === 0) return [{ type: 'ActionFizzled', unit: unit.id }];
      const target = allies[nextInt(battle, 0, allies.length - 1)] as UnitState;
      return strike(unit, [target], physical, setup.leaders, leaderFallen);
    }
    case 'mage':
    case 'sorceress': {
      // Blasts its OWN fullest row (recorded decision: the mage itself counts
      // and can be struck by its own blast). Magic — no leader-fall penalty.
      const own = units.filter((u) => u.side === unit.side);
      const row = selectBlastRow(own);
      if (row === undefined) return [{ type: 'ActionFizzled', unit: unit.id }];
      const targets = own.filter((u) => u.alive && u.rowIndex === row);
      return strike(unit, targets, (a, d, w) => blastDamage(a, d, w ?? false, mode), setup.leaders, leaderFallen);
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
 * The move kind each class's attack carries in wave 1 (FR32, story 4.2) —
 * semantically true today because moves are class-uniform; story 4.7's
 * row-varied move table replaces this lookup with per-row derivation.
 * The Witch never strikes (she casts/fizzles), so her entry is unreachable —
 * kept so the map stays total over `UnitClass`.
 */
const CLASS_MOVE_KIND: Record<UnitClass, MoveKind> = {
  knight: 'slash',
  mercenary: 'slash',
  archer: 'arrow',
  mage: 'blast',
  cleric: 'staff',
  witch: 'staff',
  // Story 4.3 newcomers: the melee Vanguard/Skirmisher pair slash; the Artillery Sorceress blasts.
  berserker: 'slash',
  phalanx: 'slash',
  ninja: 'slash',
  valkyrie: 'slash',
  sorceress: 'blast',
};

/**
 * Applies one attack from `source` to `targets` (one entry for melee/ranged/
 * staff; the whole struck row for a blast — AD-12 one event per action).
 * Damage runs the FIXED pipeline with the source's Weaken status; each kill
 * appends a `UnitDied` after the single `UnitAttacked`, in target order.
 * Every target resolves `outcome: 'hit'` unconditionally in 4.2 — ADR 0003's
 * dodge/crit draws are story 4.6's and MUST NOT land early (frozen table).
 */
function strike(
  source: UnitState,
  targets: UnitState[],
  formula: (a: UnitClass, d: UnitClass, weakened?: boolean) => number,
  leaders: MatchSetup['leaders'],
  leaderFallen: Record<Side, boolean>,
): BattleEvent[] {
  const weakened = source.statuses.has('weaken');
  const hits: AttackTarget[] = [];
  const deaths: BattleEvent[] = [];
  for (const target of targets) {
    const damage = formula(source.class, target.class, weakened);
    target.hp = Math.max(0, target.hp - damage);
    hits.push({ unit: target.id, damage, hpAfter: target.hp, outcome: 'hit' });
    if (target.hp === 0 && target.alive) {
      target.alive = false;
      deaths.push({ type: 'UnitDied', unit: target.id });
      // FR35 (story 4.5): if the just-killed unit was its side's designated
      // leader, the LeaderFell beat rides IMMEDIATELY after its UnitDied — so
      // a blast that kills the leader and two others narrates the fall between
      // the leader's death and the next casualty (target order). Fires once per
      // side (the `leaderFallen` guard), and flips the flag the sober-package
      // penalty/tactic-reversion read from the very next action onward.
      if (isLeaderFall(target, { leaders }, leaderFallen)) {
        deaths.push({ type: 'LeaderFell', side: target.side, unit: target.id });
        leaderFallen[target.side] = true;
      }
    }
  }
  return [{ type: 'UnitAttacked', source: source.id, kind: CLASS_MOVE_KIND[source.class], targets: hits }, ...deaths];
}

/**
 * Whether `unit`'s death is its side's LEADER falling for the FIRST time (FR35).
 * The exact `${side}:${index}` id construction `act()` uses for `enemyLeaderId`,
 * gated by the once-per-side `leaderFallen` flag. `setup` is read for `leaders`
 * only (the poison-tick site passes the whole setup; `strike` passes a `leaders`
 * shim — both satisfy the single field this reads).
 */
function isLeaderFall(unit: UnitState, setup: Pick<MatchSetup, 'leaders'>, leaderFallen: Record<Side, boolean>): boolean {
  if (leaderFallen[unit.side]) return false;
  return unit.id === `${unit.side}:${setup.leaders[unit.side]}`;
}

/**
 * The FR35 sober-package physical multiplier (story 4.5, dossier §4), built at
 * a `physicalDamage` call site (never inside `strike`, which blast shares —
 * the penalty is PHYSICAL only). Applies `leaderFallDealt` (×3/4, keyed to the
 * attacker's fallen side) then `leaderFallTaken` (×5/4, keyed to the defender's
 * fallen side) as fixed-order floor multiplications, then RE-CLAMPS to
 * `minDamage` — `physicalDamage` already floored once, but a ×3/4 after that can
 * push back under the floor (base 1 → 0), so the clamp must run LAST again.
 *
 * Exported for direct table-driven tests (the `physicalDamage`/`blastDamage`
 * convention) — the re-clamp trap is pinned there, not only through a battle.
 */
export function leaderPenaltyPhysical(
  attackerSide: Side,
  defenderSide: Side,
  leaderFallen: Record<Side, boolean>,
): (a: UnitClass, d: UnitClass, weakened?: boolean) => number {
  const { leaderFallDealt, leaderFallTaken, minDamage } = BALANCE.formulas;
  return (a, d, weakened) => {
    let dmg = physicalDamage(a, d, weakened);
    if (leaderFallen[attackerSide]) dmg = Math.floor((dmg * leaderFallDealt.num) / leaderFallDealt.den);
    if (leaderFallen[defenderSide]) dmg = Math.floor((dmg * leaderFallTaken.num) / leaderFallTaken.den);
    return Math.max(minDamage, dmg);
  };
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
 * The UNATTENUATED magic arithmetic: INT − floor(MEN/2), then the same FIXED
 * order as physical (RPS → Weaken → min-1). The FR10 row blast itself uses
 * `blastDamage` (this plus the pre-RPS attenuation); this stays exported as
 * the tuning-transparent building block the arithmetic tests pin directly.
 */
export function magicDamage(attacker: UnitClass, defender: UnitClass, weakened = false): number {
  return damagePipeline(BALANCE.classes[attacker].int, attacker, defender, weakened, 'men');
}

/**
 * FR10 (2026-07-14 amendment) per-target Mage row-blast damage:
 * INT − floor(MEN/2), then — in **wipeout mode only** — `blastAttenuation`
 * (×3/4) BEFORE RPS, then the fixed tail (RPS → Weaken → min-1). In single
 * mode the blast is unattenuated (identical to `magicDamage`): the story-3.0
 * sweep showed single-engagement blasts are policed by the triangle, while
 * wipeout blasts compound across engagements into dominance. Per-target:
 * the blast calls this once per unit in the struck row, normal casts and
 * confused self-blasts alike.
 */
export function blastDamage(attacker: UnitClass, defender: UnitClass, weakened: boolean, mode: 'single' | 'wipeout'): number {
  const attenuation = mode === 'wipeout' ? BALANCE.formulas.blastAttenuation : undefined;
  return damagePipeline(BALANCE.classes[attacker].int, attacker, defender, weakened, 'men', attenuation);
}

/** FR11 heal amount: floor(INT × 5/4); the EFFECTIVE restore is capped at max HP by the caller. */
export function healAmount(healer: UnitClass): number {
  const { heal } = BALANCE.formulas;
  return Math.floor((BALANCE.classes[healer].int * heal.num) / heal.den);
}

/**
 * Shared FIXED-order damage pipeline (FR15/FR16/FR20):
 * base → preRps attenuation (blast only, FR10) → RPS → weaken → min clamp.
 *
 * The ×1.5 advantage / ×0.75 disadvantage now derive from the role-relation
 * table via `rpsRatio` (story 4.3, AD-4): symmetric edges penalise the reverse,
 * one-way hunts do not — the exact FR14-amendment asymmetry the old
 * `rpsBeats`/`rpsHunts` pair encoded, from a single source.
 */
function damagePipeline(power: number, attacker: UnitClass, defender: UnitClass, weakened: boolean, mitigation: 'vit' | 'men', preRps?: Ratio): number {
  const { formulas, classes } = BALANCE;
  const base = power - Math.floor(classes[defender][mitigation] / 2);
  let modified = preRps === undefined ? base : Math.floor((base * preRps.num) / preRps.den);
  const rps = rpsRatio(attacker, defender);
  if (rps !== undefined) modified = Math.floor((modified * rps.num) / rps.den);
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
          name: unit.name,
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
