import { describe, expect, it } from 'vitest';
import { BALANCE, createStreams, rollElement, validateMatchSetup } from '@lordly/engine';
import { MatchFlow } from '../src/flow/MatchFlow';
import type { MatchState } from '../src/flow/MatchState';

/** A MatchFlow with a fixed seed so every draw is deterministic in tests. */
function flowWithSeed(seed: number): MatchFlow {
  return new MatchFlow(() => seed);
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
    flow.draftUnit('knight');
    flow.draftUnit('archer');
    flow.draftUnit('mage');
    flow.placeUnit(0, { row: 'front', col: 'center' });
    flow.placeUnit(1, { row: 'back', col: 'left' });
    flow.placeUnit(2, { row: 'back', col: 'right' });
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

  it('allows duplicates and caps the army at exactly 3', () => {
    const flow = flowWithSeed(7);
    flow.startMatch();
    flow.draftUnit('knight');
    flow.draftUnit('knight');
    flow.draftUnit('knight');
    expect(() => flow.draftUnit('knight')).toThrow(/army is full|exactly 3|full/i);
    expect(flow.getState().playerArmy).toHaveLength(3);
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

describe('MatchFlow commit (FR5/FR24, AD-6/AD-9/AD-11/AD-13)', () => {
  /** Draft + place a full legal player board so commit can assemble. */
  function readyToCommit(seed: number): MatchFlow {
    const flow = flowWithSeed(seed);
    flow.startMatch();
    flow.draftUnit('knight');
    flow.draftUnit('archer');
    flow.draftUnit('mage');
    flow.placeUnit(0, { row: 'front', col: 'center' });
    flow.placeUnit(1, { row: 'back', col: 'left' });
    flow.placeUnit(2, { row: 'back', col: 'right' });
    return flow;
  }

  it('assembles a MatchSetup that passes validateMatchSetup, human as side A (AD-11)', () => {
    const flow = readyToCommit(0xbeef);
    const setup = flow.commit();
    expect(() => validateMatchSetup(setup)).not.toThrow();
    expect(setup.mode).toBe('single');
    expect(setup.balanceVersion).toBe(BALANCE.version);
    expect(setup.armies.A.map((u) => u.class)).toEqual(['knight', 'archer', 'mage']);
    expect(setup.armies.B).toHaveLength(BALANCE.armySize);
    expect(setup.placements.A).toEqual([
      { row: 'front', col: 'center' },
      { row: 'back', col: 'left' },
      { row: 'back', col: 'right' },
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
    other.placeUnit(0, { row: 'back', col: 'left' });
    other.placeUnit(1, { row: 'back', col: 'center' });
    other.placeUnit(2, { row: 'back', col: 'right' });
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
    flow.placeUnit(0, { row: 'front', col: 'center' });
    // only 1 of 3 placed
    expect(() => flow.commit()).toThrow(/place all 3|incomplete|not placed/i);
    // The count in the message is DERIVED from BALANCE.armySize, never hardcoded —
    // a drifted literal is the exact class of bug the models avoid.
    expect(() => flow.commit()).toThrow(new RegExp(`place all ${BALANCE.armySize} units`));
  });

  it('is idempotent: a second commit returns the SAME board, never re-deriving a different AI', () => {
    const flow = readyToCommit(0xd00d);
    const first = flow.commit();
    const second = flow.commit();
    expect(second).toBe(first); // same object — no re-pick
    expect(flow.getState().committedSetup).toBe(first);
  });

  it('rejects draft/remove/place after commit — the board is locked (phase guard)', () => {
    const flow = readyToCommit(0xf00d);
    flow.commit();
    expect(() => flow.draftUnit('witch')).toThrow(/already committed/i);
    expect(() => flow.removeUnit(0)).toThrow(/already committed/i);
    expect(() => flow.placeUnit(0, { row: 'mid', col: 'center' })).toThrow(/already committed/i);
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
});

describe('MatchFlow resolve (AD-2/AD-13)', () => {
  /** Draft + place a full legal board, then commit — ready to resolve. */
  function committed(seed: number): MatchFlow {
    const flow = flowWithSeed(seed);
    flow.startMatch();
    flow.draftUnit('knight');
    flow.draftUnit('archer');
    flow.draftUnit('mage');
    flow.placeUnit(0, { row: 'front', col: 'center' });
    flow.placeUnit(1, { row: 'back', col: 'left' });
    flow.placeUnit(2, { row: 'back', col: 'right' });
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
      f.draftUnit('knight');
      f.draftUnit('archer');
      f.draftUnit('mage');
      f.placeUnit(0, { row: 'front', col: 'center' });
      f.placeUnit(1, { row: 'back', col: 'left' });
      f.placeUnit(2, { row: 'back', col: 'right' });
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
    flow.draftUnit('knight');
    flow.draftUnit('archer');
    flow.draftUnit('mage');
    flow.placeUnit(0, { row: 'front', col: 'center' });
    flow.placeUnit(1, { row: 'back', col: 'left' });
    flow.placeUnit(2, { row: 'back', col: 'right' });
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

describe('MatchFlow rematch (AD-10)', () => {
  it('startMatch carries lastAiArchetypeId forward and rolls a FRESH seed', () => {
    const seeds = [11, 22];
    let i = 0;
    const flow = new MatchFlow(() => seeds[i++] as number);
    flow.startMatch();
    flow.draftUnit('knight');
    flow.draftUnit('archer');
    flow.draftUnit('mage');
    flow.placeUnit(0, { row: 'front', col: 'center' });
    flow.placeUnit(1, { row: 'back', col: 'left' });
    flow.placeUnit(2, { row: 'back', col: 'right' });
    flow.commit();
    const firstAi = flow.getState().lastAiArchetypeId;

    flow.startMatch(); // rematch → fresh seed 22, carries lastAiArchetypeId as exclude
    expect(flow.getState().seed).toBe(22);
    expect(flow.getState().lastAiArchetypeId).toBe(firstAi);
    expect(flow.getState().playerArmy).toHaveLength(0);
    expect(flow.getState().phase).toBe('draft');
  });
});
