import { describe, expect, it } from 'vitest';
import { BALANCE, createStreams, rollElement, rollName, validateMatchSetup } from '@lordly/engine';
import type { BattleEnded } from '@lordly/engine';
import { MatchFlow } from '../src/flow/MatchFlow';
import type { MatchState } from '../src/flow/MatchState';
import { createStorage } from '../src/flow/storage';
import type { HistoryEntry, WebStorage } from '../src/flow/storage';

/** A MatchFlow with a fixed seed so every draw is deterministic in tests. */
function flowWithSeed(seed: number): MatchFlow {
  return new MatchFlow(() => seed);
}

/**
 * Drafts a full slot-legal army (5 smalls — AD-1), places every unit, and
 * crowns a leader — the complete Ready state a commit now requires (story 4.5:
 * commit throws without a crown). Callers testing the crown itself set their own.
 */
function draftAndPlaceAll(flow: MatchFlow): void {
  flow.draftUnit('knight');
  flow.draftUnit('archer');
  flow.draftUnit('mage');
  flow.draftUnit('cleric');
  flow.draftUnit('witch');
  flow.placeUnit(0, { row: 'front', col: 'center' });
  flow.placeUnit(1, { row: 'back', col: 'left' });
  flow.placeUnit(2, { row: 'back', col: 'right' });
  flow.placeUnit(3, { row: 'mid', col: 'center' });
  flow.placeUnit(4, { row: 'front', col: 'left' });
  flow.setLeader(0); // story 4.5: a crown is required to commit
}

describe('MatchState serializability (AD-5)', () => {
  it('survives a JSON round-trip unchanged — no live Stream, Phaser object, or function in state', () => {
    const flow = flowWithSeed(0x1234abcd);
    flow.startMatch();
    flow.draftUnit('knight');
    flow.draftUnit('mage');
    const state = flow.getState();
    const roundTripped = JSON.parse(JSON.stringify(state)) as MatchState;
    expect(roundTripped).toEqual(state);
  });

  it('the COMMITTED state — the actual story-1.9 hand-off, with a nested MatchSetup — round-trips unchanged', () => {
    const flow = flowWithSeed(0xabcdef);
    flow.startMatch();
    draftAndPlaceAll(flow);
    flow.commit();
    const state = flow.getState();
    expect(state.phase).toBe('committed');
    expect(state.committedSetup).toBeDefined();
    const roundTripped = JSON.parse(JSON.stringify(state)) as MatchState;
    expect(roundTripped).toEqual(state); // nested MatchSetup and all
  });
});

describe('MatchFlow draft (FR1/FR3, AD-9/AD-10)', () => {
  it('rolls each unit its element via elements/A, deterministically for a fixed seed', () => {
    const seed = 42;
    const flow = flowWithSeed(seed);
    flow.startMatch();
    const first = flow.draftUnit('knight');
    const second = flow.draftUnit('archer');

    // Hand-derive against a fresh elements/A stream: the Nth draftUnit ever
    // takes the Nth draw (forward-only), regardless of class.
    const stream = createStreams(seed)['elements/A'];
    expect(first.element).toBe(rollElement(stream));
    expect(second.element).toBe(rollElement(stream));
    expect(first.class).toBe('knight');
    expect(second.class).toBe('archer');
  });

  it('allows duplicates and caps the army at the slot budget (AD-1)', () => {
    const flow = flowWithSeed(7);
    flow.startMatch();
    for (let i = 0; i < BALANCE.slotBudget; i++) flow.draftUnit('knight');
    expect(() => flow.draftUnit('knight')).toThrow(new RegExp(`${BALANCE.slotBudget} slots are filled`));
    expect(flow.getState().playerArmy).toHaveLength(BALANCE.slotBudget); // all-smalls era: 5 slots = 5 units
  });

  it('FORWARD-ONLY: removing a unit and re-adding draws the NEXT element, never the discarded one (AC2)', () => {
    const seed = 999;
    const flow = flowWithSeed(seed);
    flow.startMatch();
    flow.draftUnit('knight'); // draw 0
    const removed = flow.draftUnit('mage'); // draw 1
    flow.draftUnit('cleric'); // draw 2
    flow.removeUnit(1); // discard the mage (its element is gone forever)
    const readded = flow.draftUnit('witch'); // must be draw 3, NOT a reused draw 1

    const stream = createStreams(seed)['elements/A'];
    const draws = [rollElement(stream), rollElement(stream), rollElement(stream), rollElement(stream)];
    expect(removed.element).toBe(draws[1]);
    expect(readded.element).toBe(draws[3]); // the 4th draw — forward-only
    expect(readded.element).not.toBe(undefined);
    expect(flow.getState().elementsRolled).toBe(4);
  });
});

