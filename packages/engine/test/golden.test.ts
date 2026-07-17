import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import type { MatchSetup, Unit } from '../src/types';

/**
 * Golden battles (NFR2): full BattleLog snapshots for fixed setups/seeds.
 * They guard against accidental RULE changes when tuning numbers — an
 * intentional rules/balance change re-records these deliberately
 * (`vitest -u`) with the diff reviewed event by event.
 *
 * Story 4.2 re-authored all eight as 5-slot armies (re-recorded once, at the
 * end of the era-turnover work), KEEPING each golden's scenario intent.
 * Goldens #1/#6/#7 reuse wipeout.test.ts's fixtures verbatim — their
 * engagement-by-engagement arithmetic is hand-derived there and the verdicts
 * here match those derivations exactly.
 */
function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, seed: number, mode: MatchSetup['mode'] = 'single'): MatchSetup {
  return {
    seed,
    balanceVersion: BALANCE.version,
    mode,
    tactics: { A: 'autonomous', B: 'autonomous' },
    leaders: { A: 0, B: 0 },
    ...partial,
  };
}

/** One drafted unit. Names are FR37 flavor — required data, zero gameplay effect. */
function u(cls: Unit['class'], element: Unit['element'], name: string): Unit {
  return { class: cls, element, name };
}

/** The 5-knight wall (front L/C/R + mid L/R) — shared by goldens #1/#3/#6/#7. */
const WALL: MatchSetup['placements']['A'] = [
  { row: 'front', col: 'left' },
  { row: 'front', col: 'center' },
  { row: 'front', col: 'right' },
  { row: 'mid', col: 'left' },
  { row: 'mid', col: 'right' },
];

const FIVE_KNIGHTS: Unit[] = [
  u('knight', 'fire', 'Aldric'),
  u('knight', 'water', 'Berold'),
  u('knight', 'wind', 'Cedric'),
  u('knight', 'earth', 'Doran'),
  u('knight', 'fire', 'Edmund'),
];

/** Knights vs the healing cleric column — wipeout.test.ts's `knightsVsClerics` fixture verbatim (its comment hand-derives the damage lanes and the steady state). */
const CLERIC_COLUMN = {
  armies: {
    A: [...FIVE_KNIGHTS],
    B: [u('cleric', 'earth', 'Mira'), u('cleric', 'fire', 'Nessa'), u('cleric', 'water', 'Olwen'), u('cleric', 'wind', 'Petra'), u('cleric', 'earth', 'Quinn')],
  },
  placements: {
    A: [...WALL],
    B: [
      { row: 'front', col: 'right' },
      { row: 'mid', col: 'right' },
      { row: 'back', col: 'right' },
      { row: 'back', col: 'left' },
      { row: 'back', col: 'center' },
    ],
  },
} satisfies Pick<MatchSetup, 'armies' | 'placements'>;

/** The mirrored earth-witch poison duel — arrows vs dots (goldens #5/#8). */
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

