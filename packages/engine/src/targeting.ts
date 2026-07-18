/**
 * FR7 reach, FR9 global range, and FR34 tactics — the fixed two-step target
 * pipeline (story 4.4). Pure position/HP math over owner-local coordinates
 * (AD-11). The two grids face each other with mirrored lanes: own column index
 * `i` faces enemy owner-local column index `2 − i` (the PRD's "your left column
 * faces the enemy's right").
 *
 * The pipeline is exactly two steps, in order:
 *   ① `legalTargets` — build the legal-target list (melee: reach-filtered with
 *      the FR7 Last Stand fallback; ranged/magic: the whole living grid, FR9).
 *   ② `applyTactic` — apply the army-wide tactic (FR34) over that list.
 * A tactic NEVER expands melee reach; Last Stand is the only reach relaxation,
 * and only when nothing is reachable. Everything here is deterministic — no
 * randomness (FR20): weakest/strongest ties and the leader/autonomous fallbacks
 * all resolve through the Autonomous priority rank.
 */

import type { Tactic, UnitId } from './types';

/**
 * A targeting candidate: enemy owner-local position (AD-11), liveness, current
 * HP (for weakest/strongest), and id (for the leader tactic). `UnitState`
 * structurally satisfies this, so resolve.ts passes its units directly — no
 * projection allocation (story 2.0 hot-path lesson).
 */
export interface TargetCandidate {
  rowIndex: number;
  colIndex: number;
  alive: boolean;
  hp: number;
  id: UnitId;
}

/** Melee is reach-filtered (FR7, with Last Stand); ranged/magic is global (FR9). */
export type TargetingMode = 'melee' | 'ranged';

/**
 * The enemy owner-local column indices a unit at `ownColIndex` can act on
 * (FR7, melee only): its facing column `2 − i` plus adjacent columns. Corner
 * units reach two enemy columns; the center unit reaches all three.
 */
export function reachableEnemyCols(ownColIndex: number): readonly number[] {
  const facing = 2 - ownColIndex;
  const cols = [facing];
  if (facing - 1 >= 0) cols.push(facing - 1);
  if (facing + 1 <= 2) cols.push(facing + 1);
  return cols;
}

/**
 * Step ① — the legal-target list (FR34), returning indices into `candidates`.
 * - `melee`: living enemies in reachable columns (FR7), restricted to the
 *   NEAREST occupied row — the FR8 blockade: a living front unit shields the
 *   rows behind it, so melee can never strike past the front line **even under
 *   a target tactic** (Danilo, 2026-07-18 — a melee unit physically cannot reach
 *   the back row; the dossier §4 "target tactics dissolve rows" holds only for
 *   ranged/magic, which arc over the front). When nothing is reachable, it falls
 *   back to ALL living enemies (still nearest-row) — the **Last Stand** rule
 *   (FR7): a melee unit whose reach is empty may target out-of-reach enemies, so
 *   a battle never stalls with living units unable to act.
 * - `ranged`: ALL living enemies, any row (FR9 global range — arrows/magic arc
 *   over the front, so a target tactic DOES pick across rows).
 *
 * CONTRACT: returned indices are positional into `candidates` as passed;
 * callers projecting their own unit list must keep the projection parallel.
 */
export function legalTargets(mode: TargetingMode, attackerColIndex: number, candidates: readonly TargetCandidate[]): number[] {
  const living: number[] = [];
  candidates.forEach((c, i) => {
    if (c.alive) living.push(i);
  });
  if (mode === 'ranged') return living;
  const reach = reachableEnemyCols(attackerColIndex);
  const reachable = living.filter((i) => reach.includes((candidates[i] as TargetCandidate).colIndex));
  const pool = reachable.length > 0 ? reachable : living; // reach, or FR7 Last Stand
  // FR8 blockade: only the nearest occupied row of the pool is legal for melee.
  const nearestRow = Math.min(...pool.map((i) => (candidates[i] as TargetCandidate).rowIndex));
  return pool.filter((i) => (candidates[i] as TargetCandidate).rowIndex === nearestRow);
}

/**
 * An Autonomous priority comparator: returns <0 when candidate `a` outranks `b`
 * (a is the preferred Autonomous target). Allocation-free — the sim harness and
 * property tests resolve thousands of battles, so the per-action hot path stays
 * projection-free (story 2.0 lesson); a rank-array-per-candidate would churn GC.
 */
export type RankCmp = (a: TargetCandidate, b: TargetCandidate) => number;

/**
 * Step ② — apply the army-wide tactic over the legal list, returning the chosen
 * index or `undefined` (empty list → the action is spent with no effect). `cmp`
 * is the class's Autonomous priority (melee: nearest row then FR8 columns;
 * ranged: rearmost row then FR8 columns) — the single source of deterministic
 * tie-breaking (FR20 — no new randomness):
 * - `autonomous`: the `cmp` best.
 * - `weakest` / `strongest`: min / max absolute current HP, ties → `cmp`.
 * - `leader`: the enemy leader (`leaderId`) when it is in the legal list, else
 *   `autonomous` — "Attack Leader when legal, else Autonomous until the path
 *   clears" (FR34).
 */
