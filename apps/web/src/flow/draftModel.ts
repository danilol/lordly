import { ALL_CLASSES, BALANCE, dealsAdvantage, slotTotal } from '@lordly/engine';
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
  /** The full stat block (FR15), read from BALANCE — the card shows a subset, this is the source. */
  stats: ClassStats;
}

/** Static flavor text per class (role + behavior). The NUMBERS live in BALANCE; only prose lives here. */
const CLASS_TEXT: Record<UnitClass, { role: string; behavior: string }> = {
  knight: { role: 'Front-line tank', behavior: 'Melee: strikes the nearest reachable enemy row' },
  mercenary: { role: 'Neutral sellsword', behavior: 'Melee: nearest reachable enemy row, no class advantage' },
  archer: { role: 'Back-row sniper', behavior: 'Ranged: arcs over the front to hit the rearmost enemy row' },
  mage: { role: 'Row artillery', behavior: 'Blast: hits every unit in the enemy row with the most units' },
  cleric: { role: 'Support', behavior: 'Heals the most-hurt ally; a weak staff attack if none is hurt' },
  witch: { role: 'Control', behavior: 'Casts an element-keyed status on a rear enemy; deals no damage' },
  // Story 4.3 wave 1 — "start generic": role/stat variants of the shipped six.
  berserker: { role: 'Vanguard bruiser', behavior: 'Melee: nearest reachable enemy row; hits hard, lightly armored' },
  phalanx: { role: 'Vanguard wall', behavior: 'Melee: nearest reachable enemy row; heavily armored, slow' },
  ninja: { role: 'Skirmisher', behavior: 'Melee: nearest reachable enemy row; very fast, no class advantage' },
  valkyrie: { role: 'Skirmisher', behavior: 'Melee: nearest reachable enemy row; no class advantage' },
  sorceress: { role: 'Row artillery', behavior: 'Blast: hits every unit in the enemy row with the most units' },
};

/** Whether another unit may still be drafted (FR1/FR30 — SLOT budget, never a unit count: AD-1). */
export function canAddUnit(army: readonly DraftedUnit[]): boolean {
  return slotTotal(army) < BALANCE.slotBudget;
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
    stats,
  };
}
