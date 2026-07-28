import { describe, expect, it } from 'vitest';
import { BALANCE, slotTotal } from '../src/balance';
import { canPlace, InvalidMatchSetupError, legalAnchors, validateMatchSetup } from '../src/validate';
import type { MatchSetup } from '../src/types';

/** A minimal valid single-mode setup for mutation-based violation tests. */
function validSetup(): MatchSetup {
  return {
    seed: 12345,
    balanceVersion: BALANCE.version,
    mode: 'single',
    tactics: { A: 'autonomous', B: 'autonomous' },
    leaders: { A: 0, B: 0 },
    armies: {
      A: [
        { class: 'knight', element: 'fire', name: 'Kain' },
        { class: 'archer', element: 'water', name: 'Lyra' },
        { class: 'mage', element: 'wind', name: 'Aldous' },
        { class: 'mercenary', element: 'earth', name: 'Brand' },
        { class: 'cleric', element: 'water', name: 'Sela' },
      ],
      B: [
        { class: 'witch', element: 'earth', name: 'Morwen' },
        { class: 'cleric', element: 'fire', name: 'Ithil' },
        { class: 'mercenary', element: 'water', name: 'Dario' },
        { class: 'knight', element: 'wind', name: 'Gerhart' },
        { class: 'archer', element: 'fire', name: 'Vess' },
      ],
    },
    placements: {
      A: [
        { row: 'front', col: 'left' },
        { row: 'mid', col: 'center' },
        { row: 'back', col: 'right' },
        { row: 'front', col: 'right' },
        { row: 'back', col: 'center' },
      ],
      B: [
        { row: 'front', col: 'center' },
        { row: 'back', col: 'left' },
        { row: 'back', col: 'right' },
        { row: 'mid', col: 'left' },
        { row: 'mid', col: 'right' },
      ],
    },
  };
}

