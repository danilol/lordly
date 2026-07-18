import { test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import type { BattleEnded, MatchSetup, UnitAttacked, UnitDied } from '../src/types';
import { matchSetupArb } from './arbitraries';

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

function attacks(log: ReturnType<typeof resolveBattle>): UnitAttacked[] {
  return log.events.filter((e): e is UnitAttacked => e.type === 'UnitAttacked');
}

function ended(log: ReturnType<typeof resolveBattle>): BattleEnded {
  const e = log.events[log.events.length - 1];
  if (e?.type !== 'BattleEnded') throw new Error('log must end with BattleEnded');
  return e;
}

describe('FR14/FR15 damage (integer math, fixed order, pinned to balance v1)', () => {
  it('knight → knight deals 16 (30 − 14, RPS neutral)', () => {
    // Knight duel: A front/left (own col 0) reaches enemy {1,2}; B knight at
    // enemy-owner-local front/right (col 2) = A's facing column. The four
    // cleric fillers per side (5-slot era) only ever staff the enemy BACK row
    // (rearmost targeting; every filler's reach holds an occupied back cell)
    // or heal each other — neither knight is touched or healed before the
    // knights act, and A:0 precedes B:0 at the AGI-8 tie (row 0, col 0 < 2),
    // so A:0's first swing lands on a full 140 hp: 140 − 16 = 124.
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'knight', element: 'fire', name: 'Kain' },
            { class: 'cleric', element: 'water', name: 'Sela' },
            { class: 'cleric', element: 'wind', name: 'Edda' },
            { class: 'cleric', element: 'earth', name: 'Nyra' },
            { class: 'cleric', element: 'fire', name: 'Wren' },
          ],
          B: [
            { class: 'knight', element: 'earth', name: 'Gerhart' },
            { class: 'cleric', element: 'fire', name: 'Ithil' },
            { class: 'cleric', element: 'water', name: 'Runa' },
            { class: 'cleric', element: 'wind', name: 'Petra' },
            { class: 'cleric', element: 'earth', name: 'Vala' },
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'right' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'center' },
          ],
        },
      }),
    );
    const knightHits = attacks(log).filter((a) => a.source === 'A:0');
    expect(knightHits.length).toBeGreaterThan(0);
    expect(knightHits[0]?.targets).toEqual([{ unit: 'B:0', damage: 16, hpAfter: 124, outcome: 'hit' }]);
  });

  it('knight → archer deals 36 (24 × 3/2 advantage); mercenary is always ×1', () => {
    // Back-row cleric fillers only: the archer (AGI 22) snipes A's rearmost
    // reachable (a back cleric), the mercenary (AGI 14) strikes before any
    // cleric, and clerics heal their own damaged or staff the enemy back row
    // — so both pinned FIRST attacks find their original targets alive.
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'knight', element: 'fire', name: 'Kain' },
            { class: 'mercenary', element: 'water', name: 'Bram' },
            { class: 'cleric', element: 'wind', name: 'Sela' },
            { class: 'cleric', element: 'earth', name: 'Edda' },
            { class: 'cleric', element: 'fire', name: 'Nyra' },
          ],
          B: [
            { class: 'archer', element: 'earth', name: 'Falk' },
            { class: 'knight', element: 'fire', name: 'Roland' },
            { class: 'cleric', element: 'water', name: 'Ithil' },
            { class: 'cleric', element: 'wind', name: 'Runa' },
            { class: 'cleric', element: 'earth', name: 'Petra' },
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'left' }, // knight, reaches enemy {1,2}
            { row: 'front', col: 'right' }, // mercenary, reaches enemy {0,1}
            { row: 'back', col: 'center' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'right' },
          ],
          B: [
            { row: 'front', col: 'right' }, // archer (col 2) — knight's facing
            { row: 'front', col: 'left' }, // knight (col 0) — mercenary's facing
            { row: 'back', col: 'center' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'right' },
          ],
        },
      }),
    );
    const knightFirst = attacks(log).find((a) => a.source === 'A:0');
    expect(knightFirst?.targets[0]).toMatchObject({ unit: 'B:0', damage: 36 }); // 24 × 3/2
    const mercFirst = attacks(log).find((a) => a.source === 'A:1');
    expect(mercFirst?.targets[0]).toMatchObject({ unit: 'B:1', damage: 12 }); // 26 − 14, ×1
  });

  it('disadvantage floors: knight → mage deals 19 (floor(26 × 3/4))', () => {
    // Same cleric-filler shape as the 16-pin above. The mage (AGI 12) blasts
    // A's fullest row (the back clerics) BEFORE any cleric acts, so A's
    // clerics spend the pass healing — the knight is side A's only attacker
    // and its first swing finds the front mage (nearest row beats the
    // mid-center filler) untouched.
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'knight', element: 'fire', name: 'Kain' },
            { class: 'cleric', element: 'water', name: 'Sela' },
            { class: 'cleric', element: 'wind', name: 'Edda' },
            { class: 'cleric', element: 'earth', name: 'Nyra' },
            { class: 'cleric', element: 'fire', name: 'Wren' },
          ],
          B: [
            { class: 'mage', element: 'earth', name: 'Morwen' },
            { class: 'cleric', element: 'fire', name: 'Ithil' },
            { class: 'cleric', element: 'water', name: 'Runa' },
            { class: 'cleric', element: 'wind', name: 'Petra' },
            { class: 'cleric', element: 'earth', name: 'Vala' },
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'left' },
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'center' },
          ],
          B: [
            { row: 'front', col: 'right' }, // mage in the knight's facing column
            { row: 'back', col: 'left' },
            { row: 'back', col: 'center' },
            { row: 'back', col: 'right' },
            { row: 'mid', col: 'center' },
          ],
        },
      }),
    );
    const hit = attacks(log).find((a) => a.source === 'A:0');
    expect(hit?.targets[0]).toMatchObject({ unit: 'B:0', damage: 19 });
  });
});

