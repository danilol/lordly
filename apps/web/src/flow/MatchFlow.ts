import { BALANCE, chooseSetup, createStreams, resolveBattle, rollElement, rollName, slotTotal, STRATEGY_POOL, validateMatchSetup } from '@lordly/engine';
import type { BattleEnded, BattleLog, Element, MatchSetup, Mode, Placement, Tactic, Unit, UnitClass } from '@lordly/engine';
import { placeUnit, unplaceUnit } from './placement';
import type { DraftedUnit, MatchState } from './MatchState';
import { createStorage } from './storage';
import type { WebStorage } from './storage';

/** Produces a fresh uint32 match seed. Injected so tests can pin it (AD-10). */
export type SeedSource = () => number;

/** Default seed source: one uint32 from the Web Crypto RNG — the flow's ONE effectful dependency. */
const cryptoSeed: SeedSource = () => crypto.getRandomValues(new Uint32Array(1))[0] as number;

/** Produces the history entry's ISO 8601 timestamp. Injected so tests can pin it (story 3.1). */
export type Clock = () => string;

/** Default clock: the real wall clock, ISO-formatted — lives ONLY here, never inline in flow logic. */
const isoNow: Clock = () => new Date().toISOString();

/**
 * The controller that OWNS the `MatchState` and is the SOLE caller of the
 * engine's AI module and the SOLE mutator of match truth (AD-13). Scenes
 * call these methods and render `getState()`; they never touch the engine,
 * the RNG, or the state object directly. Phaser-free and DOM-free apart from
 * the injected seed source (`crypto.getRandomValues` by default), so the
 * whole controller is unit-testable with a fixed seed.
 */
export class MatchFlow {
  private state: MatchState;
  /**
   * The resolved battle log, cached here (NOT in `MatchState`) so the state
   * stays plain and JSON-serializable (AD-5). Resolved exactly once per match
   * by `resolve()` (AD-13); cleared on `startMatch()` so a rematch resolves
   * its own fresh battle.
   */
  private log?: BattleLog;

  /**
   * Once-per-match guard for the history write (story 3.1, AD-13). Lives on
   * the FLOW, not on `MatchState` — the state's JSON-serializability contract
   * (AD-5) stays untouched. Reset by `startMatch()` like the cached log.
   */
  private historyWritten = false;

  /**
   * AD-13's `live | replay` mode as a flow-level flag (story 3.2): set by
   * `startReplay()`, cleared by `startMatch()` — so the Result screen's
   * Rematch after a replay is automatically a live match again. Kept separate
   * from `historyWritten` on purpose (two concepts: "already wrote" vs
   * "must never write").
   */
  private replay = false;

  constructor(
    private readonly seedSource: SeedSource = cryptoSeed,
    /** The AD-8 gateway for the history write; injectable for tests, no-op backend in node. */
    private readonly storage: WebStorage = createStorage(),
    private readonly clock: Clock = isoNow,
  ) {
    this.state = MatchFlow.emptyState(0);
  }

  private static emptyState(seed: number, mode: Mode = 'single', lastAiArchetypeId?: string): MatchState {
    return {
      seed,
      mode,
      playerArmy: [],
      playerPlacements: [],
      elementsRolled: 0,
      nameRolls: [],
      playerLeader: null,
      playerTactic: 'autonomous',
      phase: 'draft',
      lastAiArchetypeId,
    };
  }

  /**
   * Begins a new match with a FRESH seed (AD-10) — used for the first match
   * and every rematch. Carries `lastAiArchetypeId` forward so the next AI
   * pick can exclude it (FR25 no-repeat), and carries the battle `mode` the
   * same way (FR19/story 1.10): pass one to set it (Home's toggle), omit it
   * to keep the current one (Result's Rematch). Resets everything else.
   */
  startMatch(mode?: Mode): void {
    this.state = MatchFlow.emptyState(this.seedSource() >>> 0, mode ?? this.state.mode, this.state.lastAiArchetypeId);
    this.log = undefined; // a rematch resolves its own battle (AD-13)
    this.historyWritten = false; // …and records its own history entry (story 3.1)
    this.replay = false; // Rematch-from-a-replay is a LIVE match (story 3.2)
  }

