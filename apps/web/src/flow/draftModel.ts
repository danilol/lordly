import { ALL_CLASSES, ALL_ROWS, BALANCE, dealsAdvantage, MAX_MONSTERS_PER_ARMY, SLOT_COST, slotTotal } from '@lordly/engine';
import type { ClassStats, UnitClass } from '@lordly/engine';
import { CLASS_DISPLAY_NAME, CLASS_MOVE_NAMES } from '../config/constants';
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
  /** Slot cost (FR1/FR38): 1 for a small, 2 for a monster. From SLOT_COST — the card shows it so a monster's 2-slot price is visible, not just silently enforced (story 4.9). */
  slotCost: number;
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
  mage: { role: 'Artillery', behavior: 'Front: a weak staff jab. Mid/back: a Magic Bolt at the rearmost enemy' },
  cleric: { role: 'Support', behavior: 'Heals the most-hurt ally; a weak staff attack if none is hurt' },
  witch: { role: 'Control', behavior: 'Casts an element-keyed status on a rear enemy; deals no damage' },
  // Story 4.3 wave 1 — "start generic": role/stat variants of the shipped six.
  berserker: { role: 'Vanguard bruiser', behavior: 'Melee: nearest reachable enemy row; hits hard, lightly armored' },
  phalanx: { role: 'Vanguard wall', behavior: 'Melee: nearest reachable row. Front/mid Guard instead of attacking' },
  ninja: { role: 'Skirmisher', behavior: 'Melee: nearest reachable enemy row; very fast, no class advantage' },
  valkyrie: { role: 'Skirmisher', behavior: 'Melee up close; from the back row casts Lightning at the rearmost enemy' },
  sorceress: { role: 'Artillery', behavior: 'Front: a weak staff jab. Mid/back: a Magic Bolt at the rearmost enemy' },
  // Story 4.8 — the wave's only monster (single cell, costs 2 slots). Device
  // revision: NOT a two-cell body — one tile, so large no unit may stand beside it.
  golem: { role: 'Brute wall', behavior: 'Melee brute: huge HP, hits hard, weak to magic; so large no unit may stand beside it' },
  // Story 5.4 — the human wave (behavior prose tracks ROSTER.md's showcase column).
  fencer: { role: 'Duelist', behavior: 'Melee: nearest reachable enemy row; wins duels on crit and dodge, dies to focus fire' },
  dragonhunter: { role: 'Dragonslayer', behavior: 'Melee: nearest reachable enemy row; deals ×1.5 to dragons, ordinary vs everyone else' },
  hawkman: { role: 'Skirmisher', behavior: 'Melee: nearest reachable enemy row; a reliable, unremarkable line-holder' },
  vultan: { role: 'Skirmisher', behavior: 'Melee up close; from the back row fires Wind Shot at the rearmost enemy' },
  raven: { role: 'Skirmisher', behavior: 'Melee up close; from the back row fires Thunder Arrow at the rearmost enemy' },
  // Story 5.5 — the monster wave (prose tracks ROSTER.md's showcase column).
  // Every one of these is leader-INELIGIBLE (E5-D13); that rule is surfaced
  // by `draftBlockReason` on the tray hint line rather than repeated in
  // eleven prose strings, so it stays single-sourced on the `race` field.
  // Note the 7 row-varying monsters (Gryphon + the six breath dragons) show
  // the F/M/B move breakdown instead of this line in the Draft panel — the
  // prose is still their single source for every other surface.
  gryphon: {
    role: 'Fast beast',
    behavior: 'Melee up close; from the back row fires Wind Shot at the rearmost enemy. Acts early; so large no unit may stand beside it',
  },
  wyrm: { role: 'All-row beast', behavior: 'Melee brute: bites from any row, twice from the middle; so large no unit may stand beside it' },
  hellhound: {
    role: 'Glass-cannon beast',
    behavior: 'Melee brute: three bites from the front row, the biggest burst in the game; so large no unit may stand beside it',
  },
  whelp: { role: 'Small dragon', behavior: 'Melee: nearest reachable enemy row. A 1-slot dragon: it stands anywhere, but hunters still hit it ×1.5' },
  emberdrake: { role: 'Damage dragon', behavior: 'Bites up close; from the back row breathes fire over a whole enemy row' },
  frostfang: { role: 'Warded dragon', behavior: 'Bites up close; from the back row breathes frost over a whole enemy row. Resists magic' },
  stormscale: { role: 'Fast dragon', behavior: 'Bites up close; from the back row breathes storm over a whole enemy row. Acts early and crits often' },
  cragmaw: { role: 'Wall dragon', behavior: 'Bites up close; from the back row breathes acid over a whole enemy row. The toughest hide in the game' },
  // Nightwing's tail tracks ROSTER's "high STR + DEX lean" — NOT "hits
  // hardest": the Emberdrake out-muscles it 34 STR to 32 (review-caught).
  nightwing: { role: 'Assassin dragon', behavior: 'Bites up close; from the back row breathes dread over a whole enemy row. Hits hard and crits often' },
  halowing: { role: 'Balanced dragon', behavior: 'Bites up close; from the back row breathes radiance over a whole enemy row. No weakness, no spike' },
};

