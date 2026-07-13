import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import { InvalidMatchSetupError } from '../src/validate';
import { LOG_VERSION } from '../src/types';
import type { ActionSkipped, MatchSetup, PassStarted, UnitId } from '../src/types';
import { matchSetupArb } from './arbitraries';

/** Build a setup with explicit armies/placements; other fields sane defaults. */
function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, seed = 7): MatchSetup {
  return { seed, balanceVersion: BALANCE.version, mode: 'single', ...partial };
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
          A: [
            { class: 'witch', element: 'fire' },
            { class: 'archer', element: 'water' },
            { class: 'knight', element: 'wind' },
          ],
          B: [
            { class: 'mercenary', element: 'earth' },
            { class: 'mage', element: 'fire' },
            { class: 'cleric', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'back', col: 'left' },
            { row: 'mid', col: 'center' },
            { row: 'front', col: 'right' },
          ],
          B: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
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
      // Since 1.5 melee units deal real damage — assert structure, not a draw.
      expect(['A', 'B', 'draw']).toContain(ended.winner);
      expect(ended.hpPct.A).toBeGreaterThanOrEqual(0);
      expect(ended.hpPct.B).toBeGreaterThanOrEqual(0);
    }
  });

  it('BattleStarted carries the full roster with ids, hp, and placements (AD-2)', () => {
    const s = setup({
      armies: {
        A: [
          { class: 'knight', element: 'fire' },
          { class: 'mage', element: 'water' },
          { class: 'cleric', element: 'wind' },
        ],
        B: [
          { class: 'witch', element: 'earth' },
          { class: 'archer', element: 'fire' },
          { class: 'mercenary', element: 'water' },
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'left' },
          { row: 'back', col: 'center' },
          { row: 'back', col: 'right' },
        ],
        B: [
          { row: 'back', col: 'left' },
          { row: 'mid', col: 'center' },
          { row: 'front', col: 'right' },
        ],
      },
    });
    const started = resolveBattle(s).events[0];
    expect(started?.type).toBe('BattleStarted');
    if (started?.type === 'BattleStarted') {
      expect(started.units).toHaveLength(6);
      const a0 = started.units.find((u) => u.id === 'A:0');
      expect(a0).toEqual({
        id: 'A:0',
        side: 'A',
        class: 'knight',
        element: 'fire',
        placement: { row: 'front', col: 'left' },
        hp: 140,
        maxHp: 140,
      });
    }
  });

  it('orders a pass by descending AGI across both armies (FR13)', () => {
    // Six distinct AGIs: witch 26 > archer 22 > mercenary 14 > mage 12 > cleric 10 > knight 8.
    // All placed in back rows (1 action each except archer mid=2? archer back=2) — use rows
    // that give 1 action where possible to keep pass 1 clean; ordering is what matters here.
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'witch', element: 'fire' },
            { class: 'archer', element: 'water' },
            { class: 'knight', element: 'wind' },
          ],
          B: [
            { class: 'mercenary', element: 'earth' },
            { class: 'mage', element: 'fire' },
            { class: 'cleric', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'back', col: 'left' }, // witch
            { row: 'back', col: 'center' }, // archer (back: 2 actions)
            { row: 'back', col: 'right' }, // knight (back: 1)
          ],
          B: [
            { row: 'back', col: 'left' }, // mercenary (back: 1)
            { row: 'back', col: 'center' }, // mage (back: 2)
            { row: 'back', col: 'right' }, // cleric (back: 2)
          ],
        },
      }),
    );
    const pass1 = turnsByPass(log)[0];
    expect(pass1).toEqual(['A:0', 'A:1', 'B:0', 'B:1', 'B:2', 'A:2']);
  });

  it('breaks equal-AGI ties front row before back, then left before right (FR13)', () => {
    // Three same-side knights (same AGI): back/right, front/right, front/left.
    // Expected same-side order: front/left, front/right, back/right.
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'knight', element: 'fire' },
            { class: 'knight', element: 'water' },
            { class: 'knight', element: 'wind' },
          ],
          B: [
            { class: 'witch', element: 'earth' },
            { class: 'witch', element: 'fire' },
            { class: 'witch', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'back', col: 'right' }, // A:0
            { row: 'front', col: 'right' }, // A:1
            { row: 'front', col: 'left' }, // A:2
          ],
          B: [
            { row: 'mid', col: 'center' }, // B:0
            { row: 'mid', col: 'left' }, // B:1
            { row: 'back', col: 'left' }, // B:2
          ],
        },
      }),
    );
    const pass1 = turnsByPass(log)[0] ?? [];
    // Witches (AGI 26) first: mid/left, mid/center, back/left → B:1, B:0, B:2
    // Knights (AGI 8): front/left, front/right, back/right → A:2, A:1, A:0
    expect(pass1.slice(0, 3)).toEqual(['B:1', 'B:0', 'B:2']);
    expect(pass1.slice(-3)).toEqual(['A:2', 'A:1', 'A:0']);
  });

  it('resolves exact cross-side ties with the per-engagement coin flip, both ways (FR13)', () => {
    // Mirror setup: same class, same row, same col on both sides — only the flip orders them.
    const mirror = (seed: number) =>
      resolveBattle(
        setup(
          {
            armies: {
              A: [
                { class: 'knight', element: 'fire' },
                { class: 'archer', element: 'water' },
                { class: 'mage', element: 'wind' },
              ],
              B: [
                { class: 'knight', element: 'earth' },
                { class: 'archer', element: 'fire' },
                { class: 'mage', element: 'water' },
              ],
            },
            placements: {
              A: [
                { row: 'front', col: 'left' },
                { row: 'mid', col: 'center' },
                { row: 'back', col: 'right' },
              ],
              B: [
                { row: 'front', col: 'left' },
                { row: 'mid', col: 'center' },
                { row: 'back', col: 'right' },
              ],
            },
          },
          seed,
        ),
      );
    const firstActor = (seed: number) => turnsByPass(mirror(seed))[0]?.[0];
    // Seeds 1..20 verified to produce both flip outcomes (probe: 00000010111101011011).
    const outcomes = new Set(Array.from({ length: 20 }, (_, i) => firstActor(i + 1)));
    expect(outcomes).toEqual(new Set(['A:1', 'B:1'])); // both sides reachable; archers (AGI 22) first either way
    // Determinism: same seed always flips the same way (pinned: seed 1 → A, seed 7 → B).
    expect(firstActor(1)).toBe('A:1');
    expect(firstActor(7)).toBe('B:1');
  });

  it('splits multihit across passes: 2-action front knight acts once per pass (FR13)', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'knight', element: 'fire' }, // front: 2 actions
            { class: 'knight', element: 'water' }, // back: 1 action
            { class: 'cleric', element: 'wind' }, // back: 2 actions
          ],
          B: [
            { class: 'mercenary', element: 'earth' }, // front: 2 actions
            { class: 'mercenary', element: 'fire' }, // back: 1
            { class: 'witch', element: 'water' }, // back: 2
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
          ],
          B: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
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
    expect(countTurns('B:1')).toBe(1);
    expect(passes[1]).not.toContain('A:1');
  });

  it('turn counts equal each unit’s row action budget (FR15/FR17)', () => {
    const s = setup({
      armies: {
        A: [
          { class: 'archer', element: 'fire' }, // front: 1
          { class: 'archer', element: 'water' }, // mid: 2
          { class: 'archer', element: 'wind' }, // back: 2
        ],
        B: [
          { class: 'mage', element: 'earth' }, // front: 1
          { class: 'mage', element: 'fire' }, // mid: 1
          { class: 'mage', element: 'water' }, // back: 2
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'left' },
          { row: 'mid', col: 'center' },
          { row: 'back', col: 'right' },
        ],
        B: [
          { row: 'front', col: 'left' },
          { row: 'mid', col: 'center' },
          { row: 'back', col: 'right' },
        ],
      },
    });
    const all = turnsByPass(resolveBattle(s)).flat();
    const count = (id: UnitId) => all.filter((u) => u === id).length;
    expect(count('A:0')).toBe(1);
    expect(count('A:1')).toBe(2);
    expect(count('A:2')).toBe(2);
    expect(count('B:0')).toBe(1);
    expect(count('B:1')).toBe(1);
    expect(count('B:2')).toBe(2);
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
    // Per-engagement ceiling: passes(≤2) + turns(≤ 6 units × 2 actions,
    // each ≤2 events: misfire marker + effect) + poison ticks(≤6 — poisoned
    // units tick at EVERY natural engagement end) + 1 EngagementEnded = 33.
    // Deaths are BATTLE-wide, not per-engagement: a unit dies at most once,
    // so ≤6 UnitDied total — multiplying them by the cap would balloon the
    // bound ~5× and stop catching runaway event growth inside it. Single mode
    // runs one engagement; wipeout is bounded by BALANCE.engagementCap (its
    // termination guarantee). BattleStarted/BattleEnded bookend once.
    const engagements = s.mode === 'wipeout' ? BALANCE.engagementCap : 1;
    expect(log.events.length).toBeLessThanOrEqual(1 + engagements * (2 + 24 + 6 + 1) + 6 + 1);
    expect(log.events.filter((e) => e.type === 'UnitDied').length).toBeLessThanOrEqual(6);
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
      // Mutation of a nested field is silently ignored in a frozen object
      // (or throws in strict mode) — either way, hp must be unchanged.
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
    const s = setup(
      {
        armies: {
          A: [
            { class: 'knight', element: 'fire' },
            { class: 'archer', element: 'water' },
            { class: 'witch', element: 'wind' },
          ],
          B: [
            { class: 'mage', element: 'earth' },
            { class: 'cleric', element: 'fire' },
            { class: 'mercenary', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'center' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'right' },
          ],
          B: [
            { row: 'back', col: 'center' },
            { row: 'back', col: 'left' },
            { row: 'front', col: 'right' },
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
    // Pinned at implementation time (re-pinned in 1.6: the full roster acts —
    // an engine behavior change with the LOG_VERSION 3 bump). Hand-verified:
    // the wind witch confuses the facing cleric then (prefer-unaffected) the
    // mage; the blast multi-targets A's back row with per-target RPS (18/20);
    // the confused cleric's pass-2 misfire heals the ENEMY knight capped +24.
    expect(trace).toEqual([
      'BattleStarted',
      'pass:1',
      'cast:A:2>B:1:confusion',
      'atk:A:1>B:0-30',
      'atk:B:2>A:0-12',
      'atk:B:0>A:1-18,A:2-20',
      'heal:B:1>B:0+30',
      'atk:A:0>B:2-20',
      'pass:2',
      'cast:A:2>B:0:confusion',
      'atk:A:1>B:0-30',
      'atk:B:2>A:0-12',
      'atk:B:0>A:1-18,A:2-20',
      'misfire:B:1',
      'heal:B:1>A:0+24',
      'atk:A:0>B:2-20',
      'EngagementEnded',
      'BattleEnded',
    ]);
    const verdict = log.events[log.events.length - 1];
    if (verdict?.type === 'BattleEnded') {
      // A 239/315 vs B 210/280: both floor to 75% but the EXACT comparison
      // (239×280 = 66920 > 210×315 = 66150) gives A the win — the
      // false-tie-floor judging rule visible in a real battle.
      expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 75, B: 75 } });
    }
  });
});