function expectViolation(setup: MatchSetup, violation: string, messagePart: string | RegExp) {
  let caught: unknown;
  try {
    validateMatchSetup(setup);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(InvalidMatchSetupError);
  const err = caught as InvalidMatchSetupError;
  expect(err.violation).toBe(violation);
  expect(err.message).toMatch(messagePart);
}

describe('validateMatchSetup (AC2, spine errors convention)', () => {
  it('accepts a valid single-mode setup', () => {
    expect(() => validateMatchSetup(validSetup())).not.toThrow();
  });

  it('rejects malformed runtime structure as InvalidMatchSetupError, never a raw TypeError', () => {
    // Runtime callers are not bound by the TS unions; null/undefined shapes
    // must surface as the engine's one typed error, not a bare TypeError.
    expectViolation(null as unknown as MatchSetup, 'not-an-object', /object/);
    expectViolation(undefined as unknown as MatchSetup, 'not-an-object', /object/);
    expectViolation({ ...validSetup(), armies: undefined as never }, 'not-an-object', /armies/);
    const nullUnit = validSetup();
    (nullUnit.armies.A as unknown[])[0] = null;
    expectViolation(nullUnit, 'unknown-class', /not an object/);
    const nullCell = validSetup();
    (nullCell.placements.B as unknown[])[1] = null;
    expectViolation(nullCell, 'out-of-grid', /not an object/);
  });

  it('accepts wipeout mode (story 1.10 — the multi-engagement loop is implemented)', () => {
    expect(() => validateMatchSetup({ ...validSetup(), mode: 'wipeout' })).not.toThrow();
  });

  it('rejects a non-uint32 seed, naming the value', () => {
    for (const seed of [-1, 1.5, 2 ** 32, NaN]) {
      expectViolation({ ...validSetup(), seed }, 'invalid-seed', String(seed));
    }
  });

  it('rejects a balanceVersion mismatch, naming both versions', () => {
    expectViolation({ ...validSetup(), balanceVersion: 999 }, 'balance-version-mismatch', /999/);
  });

  it('rejects an unknown mode', () => {
    const s = validSetup();
    (s as unknown as { mode: string }).mode = 'ranked';
    expectViolation(s, 'invalid-mode', /ranked/);
  });

  it('rejects a wrong slot total, naming the side, the budget, and the total (AD-1, story 4.2)', () => {
    const s = validSetup();
    s.armies.A = s.armies.A.slice(0, 4);
    s.placements.A = s.placements.A.slice(0, 4);
    expectViolation(s, 'wrong-slot-total', /A.*5.*4|A.*budget/);
  });

  it('rejects an over-budget army by SLOTS, not unit count (AD-1)', () => {
    const s = validSetup();
    s.armies.B = [...s.armies.B, { class: 'knight', element: 'fire', name: 'Ulric' }];
    s.placements.B = [...s.placements.B, { row: 'mid', col: 'left' }];
    expectViolation(s, 'wrong-slot-total', /B/);
  });

  it('rejects an unknown class, naming side and index', () => {
    const s = validSetup();
    (s.armies.B[1] as { class: string }).class = 'paladin';
    expectViolation(s, 'unknown-class', /B.*1|paladin/);
  });

  it('rejects an unknown element, naming side and index', () => {
    const s = validSetup();
    (s.armies.A[0] as { element: string }).element = 'void';
    expectViolation(s, 'unknown-element', /void/);
  });

  it('rejects an invalid or missing unit name, naming side and index (FR37, story 4.2)', () => {
    const empty = validSetup();
    (empty.armies.A[2] as { name: string }).name = '   ';
    expectViolation(empty, 'invalid-name', /A.*2/);
    const missing = validSetup();
    delete (missing.armies.B[1] as { name?: string }).name;
    expectViolation(missing, 'invalid-name', /B.*1/);
  });

  it('rejects a tactic outside ALL_TACTICS on either side (AD-9, story 4.2)', () => {
    const s = validSetup();
    (s as unknown as { tactics: { A: string; B: string } }).tactics.A = 'berserk';
    expectViolation(s, 'invalid-tactic', /berserk/);
    const missing = validSetup();
    delete (missing as unknown as { tactics?: unknown }).tactics;
    expectViolation(missing, 'invalid-tactic', /A/);
  });

  it('rejects a leader index that does not point into that side’s army (AD-9, story 4.2)', () => {
    for (const bad of [-1, 5, 1.5, NaN]) {
      const s = validSetup();
      s.leaders.B = bad;
      expectViolation(s, 'invalid-leader', /B/);
    }
    const missing = validSetup();
    delete (missing as unknown as { leaders?: unknown }).leaders;
    expectViolation(missing, 'invalid-leader', /A/);
  });

  it('rejects placements not parallel to armies, naming the side', () => {
    const s = validSetup();
    s.placements.B = s.placements.B.slice(0, 2);
    expectViolation(s, 'placements-mismatch', /B/);
  });

  it('rejects an out-of-grid placement, naming the offending cell', () => {
    const s = validSetup();
    (s.placements.A[2] as { row: string }).row = 'rear';
    expectViolation(s, 'out-of-grid', /rear/);
    const s2 = validSetup();
    (s2.placements.A[2] as { col: string }).col = 'middle';
    expectViolation(s2, 'out-of-grid', /middle/);
  });

  it('rejects two same-side units on one cell, naming side and cell', () => {
    const s = validSetup();
    s.placements.A[1] = { row: 'front', col: 'left' }; // same as A[0]
    expectViolation(s, 'overlapping-placement', /front.*left|left.*front/);
  });

  it('allows opposing sides to occupy mirror cells (grids are separate)', () => {
    const s = validSetup();
    s.placements.B[0] = { ...s.placements.A[0]! };
    // must relocate old B0 cell? B already had front/center; set B0 = front/left like A0 — legal.
    expect(() => validateMatchSetup(s)).not.toThrow();
  });
});

/**
 * A minimal valid setup with ONE single-cell Golem (front-left) + 3 smalls in
 * the free cells (device revision: a monster occupies one cell and blocks its
 * 8 king-move neighbors). A Golem at front/left blocks front/center, mid/left,
 * mid/center — so the smalls sit at front/right, mid/right, back/center (all
 * non-adjacent).
 */
function monsterSetup(): MatchSetup {
  return {
    seed: 1,
    balanceVersion: BALANCE.version,
    mode: 'single',
    tactics: { A: 'autonomous', B: 'autonomous' },
    leaders: { A: 1, B: 0 }, // A:0 is the Golem — a monster can never be crowned (device-reported follow-up)
    armies: {
      A: [
        { class: 'golem', element: 'earth', name: 'Ogham' },
        { class: 'archer', element: 'water', name: 'Lyra' },
        { class: 'archer', element: 'fire', name: 'Vess' },
        { class: 'knight', element: 'wind', name: 'Kain' },
      ],
      B: [
        { class: 'knight', element: 'fire', name: 'Hargen' },
        { class: 'knight', element: 'water', name: 'Ulf' },
        { class: 'knight', element: 'earth', name: 'Falk' },
        { class: 'knight', element: 'wind', name: 'Dario' },
        { class: 'knight', element: 'fire', name: 'Bram' },
      ],
    },
    placements: {
      A: [
        { row: 'front', col: 'left' }, // anchor — occupies front+mid left
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'right' },
        { row: 'back', col: 'center' },
      ],
      B: [
        { row: 'front', col: 'left' },
        { row: 'front', col: 'center' },
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'left' },
        { row: 'mid', col: 'right' },
      ],
    },
  };
}