describe('MatchFlow names (FR37, AD-9/AD-10, story 4.2)', () => {
  it('rolls each unit its name via names/A, deterministically for a fixed seed', () => {
    const seed = 4242;
    const flow = flowWithSeed(seed);
    flow.startMatch();
    const first = flow.draftUnit('knight');
    const second = flow.draftUnit('archer');

    // Hand-derive against a fresh names/A stream: the Nth draft takes the Nth
    // draw, with same-army dedup against the names already rolled.
    const stream = createStreams(seed)['names/A'];
    const expectedFirst = rollName(stream, 'knight', []);
    const expectedSecond = rollName(stream, 'archer', [expectedFirst]);
    expect(first.name).toBe(expectedFirst);
    expect(second.name).toBe(expectedSecond);
  });

  it('FORWARD-ONLY: removing a unit and re-adding draws the NEXT name, never rewinding (AD-10)', () => {
    const seed = 777;
    const flow = flowWithSeed(seed);
    flow.startMatch();
    flow.draftUnit('knight'); // name draw 0
    flow.draftUnit('knight'); // name draw 1
    flow.removeUnit(1); // its name is gone forever
    const readded = flow.draftUnit('knight'); // must be draw 2

    const stream = createStreams(seed)['names/A'];
    const draw0 = rollName(stream, 'knight', []);
    rollName(stream, 'knight', []); // draw 1 (discarded; dedup doesn't affect stream advance)
    const draw2 = rollName(stream, 'knight', [draw0]); // taken = the one name still in the army
    expect(readded.name).toBe(draw2);
    expect(flow.getState().nameRolls).toEqual(['knight', 'knight', 'knight']);
  });

  it('never repeats a name within the same army (dossier §7 dedup)', () => {
    const flow = flowWithSeed(0x9999);
    flow.startMatch();
    const names = ['knight', 'knight', 'knight', 'knight', 'knight'].map((cls) => flow.draftUnit(cls as 'knight').name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('the committed setup carries a name for EVERY unit on both sides (FR37 — the AI is named too)', () => {
    const flow = flowWithSeed(0x4444);
    flow.startMatch();
    draftAndPlaceAll(flow);
    const setup = flow.commit();
    for (const side of ['A', 'B'] as const) {
      for (const unit of setup.armies[side]) {
        expect(unit.name.trim().length, `${side} unit name`).toBeGreaterThan(0);
      }
      expect(new Set(setup.armies[side].map((u) => u.name)).size).toBe(setup.armies[side].length);
    }
  });
});

describe('MatchFlow tactics & leaders (FR34/FR35, AD-9, story 4.4/4.5)', () => {
  it("commit() carries side A's picked tactic + leader and side B's OWN AI-drawn tactic + leader (FR24/FR35)", () => {
    const flow = flowWithSeed(0x2222);
    flow.startMatch();
    draftAndPlaceAll(flow); // crowns unit 0
    flow.setTactic('weakest');
    const setup = flow.commit();
    expect(setup.tactics.A).toBe('weakest'); // the player's Placement pick
    expect(setup.leaders.A).toBe(0); // the player's crown
    // Side B is the AI's own committed tactic + leader from its stream (FR24) —
    // any of the four tactics now that story 4.5 unlocked `leader`.
    expect(['autonomous', 'weakest', 'strongest', 'leader']).toContain(setup.tactics.B);
    expect(setup.leaders.B).toBeGreaterThanOrEqual(0);
    expect(setup.leaders.B).toBeLessThan(BALANCE.slotBudget);
  });

  it("defaults to 'autonomous' when the player never touches the picker", () => {
    const flow = flowWithSeed(0x2223);
    flow.startMatch();
    expect(flow.getState().playerTactic).toBe('autonomous');
    draftAndPlaceAll(flow);
    expect(flow.commit().tactics.A).toBe('autonomous');
  });

  it('a tactic is NOT army-dependent: it survives draft and remove (unlike the leader)', () => {
    const flow = flowWithSeed(0x3334);
    flow.startMatch();
    flow.setTactic('strongest');
    flow.draftUnit('knight'); // army mutation clears the leader …
    flow.removeUnit(0);
    expect(flow.getState().playerLeader).toBeNull(); // … but not the tactic
    expect(flow.getState().playerTactic).toBe('strongest');
  });

  it('setTactic throws once the match is committed (AD-13 guard)', () => {
    const flow = flowWithSeed(0x3335);
    flow.startMatch();
    draftAndPlaceAll(flow);
    flow.commit();
    expect(() => flow.setTactic('weakest')).toThrow(/already committed/);
  });

  it('the leader-clearing hook: draftUnit and removeUnit reset playerLeader to null (AD-9 invariant)', () => {
    const flow = flowWithSeed(0x3333);
    flow.startMatch();
    expect(flow.getState().playerLeader).toBeNull();
    flow.draftUnit('knight');
    flow.placeUnit(0, { row: 'front', col: 'center' });
    flow.setLeader(0);
    expect(flow.getState().playerLeader).toBe(0);
    flow.draftUnit('archer'); // army mutation → crown clears
    expect(flow.getState().playerLeader).toBeNull();
    flow.placeUnit(0, { row: 'front', col: 'center' });
    flow.setLeader(0);
    flow.removeUnit(1);
    expect(flow.getState().playerLeader).toBeNull();
  });

  it('setLeader crowns a placed unit; throws out of range and on an unplaced unit', () => {
    const flow = flowWithSeed(0x4440);
    flow.startMatch();
    flow.draftUnit('knight');
    flow.draftUnit('archer');
    expect(() => flow.setLeader(0)).toThrow(/not placed/); // in tray
    expect(() => flow.setLeader(5)).toThrow(/out of range/);
    expect(() => flow.setLeader(-1)).toThrow(/out of range/);
    flow.placeUnit(0, { row: 'front', col: 'center' });
    flow.setLeader(0);
    expect(flow.getState().playerLeader).toBe(0);
  });

  it('setLeader is tap-to-toggle: the same unit un-crowns; a different placed unit MOVES the crown', () => {
    const flow = flowWithSeed(0x4441);
    flow.startMatch();
    flow.draftUnit('knight');
    flow.draftUnit('archer');
    flow.placeUnit(0, { row: 'front', col: 'center' });
    flow.placeUnit(1, { row: 'front', col: 'left' });
    flow.setLeader(0);
    expect(flow.getState().playerLeader).toBe(0);
    flow.setLeader(1); // different placed unit → moves
    expect(flow.getState().playerLeader).toBe(1);
    flow.setLeader(1); // same unit → un-crowns
    expect(flow.getState().playerLeader).toBeNull();
  });

  it("clearing the crown while 'leader' is the tactic resets the tactic to 'autonomous' (D-3b: no crownless leader-tactic)", () => {
    const flow = flowWithSeed(0x4442);
    flow.startMatch();
    flow.draftUnit('knight');
    flow.placeUnit(0, { row: 'front', col: 'center' });
    flow.setLeader(0);
    flow.setTactic('leader');
    expect(flow.getState().playerTactic).toBe('leader');
    flow.draftUnit('archer'); // army mutation → crown clears → tactic must reset
    expect(flow.getState().playerLeader).toBeNull();
    expect(flow.getState().playerTactic).toBe('autonomous');
  });

  it('setLeader throws once the match is committed (AD-13 guard)', () => {
    const flow = flowWithSeed(0x4443);
    flow.startMatch();
    draftAndPlaceAll(flow);
    flow.commit();
    expect(() => flow.setLeader(1)).toThrow(/already committed/);
  });

  it('commit throws without a crown — the Ready gate should make this unreachable (spine convention)', () => {
    const flow = flowWithSeed(0x4444);
    flow.startMatch();
    flow.draftUnit('knight');
    flow.draftUnit('archer');
    flow.draftUnit('mage');
    flow.draftUnit('cleric');
    flow.draftUnit('witch');
    flow.placeUnit(0, { row: 'front', col: 'center' });
    flow.placeUnit(1, { row: 'back', col: 'left' });
    flow.placeUnit(2, { row: 'back', col: 'right' });
    flow.placeUnit(3, { row: 'mid', col: 'center' });
    flow.placeUnit(4, { row: 'front', col: 'left' });
    // fully placed, no crown → the placement check passes, the leader check trips
    expect(() => flow.commit()).toThrow(/designate a leader/);
  });
});

describe('MatchFlow commit (FR5/FR24, AD-6/AD-9/AD-11/AD-13)', () => {
  /** Draft + place a full legal player board so commit can assemble. */
  function readyToCommit(seed: number): MatchFlow {
    const flow = flowWithSeed(seed);
    flow.startMatch();
    draftAndPlaceAll(flow);
    return flow;
  }

  it('assembles a MatchSetup that passes validateMatchSetup, human as side A (AD-11)', () => {
    const flow = readyToCommit(0xbeef);
    const setup = flow.commit();
    expect(() => validateMatchSetup(setup)).not.toThrow();
    expect(setup.mode).toBe('single');
    expect(setup.balanceVersion).toBe(BALANCE.version);
    expect(setup.armies.A.map((u) => u.class)).toEqual(['knight', 'archer', 'mage', 'cleric', 'witch']);
    expect(setup.armies.B).toHaveLength(BALANCE.slotBudget); // all-smalls era: budget = unit count
    expect(setup.placements.A).toEqual([
      { row: 'front', col: 'center' },
      { row: 'back', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'mid', col: 'center' },
      { row: 'front', col: 'left' },
    ]);
  });

  it('the AI commit comes only from chooseSetup on ai/B — no player data can reach it (FR24/AD-6)', () => {
    // Two DIFFERENT player boards on the SAME seed must yield the SAME AI board:
    // the AI cannot see the player, so its output depends only on its own stream.
    const seed = 555;
    const boardA = readyToCommit(seed).commit();

    const other = flowWithSeed(seed);
    other.startMatch();
    other.draftUnit('witch');
    other.draftUnit('witch');
    other.draftUnit('cleric');
    other.draftUnit('mercenary');
    other.draftUnit('knight');
    other.placeUnit(0, { row: 'back', col: 'left' });
    other.placeUnit(1, { row: 'back', col: 'center' });
    other.placeUnit(2, { row: 'back', col: 'right' });
    other.placeUnit(3, { row: 'front', col: 'center' });
    other.placeUnit(4, { row: 'front', col: 'right' });
    other.setLeader(2); // a DIFFERENT crown than readyToCommit's — still must not reach the AI's board
    const boardB = other.commit();

    expect(boardB.armies.B).toEqual(boardA.armies.B);
    expect(boardB.placements.B).toEqual(boardA.placements.B);
  });

  it('records the AI archetype for rematch no-repeat and reaches the committed phase', () => {
    const flow = readyToCommit(1);
    flow.commit();
    expect(flow.getState().phase).toBe('committed');
    expect(flow.getState().lastAiArchetypeId).toBeTypeOf('string');
    expect(flow.getState().committedSetup).toBeDefined();
  });

  it('refuses to commit an incomplete board (submit gating is not bypassable)', () => {
    const flow = flowWithSeed(3);
    flow.startMatch();
    flow.draftUnit('knight');
    flow.draftUnit('archer');
    flow.draftUnit('mage');
    flow.draftUnit('cleric');
    flow.draftUnit('witch');
    flow.placeUnit(0, { row: 'front', col: 'center' });
    // only 1 of 5 placed
    expect(() => flow.commit()).toThrow(/place all|incomplete|not placed/i);
    // The count in the message is DERIVED from BALANCE.slotBudget, never hardcoded —
    // a drifted literal is the exact class of bug the models avoid.
    expect(() => flow.commit()).toThrow(new RegExp(`place all ${BALANCE.slotBudget} units`));
  });

  it('is idempotent: a second commit returns the SAME board, never re-deriving a different AI', () => {
    const flow = readyToCommit(0xd00d);
    const first = flow.commit();
    const second = flow.commit();
    expect(second).toBe(first); // same object — no re-pick
    expect(flow.getState().committedSetup).toBe(first);
  });

  it('rejects draft/remove/place/unplace after commit — the board is locked (phase guard)', () => {
    const flow = readyToCommit(0xf00d);
    flow.commit();
    expect(() => flow.draftUnit('witch')).toThrow(/already committed/i);
    expect(() => flow.removeUnit(0)).toThrow(/already committed/i);
    expect(() => flow.placeUnit(0, { row: 'mid', col: 'center' })).toThrow(/already committed/i);
    expect(() => flow.unplaceUnit(0)).toThrow(/already committed/i);
  });

  it('placeUnit bounds-checks its unit index (guards bad drag data)', () => {
    const flow = flowWithSeed(1);
    flow.startMatch();
    flow.draftUnit('knight');
    expect(() => flow.placeUnit(5, { row: 'front', col: 'center' })).toThrow(/out of range/i);
    expect(() => flow.placeUnit(-1, { row: 'front', col: 'center' })).toThrow(/out of range/i);
  });

  it('placeUnit and removeUnit reject a non-integer index (NaN slips past a bare </≥ guard)', () => {
    const flow = flowWithSeed(1);
    flow.startMatch();
    flow.draftUnit('knight');
    // NaN comparisons are all false, so a `< 0 || >= len` guard alone would let it
    // through and corrupt state via splice/index. The Number.isInteger check catches it.
    expect(() => flow.placeUnit(Number.NaN, { row: 'front', col: 'center' })).toThrow(/out of range/i);
    expect(() => flow.placeUnit(1.5, { row: 'front', col: 'center' })).toThrow(/out of range/i);
    expect(() => flow.removeUnit(Number.NaN)).toThrow(/out of range/i);
    // State is untouched — the guard threw before any mutation.
    expect(flow.getState().playerArmy).toHaveLength(1);
  });

  describe('MatchFlow.unplaceUnit (double-tap-to-remove, story 4.4 device review)', () => {
    it('sends a placed unit back to the tray and flips the phase to placement', () => {
      const flow = flowWithSeed(1);
      flow.startMatch();
      flow.draftUnit('knight');
      flow.placeUnit(0, { row: 'front', col: 'center' });
      flow.unplaceUnit(0);
      expect(flow.getState().playerPlacements[0]).toBeNull();
      expect(flow.getState().phase).toBe('placement');
    });

    it('bounds-checks its unit index, mirroring placeUnit', () => {
      const flow = flowWithSeed(1);
      flow.startMatch();
      flow.draftUnit('knight');
      expect(() => flow.unplaceUnit(5)).toThrow(/out of range/i);
      expect(() => flow.unplaceUnit(-1)).toThrow(/out of range/i);
    });

    it('rejects a non-integer index (NaN/float slips past a bare </≥ guard)', () => {
      const flow = flowWithSeed(1);
      flow.startMatch();
      flow.draftUnit('knight');
      flow.placeUnit(0, { row: 'front', col: 'center' });
      expect(() => flow.unplaceUnit(Number.NaN)).toThrow(/out of range/i);
      expect(() => flow.unplaceUnit(1.5)).toThrow(/out of range/i);
      // State is untouched — the guard threw before any mutation.
      expect(flow.getState().playerPlacements[0]).toEqual({ row: 'front', col: 'center' });
    });
  });
});

describe('MatchFlow resolve (AD-2/AD-13)', () => {
  /** Draft + place a full legal board, then commit — ready to resolve. */
  function committed(seed: number): MatchFlow {
    const flow = flowWithSeed(seed);
    flow.startMatch();
    draftAndPlaceAll(flow);
    flow.commit();
    return flow;
  }

  it('resolves the committed battle into a BattleLog: BattleStarted first, BattleEnded last', () => {
    const log = committed(0xabcabc).resolve();
    expect(log.logVersion).toBeTypeOf('number');
    expect(log.events.length).toBeGreaterThan(0);
    expect(log.events[0]?.type).toBe('BattleStarted');
    expect(log.events[log.events.length - 1]?.type).toBe('BattleEnded');
  });

  it('is idempotent — a second resolve returns the SAME log object, never re-resolving (AD-13)', () => {
    const flow = committed(0x0d0d);
    const first = flow.resolve();
    const second = flow.resolve();
    expect(second).toBe(first); // same object — the battle resolves exactly once
  });

  it('is deterministic — the same seed yields an equal event stream (FR20)', () => {
    expect(committed(31337).resolve().events).toEqual(committed(31337).resolve().events);
  });

  it('throws if called before commit — there is no committed setup to resolve', () => {
    const flow = flowWithSeed(5);
    flow.startMatch();
    flow.draftUnit('knight');
    expect(() => flow.resolve()).toThrow(/not committed/i);
  });

  it('rematch clears the cached log — startMatch lets the next match resolve its own battle', () => {
    const seeds = [100, 200];
    let i = 0;
    const flow = new MatchFlow(() => seeds[i++] as number);
    const fill = (f: MatchFlow) => {
      draftAndPlaceAll(f);
      f.commit();
    };
    flow.startMatch();
    fill(flow);
    const first = flow.resolve();
    flow.startMatch(); // rematch → fresh seed 200, cached log cleared
    fill(flow);
    const second = flow.resolve();
    expect(second).not.toBe(first);
  });
});

describe('MatchFlow mode (FR19/story 1.10 — Standard vs Wipeout)', () => {
  function draftAndPlace(flow: MatchFlow) {
    draftAndPlaceAll(flow);
  }

  it("defaults to 'single' — Standard is the default mode", () => {
    const flow = flowWithSeed(1);
    flow.startMatch();
    expect(flow.getState().mode).toBe('single');
    draftAndPlace(flow);
    expect(flow.commit().mode).toBe('single');
  });

  it("startMatch('wipeout') commits a wipeout setup that validates and resolves", () => {
    const flow = flowWithSeed(0xd00d1);
    flow.startMatch('wipeout');
    expect(flow.getState().mode).toBe('wipeout');
    draftAndPlace(flow);
    const setup = flow.commit();
    expect(setup.mode).toBe('wipeout');
    expect(() => validateMatchSetup(setup)).not.toThrow();
    const log = flow.resolve();
    expect(log.events[log.events.length - 1]?.type).toBe('BattleEnded');
  });

  it('rematch carries the mode forward — startMatch() with no argument keeps wipeout', () => {
    const seeds = [7, 8];
    let i = 0;
    const flow = new MatchFlow(() => seeds[i++] as number);
    flow.startMatch('wipeout');
    flow.startMatch(); // rematch — same pattern as lastAiArchetypeId
    expect(flow.getState().mode).toBe('wipeout');
  });

  it('the committed wipeout state still survives a JSON round-trip (AD-5)', () => {
    const flow = flowWithSeed(0xabc);
    flow.startMatch('wipeout');
    draftAndPlace(flow);
    flow.commit();
    const state = flow.getState();
    expect(JSON.parse(JSON.stringify(state)) as MatchState).toEqual(state);
  });
});

describe('MatchFlow recordResult — the SOLE history writer (story 3.1, FR28/AD-8/AD-13)', () => {
  const FIXED_ISO = '2026-07-15T12:00:00.000Z';

  /** A real gateway over a Map backend + a flow wired to it with a pinned clock. */
  function wiredFlow(seeds: number[]): { flow: MatchFlow; storage: WebStorage } {
    let i = 0;
    const map = new Map<string, string>();
    const storage = createStorage({
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
    });
    const flow = new MatchFlow(
      () => seeds[i++] as number,
      storage,
      () => FIXED_ISO,
    );
    return { flow, storage };
  }

  function playToResolve(flow: MatchFlow): void {
    draftAndPlaceAll(flow);
    flow.commit();
    flow.resolve();
  }

  it('writes exactly ONE entry per live match — the full committed MatchSetup, log winner, injected clock date (AC1)', () => {
    const { flow, storage } = wiredFlow([0xcafe]);
    flow.startMatch();
    playToResolve(flow);
    flow.recordResult();

    const history = storage.loadHistory();
    expect(history).toHaveLength(1);
    const entry = history[0] as HistoryEntry;
    expect(entry.setup).toEqual(flow.getState().committedSetup);
    expect(entry.date).toBe(FIXED_ISO);
    const ended = flow.resolve().events[flow.resolve().events.length - 1] as BattleEnded;
    expect(entry.winner).toBe(ended.winner);
  });

  it('is idempotent: double recordResult (Result-scene restart) never duplicates (AC1)', () => {
    const { flow, storage } = wiredFlow([0xcafe]);
    flow.startMatch();
    playToResolve(flow);
    flow.recordResult();
    flow.recordResult();
    flow.recordResult();
    expect(storage.loadHistory()).toHaveLength(1);
  });

  it('a rematch writes its OWN entry — startMatch resets the once-guard (AC1)', () => {
    const { flow, storage } = wiredFlow([100, 200]);
    flow.startMatch();
    playToResolve(flow);
    flow.recordResult();
    flow.startMatch(); // rematch
    playToResolve(flow);
    flow.recordResult();
    const history = storage.loadHistory();
    expect(history).toHaveLength(2);
    expect(history.map((e) => e.setup.seed)).toEqual([200, 100]); // newest first
  });

  it('throws before resolve — there is no verdict to record (guard style matches resolve())', () => {
    const { flow } = wiredFlow([5]);
    flow.startMatch();
    expect(() => flow.recordResult()).toThrow(/not resolved|resolve/i);
  });

  it('keeps MatchState JSON-serializable — the once-guard lives on the flow, not the state (AD-5)', () => {
    const { flow } = wiredFlow([0xaa]);
    flow.startMatch();
    playToResolve(flow);
    flow.recordResult();
    const state = flow.getState();
    expect(JSON.parse(JSON.stringify(state)) as MatchState).toEqual(state);
  });

  it('default construction still works with no storage injected (node no-op backend) — no throw, nothing persisted', () => {
    const flow = flowWithSeed(1);
    flow.startMatch();
    playToResolve(flow);
    expect(() => flow.recordResult()).not.toThrow();
  });
});

describe('MatchFlow replay mode (story 3.2, FR20/FR28, AD-8/AD-13)', () => {
  const FIXED_ISO = '2026-07-15T15:00:00.000Z';

  function wiredFlow(seeds: number[]): { flow: MatchFlow; storage: WebStorage; raw: Map<string, string> } {
    let i = 0;
    const raw = new Map<string, string>();
    const storage = createStorage({
      getItem: (key: string) => raw.get(key) ?? null,
      setItem: (key: string, value: string) => void raw.set(key, value),
    });
    const flow = new MatchFlow(
      () => seeds[i++] as number,
      storage,
      () => FIXED_ISO,
    );
    return { flow, storage, raw };
  }

  function playToRecorded(flow: MatchFlow): void {
    draftAndPlaceAll(flow);
    flow.commit();
    flow.resolve();
    flow.recordResult();
  }

  it('a replayed battle is BIT-IDENTICAL to the original live resolve (FR20 — the whole feature)', () => {
    const { flow, storage } = wiredFlow([0x5eed]);
    flow.startMatch();
    playToRecorded(flow);
    const liveLog = flow.resolve();

    const stored = storage.loadHistory()[0]!;
    const replayFlow = new MatchFlow(
      () => 0,
      storage,
      () => FIXED_ISO,
    );
    replayFlow.startReplay(stored.setup);
    expect(replayFlow.resolve().events).toEqual(liveLog.events);
  });

  it('replay writes NOTHING: history is byte-identical after a full replay incl. recordResult (AC2)', () => {
    const { flow, storage, raw } = wiredFlow([0x5eed]);
    flow.startMatch();
    playToRecorded(flow);
    const before = raw.get('lordly.v1.history');

    const replayFlow = new MatchFlow(
      () => 0,
      storage,
      () => FIXED_ISO,
    );
    replayFlow.startReplay(storage.loadHistory()[0]!.setup);
    replayFlow.resolve();
    replayFlow.recordResult(); // ResultScene calls this unconditionally — must no-op in replay
    replayFlow.recordResult();
    expect(raw.get('lordly.v1.history')).toBe(before);
    expect(storage.loadHistory()).toHaveLength(1);
  });

  it('Rematch after a replay is a LIVE match again: startMatch clears replay mode, fresh seed, records normally (AC2)', () => {
    const { flow, storage } = wiredFlow([111, 222]);
    flow.startMatch(); // consumes seed 111
    playToRecorded(flow);

    const replayFlow = new MatchFlow(
      () => 333,
      storage,
      () => FIXED_ISO,
    );
    replayFlow.startReplay(storage.loadHistory()[0]!.setup);
    replayFlow.resolve();
    replayFlow.recordResult(); // no-op (replay)

    replayFlow.startMatch(); // the Result screen's Rematch — flips to live
    expect(replayFlow.getState().seed).toBe(333); // fresh seed from ITS seedSource
    expect(replayFlow.getState().phase).toBe('draft');
    playToRecorded(replayFlow); // a real second match
    expect(storage.loadHistory()).toHaveLength(2);
  });

  it('startReplay hydrates committed state that resolves without commit(), and the state survives a JSON round-trip (AD-5)', () => {
    const { flow, storage } = wiredFlow([0x5eed]);
    flow.startMatch();
    playToRecorded(flow);
    const stored = storage.loadHistory()[0]!;

    const replayFlow = new MatchFlow(
      () => 0,
      storage,
      () => FIXED_ISO,
    );
    replayFlow.startReplay(stored.setup);
    const state = replayFlow.getState();
    expect(state.phase).toBe('committed');
    expect(state.committedSetup).toEqual(stored.setup);
    expect(state.mode).toBe(stored.setup.mode);
    expect(JSON.parse(JSON.stringify(state)) as MatchState).toEqual(state);
  });

  it('startReplay REJECTS a stale-balanceVersion setup (AD-8 — the flow-level backstop behind the UI gate)', () => {
    const { flow, storage } = wiredFlow([0x5eed]);
    flow.startMatch();
    playToRecorded(flow);
    const stale = { ...storage.loadHistory()[0]!.setup, balanceVersion: 1 };

    const replayFlow = new MatchFlow(
      () => 0,
      storage,
      () => FIXED_ISO,
    );
    expect(() => replayFlow.startReplay(stale)).toThrow(/balance/i);
  });
});

describe('MatchFlow rematch (AD-10)', () => {
  it('startMatch carries lastAiArchetypeId forward and rolls a FRESH seed', () => {
    const seeds = [11, 22];
    let i = 0;
    const flow = new MatchFlow(() => seeds[i++] as number);
    flow.startMatch();
    draftAndPlaceAll(flow);
    flow.commit();
    const firstAi = flow.getState().lastAiArchetypeId;

    flow.startMatch(); // rematch → fresh seed 22, carries lastAiArchetypeId as exclude
    expect(flow.getState().seed).toBe(22);
    expect(flow.getState().lastAiArchetypeId).toBe(firstAi);
    expect(flow.getState().playerArmy).toHaveLength(0);
    expect(flow.getState().phase).toBe('draft');
  });
});
