import { ALL_CLASSES, ALL_ROWS, BALANCE, dealsAdvantage, MAX_MONSTERS_PER_ARMY, SLOT_COST, slotTotal } from '@lordly/engine';
import type { ClassStats, UnitClass } from '@lordly/engine';
import { CLASS_DISPLAY_NAME } from '../config/constants';
import type { DraftedUnit } from './MatchState';

/** A class's compact draft rules card (FR2). All numbers come from BALANCE — never retyped. */
export interface RulesCard {
  name: string;
  /** Short role label (Front-line tank, Support, …). */
  role: string;
  /** One-line targeting/behavior summary. */
  behavior: string;
  /** Classes this one deals ×1.5 to (FR14, role-derived — story 4.3). May be several as the roster grows; empty outside the relations. */
  beats: UnitClass[];
  /** Classes that deal ×1.5 to this one (FR14, role-derived). May be several; empty outside the relations. */
  beatenBy: UnitClass[];
  /** Per-row action counts (FR15), read from BALANCE. */
  actions: ClassStats['actions'];
  /** Per-row MOVE — what the class actually DOES from each row (FR32/FR33, story 4.7), read from BALANCE. Uniform for most classes; Knight/Phalanx/Wizard/Sorceress vary. */
  moves: ClassStats['moves'];
  /** The full stat block (FR15), read from BALANCE — the card shows a subset, this is the source. */
  stats: ClassStats;
}

/**
 * Static flavor text per class (role + behavior). The NUMBERS live in
 * BALANCE; only prose lives here. Story 4.7 (FR32/FR33): four classes' moves
 * now vary by ROW (Knight, Phalanx, Wizard/mage, Sorceress) — their behavior
 * line says so; the exact per-row breakdown renders separately from
 * `RulesCard.moves` (DraftScene, for these four only — everyone else is
 * uniform and the act-count line already covers row differences for them).
 */
const CLASS_TEXT: Record<UnitClass, { role: string; behavior: string }> = {
  knight: { role: 'Front-line tank', behavior: 'Melee: nearest reachable row. Mid row Guards instead of attacking' },
  mercenary: { role: 'Neutral sellsword', behavior: 'Melee: nearest reachable enemy row, no class advantage' },
  archer: { role: 'Back-row sniper', behavior: 'Ranged: arcs over the front to hit the rearmost enemy row' },
  mage: { role: 'Row artillery', behavior: 'Front: a weak staff jab. Mid/back: blasts the fullest enemy row' },
  cleric: { role: 'Support', behavior: 'Heals the most-hurt ally; a weak staff attack if none is hurt' },
  witch: { role: 'Control', behavior: 'Casts an element-keyed status on a rear enemy; deals no damage' },
  // Story 4.3 wave 1 — "start generic": role/stat variants of the shipped six.
  berserker: { role: 'Vanguard bruiser', behavior: 'Melee: nearest reachable enemy row; hits hard, lightly armored' },
  phalanx: { role: 'Vanguard wall', behavior: 'Melee: nearest reachable row. Front/mid Guard instead of attacking' },
  ninja: { role: 'Skirmisher', behavior: 'Melee: nearest reachable enemy row; very fast, no class advantage' },
  valkyrie: { role: 'Skirmisher', behavior: 'Melee: nearest reachable enemy row; no class advantage' },
  sorceress: { role: 'Row artillery', behavior: 'Front: a weak staff jab. Mid/back: blasts the fullest enemy row' },
  // Story 4.8 — the wave's only monster (2 slots, two-cell body).
  golem: { role: 'Brute wall', behavior: 'Melee: a two-cell body — blocks both its rows, struck at its front, sniped at its rear' },
};

/**
 * Whether this class's move actually varies by row (FR32/FR33, story 4.7) —
 * DraftScene reads this to decide whether to render the per-row breakdown line.
 * DERIVED from BALANCE (not a hardcoded class set): the move table is TUNABLE
 * (Danilo's queued per-class/row pass), so the single source of truth stays the
 * data — a class that gains or loses a row-varied move flips this automatically.
 */
export function movesVaryByRow(cls: UnitClass): boolean {
  const { moves } = BALANCE.classes[cls];
  return new Set(ALL_ROWS.map((row) => moves[row])).size > 1;
}

/** A short player-facing label for one row's move (FR32/FR33) — Guard names its tier; everything else is Title Case. */
export function moveLabel(move: ClassStats['moves']['front']): string {
  if (move === 'guard-full') return 'Guard (full)';
  if (move === 'guard-half') return 'Guard (half)';
  return move.charAt(0).toUpperCase() + move.slice(1);
}

/**
 * Whether `cls` may still be drafted onto this army (device-reported bug:
 * the UI let a 3rd monster through because it only checked the RUNNING slot
 * total, never what THIS candidate would cost, nor a monster-count cap).
 * Slot budget is SLOTS, never a unit count (FR1/FR30, AD-1); the monster cap
 * mirrors `validateMatchSetup`'s `too-many-monsters` rule (FR38) via the
 * SAME `MAX_MONSTERS_PER_ARMY` constant, so the two can never drift apart.
 */
export function canAddUnit(army: readonly DraftedUnit[], cls: UnitClass): boolean {
  const cost = SLOT_COST[BALANCE.classes[cls].sizeClass];
  if (slotTotal(army) + cost > BALANCE.slotBudget) return false;
  if (BALANCE.classes[cls].sizeClass === 'monster') {
    const monsterCount = army.filter((u) => BALANCE.classes[u.class].sizeClass === 'monster').length;
    if (monsterCount >= MAX_MONSTERS_PER_ARMY) return false;
  }
  return true;
}

/** Whether the draft is complete and the player may continue to placement (slot budget exactly filled — AD-1). */
export function canContinue(army: readonly DraftedUnit[]): boolean {
  return slotTotal(army) === BALANCE.slotBudget;
}

/**
 * Builds a class's rules card (FR2), reading every stat and matchup from
 * BALANCE so the card can never drift from the engine's real numbers (the
 * data-must-be-read lesson from the 1.6/1.7 reviews). Matchups derive from the
 * role-relation table via `dealsAdvantage` (story 4.3 — one matchup source).
 */
export function classRulesCard(cls: UnitClass): RulesCard {
  const stats = BALANCE.classes[cls];
  return {
    name: CLASS_DISPLAY_NAME[cls], // D-1d: `mage` displays as "Wizard"; engine key unchanged
    role: CLASS_TEXT[cls].role,
    behavior: CLASS_TEXT[cls].behavior,
    beats: ALL_CLASSES.filter((other) => dealsAdvantage(cls, other)),
    beatenBy: ALL_CLASSES.filter((other) => dealsAdvantage(other, cls)),
    actions: stats.actions,
    moves: stats.moves,
    stats,
  };
}
