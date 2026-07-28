import { describe, expect, it } from 'vitest';
import { ALL_CLASSES, ALL_ELEMENTS, ALL_ROWS, BALANCE, SLOT_COST } from '@lordly/engine';
import type { Element } from '@lordly/engine';
import { MAX_SLOT_COST, radarPoints, STAT_AXES, statAxisMax, statAxisRatios, unitCard } from '../src/flow/unitCard';
import type { CardGlyph } from '../src/flow/unitCard';
import { BASE_HEIGHT, BASE_WIDTH, CLASS_DISPLAY_NAME, SPELL_DISPLAY_NAME, UNIT_CARD } from '../src/config/constants';
import { UNIT_FRAMES } from '../src/config/sprites';

/**
 * Story 5.6 — the OB64 UNIT DATA card's pure model. The card reads everything
 * live from BALANCE (dossier carry: "the table's shape IS the card's
 * content"), so these tests are exhaustive over the whole roster: a 28th
 * class appears on the card by existing, and a gap fails HERE, not on a
 * device.
 */
describe('unitCard model (story 5.6, FR2/FR15 read at Placement)', () => {
  it('resolves a complete card for EVERY class × element — name, portrait, stats, HP, slot cost, element, three rows (27 × 4, no gaps)', () => {
    for (const cls of ALL_CLASSES) {
      for (const element of ALL_ELEMENTS) {
        const card = unitCard(cls, element);
        expect(card.name, cls).toBe(CLASS_DISPLAY_NAME[cls]);
        expect(card.portraitFrame, cls).toBe(UNIT_FRAMES[cls]); // interim: the board sprite IS the portrait until 5.9
        expect(card.element, cls).toBe(element);
        expect(card.hp, cls).toBe(BALANCE.classes[cls].hp);
        expect(card.slotCost, cls).toBe(SLOT_COST[BALANCE.classes[cls].sizeClass]);
        for (const stat of ['str', 'vit', 'int', 'men', 'agi', 'dex'] as const) {
          expect(card.stats[stat], `${cls}.${stat}`).toBe(BALANCE.classes[cls][stat]);
        }
        expect(
          card.rows.map((r) => r.row),
          cls,
        ).toEqual([...ALL_ROWS]);
        for (const row of card.rows) {
          expect(row.label, `${cls} ${row.row} label`).toMatch(/\S/);
          expect(row.count, `${cls} ${row.row} count`).toBe(BALANCE.classes[cls].actions[row.row]);
          expect(['physical', 'magic', 'shield', 'heal'], `${cls} ${row.row} glyph`).toContain(row.glyph);
        }
      }
    }
  });

  it('MAX_SLOT_COST derives from SLOT_COST (the "1 out of 2" frame the size squares draw against) — 2 today', () => {
    expect(MAX_SLOT_COST).toBe(Math.max(...Object.values(SLOT_COST)));
    expect(MAX_SLOT_COST).toBe(2);
  });

  it('slot cost distinguishes the Whelp (1) from a true monster (2) — the E5-P3 read the card must not blur', () => {
    expect(unitCard('whelp', 'fire').slotCost).toBe(1);
    expect(unitCard('cragmaw', 'earth').slotCost).toBe(2);
    expect(unitCard('knight', 'fire').slotCost).toBe(1);
  });

  describe('the damage-type glyph — ROSTER.md’s move-catalog Damage column, NOT the epic AC’s pre-bolt/breath sentence', () => {
    const glyphAt = (cls: (typeof ALL_CLASSES)[number], row: (typeof ALL_ROWS)[number], element: Element = 'fire'): CardGlyph =>
      unitCard(cls, element).rows.find((r) => r.row === row)!.glyph;

    it('BREATH is PHYSICAL (E5-D7 — the 5.5 newcomer the stale mapping would get wrong)', () => {
      for (const dragon of ['emberdrake', 'frostfang', 'stormscale', 'cragmaw', 'nightwing', 'halowing'] as const) {
        expect(glyphAt(dragon, 'back'), dragon).toBe('physical');
      }
    });

    it('BOLT is MAGIC (E5-D4 — the 5.4 newcomer the stale mapping would get wrong)', () => {
      expect(glyphAt('mage', 'mid')).toBe('magic');
      expect(glyphAt('mage', 'back')).toBe('magic');
      expect(glyphAt('sorceress', 'back')).toBe('magic');
      expect(glyphAt('valkyrie', 'back')).toBe('magic'); // her Lightning rides `bolt`
    });

    it('the physical kinds: slash, arrow, bash, staff — melee, shots, and the casters’ front-row jab', () => {
      expect(glyphAt('knight', 'front')).toBe('physical'); // slash
      expect(glyphAt('archer', 'back')).toBe('physical'); // arrow
      expect(glyphAt('phalanx', 'back')).toBe('physical'); // bash ("Pierce")
      expect(glyphAt('mage', 'front')).toBe('physical'); // the staff jab
      expect(glyphAt('gryphon', 'back')).toBe('physical'); // Wind Shot rides `arrow` (E5-D14)
    });

    it('Guard rows carry a SHIELD mark, no damage type — a Guard deals nothing', () => {
      expect(glyphAt('knight', 'mid')).toBe('shield'); // guard-half
      expect(glyphAt('phalanx', 'front')).toBe('shield'); // guard-full
      expect(glyphAt('phalanx', 'mid')).toBe('shield');
    });
  });

  describe('the FR16 read — ROSTER excludes Heal/Cast from the move catalog, so the card states them itself', () => {
    it('the Cleric reads "Heal / Staff" front and mid, plain "Heal" on the back row (ROSTER.md:46’s own shape), all with the HEAL mark', () => {
      const card = unitCard('cleric', 'water');
      expect(card.rows.map((r) => r.label)).toEqual(['Heal / Staff', 'Heal / Staff', 'Heal']);
      expect(card.rows.map((r) => r.count)).toEqual([1, 1, 2]); // "Heal ×2" renders from label + count
      for (const row of card.rows) expect(row.glyph, row.row).toBe('heal');
    });

    it('the Witch names her ACTUAL element-keyed spell — the reason the card takes the unit’s element', () => {
      for (const element of ALL_ELEMENTS) {
        const card = unitCard('witch', element);
        const expected = SPELL_DISPLAY_NAME[BALANCE.elementSpells[element]];
        for (const row of card.rows) {
          expect(row.label, `${element} ${row.row}`).toBe(expected);
          expect(row.glyph, `${element} ${row.row}`).toBe('magic'); // spell = magic (DOSSIER.md:134; OB64’s staff-icon evidence)
        }
      }
      expect(unitCard('witch', 'water').rows[0]?.label).toBe('Sleep'); // the concrete read Danilo asked for
    });
  });

  it('a CLASS-PREVIEW card (no element — the Draft grid, round 5) omits the element and reads a generic Witch "Cast"', () => {
    const preview = unitCard('witch');
    expect(preview.element).toBeUndefined();
    for (const row of preview.rows) {
      expect(row.label, row.row).toBe('Cast');
      expect(row.glyph, row.row).toBe('magic');
    }
    // Non-witch previews are identical to their unit cards in everything but
    // the element — the move table doesn't read it (no shipped class blasts).
    for (const cls of ALL_CLASSES) {
      if (cls === 'witch') continue;
      const p = unitCard(cls);
      const full = unitCard(cls, 'fire');
      expect(p.rows, cls).toEqual(full.rows);
      expect(p.element, cls).toBeUndefined();
    }
  });

  it('class verbs surface on the card — the same vocabulary as the battle plates (one register, two surfaces)', () => {
    expect(unitCard('dragonhunter', 'fire').rows[0]?.label).toBe('Skewer');
    expect(unitCard('emberdrake', 'fire').rows[2]?.label).toBe('Ember Breath');
    expect(unitCard('golem', 'earth').rows[0]?.label).toBe('Smash');
    expect(unitCard('knight', 'wind').rows[0]?.label).toBe('Sword Slash'); // no class verb → the plate register
  });
});

