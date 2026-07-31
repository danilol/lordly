import { describe, expect, it } from 'vitest';
import { BALANCE, resolveBattle, slotTotal } from '@lordly/engine';
import type { BattleStarted, MatchSetup, Side } from '@lordly/engine';
import { MatchFlow } from '../src/flow/MatchFlow';

/**
 * Story 5.8 AC1 — the contract RevealScene now depends on.
 *
 * Reveal stopped resolving the battle just to read its roster (the AD-13
 * "double resolution" the spine forbids). It renders straight off
 * `committedSetup` instead: `armies[side][i]` for class/name/element,
 * `placements[side][i]` for the tile, and `i === leaders[side]` for the crown.
 *
 * That only stays correct while the ENGINE keeps building `BattleStarted.units`
 * the same way — all of A then all of B, in army-index order, ids
 * `` `${side}:${index}` ``, placements passed through unchanged. Nothing pinned
 * that before; if the engine ever re-ordered the roster or renumbered ids, the
 * battle would be right and Reveal would silently draw the wrong board (the
 * leader crown on the wrong unit is the sharpest symptom).
 *
 * So this file pins the CONTRACT, not a copy of the builder — there is no
 * shell-side snapshot to keep in sync (the story rejected that shape: it would
 * have forced the renderer to compute `hp` from BALANCE for a field Reveal
 * never draws).
 *
 * Fixtures go through the real `commit()` path deliberately. A hand-built
 * MatchSetup would make the placement assertion vacuous, since `toAnchor` is
 * currently an identity passthrough — the normalization has to actually run.
 */

/** A committed flow on a fixed seed: five smalls, every cell placed, a crown set. */
function committedSmalls(seed: number): MatchSetup {
  const flow = new MatchFlow(() => seed);
  flow.startMatch();
  flow.draftUnit('knight');
  flow.draftUnit('archer');
  flow.draftUnit('mage');
  flow.draftUnit('cleric');
  flow.draftUnit('witch');
  // Deliberately NOT left-right symmetric: a mirrored id convention would pass
  // a symmetric fixture (the chirality lesson — mirror bugs survive symmetric
  // acceptance tests).
  flow.placeUnit(0, { row: 'front', col: 'center' });
  flow.placeUnit(1, { row: 'back', col: 'left' });
  flow.placeUnit(2, { row: 'back', col: 'right' });
  flow.placeUnit(3, { row: 'mid', col: 'center' });
  flow.placeUnit(4, { row: 'front', col: 'left' });
  flow.setLeader(3); // NOT index 0 — an off-by-default crown catches a hardcoded first-unit assumption
  return flow.commit();
}

/**
 * A committed flow carrying a MONSTER (2 slots + 3 smalls = the budget of 5).
 * The monster's king-move reservation (validate.ts) forbids any unit in its 8
 * neighbours, so the smalls go on the back row while the golem holds front-left.
 */
function committedWithMonster(seed: number): MatchSetup {
  const flow = new MatchFlow(() => seed);
  flow.startMatch();
  flow.draftUnit('golem');
  flow.draftUnit('knight');
  flow.draftUnit('archer');
  flow.draftUnit('cleric');
  flow.placeUnit(0, { row: 'front', col: 'left' });
  flow.placeUnit(1, { row: 'back', col: 'left' });
  flow.placeUnit(2, { row: 'back', col: 'center' });
  flow.placeUnit(3, { row: 'back', col: 'right' });
  flow.setLeader(1); // humans-only crown (E5-D13) — the golem cannot be leader
  return flow.commit();
}

const SIDES: readonly Side[] = ['A', 'B'];

describe('the BattleStarted roster contract RevealScene renders off (story 5.8 AC1)', () => {
  for (const [label, build] of [
    ['five smalls', committedSmalls],
    ['a monster comp (golem + 3 smalls)', committedWithMonster],
  ] as const) {
    it(`${label}: roster order is all of A then all of B, in army-index order`, () => {
      const setup = build(0xbeef);
      const units = (resolveBattle(setup).events[0] as BattleStarted).units;
      const expected = SIDES.flatMap((side) => setup.armies[side].map((_, i) => `${side}:${i}`));
      expect(units.map((u) => u.id)).toEqual(expected);
      // …and the side field agrees with the id's own prefix (a renumbering that
      // kept the count would still be caught here).
      for (const u of units) expect(u.id.startsWith(`${u.side}:`), u.id).toBe(true);
    });

    it(`${label}: every field Reveal draws comes from the setup at the SAME index`, () => {
      const setup = build(0xbeef);
      const units = (resolveBattle(setup).events[0] as BattleStarted).units;
      for (const side of SIDES) {
        setup.armies[side].forEach((unit, i) => {
          const snap = units.find((u) => u.id === `${side}:${i}`)!;
          expect(snap, `${side}:${i} must exist`).toBeDefined();
          // The four static facts Reveal reads (AD-2's static-facts channel).
          expect(snap.class).toBe(unit.class);
          expect(snap.name).toBe(unit.name);
          expect(snap.element).toBe(unit.element);
          // The tile. Deep equality, not identity — Reveal passes the setup's
          // own placement object to unitTileCenter, so a normalization that
          // diverged from the stored anchor would move units on the board.
          expect(snap.placement).toEqual(setup.placements[side][i]);
        });
      }
    });
  }

  it('the ENGINE agrees who the leader is: every LeaderFell names exactly `side:leaders[side]` — both sides exercised', () => {
    // Re-cut at the 5.8 review: the first version only found-by-id an in-range
    // index, which the order test above already guarantees — a tautology. The
    // thing that can actually drift is the ENGINE's interpretation of
    // `leaders[side]` (e.g. a refactor re-basing it onto a sorted order would
    // keep every structural assertion green while Reveal and Battle crown the
    // wrong soldier). `LeaderFell` carries side + unit, so battles where a
    // leader dies are the cross-check: the fallen unit's id must be the same
    // `${side}:${index}` the scenes derive their crowns from.
    const seen = { A: 0, B: 0 };
    for (const seed of Array.from({ length: 30 }, (_, i) => i + 1)) {
      const setup = committedSmalls(seed);
      for (const e of resolveBattle(setup).events) {
        if (e.type !== 'LeaderFell') continue;
        seen[e.side] += 1;
        expect(e.unit, `seed ${seed}, side ${e.side}`).toBe(`${e.side}:${setup.leaders[e.side]}`);
      }
    }
    // Fixture guards (probed 2026-08-01: seeds 9/21/22/26 fell B's leader,
    // seed 28 fell A's — re-probe if the balance data shifts these): the sweep
    // must exercise BOTH sides, or a side-mirrored leader bug hides. A's crown
    // is index 3 in the fixture, so `A:3` here also proves the non-default
    // index survives the whole commit→resolve pipeline.
    expect(seen.A, 'no seed felled the PLAYER leader — re-probe the sweep range').toBeGreaterThan(0);
    expect(seen.B, 'no seed felled the AI leader — re-probe the sweep range').toBeGreaterThan(0);
  });

  it('the monster fixture really carries a monster and really fills the slot budget', () => {
    // A fixture guard: if the roster data ever changes so `golem` stops being a
    // 2-slot monster, the loom-sensitive geometry this story pins would be
    // silently tested against a small unit instead.
    const setup = committedWithMonster(0xbeef);
    expect(BALANCE.classes.golem.sizeClass).toBe('monster');
    expect(slotTotal(setup.armies.A)).toBe(BALANCE.slotBudget);
    expect(setup.armies.A).toHaveLength(4); // 4 units, 5 slots — army.length is never the legality measure (AD-1)
  });
});
