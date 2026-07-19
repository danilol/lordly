import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import { InvalidMatchSetupError } from '../src/validate';
import { LOG_VERSION } from '../src/types';
import type { MatchSetup, Unit, UnitId } from '../src/types';
import { matchSetupArb } from './arbitraries';

/** Names for fixture armies (flavor only — FR37 requires non-empty). */
const NAMES = ['Kain', 'Lyra', 'Magnus', 'Sela', 'Brand', 'Morwen', 'Ithil', 'Dario', 'Vess', 'Rowena'];

/** Build a named army from bare class/element pairs (fixture sugar, story 4.2). */
function army(units: readonly { class: Unit['class']; element: Unit['element'] }[], offset = 0): Unit[] {
  return units.map((u, i) => ({ ...u, name: NAMES[(offset + i) % NAMES.length] as string }));
}

/** Build a setup with explicit armies/placements; other fields sane 4.2 defaults. */
function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, seed = 7): MatchSetup {
  return {
    seed,
    balanceVersion: BALANCE.version,
    mode: 'single',
    tactics: { A: 'autonomous', B: 'autonomous' },
    leaders: { A: 0, B: 0 },
    ...partial,
  };
}

/**
 * The ordered actor ids of every taken turn, grouped by pass. A turn's FIRST
 * event identifies the actor: `ActionSkipped`/`ActionFizzled`/`ActionMisfired`
 * or an effect event (`UnitAttacked`/`UnitHealed`/`StatusApplied`). An effect
 * event immediately following an `ActionMisfired` for the same actor is that
 * SAME turn's redirect, not a new turn (marker + effect pair — story 1.6).
 */
function turnsByPass(log: ReturnType<typeof resolveBattle>): UnitId[][] {
  const passes: UnitId[][] = [];
  let misfiredActor: UnitId | undefined;
  for (const e of log.events) {
    if (e.type === 'PassStarted') {
      passes.push([]);
      misfiredActor = undefined;
      continue;
    }
    const actor =
      e.type === 'ActionSkipped' || e.type === 'ActionFizzled' || e.type === 'ActionMisfired'
        ? e.unit
        : e.type === 'UnitAttacked' || e.type === 'UnitHealed' || e.type === 'StatusApplied'
          ? e.source
          : undefined;
    if (actor === undefined) continue;
    if (misfiredActor !== undefined && actor === misfiredActor && e.type !== 'ActionMisfired') {
      misfiredActor = undefined; // the redirect effect of the marked misfire
      continue;
    }
    passes[passes.length - 1]?.push(actor);
    misfiredActor = e.type === 'ActionMisfired' ? e.unit : undefined;
  }
  return passes;
}