  /**
   * Enters REPLAY mode (story 3.2, FR20/FR28, AD-13): hydrates the flow
   * straight to the committed phase from a stored history `MatchSetup`, so
   * the existing Battle → Result pipeline replays the battle tick-for-tick
   * (determinism — same setup, bit-identical log). Replay writes nothing:
   * `recordResult()` no-ops until `startMatch()` flips the flow live again.
   *
   * @throws InvalidMatchSetupError — notably `balance-version-mismatch` for a
   * stale entry (AD-8): the History screen's gate should prevent the call;
   * this is the flow-level backstop.
   */
  startReplay(setup: MatchSetup): void {
    validateMatchSetup(setup); // fail at the tap, not mid-scene
    this.state = {
      seed: setup.seed,
      mode: setup.mode,
      // Mirror side A so any state reader stays coherent (engine Unit is
      // structurally a DraftedUnit; Placement[] assigns to (Placement|null)[]).
      playerArmy: setup.armies.A.map((u) => ({ class: u.class, element: u.element, name: u.name })),
      playerPlacements: [...setup.placements.A],
      elementsRolled: setup.armies.A.length,
      // The names twin (story 4.2): one draw per stored unit, in army order.
      nameRolls: setup.armies.A.map((u) => u.class),
      playerLeader: setup.leaders.A,
      playerTactic: setup.tactics.A,
      phase: 'committed',
      committedSetup: setup,
      // lastAiArchetypeId is deliberately UNSET: the archetype id isn't stored
      // in a HistoryEntry (only the composition is), so it's unrecoverable from
      // a replayed setup. Consequence: a Rematch AFTER a replay can't exclude
      // the replayed opponent's archetype (FR25 no-repeat) — accepted, since a
      // replay isn't a "previous live match" and the id genuinely isn't stored.
    };
    this.log = undefined;
    this.historyWritten = false;
    this.replay = true;
  }

  /** A read-only-by-convention view of the current state (scenes render from this). */
  getState(): MatchState {
    return this.state;
  }

  /**
   * Drafts a unit of `cls`, rolling its element once on `elements/A` and its
   * name once on `names/A` (FR1, FR3, FR37, AD-9). Duplicates are allowed;
   * throws when the SLOT budget is filled (AD-1 — never an army.length gate).
   * Clears the leader designation (story 4.2 invariant: any army mutation
   * resets it).
   */
  draftUnit(cls: UnitClass): DraftedUnit {
    if (this.state.phase === 'committed') throw new Error('cannot draft: match already committed');
    if (slotTotal(this.state.playerArmy) >= BALANCE.slotBudget) {
      throw new Error(`cannot draft: the army's ${BALANCE.slotBudget} slots are filled`);
    }
    const unit: DraftedUnit = { class: cls, element: this.rollNextElement(), name: this.rollNextName(cls) };
    this.state.playerArmy.push(unit);
    this.state.playerPlacements.push(null);
    this.state.playerLeader = null; // army mutated → leader designation clears (AD-9)
    return unit;
  }

  /** Removes the drafted unit at `index`; its element and name are discarded (forward-only — the counters never rewind). Clears the leader designation. */
  removeUnit(index: number): void {
    if (this.state.phase === 'committed') throw new Error('cannot remove: match already committed');
    if (!Number.isInteger(index) || index < 0 || index >= this.state.playerArmy.length) {
      throw new Error(`removeUnit: index ${index} out of range`);
    }
    this.state.playerArmy.splice(index, 1);
    this.state.playerPlacements.splice(index, 1);
    this.state.playerLeader = null; // army mutated → leader designation clears (AD-9)
  }

