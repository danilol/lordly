import { test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { leaderPenaltyPhysical, physicalDamage, resolveBattle } from '../src/resolve';
import type { BattleLog, MatchSetup, Side, Unit } from '../src/types';
import { matchSetupArb } from './arbitraries';

/**
 * Story 4.5 — the squad leader (FR35). The engine half: `LeaderFell` emission,
 * the sober-package physical penalty (×3/4 dealt / ×5/4 taken, re-clamped), the
 * tactic reversion to Autonomous, and the cross-story guarantee that an enemy's
 * `Attack Leader` tactic degrades to Autonomous once the hunted leader is dead
 * (4.4's `applyTactic` fallback — proven here, not reimplemented).
 */
function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, o: Partial<Pick<MatchSetup, 'seed' | 'mode' | 'tactics' | 'leaders'>> = {}): MatchSetup {
  return {
    seed: o.seed ?? 7,
    balanceVersion: BALANCE.version,
    mode: o.mode ?? 'single',
    tactics: o.tactics ?? { A: 'autonomous', B: 'autonomous' },
    leaders: o.leaders ?? { A: 0, B: 0 },
    ...partial,
  };
}

const u = (cls: Unit['class'], element: Unit['element'], name: string): Unit => ({ class: cls, element, name });
const eventsEqual = (x: BattleLog, y: BattleLog) => JSON.stringify(x.events) === JSON.stringify(y.events);

/** A wall of 5 knights (front L/C/R + mid L/R) vs a battery of 5 mages (back L/C/R + mid L/R) — the sim/resolve determinism anchor. */
const KNIGHT_WALL_VS_MAGE_BATTERY = {
  armies: {
    A: [
      u('knight', 'fire', 'Aldric'),
      u('knight', 'water', 'Berold'),
      u('knight', 'wind', 'Cedric'),
      u('knight', 'earth', 'Doran'),
      u('knight', 'fire', 'Edmund'),
    ],
    B: [u('mage', 'fire', 'Mira'), u('mage', 'water', 'Nessa'), u('mage', 'wind', 'Olwen'), u('mage', 'earth', 'Petra'), u('mage', 'fire', 'Quinn')],
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
} satisfies Pick<MatchSetup, 'armies' | 'placements'>;

/** golden.test.ts's POISON_DUEL — B:3 (a front knight) dies to a compounding poison tick in wipeout mode (seed 5). */
const POISON_DUEL = {
  armies: {
    A: [u('archer', 'fire', 'Lyra'), u('archer', 'water', 'Vess'), u('witch', 'earth', 'Morwen'), u('knight', 'fire', 'Kain'), u('knight', 'water', 'Aldric')],
    B: [
      u('witch', 'earth', 'Nimue'),
      u('knight', 'earth', 'Roland'),
      u('knight', 'water', 'Falk'),
      u('mercenary', 'fire', 'Gorm'),
      u('mercenary', 'earth', 'Hask'),
    ],
  },
  placements: {
    A: [
      { row: 'back', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'back', col: 'center' },
      { row: 'front', col: 'left' },
      { row: 'front', col: 'center' },
    ],
    B: [
      { row: 'back', col: 'center' },
      { row: 'front', col: 'left' },
      { row: 'front', col: 'right' },
      { row: 'front', col: 'center' },
      { row: 'mid', col: 'center' },
    ],
  },
} satisfies Pick<MatchSetup, 'armies' | 'placements'>;

describe('LeaderFell emission (FR35, story 4.5)', () => {
  it('a leader killed in COMBAT emits LeaderFell exactly once, right after its UnitDied', () => {
    // 5 knights vs 5 mages: the mages blast the 3-knight front to death on pass
    // 1; A:0 (front-left) is A's default leader, so its death fires LeaderFell(A)
    // between the front casualties. B's leader (a back mage) is never touched.
    const log = resolveBattle(setup(KNIGHT_WALL_VS_MAGE_BATTERY, { leaders: { A: 0, B: 0 } }));
    expect(log.events.filter((e) => e.type === 'LeaderFell')).toEqual([{ type: 'LeaderFell', side: 'A', unit: 'A:0' }]);
    const idx = log.events.findIndex((e) => e.type === 'LeaderFell');
    expect(log.events[idx - 1]).toEqual({ type: 'UnitDied', unit: 'A:0' }); // rides immediately after the death
  });

  it('a leader killed by POISON emits LeaderFell, right after the fatal PoisonTicked→UnitDied pair', () => {
    // In the POISON_DUEL (wipeout), B:3 falls to a compounding poison tick at an
    // engagement end. Designate B:3 as B's leader and the tick death carries the
    // sober-package beat exactly like a combat death does.
    const log = resolveBattle(setup(POISON_DUEL, { seed: 5, mode: 'wipeout', leaders: { A: 0, B: 3 } }));
    expect(log.events.filter((e) => e.type === 'LeaderFell')).toEqual([{ type: 'LeaderFell', side: 'B', unit: 'B:3' }]);
    const idx = log.events.findIndex((e) => e.type === 'LeaderFell');
    expect(log.events[idx - 1]).toEqual({ type: 'UnitDied', unit: 'B:3' });
    expect(log.events[idx - 2]?.type).toBe('PoisonTicked'); // the death came from the tick, not combat
  });

  test.prop([matchSetupArb])('across any battle: at most one LeaderFell per side, each on the designated leader, each right after that unit died', (s) => {
    const events = resolveBattle(s).events;
    const fells = events.filter((e) => e.type === 'LeaderFell');
    for (const side of ['A', 'B'] as Side[]) {
      expect(fells.filter((e) => e.type === 'LeaderFell' && e.side === side).length).toBeLessThanOrEqual(1);
    }
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e?.type !== 'LeaderFell') continue;
      expect(e.unit).toBe(`${e.side}:${s.leaders[e.side]}`); // the FR35 leader id
      expect(events[i - 1]).toEqual({ type: 'UnitDied', unit: e.unit }); // combat OR poison — always after the death
    }
  });
});

