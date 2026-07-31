import { describe, expect, it } from 'vitest';
import { BATTLE_BACKGROUNDS, BATTLE_HUD_BAND_H, backgroundKeyForSeed, HUD_SCRIM_ALPHA, REVEAL_HUD_BAND_H, TERRAIN_DIM_ALPHA } from '../src/config/constants';
import { MatchFlow } from '../src/flow/MatchFlow';

/**
 * Story 5.3 — the battle terrain's DETERMINISTIC selection rule.
 *
 * A background is presentation, never engine data: it is derived from the
 * match seed at render time so a REPLAY (which restores the stored setup, seed
 * included) paints the same terrain the original battle was fought on.
 * `Math.random` would silently swap the scenery on replay — the reason this
 * rule exists (agreed 2026-07-27, deferred-work.md).
 */

/** A MatchFlow with a fixed seed so every draw is deterministic (match-flow.test.ts precedent). */
function flowWithSeed(seed: number): MatchFlow {
  return new MatchFlow(() => seed);
}

function draftPlaceAndCrown(flow: MatchFlow): void {
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
  flow.setLeader(0);
}

describe('BATTLE_BACKGROUNDS manifest (story 5.3)', () => {
  it('ships at least two biomes (AC 1)', () => {
    expect(BATTLE_BACKGROUNDS.length).toBeGreaterThanOrEqual(2);
  });

  it('has no duplicate texture keys — a repeat would silently skew the rotation', () => {
    expect(new Set(BATTLE_BACKGROUNDS).size).toBe(BATTLE_BACKGROUNDS.length);
  });

  it('is FROZEN: growing or reordering it re-skins every stored replay, so it cannot happen by accident', () => {
    // The pick is `seed % length`. Appending a third biome changes the terrain
    // for two-thirds of existing seeds, so a history entry would replay on
    // different ground than the match it recorded — the exact guarantee the
    // seed rule provides (5.3 review, 2026-08-01: the manifest's own doc used
    // to advertise "adding art is ONE line" with no mention of this).
    // Changing this list is allowed — it just has to be a DECISION: read the
    // constant's comment, pick re-skin-old-replays or persist-the-key, then
    // update this pin.
    expect([...BATTLE_BACKGROUNDS]).toEqual(['terrain-castle', 'terrain-plains']);
  });
});

describe('backgroundKeyForSeed (story 5.3) — deterministic, total, and replay-stable', () => {
  it('always returns a key from the manifest', () => {
    for (const seed of [0, 1, 2, 7, 42, 1023, 0xffffffff]) {
      expect(BATTLE_BACKGROUNDS, `seed ${seed}`).toContain(backgroundKeyForSeed(seed));
    }
  });

  it('is a STABLE function of the seed alone — interleaving other seeds cannot change an answer', () => {
    // Re-cut at the 5.3 review (2026-08-01): the old version asserted
    // `f(seed) === f(seed)` twice in one process, which ANY function passes,
    // including one reading mutable state — while claiming to be "what makes a
    // replay honest". The real property is that nothing accumulates between
    // calls, so pin the answers, churn the function with unrelated seeds, and
    // demand the originals still hold.
    const probes = [0, 3, 99, 123456789];
    const first = probes.map(backgroundKeyForSeed);
    for (let i = 0; i < 50; i += 1) backgroundKeyForSeed(i * 7919);
    expect(probes.map(backgroundKeyForSeed)).toEqual(first);
    // …and the mapping is the documented arithmetic, not an accident.
    for (const seed of probes) {
      expect(backgroundKeyForSeed(seed)).toBe(BATTLE_BACKGROUNDS[(seed >>> 0) % BATTLE_BACKGROUNDS.length]);
    }
  });

  it('reaches every biome across consecutive seeds (the rotation is a rotation, not a constant)', () => {
    const seen = new Set(Array.from({ length: BATTLE_BACKGROUNDS.length * 4 }, (_, i) => backgroundKeyForSeed(i)));
    expect(seen.size).toBe(BATTLE_BACKGROUNDS.length);
  });

  it('is total over the uint32 seed space the engine actually produces (AD-10)', () => {
    // Guards against a negative/NaN index if the modulo input is ever widened.
    for (const seed of [0, 0x7fffffff, 0x80000000, 0xffffffff]) {
      expect(typeof backgroundKeyForSeed(seed)).toBe('string');
      expect(backgroundKeyForSeed(seed).length).toBeGreaterThan(0);
    }
  });
});

