import { ALL_CLASSES, ALL_ROWS, BALANCE, SLOT_COST } from '@lordly/engine';
import type { Element, Row, RowMove, UnitClass } from '@lordly/engine';
import { CLASS_DISPLAY_NAME, moveDisplayName, SPELL_DISPLAY_NAME } from '../config/constants';
import type { CardGlyph } from '../config/constants';
import { rowActionCounts } from './placement';
import { UNIT_FRAMES } from '../config/sprites';

/**
 * The unit-data card's pure model (story 5.6 — the OB64 UNIT DATA read).
 * Everything derives live from BALANCE and the existing display seams
 * (`moveDisplayName`, `rowActionCounts`, `SPELL_DISPLAY_NAME`), so a new
 * class appears on the card by existing — the dossier carry: "the table's
 * shape IS the card's content." PlacementScene renders this; no Phaser here.
 */

/**
 * The damage-type mark on a move row (OB64's "small, and placed where it
 * makes sense" detail): 'physical'/'magic' per ROSTER.md's move-catalog
 * Damage column — NOT the epic AC's older sentence, which predates `bolt`
 * (MAGIC, E5-D4) and `breath` (PHYSICAL, E5-D7). 'shield' marks a Guard row
 * (deals nothing); 'heal' marks the Cleric's restore (no aggression read —
 * the HEAL_TRACE_COLOR philosophy). The TYPE lives in constants.ts beside
 * CARD_GLYPHS/CARD_GLYPH_COLORS (review 2026-07-29: one union, not a
 * hand-copied pair); re-exported here so model consumers keep one import.
 */
export type { CardGlyph } from '../config/constants';

/**
 * Glyph per move-table row — keyed by the engine union (AD-4): a future
 * `RowMove` kind is a COMPILE ERROR here, never a silently wrong mark.
 */
const ROW_MOVE_GLYPH: Record<RowMove, CardGlyph> = {
  slash: 'physical',
  arrow: 'physical',
  bash: 'physical',
  staff: 'physical',
  breath: 'physical',
  bolt: 'magic',
  blast: 'magic',
  'guard-full': 'shield',
  'guard-half': 'shield',
};

/**
 * The roster's costliest unit size in slots — derived from SLOT_COST, never
 * hardcoded (device round 3, 2026-07-29: the size read must be "1 out of 2",
 * so the card always draws THIS many squares and fills the unit's cost).
 */
export const MAX_SLOT_COST = Math.max(...Object.values(SLOT_COST));

/** One card row: what this unit DOES from `row`, how many times, and the damage-type mark. */
export interface CardRow {
  row: Row;
  /** Player-facing verb — the battle plates' register ("Skewer", "Ember Breath"), Guard tiers, or the FR16 Heal/spell read. */
  label: string;
  /** Actions from this row (FR15) — renders as "×N" beside the label. */
  count: number;
  glyph: CardGlyph;
}

/** The full card content for one drafted unit — or a CLASS PREVIEW (device round 5: the Draft grid shows classes, and elements are rolled at draft, so a tile's card has no element yet). */
export interface UnitCardData {
  name: string;
  /** Interim portrait = the class's own board sprite frame (AC2's dated deviation); 5.9 swaps this lookup for real portraits. */
  portraitFrame: number;
  /** The UNIT's rolled element — absent on a class-preview card (Draft grid tiles): no dot, and the Witch reads a generic "Cast". */
  element?: Element;
  hp: number;
  /** Via SLOT_COST (its own export — never hardcode 1/2): the 2-slot price is part of the read (story 4.9 precedent). */
  slotCost: number;
  stats: { str: number; vit: number; int: number; men: number; agi: number; dex: number };
  rows: CardRow[];
}

/**
 * Builds the card for a UNIT (class + its rolled element — the element is
 * what lets a Witch's card name her actual spell, FR16) or, with no element,
 * a CLASS PREVIEW (device round 5 — the Draft grid's tiles).
 */
export function unitCard(cls: UnitClass, element?: Element): UnitCardData {
  const stats = BALANCE.classes[cls];
  const counts = rowActionCounts(cls);
  return {
    name: CLASS_DISPLAY_NAME[cls],
    portraitFrame: UNIT_FRAMES[cls],
    element,
    hp: stats.hp,
    slotCost: SLOT_COST[stats.sizeClass],
    stats: { str: stats.str, vit: stats.vit, int: stats.int, men: stats.men, agi: stats.agi, dex: stats.dex },
    rows: ALL_ROWS.map((row) => cardRow(cls, element, row, counts[row])),
  };
}

