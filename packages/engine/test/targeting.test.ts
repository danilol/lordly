import { describe, expect, it } from 'vitest';
import { legalTargets, reachableEnemyCols, selectBlastRow, selectMeleeTarget, selectRangedTarget } from '../src/targeting';
import type { TargetCandidate } from '../src/targeting';
import type { UnitId } from '../src/types';

/** Shorthand: candidate at enemy owner-local (rowIndex, colIndex). Default id = `B:col`. */
function at(rowIndex: number, colIndex: number, opts: { alive?: boolean; hp?: number; id?: UnitId } = {}): TargetCandidate {
  return { rowIndex, colIndex, alive: opts.alive ?? true, hp: opts.hp ?? 100, id: opts.id ?? `B:${colIndex}` };
}

describe('FR7 reach (mirrored lanes, owner-local coords)', () => {
  it('own left (0) reaches enemy right+center; center reaches all; right reaches left+center', () => {
    expect([...reachableEnemyCols(0)].sort()).toEqual([1, 2]); // faces enemy 2, adjacent 1
    expect([...reachableEnemyCols(1)].sort()).toEqual([0, 1, 2]);
    expect([...reachableEnemyCols(2)].sort()).toEqual([0, 1]); // faces enemy 0, adjacent 1
  });
});

describe('legalTargets — step ① (FR7 melee reach + Last Stand, FR9 ranged global)', () => {
  it('melee: living enemies in reachable columns, restricted to the nearest row (FR8 blockade)', () => {
    // Attacker at own right (2): reaches enemy cols {0,1}; col-2 unit is out of
    // reach. Of the reachable pair — front/left (row 0) and mid/center (row 1) —
    // only the nearest occupied row (front) is legal: the front shields the mid.
    const candidates = [at(0, 0), at(0, 2), at(1, 1)];
    expect(legalTargets('melee', 2, candidates)).toEqual([0]);
  });

  it('melee Last Stand: empty reachable list falls back to ALL living (out-of-reach becomes legal)', () => {
    // Attacker at own left (0): reach {1,2}; the only living enemy is at col 0.
    const candidates = [at(0, 0), at(1, 0, { alive: false })];
    expect(legalTargets('melee', 0, candidates)).toEqual([0]); // Last Stand
  });

  it('ranged: the whole living grid, no column filter (FR9 global range)', () => {
    // Attacker at own left (0): reach would be {1,2}, but ranged ignores reach.
    const candidates = [at(0, 0), at(2, 0), at(1, 1, { alive: false })];
    expect(legalTargets('ranged', 0, candidates)).toEqual([0, 1]);
  });
});

describe('FR8 melee target selection (Autonomous — bit-identical to pre-4.4)', () => {
  const auto = 'autonomous' as const;

  it('picks only from the nearest occupied reachable row (front shields back)', () => {
    const candidates = [at(0, 0), at(2, 1)];
    expect(selectMeleeTarget(2, candidates, auto)).toBe(0);
  });

  it('an unreachable front unit shields nothing', () => {
    const candidates = [at(0, 2), at(2, 0)];
    expect(selectMeleeTarget(2, candidates, auto)).toBe(1);
  });

  it('prefers the facing column first', () => {
    const candidates = [at(0, 1), at(0, 2)];
    expect(selectMeleeTarget(0, candidates, auto)).toBe(1); // col 2 = facing
  });

  it('nearest row dominates the column chain', () => {
    const candidates = [at(0, 1), at(1, 2)];
    expect(selectMeleeTarget(0, candidates, auto)).toBe(0);
  });

  it("breaks the center-attacker adjacency tie with the attacker's-view left", () => {
    const candidates = [at(0, 0), at(0, 2)];
    expect(selectMeleeTarget(1, candidates, auto)).toBe(1); // enemy col 2 = attacker-view left
  });

  it('ignores dead and unreachable units entirely', () => {
    const candidates = [at(0, 2, { alive: false }), at(0, 0), at(1, 1)];
    expect(selectMeleeTarget(0, candidates, auto)).toBe(2);
  });

  it('Last Stand: with nothing reachable, targets an out-of-reach living enemy instead of idling', () => {
    // Pre-4.4 this returned undefined (idle skip); FR7 Last Stand now targets col 0.
    expect(selectMeleeTarget(0, [at(0, 0), at(1, 0, { alive: false })], auto)).toBe(0);
  });

  it('returns undefined only when NO living enemy exists at all', () => {
    expect(selectMeleeTarget(0, [at(0, 0, { alive: false }), at(1, 0, { alive: false })], auto)).toBeUndefined();
  });
});