  /** Places (or moves/swaps) the unit at `unitIndex` onto `target` via the pure placement model (FR4). */
  placeUnit(unitIndex: number, target: Placement): void {
    if (this.state.phase === 'committed') throw new Error('cannot place: match already committed');
    if (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex >= this.state.playerArmy.length) {
      throw new Error(`placeUnit: index ${unitIndex} out of range`);
    }
    this.state.playerPlacements = placeUnit(this.state.playerPlacements, unitIndex, target);
    this.state.phase = 'placement';
  }

  /** Returns the unit at `unitIndex` from the board to the tray (double-tap-to-remove — story 4.4 device feedback). */
  unplaceUnit(unitIndex: number): void {
    if (this.state.phase === 'committed') throw new Error('cannot unplace: match already committed');
    if (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex >= this.state.playerArmy.length) {
      throw new Error(`unplaceUnit: index ${unitIndex} out of range`);
    }
    this.state.playerPlacements = unplaceUnit(this.state.playerPlacements, unitIndex);
    this.state.phase = 'placement';
  }

  /** How many player units are currently placed on the grid (drives submit gating — FR4/AC4). */
  placedCount(): number {
    return this.state.playerPlacements.filter((p) => p !== null).length;
  }

  /**
   * Sets the player's army-wide tactic (FR34, story 4.4) — the Placement
   * picker's write path (AD-13: scenes never mutate state directly). Unlike the
   * leader designation, a tactic is army-independent, so it survives draft/remove
   * and is never cleared. `'leader'` is a valid engine tactic but the picker
   * keeps it disabled until story 4.5 ships leader designation.
   */
  setTactic(tactic: Tactic): void {
    if (this.state.phase === 'committed') throw new Error('cannot set tactic: match already committed');
    this.state.playerTactic = tactic;
  }

  /**
   * Assembles the committed `MatchSetup` (AD-9/AD-11) and commits the AI's
   * board via `chooseSetup` on the `ai/B` stream (AD-6/AD-13 — the AI never
   * sees the player). Validates before storing (spine errors convention);
   * records the AI archetype for rematch no-repeat. Throws if the player
   * board is incomplete (submit gating must have prevented this).
   */
  commit(): MatchSetup {
    // Idempotent: a double-tap must not re-run the AI pick — a second call
    // would read this match's own archetype as `exclude` and derive a
    // DIFFERENT opponent, overwriting the committed board.
    if (this.state.phase === 'committed' && this.state.committedSetup) {
      return this.state.committedSetup;
    }
    // Legality is SLOTS (AD-1, story 4.2); placement completeness stays
    // per-unit (parallel indices, not a legality measure).
    if (slotTotal(this.state.playerArmy) !== BALANCE.slotBudget || this.placedCount() !== this.state.playerArmy.length) {
      throw new Error(`cannot commit: place all ${BALANCE.slotBudget} units first`);
    }

    const streams = createStreams(this.state.seed);
    const ai = chooseSetup(STRATEGY_POOL, streams['ai/B'], { exclude: this.state.lastAiArchetypeId });

    const placementsA = this.state.playerPlacements.map((p, i) => {
      if (p === null) throw new Error(`cannot commit: unit ${i} is not placed`);
      return p;
    });

    // The AI side's elements AND names roll HERE, on the B streams — MatchFlow
    // rolls, never chooseSetup (AD-6: the AI module admits nothing but its own
    // stream). Per unit in army order: one element, one name (AD-9/AD-10).
    const armyB: Unit[] = [];
    const takenB: string[] = [];
    for (const cls of ai.classes) {
      const name = rollName(streams['names/B'], cls, takenB);
      takenB.push(name);
      armyB.push({ class: cls, element: rollElement(streams['elements/B']), name });
    }

    const setup: MatchSetup = {
      seed: this.state.seed,
      balanceVersion: BALANCE.version,
      mode: this.state.mode,
      // Side A's tactic is the player's Placement pick (story 4.4); side B is
      // the AI's own committed tactic, drawn from its `ai/B` stream (FR24 — the
      // AI never sees the player). Leader designation still ships in 4.5, so
      // leaders stay the interim index-0 default until then.
      tactics: { A: this.state.playerTactic, B: ai.tactic },
      leaders: { A: this.state.playerLeader ?? 0, B: 0 },
      armies: {
        A: this.state.playerArmy.map((u) => ({ class: u.class, element: u.element, name: u.name })),
        B: armyB,
      },
      placements: { A: placementsA, B: [...ai.placement] },
    };

    // The shell validates all input before the engine trusts it; a throw here
    // is an assembly bug, not user error — surface it loudly (spine convention).
    validateMatchSetup(setup);

    this.state.committedSetup = setup;
    this.state.lastAiArchetypeId = ai.archetypeId;
    this.state.phase = 'committed';
    return setup;
  }