export function applyTactic(
  legal: readonly number[],
  candidates: readonly TargetCandidate[],
  tactic: Tactic,
  cmp: RankCmp,
  leaderId?: UnitId,
): number | undefined {
  if (legal.length === 0) return undefined;
  // Autonomous best over an HP filter (`keep`): single pass, no allocation.
  const bestOf = (keep: (c: TargetCandidate) => boolean): number => {
    let best = -1;
    for (const i of legal) {
      const c = candidates[i] as TargetCandidate;
      if (!keep(c)) continue;
      if (best === -1 || cmp(c, candidates[best] as TargetCandidate) < 0) best = i;
    }
    return best;
  };
  switch (tactic) {
    case 'autonomous':
      return bestOf(() => true);
    case 'leader': {
      const found = legal.find((i) => (candidates[i] as TargetCandidate).id === leaderId);
      return found !== undefined ? found : bestOf(() => true);
    }
    case 'weakest':
    case 'strongest': {
      let targetHp = (candidates[legal[0] as number] as TargetCandidate).hp;
      for (const i of legal) {
        const hp = (candidates[i] as TargetCandidate).hp;
        if (tactic === 'weakest' ? hp < targetHp : hp > targetHp) targetHp = hp;
      }
      return bestOf((c) => c.hp === targetHp); // ties fall back to the Autonomous priority (FR20)
    }
  }
}

/**
 * The Autonomous priority comparator for a melee attacker at `attackerColIndex`:
 * nearest row → FR8 column chain (facing → center → attacker's-view left).
 */
export function meleeCmp(attackerColIndex: number): RankCmp {
  const facing = 2 - attackerColIndex;
  return (a, b) =>
    a.rowIndex - b.rowIndex ||
    (a.colIndex === facing ? 0 : 1) - (b.colIndex === facing ? 0 : 1) ||
    Math.abs(a.colIndex - 1) - Math.abs(b.colIndex - 1) ||
    2 - a.colIndex - (2 - b.colIndex);
}

/**
 * The Autonomous priority comparator for a ranged/magic attacker: REARMOST row →
 * the same FR8 column chain. Arrows arc over the front to snipe the back line;
 * the column chain still reads from the attacker's facing lane.
 */
export function rangedCmp(attackerColIndex: number): RankCmp {
  const facing = 2 - attackerColIndex;
  return (a, b) =>
    b.rowIndex - a.rowIndex ||
    (a.colIndex === facing ? 0 : 1) - (b.colIndex === facing ? 0 : 1) ||
    Math.abs(a.colIndex - 1) - Math.abs(b.colIndex - 1) ||
    2 - a.colIndex - (2 - b.colIndex);
}

/**
 * Convenience for single-target melee (FR8): legal list (reach + Last Stand)
 * then the tactic. Returns the chosen index into `candidates` or `undefined`.
 */
export function selectMeleeTarget(attackerColIndex: number, candidates: readonly TargetCandidate[], tactic: Tactic, leaderId?: UnitId): number | undefined {
  const legal = legalTargets('melee', attackerColIndex, candidates);
  return applyTactic(legal, candidates, tactic, meleeCmp(attackerColIndex), leaderId);
}

/**
 * Convenience for single-target ranged/magic (FR9): global legal list then the
 * tactic. Used by Archer attacks, the Cleric's staff fallback, and Witch casts
 * (the Witch passes an already prefer-unafflicted-filtered candidate set).
 */
export function selectRangedTarget(attackerColIndex: number, candidates: readonly TargetCandidate[], tactic: Tactic, leaderId?: UnitId): number | undefined {
  const legal = legalTargets('ranged', attackerColIndex, candidates);
  return applyTactic(legal, candidates, tactic, rangedCmp(attackerColIndex), leaderId);
}

/**
 * FR10 blast row selection: the row containing the MOST living candidates,
 * ties broken toward the REARMOST row; reach is ignored entirely. Returns the
 * winning rowIndex, or `undefined` when no candidate lives. Reused with
 * own-side candidates for a confused Mage's "own fullest row" (FR16).
 *
 * The tactic interaction (D-2c) lives in resolve.ts: under `leader` the blast
 * targets the leader's ROW (AoE treats the leader as focal point); under every
 * other tactic — and when the leader is not alive — it keeps this rule.
 */
export function selectBlastRow(candidates: readonly TargetCandidate[]): number | undefined {
  const counts = [0, 0, 0];
  for (const c of candidates) {
    if (c.alive) counts[c.rowIndex] = (counts[c.rowIndex] ?? 0) + 1;
  }
  let best: number | undefined;
  for (let row = 0; row < 3; row++) {
    const count = counts[row] as number;
    if (count === 0) continue;
    if (best === undefined || count >= (counts[best] as number)) best = row; // >= → rearmost wins ties
  }
  return best;
}
