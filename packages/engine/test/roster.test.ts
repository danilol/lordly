import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import type { BattleEvent, Element, MatchSetup, Unit, UnitClass } from '../src/types';

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

/** FR37 names are pure flavor (zero gameplay effect) — fixtures share a default. */
const u = (cls: UnitClass, element: Element, name = 'Aldric'): Unit => ({ class: cls, element, name });

const byType = <T extends BattleEvent['type']>(log: { events: readonly BattleEvent[] }, type: T) =>
  log.events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

describe('FR9 Archer — rearmost reachable, arcs over the front line', () => {
  it('snipes the artillery: hits the rearmost reachable enemy, not the front line', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [u('archer', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('mercenary', 'earth'), u('knight', 'fire')],
          B: [u('knight', 'earth'), u('mage', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('mercenary', 'water')],
        },
        placements: {
          A: [
            { row: 'back', col: 'center' }, // archer: reaches all cols, 2 actions
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'left' },
          ],
          B: [
            { row: 'front', col: 'center' }, // knight shield up front
            { row: 'back', col: 'center' }, // mage artillery in the back — B's ONLY back-row unit
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
            { row: 'mid', col: 'center' },
          ],
        },
      }),
    );
    const archerShots = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:0');
    expect(archerShots.length).toBe(2);
    for (const shot of archerShots) {
      // rearmost reachable = the back-row mage, over the front knights; archer beats mage ×3/2: 24−4=20 → 30.
      // (B's melee fillers can't touch the back-row archer, and B's mage blasts A's fullest
      // row — the 3-knight front — so both shots land: 80→50→20, no deaths in between.)
      expect(shot.kind).toBe('arrow');
      expect(shot.targets).toEqual([{ unit: 'B:1', damage: 30, hpAfter: expect.any(Number), outcome: 'hit' }]);
    }
  });
});

describe('FR10 Mage — row blast, reach ignored, per-target RPS, multi-kill', () => {
  const blastBattle = () =>
    setup({
      armies: {
        A: [u('archer', 'fire'), u('archer', 'water'), u('mage', 'wind'), u('knight', 'earth'), u('knight', 'fire')],
        B: [u('mage', 'earth'), u('mage', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('knight', 'earth')],
      },
      placements: {
        A: [
          { row: 'back', col: 'left' },
          { row: 'back', col: 'right' },
          { row: 'back', col: 'center' },
          { row: 'front', col: 'left' },
          { row: 'front', col: 'right' },
        ],
        B: [
          { row: 'back', col: 'left' },
          { row: 'back', col: 'right' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'left' },
          { row: 'mid', col: 'center' },
        ],
      },
    });

  it('blasts the row with most living enemies and carries one targets[] entry per unit', () => {
    const log = resolveBattle(blastBattle());
    const blasts = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:2');
    expect(blasts.length).toBeGreaterThan(0);
    // B rows: front 2, mid 1, back 2 — the 2-2 tie breaks toward the REARMOST row,
    // so the back-row mage pair is struck by ONE event.
    expect(blasts[0]?.targets.map((t) => t.unit).sort()).toEqual(['B:0', 'B:1']);
    // mage → mage: 30 − 11 = 19, neutral.
    expect(blasts[0]?.targets.every((t) => t.damage === 19)).toBe(true);
  });

  it('one blast can kill multiple units: UnitDied per target after the single UnitAttacked', () => {
    const log = resolveBattle(blastBattle());
    // pass 1: each A archer snipes its mirrored B mage for 30 (80→50) and A:2's
    // blast lands 19 (→31); pass 2: the archers again (→1), then A:2's second
    // blast kills BOTH mages at 1 hp. A:2 itself survives on 23 — it ate three
    // enemy blasts × 19 (B:1 is dead before its pass-2 action) — so the only
    // deaths are the two B mages.
    const deaths = byType(log, 'UnitDied')
      .map((d) => d.unit)
      .sort();
    expect(deaths).toEqual(['B:0', 'B:1']);
    const killingBlast = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:2')[1];
    expect(killingBlast?.targets.every((t) => t.hpAfter === 0)).toBe(true);
    const i = log.events.indexOf(killingBlast as BattleEvent);
    // B:0 is B's default leader (index 0), so its death rides a LeaderFell beat
    // IMMEDIATELY after its UnitDied (story 4.5, FR35) — between the two
    // casualties, in target order. The blast is MAGIC, so no penalty applies.
    expect(log.events[i + 1]?.type).toBe('UnitDied'); // B:0
    expect(log.events[i + 2]?.type).toBe('LeaderFell'); // B:0 was B's leader
    expect(log.events[i + 3]?.type).toBe('UnitDied'); // B:1
  });

  it('most-living wins over rearmost when there is no tie', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [u('mage', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('knight', 'earth'), u('knight', 'fire')],
          B: [u('knight', 'earth'), u('cleric', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('cleric', 'water')],
        },
        placements: {
          A: [
            { row: 'back', col: 'center' },
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'left' }, // front trio = the fullest row
            { row: 'back', col: 'center' }, // 1 back — outnumbered, rearmost loses
            { row: 'front', col: 'right' },
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'center' }, // 1 mid
          ],
        },
      }),
    );
    // B has 3 front + 1 mid + 1 back → most-living = front. The A mage (AGI 12) acts
    // before every B unit, so the front trio is intact at blast time. (The rearmost
    // tie-break itself is unit-tested in targeting.test and pinned above.)
    const blast = byType(log, 'UnitAttacked').find((a) => a.source === 'A:0');
    expect(blast?.targets.map((t) => t.unit).sort()).toEqual(['B:0', 'B:2', 'B:3']);
  });
});