describe('FR18 deaths, wipe, and judging', () => {
  /**
   * Concentrated fire (5-slot era): all archers stacked in the enemy's right
   * column; the two knights that reach it (A:0 left→{1,2}, A:1 center→all)
   * pour 36s into the front archer (90 hp): pass 1 → 54 → 18; A:0's pass-2
   * hit is a 36-damage overkill on 18 hp. No AGI+cell cross-side tie exists
   * (A's knights sit in row 0, B's in row 1), so no coin flip — the battle
   * is fully deterministic. The fillers cannot disturb the kill:
   * - A's two BACK clerics absorb the archers' counterfire (5 shots × 27 =
   *   24−6 ×3/2 cleric-hunt, all on back/left by facing-col priority:
   *   90→63→36→9, +30 +30 → 69; 69→42→15, +30 +30 → 75 — never dead, and
   *   with a damaged ally every turn they always heal, never staff B:0).
   * - B's two MID knights (row 1 keeps them out of A:1's nearest-row melee
   *   path to B:0) poke 16s: B:3 (mid/left → facing col 2) hits A:2,
   *   B:4 (mid/center → facing col 1) hits A:1 — nowhere near lethal.
   * After the kill A:1 retargets the mid row (facing col 1 → B:4, 140→124)
   * and A:2 (reach {0,1}) chips B:3 twice (140→124→108) — nobody else dies.
   */
  const concentrated = () =>
    setup({
      armies: {
        A: [
          { class: 'knight', element: 'fire', name: 'Kain' },
          { class: 'knight', element: 'water', name: 'Aldric' },
          { class: 'knight', element: 'wind', name: 'Ulric' },
          { class: 'cleric', element: 'earth', name: 'Sela' },
          { class: 'cleric', element: 'fire', name: 'Edda' },
        ],
        B: [
          { class: 'archer', element: 'earth', name: 'Falk' },
          { class: 'archer', element: 'fire', name: 'Brand' },
          { class: 'archer', element: 'water', name: 'Odo' },
          { class: 'knight', element: 'wind', name: 'Gerhart' },
          { class: 'knight', element: 'earth', name: 'Roland' },
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'back', col: 'left' },
          { row: 'back', col: 'center' },
        ],
        B: [
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'right' },
          { row: 'back', col: 'right' },
          { row: 'mid', col: 'left' },
          { row: 'mid', col: 'center' },
        ],
      },
    });

  it('deaths emit UnitDied right after the killing hit with hpAfter 0', () => {
    const log = resolveBattle(concentrated());
    const deaths = log.events.filter((e): e is UnitDied => e.type === 'UnitDied');
    expect(deaths).toEqual([{ type: 'UnitDied', unit: 'B:0' }]); // front archer: 36+36, then the overkill
    for (const death of deaths) {
      const i = log.events.indexOf(death);
      const prev = log.events[i - 1];
      expect(prev?.type).toBe('UnitAttacked');
      if (prev?.type === 'UnitAttacked') {
        // OVERKILL SEMANTICS: the killing blow lands on 18 remaining hp but
        // reports the full computed damage (36); hpAfter (0) is authoritative.
        expect(prev.targets).toEqual([{ unit: 'B:0', damage: 36, hpAfter: 0, outcome: 'hit' }]);
      }
    }
    // The dead archer's hp snapshot is 0; A:2 (front/right, reach {0,1})
    // spends its swings on B's mid-row knight fillers instead of idling.
    const engEnd = log.events.find((e) => e.type === 'EngagementEnded');
    if (engEnd?.type === 'EngagementEnded') expect(engEnd.hp['B:0']).toBe(0);
    expect(ended(log).winner).toBe('A');
  });

  // Note: no melee matchup in balance v1 produces a negative base (lowest melee
  // STR 26 vs highest VIT/2 = 14), so the min-1 clamp is guarded by the
  // property below rather than a specific pinned matchup; casters (1.6) will
  // exercise it concretely.
  test.prop([matchSetupArb])('every attack deals at least minDamage and hpAfter never goes below 0', (s) => {
    const log = resolveBattle(s);
    for (const a of attacks(log)) {
      for (const t of a.targets) {
        expect(t.damage).toBeGreaterThanOrEqual(BALANCE.formulas.minDamage);
        expect(t.hpAfter).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('judging: higher HP-percentage side wins (exact comparison, not floored)', () => {
    // Asymmetric knight-vs-mercenary trade, 5-a-side (4.2 migration).
    // GEOMETRY: the center column is EMPTY on both sides, so the battle
    // splits into two independent theatres (own col 0 reaches enemy {1,2};
    // own col 2 reaches {0,1}): A's left column trades with B's right column,
    // and A's right column with B's left. Every cross-side cell overlap pairs
    // a knight (AGI 8) with a mercenary (AGI 14) — no exact AGI tie, no coin
    // flip, fully deterministic.
    //
    // Hand-derived trace (K→merc 30−10=20; merc→K 26−14=12; K→K 30−14=16;
    // mercs act before knights; front units act twice, mid/back once; melee
    // picks the nearest row, so each column's front unit soaks everything):
    //   pass 1: B:2→A:3 12 | B:0→A:0 12 | B:3→A:3 12 | B:4→A:3 12
    //           A:0→B:0 20 | A:3→B:2 20 | A:1→B:0 20 | A:4→B:2 20
    //           A:2→B:0 20 | B:1→A:0 16
    //   pass 2: B:2→A:3 12 | B:0→A:0 12 | A:0→B:0 20 | A:3→B:2 20
    // Nobody dies. A ends 100+140+140+92+140 = 612/700; B ends
    // 30+140+50+110+110 = 440/580. Exact: 612×580 = 354,960 > 440×700 =
    // 308,000 → A wins; floored report percentages are 87 and 75.
    const log = resolveBattle(
      setup({
        armies: {
          A: [
            { class: 'knight', element: 'fire', name: 'Kain' },
            { class: 'knight', element: 'water', name: 'Aldric' },
            { class: 'knight', element: 'wind', name: 'Ulric' },
            { class: 'knight', element: 'earth', name: 'Konrad' },
            { class: 'knight', element: 'fire', name: 'Cedric' },
          ],
          B: [
            { class: 'mercenary', element: 'earth', name: 'Bram' },
            { class: 'knight', element: 'fire', name: 'Gerhart' },
            { class: 'mercenary', element: 'water', name: 'Falk' },
            { class: 'mercenary', element: 'wind', name: 'Odo' },
            { class: 'mercenary', element: 'fire', name: 'Doran' },
          ],
        },
        placements: {
          A: [
            { row: 'front', col: 'left' },
            { row: 'mid', col: 'left' },
            { row: 'back', col: 'left' },
            { row: 'front', col: 'right' },
            { row: 'mid', col: 'right' },
          ],
          B: [
            { row: 'front', col: 'right' },
            { row: 'back', col: 'right' },
            { row: 'front', col: 'left' },
            { row: 'mid', col: 'left' },
            { row: 'back', col: 'left' },
          ],
        },
      }),
    );
    const verdict = ended(log);
    expect(verdict.winner).toBe('A');
    expect(verdict.hpPct).toEqual({ A: 87, B: 75 });
  });

  it('exact tie → draw: mirrored knights, symmetric damage, nobody dies', () => {
    // Full front row plus mid/back center, identical on both sides — mirror
    // symmetry means both sides deal identical totals (the heaviest-hit unit,
    // each front/center knight, takes 4 × 16 = 64 of 140 — nobody dies), so
    // the exact comparison lands on a true tie whatever the tie-flip does.
    const mirror = setup({
      armies: {
        A: [
          { class: 'knight', element: 'fire', name: 'Kain' },
          { class: 'knight', element: 'water', name: 'Aldric' },
          { class: 'knight', element: 'wind', name: 'Ulric' },
          { class: 'knight', element: 'earth', name: 'Konrad' },
          { class: 'knight', element: 'fire', name: 'Cedric' },
        ],
        B: [
          { class: 'knight', element: 'earth', name: 'Gerhart' },
          { class: 'knight', element: 'fire', name: 'Roland' },
          { class: 'knight', element: 'water', name: 'Falk' },
          { class: 'knight', element: 'wind', name: 'Odo' },
          { class: 'knight', element: 'water', name: 'Doran' },
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'center' },
          { row: 'back', col: 'center' },
        ],
        B: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'center' },
          { row: 'back', col: 'center' },
        ],
      },
    });
    const verdict = ended(resolveBattle(mirror));
    expect(verdict.winner).toBe('draw');
    expect(verdict.hpPct.A).toBe(verdict.hpPct.B);
  });
});