describe('validateMatchSetup — monster footprint rules (story 4.8, AD-14, FR38)', () => {
  it('accepts a legal one-monster army (2+1+1+1 slots)', () => {
    expect(() => validateMatchSetup(monsterSetup())).not.toThrow();
  });

  it('accepts a legal two-monster army (2+2+1 slots) at non-adjacent cells', () => {
    const s = monsterSetup();
    s.armies.A = [
      { class: 'golem', element: 'earth', name: 'Ogham' },
      { class: 'golem', element: 'fire', name: 'Karrick' },
      { class: 'cleric', element: 'water', name: 'Sela' },
    ];
    s.placements.A = [
      { row: 'front', col: 'left' },
      { row: 'front', col: 'right' }, // 2 columns from the first golem — not king-adjacent
      { row: 'back', col: 'center' }, // adjacent to neither golem
    ];
    s.leaders.A = 2; // the cleric — a monster can never be crowned
    expect(() => validateMatchSetup(s)).not.toThrow();
  });

  it('accepts a monster anchored at the BACK row — a single-cell monster may stand anywhere', () => {
    const s = monsterSetup();
    // Golem back/left blocks back/center, mid/left, mid/center; the smalls
    // relocate to non-adjacent cells.
    s.placements.A = [
      { row: 'back', col: 'left' },
      { row: 'front', col: 'left' },
      { row: 'front', col: 'right' },
      { row: 'back', col: 'right' },
    ];
    expect(() => validateMatchSetup(s)).not.toThrow();
  });

  it('rejects a THIRD monster on one side via canPlace (max 2, FR1/FR38) — unreachable through validateMatchSetup today (3 golems is 6 slots, over the 5-slot budget, so wrong-slot-total fires first; canPlace enforces the rule directly since it does not check slot totals)', () => {
    const existing = [
      { class: 'golem' as const, placement: { row: 'front' as const, col: 'left' as const } },
      { class: 'golem' as const, placement: { row: 'front' as const, col: 'right' as const } },
    ];
    expect(canPlace('golem', { row: 'back', col: 'center' }, existing)).toBe(false); // would be a 3rd monster
    expect(legalAnchors('golem', existing)).toEqual([]); // nowhere to add a 3rd
  });

  it('rejects a monster king-adjacent to another monster (orthogonal)', () => {
    const s = monsterSetup();
    s.armies.A = [
      { class: 'golem', element: 'earth', name: 'Ogham' },
      { class: 'golem', element: 'fire', name: 'Karrick' },
      { class: 'cleric', element: 'water', name: 'Sela' },
    ];
    s.placements.A = [
      { row: 'front', col: 'left' },
      { row: 'front', col: 'center' }, // directly beside the first golem
      { row: 'back', col: 'right' },
    ];
    s.leaders.A = 2;
    expectViolation(s, 'adjacent-to-monster', /A/);
  });

  it('rejects a monster DIAGONALLY adjacent to another monster (king move includes diagonals)', () => {
    const s = monsterSetup();
    s.armies.A = [
      { class: 'golem', element: 'earth', name: 'Ogham' },
      { class: 'golem', element: 'fire', name: 'Karrick' },
      { class: 'cleric', element: 'water', name: 'Sela' },
    ];
    s.placements.A = [
      { row: 'front', col: 'left' },
      { row: 'mid', col: 'center' }, // diagonally adjacent to front/left
      { row: 'back', col: 'right' },
    ];
    s.leaders.A = 2;
    expectViolation(s, 'adjacent-to-monster', /A/);
  });

  it('rejects a HUMAN standing directly beside a monster — the source-game scenario', () => {
    const s = monsterSetup();
    // Golem front/left; moving the archer A:1 into front/center — directly
    // beside it — must be rejected exactly like a second monster would be.
    s.placements.A[1] = { row: 'front', col: 'center' };
    expectViolation(s, 'adjacent-to-monster', /A/);
  });

  it('rejects a HUMAN diagonally beside a monster (king move)', () => {
    const s = monsterSetup();
    s.placements.A[1] = { row: 'mid', col: 'center' }; // diagonal to the front/left golem
    expectViolation(s, 'adjacent-to-monster', /A/);
  });

  it('rejects a monster crowned as the leader (device-reported) — only a human may be crowned', () => {
    const s = monsterSetup();
    s.leaders.A = 0; // the Golem
    expectViolation(s, 'leader-not-human', /A/);
  });

  it('rejects two units on the exact same cell (overlap)', () => {
    const s = monsterSetup();
    s.placements.A[1] = { row: 'front', col: 'left' }; // same cell as the Golem A:0
    expectViolation(s, 'overlapping-placement', /A/);
  });

  it('canPlace/legalAnchors are exactly ONE implementation with validateMatchSetup (AD-14) — legalAnchors(cls, existing) equals every anchor for which the FULL setup would validate', () => {
    // A 3-slot base (1 golem + 1 knight) so adding a SECOND golem (2 slots)
    // lands exactly on the 5-slot budget — the slot-total check (a SEPARATE,
    // earlier validation step) must agree for every anchor tried, not just
    // pass/fail on it uniformly, or this test couldn't isolate the footprint
    // predicate the two entry points are supposed to share.
    const base: MatchSetup = {
      seed: 1,
      balanceVersion: BALANCE.version,
      mode: 'single',
      tactics: { A: 'autonomous', B: 'autonomous' },
      leaders: { A: 1, B: 0 }, // A:0 is the Golem — a monster can never be crowned
      armies: {
        A: [
          { class: 'golem', element: 'earth', name: 'Ogham' },
          { class: 'knight', element: 'fire', name: 'Kain' },
        ],
        B: [
          { class: 'knight', element: 'fire', name: 'Hargen' },
          { class: 'knight', element: 'water', name: 'Ulf' },
          { class: 'knight', element: 'earth', name: 'Falk' },
          { class: 'knight', element: 'wind', name: 'Dario' },
          { class: 'knight', element: 'fire', name: 'Bram' },
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'left' }, // golem anchor -> {front,mid}/left
          { row: 'back', col: 'center' },
        ],
        B: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'left' },
          { row: 'mid', col: 'right' },
        ],
      },
    };
    const existing = base.armies.A.map((u, i) => ({ class: u.class, placement: base.placements.A[i] as MatchSetup['placements']['A'][number] }));
    for (const row of ['front', 'mid', 'back'] as const) {
      for (const col of ['left', 'center', 'right'] as const) {
        const anchor = { row, col };
        const viaCanPlace = canPlace('golem', anchor, existing);
        const s: MatchSetup = {
          ...base,
          armies: { ...base.armies, A: [...base.armies.A, { class: 'golem', element: 'earth', name: 'Enkil' }] },
          placements: { ...base.placements, A: [...base.placements.A, anchor] },
        };
        let viaValidate = true;
        try {
          validateMatchSetup(s);
        } catch {
          viaValidate = false;
        }
        expect(viaCanPlace, `${row}/${col}`).toBe(viaValidate);
      }
    }
    // legalAnchors is exactly the subset canPlace accepts.
    const anchors = legalAnchors('golem', existing);
    for (const row of ['front', 'mid', 'back'] as const) {
      for (const col of ['left', 'center', 'right'] as const) {
        const inList = anchors.some((a) => a.row === row && a.col === col);
        expect(inList, `${row}/${col}`).toBe(canPlace('golem', { row, col }, existing));
      }
    }
  });
});