describe('the sober-package physical penalty (FR35, dossier §4)', () => {
  // leaderPenaltyPhysical is exported for direct table-driven tests (the
  // physicalDamage convention) — the arithmetic and the re-clamp trap are
  // pinned here, precisely, without threading a whole battle.
  it('no leader fallen: the multiplier is a pass-through (bit-identical to physicalDamage)', () => {
    const f = leaderPenaltyPhysical('A', 'B', { A: false, B: false });
    expect(f('knight', 'mercenary')).toBe(physicalDamage('knight', 'mercenary'));
  });

  it('attacker side fallen: ×3/4 dealt', () => {
    const f = leaderPenaltyPhysical('A', 'B', { A: true, B: false });
    expect(f('knight', 'mercenary')).toBe(Math.floor((physicalDamage('knight', 'mercenary') * 3) / 4)); // 20 → 15
  });

  it('defender side fallen: ×5/4 taken', () => {
    const f = leaderPenaltyPhysical('A', 'B', { A: false, B: true });
    expect(f('knight', 'mercenary')).toBe(Math.floor((physicalDamage('knight', 'mercenary') * 5) / 4)); // 20 → 25
  });

  it('both sides fallen (the misfire same-side case): ×3/4 THEN ×5/4 in fixed order', () => {
    const f = leaderPenaltyPhysical('A', 'A', { A: true, B: false });
    const base = physicalDamage('knight', 'knight'); // 16
    expect(f('knight', 'knight')).toBe(Math.floor((Math.floor((base * 3) / 4) * 5) / 4)); // 16 → 12 → 15
  });

  it('RE-CLAMP trap: a min-damage physical hit stays at minDamage after the cut, never 0', () => {
    // Cleric staff vs Phalanx: STR 8 − floor(VIT 34/2) = −9 → clamps to minDamage
    // (1). ×3/4 = floor(0.75) = 0 — WITHOUT the final re-clamp this would deal 0.
    expect(physicalDamage('cleric', 'phalanx')).toBe(BALANCE.formulas.minDamage);
    const f = leaderPenaltyPhysical('A', 'B', { A: true, B: false });
    expect(f('cleric', 'phalanx')).toBe(BALANCE.formulas.minDamage);
  });

  it('in a real battle the penalty bites physical only, in both directions, from the fall onward', () => {
    // 5 knights vs 5 mercs (wipeout): B:0 (front-left) is B's default leader and
    // falls in engagement 2. From then, knight→merc (A hitting fallen B) takes
    // ×5/4 (20 → 25) and merc→knight (fallen B hitting A) deals ×3/4 (12 → 9).
    const WALL = KNIGHT_WALL_VS_MAGE_BATTERY.placements.A;
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: KNIGHT_WALL_VS_MAGE_BATTERY.armies.A,
            B: [
              u('mercenary', 'earth', 'Falk'),
              u('mercenary', 'fire', 'Gorm'),
              u('mercenary', 'water', 'Hask'),
              u('mercenary', 'wind', 'Ivo'),
              u('mercenary', 'earth', 'Jarek'),
            ],
          },
          placements: { A: WALL, B: WALL },
        },
        { seed: 0xdead, mode: 'wipeout', leaders: { A: 0, B: 0 } },
      ),
    );
    const lf = log.events.findIndex((e) => e.type === 'LeaderFell' && e.side === 'B');
    expect(lf).toBeGreaterThan(-1);
    const kToM = (from: number, to: number) =>
      log.events
        .slice(from, to)
        .filter((e) => e.type === 'UnitAttacked' && e.source.startsWith('A'))
        .flatMap((e) => (e.type === 'UnitAttacked' ? e.targets.map((t) => t.damage) : []));
    const mToK = (from: number, to: number) =>
      log.events
        .slice(from, to)
        .filter((e) => e.type === 'UnitAttacked' && e.source.startsWith('B'))
        .flatMap((e) => (e.type === 'UnitAttacked' ? e.targets.map((t) => t.damage) : []));
    expect(kToM(0, lf)).toContain(20); // knight → merc, pre-fall neutral
    expect(kToM(lf, log.events.length)).toContain(25); // ×5/4: B now TAKES more
    expect(mToK(0, lf)).toContain(12); // merc → knight, pre-fall neutral
    expect(mToK(lf, log.events.length)).toContain(9); // ×3/4: fallen B now DEALS less
  });
});

