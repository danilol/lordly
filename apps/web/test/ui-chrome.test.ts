import { describe, expect, it } from 'vitest';
import {
  BUTTON_FRAME_SLICE,
  CODE_STROKE_COLOR,
  CODE_STROKE_THICKNESS,
  COMP_HEADING_FONT_PX,
  ELEMENT_BADGE_RADIUS,
  groundLabelStyle,
  GROUND_TEXT_STROKE_PX,
  MIN_FONT_PX,
  ELEMENT_COLORS,
  buttonCenter,
  buttonPlateInset,
  buttonStyleTokens,
  CHROME_SLICE_SCALE,
  DISABLED_FRAME_ALPHA,
  MIN_BUTTON_PLATE_PX,
  PALETTE,
  PANEL_FRAME_SLICE,
} from '../src/config/constants';

/** Every shell source file, raw — for the import-level guards below (the game-name.test.ts / purity.test.ts precedent). */
const SRC = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
/** The build-time art checker, raw — its hand-copied slice literals must mirror the constants (5.8 review). */
const SCRIPTS = import.meta.glob('../scripts/*.mjs', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// Story 5.2 (the medieval look): the chrome builders' pure seams. Every button
// in the app renders through buttonStyleTokens + buttonCenter + buttonPlateInset,
// so these pin the parts that can be tested without a Phaser scene.
describe('buttonStyleTokens (story 5.2) — the one chrome style source', () => {
  it('maps the three states onto rendered properties only', () => {
    expect(buttonStyleTokens('primary')).toEqual({
      fill: PALETTE.buttonFillEnabled,
      text: PALETTE.buttonTextOnGold,
      frameAlpha: 1,
    });
    expect(buttonStyleTokens('default')).toEqual({
      fill: PALETTE.buttonFill,
      text: PALETTE.buttonText,
      frameAlpha: 1,
    });
    expect(buttonStyleTokens('disabled')).toEqual({
      fill: PALETTE.buttonFill,
      text: PALETTE.buttonTextDisabled,
      frameAlpha: DISABLED_FRAME_ALPHA,
    });
  });

  it('every token field is one addButton actually renders (review 2026-07-27)', () => {
    // The original seam carried a `stroke` token that `addButton` never read —
    // the frame is ART, there is no stroke to set — so a test asserting the
    // three states had distinct strokes passed while nothing on screen differed.
    // Guard the shape itself: no field may be added here without a renderer.
    for (const style of ['primary', 'default', 'disabled'] as const) {
      expect(Object.keys(buttonStyleTokens(style)).sort()).toEqual(['fill', 'frameAlpha', 'text']);
    }
  });

  it('keeps the DESIGN contrast rule: ink-on-gold for primary, never the bone body text', () => {
    // A gold-filled button with the light bone label is the exact low-contrast
    // trap the one-theme restyle must avoid (DESIGN: enabled = gold fill + ink).
    expect(buttonStyleTokens('primary').text).not.toBe(PALETTE.buttonText);
    expect(buttonStyleTokens('primary').text).not.toBe(buttonStyleTokens('disabled').text);
  });

  it('keeps the three states distinguishable ON SCREEN (a disabled button must not read as tappable)', () => {
    const primary = buttonStyleTokens('primary');
    const dflt = buttonStyleTokens('default');
    const disabled = buttonStyleTokens('disabled');
    // primary is the only state that shows a gold plate…
    expect(primary.fill).not.toBe(dflt.fill);
    // …and disabled is the only state that dims the frame art.
    expect(disabled.frameAlpha).toBeLessThan(dflt.frameAlpha);
    expect(dflt.text).not.toBe(disabled.text);
  });

  it('every text token is strict #rrggbb and every fill a valid numeric colour (the statusTraceColor format lesson)', () => {
    for (const style of ['primary', 'default', 'disabled'] as const) {
      const t = buttonStyleTokens(style);
      expect(t.text, style).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.fill, style).toBeGreaterThanOrEqual(0x000000);
      expect(t.fill, style).toBeLessThanOrEqual(0xffffff);
      expect(t.frameAlpha, style).toBeGreaterThan(0);
      expect(t.frameAlpha, style).toBeLessThanOrEqual(1);
    }
  });
});