describe('golden battles', () => {
  it('golden #1: knights grind through a healing cleric column (staff clamp + heal visible)', () => {
    const log = resolveBattle(setup(CLERIC_COLUMN, 0xdead));
    // Verdict matches wipeout.test.ts's hand-derived engagement-1 state
    // exactly: A loses only eng-1 staff pokes (A:3 −3, A:4 −2 → 695/700 =
    // 99%); B's back-line heals hold the lanes at 348/450 = 77%.
    const verdict = log.events[log.events.length - 1];
    if (verdict?.type === 'BattleEnded') {
      expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 99, B: 77 } });
    }
    expect(log.events.some((e) => e.type === 'UnitHealed')).toBe(true);
    expect(log).toMatchSnapshot();
  });

  it('golden #2: an HP-percentage decision — the water witch sleeps attackers, margins stay razor-thin', () => {
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              u('knight', 'fire', 'Kain'),
              u('mercenary', 'water', 'Brand'),
              u('archer', 'wind', 'Lyra'),
              u('mercenary', 'fire', 'Dario'),
              u('cleric', 'earth', 'Sela'),
            ],
            B: [
              u('mercenary', 'earth', 'Falk'),
              u('mercenary', 'fire', 'Gorm'),
              u('witch', 'water', 'Morwen'),
              u('knight', 'wind', 'Roland'),
              u('cleric', 'water', 'Ithil'),
            ],
          },
          placements: {
            A: [
              { row: 'front', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'back', col: 'center' },
              { row: 'front', col: 'right' },
              { row: 'back', col: 'left' },
            ],
            B: [
              { row: 'front', col: 'center' },
              { row: 'mid', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'front', col: 'left' },
              { row: 'back', col: 'center' },
            ],
          },
        },
        0xcafe,
      ),
    );
    // Trace-verified for 4.2's 5-slot fixture (sleep mechanics themselves are
    // pinned by roster.test): the water witch's sleeps visibly void three
    // attacker turns, and the verdict is a CLOSE exact-fraction call — B by
    // 87% to 85%, nobody dead.
    const verdict = log.events[log.events.length - 1];
    if (verdict?.type === 'BattleEnded') {
      expect(verdict).toEqual({ type: 'BattleEnded', winner: 'B', hpPct: { A: 85, B: 87 } });
    }
    expect(log.events.filter((e) => e.type === 'ActionSkipped' && e.reason === 'asleep').length).toBeGreaterThanOrEqual(3);
    expect(log.events.some((e) => e.type === 'UnitDied')).toBe(false);
    expect(log).toMatchSnapshot();
  });

  it('golden #3: an exact-tie draw — mirrored knight walls, symmetric totals', () => {
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [...FIVE_KNIGHTS],
            B: [
              u('knight', 'earth', 'Falk'),
              u('knight', 'fire', 'Gorm'),
              u('knight', 'water', 'Hask'),
              u('knight', 'wind', 'Ivo'),
              u('knight', 'earth', 'Jarek'),
            ],
          },
          placements: { A: [...WALL], B: [...WALL] },
        },
        0xfeed,
      ),
    );
    const verdict = log.events[log.events.length - 1];
    if (verdict?.type === 'BattleEnded') expect(verdict.winner).toBe('draw');
    expect(log).toMatchSnapshot();
  });
});

describe('golden battles (story 1.6 — full roster era)', () => {
  it('golden #4: the mage blast — archers soften a row, one blast kills two', () => {
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              u('archer', 'fire', 'Lyra'),
              u('archer', 'water', 'Vess'),
              u('mage', 'wind', 'Magnus'),
              u('knight', 'fire', 'Kain'),
              u('mercenary', 'water', 'Brand'),
            ],
            B: [
              u('mage', 'earth', 'Osric'),
              u('mage', 'fire', 'Aldous'),
              u('knight', 'water', 'Roland'),
              u('knight', 'earth', 'Falk'),
              u('mercenary', 'fire', 'Gorm'),
            ],
          },
          placements: {
            A: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'back', col: 'center' },
              { row: 'front', col: 'center' },
              { row: 'front', col: 'left' },
            ],
            B: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'front', col: 'center' },
              { row: 'mid', col: 'left' },
              { row: 'mid', col: 'right' },
            ],
          },
        },
        7,
      ),
    );
    // Hand-derived for the 5-slot fixture: B's back row (2 mages) stays the
    // blast target (front 1 / mid 2 / back 2 — the tie breaks rearmost); each
    // A archer softens its reach-mirrored mage 30/shot (80→50→20), A's mage
    // blasts 19 per pass (→31 after pass 1... with B:0's own pass-2 blast
    // interleaved the pair sits at 1 hp), and the pass-2 blast finishes BOTH
    // with one two-target event. A's front pair now screens the back row from
    // B's melee, so — unlike the 3-unit era — only the two mages fall.
    expect(log.events.filter((e) => e.type === 'UnitDied').map((e) => e.unit)).toEqual(['B:0', 'B:1']);
    const killingBlast = log.events.filter((e) => e.type === 'UnitAttacked' && e.source === 'A:2')[1];
    if (killingBlast?.type === 'UnitAttacked') {
      expect(killingBlast.targets.every((t) => t.hpAfter === 0)).toBe(true);
      const i = log.events.indexOf(killingBlast);
      expect(log.events[i + 1]?.type).toBe('UnitDied');
      expect(log.events[i + 2]?.type).toBe('UnitDied');
    }
    expect(log).toMatchSnapshot();
  });

  it('golden #5: the poison duel — mirrored earth witches, ticks land but the arrows kill first', () => {
    const log = resolveBattle(setup(POISON_DUEL, 5));
    // Trace-verified for the 5-slot fixture (each tick hand-checked at
    // poisonDamage 15: archer 90→75, witch 85→70, merc 110→95): three
    // non-fatal ticks at the natural end, while B's witch falls to the
    // hunt-boosted arrows (×3/2) mid-engagement — her death comes from a
    // UnitAttacked, never a tick.
    expect(log.events.filter((e) => e.type === 'PoisonTicked').length).toBe(3);
    expect(log.events.some((e) => e.type === 'PoisonTicked' && e.hpAfter === 0)).toBe(false);
    expect(log.events.filter((e) => e.type === 'UnitDied').map((e) => e.unit)).toEqual(['B:0']);
    expect(log.events[log.events.length - 1]).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 76, B: 70 } });
    expect(log).toMatchSnapshot();
  });
});