describe('terrain survives a replay (story 5.3, the whole point of the seed rule)', () => {
  it('a replayed setup paints the same terrain as the original match', () => {
    const flow = flowWithSeed(12345);
    flow.startMatch('single');
    draftPlaceAndCrown(flow);
    const setup = flow.commit();
    const original = backgroundKeyForSeed(flow.getState().seed);

    // A fresh flow replaying the STORED setup (the History → Replay path).
    const replayed = new MatchFlow(() => 999999); // a different live-seed source on purpose
    replayed.startReplay(setup);
    expect(backgroundKeyForSeed(replayed.getState().seed)).toBe(original);
  });

  it('state.seed and committedSetup.seed agree on BOTH paths — so either source picks the same terrain', () => {
    // The scenes read state.seed; this pins the equivalence that makes that safe.
    const live = flowWithSeed(777);
    live.startMatch('single');
    draftPlaceAndCrown(live);
    const setup = live.commit();
    expect(live.getState().seed).toBe(live.getState().committedSetup?.seed);
    expect(live.getState().seed).toBe(setup.seed);

    const replay = new MatchFlow(() => 111);
    replay.startReplay(setup);
    expect(replay.getState().seed).toBe(replay.getState().committedSetup?.seed);
    expect(replay.getState().seed).toBe(setup.seed);
  });

  it('the terrain is per-MATCH, not per-engagement: a wipeout run never changes seed mid-battle', () => {
    const flow = flowWithSeed(24680);
    flow.startMatch('wipeout');
    draftPlaceAndCrown(flow);
    flow.commit();
    const before = backgroundKeyForSeed(flow.getState().seed);
    // Resolving the whole (multi-engagement) battle must not disturb the seed.
    flow.resolve();
    expect(backgroundKeyForSeed(flow.getState().seed)).toBe(before);
  });

  it('a fresh match may roll different terrain (the rotation is seed-driven, not sticky)', () => {
    // Two seeds that land on different manifest slots by construction.
    const a = backgroundKeyForSeed(0);
    const b = backgroundKeyForSeed(1);
    expect(a).not.toBe(b);
  });
});

describe('terrain legibility treatment (story 5.3, AC 2 / FR39f)', () => {
  it('dims the art enough to matter but keeps it clearly visible', () => {
    // The two shipped biomes bracket the brightness range (dark castle
    // courtyard vs bright plains), and every overlay in Battle is tuned for a
    // dark ground — so the dim is load-bearing, not decoration. It must not
    // swing to either useless extreme.
    expect(TERRAIN_DIM_ALPHA).toBeGreaterThan(0.2); // below this the plains washes the HUD out
    expect(TERRAIN_DIM_ALPHA).toBeLessThan(0.7); // above this the terrain stops reading as terrain
  });

  it('the HUD scrim adds contrast on TOP of the dim, and both bands cover their labels', () => {
    expect(HUD_SCRIM_ALPHA).toBeGreaterThan(0);
    expect(HUD_SCRIM_ALPHA).toBeLessThan(1);
    // Battle: passLabel y=22, enemyLabel y=56. Reveal: title 26, hint 52, enemy label 70.
    expect(BATTLE_HUD_BAND_H).toBeGreaterThan(56);
    expect(REVEAL_HUD_BAND_H).toBeGreaterThan(70);
  });
});