/**
 * Card geometry as arithmetic (the DRAFT_GRID/DRAFT_TABS pattern): the sheet
 * must fit the canvas with its worst content, and every affordance keeps the
 * FR30 floor — pinned here, never discovered on a device.
 */
describe('UNIT_CARD geometry (story 5.6)', () => {
  it('the sheet sits fully inside the 360×640 canvas', () => {
    expect(UNIT_CARD.x).toBeGreaterThanOrEqual(0);
    expect(UNIT_CARD.x + UNIT_CARD.w).toBeLessThanOrEqual(BASE_WIDTH);
    expect(UNIT_CARD.y).toBeGreaterThanOrEqual(0);
    expect(UNIT_CARD.y + UNIT_CARD.h).toBeLessThanOrEqual(BASE_HEIGHT);
  });

  it('the ✕ close target keeps the FR30 44px floor and stays inside the sheet', () => {
    expect(UNIT_CARD.closeSize).toBeGreaterThanOrEqual(44);
    expect(UNIT_CARD.closeSize).toBeLessThanOrEqual(UNIT_CARD.h);
  });

  it('the content budgets carry the roster’s ACTUAL worst lines — derived from the model, never asserted by fiat (review 2026-07-29)', () => {
    // The point of the pure model is that a 28th class appears by existing —
    // so the worst case must be COMPUTED over the live roster, or a longer
    // future verb/name would overflow with every test green. (Today's maxima:
    // "Radiant Breath ×1" and "DRAGON HUNTER".)
    let worstRowLine = 0;
    for (const cls of ALL_CLASSES) {
      for (const element of ALL_ELEMENTS) {
        for (const row of unitCard(cls, element).rows) {
          worstRowLine = Math.max(worstRowLine, `${row.label} ×${row.count}`.length);
        }
      }
    }
    expect(worstRowLine * 5.7, `worst row line is ${worstRowLine} chars`).toBeLessThanOrEqual(UNIT_CARD.rowTextW); // ~5.7px/char at 11px Arial (measured)
    const worstName = Math.max(...ALL_CLASSES.map((cls) => CLASS_DISPLAY_NAME[cls].length));
    expect(worstName * 10, `worst name is ${worstName} chars`).toBeLessThanOrEqual(UNIT_CARD.nameW); // ~10px/char at 16px Arial Black
  });

  it('NO shipped class carries `blast` in its move table — the load-bearing assumption behind the preview card’s element stand-in (review pin)', () => {
    // cardRow passes `element ?? 'fire'` into moveDisplayName, which only
    // reads the element for the BLAST's flavor word. Safe exactly as long as
    // this holds; a future Archmage makes this fail here, not silently
    // flavor a preview card.
    for (const cls of ALL_CLASSES) {
      for (const row of ALL_ROWS) {
        expect(BALANCE.classes[cls].moves[row], `${cls}.${row}`).not.toBe('blast');
      }
    }
  });

  it('the SUBLINE (HP · squares · dot) never reaches the raised radar’s STR label — derived from the roster’s max HP (review pin)', () => {
    const nameX = UNIT_CARD.x + UNIT_CARD.pad + UNIT_CARD.portraitW + UNIT_CARD.nameGapX;
    const maxHpDigits = Math.max(...ALL_CLASSES.map((cls) => String(BALANCE.classes[cls].hp).length));
    // "HP " + digits + " · " at ~6.2px/char (11px), + the square row, + the dot.
    const sublineEnd = nameX + (3 + maxHpDigits + 3) * 6.2 + MAX_SLOT_COST * 14 + 10 + 12;
    expect(sublineEnd).toBeLessThanOrEqual(UNIT_CARD.radarCX - 16); // 16 ≈ half a 3-char axis label + breath
  });

  it('the vertical budget adds up (round-4 staggered columns): rows below the header, the radar anchored to the card top', () => {
    // Left column: header + three move rows inside the bottom padding.
    expect(UNIT_CARD.pad + UNIT_CARD.headerH + 3 * UNIT_CARD.rowH).toBeLessThanOrEqual(UNIT_CARD.h - UNIT_CARD.pad);
    // Right column: the radar (web + half a 10px label beyond each end)
    // around its own anchor — inside the card top AND the bottom padding.
    const radarHalf = UNIT_CARD.radarR + UNIT_CARD.radarLabelPad + 8; // 8 = a realistic 10px-font half-height (Phaser renders ~13-16px bounds; the old 6 passed the ✕ pin at literally 0px)
    expect(UNIT_CARD.radarCYOffset - radarHalf).toBeGreaterThanOrEqual(UNIT_CARD.pad);
    expect(UNIT_CARD.radarCYOffset + radarHalf).toBeLessThanOrEqual(UNIT_CARD.h - UNIT_CARD.pad);
  });

  it('the raised chart clears the header content (round 4): the name budget ends before the STR label, the ✕ zone stays x-separated', () => {
    const nameX = UNIT_CARD.x + UNIT_CARD.pad + UNIT_CARD.portraitW + UNIT_CARD.nameGapX;
    // The STR label is centred on radarCX; half a 3-char 10px label ≈ 14px.
    expect(nameX + UNIT_CARD.nameW).toBeLessThanOrEqual(UNIT_CARD.radarCX - 14);
    // The ✕ zone (closeSize² at the top-right corner) and the radar's widest
    // label never share x-range: zone left edge vs the VIT/INT label reach.
    const closeZoneLeft = UNIT_CARD.x + UNIT_CARD.w - UNIT_CARD.pad - 8 - UNIT_CARD.closeSize / 2;
    const radarRightReach = UNIT_CARD.radarCX + Math.cos(Math.PI / 6) * (UNIT_CARD.radarR + UNIT_CARD.radarLabelPad) + 22;
    // They may share x only if the radar's TOP edge sits below the zone.
    const radarTop = UNIT_CARD.y + UNIT_CARD.radarCYOffset - (UNIT_CARD.radarR + UNIT_CARD.radarLabelPad + 8);
    const zoneBottom = UNIT_CARD.y + UNIT_CARD.pad + 8 + UNIT_CARD.closeSize / 2;
    expect(radarRightReach <= closeZoneLeft || radarTop >= zoneBottom, 'radar labels must not sit under the ✕ tap zone').toBe(true);
  });

  it('the two columns never collide, and the radar stays inside the sheet (round 2: chart on the RIGHT)', () => {
    const left = UNIT_CARD.x + UNIT_CARD.pad;
    // Left column's right edge: icon + gap + verb budget + gap + the glyph cell.
    const leftColumnEnd = left + UNIT_CARD.rowIconW + 8 + UNIT_CARD.rowTextW + 10 + 8;
    // Radar's left reach: centre − web − label pad − half an axis label ("MEN" ≈ 22px at 10px).
    const radarLeft = UNIT_CARD.radarCX - UNIT_CARD.radarR - UNIT_CARD.radarLabelPad - 11;
    expect(radarLeft, 'the radar must clear the move rows').toBeGreaterThanOrEqual(leftColumnEnd);
    const radarRight = UNIT_CARD.radarCX + UNIT_CARD.radarR + UNIT_CARD.radarLabelPad + 11;
    expect(radarRight, 'the radar must stay inside the sheet').toBeLessThanOrEqual(UNIT_CARD.x + UNIT_CARD.w - 4);
    // And the verb budget still carries the roster's longest row line.
    expect('Radiant Breath ×1'.length * 5.7).toBeLessThanOrEqual(UNIT_CARD.rowTextW);
  });
});