describe('golden battles (story 1.10 — until-wipeout mode)', () => {
  it('golden #6: the multi-engagement wipe — knights grind mercs down over four engagements', () => {
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [...FIVE_KNIGHTS],
            B: [
              u('mercenary', 'earth', 'Falk'),
              u('mercenary', 'fire', 'Gorm'),
              u('mercenary', 'water', 'Hask'),
              u('mercenary', 'wind', 'Ivo'),
              u('mercenary', 'earth', 'Jarek'),
            ],
          },
          placements: { A: [...WALL], B: [...WALL] },
        },
        0xdead,
        'wipeout',
      ),
    );
    // wipeout.test.ts's `knightsVsMercs` fixture verbatim — its comment
    // hand-derives the full grind (flank mercs die eng 2, center eng 3, mids
    // eng 4; A ends 448/700). Winner A, 64% vs 0%, four engagements.
    expect(log.events.filter((e) => e.type === 'EngagementEnded').length).toBe(4);
    const verdict = log.events[log.events.length - 1];
    expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 64, B: 0 } });
    expect(log).toMatchSnapshot();
  });

  it('golden #7: the cap fallback — a healing equilibrium runs all ten engagements, then FR18 judges', () => {
    const log = resolveBattle(setup(CLERIC_COLUMN, 0xdead, 'wipeout'));
    // wipeout.test.ts hand-derives the steady state (B:0 cycles 30→90→18→78→30,
    // B:3 48→90→42→72→48 — in-cycle minima 18/42, no death is ever possible):
    // the BALANCE.engagementCap (10 since 4.2) fires and FR18 judges A ahead
    // 98% (686/700 after the accumulating staff pokes) to 77% (348/450).
    expect(log.events.filter((e) => e.type === 'EngagementEnded').length).toBe(BALANCE.engagementCap);
    expect(log.events.some((e) => e.type === 'UnitDied')).toBe(false);
    const verdict = log.events[log.events.length - 1];
    expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 98, B: 77 } });
    expect(log).toMatchSnapshot();
  });

  it('golden #8: persisting poison — the earth-witch duel across engagements (FR19 Witch synergy)', () => {
    const log = resolveBattle(setup(POISON_DUEL, 5, 'wipeout'));
    // Trace-verified for the 5-slot fixture: golden #5's comp in wipeout
    // becomes the poison showcase — dots re-tick at every natural engagement
    // end (19 ticks in all), compound into a FATAL tick (B:3 dies at a
    // PoisonTicked hpAfter 0), and whittle both sides until the cap (10)
    // judges what remains: A ahead 22% to 2%. StatusCleared seams narrate the
    // non-poison lifts (the 4.2 emission) while poison visibly survives them.
    expect(log.events.filter((e) => e.type === 'EngagementEnded').length).toBe(BALANCE.engagementCap);
    expect(log.events.filter((e) => e.type === 'PoisonTicked').length).toBe(19);
    expect(log.events.some((e) => e.type === 'PoisonTicked' && e.hpAfter === 0)).toBe(true);
    expect(log.events[log.events.length - 1]).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 22, B: 2 } });
    expect(log).toMatchSnapshot();
  });
});
