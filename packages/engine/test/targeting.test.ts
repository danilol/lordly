import { describe, expect, it } from 'vitest';
import { reachableEnemyCols, selectMeleeTarget } from '../src/targeting';
import type { MeleeCandidate } from '../src/targeting';

/** Shorthand: candidate at enemy owner-local (rowIndex, colIndex). */
function at(rowIndex: number, colIndex: number, alive = true): MeleeCandidate {
  return { rowIndex, colIndex, alive };
}

describe('FR7 reach (mirrored lanes, owner-local coords)', () => {
  it('own left (0) reaches enemy right+center; center reaches all; right reaches left+center', () => {
    expect([...reachableEnemyCols(0)].sort()).toEqual([1, 2]); // faces enemy 2, adjacent 1
    expect([...reachableEnemyCols(1)].sort()).toEqual([0, 1, 2]);
    expect([...reachableEnemyCols(2)].sort()).toEqual([0, 1]); // faces enemy 0, adjacent 1
  });
});

describe('FR8 melee target selection', () => {
  it('picks only from the nearest occupied reachable row (front shields back)', () => {
    // Attacker at own right (2): reaches enemy cols {0, 1}.
    const candidates = [at(0, 0), at(2, 1)]; // front/left alive shields back/center
    expect(selectMeleeTarget(2, candidates)).toBe(0);
  });

  it('an unreachable front unit shields nothing', () => {
    // Attacker at own right (2): reach {0,1}; enemy front/right (col 2) is unreachable.
    const candidates = [at(0, 2), at(2, 0)]; // front/right unreachable; back/left reachable
    expect(selectMeleeTarget(2, candidates)).toBe(1);
  });

  it('prefers the facing column first', () => {
    // Attacker at own left (0): facing enemy col 2, adjacent 1. Same row, both alive.
    const candidates = [at(0, 1), at(0, 2)];
    expect(selectMeleeTarget(0, candidates)).toBe(1); // col 2 = facing
  });

  it('nearest row dominates the column chain (row decides before any column key)', () => {
    // Attacker at own left (0): reach {1,2}; the facing col 2 unit is in a
    // FARTHER row, so the nearer center-column unit wins on the row key.
    const candidates = [at(0, 1), at(1, 2)];
    expect(selectMeleeTarget(0, candidates)).toBe(0);
  });

  it('corner attacker, facing column empty in the nearest row → takes the adjacent center', () => {
    // Attacker at own left (0): reach {1,2}; nearest row has only col 1.
    // (FR8 priority ② is provably inert at 3 columns — see targeting.ts note —
    // so this pins the facing-empty branch outcome, not the center-distance key.)
    const candidates = [at(0, 1), at(1, 2), at(2, 2)];
    expect(selectMeleeTarget(0, candidates)).toBe(0);
  });

  it("breaks the center-attacker adjacency tie with the ATTACKER'S-view left (enemy owner-local right)", () => {
    // Attacker at own center (1): facing col 1 empty; eligible row has cols 0 and 2.
    const candidates = [at(0, 0), at(0, 2)];
    expect(selectMeleeTarget(1, candidates)).toBe(1); // enemy col 2 = attacker-view left
  });

  it('ignores dead and unreachable units entirely', () => {
    // Attacker at own left (0): reach {1,2}.
    const candidates = [at(0, 2, false), at(0, 0), at(1, 1)];
    // front/right dead; front/left unreachable; nearest occupied reachable row = mid.
    expect(selectMeleeTarget(0, candidates)).toBe(2);
  });

  it('returns undefined when no living reachable enemy exists', () => {
    // Attacker at own left (0): reach {1,2}; only enemy alive is at col 0 (unreachable).
    expect(selectMeleeTarget(0, [at(0, 0), at(1, 0, false)])).toBeUndefined();
  });
});