describe('buttonCenter (story 5.2) — art layers hang off the visual centre, whatever the origin', () => {
  it('is the position itself for a centred button', () => {
    expect(buttonCenter(100, 200, 48, 44, [0.5, 0.5])).toEqual({ cx: 100, cy: 200 });
  });

  it('offsets by half the size for a top-left origin (History parks its Replay control at 0,0)', () => {
    expect(buttonCenter(100, 200, 48, 44, [0, 0])).toEqual({ cx: 124, cy: 222 });
  });

  it('handles a bottom-right origin symmetrically', () => {
    expect(buttonCenter(100, 200, 48, 44, [1, 1])).toEqual({ cx: 76, cy: 178 });
  });
});

describe('buttonPlateInset (story 5.2 review) — the gold plate can never go degenerate', () => {
  const nominal = Math.round(BUTTON_FRAME_SLICE / CHROME_SLICE_SCALE) + 2;

  it('uses the nominal frame inset on every shipped button size', () => {
    for (const size of [44, 46, 48, 50, 56, 104, 128, 200, 220]) {
      expect(buttonPlateInset(size), `size ${size}`).toBe(nominal);
    }
  });

  it('leaves a real plate on sizes too small for the nominal inset (never zero or negative)', () => {
    // The unclamped version returned a 14px inset regardless, so a 24px row —
    // exactly what migrating Reveal's dropdown would have produced — yielded a
    // -4px-wide Rectangle.
    for (const size of [8, 12, 20, 24, 28]) {
      const plate = size - buttonPlateInset(size) * 2;
      expect(plate, `size ${size}`).toBeGreaterThanOrEqual(Math.min(size, MIN_BUTTON_PLATE_PX));
      expect(plate, `size ${size}`).toBeGreaterThan(0);
    }
  });

  it('never insets more than the nominal frame border', () => {
    for (const size of [8, 24, 44, 500]) expect(buttonPlateInset(size)).toBeLessThanOrEqual(nominal);
  });
});

describe('9-slice geometry (story 5.2 art drop) — corners must fit the smallest chrome', () => {
  it('button-frame corners fit the 44px tap-target floor at the slice scale', () => {
    // NineSlice corners render at TEXTURE px in game units; builders draw at
    // CHROME_SLICE_SCALE× then scale down. If two corners exceed the scaled
    // 44px minimum button height, the frame collapses/overlaps.
    expect(2 * BUTTON_FRAME_SLICE).toBeLessThanOrEqual(44 * CHROME_SLICE_SCALE);
    // Narrowest shipped button: History's 48px Replay control.
    expect(2 * BUTTON_FRAME_SLICE).toBeLessThanOrEqual(48 * CHROME_SLICE_SCALE);
  });

  it('panel-frame corners fit the smallest framed panel (Draft detail, 116px tall)', () => {
    expect(2 * PANEL_FRAME_SLICE).toBeLessThanOrEqual(116 * CHROME_SLICE_SCALE);
  });
});

