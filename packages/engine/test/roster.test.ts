import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import { createStreams, nextInt } from '../src/rng';
import { ALL_CLASSES, ALL_ROWS } from '../src/types';
import type { BattleEvent, Element, MatchSetup, RowMove, Unit, UnitClass } from '../src/types';

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
      // (B's melee fillers can't touch the back-row archer, and B's mage bolts back at it —
      // 18/cast (24 ×3/4) on 90 hp — so both shots land: 80→50→20, no deaths in between.)
      expect(shot.kind).toBe('arrow');
      expect(shot.targets).toEqual([{ unit: 'B:1', damage: 30, hpAfter: expect.any(Number), outcome: 'hit' }]);
    }
  });
});

describe('story 5.4 `bolt` — the casters’ single-target magic (E5-D4; FR10’s row blast is retired from the roster)', () => {
  const boltBattle = () =>
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

  it('bolts ONE enemy via ranged targeting (rearmost row, then the FR8 column chain) at the unattenuated magic number', () => {
    const log = resolveBattle(boltBattle());
    const bolts = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:2');
    expect(bolts.length).toBeGreaterThan(0);
    for (const b of bolts) {
      expect(b.kind).toBe('bolt');
      expect(b.targets).toHaveLength(1); // single-target — E5-D4's whole point
    }
    // A:2 sits back-center (col 1, facing 1). B's rearmost row is back: B:0
    // (col 0) and B:1 (col 2) — neither facing, equal center distance, the
    // higher column wins the tie → B:1. mage → mage: 30 − floor(22/2) = 19, neutral.
    expect(bolts[0]?.targets[0]?.unit).toBe('B:1');
    expect(bolts[0]?.targets[0]?.damage).toBe(19);
  });

  it('an all-bolt battle consumes ZERO battle-stream draws beyond the engagement tie flip (ADR 0003) — logs are identical across seeds with the same flip', () => {
    // Ten mages, every placement mid/back, so EVERY action is a bolt (no
    // staff, no physical anywhere). The only battle-stream draw left is E1,
    // the engagement tie flip — so two seeds whose first draw lands the same
    // way MUST produce byte-identical logs. If the bolt ever consulted the
    // stream (a stray rollHit, a stray redirect), the drawn values would
    // diverge between the seeds and this equality would break.
    const casters = (): Unit[] => (['fire', 'water', 'wind', 'earth', 'fire'] as const).map((element, i) => u('mage', element, `M${i}`));
    const boltsOnly = (seed: number) =>
      setup(
        {
          armies: { A: casters(), B: casters() },
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
        },
        seed,
      );
    // Find two different seeds with the SAME tie flip, computed exactly as
    // resolveBattle draws it (E1: nextInt(battle, 0, 1)).
    const flip = (seed: number) => nextInt(createStreams(seed).battle, 0, 1);
    const first = 1;
    let second = 2;
    while (flip(second) !== flip(first)) second += 1;
    const a = resolveBattle(boltsOnly(first));
    const b = resolveBattle(boltsOnly(second));
    expect(a.events).toEqual(b.events);
    // And the battle really was all bolts (the fixture's own guard).
    for (const e of a.events) if (e.type === 'UnitAttacked') expect(e.kind).toBe('bolt');
  });

  it('a bolt is MAGIC: it ignores a live Guard charge entirely — full damage, no redirect, no charge consumed (dossier §4)', () => {
    // B's Phalanx guards MID-CENTER (guard-full), shielding itself AND the
    // witch directly behind it (back-center) — exactly the cell A's mage
    // bolts (rearmost row holds only the witch). A physical hit there would
    // be negated to 0 and consume the charge; the bolt must land its full 20
    // (30 − floor(20/2), no relation) with no `redirectedFrom`.
    const log = resolveBattle(
      setup({
        armies: {
          A: [u('mage', 'fire'), u('knight', 'water'), u('knight', 'wind'), u('knight', 'earth'), u('knight', 'fire')],
          // The witch is EARTH (poison) deliberately: a fire witch would
          // Weaken A's mage and halve the very number this test pins.
          B: [u('phalanx', 'earth'), u('witch', 'earth'), u('knight', 'water'), u('knight', 'wind'), u('knight', 'earth')],
        },
        placements: {
          A: [
            { row: 'back', col: 'center' },
            { row: 'front', col: 'left' },
            { row: 'front', col: 'center' },
            { row: 'front', col: 'right' },
            { row: 'mid', col: 'center' },
          ],
          B: [
            { row: 'mid', col: 'center' }, // the guarding Phalanx (guard-full)
            { row: 'back', col: 'center' }, // the shielded witch — the bolt's rearmost pick
            { row: 'front', col: 'left' },
            { row: 'front', col: 'center' },
            { row: 'front', col: 'right' },
          ],
        },
      }),
    );
    const bolts = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:0');
    expect(bolts.length).toBeGreaterThan(0);
    for (const b of bolts.filter((x) => x.targets[0]?.unit === 'B:1')) {
      expect(b.kind).toBe('bolt');
      expect(b.targets[0]?.damage).toBe(20); // never halved (10) or negated (0)
      expect(b.targets[0]?.outcome).toBe('hit'); // magic never crits or is dodged
      expect(b.redirectedFrom).toBeUndefined();
    }
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

describe('FR14/FR32 roster wave 1 — new classes act by their ROLE (story 4.3; casters re-kitted by 5.4/E5-D4)', () => {
  // Sorceress (Artillery) bolts a single rearmost target like the Wizard;
  // Berserker (Vanguard) melees the nearest reachable like the Knight.
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

  it('the Sorceress bolts (Artillery, story 5.4): every attack is a single-target bolt at the rearmost enemy', () => {
    const shots = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:0');
    expect(shots.length).toBeGreaterThan(0);
    for (const s of shots) {
      expect(s.kind).toBe('bolt');
      expect(s.targets).toHaveLength(1); // E5-D4: the splash is gone
    }
    // Rearmost = B's lone back-row archer (back-center — her facing column).
    expect(shots[0]?.targets[0]?.unit).toBe('B:4');
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

describe('story 5.4 human wave — the mixed kits route by ROW MOVE (ROSTER.md; E5-D10/E5-D14)', () => {
  // One fixture, three units under test: a back-row Valkyrie (Lightning
  // `bolt` ×2 — magic, zero draws), a back-row Vultan (Wind Shot `arrow` ×2 —
  // physical, ranged), and a front-row Raven (Talon Strike `slash` melee).
  const log = resolveBattle(
    setup({
      armies: {
        A: [u('valkyrie', 'fire'), u('vultan', 'earth'), u('raven', 'water'), u('fencer', 'wind'), u('dragonhunter', 'fire')],
        B: [u('knight', 'earth'), u('knight', 'water'), u('knight', 'wind'), u('knight', 'fire'), u('knight', 'earth')],
      },
      placements: {
        A: [
          { row: 'back', col: 'left' }, // valkyrie: Lightning ×2
          { row: 'back', col: 'right' }, // vultan: Wind Shot ×2
          { row: 'front', col: 'center' }, // raven: melee up close
          { row: 'front', col: 'left' }, // fencer: melee
          { row: 'front', col: 'right' }, // dragon hunter: melee
        ],
        B: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          // Mid-LEFT deliberately: a mid-CENTER knight's Half Guard (its row
          // move) would shield back-center B:4 — the exact cell both ranged
          // tests below pin damage numbers on.
          { row: 'mid', col: 'left' },
          { row: 'back', col: 'center' },
        ],
      },
    }),
  );

  it('the back-row Valkyrie casts Lightning: kind `bolt`, single target, MAGIC (never crits/dodges), at the INT-18 number', () => {
    const shots = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:0');
    expect(shots.length).toBe(2); // back row: 2 actions (her side-gun row)
    for (const s of shots) {
      expect(s.kind).toBe('bolt');
      expect(s.targets).toHaveLength(1);
      expect(s.targets[0]?.outcome).toBe('hit'); // magic: no crit, no dodge
      // Rearmost = B:4 (back-center): 18 − floor(14/2) = 11, no relation.
      expect(s.targets[0]?.unit).toBe('B:4');
      expect(s.targets[0]?.damage).toBe(11);
    }
  });

  it('the back-row Vultan fires Wind Shot: kind `arrow`, single target, PHYSICAL ranged (rearmost, over the front)', () => {
    const shots = byType(log, 'UnitAttacked').filter((a) => a.source === 'A:1');
    expect(shots.length).toBe(2); // back row: 2 actions
    for (const s of shots) {
      expect(s.kind).toBe('arrow');
      expect(s.targets).toHaveLength(1);
      expect(s.targets[0]?.unit).toBe('B:4'); // rearmost — an arrow arcs over the front line
      // Physical: 26 − floor(28/2) = 12 neutral; a crit lands 18, a dodge 0.
      expect([0, 12, 18]).toContain(s.targets[0]?.damage);
    }
  });

  it('the front-row Raven / Fencer / Dragon Hunter melee: kind `slash`, one nearest reachable target', () => {
    for (const source of ['A:2', 'A:3', 'A:4']) {
      const shots = byType(log, 'UnitAttacked').filter((a) => a.source === source);
      expect(shots.length).toBeGreaterThan(0);
      for (const s of shots) {
        expect(s.kind).toBe('slash');
        expect(s.targets).toHaveLength(1);
      }
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

  it('bolt under leader snipes the crowned unit directly (story 5.4) — ranged targeting, so the tactic picks across rows', () => {
    // Autonomous bolt → the rearmost B:4; crowning FRONT-CENTER B:1 must pull
    // the bolt off its rearmost pick and onto the leader (FR9 global range:
    // rows never gate a ranged tactic).
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
          { row: 'front', col: 'left' }, // B:0
          { row: 'front', col: 'center' }, // B:1 — crowned in the leader run
          { row: 'front', col: 'right' }, // B:2
          { row: 'mid', col: 'center' }, // B:3
          { row: 'back', col: 'center' }, // B:4 — rearmost: the Autonomous bolt pick
        ],
      },
    });
    const auto = byType(resolveBattle(withTactics(base, { A: 'autonomous', B: 'autonomous' }, { A: 0, B: 0 })), 'UnitAttacked').find((e) => e.source === 'A:0');
    const leader = byType(resolveBattle(withTactics(base, { A: 'leader', B: 'autonomous' }, { A: 0, B: 1 })), 'UnitAttacked').find((e) => e.source === 'A:0');
    // Autonomous: the rearmost enemy, one target.
    expect(auto?.targets.map((t) => t.unit)).toEqual(['B:4']);
    // Leader: the crowned front-center unit, one target.
    expect(leader?.targets.map((t) => t.unit)).toEqual(['B:1']);
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

describe('FR32/FR33 per-row moves (story 4.7, dossier §4; revised by story 5.4 / ROSTER.md) — the table is TOTAL over every (class, row)', () => {
  // ROSTER.md's normative table (epic-5 dossier, approved E5-D15): the 5.4
  // human wave joins, and the shipped-12 revision lands — casters' mid/back
  // is the single-target `bolt` now (E5-D4, splash retired), the Valkyrie's
  // back row is her Lightning bolt (E5-D10), and Vultan/Raven carry the
  // back-row `arrow` Skills (E5-D14). Everyone else repeats one uniform kind.
  const FROZEN_TABLE: Record<UnitClass, { front: RowMove; mid: RowMove; back: RowMove }> = {
    knight: { front: 'slash', mid: 'guard-half', back: 'slash' },
    mercenary: { front: 'slash', mid: 'slash', back: 'slash' },
    archer: { front: 'arrow', mid: 'arrow', back: 'arrow' },
    mage: { front: 'staff', mid: 'bolt', back: 'bolt' },
    cleric: { front: 'staff', mid: 'staff', back: 'staff' },
    witch: { front: 'staff', mid: 'staff', back: 'staff' }, // unreachable — the Witch never strikes
    berserker: { front: 'slash', mid: 'slash', back: 'slash' },
    phalanx: { front: 'guard-full', mid: 'guard-full', back: 'bash' },
    ninja: { front: 'slash', mid: 'slash', back: 'slash' },
    valkyrie: { front: 'slash', mid: 'slash', back: 'bolt' },
    sorceress: { front: 'staff', mid: 'bolt', back: 'bolt' },
    golem: { front: 'slash', mid: 'slash', back: 'slash' }, // story 4.8 — uniform melee, "everyone else" bucket
    // Story 5.4 — the human wave (ROSTER.md).
    fencer: { front: 'slash', mid: 'slash', back: 'slash' },
    dragonhunter: { front: 'slash', mid: 'slash', back: 'slash' },
    hawkman: { front: 'slash', mid: 'slash', back: 'slash' },
    vultan: { front: 'slash', mid: 'slash', back: 'arrow' },
    raven: { front: 'slash', mid: 'slash', back: 'arrow' },
    // Story 5.5 — the monster wave (ROSTER.md §Monsters): bites/claws over
    // `slash`, the Gryphon's back-row Wind Shot over `arrow` (E5-D14), the
    // grown dragons' back-row `breath` (E5-D7).
    gryphon: { front: 'slash', mid: 'slash', back: 'arrow' },
    wyrm: { front: 'slash', mid: 'slash', back: 'slash' },
    hellhound: { front: 'slash', mid: 'slash', back: 'slash' },
    whelp: { front: 'slash', mid: 'slash', back: 'slash' },
    emberdrake: { front: 'slash', mid: 'slash', back: 'breath' },
    frostfang: { front: 'slash', mid: 'slash', back: 'breath' },
    stormscale: { front: 'slash', mid: 'slash', back: 'breath' },
    cragmaw: { front: 'slash', mid: 'slash', back: 'breath' },
    nightwing: { front: 'slash', mid: 'slash', back: 'breath' },
    halowing: { front: 'slash', mid: 'slash', back: 'breath' },
  };

  it('every (class, row) resolves the exact pinned move — total over ALL_CLASSES × ALL_ROWS, no gaps', () => {
    for (const cls of ALL_CLASSES) {
      for (const row of ALL_ROWS) {
        expect(BALANCE.classes[cls].moves[row], `${cls}/${row}`).toBe(FROZEN_TABLE[cls][row]);
      }
    }
  });

  it('exactly the row-varied classes vary their move by row — everyone else is uniform across all three rows', () => {
    const varies = (cls: UnitClass) => new Set(ALL_ROWS.map((row) => BALANCE.classes[cls].moves[row])).size > 1;
    const varying = ALL_CLASSES.filter(varies);
    expect(new Set(varying)).toEqual(
      new Set([
        'knight',
        'phalanx',
        'mage',
        'sorceress',
        'valkyrie',
        'vultan',
        'raven',
        // Story 5.5: the Gryphon's back-row shot and the six breath dragons.
        'gryphon',
        'emberdrake',
        'frostfang',
        'stormscale',
        'cragmaw',
        'nightwing',
        'halowing',
      ]),
    );
  });

  it('no class row is a back-row Guard — FORBIDDEN as data (E5-D12a): `attackMoveOf`’s guard fallback reads moves.back, which must stay a real attack', () => {
    for (const cls of ALL_CLASSES) {
      const back = BALANCE.classes[cls].moves.back;
      expect(back === 'guard-full' || back === 'guard-half', `${cls}/back must not Guard`).toBe(false);
    }
  });

  it('the Wizard(mage)/Sorceress FRONT row uses MELEE targeting for its physical staff — distinct from mid/back row-blast (dossier §4)', () => {
    // A:0 = mage, front-center (staff, melee-targeted); an enemy sits directly
    // across from it AND another off to the side, out of melee reach — if the
    // staff used global/ranged targeting (like the Cleric's fallback) it could
    // reach the off-reach unit too; melee targeting proves it can't.
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            u('mage', 'fire', 'Aldric'),
            u('cleric', 'water', 'Berold'),
            u('cleric', 'wind', 'Cedric'),
            u('cleric', 'earth', 'Doran'),
            u('cleric', 'fire', 'Edmund'),
          ],
          B: [
            u('knight', 'earth', 'Falk'),
            u('knight', 'fire', 'Gorm'),
            u('knight', 'water', 'Hask'),
            u('knight', 'wind', 'Ivo'),
            u('knight', 'earth', 'Jarek'),
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'center' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'left' },
          ],
          B: [
            { row: 'front', col: 'center' }, // reachable — A:0's facing column
            { row: 'back', col: 'center' }, // NOT reachable by melee, but IS by ranged/global — the discriminator
            { row: 'front', col: 'left' },
            { row: 'front', col: 'right' },
            { row: 'mid', col: 'center' },
          ],
        },
      }),
    );
    const staffHits = byType(log, 'UnitAttacked').filter((e) => e.source === 'A:0');
    expect(staffHits.length).toBeGreaterThan(0);
    for (const hit of staffHits) {
      expect(hit.kind).toBe('staff');
      // Melee targeting (FR7 reach + FR8 blockade) never picks the sole
      // back-row knight (B:1) — only the nearest-row reachable knights.
      expect(hit.targets.map((t) => t.unit)).not.toContain('B:1');
    }
  });
});

/**
 * Story 5.5 `breath` — the dragons' PHYSICAL row-AoE (dossier E5-D7). Its
 * TARGETING is the blast's, verbatim (fullest enemy row, ties to the rearmost,
 * with the D-2c leader-tactic override); its ARITHMETIC is physical (STR vs
 * VIT, `breathDamage` — table-pinned in damage.test.ts); and like every AoE it
 * consumes ZERO battle-stream draws (ADR 0003), which is what keeps crit,
 * dodge and Guard out of it.
 *
 * Note on placements: a dragon only breathes from the BACK row (the move
 * table), and a monster reserves all 8 king-move neighbours, so these fixtures
 * put the dragon at a back cell and everything else in the front row — that
 * is not test convenience, it is the only shape the rules allow.
 */
describe('story 5.5 `breath` — the dragons’ physical row-AoE (E5-D7)', () => {
  /** A back-center Emberdrake (breath ×1) behind a three-knight front line; 2 + 1 + 1 + 1 = 5 slots, the knight at index 1 wears the crown. */
  const breathSideA = {
    army: [u('emberdrake', 'fire', 'Cindrath'), u('knight', 'water', 'Kain'), u('knight', 'wind', 'Ulf'), u('knight', 'earth', 'Falk')],
    placement: [
      { row: 'back', col: 'center' },
      { row: 'front', col: 'left' },
      { row: 'front', col: 'center' },
      { row: 'front', col: 'right' },
    ],
  } as const;

  const fiveMercs = () => (['fire', 'water', 'wind', 'earth', 'fire'] as const).map((element, i) => u('mercenary', element, `M${i}`));

  /** Emberdrake AGI 16 > mercenary 14 > knight 8, so the breath is the FIRST action of pass 1 — every target is at full HP and nothing has died yet. */
  const breathBattle = (
    bPlacement: MatchSetup['placements']['B'],
    leaders = { A: 1, B: 0 },
    tactics: MatchSetup['tactics'] = { A: 'autonomous', B: 'autonomous' },
  ) => ({
    ...setup({ armies: { A: [...breathSideA.army], B: fiveMercs() }, placements: { A: [...breathSideA.placement], B: bPlacement } }),
    leaders,
    tactics,
  });

  const breathsOf = (log: { events: readonly BattleEvent[] }) => byType(log, 'UnitAttacked').filter((a) => a.kind === 'breath');

  it('breathes over the FULLEST enemy row — every unit in it, one event, at the physical STR-vs-VIT number', () => {
    const log = resolveBattle(
      breathBattle([
        { row: 'front', col: 'left' },
        { row: 'front', col: 'center' },
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'center' },
        { row: 'back', col: 'center' },
      ]),
    );
    const breaths = breathsOf(log);
    expect(breaths).toHaveLength(1); // back row = 1 action
    // B's front row holds 3 of its 5 units — the fullest. Emberdrake STR 34 −
    // floor(mercenary VIT 20 / 2) = 24, neutral (the `dragon` role has no
    // relation except being HUNTED, E5-P1 — so no ×3/2 either way).
    expect(breaths[0]?.targets).toEqual([
      { unit: 'B:0', damage: 24, hpAfter: 86, outcome: 'hit' },
      { unit: 'B:1', damage: 24, hpAfter: 86, outcome: 'hit' },
      { unit: 'B:2', damage: 24, hpAfter: 86, outcome: 'hit' },
    ]);
  });

  it('ties break toward the REARMOST row (the blast rule, unchanged): 2 front vs 2 back → the back pair burns', () => {
    const log = resolveBattle(
      breathBattle([
        { row: 'front', col: 'left' },
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'center' },
        { row: 'back', col: 'left' },
        { row: 'back', col: 'right' },
      ]),
    );
    expect(breathsOf(log)[0]?.targets.map((t) => t.unit)).toEqual(['B:3', 'B:4']);
  });

  it('under the Attack-Leader tactic it burns the enemy LEADER’s row, not the fullest (D-2c — the AoE treats the leader as focal point)', () => {
    // B's front row is fullest (3) but its leader stands ALONE at mid/center,
    // so the breath hits exactly one unit — the tactic override costs the
    // dragon its coverage, which is the interesting half of D-2c.
    const log = resolveBattle(
      breathBattle(
        [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'center' },
          { row: 'back', col: 'center' },
        ],
        { A: 1, B: 3 },
        { A: 'leader', B: 'autonomous' },
      ),
    );
    expect(breathsOf(log)[0]?.targets).toEqual([{ unit: 'B:3', damage: 24, hpAfter: 86, outcome: 'hit' }]);
  });

  it('WIPEOUT applies the same cross-engagement ×3/4 attenuation the blast gets (ROSTER.md’s 5.5 carry): 21 → 15, 19 → 14', () => {
    const dragonsAndWall = () => [u('emberdrake', 'fire', 'Cindrath'), u('cragmaw', 'earth', 'Korvassa'), u('phalanx', 'water', 'Bram')];
    // Back corners are 2 columns apart, so neither dragon is a king-move
    // neighbour of the other; their rings clear the mid row, leaving
    // front/center for the phalanx (the only human — and so the only leader).
    const cells = (): MatchSetup['placements']['A'] => [
      { row: 'back', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'front', col: 'center' },
    ];
    const build = (mode: 'single' | 'wipeout') => ({
      ...setup({ armies: { A: dragonsAndWall(), B: dragonsAndWall() }, placements: { A: cells(), B: cells() } }),
      mode,
      leaders: { A: 2, B: 2 },
    });
    // Each side's fullest row is its BACK pair, so every breath hits both
    // enemy dragons: emberdrake 34 − 13 = 21 / 34 − 15 = 19 unattenuated.
    const single = breathsOf(resolveBattle(build('single') as MatchSetup));
    expect(single[0]?.targets.map((t) => t.damage)).toEqual([21, 19]);
    const wipeout = breathsOf(resolveBattle(build('wipeout') as MatchSetup));
    expect(wipeout[0]?.targets.map((t) => t.damage)).toEqual([15, 14]); // floor(21×3/4), floor(19×3/4)
  });

  it('an all-breath battle consumes ZERO battle-stream draws beyond the engagement tie flip (ADR 0003) — logs identical across seeds with the same flip', () => {
    // Two dragons breathing from the back plus a phalanx raising a Guard —
    // and a Guard costs no draws either, so the ONLY battle-stream draw in the
    // whole battle is E1, the engagement tie flip. Same shape as story 5.4's
    // all-bolt discriminator: if breath ever consulted the stream (a stray
    // rollHit for crit/dodge), the two seeds would diverge here.
    const boardOnly = (seed: number) => ({
      ...setup(
        {
          armies: {
            A: [u('emberdrake', 'fire', 'Cindrath'), u('cragmaw', 'earth', 'Korvassa'), u('phalanx', 'water', 'Bram')],
            B: [u('halowing', 'fire', 'Zephyrax'), u('frostfang', 'water', 'Fyrnwyn'), u('phalanx', 'earth', 'Gerhart')],
          },
          placements: {
            A: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'front', col: 'center' },
            ],
            B: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'front', col: 'center' },
            ],
          },
        },
        seed,
      ),
      leaders: { A: 2, B: 2 },
    });
    const flip = (seed: number) => nextInt(createStreams(seed).battle, 0, 1);
    let second = 2;
    while (flip(second) !== flip(1)) second += 1;
    const a = resolveBattle(boardOnly(1) as MatchSetup);
    const b = resolveBattle(boardOnly(second) as MatchSetup);
    expect(a.events).toEqual(b.events);
    // And the battle really was breath-only (the fixture's own guard).
    for (const e of a.events) if (e.type === 'UnitAttacked') expect(e.kind).toBe('breath');
  });

  it('breath NEVER crits, dodges, or is Guarded — every target outcome is a plain `hit`, across many seeds and both modes', () => {
    // Why this invariant instead of a positive "a raised Guard does not halve
    // a breath" fixture: with the shipped data such a fixture is not
    // constructible. Guard is raised when its owner ACTS, turn order is AGI
    // descending, and every guard row in the roster belongs to a slow class
    // (Phalanx AGI 6, Knight 8) while every breath dragon is faster (10–18) —
    // so a dragon's single back-row action always resolves BEFORE any guard
    // goes up, and guards are cleared at each engagement's end (resolve.ts).
    // The invariant below is therefore the honest form: it holds over battles
    // that DO contain guardians, crit-heavy DEX, and dodge-heavy defenders.
    for (let seed = 1; seed <= 30; seed += 1) {
      for (const mode of ['single', 'wipeout'] as const) {
        const log = resolveBattle({
          ...setup(
            {
              armies: {
                A: [u('stormscale', 'fire', 'Skalveth'), u('knight', 'water', 'Kain'), u('knight', 'wind', 'Ulf'), u('knight', 'earth', 'Falk')],
                // Phalanx guards, Fencer dodges and crits, Archer is glass — every roll-driven mechanic present.
                B: [
                  u('phalanx', 'earth', 'Bram'),
                  u('fencer', 'fire', 'Lys'),
                  u('archer', 'water', 'Vess'),
                  u('cleric', 'wind', 'Sela'),
                  u('fencer', 'fire', 'Dax'),
                ],
              },
              placements: {
                A: [
                  { row: 'back', col: 'center' },
                  { row: 'front', col: 'left' },
                  { row: 'front', col: 'center' },
                  { row: 'front', col: 'right' },
                ],
                B: [
                  { row: 'front', col: 'center' },
                  { row: 'front', col: 'left' },
                  { row: 'mid', col: 'center' },
                  { row: 'back', col: 'center' },
                  { row: 'front', col: 'right' },
                ],
              },
            },
            seed,
          ),
          mode,
          leaders: { A: 1, B: 0 },
        } as MatchSetup);
        const breaths = breathsOf(log);
        expect(breaths.length, `seed ${seed} ${mode} produced no breath — the fixture stopped testing anything`).toBeGreaterThan(0);
        for (const b of breaths) {
          for (const t of b.targets) expect(t.outcome, `seed ${seed} ${mode}: breath target ${t.unit}`).toBe('hit');
        }
        // A breath is a single-source AoE: it can never carry the misfire
        // redirect marker a single-target physical strike uses.
        for (const b of breaths) expect(b.redirectedFrom).toBeUndefined();
      }
    }
  });

  it('a CONFUSED dragon breathes on its OWN fullest row — itself included (row-consistent, the self-blast rule’s physical twin)', () => {
    // A's wind Witch (AGI 26, back/center) casts on the rearmost occupied
    // enemy row — B's back-row dragons — then B:1 (Cragmaw, AGI 10) misfires
    // on the probed seed 1. Its own fullest row is that same back pair, so the
    // Cragmaw burns its Emberdrake ally for 30 − 13 = 17 AND ITSELF for
    // 30 − 15 = 15: unlike the 5.4 bolt misfire (single-target, cannot hit the
    // caster), a row-AoE misfire can.
    const log = resolveBattle({
      ...setup(
        {
          armies: {
            A: [
              u('witch', 'wind', 'Sylwen'),
              u('knight', 'fire', 'Bramgar'),
              u('cleric', 'water', 'Nerienne'),
              u('knight', 'earth', 'Thorvald'),
              u('mercenary', 'fire', 'Kestrel'),
            ],
            B: [u('emberdrake', 'fire', 'Cindrath'), u('cragmaw', 'earth', 'Korvassa'), u('phalanx', 'water', 'Bram')],
          },
          placements: {
            A: [
              { row: 'back', col: 'center' },
              { row: 'front', col: 'center' },
              { row: 'back', col: 'left' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'right' },
            ],
            B: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'front', col: 'center' },
            ],
          },
        },
        1,
      ),
      leaders: { A: 0, B: 2 },
    } as MatchSetup);
    const misfireIdx = log.events.findIndex((e) => e.type === 'ActionMisfired');
    expect(misfireIdx, 'seed 1 no longer misfires — re-probe the pin').toBeGreaterThanOrEqual(0);
    expect(log.events[misfireIdx]).toEqual({ type: 'ActionMisfired', unit: 'B:1' });
    expect(log.events[misfireIdx + 1]).toEqual({
      type: 'UnitAttacked',
      source: 'B:1',
      kind: 'breath',
      targets: [
        { unit: 'B:0', damage: 17, hpAfter: 253, outcome: 'hit' },
        { unit: 'B:1', damage: 15, hpAfter: 275, outcome: 'hit' },
      ],
    });
  });
  it('the FR35 sober package DOES cut breath — it is physical (the wired-in proof, not just the arithmetic)', () => {
    // Wipeout, probed seed 1. A's leader is a front-row Wizard (80 hp) that B's
    // mercenaries cut down; B's leader (B:0) falls to the breath first, so the
    // log contains a clean BEFORE/AFTER pair for the same Emberdrake:
    //   BEFORE any fall: 34 − 10 = 24 → wipeout att 18
    //   AFTER both fell: 18 → dealt floor(13.5) = 13 → taken floor(16.25) = 16
    // If `leaderPenaltyBreath` were not wired into act()'s breath branch, the
    // AFTER number would still read 18. (Guard/crit/dodge stay out regardless —
    // they gate on the single-target roll breath never makes.)
    const log = resolveBattle({
      ...setup(
        {
          armies: {
            A: [u('emberdrake', 'fire', 'Cindrath'), u('mage', 'water', 'Aldous'), u('knight', 'wind', 'Ulf'), u('knight', 'earth', 'Falk')],
            B: (['fire', 'water', 'wind', 'earth', 'fire'] as const).map((element, i) => u('mercenary', element, `M${i}`)),
          },
          placements: {
            A: [
              { row: 'back', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'center' },
              { row: 'front', col: 'right' },
            ],
            B: [
              { row: 'front', col: 'left' },
              { row: 'front', col: 'center' },
              { row: 'front', col: 'right' },
              { row: 'mid', col: 'center' },
              { row: 'back', col: 'center' },
            ],
          },
        },
        1,
      ),
      mode: 'wipeout',
      leaders: { A: 1, B: 0 },
    } as MatchSetup);
    const fellA = log.events.findIndex((e) => e.type === 'LeaderFell' && e.side === 'A');
    expect(fellA, 'seed 1 no longer drops A\u2019s leader \u2014 re-probe the pin').toBeGreaterThanOrEqual(0);
    // The BEFORE window ends at the FIRST fall of EITHER side (review
    // hardening, 2026-07-28): B's leader falls a few beats before A's, and a
    // breath landing between the two falls would read 22 (dealt-unpenalized,
    // taken \u00d75/4) \u2014 correct behaviour, but in neither pinned set. Anchoring
    // the windows around both falls keeps a future re-tune from turning this
    // into a confusing failure instead of a clean re-probe.
    const firstFall = log.events.findIndex((e) => e.type === 'LeaderFell');
    const breathDamages = (events: readonly BattleEvent[]) =>
      events
        .filter((e): e is Extract<BattleEvent, { type: 'UnitAttacked' }> => e.type === 'UnitAttacked' && e.kind === 'breath')
        .flatMap((b) => b.targets.map((t) => t.damage));
    expect(new Set(breathDamages(log.events.slice(0, firstFall)))).toEqual(new Set([18]));
    expect(new Set(breathDamages(log.events.slice(fellA)))).toEqual(new Set([16]));
  });
});
