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
    // 99%). Story 4.7: A's mid knights (A:3, A:4) Guard instead of swinging
    // at B's mid/back clerics, so B takes LESS chip than pre-4.7 — its
    // back-line heals hold the lanes even more comfortably, at 378/450 = 84%.
    const verdict = log.events[log.events.length - 1];
    if (verdict?.type === 'BattleEnded') {
      expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 99, B: 84 } });
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
        // Story 4.6: seed chosen so the all-knight mirror draws ZERO crits and
        // ZERO dodges (knights DEX 16 → 5% each). A fired crit/dodge is a
        // per-attack draw and NOT mirror-symmetric, so it would break the exact
        // tie; with none firing the mirror stays perfectly symmetric → draw.
        0xfef4,
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
    //
    // Story 4.7: B:3 (a Knight, mid-left) Guard-halves on pass 1 instead of
    // swinging — its shielded cells are itself AND the ally directly behind
    // it, back-left, which is B:0 (the mage this golden kills). A:1's pass-2
    // arrow at B:0 (would-be 30) is halved to 15 (`redirectedFrom: 'B:3'`,
    // `GuardEnded` right after) — B:0 survives that ONE shot a little longer
    // (16 hp instead of dying to it outright) but still falls two events
    // later to A:2's finishing blast, so the death order/LeaderFell beat
    // below are UNCHANGED; only the exact hp numbers move.
    expect(log.events.filter((e) => e.type === 'UnitDied').map((e) => e.unit)).toEqual(['B:0', 'B:1']);
    const killingBlast = log.events.filter((e) => e.type === 'UnitAttacked' && e.source === 'A:2')[1];
    if (killingBlast?.type === 'UnitAttacked') {
      expect(killingBlast.targets.every((t) => t.hpAfter === 0)).toBe(true);
      const i = log.events.indexOf(killingBlast);
      // B:0 is B's default leader (index 0): its death rides the LeaderFell beat
      // immediately after its UnitDied (story 4.5, FR35), between the two
      // casualties in target order. The blast is MAGIC, so no penalty applies.
      expect(log.events[i + 1]?.type).toBe('UnitDied'); // B:0
      expect(log.events[i + 2]?.type).toBe('LeaderFell'); // B:0 was B's leader
      expect(log.events[i + 3]?.type).toBe('UnitDied'); // B:1
    }
    expect(log).toMatchSnapshot();
  });

  it('golden #5: the poison duel — mirrored earth witches, ticks land but the arrows kill first', () => {
    const log = resolveBattle(setup(POISON_DUEL, 5));
    // Trace-verified for the 5-slot fixture (each tick hand-checked at
    // poisonDamage 15: archer 90→75, witch 85→70, merc 110→95): three
    // non-fatal ticks at the natural end, while B's witch falls to the
    // hunt-boosted arrows (×3/2) mid-engagement — her death comes from a
    // UnitAttacked, never a tick. B:0 (the witch) is B's default leader, so her
    // fall fires LeaderFell(B) and arms B's sober package (story 4.5, FR35):
    // B's melee then deals ×3/4 and takes ×5/4 physical, nudging the verdict
    // from the pre-4.5 76%/70% to 78%/69% (A survives a touch better, B a touch
    // worse). Poison/magic are untouched — the physical-only penalty.
    expect(log.events.filter((e) => e.type === 'PoisonTicked').length).toBe(3);
    expect(log.events.some((e) => e.type === 'PoisonTicked' && e.hpAfter === 0)).toBe(false);
    expect(log.events.filter((e) => e.type === 'UnitDied').map((e) => e.unit)).toEqual(['B:0']);
    expect(log.events.filter((e) => e.type === 'LeaderFell')).toEqual([{ type: 'LeaderFell', side: 'B', unit: 'B:0' }]);
    expect(log.events[log.events.length - 1]).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 78, B: 69 } });
    expect(log).toMatchSnapshot();
  });
});