describe('PALETTE hex hygiene (story 5.2) — string tokens parse blind downstream', () => {
  it('every string token in PALETTE is strict #rrggbb', () => {
    for (const [name, value] of Object.entries(PALETTE)) {
      if (typeof value === 'string') expect(value, name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('the opaque unit-card backings are the side line blended into the card body, not arbitrary colours', () => {
    // Device pass 2026-07-27 replaced the ~15%-alpha side washes with opaque
    // fills so the stone floor cannot bleed through. This pins the blend so a
    // future re-tone of either input keeps the two in agreement.
    const blend = (base: number, side: number, alpha: number) => {
      const ch = (shift: number) => Math.round(((base >> shift) & 0xff) * (1 - alpha) + ((side >> shift) & 0xff) * alpha) << shift;
      return ch(16) | ch(8) | ch(0);
    };
    expect(PALETTE.cardFillYou).toBe(blend(PALETTE.cardFill, PALETTE.playerLine, 0.15));
    expect(PALETTE.cardFillEnemy).toBe(blend(PALETTE.cardFill, PALETTE.enemyLine, 0.15));
  });
});

/**
 * The FR3 element badge (story 5.8 AC3). The treatment was normalized to one
 * dot-only helper across every scene back in stories 2.1–2.3/4.2, but NOTHING
 * pinned it — `grep ELEMENT_COLORS apps/web/test` returned zero hits, so the
 * "one treatment everywhere" rule survived on discipline alone. It is the UX
 * spine's rule (DESIGN.md:257 / EXPERIENCE.md:82), not FR3's: FR3 (prd.md:47)
 * specifies the seeded roll, the disclosure timing and the Witch coupling, and
 * says only that the element "is displayed".
 */
describe('the element badge — one treatment everywhere (story 5.8 AC3)', () => {
  it('is the spine geometry: a 12px solid dot, and the four hexes DESIGN.md declares', () => {
    expect(ELEMENT_BADGE_RADIUS * 2).toBe(12); // DESIGN.md:128-133 — `size: 12px`, `radius: {rounded.full}`
    expect(ELEMENT_COLORS).toEqual({
      fire: 0xd1603b,
      water: 0x3f78c2,
      wind: 0x6bae8c,
      earth: 0xb0904f,
    });
    // Four distinct elements, four distinct fills — a duplicate would make two
    // elements indistinguishable, and colour is the ONLY channel here.
    expect(new Set(Object.values(ELEMENT_COLORS)).size).toBe(4);
  });

  it('keeps the element COLOUR table to exactly ONE consumer — `addElementBadge` — so no surface can grow its own treatment', () => {
    // THE guard that actually prevents drift, and it cannot be an ordinary
    // assertion: `expect()` can't see who imports what. Raw-source sweep, the
    // game-name/purity-test precedent.
    //
    // Scoped to ELEMENT_COLORS deliberately. Reading the colours is what lets a
    // surface paint its own element treatment — that is the drift that made
    // Draft/Placement/Reveal/Battle disagree before stories 2.1–2.3. The
    // RADIUS is plain geometry: a caller may measure against it to place the
    // badge (statsSheetOverlay trails the dot after its class line) without
    // ever drawing one, so it is not the thing to lock down.
    const colorConsumers = Object.entries(SRC)
      .filter(([path]) => !path.endsWith('config/constants.ts')) // the declaration site itself
      .filter(([, src]) => /\bELEMENT_COLORS\b/.test(src))
      .map(([path]) => path.replace(/^.*\/src\//, 'src/'));
    expect(colorConsumers).toEqual(['src/config/ui.ts']);

    // And the one consumer really is the badge helper — not some other function
    // in ui.ts that happens to reach for the palette.
    expect(SRC['../src/config/ui.ts']).toMatch(/addElementBadge[\s\S]*ELEMENT_COLORS\[element\]/);
  });

  it('no element-word CONSTANT exists and nothing tints sprites — the badge is the whole treatment', () => {
    // The story-2.1 deferral (deferred-work.md:96) asked for the redundant
    // element word to go; it left with the card-width shrinks in 2.3/4.2. This
    // keeps it gone. HONEST SCOPE (5.8 review): this polices IDENTIFIER NAMES —
    // a scene rendering `unit.element` as raw text would slip past it; that
    // path is covered by review + device passes, not this regex. What it DOES
    // catch is the realistic regression: someone reintroducing a label table.
    // `BLAST_ELEMENT_WORD` is excluded by name: it flavours MOVE names on the
    // battle plate ("Ice Blast"), a different channel entirely.
    for (const [path, src] of Object.entries(SRC)) {
      if (path.endsWith('config/constants.ts')) continue;
      const offenders = src.match(/\bELEMENT_(?!COLORS|BADGE_RADIUS)[A-Z_]*WORD\w*|\bELEMENT_LABEL\w*|\bELEMENT_TEXT\w*/g);
      expect(offenders, `${path} must not label elements with words`).toBeNull();
    }
    // Element must never be a sprite tint either — the spine reserves borders
    // and fills for SIDE identity (DESIGN.md:211, :337).
    for (const [path, src] of Object.entries(SRC)) {
      expect(/setTint\s*\(/.test(src), `${path} must not tint sprites (side owns colour)`).toBe(false);
    }
  });
});

/**
 * Text over the scene ground (story 5.8 device round 5). Danilo found the small
 * coloured labels on Result "difficult to read" against the stone floor while
 * the near-white HP percentages beside them were fine. The fix keeps the hue and
 * carries the letterform with a dark outline — FR39f's mechanism, one scene over.
 */
describe('groundLabelStyle — small coloured labels survive the stone ground (story 5.8)', () => {
  it('carries the SAME dark outline as the board treatment, so the two cannot drift apart', () => {
    const style = groundLabelStyle(PALETTE.title, 12);
    expect(style.stroke).toBe(CODE_STROKE_COLOR); // one dark, shared with unitCodeStyle
    expect(style.strokeThickness).toBe(GROUND_TEXT_STROKE_PX);
    expect(GROUND_TEXT_STROKE_PX).toBeGreaterThanOrEqual(2); // below 2 the outline stops carrying the glyph
    // Chrome labels take a THINNER outline than text standing on a saturated
    // board tile — if these ever converge, say so deliberately.
    expect(GROUND_TEXT_STROKE_PX).toBeLessThan(CODE_STROKE_THICKNESS);
  });

  it('passes the caller’s hue through untouched — side identity is load-bearing (AD-11)', () => {
    // The label must not be recoloured to win contrast: blue = you, red = enemy
    // everywhere, so the outline is what buys legibility, not a hue swap.
    expect(groundLabelStyle(PALETTE.playerText, COMP_HEADING_FONT_PX).color).toBe(PALETTE.playerText);
    expect(groundLabelStyle(PALETTE.enemyText, COMP_HEADING_FONT_PX).color).toBe(PALETTE.enemyText);
    expect(groundLabelStyle(PALETTE.mutedText, MIN_FONT_PX, 'Arial').fontFamily).toBe('Arial');
    expect(groundLabelStyle(PALETTE.title, 12).fontSize).toBe('12px');
  });

  it('the three Result labels that stand on the STONE FLOOR all route through it', () => {
    // Raw-source guard (the game-name/purity precedent): a bare style object on
    // one of these three is the exact legibility regression Danilo reported, and
    // nothing else would catch it — scenes have no test harness.
    //
    // Scoped to the three labels that actually sit on the ground. Result's other
    // text is deliberately exempt and must NOT be swept in: the verdict banner
    // stands on its own opaque side-coloured band, the chip code/name stand on
    // opaque chip backings, and the HP percentage line is bone in a heavy 16px
    // mono that already survives the texture (Danilo: "good to read").
    const src = SRC['../src/scenes/ResultScene.ts'];
    expect(src).toBeDefined();
    for (const label of ['▸ BATTLE SUMMARY', 'RESULT_HINT', 'heading']) {
      expect(src, `${label} must use groundLabelStyle`).toMatch(new RegExp(`${label.replace(/[▸]/g, '.')}[^;]*groundLabelStyle\\(`));
    }
  });
});

/**
 * The frame-art checker's slice literals (story 5.8 review). The script says
 * "must mirror the slice constants in src/config/constants.ts" and did so by
 * hand-copied literal — the exact drift class this story pinned for element
 * colours. If either 46/36 moves without the other, the build-time border scan
 * validates the WRONG slice boundary and the stretched-ornament defect class
 * (device rounds 2–3) returns unflagged.
 */
describe('check-frame-art.mjs mirrors the slice constants (story 5.8)', () => {
  it('panel and button slice literals in the script equal the constants', () => {
    const script = SCRIPTS['../scripts/check-frame-art.mjs'];
    expect(script, 'the checker script must exist').toBeDefined();
    const panel = script!.match(/panel-frame\.png',\s*slice:\s*(\d+)/);
    const button = script!.match(/button-frame\.png',\s*slice:\s*(\d+)/);
    expect(Number(panel?.[1])).toBe(PANEL_FRAME_SLICE);
    expect(Number(button?.[1])).toBe(BUTTON_FRAME_SLICE);
  });
});