/**
 * The humans-only crown (E5-D13, story 5.5): leader eligibility is the `race`
 * field, NOT `sizeClass`. Story 5.5 is the first wave where those two differ —
 * the 1-slot Whelp is a `small` that must still be refused the crown — so
 * every case below would have passed under 4.8's sizeClass rule.
 */
describe('validateMatchSetup — the humans-only crown (E5-D13, story 5.5)', () => {
  /** Golem front/left + a back/right monster leave exactly two free cells (front/right, back/left) — the tightest legal 2-monster footprint. */
  const TWO_MONSTER_CELLS = [
    { row: 'front', col: 'left' },
    { row: 'back', col: 'right' },
  ] as const;

  /** A 5-slot side A with the given army/placements, against a plain human side B. */
  function sideA(army: MatchSetup['armies']['A'], placements: MatchSetup['placements']['A'], leader: number): MatchSetup {
    const base = monsterSetup();
    return { ...base, leaders: { A: leader, B: 0 }, armies: { ...base.armies, A: army }, placements: { ...base.placements, A: placements } };
  }

  it("Danilo's example 1 — Golem + Emberdrake + Whelp is INVALID: 5 slots of creatures leave NO index that can wear the crown", () => {
    const army = [
      { class: 'golem', element: 'earth', name: 'Ogham' },
      { class: 'emberdrake', element: 'fire', name: 'Cindrath' },
      { class: 'whelp', element: 'fire', name: 'Emberis' },
    ] as const;
    const placements = [TWO_MONSTER_CELLS[0], TWO_MONSTER_CELLS[1], { row: 'front', col: 'right' }] as const;
    // EVERY leader index fails — that is what "an all-creature army has no
    // legal leader" means operationally, and why E5-D13 needs no separate
    // army-composition rule.
    for (const leader of [0, 1, 2]) {
      expectViolation(sideA([...army], [...placements], leader), 'leader-not-human', /A/);
    }
  });

  it("Danilo's example 2 — Golem + Emberdrake + Knight is VALID with the Knight crowned", () => {
    const setup = sideA(
      [
        { class: 'golem', element: 'earth', name: 'Ogham' },
        { class: 'emberdrake', element: 'fire', name: 'Cindrath' },
        { class: 'knight', element: 'fire', name: 'Kain' },
      ],
      [TWO_MONSTER_CELLS[0], TWO_MONSTER_CELLS[1], { row: 'front', col: 'right' }],
      2,
    );
    expect(() => validateMatchSetup(setup)).not.toThrow();
  });

  it("Danilo's example 3 — Golem + Whelp + Knight + Cleric is VALID: the Whelp is a small, so it does NOT eat the second monster slot", () => {
    const setup = sideA(
      [
        { class: 'golem', element: 'earth', name: 'Ogham' },
        { class: 'whelp', element: 'fire', name: 'Emberis' },
        { class: 'knight', element: 'fire', name: 'Kain' },
        { class: 'cleric', element: 'water', name: 'Sela' },
      ],
      [
        { row: 'front', col: 'left' },
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'right' },
        { row: 'back', col: 'left' },
      ],
      2,
    );
    expect(() => validateMatchSetup(setup)).not.toThrow();
  });

  it('the WHELP specifically cannot be crowned — small, but dragonkind (the case 4.8’s sizeClass rule would have let through)', () => {
    const setup = sideA(
      [
        { class: 'golem', element: 'earth', name: 'Ogham' },
        { class: 'whelp', element: 'fire', name: 'Emberis' },
        { class: 'knight', element: 'fire', name: 'Kain' },
        { class: 'cleric', element: 'water', name: 'Sela' },
      ],
      [
        { row: 'front', col: 'left' },
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'right' },
        { row: 'back', col: 'left' },
      ],
      1, // the Whelp
    );
    expectViolation(setup, 'leader-not-human', /dragon/);
  });

  it('the error names the offending RACE, so every non-human kind reports its own reason', () => {
    const cases: [MatchSetup['armies']['A'][number]['class'], RegExp][] = [
      ['golem', /golem/],
      ['gryphon', /beast/],
      ['emberdrake', /dragon/],
    ];
    for (const [cls, reason] of cases) {
      const setup = sideA(
        [
          { class: cls, element: 'earth', name: 'Ogham' },
          { class: 'knight', element: 'fire', name: 'Kain' },
          { class: 'cleric', element: 'water', name: 'Sela' },
          { class: 'archer', element: 'wind', name: 'Lyra' },
        ],
        [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'right' },
          { row: 'back', col: 'left' },
        ],
        0,
      );
      expectViolation(setup, 'leader-not-human', reason);
    }
  });

  it('the monster CAP still counts sizeClass, not race: two monsters plus a Whelp clears `too-many-monsters` and dies on the crown instead', () => {
    // ROSTER.md §Monster rules states the consequence "a 2-monster + Whelp
    // army is legal, if a human leader is aboard" — at slotBudget 5 that
    // army is 2+2+1 = 5 slots with no room left for the human, so it can
    // never validate. The CAP semantics are still exactly as decided (the
    // Whelp does not consume a monster slot); what's unreachable is only
    // that particular illustration. Pinned so the distinction is deliberate.
    const setup = sideA(
      [
        { class: 'golem', element: 'earth', name: 'Ogham' },
        { class: 'cragmaw', element: 'earth', name: 'Korvassa' },
        { class: 'whelp', element: 'fire', name: 'Emberis' },
      ],
      [TWO_MONSTER_CELLS[0], TWO_MONSTER_CELLS[1], { row: 'front', col: 'right' }],
      0,
    );
    expectViolation(setup, 'leader-not-human', /A/); // NOT 'too-many-monsters' — the Whelp is a small
  });

  it('the REACHABLE cap demonstration: 1 monster + Whelp + 2 humans is legal, and four Whelps beside one human is legal (ROSTER.md, corrected)', () => {
    // The Whelp does not consume a monster-cap slot, and unlike the retired
    // "2 monsters + Whelp" illustration these armies leave room for the human
    // the crown requires.
    const setup = sideA(
      [
        { class: 'cragmaw', element: 'earth', name: 'Korvassa' },
        { class: 'whelp', element: 'fire', name: 'Emberis' },
        { class: 'knight', element: 'fire', name: 'Kain' },
        { class: 'cleric', element: 'water', name: 'Sela' },
      ],
      [
        { row: 'front', col: 'left' },
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'right' },
        { row: 'back', col: 'left' },
      ],
      2,
    );
    expect(() => validateMatchSetup(setup)).not.toThrow();

    const brood = sideA(
      [
        { class: 'whelp', element: 'fire', name: 'Emberis' },
        { class: 'whelp', element: 'water', name: 'Fyrnwyn' },
        { class: 'whelp', element: 'wind', name: 'Ithrax' },
        { class: 'whelp', element: 'earth', name: 'Lorvyth' },
        { class: 'knight', element: 'fire', name: 'Kain' },
      ],
      [
        { row: 'front', col: 'left' },
        { row: 'front', col: 'center' },
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'left' },
        { row: 'mid', col: 'center' },
      ],
      4,
    );
    expect(() => validateMatchSetup(brood)).not.toThrow();
  });

  it('the Whelp costs 1 slot where a real monster costs 2 — the arithmetic that keeps it outside the cap', () => {
    // Retitled at review (2026-07-28): the old title claimed a third-monster
    // cap check this body never made. What the body actually pins is the slot
    // arithmetic — the player-visible consequence of the Whelp being small.
    // A third monster itself can never reach the `too-many-monsters` cap at
    // slotBudget 5: three monsters cost 6 slots, so `wrong-slot-total` fires
    // FIRST (validation order: slots before footprint) — the cap check is
    // belt-and-suspenders at this budget, live again if the budget ever grows.
    expect(slotTotal([{ class: 'whelp' }])).toBe(1);
    expect(slotTotal([{ class: 'cragmaw' }])).toBe(2);
  });
});