describe('FR18 judging symmetry (property)', () => {
  /**
   * Swapping sides mirrors the battle exactly ONLY when no cross-side initiative
   * tie exists on a mirrored cell: the per-engagement coin flip (resolve.ts
   * `tieWinner`) is not side-symmetric, so a same-AGI pair on the same
   * owner-local cell resolves by SIDE and breaks the mirror. Filtered out
   * (documented nuance). Story 4.3 generalised the guard from same-CLASS to
   * same-AGI: with the 6-class roster every AGI was distinct, so a tie implied
   * a shared class; the wave-1 roster collides AGI across classes (Berserker
   * and Wizard both 12), so equal AGI — not class identity — is the real tie.
   */
  const noMirrorTieArb = matchSetupArb.filter((s) => {
    for (let i = 0; i < s.armies.A.length; i++) {
      for (let j = 0; j < s.armies.B.length; j++) {
        const a = s.armies.A[i];
        const b = s.armies.B[j];
        const sameAgi = a !== undefined && b !== undefined && BALANCE.classes[a.class].agi === BALANCE.classes[b.class].agi;
        const pa = s.placements.A[i];
        const pb = s.placements.B[j];
        if (sameAgi && pa?.row === pb?.row && pa?.col === pb?.col) return false;
      }
    }
    return true;
  });

  // Explicit timeout (story 4.3 review): the wave-1 roster's AGI collisions
  // (Berserker/Wizard both 12) make noMirrorTieArb reject more generated cases
  // than the 6-class roster did, so this brushes Vitest's 5s default under a
  // loaded CI runner — a load flake, not a slow assertion.
  test.prop([noMirrorTieArb])(
    'swapping sides swaps the result',
    (s) => {
      const swapped: MatchSetup = {
        ...s,
        armies: { A: s.armies.B, B: s.armies.A },
        placements: { A: s.placements.B, B: s.placements.A },
        // Story 4.4: tactics and leaders are per-side battle inputs, so a true
        // mirror must swap them too — otherwise A plays B's army under A's own
        // (unswapped) tactic and the symmetry is broken by construction.
        tactics: { A: s.tactics.B, B: s.tactics.A },
        leaders: { A: s.leaders.B, B: s.leaders.A },
      };
      const v1 = ended(resolveBattle(s));
      const v2 = ended(resolveBattle(swapped));
      const flip = (w: BattleEnded['winner']) => (w === 'A' ? 'B' : w === 'B' ? 'A' : 'draw');
      expect(v2.winner).toBe(flip(v1.winner));
      expect(v2.hpPct).toEqual({ A: v1.hpPct.B, B: v1.hpPct.A });
    },
    15_000,
  );
});
