import { BALANCE } from '@lordly/engine';
import type { ClassStats, UnitClass } from '@lordly/engine';
import type { DraftedUnit } from './MatchState';

/** A class's compact draft rules card (FR2). All numbers come from BALANCE — never retyped. */
export interface RulesCard {
  name: string;
  /** Short role label (Front-line tank, Support, …). */
  role: string;
  /** One-line targeting/behavior summary. */
  behavior: string;
  /** The class this one deals ×1.5 to (FR14), or `undefined` if outside the triangle. */
  beats?: UnitClass;
  /** The class that deals ×1.5 to this one, or `undefined` if outside the triangle. */
  beatenBy?: UnitClass;
  /** Per-row action counts (FR15), read from BALANCE. */
  actions: ClassStats['actions'];
  /** The full stat block (FR15), read from BALANCE — the card shows a subset, this is the source. */
  stats: ClassStats;
}

/** Static flavor text per class (role + behavior). The NUMBERS live in BALANCE; only prose lives here. */
const CLASS_TEXT: Record<UnitClass, { role: string; behavior: string }> = {
  knight: { role: 'Front-line tank', behavior: 'Melee: strikes the nearest reachable enemy row' },
  mercenary: { role: 'Neutral sellsword', behavior: 'Melee: nearest reachable enemy row, no class advantage' },
  archer: { role: 'Back-row sniper', behavior: 'Ranged: arcs over the front to hit the rearmost reachable row' },
  mage: { role: 'Row artillery', behavior: 'Blast: hits every unit in the enemy row with the most units' },
  cleric: { role: 'Support', behavior: 'Heals the most-hurt ally; a weak staff attack if none is hurt' },
  witch: { role: 'Control', behavior: 'Casts an element-keyed status on a rear enemy; deals no damage' },
};

/** Whether another unit may still be drafted (FR1 — army capped at BALANCE.armySize). */
export function canAddUnit(army: readonly DraftedUnit[]): boolean {
  return army.length < BALANCE.armySize;
}

/** Whether the draft is complete and the player may continue to placement (exactly army size). */
export function canContinue(army: readonly DraftedUnit[]): boolean {
  return army.length === BALANCE.armySize;
}

/**
 * Builds a class's rules card (FR2), reading every stat and RPS relation
 * from BALANCE so the card can never drift from the engine's real numbers
 * (the data-must-be-read lesson from the 1.6/1.7 reviews).
 */
export function classRulesCard(cls: UnitClass): RulesCard {
  const stats = BALANCE.classes[cls];
  const beatenBy = (Object.keys(BALANCE.rpsBeats) as UnitClass[]).find((attacker) => BALANCE.rpsBeats[attacker] === cls);
  return {
    name: cls,
    role: CLASS_TEXT[cls].role,
    behavior: CLASS_TEXT[cls].behavior,
    beats: BALANCE.rpsBeats[cls],
    beatenBy,
    actions: stats.actions,
    stats,
  };
}