describe('FR11 Cleric — heal lowest exact HP fraction, cap, staff fallback', () => {
  const clericBattle = () =>
    setup({
      armies: {
        A: [u('knight', 'fire'), u('cleric', 'water'), u('mage', 'wind'), u('knight', 'earth'), u('knight', 'water')],
        B: [u('knight', 'earth'), u('knight', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('knight', 'earth')],
      },
      placements: {
        A: [
          { row: 'front', col: 'center' }, // the ONLY A unit B's melee can reach → sole damage sink
          { row: 'back', col: 'center' },
          { row: 'back', col: 'left' },
          { row: 'mid', col: 'left' },
          { row: 'mid', col: 'right' },
        ],
        B: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'left' },
          { row: 'mid', col: 'right' },
        ],
      },
    });

  it('staff-bonks (clamped to 1) while all allies are at full HP, then heals once damage lands', () => {
    const log = resolveBattle(clericBattle());
    const clericTurnEvents = log.events.filter((e) => (e.type === 'UnitAttacked' && e.source === 'A:1') || (e.type === 'UnitHealed' && e.source === 'A:1'));
    expect(clericTurnEvents.length).toBe(2); // back row: 2 actions
    // Pass 1: cleric (AGI 10) acts before the knights (AGI 8) — nobody damaged yet
    // → staff the rearmost reachable enemy (a mid-row knight).
    const first = clericTurnEvents[0];
    expect(first?.type).toBe('UnitAttacked');
    if (first?.type === 'UnitAttacked') {
      expect(first.kind).toBe('staff');
      expect(first.targets[0]?.damage).toBe(1); // STR 8 − floor(28/2) = −6 → clamp
      expect(first.targets[0]?.outcome).toBe('hit');
    }
    // Pass 2: all five B knights poured pass-1 hits into A's lone front knight
    // (5 × 16 = 80, 140→60) → it is the unique lowest HP fraction → heal it.
    const second = clericTurnEvents[1];
    expect(second?.type).toBe('UnitHealed');
    if (second?.type === 'UnitHealed') {
      expect(second.target).toBe('A:0');
      expect(second.amount).toBeGreaterThan(0);
    }
  });

  it('heal amount is EFFECTIVE (capped at max HP) — a 24-hp deficit restores exactly 24', () => {
    // Five B mercenaries (AGI 14) all act before A's cleric (AGI 10). In pass 1
    // exactly two of them reach A:0 (26 − floor(28/2) = 12 each → down 24), so the
    // cleric's single mid-row action heals min(30, 24) = 24 and lands on exactly
    // full HP — never the full floor(24 × 5/4) = 30.
    const log = resolveBattle(
      setup({
        armies: {
          A: [u('knight', 'fire'), u('cleric', 'water'), u('knight', 'wind'), u('knight', 'earth'), u('knight', 'water')],
          B: [u('mercenary', 'earth'), u('mercenary', 'fire'), u('mercenary', 'water'), u('mercenary', 'wind'), u('mercenary', 'earth')],
        },
        placements: {
          A: [
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'center' }, // mid cleric: 1 action → exactly one heal in the log
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
            { row: 'back', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'center' }, // facing col 1 → hits A:0
            { row: 'front', col: 'left' }, // facing col 2 → hits A:3
            { row: 'front', col: 'right' }, // facing col 0 → hits A:2
            { row: 'mid', col: 'center' }, // facing col 1 → hits A:0
            { row: 'mid', col: 'left' }, // facing col 2 → hits A:3
          ],
        },
      }),
    );
    const heals = byType(log, 'UnitHealed');
    expect(heals.length).toBeGreaterThan(0);
    for (const h of heals) {
      expect(h.amount).toBeLessThanOrEqual(30);
    }
    // Hand-verified: at the cleric's turn A:0 and A:3 are BOTH at 116/140 (two
    // merc hits each) — the exact-fraction tie goes to the lowest unit order,
    // A:0 — and the heal caps at the 24 deficit, landing on exactly full HP.
    expect(heals).toContainEqual({ type: 'UnitHealed', source: 'A:1', target: 'A:0', amount: 24, hpAfter: 140 });
    expect(heals.every((h) => h.amount < 30)).toBe(true);
  });
});

