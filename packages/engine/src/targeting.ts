/**
 * FR7 **reach** and FR8 melee targeting — pure position math over owner-local
 * coordinates (AD-11). The two grids face each other with mirrored lanes:
 * own column index `i` faces enemy owner-local column index `2 − i` (the PRD's
 * "your left column faces the enemy's right"); reach = the facing column plus
 * adjacent ones. Stories 1.6 adds ranged/magic targeting beside this.
 */

/** A living-or-dead enemy position, enemy owner-local indices (AD-11). */
export interface MeleeCandidate {
  rowIndex: number;
  colIndex: number;
  alive: boolean;
}

/**
 * The enemy owner-local column indices a unit at `ownColIndex` can act on
 * (FR7): its facing column `2 − i` plus adjacent columns. Corner units reach
 * two enemy columns; the center unit reaches all three.
 */
export function reachableEnemyCols(ownColIndex: number): readonly number[] {
  const facing = 2 - ownColIndex;
  const cols = [facing];
  if (facing - 1 >= 0) cols.push(facing - 1);
  if (facing + 1 <= 2) cols.push(facing + 1);
  return cols;
}

/**
 * FR8 melee selection: among LIVING candidates in reachable columns, only
 * those in the nearest occupied row (lowest enemy rowIndex — their front is
 * nearest the attacker) are eligible; a living reachable front unit shields
 * reachable units behind it, but an unreachable unit shields nothing. From
 * eligible targets pick by: ① facing column → ② column closer to center →
 * ③ the attacker's-view left (= HIGHER enemy owner-local column index — spec
 * decision recorded in story 1.5: FR8 describes the attacker's choice, and
 * the attacker sees the mirrored lane).
 *
 * Returns the index into `candidates` of the chosen target, or `undefined`
 * when no living reachable enemy exists (the attack is spent with no effect).
 * Re-evaluated per attack (FR8): callers invoke this for every swing.
 *
 * CONTRACT: the returned index is positional into the `candidates` array as
 * passed — callers projecting their own unit list must keep the projection
 * parallel (same order, no filtering) to map the index back safely.
 *
 * NOTE on priority ②: at 3-column geometry it is PROVABLY INERT — a corner
 * attacker's only non-facing reachable column is the center, and a center
 * attacker's two non-facing columns are equidistant from center — so the
 * center-distance key can never break a tie the earlier keys haven't. It is
 * kept for fidelity to FR8's stated chain (and future-proofing wider grids).
 */
export function selectMeleeTarget(attackerColIndex: number, candidates: readonly MeleeCandidate[]): number | undefined {
  const reach = reachableEnemyCols(attackerColIndex);
  const facing = 2 - attackerColIndex;

  let best: number | undefined;
  let bestRank: readonly number[] | undefined;
  candidates.forEach((c, i) => {
    if (!c.alive || !reach.includes(c.colIndex)) return;
    // Lexicographic rank: nearest row, then the FR8 column priority chain.
    const rank = [
      c.rowIndex,
      c.colIndex === facing ? 0 : 1,
      Math.abs(c.colIndex - 1),
      2 - c.colIndex, // attacker-view index: lower = attacker's left
    ];
    if (bestRank === undefined || lexLess(rank, bestRank)) {
      best = i;
      bestRank = rank;
    }
  });
  return best;
}

/** True when `a` precedes `b` lexicographically. */
function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const av = a[i] as number;
    const bv = b[i] as number;
    if (av !== bv) return av < bv;
  }
  return false;
}