/**
 * The monster reservation ring is DATA-driven off `sizeClass` (story 4.8's
 * rule, story 5.5's first real test of it): nine classes now carry
 * `sizeClass: 'monster'`, and nothing in `canPlace`/`legalAnchors` mentions
 * the Golem by name — so every one of them must reserve the identical ring,
 * and the 1-slot Whelp must reserve nothing at all despite being dragonkind.
 */
describe('placement reservations are per-sizeClass, not per-class (story 5.5, E5-P3)', () => {
  const ALL_CELLS = (['front', 'mid', 'back'] as const).flatMap((row) => (['left', 'center', 'right'] as const).map((col) => ({ row, col })));
  const key = (c: { row: string; col: string }) => `${c.row}/${c.col}`;
  const MONSTERS = ['golem', 'gryphon', 'wyrm', 'hellhound', 'emberdrake', 'frostfang', 'stormscale', 'cragmaw', 'nightwing', 'halowing'] as const;

  it('a dragon DEAD-CENTER blocks the entire rest of the board — no small can be placed anywhere (the dossier example, now with a dragon)', () => {
    const anchors = legalAnchors('knight', [{ class: 'cragmaw', placement: { row: 'mid', col: 'center' } }]);
    expect(anchors).toEqual([]);
  });

  it('a dragon in a CORNER blocks 3 cells, leaving 5 free (the other dossier example)', () => {
    const anchors = legalAnchors('knight', [{ class: 'emberdrake', placement: { row: 'front', col: 'left' } }]);
    // front/left's own cell plus its 3 on-grid king-move neighbours are gone.
    expect(new Set(anchors.map(key))).toEqual(new Set(['front/right', 'mid/right', 'back/left', 'back/center', 'back/right']));
    expect(anchors).toHaveLength(5);
  });

  it('EVERY monster class reserves the identical ring — the rule reads sizeClass, so no class is special-cased', () => {
    for (const anchor of ALL_CELLS) {
      const baseline = legalAnchors('knight', [{ class: 'golem', placement: anchor }])
        .map(key)
        .sort();
      for (const cls of MONSTERS) {
        expect(
          legalAnchors('knight', [{ class: cls, placement: anchor }])
            .map(key)
            .sort(),
          `${cls} at ${key(anchor)}`,
        ).toEqual(baseline);
      }
    }
  });

  it('the WHELP reserves NOTHING (E5-P3: 1 slot, small, no ring) — it only occupies its own cell, like any human', () => {
    for (const anchor of ALL_CELLS) {
      const whelpAnchors = legalAnchors('knight', [{ class: 'whelp', placement: anchor }])
        .map(key)
        .sort();
      const knightAnchors = legalAnchors('knight', [{ class: 'knight', placement: anchor }])
        .map(key)
        .sort();
      expect(whelpAnchors, `whelp at ${key(anchor)}`).toEqual(knightAnchors);
      // Concretely: all 9 cells minus its own.
      expect(whelpAnchors).toHaveLength(ALL_CELLS.length - 1);
    }
  });

  it('two monsters MAY share a column when two rows apart — there is no column rule, only the king-move ring (ROSTER.md said otherwise; corrected 2026-07-28)', () => {
    // front-left + back-left: same column, row distance 2, so neither is in the
    // other's Moore neighbourhood. LEGAL. It is the ADJACENT pair in that same
    // column that is not.
    expect(canPlace('emberdrake', { row: 'back', col: 'left' }, [{ class: 'golem', placement: { row: 'front', col: 'left' } }])).toBe(true);
    expect(canPlace('emberdrake', { row: 'mid', col: 'left' }, [{ class: 'golem', placement: { row: 'front', col: 'left' } }])).toBe(false);
    // …and the same-ROW analogue, which the shipped twin-golems comp relies on.
    expect(canPlace('emberdrake', { row: 'front', col: 'right' }, [{ class: 'golem', placement: { row: 'front', col: 'left' } }])).toBe(true);
  });

  it('a unit may stand directly BESIDE a Whelp, and a Whelp beside anyone — the distinction that makes it a budget dragon rather than a small monster', () => {
    expect(canPlace('knight', { row: 'front', col: 'center' }, [{ class: 'whelp', placement: { row: 'front', col: 'left' } }])).toBe(true);
    expect(canPlace('whelp', { row: 'front', col: 'center' }, [{ class: 'knight', placement: { row: 'front', col: 'left' } }])).toBe(true);
    // …but NOT beside a real monster, in either direction.
    expect(canPlace('whelp', { row: 'front', col: 'center' }, [{ class: 'emberdrake', placement: { row: 'front', col: 'left' } }])).toBe(false);
    expect(canPlace('emberdrake', { row: 'front', col: 'center' }, [{ class: 'whelp', placement: { row: 'front', col: 'left' } }])).toBe(false);
  });
});