describe('FR12/FR16 Witch — casts, prefer-unaffected, fizzle, spells', () => {
  it('water witch sleeps the rearmost reachable enemy; the target visibly loses its actions', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [u('witch', 'water'), u('knight', 'fire'), u('knight', 'wind'), u('knight', 'earth'), u('knight', 'water')],
          B: [u('knight', 'earth'), u('archer', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('knight', 'fire')],
        },
        placements: {
          A: [
            { row: 'back', col: 'center' },
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'center' }, // archer = the ONLY back-row unit → rearmost reachable
            { row: 'front', col: 'right' },
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'center' },
          ],
        },
      }),
    );
    const casts = byType(log, 'StatusApplied').filter((s) => s.source === 'A:0');
    expect(casts[0]).toMatchObject({ target: 'B:1', spell: 'sleep' });
    // The slept archer (2 actions) emits asleep skips instead of shots — nothing
    // on side A can reach the back row, so it stays alive to skip both.
    const asleep = log.events.filter((e) => e.type === 'ActionSkipped' && e.unit === 'B:1' && e.reason === 'asleep');
    expect(asleep.length).toBe(2);
    expect(byType(log, 'UnitAttacked').some((a) => a.source === 'B:1')).toBe(false);
  });

  it('prefers unaffected targets on the second cast; two different reachable knights slept', () => {
    const log = resolveBattle(
      setup({
        armies: {
          A: [u('witch', 'water'), u('knight', 'fire'), u('knight', 'wind'), u('knight', 'earth'), u('knight', 'water')],
          B: [u('knight', 'earth'), u('knight', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('knight', 'earth')],
        },
        placements: {
          A: [
            { row: 'back', col: 'left' }, // witch reaches enemy cols {1,2} only
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'center' }, // reachable
            { row: 'front', col: 'right' }, // reachable (facing col → slept first)
            { row: 'front', col: 'left' }, // NOT reachable from witch's column
            { row: 'mid', col: 'left' }, // NOT reachable
            { row: 'back', col: 'left' }, // NOT reachable — no rearward theft of the target slot
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
          A: [u('witch', 'earth'), u('knight', 'fire'), u('knight', 'wind'), u('knight', 'earth'), u('knight', 'water')],
          B: [u('knight', 'earth'), u('knight', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('knight', 'fire')],
        },
        placements: {
          A: [
            { row: 'back', col: 'center' },
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'left' },
            { row: 'front', col: 'center' },
            { row: 'front', col: 'right' },
            { row: 'mid', col: 'left' }, // the witch's two casts poison the mid pair
            { row: 'mid', col: 'right' },
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
          A: [u('witch', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('knight', 'earth'), u('knight', 'fire')],
          B: [u('knight', 'earth'), u('knight', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('knight', 'earth')],
        },
        placements: {
          A: [
            { row: 'back', col: 'center' },
            { row: 'front', col: 'left' },
            { row: 'front', col: 'center' },
            { row: 'front', col: 'right' },
            { row: 'mid', col: 'left' },
          ],
          B: [
            { row: 'front', col: 'left' },
            { row: 'front', col: 'center' },
            { row: 'back', col: 'center' }, // the ONLY back-row unit → weakened first
            { row: 'mid', col: 'left' },
            { row: 'mid', col: 'right' },
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
          A: [u('archer', 'fire'), u('archer', 'water'), u('witch', 'earth'), u('knight', 'wind'), u('knight', 'earth')],
          B: [u('witch', 'earth'), u('knight', 'earth'), u('knight', 'water'), u('knight', 'fire'), u('knight', 'wind')],
        },
        placements: {
          A: [
            // Front-row archer = 1 action (story 3.0 retune: at the hunt's
            // ×3/2 the old 4 back-row shots would kill the witch outright —
            // 3 shots leave her at 1 hp so the TICK still lands the kill).
            { row: 'front', col: 'left' },
            { row: 'back', col: 'right' },
            { row: 'back', col: 'center' },
            { row: 'front', col: 'center' },
            { row: 'front', col: 'right' },
          ],
          B: [
            { row: 'back', col: 'center' }, // the ONLY unit in the archers' rearmost reach → all 3 arrows
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
            { row: 'front', col: 'center' },
            { row: 'mid', col: 'center' }, // A witch's 2nd cast poisons this rearmost-unaffected knight
          ],
        },
      },
      5,
    );

  it('a unit whittled to ≤15 hp dies to the tick: PoisonTicked{hpAfter: 0} → UnitDied', () => {
    const log = resolveBattle(poisonDuel());
    const ticks = byType(log, 'PoisonTicked');
    // Both earth witches landed both casts; ticks run in unit order (A before B):
    // B's witch poisons A:2 then A:1 (rearmost, then rearmost-unaffected); A's
    // witch poisons B:0 then B:4 (B's melee fillers stay front/mid, so nothing
    // steals the rearmost slot and no filler shoots a 4th arrow).
    expect(ticks.map((t) => t.unit)).toEqual(['A:1', 'A:2', 'B:0', 'B:4']);
    const fatal = ticks.find((t) => t.hpAfter === 0);
    expect(fatal?.unit).toBe('B:0'); // the arrow-riddled witch: 85 − 3×28 = 1 (28 = hunt ×3/2 on 24 − floor(10/2) = 19)
    const i = log.events.indexOf(fatal as BattleEvent);
    expect(log.events[i + 1]).toEqual({ type: 'UnitDied', unit: 'B:0' });
    // All ticks precede EngagementEnded; the snapshot carries post-tick hp.
    const engIdx = log.events.findIndex((e) => e.type === 'EngagementEnded');
    expect(log.events.indexOf(ticks[0] as BattleEvent)).toBeLessThan(engIdx);
  });
});

describe('FR12/FR16 witch cast fizzle (no stack, deterministic)', () => {
  it('second cast fizzles when every LIVING enemy already bears the spell (FR9 global range)', () => {
    // Five water witches (AGI 26) vs five knights (AGI 8): under FR9 global
    // range every enemy is a legal target, so in pass 1 the five witches — all
    // acting before any knight (AGI) — sleep all five knights (rearmost-first,
    // prefer-unafflicted). In pass 2 the three back-row witches still hold a
    // second action, but EVERY living enemy now bears sleep → the cast is
    // wasted, no stack (FR16). A tactic never changes this: prefer-unafflicted
    // filters the legal list to empty, so the cast fizzles regardless.
    const log = resolveBattle(
      setup({
        armies: {
          A: [u('witch', 'water'), u('witch', 'water'), u('witch', 'water'), u('witch', 'water'), u('witch', 'water')],
          B: [u('knight', 'fire'), u('knight', 'wind'), u('knight', 'earth'), u('knight', 'water'), u('knight', 'fire')],
        },
        placements: {
          A: [
            { row: 'back', col: 'left' }, // witch under test: 2 actions
            { row: 'back', col: 'center' }, // 2 actions
            { row: 'back', col: 'right' }, // 2 actions
            { row: 'mid', col: 'left' }, // 1 action (mid row acts first)
            { row: 'mid', col: 'right' }, // 1 action
          ],
          B: [
            { row: 'front', col: 'left' },
            { row: 'front', col: 'center' },
            { row: 'front', col: 'right' },
            { row: 'mid', col: 'left' },
            { row: 'mid', col: 'center' },
          ],
        },
      }),
    );
    const casts = byType(log, 'StatusApplied').filter((s) => s.source === 'A:0');
    expect(casts).toHaveLength(1); // pass 1: A:0 sleeps the rearmost still-unafflicted knight
    expect(casts[0]).toMatchObject({ spell: 'sleep' });
    const fizzles = log.events.filter((e) => e.type === 'ActionFizzled' && e.unit === 'A:0');
    expect(fizzles).toHaveLength(1); // pass 2: everyone asleep → wasted, no stack
  });
});

describe('FR14/FR32 roster wave 1 — new classes act by their ROLE (story 4.3)', () => {
  // Sorceress (Artillery) blasts a row like the Wizard; Berserker (Vanguard) melees the
  // nearest reachable like the Knight. "Start generic" — unique moves/Guard arrive in 4.7.
  const log = resolveBattle(
    setup({
      armies: {
        A: [u('sorceress', 'fire'), u('berserker', 'earth'), u('knight', 'water'), u('mercenary', 'wind'), u('knight', 'fire')],
        B: [u('knight', 'earth'), u('knight', 'water'), u('knight', 'wind'), u('mercenary', 'fire'), u('archer', 'water')],
      },
      placements: {
        A: [
          { row: 'back', col: 'center' }, // sorceress: 2 back-row actions
          { row: 'front', col: 'center' }, // berserker up front
          { row: 'front', col: 'left' },
          { row: 'mid', col: 'center' },
          { row: 'front', col: 'right' },
        ],
        B: [
          { row: 'front', col: 'left' }, // 3-knight front = the fullest row the blast finds
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'center' },
          { row: 'back', col: 'center' },
        ],
      },
    }),
  );

  it('the Sorceress row-blasts (Artillery): every attack is a blast, and one lands on the whole front row', () => {
    const shots = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:0');
    expect(shots.length).toBeGreaterThan(0);
    for (const s of shots) expect(s.kind).toBe('blast');
    expect(shots.some((s) => s.targets.length > 1)).toBe(true); // a real row blast, not a single hit
  });

  it('the Berserker melees a single nearest target (Vanguard): every attack is a slash on one unit', () => {
    const shots = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:1');
    expect(shots.length).toBeGreaterThan(0);
    for (const s of shots) {
      expect(s.kind).toBe('slash');
      expect(s.targets).toHaveLength(1);
    }
  });
});

describe('FR34 tactics wired through resolve (story 4.4)', () => {
  // Override the autonomous defaults from the shared setup() helper.
  const withTactics = (s: MatchSetup, tactics: MatchSetup['tactics'], leaders: MatchSetup['leaders']): MatchSetup => ({ ...s, tactics, leaders });

  it('weakest: a melee unit targets the lowest ABSOLUTE-HP reachable enemy, not the Autonomous pick', () => {
    // A lone knight (front-center) reaches enemy cols {0,1,2}. Two reachable
    // enemies at the SAME nearest row: a knight (140 HP) in the facing column
    // (Autonomous would pick it) and a mage (78 HP) off-facing. Weakest picks
    // the mage by absolute HP; the rest of A/B are parked out of the way.
    const base = setup({
      armies: {
        A: [u('knight', 'fire'), u('cleric', 'water'), u('cleric', 'wind'), u('cleric', 'earth'), u('cleric', 'fire')],
        B: [u('knight', 'earth'), u('mage', 'fire'), u('cleric', 'water'), u('cleric', 'wind'), u('cleric', 'earth')],
      },
      placements: {
        A: [
          { row: 'front', col: 'center' }, // the knight under test (faces enemy col 1)
          { row: 'back', col: 'left' },
          { row: 'back', col: 'center' },
          { row: 'back', col: 'right' },
          { row: 'mid', col: 'left' },
        ],
        B: [
          { row: 'front', col: 'center' }, // B:0 knight (140) — facing column, Autonomous pick
          { row: 'front', col: 'left' }, // B:1 mage (78) — reachable, lower absolute HP
          { row: 'back', col: 'left' },
          { row: 'back', col: 'center' },
          { row: 'back', col: 'right' },
        ],
      },
    });
    const autoFirst = byType(resolveBattle(withTactics(base, { A: 'autonomous', B: 'autonomous' }, { A: 0, B: 0 })), 'UnitAttacked').find(
      (e) => e.source === 'A:0',
    );
    const weakFirst = byType(resolveBattle(withTactics(base, { A: 'weakest', B: 'autonomous' }, { A: 0, B: 0 })), 'UnitAttacked').find(
      (e) => e.source === 'A:0',
    );
    expect(autoFirst?.targets[0]?.unit).toBe('B:0'); // Autonomous: facing-column knight
    expect(weakFirst?.targets[0]?.unit).toBe('B:1'); // Weakest: the lower-HP mage
  });

  it('leader: a ranged unit snipes the designated enemy leader (else Autonomous)', () => {
    const base = setup({
      armies: {
        A: [u('archer', 'fire'), u('cleric', 'water'), u('cleric', 'wind'), u('cleric', 'earth'), u('cleric', 'fire')],
        B: [u('knight', 'earth'), u('knight', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('mage', 'earth')],
      },
      placements: {
        A: [
          { row: 'back', col: 'center' }, // the archer under test
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'left' },
        ],
        B: [
          { row: 'front', col: 'left' }, // B:0
          { row: 'front', col: 'center' }, // B:1 — the designated leader
          { row: 'front', col: 'right' }, // B:2
          { row: 'mid', col: 'center' }, // B:3 — Autonomous rearmost among front/mid... see below
          { row: 'back', col: 'center' }, // B:4 mage — Autonomous (rearmost) pick
        ],
      },
    });
    const auto = byType(resolveBattle(withTactics(base, { A: 'autonomous', B: 'autonomous' }, { A: 0, B: 0 })), 'UnitAttacked').find((e) => e.source === 'A:0');
    const leader = byType(resolveBattle(withTactics(base, { A: 'leader', B: 'autonomous' }, { A: 0, B: 1 })), 'UnitAttacked').find((e) => e.source === 'A:0');
    expect(auto?.targets[0]?.unit).toBe('B:4'); // Autonomous ranged: rearmost (the back mage)
    expect(leader?.targets[0]?.unit).toBe('B:1'); // Leader: the crowned front-center unit
  });

  it('blast under leader targets the LEADER row (D-2c), not the fullest row', () => {
    // B stacks three in the front row (Autonomous blast → front) but crowns the
    // lone back-row unit; under `leader` the Sorceress blasts the back row.
    const base = setup({
      armies: {
        A: [u('sorceress', 'fire'), u('cleric', 'water'), u('cleric', 'wind'), u('cleric', 'earth'), u('cleric', 'fire')],
        B: [u('knight', 'earth'), u('knight', 'fire'), u('knight', 'water'), u('cleric', 'wind'), u('mage', 'earth')],
      },
      placements: {
        A: [
          { row: 'back', col: 'center' }, // the Sorceress under test
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'left' },
        ],
        B: [
          { row: 'front', col: 'left' }, // B:0 ┐
          { row: 'front', col: 'center' }, // B:1 ├ fullest row (3) — Autonomous blast
          { row: 'front', col: 'right' }, // B:2 ┘
          { row: 'mid', col: 'center' }, // B:3
          { row: 'back', col: 'center' }, // B:4 — the designated leader, alone in the back row
        ],
      },
    });
    const auto = byType(resolveBattle(withTactics(base, { A: 'autonomous', B: 'autonomous' }, { A: 0, B: 0 })), 'UnitAttacked').find((e) => e.source === 'A:0');
    const leader = byType(resolveBattle(withTactics(base, { A: 'leader', B: 'autonomous' }, { A: 0, B: 4 })), 'UnitAttacked').find((e) => e.source === 'A:0');
    // Autonomous: the 3-unit front row.
    expect(auto?.targets.map((t) => t.unit).sort()).toEqual(['B:0', 'B:1', 'B:2']);
    // Leader: the back row — just the crowned B:4.
    expect(leader?.targets.map((t) => t.unit)).toEqual(['B:4']);
  });

  it("witch + weakest: casts on the lowest-HP unafflicted enemy, not the rearmost (dossier §4's prefer-unafflicted-then-tactic order)", () => {
    // Global range (FR9), so row doesn't gate legality — only HP should decide
    // under `weakest`. B fields no spellcaster (avoids an AGI-tied witch racing
    // A:0's own cast, e.g. putting her to sleep first) — knight (140 hp, back,
    // the Autonomous rearmost pick) vs. a sorceress (78 hp, front — STRICTLY
    // lower than every other B unit, so weakest has no tie to fall through to
    // Autonomous on) for weakest to prefer.
    const base = setup({
      armies: {
        A: [u('witch', 'fire'), u('cleric', 'water'), u('cleric', 'wind'), u('cleric', 'earth'), u('cleric', 'fire')],
        B: [u('knight', 'earth'), u('sorceress', 'water'), u('cleric', 'wind'), u('cleric', 'earth'), u('cleric', 'fire')],
      },
      placements: {
        A: [
          { row: 'back', col: 'center' }, // the witch under test
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'left' },
        ],
        B: [
          { row: 'back', col: 'center' }, // B:0 knight (140 hp) — rearmost, the Autonomous pick
          { row: 'front', col: 'center' }, // B:1 sorceress (78 hp) — lowest HP, NOT rearmost
          { row: 'front', col: 'left' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'center' },
        ],
      },
    });
    const autoCast = byType(resolveBattle(withTactics(base, { A: 'autonomous', B: 'autonomous' }, { A: 0, B: 0 })), 'StatusApplied').find(
      (e) => e.source === 'A:0',
    );
    const weakCast = byType(resolveBattle(withTactics(base, { A: 'weakest', B: 'autonomous' }, { A: 0, B: 0 })), 'StatusApplied').find(
      (e) => e.source === 'A:0',
    );
    expect(autoCast?.target).toBe('B:0'); // Autonomous: rearmost
    expect(weakCast?.target).toBe('B:1'); // Weakest: lowest HP, wherever it stands
  });

  it('witch + leader: casts on the designated leader when unafflicted, else falls back to Autonomous', () => {
    const base = setup({
      armies: {
        A: [u('witch', 'fire'), u('cleric', 'water'), u('cleric', 'wind'), u('cleric', 'earth'), u('cleric', 'fire')],
        B: [u('knight', 'earth'), u('cleric', 'water'), u('cleric', 'wind'), u('cleric', 'earth'), u('cleric', 'fire')],
      },
      placements: {
        A: [
          { row: 'back', col: 'center' },
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'left' },
        ],
        B: [
          { row: 'back', col: 'center' }, // B:0 — Autonomous rearmost pick
          { row: 'front', col: 'center' }, // B:1 — the designated leader
          { row: 'front', col: 'left' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'center' },
        ],
      },
    });
    const leaderCast = byType(resolveBattle(withTactics(base, { A: 'leader', B: 'autonomous' }, { A: 0, B: 1 })), 'StatusApplied').find(
      (e) => e.source === 'A:0',
    );
    expect(leaderCast?.target).toBe('B:1'); // the crowned unit, not the rearmost B:0
  });
});