/**
 * One row's read. The Cleric and Witch act OUTSIDE the move table (FR16 —
 * the engine's own act() special-cases exactly these two), and ROSTER.md's
 * move catalog deliberately excludes their rows ("NOT move-table rows"), so
 * the card states them itself, matching ROSTER's table shape verbatim:
 * Cleric "Heal / Staff" front+mid, plain "Heal" back (her back row has no
 * staff fallback shown); Witch her element-keyed spell by NAME on every row.
 * Everyone else reads the move table through `moveDisplayName` — the same
 * vocabulary as the battle plates, one register on two surfaces.
 */
function cardRow(cls: UnitClass, element: Element | undefined, row: Row, count: number): CardRow {
  if (cls === 'cleric') {
    return { row, label: row === 'back' ? 'Heal' : 'Heal / Staff', count, glyph: 'heal' };
  }
  if (cls === 'witch') {
    // No element yet (a class-preview card) → the generic verb; the DETAIL
    // panel's prose already explains her element-keyed spell at Draft.
    return { row, label: element === undefined ? 'Cast' : SPELL_DISPLAY_NAME[BALANCE.elementSpells[element]], count, glyph: 'magic' };
  }
  const move = BALANCE.classes[cls].moves[row];
  // Guard tiers aren't MoveKinds, so they can't go through moveDisplayName —
  // the wording matches draftModel.moveLabel's exactly (one vocabulary).
  // `moveDisplayName` needs an element only for the BLAST's flavor word; no
  // shipped class carries blast, and a preview card passes 'fire' as the
  // harmless stand-in (a future blast class would flavor its preview).
  const label = move === 'guard-full' ? 'Guard (full)' : move === 'guard-half' ? 'Guard (half)' : moveDisplayName(move, element ?? 'fire', cls);
  return { row, label, count, glyph: ROW_MOVE_GLYPH[move] };
}

// ── The stat radar (story 5.6, device pass 2026-07-29: Danilo asked for "a
// spider chart for the stats, instead of displaying the raw numbers"). Pure
// vertex math here; the scene draws it with Graphics (the board.ts precedent
// — Phaser 4's add.polygon mangles quads, path calls don't).

/** The radar's axes, clockwise from the top vertex. Fixed order — the chart's shape becomes a class's signature, so this never reorders. */
export const STAT_AXES = ['str', 'vit', 'int', 'men', 'agi', 'dex'] as const;

/**
 * Per-axis roster maximum, derived live from BALANCE (never hardcoded — a
 * new stat ceiling re-scales every chart automatically). The radar's edge
 * means "the best in the roster at this", which is what makes two charts
 * comparable at a glance.
 */
export function statAxisMax(): Record<(typeof STAT_AXES)[number], number> {
  const max = { str: 1, vit: 1, int: 1, men: 1, agi: 1, dex: 1 };
  for (const cls of ALL_CLASSES) {
    for (const axis of STAT_AXES) max[axis] = Math.max(max[axis], BALANCE.classes[cls][axis]);
  }
  return max;
}

/** This unit's six axis ratios in (0, 1], STAT_AXES order — 1 = the roster's best on that axis. */
export function statAxisRatios(cls: UnitClass): number[] {
  const max = statAxisMax();
  return STAT_AXES.map((axis) => BALANCE.classes[cls][axis] / max[axis]);
}

/**
 * The polygon's vertices for `ratios` around (cx, cy) with edge radius `r`:
 * vertex i sits at angle −90° + i·60° (STR straight UP, then clockwise), at
 * `ratio × r` from the centre. `ratios` of all 1s traces the outer web ring —
 * the same function draws both, so the value shape and its frame can't skew.
 */
export function radarPoints(cx: number, cy: number, r: number, ratios: readonly number[]): { x: number; y: number }[] {
  return ratios.map((ratio, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / ratios.length;
    return { x: cx + Math.cos(angle) * ratio * r, y: cy + Math.sin(angle) * ratio * r };
  });
}