describe('tactic reversion to Autonomous (FR35, dossier §4)', () => {
  // A curated pair (found by search): A on 'strongest' whose leader A:0 falls
  // early — from A's first tactic-relevant action its leader is already down, so
  // A plays IDENTICALLY to a fully-Autonomous run. A control with a surviving
  // leader proves the tactic genuinely diverges when it is NOT reverted.
  const REVERSION = {
    armies: {
      A: [u('mage', 'fire', 'A0'), u('sorceress', 'fire', 'A1'), u('mage', 'fire', 'A2'), u('archer', 'fire', 'A3'), u('sorceress', 'fire', 'A4')],
      B: [u('archer', 'fire', 'B0'), u('ninja', 'fire', 'B1'), u('mercenary', 'fire', 'B2'), u('mercenary', 'fire', 'B3'), u('valkyrie', 'fire', 'B4')],
    },
    placements: {
      A: [
        { row: 'front', col: 'center' },
        { row: 'back', col: 'right' },
        { row: 'mid', col: 'right' },
        { row: 'back', col: 'center' },
        { row: 'mid', col: 'center' },
      ],
      B: [
        { row: 'mid', col: 'left' },
        { row: 'mid', col: 'right' },
        { row: 'back', col: 'center' },
        { row: 'front', col: 'center' },
        { row: 'back', col: 'right' },
      ],
    },
  } satisfies Pick<MatchSetup, 'armies' | 'placements'>;
  const SEED = 2749173325;

  it("once A's leader falls, A's tactic reverts to Autonomous (a 'strongest' run becomes a plain Autonomous run)", () => {
    const strongest = resolveBattle(setup(REVERSION, { seed: SEED, tactics: { A: 'strongest', B: 'autonomous' }, leaders: { A: 0, B: 0 } }));
    const autonomous = resolveBattle(setup(REVERSION, { seed: SEED, tactics: { A: 'autonomous', B: 'autonomous' }, leaders: { A: 0, B: 0 } }));
    expect(strongest.events.some((e) => e.type === 'LeaderFell' && e.side === 'A')).toBe(true);
    expect(eventsEqual(strongest, autonomous)).toBe(true); // reverted — the tactic no longer changes anything
  });

  it('control: with a SURVIVING leader the tactic is NOT reverted, so it still changes the battle', () => {
    const strongest = resolveBattle(setup(REVERSION, { seed: SEED, tactics: { A: 'strongest', B: 'autonomous' }, leaders: { A: 1, B: 0 } }));
    const autonomous = resolveBattle(setup(REVERSION, { seed: SEED, tactics: { A: 'autonomous', B: 'autonomous' }, leaders: { A: 1, B: 0 } }));
    expect(strongest.events.some((e) => e.type === 'LeaderFell' && e.side === 'A')).toBe(false); // A:1 lives
    expect(eventsEqual(strongest, autonomous)).toBe(false);
  });
});