  /**
   * Resolves the committed battle into an immutable `BattleLog` (AD-1/AD-2)
   * EXACTLY ONCE (AD-13): `MatchFlow` is the sole caller of `resolveBattle`,
   * and the Reveal/Battle scenes replay the returned log read-only — they
   * never touch the engine. Idempotent like `commit()`: a second call returns
   * the SAME frozen log, never re-resolving (which would waste work and, in
   * `replay` mode later, could re-enter history — the exact double-resolution
   * trap AD-13 prevents). Cleared by `startMatch()` so a rematch resolves fresh.
   */
  resolve(): BattleLog {
    if (this.log) return this.log;
    if (this.state.phase !== 'committed' || !this.state.committedSetup) {
      throw new Error('cannot resolve: match is not committed');
    }
    this.log = resolveBattle(this.state.committedSetup);
    return this.log;
  }

  /**
   * Records this live match into on-device history — EXACTLY ONCE (FR28,
   * AD-8, AD-13): the Result scene calls this at the verdict moment, and
   * `MatchFlow` is the sole path to `appendHistory`. Idempotent like
   * `commit()`/`resolve()`, so a Phaser singleton-scene restart can never
   * duplicate an entry; `startMatch()` re-arms it for the rematch. The entry
   * is the full committed `MatchSetup` + the log's verdict + the injected
   * clock's ISO date — never the `BattleLog` (AD-8 forbids caching it).
   * This is also the single choke point a future `replay` mode (story 3.2)
   * bypasses: replays never write.
   *
   * @throws if the battle has not been resolved — there is no verdict yet.
   */
  recordResult(): void {
    if (this.replay || this.historyWritten) return; // replays NEVER write (AD-13, story 3.2)
    if (!this.log || !this.state.committedSetup) {
      throw new Error('cannot record result: battle is not resolved');
    }
    const ended = this.log.events[this.log.events.length - 1] as BattleEnded;
    this.storage.appendHistory({ setup: this.state.committedSetup, winner: ended.winner, date: this.clock() });
    this.historyWritten = true;
  }

  /**
   * Draws the next `elements/A` value (forward-only): reconstruct the stream
   * from the seed, fast-forward past every draw already made this match, take
   * one, and bump the counter. The fast-forward is a handful of draws — the
   * cost is trivial and it keeps the live stream out of the serializable state.
   */
  private rollNextElement(): Element {
    const stream = createStreams(this.state.seed)['elements/A'];
    for (let i = 0; i < this.state.elementsRolled; i++) rollElement(stream);
    const element = rollElement(stream);
    this.state.elementsRolled += 1;
    return element;
  }

  /**
   * Draws the next `names/A` value (forward-only, story 4.2 — the exact
   * `rollNextElement` pattern): reconstruct the stream, fast-forward by
   * REPLAYING each past draw with its recorded class (a name draw's bounds
   * come from the class's table, so the class list — not a bare count — is
   * what makes the fast-forward bit-identical; dedup never consumes draws,
   * so an empty `taken` replays exactly), take one with same-army dedup
   * (dossier §7), and append to the roll history. Removals never rewind.
   */
  private rollNextName(cls: UnitClass): string {
    const stream = createStreams(this.state.seed)['names/A'];
    for (const pastCls of this.state.nameRolls) rollName(stream, pastCls, []);
    const name = rollName(
      stream,
      cls,
      this.state.playerArmy.map((u) => u.name),
    );
    this.state.nameRolls.push(cls);
    return name;
  }
}
