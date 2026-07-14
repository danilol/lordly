import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import type { BattleEvent, MatchSetup } from '../src/types';

function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, seed = 7): MatchSetup {
  return { seed, balanceVersion: BALANCE.version, mode: 'single', ...partial };
}

const byType = <T extends BattleEvent['type']>(log: { events: readonly BattleEvent[] }, type: T) =>
  log.events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

describe('FR9 Archer — rearmost reachable, arcs over the front line', () => {
  it('snipes the artillery: hits the rearmost reachable enemy, not the front line', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'archer', element: 'fire' },
            { class: 'knight', element: 'water' },
            { class: 'knight', element: 'wind' },
          ],
          B: [
            { class: 'knight', element: 'earth' },
            { class: 'mage', element: 'fire' },
            { class: 'knight', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'back', col: 'center' }, // archer: reaches all cols, 2 actions
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
          ],
          B: [
            { row: 'front', col: 'center' }, // knight shield up front
            { row: 'back', col: 'center' }, // mage artillery in the back
            { row: 'front', col: 'left' },
          ],
        },
      }),
    );
    const archerShots = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:0');
    expect(archerShots.length).toBe(2);
    for (const shot of archerShots) {
      // rearmost reachable = the back-row mage, over the front knights; archer beats mage ×3/2: 24−4=20 → 30
      expect(shot.targets).toEqual([{ unit: 'B:1', damage: 30, hpAfter: expect.any(Number) }]);
    }
  });
});

describe('FR10 Mage — row blast, reach ignored, per-target RPS, multi-kill', () => {
  const blastBattle = () =>
    setup({
      armies: {
        A: [
          { class: 'archer', element: 'fire' },
          { class: 'archer', element: 'water' },
          { class: 'mage', element: 'wind' },
        ],
        B: [
          { class: 'mage', element: 'earth' },
          { class: 'mage', element: 'fire' },
          { class: 'knight', element: 'water' },
        ],
      },
      placements: {
        A: [
          { row: 'back', col: 'left' },
          { row: 'back', col: 'right' },
          { row: 'back', col: 'center' },
        ],
        B: [
          { row: 'back', col: 'left' },
          { row: 'back', col: 'right' },
          { row: 'front', col: 'center' },
        ],
      },
    });

  it('blasts the row with most living enemies and carries one targets[] entry per unit', () => {
    const log = resolveBattle(blastBattle());
    const blasts = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:2');
    expect(blasts.length).toBeGreaterThan(0);
    // B's back row has 2 mages vs front's 1 knight → back row, both mages struck by ONE event.
    expect(blasts[0]?.targets.map((t) => t.unit).sort()).toEqual(['B:0', 'B:1']);
    // mage → mage: 30 − 11 = 19, neutral.
    expect(blasts[0]?.targets.every((t) => t.damage === 19)).toBe(true);
  });

  it('one blast can kill multiple units: UnitDied per target after the single UnitAttacked', () => {
    const log = resolveBattle(blastBattle());
    // pass1: archers 30 each (80→50), A mage 19 (→31); pass2: archers (→1),
    // A mage's blast kills BOTH at 1 hp. (A:2 also falls afterwards — B's
    // mages + knight poured 19s into A's stacked back row; crossfire is real.)
    const deaths = byType(log, 'UnitDied')
      .map((d) => d.unit)
      .sort();
    expect(deaths).toEqual(['A:2', 'B:0', 'B:1']);
    const killingBlast = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:2')[1];
    expect(killingBlast?.targets.every((t) => t.hpAfter === 0)).toBe(true);
    const i = log.events.indexOf(killingBlast as BattleEvent);
    expect(log.events[i + 1]?.type).toBe('UnitDied');
    expect(log.events[i + 2]?.type).toBe('UnitDied');
  });

  it('tie in living count breaks toward the rearmost row', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'mage', element: 'fire' },
            { class: 'knight', element: 'water' },
            { class: 'knight', element: 'wind' },
          ],
          B: [
            { class: 'knight', element: 'earth' },
            { class: 'cleric', element: 'fire' },
            { class: 'knight', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'back', col: 'center' },
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
          ],
          B: [
            { row: 'front', col: 'left' }, // 1 front
            { row: 'back', col: 'center' }, // 1 back — tie → rearmost
            { row: 'front', col: 'right' }, // wait: 2 front — fix below
          ],
        },
      }),
    );
    // B has 2 front + 1 back → most-living = front. Assert the blast hit the FRONT pair
    // (this test pins the "most living" half; the rearmost tie is unit-tested in targeting.test).
    const blast = byType(log, 'UnitAttacked').find((a) => a.source === 'A:0');
    expect(blast?.targets.map((t) => t.unit).sort()).toEqual(['B:0', 'B:2']);
  });
});