describe('resolveBattle chassis (FR13, FR17, AD-1, AD-12)', () => {
  it('emits the envelope in order: BattleStarted first, BattleEnded last, one engagement', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: army([
            { class: 'witch', element: 'fire' },
            { class: 'archer', element: 'water' },
            { class: 'knight', element: 'wind' },
            { class: 'cleric', element: 'earth' },
            { class: 'knight', element: 'fire' },
          ]),
          B: army(
            [
              { class: 'mercenary', element: 'earth' },
              { class: 'mage', element: 'fire' },
              { class: 'cleric', element: 'water' },
              { class: 'archer', element: 'wind' },
              { class: 'knight', element: 'earth' },
            ],
            5,
          ),
        },
        placements: {
          A: [
            { row: 'back', col: 'left' },
            { row: 'mid', col: 'center' },
            { row: 'front', col: 'right' },
            { row: 'back', col: 'center' },
            { row: 'front', col: 'left' },
          ],
          B: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'left' },
            { row: 'front', col: 'center' },
          ],
        },
      }),
    );

    expect(log.logVersion).toBe(LOG_VERSION);
    expect(log.events[0]?.type).toBe('BattleStarted');
    expect(log.events[log.events.length - 1]?.type).toBe('BattleEnded');
    expect(log.events.filter((e) => e.type === 'EngagementEnded')).toHaveLength(1);
    const ended = log.events[log.events.length - 1];
    if (ended?.type === 'BattleEnded') {
      expect(['A', 'B', 'draw']).toContain(ended.winner);
      expect(ended.hpPct.A).toBeGreaterThanOrEqual(0);
      expect(ended.hpPct.B).toBeGreaterThanOrEqual(0);
    }
  });

  it('BattleStarted carries the full roster with ids, names, hp, and placements (AD-2)', () => {
    const s = setup({
      armies: {
        A: army([
          { class: 'knight', element: 'fire' },
          { class: 'mage', element: 'water' },
          { class: 'cleric', element: 'wind' },
          { class: 'archer', element: 'earth' },
          { class: 'mercenary', element: 'fire' },
        ]),
        B: army(
          [
            { class: 'witch', element: 'earth' },
            { class: 'archer', element: 'fire' },
            { class: 'mercenary', element: 'water' },
            { class: 'knight', element: 'wind' },
            { class: 'cleric', element: 'earth' },
          ],
          5,
        ),
      },
      placements: {
        A: [
          { row: 'front', col: 'left' },
          { row: 'back', col: 'center' },
          { row: 'back', col: 'right' },
          { row: 'mid', col: 'center' },
          { row: 'front', col: 'right' },
        ],
        B: [
          { row: 'back', col: 'left' },
          { row: 'mid', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'front', col: 'center' },
          { row: 'back', col: 'right' },
        ],
      },
    });
    const started = resolveBattle(s).events[0];
    expect(started?.type).toBe('BattleStarted');
    if (started?.type === 'BattleStarted') {
      expect(started.units).toHaveLength(10);
      const a0 = started.units.find((u) => u.id === 'A:0');
      expect(a0).toEqual({
        id: 'A:0',
        side: 'A',
        class: 'knight',
        element: 'fire',
        name: 'Kain',
        placement: { row: 'front', col: 'left' },
        hp: 140,
        maxHp: 140,
      });
    }
  });

  it('orders a pass by descending AGI across both armies (FR13)', () => {
    // Ten units, NO exact cross-side tie (same AGI + same cell never occurs),
    // so the order is flip-independent. AGI: witch 26 > archer 22 > merc 14 >
    // mage 12 > cleric 10 > knight 8; equal-AGI cross-side pairs are split by
    // row (front-most first), hand-ordered below.
    const log = resolveBattle(
      setup({
        armies: {
          A: army([
            { class: 'witch', element: 'water' }, // 26, back L
            { class: 'archer', element: 'water' }, // 22, back C
            { class: 'knight', element: 'wind' }, // 8, back R
            { class: 'mage', element: 'fire' }, // 12, mid L
            { class: 'cleric', element: 'earth' }, // 10, mid C
          ]),
          B: army(
            [
              { class: 'mercenary', element: 'earth' }, // 14, back L
              { class: 'mage', element: 'fire' }, // 12, back C
              { class: 'cleric', element: 'water' }, // 10, back R
              { class: 'knight', element: 'wind' }, // 8, mid L
              { class: 'archer', element: 'fire' }, // 22, mid C
            ],
            5,
          ),
        },
        placements: {
          A: [
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'left' },
            { row: 'mid', col: 'center' },
          ],
          B: [
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'left' },
            { row: 'mid', col: 'center' },
          ],
        },
      }),
    );
    // Hand-ordered: 26 A:0 → 22 B:4 (mid) before A:1 (back) → 14 B:0 →
    // 12 A:3 (mid) before B:1 (back) → 10 A:4 (mid) before B:2 (back) →
    // 8 B:3 (mid) before A:2 (back).
    const pass1 = turnsByPass(log)[0];
    expect(pass1).toEqual(['A:0', 'B:4', 'A:1', 'B:0', 'A:3', 'B:1', 'A:4', 'B:2', 'B:3', 'A:2']);
  });

  it('breaks equal-AGI ties front row before back, then left before right (FR13)', () => {
    // Five same-side knights vs five water witches (no shared AGI across
    // sides). Same-side order is purely row → col.
    const log = resolveBattle(
      setup({
        armies: {
          A: army([
            { class: 'knight', element: 'fire' }, // back R
            { class: 'knight', element: 'water' }, // front R
            { class: 'knight', element: 'wind' }, // front L
            { class: 'knight', element: 'earth' }, // mid C
            { class: 'knight', element: 'fire' }, // back L
          ]),
          B: army(
            [
              { class: 'witch', element: 'water' }, // mid C
              { class: 'witch', element: 'water' }, // mid L
              { class: 'witch', element: 'water' }, // back L
              { class: 'witch', element: 'water' }, // back R
              { class: 'witch', element: 'water' }, // mid R
            ],
            5,
          ),
        },
        placements: {
          A: [
            { row: 'back', col: 'right' }, // A:0
            { row: 'front', col: 'right' }, // A:1
            { row: 'front', col: 'left' }, // A:2
            { row: 'mid', col: 'center' }, // A:3
            { row: 'back', col: 'left' }, // A:4
          ],
          B: [
            { row: 'mid', col: 'center' }, // B:0
            { row: 'mid', col: 'left' }, // B:1
            { row: 'back', col: 'left' }, // B:2
            { row: 'back', col: 'right' }, // B:3
            { row: 'mid', col: 'right' }, // B:4
          ],
        },
      }),
    );
    const pass1 = turnsByPass(log)[0] ?? [];
    // Witches (AGI 26) first: mid L, mid C, mid R, back L, back R → B:1, B:0, B:4, B:2, B:3
    // Knights (AGI 8): front L, front R, mid C, back L, back R → A:2, A:1, A:3, A:4, A:0
    expect(pass1.slice(0, 5)).toEqual(['B:1', 'B:0', 'B:4', 'B:2', 'B:3']);
    expect(pass1.slice(-5)).toEqual(['A:2', 'A:1', 'A:3', 'A:4', 'A:0']);
  });

  it('resolves exact cross-side ties with the per-engagement coin flip, both ways (FR13)', () => {
    // Mirror setup: same class, same row, same col on both sides — only the
    // flip orders them. The archers (AGI 22, the army's fastest) act first.
    const mirror = (seed: number) =>
      resolveBattle(
        setup(
          {
            armies: {
              A: army([
                { class: 'knight', element: 'fire' },
                { class: 'archer', element: 'water' },
                { class: 'mage', element: 'wind' },
                { class: 'mercenary', element: 'earth' },
                { class: 'cleric', element: 'fire' },
              ]),
              B: army(
                [
                  { class: 'knight', element: 'earth' },
                  { class: 'archer', element: 'fire' },
                  { class: 'mage', element: 'water' },
                  { class: 'mercenary', element: 'wind' },
                  { class: 'cleric', element: 'water' },
                ],
                5,
              ),
            },
            placements: {
              A: [
                { row: 'front', col: 'left' },
                { row: 'mid', col: 'center' },
                { row: 'back', col: 'right' },
                { row: 'front', col: 'right' },
                { row: 'back', col: 'left' },
              ],
              B: [
                { row: 'front', col: 'left' },
                { row: 'mid', col: 'center' },
                { row: 'back', col: 'right' },
                { row: 'front', col: 'right' },
                { row: 'back', col: 'left' },
              ],
            },
          },
          seed,
        ),
      );
    const firstActor = (seed: number) => turnsByPass(mirror(seed))[0]?.[0];
    // The engagement tie flip is the battle stream's FIRST draw — its
    // consumption is unchanged by 4.2 (armies don't touch the battle stream
    // before it), so the 3-unit-era probe holds: seeds 1..20 produce both
    // outcomes (probe pattern 00000010111101011011; seed 1 → A, seed 7 → B).
    const outcomes = new Set(Array.from({ length: 20 }, (_, i) => firstActor(i + 1)));
    expect(outcomes).toEqual(new Set(['A:1', 'B:1'])); // both sides reachable; archers first either way
    expect(firstActor(1)).toBe('A:1');
    expect(firstActor(7)).toBe('B:1');
  });

  it('splits multihit across passes: 2-action front knight acts once per pass (FR13)', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: army([
            { class: 'knight', element: 'fire' }, // front: 2 actions
            { class: 'knight', element: 'water' }, // back: 1 action
            { class: 'cleric', element: 'wind' }, // back: 2 actions
            { class: 'archer', element: 'earth' }, // mid: 2 actions
            { class: 'mage', element: 'fire' }, // front: 1 action
          ]),
          B: army(
            [
              { class: 'mercenary', element: 'earth' }, // front: 2 actions
              { class: 'mercenary', element: 'fire' }, // back: 1
              { class: 'witch', element: 'water' }, // back: 2
              { class: 'archer', element: 'wind' }, // mid: 2
              { class: 'cleric', element: 'water' }, // front: 1
            ],
            5,
          ),
        },
        placements: {
          A: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'left' },
            { row: 'front', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'left' },
            { row: 'front', col: 'center' },
          ],
        },
      }),
    );
    const passes = turnsByPass(log);
    expect(passes).toHaveLength(2); // max budget is 2
    // Every unit acts at most once per pass:
    for (const pass of passes) {
      expect(new Set(pass).size).toBe(pass.length);
    }
    // 2-action units act in both passes; 1-action units only in pass 1.
    const countTurns = (id: UnitId) => passes.flat().filter((u) => u === id).length;
    expect(countTurns('A:0')).toBe(2);
    expect(countTurns('A:1')).toBe(1);
    expect(countTurns('A:2')).toBe(2);
    expect(countTurns('A:4')).toBe(1);
    expect(countTurns('B:1')).toBe(1);
    expect(passes[1]).not.toContain('A:1');
    expect(passes[1]).not.toContain('B:4');
  });

  it('turn counts equal each unit’s row action budget (FR15/FR17)', () => {
    // Both armies are all clerics — the least-lethal class (they heal allies,
    // and their staff chip is tiny) — so NOBODY dies within the engagement and
    // every unit spends its full row budget. This survives FR9 global range:
    // the earlier archer/mage setup relied on reach to keep snipers off each
    // other, which global range dissolves; all-clerics needs no reach trick.
    // Turn count per unit therefore equals its row action budget (cleric 1/1/2).
    const log = resolveBattle(
      setup({
        armies: {
          A: army([
            { class: 'cleric', element: 'fire' }, // front L: 1
            { class: 'cleric', element: 'water' }, // mid L: 1
            { class: 'cleric', element: 'wind' }, // back R: 2
            { class: 'cleric', element: 'earth' }, // mid C: 1
            { class: 'cleric', element: 'fire' }, // back C: 2
          ]),
          B: army(
            [
              { class: 'cleric', element: 'earth' }, // front C: 1
              { class: 'cleric', element: 'fire' }, // mid C: 1
              { class: 'cleric', element: 'water' }, // back L: 2
              { class: 'cleric', element: 'wind' }, // mid L: 1
              { class: 'cleric', element: 'earth' }, // mid R: 1
            ],
            5,
          ),
        },
        placements: {
          A: [
            { row: 'front', col: 'left' },
            { row: 'mid', col: 'left' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'center' },
            { row: 'back', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'center' },
            { row: 'back', col: 'left' },
            { row: 'mid', col: 'left' },
            { row: 'mid', col: 'right' },
          ],
        },
      }),
    );
    const all = turnsByPass(log).flat();
    const count = (id: UnitId) => all.filter((u) => u === id).length;
    expect(count('A:0')).toBe(1); // front cleric
    expect(count('A:1')).toBe(1); // mid cleric
    expect(count('A:2')).toBe(2); // back cleric
    expect(count('A:3')).toBe(1); // mid cleric
    expect(count('A:4')).toBe(2); // back cleric
    expect(count('B:0')).toBe(1); // front cleric
    expect(count('B:1')).toBe(1); // mid cleric
    expect(count('B:2')).toBe(2); // back cleric
    expect(count('B:3')).toBe(1); // mid cleric
    expect(count('B:4')).toBe(1); // mid cleric
    expect(log.events.filter((e) => e.type === 'UnitDied')).toHaveLength(0); // the no-death premise
  });

  it('throws InvalidMatchSetupError for malformed input (AC2 wiring)', () => {
    const s = setup({
      armies: { A: [], B: [] },
      placements: { A: [], B: [] },
    });
    expect(() => resolveBattle(s)).toThrow(InvalidMatchSetupError);
  });
});