/**
 * The Draft picker's tabs (story 5.5, Danilo-approved 2026-07-28): 27 classes
 * arithmetically cannot fit one grid (recon against the 5.4 5×62 geometry: 6
 * rows would have ended at y=418 against the detail panel at 310), so the
 * picker splits into two tabs — Humans (16) and Monsters (the Golem + the
 * 5.5 wave, 11) — and each tab renders the CURRENT `DRAFT_GRID` (the 4×80×48
 * re-lay the tabs themselves paid for; see constants.ts for the arithmetic).
 * The split axis is RACE (the E5-D13 field): every class lands in exactly
 * one tab, and a future wave that overflows a tab fails draft-grid.test.ts,
 * not a device pass.
 */
export type DraftTabId = 'humans' | 'monsters';

export const ALL_DRAFT_TABS: readonly DraftTabId[] = ['humans', 'monsters'];

export const DRAFT_TAB_LABELS: Record<DraftTabId, string> = { humans: 'HUMANS', monsters: 'MONSTERS' };

/** Which tab a class lives in — humans by race, everything else is a monster-tab creature (incl. the small Whelp). */
export function draftTabOf(cls: UnitClass): DraftTabId {
  return BALANCE.classes[cls].race === 'human' ? 'humans' : 'monsters';
}

/** The classes shown on one tab, in ALL_CLASSES order (the grid fills row-major from this). */
export function draftTabClasses(tab: DraftTabId): UnitClass[] {
  return ALL_CLASSES.filter((cls) => draftTabOf(cls) === tab);
}

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

/**
 * A short player-facing label for one row's move (FR32/FR33) — Guard names
 * its tier; a class-named verb (story 5.4, E5-D10: the Valkyrie's back row
 * reads "Lightning", not "Bolt") when the dossier assigned one; Title Case
 * otherwise. Pass the class so the Draft card and the battle plate speak the
 * same vocabulary (both read CLASS_MOVE_NAMES).
 */
export function moveLabel(move: ClassStats['moves']['front'], cls?: UnitClass): string {
  if (move === 'guard-full') return 'Guard (full)';
  if (move === 'guard-half') return 'Guard (half)';
  const named = cls !== undefined && move !== 'blast' ? CLASS_MOVE_NAMES[cls]?.[move] : undefined;
  return named ?? move.charAt(0).toUpperCase() + move.slice(1);
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

/** Whether the army contains at least one human (E5-D13, story 5.5) — the crown must land on someone. */
export function hasHuman(army: readonly DraftedUnit[]): boolean {
  return army.some((u) => BALANCE.classes[u.class].race === 'human');
}

/**
 * Whether the draft is complete and the player may continue to placement:
 * slot budget exactly filled (AD-1) AND at least one human aboard (E5-D13,
 * story 5.5 — Placement requires a crown and only humans wear it, so an
 * all-monster army would be a dead end there; the gate moves the refusal to
 * where the fix is, with `draftBlockReason` naming it).
 */
export function canContinue(army: readonly DraftedUnit[]): boolean {
  return slotTotal(army) === BALANCE.slotBudget && hasHuman(army);
}

/**
 * Why the draft can't continue yet, or `null` when it can — the Draft scene's
 * hint line renders this so the no-human case is never a silent dead end
 * (this codebase's no-dead-end philosophy).
 */
export function draftBlockReason(army: readonly DraftedUnit[]): string | null {
  if (slotTotal(army) !== BALANCE.slotBudget) return null; // the fill counter already tells this story
  if (!hasHuman(army)) return 'Your army needs a human to lead it — swap one in to continue';
  return null;
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
    slotCost: SLOT_COST[stats.sizeClass],
    beats: ALL_CLASSES.filter((other) => dealsAdvantage(cls, other)),
    beatenBy: ALL_CLASSES.filter((other) => dealsAdvantage(other, cls)),
    actions: stats.actions,
    moves: stats.moves,
    stats,
  };
}