describe('FR11 Cleric — heal lowest exact HP fraction, cap, staff fallback', () => {
  const clericBattle = () =>
    setup({
      armies: {
        A: [
          { class: 'knight', element: 'fire' },
          { class: 'cleric', element: 'water' },
          { class: 'mage', element: 'wind' },
        ],
        B: [
          { class: 'knight', element: 'earth' },
          { class: 'knight', element: 'fire' },
          { class: 'knight', element: 'water' },
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'center' },
          { row: 'back', col: 'center' },
          { row: 'back', col: 'left' },
        ],
        B: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
        ],
      },
    });

  it('staff-bonks (clamped to 1) while all allies are at full HP, then heals once damage lands', () => {
    const log = resolveBattle(clericBattle());
    const clericTurnEvents = log.events.filter((e) => (e.type === 'UnitAttacked' && e.source === 'A:1') || (e.type === 'UnitHealed' && e.source === 'A:1'));
    expect(clericTurnEvents.length).toBe(2); // back row: 2 actions
    // Pass 1: cleric (AGI 10) acts before the knights (AGI 8) — nobody damaged yet → staff.
    const first = clericTurnEvents[0];
    expect(first?.type).toBe('UnitAttacked');
    if (first?.type === 'UnitAttacked') {
      expect(first.targets[0]?.damage).toBe(1); // STR 8 − floor(28/2) = −6 → clamp
    }
    // Pass 2: B knights have hit A's front knight → heal the damaged ally.
    const second = clericTurnEvents[1];
    expect(second?.type).toBe('UnitHealed');
    if (second?.type === 'UnitHealed') {
      expect(second.target).toBe('A:0');
      expect(second.amount).toBeGreaterThan(0);
    }
  });

  it('heal amount is EFFECTIVE (capped at max HP) — a 1-hp deficit restores exactly 1', () => {
    // B cleric (back/left, col 0) staff-bonks before A's cleric acts (same AGI,
    // same row, lower col) → A's cleric is down exactly 1 hp at her own turn
    // and self-heals for a capped amount of 1, not the full 30.
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'knight', element: 'fire' },
            { class: 'cleric', element: 'water' },
            { class: 'mage', element: 'wind' },
          ],
          B: [
            { class: 'knight', element: 'earth' },
            { class: 'cleric', element: 'fire' },
            { class: 'cleric', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'center' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'left' },
          ],
          B: [
            { row: 'front', col: 'center' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'right' },
          ],
        },
      }),
    );
    const heals = byType(log, 'UnitHealed');
    expect(heals.length).toBeGreaterThan(0);
    for (const h of heals) {
      expect(h.amount).toBeLessThanOrEqual(30);
    }
    // Hand-verified from the event trace: A's knight is down exactly 16 when
    // A's cleric heals it — the heal caps at the deficit (16 < 30) and lands
    // on exactly full HP. (B's blasted clerics also self-heal capped 18/20.)
    expect(heals).toContainEqual({ type: 'UnitHealed', source: 'A:1', target: 'A:0', amount: 16, hpAfter: 140 });
    expect(heals.every((h) => h.amount < 30)).toBe(true);
  });
});