describe('golden battles (story 1.10 — until-wipeout mode)', () => {
  it('golden #6: the multi-engagement wipe — knights grind mercs down over five engagements', () => {
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
    // wipeout.test.ts's `knightsVsMercs` fixture verbatim — the mercs are ground
    // out over FIVE engagements (was four pre-4.7). B:0 (front-left) is B's
    // default leader: its fall arms B's sober package (story 4.5, FR35), so
    // B's mercs then deal ×3/4 physical. Story 4.7: A's mid knights Guard
    // instead of attacking, so B's mid mercs take one fewer swing per
    // engagement — the grind runs a beat slower, A holds 388/700 → 55% vs 0%
    // (was 65% at 4.6, over four engagements).
    expect(log.events.filter((e) => e.type === 'EngagementEnded').length).toBe(5);
    expect(log.events.filter((e) => e.type === 'LeaderFell')).toEqual([{ type: 'LeaderFell', side: 'B', unit: 'B:0' }]);
    const verdict = log.events[log.events.length - 1];
    expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 55, B: 0 } });
    expect(log).toMatchSnapshot();
  });

  it('golden #7: the cap fallback — a healing equilibrium runs all ten engagements, then FR18 judges', () => {
    const log = resolveBattle(setup(CLERIC_COLUMN, 0xdead, 'wipeout'));
    // wipeout.test.ts hand-derives the steady state — story 4.7: A's mid
    // knights Guard instead of attacking B's mid/back clerics, so B takes
    // less chip than pre-4.7 and its heals hold even more comfortably; no
    // death is ever possible: the BALANCE.engagementCap (10 since 4.2) fires
    // and FR18 judges A ahead 96% (676/700 after the accumulating staff
    // pokes) to 81% (366/450).
    expect(log.events.filter((e) => e.type === 'EngagementEnded').length).toBe(BALANCE.engagementCap);
    expect(log.events.some((e) => e.type === 'UnitDied')).toBe(false);
    const verdict = log.events[log.events.length - 1];
    expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 96, B: 81 } });
    expect(log).toMatchSnapshot();
  });

  it('golden #8: persisting poison — the earth-witch duel across engagements (FR19 Witch synergy)', () => {
    const log = resolveBattle(setup(POISON_DUEL, 5, 'wipeout'));
    // golden #5's comp in wipeout is the poison showcase — dots re-tick at every
    // natural engagement end and compound into a FATAL tick (a PoisonTicked
    // hpAfter 0). FR9 global range lets A's two archers snipe across the whole
    // grid; B:0 (B's witch) is B's default leader, so her early fall arms B's
    // sober package (story 4.5, FR35) — B's melee then deals ×3/4 and takes ×5/4
    // physical. Story 4.6 (ADR 0003): the archers/knights now draw dodge/crit
    // per physical shot (2 crits, 4 dodges on this seed), which shifts the grind
    // — B collapses at engagement 4 (was 5 at 4.5, 6 pre-4.5), 15 ticks land, one
    // A knight (A:4) is lost, and A ends 36% vs 0%. Poison still survives every
    // StatusCleared seam across all engagements.
    expect(log.events.filter((e) => e.type === 'EngagementEnded').length).toBe(4);
    expect(log.events.filter((e) => e.type === 'PoisonTicked').length).toBe(15);
    expect(log.events.some((e) => e.type === 'PoisonTicked' && e.hpAfter === 0)).toBe(true);
    expect(log.events.filter((e) => e.type === 'LeaderFell')).toEqual([{ type: 'LeaderFell', side: 'B', unit: 'B:0' }]);
    expect(log.events[log.events.length - 1]).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 36, B: 0 } });
    expect(log).toMatchSnapshot();
  });
});

