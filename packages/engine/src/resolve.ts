import { BALANCE, rpsRatio } from './balance';
import type { Ratio } from './balance';
import { judge, wipedSide } from './judging';
import type { WipeState } from './judging';
import { createStreams, nextInt } from './rng';
import type { Stream } from './rng';
import { selectBlastRow, selectMeleeTarget, selectRangedTarget } from './targeting';
import { ALL_COLS, ALL_ROWS, LOG_VERSION } from './types';
import type { AttackTarget, BattleEvent, BattleLog, MatchSetup, MoveKind, Side, SpellKind, UnitAttacked, UnitClass, UnitId, UnitSnapshot } from './types';
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
  /**
   * A live one-shot Guard charge (FR33, story 4.7, dossier §4), or `undefined`
   * when not guarding. Set when the unit's (class, row) move is `guard-full`/
   * `guard-half`; consumed by the next landed physical single-target hit on
   * this cell or the ally in front of it, or expired unconsumed at the
   * engagement's natural end (mirrors poison's persistence seam, but Guard
   * itself never persists PAST that seam — always re-armed by acting again).
   */
  guard: 'full' | 'half' | undefined;
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
    // happen in EXACTLY the order frozen by ADR 0003 (docs/adr/0003-battle-
    // stream-draw-order.md) — ① (E1) the engagement tie flip (always the first
    // draw of EVERY engagement — FR13: one flip per engagement), then per
    // action, in timeline order: (A1) a confusion misfire check for a confused
    // actor, (A2) a misfire redirect target pick when the misfire needs one,
    // then (A3) a dodge draw + (A4) a crit draw for any PHYSICAL SINGLE-TARGET
    // hit (both always drawn — story 4.6, `rollHit`). Nothing else draws.
    // Reordering or re-counting ANY of these changes every existing seed's
    // battle — the table is frozen forever once 4.6 shipped.
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
      // FR33 (story 4.7, dossier §4): a Guard charge unconsumed by a landed
      // hit expires at the engagement's NATURAL end — explicit, log-driven,
      // no shell lifecycle rule (the story-2.2 StatusCleared lesson, applied
      // from birth). Runs for every engagement (including the battle's last),
      // guarded by the same `wiped === undefined` a mid-pass wipe already
      // short-circuits (mirrors poison's skip-on-wipe).
      for (const unit of units) {
        if (unit.alive && unit.guard !== undefined) {
          events.push({ type: 'GuardEnded', unit: unit.id });
          unit.guard = undefined;
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
  return act(unit, units, battle, setup, leaderFallen);
}

/**
 * The unit's NORMAL action by class, under the acting side's tactic (FR34).
 * Targeting is the fixed two-step (targeting.ts): legal list → tactic. Melee
 * is reach-filtered with Last Stand (FR7); ranged/magic is global (FR9). The
 * `leader` tactic reads the enemy leader's unit id (`${enemySide}:${index}`).
 */
function act(unit: UnitState, units: UnitState[], battle: Stream, setup: MatchSetup, leaderFallen: Record<Side, boolean>): BattleEvent[] {
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
    // Vanguard + Skirmisher act by their (class, row) MOVE (story 4.7, dossier
    // §4 — the table is DATA, not code): a Guard row raises a shield instead
    // of attacking; every other row melees the nearest reachable target with
    // its row's move kind. Role only shifts the RPS multiplier, applied inside
    // damagePipeline.
    case 'knight':
    case 'mercenary':
    case 'berserker':
    case 'phalanx':
    case 'ninja':
    case 'valkyrie': {
      const move = BALANCE.classes[unit.class].moves[unit.snapshot.placement.row];
      if (move === 'guard-full' || move === 'guard-half') return raiseGuard(unit, move === 'guard-full' ? 'full' : 'half');
      const idx = selectMeleeTarget(unit.colIndex, enemies, tactic, enemyLeaderId);
      if (idx === undefined) return skip(unit);
      const target = enemies[idx] as UnitState;
      return strike(unit, [target], physical, move, units, setup.leaders, leaderFallen, rollHit(unit.class, target.class, battle));
    }
    case 'archer': {
      // Archer's move is row-uniform ('arrow' in every slot) — looked up from
      // the table anyway so a future per-row archer tweak is data-only.
      const move = BALANCE.classes[unit.class].moves[unit.snapshot.placement.row] as MoveKind;
      const idx = selectRangedTarget(unit.colIndex, enemies, tactic, enemyLeaderId);
      if (idx === undefined) return skip(unit);
      const target = enemies[idx] as UnitState;
      return strike(unit, [target], physical, move, units, setup.leaders, leaderFallen, rollHit(unit.class, target.class, battle));
    }
    // Artillery: a Wizard/Sorceress FRONT row is a physical, MELEE-targeted
    // staff attack (dossier §4 — distinct from the Cleric's global staff
    // fallback); mid/back keep the row-blast. Tactic interaction (D-2c): under
    // `leader` the blast targets the enemy leader's ROW (AoE treats the leader
    // as the focal point); under every other tactic — and when the leader is
    // not alive — it keeps its own rule (row with most living, tie rearmost).
    case 'mage':
    case 'sorceress': {
      const move = BALANCE.classes[unit.class].moves[unit.snapshot.placement.row];
      if (move === 'staff') {
        const idx = selectMeleeTarget(unit.colIndex, enemies, tactic, enemyLeaderId);
        if (idx === undefined) return skip(unit);
        const target = enemies[idx] as UnitState;
        return strike(unit, [target], physical, 'staff', units, setup.leaders, leaderFallen, rollHit(unit.class, target.class, battle));
      }
      const leaderRow = tactic === 'leader' ? enemies.find((e) => e.id === enemyLeaderId && e.alive)?.rowIndex : undefined;
      const row = leaderRow ?? selectBlastRow(enemies);
      if (row === undefined) return skip(unit);
      const targets = enemies.filter((e) => e.alive && e.rowIndex === row);
      // Blast is MAGIC — no leader-fall penalty, no Guard (dossier §4: both physical only).
      return strike(unit, targets, (a, d, w) => blastDamage(a, d, w ?? false, mode), 'blast', units, setup.leaders, leaderFallen);
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
      // The staff is PHYSICAL (STR-based) — it carries the sober-package penalty
      // AND the crit/dodge draws (ADR 0003: "staff bonk" is a physical hit).
      const move = BALANCE.classes[unit.class].moves[unit.snapshot.placement.row] as MoveKind; // row-uniform 'staff'
      const idx = selectRangedTarget(unit.colIndex, enemies, tactic, enemyLeaderId);
      if (idx === undefined) return skip(unit);
      const target = enemies[idx] as UnitState;
      return strike(unit, [target], physical, move, units, setup.leaders, leaderFallen, rollHit(unit.class, target.class, battle));
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
      // A2 (misfire redirect target) draws first, THEN A3/A4 for the resulting
      // physical strike on the ally — ADR 0003's frozen order (a misfired
      // physical attack onto an ally is an A3/A4 draw site).
      const target = allies[nextInt(battle, 0, allies.length - 1)] as UnitState;
      return strike(unit, [target], physical, attackMoveOf(unit), units, setup.leaders, leaderFallen, rollHit(unit.class, target.class, battle));
    }
    case 'mage':
    case 'sorceress': {
      // A FRONT-row Wizard/Sorceress's normal action is a physical single-target
      // staff (story 4.7), so its misfire is row-consistent: a physical strike on
      // a random ally, exactly like the melee misfire above — an A2 (redirect
      // target) + A3/A4 (dodge/crit) draw site (ADR 0003 already classes a
      // misfired physical single-target attack this way; NO frozen-table change).
      // Mid/back rows keep the magic self-blast (review decision, story 4.7).
      const move = BALANCE.classes[unit.class].moves[unit.snapshot.placement.row];
      if (move === 'staff') {
        if (allies.length === 0) return [{ type: 'ActionFizzled', unit: unit.id }];
        const target = allies[nextInt(battle, 0, allies.length - 1)] as UnitState;
        return strike(unit, [target], physical, 'staff', units, setup.leaders, leaderFallen, rollHit(unit.class, target.class, battle));
      }
      // Blasts its OWN fullest row (recorded decision: the mage itself counts
      // and can be struck by its own blast). Magic — no leader-fall penalty, no draws.
      const own = units.filter((u) => u.side === unit.side);
      const row = selectBlastRow(own);
      if (row === undefined) return [{ type: 'ActionFizzled', unit: unit.id }];
      const targets = own.filter((u) => u.alive && u.rowIndex === row);
      return strike(unit, targets, (a, d, w) => blastDamage(a, d, w ?? false, mode), 'blast', units, setup.leaders, leaderFallen);
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
 * Raises a unit's one-shot Guard charge (FR33, story 4.7, dossier §4): the
 * action is spent with no attack, no `UnitAttacked`. Re-raising (a 2-action
 * Phalanx front's 2nd action, or a later pass after the charge was already
 * spent) sets a FRESH charge and emits `GuardRaised` again — legal and
 * expected (the charge is one-shot, not "already guarding, skip").
 */
function raiseGuard(unit: UnitState, tier: 'full' | 'half'): BattleEvent[] {
  unit.guard = tier;
  return [{ type: 'GuardRaised', unit: unit.id }];
}

/**
 * The physical attack kind a confused unit's misfire swings with (FR16/FR32).
 * Normally the acting unit's own row move; a unit whose row RAISES Guard
 * (Knight-mid, Phalanx-front/mid) has no attack shape to misfire with — the
 * confusion misfire branch keeps its established "always a melee-style
 * strike" behavior (story 4.7 doesn't special-case a guarding confusion), so
 * it falls back to the class's own BACK-row move, which the frozen table
 * always keeps as a real attack (Knight back = slash, Phalanx back = bash).
 */
function attackMoveOf(unit: UnitState): MoveKind {
  const moves = BALANCE.classes[unit.class].moves;
  const move = moves[unit.snapshot.placement.row];
  return move === 'guard-full' || move === 'guard-half' ? (moves.back as MoveKind) : move;
}

/**
 * The FR33 Full/Half Guard shield (story 4.7, dossier §4 — REVISED by Danilo
 * 2026-07-19, supersedes the dossier's original redirect design): checked for
 * every LANDED physical single-target hit, as the OUTERMOST post-pipeline
 * step. A cell is shielded when the target itself holds a live Guard charge,
 * OR a living ally directly IN FRONT of it (row − 1, same column, same side)
 * does. NOT a redirect: `target` stays the target and takes the
 * reduced/zero number; the guard takes nothing. Full negates (`0`, exempt
 * from the minDamage floor, like a dodge); Half halves, re-clamped to
 * `minDamage`. Consumes the charge (`GuardEnded`) — a dodge never reaches
 * here (the caller only calls this on a landed hit).
 */
function applyGuard(damage: number, target: UnitState, units: readonly UnitState[]): { damage: number; guardedBy?: UnitId; ended?: BattleEvent } {
  const guardian =
    target.guard !== undefined
      ? target
      : units.find((u) => u.side === target.side && u.alive && u.guard !== undefined && u.rowIndex === target.rowIndex - 1 && u.colIndex === target.colIndex);
  if (guardian === undefined) return { damage };
  const tier = guardian.guard as 'full' | 'half';
  const reduced =
    tier === 'full' ? 0 : Math.max(BALANCE.formulas.minDamage, Math.floor((damage * BALANCE.formulas.guardHalf.num) / BALANCE.formulas.guardHalf.den));
  guardian.guard = undefined;
  return { damage: reduced, guardedBy: guardian.id, ended: { type: 'GuardEnded', unit: guardian.id } };
}

/**
 * The frozen percent range for the crit/dodge draws (ADR 0003 §Chances,
 * story 4.6): each draw spans [0, DEX_CHANCE_DEN − 1] and the outcome fires
 * when the draw is below `floor(DEX / dexChanceDivisor)`. This is the draw
 * RANGE — a frozen rule (changing it re-scales every stored seed's rolls), so
 * it lives here as a constant, NOT in the sweep-policed balance data. The
 * divisor and crit multiplier ARE balance data (`BALANCE.formulas`).
 */
const DEX_CHANCE_DEN = 100;

/**
 * ADR 0003's per-physical-single-target draws A3 (dodge) + A4 (crit), in that
 * exact frozen order (story 4.6). ALWAYS both draws — the crit roll is taken
 * even when the hit is dodged (its result discarded), so a physical
 * single-target hit consumes EXACTLY 2 `battle` draws whatever the outcome
 * (the auditable fixed-count property). Dodge is keyed to the DEFENDER's DEX,
 * crit to the ATTACKER's DEX (`floor(DEX / dexChanceDivisor)` percent).
 *
 * Called ONLY for physical single-target hits (melee/arrow/staff, and a
 * misfired physical strike on an ally); magic (blast/heal/status), Guard,
 * leader-fall, Golem, and tactics selection take zero draws (ADR 0003).
 * Exported for direct stream-consumption tests (the draw-count/order pin).
 */
export function rollHit(attacker: UnitClass, defender: UnitClass, battle: Stream): { dodged: boolean; crit: boolean } {
  const divisor = BALANCE.formulas.dexChanceDivisor;
  // A3 — dodge (defender DEX), drawn first.
  const dodged = nextInt(battle, 0, DEX_CHANCE_DEN - 1) < Math.floor(BALANCE.classes[defender].dex / divisor);
  // A4 — crit (attacker DEX), ALWAYS drawn (result discarded on a dodge).
  const crit = nextInt(battle, 0, DEX_CHANCE_DEN - 1) < Math.floor(BALANCE.classes[attacker].dex / divisor);
  return { dodged, crit };
}

/**
 * Applies one attack from `source` to `targets` (one entry for melee/ranged/
 * staff; the whole struck row for a blast — AD-12 one event per action).
 * Damage runs the FIXED pipeline with the source's Weaken status; each kill
 * appends a `UnitDied` after the single `UnitAttacked`, in target order.
 *
 * `kind` (story 4.7) is the move's physical shape, resolved by the CALLER from
 * the (class, row) table — `strike` never re-derives it (AD-2 applies inside
 * the engine too: one lookup site).
 *
 * `roll` (story 4.6) is present ONLY for a physical single-target hit — the
 * pre-drawn ADR 0003 dodge/crit result. A dodge reports `damage: 0`,
 * `outcome: 'dodged'`, no HP change, no death, no Guard consumption; a crit
 * passes the ×3/2 flag to the (physical) `formula` and reports `outcome:
 * 'crit'`. With no `roll` (blast/magic) every target resolves `outcome: 'hit'`
 * — magic never crits, is dodged, or is Guarded (ADR 0003, dossier §4).
 *
 * Guard (FR33, story 4.7): `roll !== undefined` is EXACTLY the physical
 * single-target eligibility Guard needs too, so a landed hit in that set is
 * checked against `applyGuard` — the OUTERMOST post-pipeline step, after
 * `formula` (which already ran RPS/crit/Weaken/leader-fall/re-clamp) returns.
 * NOT a redirect: `target` stays `targets[].unit`; `redirectedFrom` only
 * attributes the block to the guarding unit for the shell.
 */
function strike(
  source: UnitState,
  targets: UnitState[],
  formula: (a: UnitClass, d: UnitClass, weakened?: boolean, crit?: boolean) => number,
  kind: MoveKind,
  units: readonly UnitState[],
  leaders: MatchSetup['leaders'],
  leaderFallen: Record<Side, boolean>,
  roll?: { dodged: boolean; crit: boolean },
): BattleEvent[] {
  const weakened = source.statuses.has('weaken');
  const hits: AttackTarget[] = [];
  const deaths: BattleEvent[] = [];
  const guardEvents: BattleEvent[] = [];
  let redirectedFrom: UnitId | undefined;
  for (const target of targets) {
    if (roll?.dodged) {
      // A dodge negates the hit entirely: no damage, no HP change, no death,
      // no Guard consumption (only a LANDED hit spends a charge).
      hits.push({ unit: target.id, damage: 0, hpAfter: target.hp, outcome: 'dodged' });
      continue;
    }
    const crit = roll?.crit ?? false;
    let damage = formula(source.class, target.class, weakened, crit);
    if (roll !== undefined) {
      const guarded = applyGuard(damage, target, units);
      damage = guarded.damage;
      if (guarded.guardedBy !== undefined) {
        redirectedFrom = guarded.guardedBy; // single-target only — at most one guarded target per strike
        if (guarded.ended !== undefined) guardEvents.push(guarded.ended);
      }
    }
    target.hp = Math.max(0, target.hp - damage);
    hits.push({ unit: target.id, damage, hpAfter: target.hp, outcome: crit ? 'crit' : 'hit' });
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
  const attacked: UnitAttacked = { type: 'UnitAttacked', source: source.id, kind, targets: hits };
  if (redirectedFrom !== undefined) attacked.redirectedFrom = redirectedFrom;
  return [attacked, ...guardEvents, ...deaths];
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
 *
 * Story 4.6: the `crit` flag threads through to `physicalDamage` (so the ×3/2
 * lands inside the pipeline, after RPS/before Weaken); the leader-fall ratios
 * then compose OUTSIDE the pipeline (the established sober-package position)
 * and re-clamp last. The composed physical order is thus base → RPS → crit →
 * Weaken → clamp → leader-fall dealt/taken → re-clamp — deterministic, pinned
 * by goldens.
 */
export function leaderPenaltyPhysical(
  attackerSide: Side,
  defenderSide: Side,
  leaderFallen: Record<Side, boolean>,
): (a: UnitClass, d: UnitClass, weakened?: boolean, crit?: boolean) => number {
  const { leaderFallDealt, leaderFallTaken, minDamage } = BALANCE.formulas;
  return (a, d, weakened, crit) => {
    let dmg = physicalDamage(a, d, weakened, crit);
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
export function physicalDamage(attacker: UnitClass, defender: UnitClass, weakened = false, crit = false): number {
  return damagePipeline(BALANCE.classes[attacker].str, attacker, defender, weakened, 'vit', undefined, crit ? BALANCE.formulas.critMultiplier : undefined);
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
 * base → preRps attenuation (blast only, FR10) → RPS → crit (FR36, story 4.6)
 * → weaken → min clamp.
 *
 * The ×1.5 advantage / ×0.75 disadvantage now derive from the role-relation
 * table via `rpsRatio` (story 4.3, AD-4): symmetric edges penalise the reverse,
 * one-way hunts do not — the exact FR14-amendment asymmetry the old
 * `rpsBeats`/`rpsHunts` pair encoded, from a single source.
 *
 * `crit` (ADR 0003 §Chances): a ×3/2 multiplier slotted immediately AFTER RPS
 * and BEFORE Weaken (the sole in-pipeline status modifier). It MUST live here,
 * not as an outer wrapper on the result — applied after Weaken/clamp the
 * flooring order changes (`floor(floor(x·3/2)/2) ≠ floor(floor(x/2)·3/2)`),
 * breaking the frozen FR15 order. Only the physical single-target path passes
 * it; magic/blast never crit.
 */
function damagePipeline(
  power: number,
  attacker: UnitClass,
  defender: UnitClass,
  weakened: boolean,
  mitigation: 'vit' | 'men',
  preRps?: Ratio,
  crit?: Ratio,
): number {
  const { formulas, classes } = BALANCE;
  const base = power - Math.floor(classes[defender][mitigation] / 2);
  let modified = preRps === undefined ? base : Math.floor((base * preRps.num) / preRps.den);
  const rps = rpsRatio(attacker, defender);
  if (rps !== undefined) modified = Math.floor((modified * rps.num) / rps.den);
  if (crit !== undefined) modified = Math.floor((modified * crit.num) / crit.den);
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
        guard: undefined,
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