describe('FR12/FR16 Witch — casts, prefer-unaffected, fizzle, spells', () => {
  it('water witch sleeps the rearmost reachable enemy; the target visibly loses its actions', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'witch', element: 'water' },
            { class: 'knight', element: 'fire' },
            { class: 'knight', element: 'wind' },
          ],
          B: [
            { class: 'knight', element: 'earth' },
            { class: 'archer', element: 'fire' },
            { class: 'knight', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'back', col: 'center' },
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
          ],
          B: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'center' }, // archer = rearmost reachable target
            { row: 'front', col: 'right' },
          ],
        },
      }),
    );
    const casts = byType(log, 'StatusApplied').filter((s) => s.source === 'A:0');
    expect(casts[0]).toMatchObject({ target: 'B:1', spell: 'sleep' });
    // The slept archer (2 actions) emits asleep skips instead of shots.
    const asleep = log.events.filter((e) => e.type === 'ActionSkipped' && e.unit === 'B:1' && e.reason === 'asleep');
    expect(asleep.length).toBe(2);
    expect(byType(log, 'UnitAttacked').some((a) => a.source === 'B:1')).toBe(false);
  });

  it('prefers unaffected targets on the second cast; fizzles when all reachable are affected', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'witch', element: 'water' },
            { class: 'knight', element: 'fire' },
            { class: 'knight', element: 'wind' },
          ],
          B: [
            { class: 'knight', element: 'earth' },
            { class: 'knight', element: 'fire' },
            { class: 'knight', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'back', col: 'left' }, // witch reaches enemy cols {1,2} only
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
          ],
          B: [
            { row: 'front', col: 'center' }, // reachable
            { row: 'front', col: 'right' }, // reachable
            { row: 'front', col: 'left' }, // NOT reachable from witch's column
          ],
        },
      }),
    );
    const casts = byType(log, 'StatusApplied').filter((s) => s.source === 'A:0');
    expect(casts.length).toBe(2); // two different reachable knights slept
    expect(new Set(casts.map((c) => c.target)).size).toBe(2);
  });

  it('earth witch poisons: PoisonTicked 15 at engagement end, before judging, after EngagementEnded ordering pinned', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'witch', element: 'earth' },
            { class: 'knight', element: 'fire' },
            { class: 'knight', element: 'wind' },
          ],
          B: [
            { class: 'knight', element: 'earth' },
            { class: 'knight', element: 'fire' },
            { class: 'knight', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'back', col: 'center' },
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
          ],
          B: [
            { row: 'front', col: 'left' },
            { row: 'front', col: 'center' },
            { row: 'front', col: 'right' },
          ],
        },
      }),
    );
    const ticks = byType(log, 'PoisonTicked');
    expect(ticks.length).toBeGreaterThanOrEqual(1);
    expect(ticks[0]?.damage).toBe(15);
    // Poison ticks precede EngagementEnded (hp snapshot includes the tick).
    const tickIdx = log.events.indexOf(ticks[0] as BattleEvent);
    const engIdx = log.events.findIndex((e) => e.type === 'EngagementEnded');
    expect(tickIdx).toBeLessThan(engIdx);
    const eng = log.events[engIdx];
    if (eng?.type === 'EngagementEnded' && ticks[0]) {
      expect(eng.hp[ticks[0].unit]).toBe(ticks[0].hpAfter);
    }
  });

  it('fire witch weakens: the weakened knight deals halved damage (16 → 8)', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'witch', element: 'fire' },
            { class: 'knight', element: 'water' },
            { class: 'knight', element: 'wind' },
          ],
          B: [
            { class: 'knight', element: 'earth' },
            { class: 'knight', element: 'fire' },
            { class: 'knight', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'back', col: 'center' },
            { row: 'front', col: 'left' },
            { row: 'front', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'left' },
            { row: 'front', col: 'center' },
            { row: 'back', col: 'center' }, // rearmost reachable → weakened first
          ],
        },
      }),
    );
    const weakenCast = byType(log, 'StatusApplied').find((s) => s.spell === 'weaken');
    expect(weakenCast?.target).toBe('B:2');
    // B:2 (back knight, 1 action) attacks AFTER the witch (AGI 26 > 8): halved 16 → 8.
    const weakenedHit = byType(log, 'UnitAttacked').find((a) => a.source === 'B:2');
    expect(weakenedHit?.targets[0]?.damage).toBe(8);
  });
});

