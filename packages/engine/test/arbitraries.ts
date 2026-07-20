import { fc } from '@fast-check/vitest';
import { BALANCE } from '../src/balance';
import { FEMALE_NAMES, MALE_NAMES } from '../src/names';
import { canPlace, legalAnchors } from '../src/validate';
import { ALL_CLASSES, ALL_COLS, ALL_ELEMENTS, ALL_ROWS, ALL_TACTICS } from '../src/types';
import type { MatchSetup, Placement, Unit, UnitClass } from '../src/types';

/** Every cell of the 3×3 grid. */
const ALL_CELLS: Placement[] = ALL_ROWS.flatMap((row) => ALL_COLS.map((col) => ({ row, col })));

/** Real table names plus arbitrary non-blank strings — validation only demands non-blank (FR37). */
const nameArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...MALE_NAMES, ...FEMALE_NAMES),
  fc.string({ minLength: 1, maxLength: 24 }).filter((s) => s.trim().length > 0),
);

const SMALL_CLASSES = ALL_CLASSES.filter((c) => BALANCE.classes[c].sizeClass === 'small');
const MONSTER_CLASSES = ALL_CLASSES.filter((c) => BALANCE.classes[c].sizeClass === 'monster'); // golem-only wave 1 (dossier D-1b), kept generic for a future wave

const unitArb = (classes: readonly (typeof ALL_CLASSES)[number][]): fc.Arbitrary<Unit> =>
  fc.record({
    class: fc.constantFrom(...classes),
    element: fc.constantFrom(...ALL_ELEMENTS),
    name: nameArb,
  });

const smallUnitArb = unitArb(SMALL_CLASSES);
const monsterUnitArb = unitArb(MONSTER_CLASSES);
const A_SMALL = SMALL_CLASSES[0] as UnitClass; // any small — placement legality is class-independent for smalls (1 cell, no adjacency effect)

/**
 * Weighted toward 0 monsters (50/30/20 for 0/1/2) rather than uniform, so
 * branch-reachability property tests that need several smalls on one side
 * (e.g. guard.test.ts's "ally directly behind" case) stay well-fed.
 */
const monsterCountArb: fc.Arbitrary<number> = fc.oneof(
  { arbitrary: fc.constant(0), weight: 5 },
  { arbitrary: fc.constant(1), weight: 3 },
  { arbitrary: fc.constant(2), weight: 2 },
);

/**
 * Every legal monster-cell placement for a side fielding `count` monsters
 * that STILL LEAVES ROOM for the `smallCount` smalls the rest of the budget
 * needs (story 4.8 device revision, 2026-07-20: a monster is a single-cell
 * unit that blocks all 8 king-move neighbors). Computed via the engine's own
 * `canPlace`/`legalAnchors` (never re-deriving the rule), so the generator
 * can't drift from what `validateMatchSetup` enforces AND can never crash by
 * drawing more free cells than exist. A lone monster at true center
 * (mid/center) blocks the whole board → excluded; a 2-monster pair like
 * mid/left+mid/right leaves 0 free → excluded.
 */
function computeValidMonsterPlacements(count: number): Placement[][] {
  if (count === 0) return [[]];
  const smallCount = BALANCE.slotBudget - count * 2;
  const M = MONSTER_CLASSES[0] as UnitClass;
  if (count === 1) {
    return ALL_CELLS.filter((c) => legalAnchors(A_SMALL, [{ class: M, placement: c }]).length >= smallCount).map((c) => [c]);
  }
  const pairs: Placement[][] = [];
  for (let i = 0; i < ALL_CELLS.length; i++) {
    for (let j = i + 1; j < ALL_CELLS.length; j++) {
      const first = { class: M, placement: ALL_CELLS[i] as Placement };
      if (!canPlace(M, ALL_CELLS[j] as Placement, [first])) continue; // the two monsters must not be king-adjacent
      const both = [first, { class: M, placement: ALL_CELLS[j] as Placement }];
      if (legalAnchors(A_SMALL, both).length >= smallCount) pairs.push([ALL_CELLS[i] as Placement, ALL_CELLS[j] as Placement]);
    }
  }
  return pairs;
}