/**
 * The stat radar's pure math (story 5.6, device pass 2026-07-29 — the spider
 * chart Danilo asked for in place of the raw stat grid).
 */
describe('stat radar math (unitCard)', () => {
  it('every class’s six ratios sit in (0, 1], STAT_AXES order', () => {
    for (const cls of ALL_CLASSES) {
      const ratios = statAxisRatios(cls);
      expect(ratios).toHaveLength(STAT_AXES.length);
      for (const ratio of ratios) {
        expect(ratio).toBeGreaterThan(0);
        expect(ratio).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the per-axis max derives from the ROSTER (never hardcoded): the Emberdrake’s STR 34 is today’s ceiling and rates exactly 1', () => {
    const max = statAxisMax();
    expect(max.str).toBe(34);
    expect(statAxisRatios('emberdrake')[STAT_AXES.indexOf('str')]).toBe(1);
    // And every axis ceiling is genuinely attained by someone.
    for (const [i, axis] of STAT_AXES.entries()) {
      expect(
        ALL_CLASSES.some((cls) => statAxisRatios(cls)[i] === 1),
        `${axis} ceiling unclaimed`,
      ).toBe(true);
    }
  });

  it('radarPoints: vertex 0 points straight UP, six vertices, all-1s traces the outer ring at radius r', () => {
    const pts = radarPoints(100, 200, 50, [1, 1, 1, 1, 1, 1]);
    expect(pts).toHaveLength(6);
    expect(pts[0]!.x).toBeCloseTo(100, 6);
    expect(pts[0]!.y).toBeCloseTo(150, 6); // up = −y
    for (const pt of pts) {
      expect(Math.hypot(pt.x - 100, pt.y - 200)).toBeCloseTo(50, 6);
    }
  });

  it('radarPoints scales each vertex by ITS ratio — a half-STR unit’s top vertex sits halfway up the axis', () => {
    const pts = radarPoints(0, 0, 40, [0.5, 1, 1, 1, 1, 1]);
    expect(pts[0]!.x).toBeCloseTo(0, 6);
    expect(pts[0]!.y).toBeCloseTo(-20, 6);
    expect(Math.hypot(pts[1]!.x, pts[1]!.y)).toBeCloseTo(40, 6);
  });
});