describe('chassis properties (NFR2, FR20)', () => {
  test.prop([matchSetupArb])('terminates with a bounded, well-formed log', (s) => {
    const log = resolveBattle(s);
    // Per-engagement ceiling (10 units since 4.2): passes(≤2) + turns(≤ 10
    // units × 2 actions, each ≤2 events: misfire marker + effect) + poison
    // ticks(≤10 — poisoned units tick at EVERY natural engagement end) +
    // StatusCleared(≤30 — at most 3 non-poison statuses per living unit shed
    // at the seam) + 1 EngagementEnded = 73. Deaths are BATTLE-wide (a unit
    // dies once): ≤10 UnitDied total. Single mode runs one engagement;
    // wipeout is bounded by BALANCE.engagementCap (its termination
    // guarantee). BattleStarted/BattleEnded bookend once.
    const engagements = s.mode === 'wipeout' ? BALANCE.engagementCap : 1;
    expect(log.events.length).toBeLessThanOrEqual(1 + engagements * (2 + 40 + 10 + 30 + 1) + 10 + 1);
    expect(log.events.filter((e) => e.type === 'UnitDied').length).toBeLessThanOrEqual(10);
    expect(log.events[0]?.type).toBe('BattleStarted');
    expect(log.events[log.events.length - 1]?.type).toBe('BattleEnded');
  });

  test.prop([matchSetupArb])('seed identity: same setup → bit-identical log (FR20)', (s) => {
    expect(resolveBattle(s)).toEqual(resolveBattle(s));
  });

  test.prop([matchSetupArb])('never mutates its input (AD-1)', (s) => {
    const before = structuredClone(s);
    resolveBattle(s);
    expect(s).toEqual(before);
  });

  it('returns a DEEP-frozen log — nested event fields cannot be mutated (AD-1/AD-2)', () => {
    const [s] = fc.sample(matchSetupArb, { numRuns: 1, seed: 42 });
    const log = resolveBattle(s as MatchSetup);
    expect(Object.isFrozen(log)).toBe(true);
    expect(Object.isFrozen(log.events)).toBe(true);

    const started = log.events[0];
    expect(started?.type).toBe('BattleStarted');
    if (started?.type === 'BattleStarted') {
      expect(Object.isFrozen(started)).toBe(true);
      expect(Object.isFrozen(started.units)).toBe(true);
      expect(Object.isFrozen(started.units[0])).toBe(true);
      const before = started.units[0]?.hp;
      try {
        (started.units[0] as { hp: number }).hp = 999;
      } catch {
        /* strict-mode TypeError is also acceptable */
      }
      expect(started.units[0]?.hp).toBe(before);
    }

    const ended = log.events.find((e) => e.type === 'EngagementEnded');
    if (ended?.type === 'EngagementEnded') {
      expect(Object.isFrozen(ended.hp)).toBe(true);
    }
  });

  it('determinism anchor: pinned event-type sequence for a known setup', () => {
    // Re-derived for 4.2's 5-unit armies (the 3-unit anchor retired with the
    // era): a wall of 5 knights vs a battery of 5 mages — the sim.test anchor
    // pair, whose full battle is hand-derived there. No cross-side AGI ties
    // (8 vs 12), both boards mirror-symmetric, no witch: the sequence holds
    // for EVERY seed; 0xbeef is pinned arbitrarily.
    // Pass 1: mages (mid L, mid R, back L, back C, back R) each blast A's
    // 3-knight front row for 34 (30 − floor(14/2) = 23, ×3/2 RPS); all three
    // die on the FIFTH blast (4 × 34 = 136 < 140). The dead knights' queued
    // turns skip; A's mid knights swing 19 (26 × 3/4) at the enemy mid mages
    // (mirrored reach: mid L col 0 reaches enemy cols {1,2} → mid R mage).
    // Pass 2: only the three back mages (2 actions) still act — three blasts
    // × 34 onto A's 2-knight mid row (140 → 38). Verdict: A 76/700 → 10%,
    // B 362/400 → 90%, winner B (exact-fraction comparison).
    const s = setup(
      {
        armies: {
          A: army([
            { class: 'knight', element: 'fire' },
            { class: 'knight', element: 'water' },
            { class: 'knight', element: 'wind' },
            { class: 'knight', element: 'earth' },
            { class: 'knight', element: 'fire' },
          ]),
          B: army(
            [
              { class: 'mage', element: 'earth' },
              { class: 'mage', element: 'fire' },
              { class: 'mage', element: 'water' },
              { class: 'mage', element: 'wind' },
              { class: 'mage', element: 'earth' },
            ],
            5,
          ),
        },
        placements: {
          A: [
            { row: 'front', col: 'left' },
            { row: 'front', col: 'center' },
            { row: 'front', col: 'right' },
            { row: 'mid', col: 'left' },
            { row: 'mid', col: 'right' },
          ],
          B: [
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'left' },
            { row: 'mid', col: 'right' },
          ],
        },
      },
      0xbeef,
    );
    const log = resolveBattle(s);
    const trace = log.events.map((e) => {
      if (e.type === 'ActionSkipped') return `skip:${e.unit}:${e.reason}`;
      if (e.type === 'ActionFizzled') return `fizzle:${e.unit}`;
      if (e.type === 'ActionMisfired') return `misfire:${e.unit}`;
      if (e.type === 'UnitAttacked') return `atk:${e.source}>${e.targets.map((t) => `${t.unit}-${t.damage}`).join(',')}`;
      if (e.type === 'UnitHealed') return `heal:${e.source}>${e.target}+${e.amount}`;
      if (e.type === 'StatusApplied') return `cast:${e.source}>${e.target}:${e.spell}`;
      if (e.type === 'UnitDied') return `died:${e.unit}`;
      if (e.type === 'PoisonTicked') return `poison:${e.unit}-${e.damage}`;
      if (e.type === 'PassStarted') return `pass:${e.pass}`;
      return e.type;
    });
    expect(trace).toEqual([
      'BattleStarted',
      'pass:1',
      'atk:B:3>A:0-34,A:1-34,A:2-34',
      'atk:B:4>A:0-34,A:1-34,A:2-34',
      'atk:B:0>A:0-34,A:1-34,A:2-34',
      'atk:B:1>A:0-34,A:1-34,A:2-34',
      'atk:B:2>A:0-34,A:1-34,A:2-34',
      'died:A:0',
      // A:0 is A's default leader (index 0): its death rides the LeaderFell beat
      // immediately after (story 4.5, FR35), and from A's next action on, its
      // PHYSICAL damage is the ×3/4 sober-package cut — the two mid knights that
      // hit for 19 pre-fall now hit for 14 (26 base ×3/4 RPS = 19, ×3/4 penalty
      // = floor(14.25) = 14). The mages' magic blasts are untouched (physical-only).
      'LeaderFell',
      'died:A:1',
      'died:A:2',
      'skip:A:0:dead',
      'skip:A:1:dead',
      'skip:A:2:dead',
      'atk:A:3>B:4-14',
      'atk:A:4>B:3-14',
      'pass:2',
      'atk:B:0>A:3-34,A:4-34',
      'atk:B:1>A:3-34,A:4-34',
      'atk:B:2>A:3-34,A:4-34',
      'EngagementEnded',
      'BattleEnded',
    ]);
    const verdict = log.events[log.events.length - 1];
    if (verdict?.type === 'BattleEnded') {
      // B higher than the pre-4.5 90%: the two mid mages take 14 not 19 from the
      // penalised knights (66 hp each, not 61) → B = (3×80 + 2×66)/400 = 93%.
      expect(verdict).toEqual({ type: 'BattleEnded', winner: 'B', hpPct: { A: 10, B: 93 } });
    }
  });
});