// Precomputed ONCE at module load — recomputing per-draw (each does dozens of
// canPlace/legalAnchors calls) made the property tests time out under coverage
// instrumentation. Each count's list must be non-empty, or `fc.constantFrom`
// below throws — assert it here so a future balance change (bigger slotBudget,
// a monster that blocks more) fails loudly at module load instead of as a
// cryptic `fc.constantFrom(...[])` error deep in a property run.
const VALID_MONSTER_PLACEMENTS: readonly Placement[][][] = [0, 1, 2].map((count) => {
  const list = computeValidMonsterPlacements(count);
  if (list.length === 0)
    throw new Error(`matchSetupArb: no room-leaving placement exists for ${count} monster(s) — the placement/slot rules changed; update the generator.`);
  return list;
});

/**
 * One side's slot-legal army + parallel placements (AD-1): 0–2 single-cell
 * monsters (each 2 slots, each blocking its 8 king-move neighbors) placed at
 * a room-leaving cell-set, the rest of the budget filled with smalls at the
 * engine's own `legalAnchors` — footprint-legal BY CONSTRUCTION, so a
 * property run never throws a spurious `InvalidMatchSetupError`.
 */
const armyAndPlacementsArb: fc.Arbitrary<{ army: Unit[]; placements: Placement[] }> = monsterCountArb.chain((monsterCount) => {
  const smallCount = BALANCE.slotBudget - monsterCount * 2;
  return fc
    .tuple(
      fc.constantFrom(...(VALID_MONSTER_PLACEMENTS[monsterCount] as Placement[][])),
      fc.array(monsterUnitArb, { minLength: monsterCount, maxLength: monsterCount }),
      fc.array(smallUnitArb, { minLength: smallCount, maxLength: smallCount }),
    )
    .chain(([monsterCells, monsterUnits, smallUnits]) => {
      const existing = monsterUnits.map((u, i) => ({ class: u.class, placement: monsterCells[i] as Placement }));
      const freeCells = legalAnchors(A_SMALL, existing); // guaranteed ≥ smallCount by validMonsterPlacements
      return fc.shuffledSubarray(freeCells, { minLength: smallCount, maxLength: smallCount }).map((smallCells) => ({
        army: [...monsterUnits, ...smallUnits],
        placements: [...monsterCells.map((c) => ({ ...c })), ...smallCells.map((c) => ({ ...c }))],
      }));
    });
});

/**
 * One side's army/placements PLUS a leader index — a separate step because
 * army length now VARIES (story 4.8: 2 monsters + 1 small is 3 units, not
 * 5), so the legal leader range depends on the just-generated army. Leader
 * is drawn only from SMALL indices (device-reported follow-up: a monster can
 * never be crowned, `validateMatchSetup` rejects it) — `smallCount` is
 * always ≥1 (a 2-monster side still leaves 1 slot for a small), so this
 * never draws from an empty set.
 */
const sideArb: fc.Arbitrary<{ army: Unit[]; placements: Placement[]; leader: number }> = armyAndPlacementsArb.chain(({ army, placements }) => {
  const smallIndices = army.reduce<number[]>((acc, unit, i) => {
    if (BALANCE.classes[unit.class].sizeClass !== 'monster') acc.push(i);
    return acc;
  }, []);
  return fc.integer({ min: 0, max: smallIndices.length - 1 }).map((i) => ({ army, placements, leader: smallIndices[i] as number }));
});

/**
 * A VALID `MatchSetup` (passes `validateMatchSetup`): slot-legal named
 * armies (0–2 monsters per side, story 4.8) with legal anchor placements,
 * explicit tactics and leaders (story 4.2, AD-9), distinct same-side cells,
 * uint32 seed, either mode. Shared by the chassis property tests.
 */
export const matchSetupArb: fc.Arbitrary<MatchSetup> = fc
  .record({
    seed: fc.integer({ min: 0, max: 0xffffffff }),
    balanceVersion: fc.constant(BALANCE.version),
    mode: fc.constantFrom('single', 'wipeout'),
    tactics: fc.record({ A: fc.constantFrom(...ALL_TACTICS), B: fc.constantFrom(...ALL_TACTICS) }),
    sideA: sideArb,
    sideB: sideArb,
  })
  .map(({ seed, balanceVersion, mode, tactics, sideA, sideB }) => ({
    seed,
    balanceVersion,
    mode,
    tactics,
    leaders: { A: sideA.leader, B: sideB.leader },
    armies: { A: sideA.army, B: sideB.army },
    placements: { A: sideA.placements, B: sideB.placements },
  }));