describe('FR9 ranged/magic target selection (Autonomous, GLOBAL range)', () => {
  const auto = 'autonomous' as const;

  it('picks the rearmost occupied row (arcs over the front line)', () => {
    const candidates = [at(0, 1), at(2, 2)];
    expect(selectRangedTarget(0, candidates, auto)).toBe(1); // back row wins
  });

  it('reaches a formerly-unreachable rear unit (global range, no reach filter)', () => {
    // Attacker at own right (2): pre-4.4 reach {0,1} excluded col-2 back unit;
    // FR9 global range now reaches it, and rearmost wins.
    const candidates = [at(2, 2), at(1, 0)];
    expect(selectRangedTarget(2, candidates, auto)).toBe(0); // back/right now legal + rearmost
  });

  it('applies the FR8 column chain within the rearmost row', () => {
    expect(selectRangedTarget(0, [at(2, 1), at(2, 2)], auto)).toBe(1); // facing wins
    expect(selectRangedTarget(1, [at(2, 0), at(2, 2)], auto)).toBe(1); // attacker-view left
  });

  it('ignores dead units; undefined only when no living enemy exists', () => {
    expect(selectRangedTarget(0, [at(2, 2, { alive: false }), at(0, 0)], auto)).toBe(1);
    expect(selectRangedTarget(0, [at(2, 2, { alive: false })], auto)).toBeUndefined();
  });
});