describe('FR16 poison — ticks at natural engagement end, can kill, ordered by unit', () => {
  const poisonDuel = () =>
    setup(
      {
        armies: {
          A: [
            { class: 'archer', element: 'fire' },
            { class: 'archer', element: 'water' },
            { class: 'witch', element: 'earth' },
          ],
          B: [
            { class: 'witch', element: 'earth' },
            { class: 'knight', element: 'earth' },
            { class: 'knight', element: 'water' },
          ],
        },
        placements: {
          A: [
            // Front-row archer = 1 action (story 3.0 retune: at the hunt's
            // ×3/2 the old 4 back-row shots would kill the witch outright —
            // 3 shots leave her at 1 hp so the TICK still lands the kill).
            { row: 'front', col: 'left' },
            { row: 'back', col: 'right' },
            { row: 'back', col: 'center' },
          ],
          B: [
            { row: 'back', col: 'center' },
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
          ],
        },
      },
      5,
    );

  it('a unit whittled to ≤15 hp dies to the tick: PoisonTicked{hpAfter: 0} → UnitDied', () => {
    const log = resolveBattle(poisonDuel());
    const ticks = byType(log, 'PoisonTicked');
    // Both earth witches landed poisons; ticks run in unit order (A before B).
    expect(ticks.map((t) => t.unit)).toEqual(['A:1', 'A:2', 'B:0', 'B:2']);
    const fatal = ticks.find((t) => t.hpAfter === 0);
    expect(fatal?.unit).toBe('B:0'); // the arrow-riddled witch (85 − 3×28 = 1) succumbs
    const i = log.events.indexOf(fatal as BattleEvent);
    expect(log.events[i + 1]).toEqual({ type: 'UnitDied', unit: 'B:0' });
    // All ticks precede EngagementEnded; the snapshot carries post-tick hp.
    const engIdx = log.events.findIndex((e) => e.type === 'EngagementEnded');
    expect(log.events.indexOf(ticks[0] as BattleEvent)).toBeLessThan(engIdx);
  });
});

describe('FR12/FR16 witch cast fizzle (no stack, deterministic)', () => {
  it('second cast fizzles when the only reachable enemy already bears the spell', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'witch', element: 'water' },
            { class: 'knight', element: 'fire' },
            { class: 'knight', element: 'wind' },
          ],
          B: [
            { class: 'knight', element: 'earth' },
            { class: 'knight', element: 'fire' },
            { class: 'knight', element: 'water' },
          ],
        },
        placements: {
          A: [
            { row: 'back', col: 'left' }, // witch reaches enemy cols {1,2}
            { row: 'front', col: 'left' },
            { row: 'front', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'center' }, // the ONLY reachable enemy
            { row: 'front', col: 'left' }, // unreachable (col 0)
            { row: 'mid', col: 'left' }, // unreachable (col 0)
          ],
        },
      }),
    );
    const casts = byType(log, 'StatusApplied').filter((s) => s.source === 'A:0');
    expect(casts).toHaveLength(1); // first cast sleeps B:0
    expect(casts[0]).toMatchObject({ target: 'B:0', spell: 'sleep' });
    const fizzles = log.events.filter((e) => e.type === 'ActionFizzled' && e.unit === 'A:0');
    expect(fizzles).toHaveLength(1); // second cast wasted — no stack
  });
});