describe("the enemy's Attack Leader falls back to Autonomous once our leader is dead (4.4 guarantee, story 4.5 regression)", () => {
  // 4.4's applyTactic computes legal targets from LIVING enemies only, so a dead
  // leader is never in the list and the 'leader' branch naturally falls back to
  // bestOf(autonomous). This locks that cross-story guarantee at the battle
  // level — B keeps fighting (never stalls) after the leader it was hunting dies.
  // Do NOT reimplement the fallback; this only proves it.
  const HUNT = {
    armies: {
      A: [u('knight', 'fire', 'A0'), u('berserker', 'fire', 'A1'), u('mage', 'fire', 'A2'), u('knight', 'fire', 'A3'), u('sorceress', 'fire', 'A4')],
      B: [u('archer', 'fire', 'B0'), u('mage', 'fire', 'B1'), u('ninja', 'fire', 'B2'), u('ninja', 'fire', 'B3'), u('phalanx', 'fire', 'B4')],
    },
    placements: {
      A: [
        { row: 'back', col: 'center' },
        { row: 'back', col: 'right' },
        { row: 'front', col: 'right' },
        { row: 'front', col: 'center' },
        { row: 'back', col: 'left' },
      ],
      B: [
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'right' },
        { row: 'back', col: 'center' },
        { row: 'front', col: 'center' },
        { row: 'front', col: 'left' },
      ],
    },
  } satisfies Pick<MatchSetup, 'armies' | 'placements'>;
  const SEED = 1893698480;

  it('B hunts A:2 while it lives, then keeps attacking (never idle-stalls) after A:2 dies', () => {
    const hunting = resolveBattle(setup(HUNT, { seed: SEED, tactics: { A: 'autonomous', B: 'leader' }, leaders: { A: 2, B: 0 } }));
    const plain = resolveBattle(setup(HUNT, { seed: SEED, tactics: { A: 'autonomous', B: 'autonomous' }, leaders: { A: 2, B: 0 } }));
    // B genuinely hunts: the 'leader' run diverges from the Autonomous run.
    expect(eventsEqual(hunting, plain)).toBe(false);
    // A:2 (the hunted leader) dies mid-battle.
    const death = hunting.events.findIndex((e) => e.type === 'UnitDied' && e.unit === 'A:2');
    expect(death).toBeGreaterThan(-1);
    // After the target dies, B falls back to Autonomous — it keeps striking and
    // never emits an idle skip for want of a leader to hunt.
    const after = hunting.events.slice(death);
    expect(after.filter((e) => e.type === 'UnitAttacked' && e.source.startsWith('B')).length).toBeGreaterThan(0);
    expect(after.some((e) => e.type === 'ActionSkipped' && e.reason === 'idle' && e.unit.startsWith('B'))).toBe(false);
  });
});