describe('FR34 tactics over the legal list (deterministic — no randomness)', () => {
  it('weakest picks the lowest absolute HP; strongest the highest', () => {
    // Global (ranged) so reach never confounds; three back-row enemies.
    const candidates = [at(2, 0, { hp: 40, id: 'B:0' }), at(2, 1, { hp: 10, id: 'B:1' }), at(2, 2, { hp: 90, id: 'B:2' })];
    expect(selectRangedTarget(0, candidates, 'weakest')).toBe(1); // hp 10
    expect(selectRangedTarget(0, candidates, 'strongest')).toBe(2); // hp 90
  });

  it('weakest/strongest ties fall back to the Autonomous priority (FR20 — no new randomness)', () => {
    // Two equal-HP enemies; Autonomous rearmost+facing decides. Attacker col 0 faces enemy col 2.
    const candidates = [at(2, 1, { hp: 50 }), at(2, 2, { hp: 50 })];
    expect(selectRangedTarget(0, candidates, 'weakest')).toBe(1); // tie → facing col 2
  });

  it('melee weakest still respects reach — a tactic never expands reach', () => {
    // Attacker col 2 reaches {0,1}; the col-2 enemy has the lowest HP but is out of reach.
    const candidates = [at(0, 0, { hp: 30 }), at(0, 1, { hp: 60 }), at(0, 2, { hp: 5 })];
    expect(selectMeleeTarget(2, candidates, 'weakest')).toBe(0); // hp 30 (reachable), NOT the hp-5 col-2
  });

  it('melee blockade holds under a tactic: cannot strike a weaker BACK-row enemy shielded by a front unit', () => {
    // The exact bug Danilo caught: a front unit (hp 140) shields a back unit (hp
    // 40). Weakest would prefer the back unit by HP, but melee is physically
    // blocked by the front line — it hits the shield. Ranged arcs over it.
    const candidates = [at(0, 1, { hp: 140, id: 'B:0' }), at(2, 1, { hp: 40, id: 'B:1' })];
    expect(selectMeleeTarget(1, candidates, 'weakest')).toBe(0); // the front shield, NOT the weaker back unit
    expect(selectRangedTarget(1, candidates, 'weakest')).toBe(1); // ranged bypasses → the weak back unit
  });

  it('leader targets the enemy leader when it is legal', () => {
    const candidates = [at(0, 0, { id: 'B:0' }), at(2, 1, { id: 'B:1' }), at(1, 2, { id: 'B:2' })];
    expect(selectRangedTarget(0, candidates, 'leader', 'B:1')).toBe(1);
  });

  it('leader falls back to Autonomous when the leader is not in the legal list (dead or out of reach)', () => {
    // Leader B:2 is dead → not legal; Autonomous rearmost picks the living back unit.
    const candidates = [at(0, 0, { id: 'B:0' }), at(2, 1, { id: 'B:1' }), at(1, 2, { id: 'B:2', alive: false })];
    expect(selectRangedTarget(0, candidates, 'leader', 'B:2')).toBe(1); // autonomous rearmost
  });

  it('leader under melee falls back to Autonomous when the leader is out of reach', () => {
    // Attacker col 2 reaches {0,1}; leader B:2 (col 2) is out of reach → autonomous nearest reachable.
    const candidates = [at(0, 0, { id: 'B:0' }), at(0, 2, { id: 'B:2' })];
    expect(selectMeleeTarget(2, candidates, 'leader', 'B:2')).toBe(0);
  });

  describe('tactics combined with Last Stand (review coverage — the cross-product Task 3 asked for)', () => {
    // Attacker at own col 0 (reach {1,2}, facing col 2). Both enemies sit in the
    // UNREACHABLE column 0, across two different rows, so Last Stand widens the
    // pool to all living enemies — but the row-blockade still applies to that
    // widened pool: only the nearest row (B:0) is legal; the farther row (B:1)
    // stays shielded even though nothing is actually in reach.
    const nearShield = at(0, 0, { hp: 80, id: 'B:0' }); // nearest out-of-reach row
    const farBehind = at(1, 0, { hp: 10, id: 'B:1' }); // farther out-of-reach row, weaker
    const candidates = [nearShield, farBehind];

    it('weakest under Last Stand still respects the row-blockade: the shield is hit, not the weaker unit behind it', () => {
      expect(selectMeleeTarget(0, candidates, 'weakest')).toBe(0); // B:0 (hp 80), NOT the weaker B:1 (hp 10)
    });

    it('strongest under Last Stand still respects the row-blockade', () => {
      // Same geometry, HPs flipped: the farther unit is now the stronger one —
      // still shielded, so strongest also lands on the near row.
      const flipped = [at(0, 0, { hp: 50, id: 'B:0' }), at(1, 0, { hp: 200, id: 'B:1' })];
      expect(selectMeleeTarget(0, flipped, 'strongest')).toBe(0); // B:0, NOT the stronger-but-shielded B:1
    });

    it('leader under Last Stand: found when the leader IS the nearest shield', () => {
      expect(selectMeleeTarget(0, candidates, 'leader', 'B:0')).toBe(0);
    });

    it('leader under Last Stand: shielded by a nearer ally falls back to Autonomous (the leader is never reachable through a Last-Stand shield)', () => {
      expect(selectMeleeTarget(0, candidates, 'leader', 'B:1')).toBe(0); // autonomous hits the shield, B:0
    });
  });
});

describe('FR10 blast row selection', () => {
  it('picks the row with most living units, ignoring reach', () => {
    expect(selectBlastRow([at(0, 0), at(1, 1), at(1, 2)])).toBe(1); // mid has 2
  });

  it('breaks count ties toward the rearmost row', () => {
    expect(selectBlastRow([at(0, 0), at(2, 2)])).toBe(2);
  });

  it('counts only living units; undefined when none live', () => {
    expect(selectBlastRow([at(0, 0, { alive: false }), at(2, 1)])).toBe(2);
    expect(selectBlastRow([at(0, 0, { alive: false })])).toBeUndefined();
  });
});