describe('golden battles (story 4.6 — crits & dodge)', () => {
  it('golden #9: one battle exercising every draw-consuming path — confusion (A1/A2), dodge (A3), crit (A4)', () => {
    // ADR 0003's verification contract: a single seed-identity golden that
    // traverses confused-misfire AND dodge AND crit, so any reorder or
    // miscount of the frozen battle-stream draws shows up as a snapshot diff.
    // A wind Witch confuses B's front; the ninjas (DEX 30 — 10% each) supply
    // the crits and dodges. Seed 1 fires all three (verified).
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              u('witch', 'wind', 'Sylwen'),
              u('ninja', 'fire', 'Kage'),
              u('ninja', 'water', 'Rin'),
              u('knight', 'earth', 'Doran'),
              u('archer', 'fire', 'Lyra'),
            ],
            B: [
              u('ninja', 'fire', 'Taki'),
              u('ninja', 'water', 'Yuki'),
              u('knight', 'wind', 'Cedric'),
              u('mercenary', 'earth', 'Gorm'),
              u('archer', 'water', 'Vess'),
            ],
          },
          placements: {
            A: [
              { row: 'back', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'center' },
              { row: 'front', col: 'right' },
              { row: 'mid', col: 'left' },
            ],
            B: [...WALL],
          },
        },
        1,
        'wipeout',
      ),
    );
    // All three draw-consuming paths are present in this one battle.
    expect(log.events.some((e) => e.type === 'ActionMisfired')).toBe(true); // A1/A2 (confusion)
    const outcomes = log.events.flatMap((e) => (e.type === 'UnitAttacked' ? e.targets.map((t) => t.outcome) : []));
    expect(outcomes).toContain('crit'); // A4
    expect(outcomes).toContain('dodged'); // A3
    // A dodge always deals 0; a crit/hit never does.
    for (const e of log.events) {
      if (e.type !== 'UnitAttacked') continue;
      for (const t of e.targets) if (t.outcome === 'dodged') expect(t.damage).toBe(0);
    }
    expect(log).toMatchSnapshot();
  });
});

describe('golden battles (story 4.7 — per-row moves and Guard)', () => {
  it('golden #10: a Full Guard negates an arrow aimed at the ally directly behind the Phalanx', () => {
    // A:0 = Phalanx front-center (guard-full, dossier §4) — shields itself AND
    // the ally directly behind it, A:1 (archer, mid-center). A:1 is A's
    // designated leader; B's tactic 'leader' makes its archer (and its
    // clerics' staff fallback) hunt A:1 directly, guaranteeing the shielded
    // cell gets hit (guard.test.ts verifies this fixture's mechanics in
    // isolation; this golden pins the FULL battle log).
    const matchSetup: MatchSetup = {
      ...setup(
        {
          armies: {
            A: [
              u('phalanx', 'fire', 'Bram'),
              u('archer', 'water', 'Vess'),
              u('knight', 'wind', 'Cedric'),
              u('knight', 'earth', 'Doran'),
              u('mercenary', 'fire', 'Edmund'),
            ],
            B: [
              u('archer', 'earth', 'Falk'),
              u('cleric', 'fire', 'Gorm'),
              u('cleric', 'water', 'Hask'),
              u('cleric', 'wind', 'Ivo'),
              u('cleric', 'earth', 'Jarek'),
            ],
          },
          placements: {
            A: [
              { row: 'front', col: 'center' },
              { row: 'mid', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'right' },
              { row: 'mid', col: 'left' },
            ],
            B: [
              { row: 'back', col: 'center' },
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'mid', col: 'left' },
              { row: 'mid', col: 'right' },
            ],
          },
        },
        1,
      ),
      tactics: { A: 'autonomous', B: 'leader' },
      leaders: { A: 1, B: 0 },
    };
    const resolved = resolveBattle(matchSetup);
    const guardedHit = resolved.events.find((e) => e.type === 'UnitAttacked' && e.redirectedFrom === 'A:0');
    expect(guardedHit).toBeDefined();
    if (guardedHit?.type === 'UnitAttacked') {
      // The Phalanx's own cell stays untouched — only the ally BEHIND it (A:1)
      // is the actual target, taking the negated 0 (no redirect, ADR-0003-safe).
      expect(guardedHit.targets).toEqual([{ unit: 'A:1', damage: 0, hpAfter: expect.any(Number), outcome: 'hit' }]);
    }
    expect(resolved.events.filter((e) => e.type === 'GuardRaised' && e.unit === 'A:0').length).toBeGreaterThanOrEqual(1);
    expect(resolved.events.filter((e) => e.type === 'GuardEnded' && e.unit === 'A:0').length).toBeGreaterThanOrEqual(1);
    expect(resolved).toMatchSnapshot();
  });
});
