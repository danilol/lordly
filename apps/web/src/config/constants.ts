import { BALANCE } from '@lordly/engine';
import type { Element, MoveKind, SpellKind, Tactic, UnitClass } from '@lordly/engine';
import type { SideTotals } from '../flow/battleStats';

// The game's full official name (story 5.2, Danilo 2026-07-27): the royal
// epithet answers "who is Lordly?" — page title + PWA manifest. On Home the
// wordmark shows HOME_WORDMARK and the subtitle shows GAME_SUBTITLE (the
// epithet alone — repeating "Lordly:" under the wordmark would be redundant).
export const GAME_NAME = 'Lordly: Ruler of the Board, Master of Tactics';
export const GAME_SUBTITLE = 'Ruler of the Board, Master of Tactics';

export const HOME_PLAY_LABEL = 'Play vs AI';

// FR30 portrait baseline: ~360×640 CSS px, scaled up by Phaser.Scale.FIT.
export const BASE_WIDTH = 360;
export const BASE_HEIGHT = 640;

// Monster "loom" (story 4.9, dossier D-3c). A monster occupies ONE grid cell
// but renders LARGER than a small so it reads as imposing and visibly overhangs
// the ring of neighbour cells it reserves at placement — the single-cell,
// oversized-sprite look Danilo confirmed against the OB64 reference (there is
// NO two-tile sprite; "spans both cells" was always the adjacency rule, not the
// art). 1.5× takes the boards' 32px small to the dossier's ≥48px floor. A
// device-tuning constant (the exact loom is judged on Danilo's phone, Task 6).
export const MONSTER_LOOM_SCALE = 1.5;

/**
 * A unit's on-screen display size for a scene whose SMALL units draw at
 * `baseSize`. A small renders at `baseSize`; a monster (`sizeClass: 'monster'`)
 * looms at `MONSTER_LOOM_SCALE×`, rounded. This is the ONE place the size rule
 * lives, so no scene hand-branches on class or sizeClass (story 4.9) — every
 * `addUnitSprite` call runs through it and looms a monster proportionally to
 * whatever base that scene already uses for its smalls.
 */
export function unitDisplaySize(cls: UnitClass, baseSize: number): number {
  return BALANCE.classes[cls].sizeClass === 'monster' ? Math.round(baseSize * MONSTER_LOOM_SCALE) : baseSize;
}

/**
 * Draft icon-grid geometry (story 4.3's grid, RE-LAID by story 5.4): pure
 * DATA + arithmetic, exported so the layout is testable without Phaser —
 * the 12-class 4×80px grid measurably could not hold 17 classes (5 rows
 * ended at y=422 against a detail panel at y=300, a 122px collision).
 * Now: 5 columns of 62×50 tiles — 4 rows for 17 classes, grid bottom at
 * 88 + 4×50 + 3×6 = 306, right edge at 9 + 5×62 + 4×8 = 351 ≤ 360, and
 * every tile stays over the FR30 44px tap floor.
 */
/**
 * The Draft class-picker grid. Story 5.5 re-lays it a SECOND time, and the
 * driver is the tab strip: with 27 classes split into Humans (16) and Monsters
 * (11), the biggest grid any tab must hold is 16 — four rows — so the vertical
 * budget that forced 5.4's 5×62 squeeze is back, and the tiles can be wide
 * again. They HAVE to be: "Emberdrake" and "Stormscale" are 10 characters, and
 * a 62px tile's 58px wrap width only carries 9 at 8px Arial Black (Phaser's
 * word wrap does not break inside a word, so the eleventh character would
 * simply hang outside the tile). At 4 columns of 80px the wrap width is 76px —
 * 12 characters — and the row centres exactly: 4×80 + 3×8 = 344, leaving 8px
 * either side.
 *
 * The vertical budget is the tighter half. The tab strip is PRIMARY navigation
 * (unlike the header's Rules spur), so its tap target has to clear FR30's 44px
 * floor — which pushes the grid's top from y=88 to y=98. Paying for that meant
 * trimming the tile height 50 → 48 (still over the 44px floor): four rows now
 * end at y=308, keeping 2px of daylight above DRAFT_DETAIL at 310.
 * draft-grid.test.ts pins all of this per TAB, so the next wave fails there.
 */
export const DRAFT_GRID = { cols: 4, tileW: 80, tileH: 48, gapX: 8, gapY: 6, startX: 8, startY: 98 } as const;

/**
 * The Draft tab strip (story 5.5): label baseline, its active underline, and
 * the FR30-compliant tap zone. `tapW` is the FLOOR of the tap target;
 * `tapMaxW` is its CEILING — the scene grows the zone with the label
 * ("MONSTERS" at 13px Arial Black already exceeds the 88px floor), and the
 * clamp is what makes "the two targets never overlap" a testable claim
 * instead of a hope about label widths (review-caught: the test previously
 * pinned only the floor). 128 leaves a 12px gap between the zones at the
 * ±70px centres and keeps both inside the canvas.
 */
export const DRAFT_TABS = { y: 76, underlineY: 86, tapH: 44, tapW: 88, tapMaxW: 128, offsetX: 70 } as const;

/**
 * How far the gold ornament of `panel-frame.png` reaches INTO a framed panel,
 * in logical px — i.e. how much of a panel's edge content must not use.
 *
 * MEASURED from the asset (decoded pixel scan): the ornament runs 42 texture px
 * in from the left/right edges and 45 from top/bottom, on a 300×400 source.
 *
 * THE TRAP (story 5.8 device rounds 2 AND 3 — the second round is why this
 * comment is long). The rendered thickness is NOT simply `depth / CHROME_SLICE_SCALE`.
 * A 9-slice leaves the corner/edge slices unscaled and STRETCHES the middle
 * regions, so any ornament lying BEYOND the slice boundary is stretched with
 * them. At the old `PANEL_FRAME_SLICE = 30`, 12–15 texture px of ornament sat in
 * the middle regions and a 344-wide sheet stretched them ~4× — the gold actually
 * rendered ~26px deep, not the ~14 the naive division predicts. Content inset to
 * 22px therefore STILL sat on the border (Danilo, round 3: "the summary table is
 * still over the frame borders"), and worse, the thickness varied with every
 * panel's size, so no single pad could ever be right.
 *
 * THE FIX: `PANEL_FRAME_SLICE` is 46, which puts the entire ornament inside the
 * unstretched slices. The gold now renders a CONSTANT 15.3px on every panel
 * whatever its dimensions (46 / CHROME_SLICE_SCALE), the ornament no longer
 * distorts with panel width, and `SHEET_PAD` clears it with ~7px to spare.
 * Consequence to know: the frame band reads THINNER and more uniform than
 * before, because it is no longer being stretched. Corner flourishes reach
 * deeper than the straight edges and still stretch past the slice, which is why
 * corner-adjacent content (a top-left title, a top-right ✕) wants the full
 * `SHEET_PAD` rather than the bare ornament depth.
 *
 * If the frame art is ever re-exported, re-run the scan and keep
 * `PANEL_FRAME_SLICE` ≥ the deepest straight-edge ornament, or this whole class
 * of overlap comes back. `apps/web/scripts/check-frame-art.mjs` mirrors the
 * slice constants and must be updated in the same commit.
 */
export const PANEL_ORNAMENT_PX = 16;
export const SHEET_PAD = 22;

/**
 * The unit-data card (story 5.6 — the OB64 UNIT DATA read at Placement; the
 * geometry survived four device rounds, 2026-07-29). Pure geometry in the
 * DRAFT_GRID/DRAFT_TABS tradition, pinned by unit-card.test.ts:
 * - the sheet: x 8 / w 344, h 198 anchored low (y 434, bottom 632) — 5.8's
 *   device round 2 grew `pad` to SHEET_PAD so content clears the frame
 *   ornament (Danilo: the move rows' position icons sat on the gold), which
 *   cost 10px of height at the same bottom edge — round 2
 *   shrank it ~85px by moving the radar BESIDE the move rows ("use the space
 *   better… bringing the chart to the right"); round 4 took another 48px by
 *   raising the radar INTO the header's empty right half (`radarCYOffset`
 *   106 from the card top — 100 failed the ✕-clearance pin by 2px and 102
 *   passed at literally 0px on an estimated text metric; the review re-cut
 *   the label budget to a realistic 8px half-height and 106 clears with
 *   real margin — the chart's top vertex tucks in beside the name
 *   while the move rows still start below the portrait), so the two columns
 *   STAGGER instead of stack;
 * - headerH 78: the 64px interim portrait (FIXED 64 — never loomed; loom is
 *   board presence, and a 96px monster portrait would burst this header),
 *   name, and the `HP · size-squares · element-dot` subline;
 * - three move rows at rowH 24 on the LEFT below the header (row-position
 *   mini-grid icon `rowIconW` 12 · verb ×count within rowTextW 112 — fits
 *   "Radiant Breath ×1" at 11px — · inline damage glyph);
 * - the stat radar on the RIGHT centred at (radarCX 260, y + radarCYOffset
 *   114 — was 106 until 5.8's device round 2: the wider content inset pushed
 *   the ✕ zone inward and down, so the chart drops 8px to stay out from under
 *   it. The sheet also grew 4px (h 194 → 198) because at h 194 the chart was
 *   squeezed between the ✕ zone and the inner bottom with ZERO margin on both
 *   sides — the 5.6 review's lesson that a 0px pass on an estimated text
 *   metric is not a pass. Both clearances now hold with 2px),
 *   radius radarR 40 + radarLabelPad 12 of nameless axis labels
 *   (round 2: numbers removed — the per-axis roster-max scaling already IS
 *   the meaning);
 * - closeSize 44: the ✕ tap target at the FR30 floor;
 * - nameW 140 fits "DRAGON HUNTER" (13 chars ≈ 130px at 16px), the roster's
 *   longest name — tightened in round 4 so the name budget can never reach
 *   the raised chart's STR label (pinned).
 */
export const UNIT_CARD = {
  x: 8,
  y: 434,
  w: 344,
  h: 198,
  pad: SHEET_PAD,
  headerH: 78,
  rowH: 24,
  rowIconW: 12,
  rowTextW: 112,
  radarR: 40,
  radarLabelPad: 12,
  radarCX: 260,
  radarCYOffset: 114,
  closeSize: 44,
  nameW: 140,
  portraitW: 64,
  nameGapX: 10,
} as const;

/**
 * Shared drag-vs-tap boundary (extracted from PlacementScene at the 5.6
 * review): Phaser's `dragDistanceThreshold`, the tap classifiers, AND the
 * long-press movement cancel must all agree on ONE number, or a pointer move
 * in the gap between two different cutoffs starts no drag and is rejected as
 * a tap — the gesture silently does nothing.
 */
export const TAP_DISTANCE_PX = 10;

/**
 * How long a still press must hold before a hold-to-inspect sheet opens —
 * the unit-data card at Draft/Placement (story 5.6) and the per-unit stats
 * sheet at Result (story 5.7): one gesture, one number, three scenes.
 * Comfortably past a tap, comfortably short of feeling stuck; the gesture
 * cancels on ANY movement past TAP_DISTANCE_PX (checked at fire time in ALL
 * consumers — only Placement gets a drag to cancel it for free), on release
 * (a tap is a tap), and on pointer-out. Danilo tuned the feel across the
 * five 5.6 device rounds and accepted 450.
 */
export const LONG_PRESS_MS = 450;

/**
 * The battle-stats sheet (story 5.7 — the per-unit read behind a long-press
 * on Result's comp chips; the modal shell is shared with UNIT_CARD via
 * config/modalSheet.ts). Geometry in the 5.6 tradition, pinned by test:
 * x 8 / w 344, h 246 anchored low (y 386, bottom 632); headerH 56 carries a
 * 40px sprite + name + code; nine counter rows at rowH 18 (22 + 56 + 9×18 +
 * 22 = 262 exactly — the vertical budget test pins the EQUALITY, not a ≤;
 * re-budgeted at 5.8's device round 2 when the pad grew to clear the frame
 * ornament, keeping the sheet's bottom edge at 632);
 * closeSize 44 (FR30); labels left, values right-aligned inside the padding.
 * The two type sizes the width pins need to see live here too (5.7 review:
 * a budget test cannot derive a worst case from a literal in the overlay).
 */
export const STATS_CARD = { x: 8, y: 370, w: 344, h: 262, pad: SHEET_PAD, headerH: 56, rowH: 18, closeSize: 44, nameFontPx: 14, valueFontPx: 11 } as const;

/**
 * The sheet's rows — label + which SideTotals counter it reads (story 5.7).
 * Typed against the model (type-only import, no cycle: battleStats imports
 * nothing from constants), so a renamed counter is a compile error here and
 * the completeness test can prove every counter is surfaced.
 */
export const STATS_SHEET_ROWS: ReadonlyArray<readonly [string, keyof SideTotals]> = [
  ['Damage dealt', 'dealt'],
  ['Damage taken', 'taken'],
  ['· of it poison', 'poisonTaken'],
  ['Crits landed', 'crits'],
  ['Dodges', 'dodges'],
  ['Guard blocks', 'blocks'],
  ['Healing given', 'healsGiven'],
  ['Healing received', 'healsReceived'],
  ['Statuses cast', 'statusesApplied'],
] as const;

/**
 * The Result screen's BATTLE SUMMARY link (story 5.7, device round 2 —
 * Danilo: the summary "could be something optional… you click and see;
 * otherwise you don't click and ignore"). One centred label in the measured
 * 190–250 free band between the HP count-up (~173) and "Your army" (256),
 * with an FR30 44px tap zone (193–237 — clear of both neighbours, pinned).
 */
export const SUMMARY_LINK = { y: 215, tapW: 220, tapH: 44, fontPx: 12 } as const;

/**
 * The Result screen's drill-down hint (story 5.8 device round 4 — Danilo's
 * placement call: "this hint about the char card summary could be placed
 * between the bottom team and the REMATCH button. I would like it there").
 *
 * It started life INSIDE the battle-summary sheet and failed there: a line in a
 * modal, describing a gesture that modal was blocking, reading as a broken link
 * ("it's not a link, clickable, so it's very confusing"). Moving it onto Result
 * itself fixes the shape — here the comp chips it talks about are visible and
 * holdable while you read it.
 *
 * y 456 is the CENTRE of the measured free band: the enemy chips end at
 * 0.56·BASE_HEIGHT + 44 + 64/2 = 434.4 and Rematch's top is
 * 0.79·BASE_HEIGHT − BUTTON_HEIGHT/2 = 477.6, so the band is 43px and the 10px
 * line sits mid-gap, touching neither. Derived in the test from those same
 * fractions, never a fiat number.
 */
export const RESULT_HINT_Y = 456;
export const RESULT_HINT = 'Press and hold a unit for its full stats';

/**
 * The battle-summary sheet (story 5.7 round 2 — the LoL-history read Danilo
 * asked for): the shared modal shell, then a title band, the two side-total
 * lines (the ▲▼ strip format lives HERE now), one BAR ROW per unit — sprite
 * avatar, a side-colored DEALT bar over a thin neutral TAKEN bar, both on
 * ONE shared scale (statsBarMax) with values at the bar ends. Vertical budget (pinned):
 * pad 22 + titleH 36 + totalsH 40 + 10×rowH 24 + pad 22 = 360 = h 360
 * (re-budgeted twice at 5.8's device rounds: the pad grew to clear the frame
 * ornament, then the confusing footer hint was dropped and gave 18px back —
 * bottom edge stays at 632); ten rows is the worst case, DERIVED in the test from the slot
 * budget and the cheapest slot cost (5v5 smalls — monster comps run shorter
 * and leave slack). `totalsLineH` is the two side lines' own spacing: it
 * lives here, not as an `i*18+8` in the overlay, so the clearance test can
 * see it (5.7 review).
 */
export const SUMMARY_CARD = {
  x: 8,
  y: 272,
  w: 344,
  h: 360,
  pad: SHEET_PAD,
  titleH: 36,
  titleFontPx: 14,
  totalsH: 40,
  totalsLineH: 18,
  rowH: 24,
  avatarW: 24,
  valueW: 40,
  closeSize: 44,
} as const;

/**
 * The summary sheet's title (story 5.7 review — a width pin can only pin text
 * it can read; a fiat string in the overlay is unpinnable).
 *
 * The footer HINT that used to sit beside it is GONE (story 5.8 device round 3).
 * It read "Close, then hold a chip for its full sheet" and Danilo's verdict was
 * that it confused more than it taught: "it's not a link, clickable, so it's
 * very confusing" — a line inside a modal, instructing a gesture that modal is
 * currently blocking, which looks tappable and is not. Removing it also gives
 * the bars back their 18px. The per-unit drill-down still exists (hold a Result
 * chip); making it DISCOVERABLE without a confusing label is logged as a UX
 * decision in deferred-work.md rather than guessed at here.
 */
export const SUMMARY_TITLE = 'BATTLE SUMMARY';

/**
 * The draft hint line's centre y (story 5.5 review): at y=50 its 11px line
 * bottom (~55.5) grazed the tab zones' top edge (76 − 44/2 = 54) by ~1.5px —
 * a tap on the hint's last pixels silently switched tabs. At 46 the line
 * spans ~40.5–51.5, clearing the zones; draft-grid.test.ts pins the
 * clearance so a future header re-lay can't reintroduce the graze.
 */
export const DRAFT_HINT_Y = 46;

/**
 * The class-detail panel below the grid (story 5.4 re-lay): starts under the
 * 17-class grid bottom (306 + 4px) and ends at 418, clearing the army-tray
 * label at y=426.
 */
export const DRAFT_DETAIL = { x: 8, y: 310, w: BASE_WIDTH - 16, h: 108 } as const;

/** Top-left corner of draft tile `i` (row-major over DRAFT_GRID.cols). */
export function draftGridTile(i: number): { x: number; y: number } {
  return {
    x: DRAFT_GRID.startX + (i % DRAFT_GRID.cols) * (DRAFT_GRID.tileW + DRAFT_GRID.gapX),
    y: DRAFT_GRID.startY + Math.floor(i / DRAFT_GRID.cols) * (DRAFT_GRID.tileH + DRAFT_GRID.gapY),
  };
}

/** Bottom y of a `count`-tile grid — the number that must clear DRAFT_DETAIL.y. */
export function draftGridBottom(count: number): number {
  const rows = Math.ceil(count / DRAFT_GRID.cols);
  return DRAFT_GRID.startY + rows * DRAFT_GRID.tileH + (rows - 1) * DRAFT_GRID.gapY;
}

// Shared UI palette — the single source for colors used across scenes and
// the Phaser game config. Hex strings for text/config, numbers for shapes.
// Story 5.2 (the medieval look): re-toned to DESIGN.md's Night Tactics tokens
// as the SINGLE shipped theme (the two-theme Heritage/Night system is retired
// unbuilt — PO one-theme decision 2026-07-23, dated DESIGN.md amendment).
// Gold is the metal: frames, enabled fills, and the title — never a side.
export const PALETTE = {
  /** night slate ground (`{colors.ground-night}`). */
  background: '#161a2e',
  /** The same ground as `background`, as a number for shape fills (e.g. the Help scene's opaque header strip). */
  backgroundFill: 0x161a2e,
  /** glowing gold (`{colors.gold-night}`) — title, leader crown, pips. */
  title: '#e3b64b',
  /** panel-body-night — the inner face of buttons/panels, darker than the canvas. */
  buttonFill: 0x10131f,
  /** gold-deep-night — the frame edge on default buttons (always an edge, never a fill). */
  buttonStroke: 0x9c7c26,
  buttonTextDisabled: '#9a9db0',
  /** bone — label on a default (dark-bodied) button. */
  buttonText: '#e8e4d8',
  /** bone as a NUMBER for shape fills (the backgroundFill twin-pattern) — the unit-card's filled size-squares and lit row-bars (review 2026-07-29: the raw 0xe8e4d8 was hand-duplicated at three sites). */
  boneFill: 0xe8e4d8,
  /** Enabled/selected = the gold FILL (DESIGN button component); label flips to ink via buttonTextOnGold. */
  buttonFillEnabled: 0xe3b64b,
  buttonStrokeEnabled: 0x9c7c26,
  /** ink — the label on a gold-filled (primary/selected) button; bone-on-gold is the contrast trap. */
  buttonTextOnGold: '#2a2119',
  /** muted slate — a disabled button's frame (no gold on disabled chrome). */
  buttonStrokeDisabled: 0x3a4157,
  cardFill: 0x1f2438,
  cardStroke: 0x3a4157,
  // Unit-card backings (device pass 2026-07-27): the old ~15%-alpha side
  // washes vanished over the story-5.2 stone floor — cards read as bare
  // stone. These are the SAME look pre-blended opaque: cardFill + 15% of the
  // side line color, so sprites and codes get a solid dark stage while side
  // identity stays blue-vs-red (the DESIGN unit-card component, one source).
  cardFillYou: 0x253451,
  cardFillEnemy: 0x372938,
  bodyText: '#e8e4d8',
  mutedText: '#9a9db0',
  gridCellFill: 0x26304a,
  gridCellStroke: 0x3a4157,
  unitFill: 0x3a3a5e,
  unitStroke: 0x7a7ab0,
  // Enemy-side marker on the placement grid (FR6 groundwork; first-time legibility).
  enemyText: '#e06a6a',
  enemyLine: 0xc0433a,
  // Side identity (story 2.1, UX DESIGN.md): "blue = you, red = enemy,
  // everywhere" — the load-bearing legibility rule. Player = side A (blue
  // family, `blue-you-night` #4a8fe0 — reads on the current dark ground);
  // enemy = side B (red family). The legacy green player family is
  // deliberately gone from SIDE semantics; the greens remaining above are the
  // enabled-BUTTON accent only (button theming deferred — deferred-work.md).
  playerText: '#4a8fe0',
  playerLine: 0x4a8fe0,
  hpBarBack: 0x262c45,
  hpBarPlayer: 0x4a8fe0,
  hpBarEnemy: 0x8a3a3a,
  winText: '#4a8fe0',
  loseText: '#e06a6a',
  drawText: '#c8c8d8',
  // Board-unit class codes (FR39f, story 4.0 — the label-contrast fix): the
  // old side-colored fills (`playerText`/`enemyText`) matched the bright front
  // tiles hue-for-hue (#4a8fe0 on #4a8fe0), erasing the label. Codes now use
  // LIGHT side tints — still blue-family vs red-family (DESIGN's side rule) —
  // over the dark `CODE_STROKE_COLOR` outline that carries the letterform on
  // any ground, including the deferred landscape backdrops (deferred-work.md).
  codeTextPlayer: '#d6e8fa',
  codeTextEnemy: '#f8d9d2',
  // Story 4.5 (FR35, EXPERIENCE.md): the persistent HUD-label tint marking a
  // side whose leader has fallen — an ashen, demoralised red-grey, distinct
  // from the bright side reds so it reads as "weakened," not "enemy."
  penaltyTint: '#b0736a',
} as const;

// ---- Chrome style seam (story 5.2, the medieval look) ----

/** A button's visual state: primary/selected (gold fill), default (dark body, gold frame), disabled (muted, non-interactive). */
export type ButtonStyle = 'primary' | 'default' | 'disabled';

export interface ButtonStyleTokens {
  /** Gold plate fill, shown for `primary` only (number — shape fill). */
  fill: number;
  /** Label color (hex string for crispText). */
  text: string;
  /**
   * Alpha applied to the ornate 9-slice FRAME. Dimming is what marks a
   * disabled button now that the frame is art: there is no stroke to re-color
   * (review 2026-07-27 — the old `stroke` token was never rendered by
   * `addButton`, so `buttonStrokeDisabled` silently did nothing here; it
   * survives in PALETTE for the non-button rectangles that still draw strokes,
   * e.g. HistoryScene's not-replayable marker).
   */
  frameAlpha: number;
}

/**
 * The ONE style source every button renders through (`addButton`,
 * config/ui.ts). DESIGN.md button component, night theme: default = the
 * frame art's own dark body + bone label; primary/selected = a gold plate
 * inside the frame + ink label (bone-on-gold is the contrast trap); disabled
 * = dimmed frame + muted label, no gold plate. Every field here is RENDERED —
 * a token nothing draws is a token that lies (review 2026-07-27).
 */
export function buttonStyleTokens(style: ButtonStyle): ButtonStyleTokens {
  switch (style) {
    case 'primary':
      return { fill: PALETTE.buttonFillEnabled, text: PALETTE.buttonTextOnGold, frameAlpha: 1 };
    case 'default':
      return { fill: PALETTE.buttonFill, text: PALETTE.buttonText, frameAlpha: 1 };
    case 'disabled':
      return { fill: PALETTE.buttonFill, text: PALETTE.buttonTextDisabled, frameAlpha: DISABLED_FRAME_ALPHA };
  }
}

/** How far the ornate frame dims on a disabled button (the only "this is not tappable" signal the art can carry). */
export const DISABLED_FRAME_ALPHA = 0.45;

/** Smallest gold plate `buttonPlateInset` will leave inside a frame — below this the plate reads as a smudge, not a fill. */
export const MIN_BUTTON_PLATE_PX = 8;

/**
 * How far the `primary` gold plate sits inside the frame art, per axis
 * (pure — tested in ui-chrome.test.ts). Nominally the frame's own logical
 * border plus 2px so the ornate ring stays visible, but CLAMPED so a small
 * button can never produce a zero/negative-size plate: at 48×44 (History's
 * Replay, the tightest shipped button) the nominal 14 is used, while a
 * hypothetical 24px-tall row gets 8 instead of a degenerate −4
 * (review 2026-07-27 — the unclamped version is exactly what a naive
 * migration of Reveal's 24px dropdown rows would have hit).
 */
export function buttonPlateInset(size: number): number {
  const nominal = Math.round(BUTTON_FRAME_SLICE / CHROME_SLICE_SCALE) + 2;
  return Math.min(nominal, Math.max(0, Math.floor((size - MIN_BUTTON_PLATE_PX) / 2)));
}

/** A button's centre point, given its origin — the label and art layers all hang off this (pure, tested). */
export function buttonCenter(x: number, y: number, width: number, height: number, origin: readonly [number, number]): { cx: number; cy: number } {
  return { cx: x + (0.5 - origin[0]) * width, cy: y + (0.5 - origin[1]) * height };
}

// ---- Home look (story 5.2) ----

/** The wordmark line on Home — the game's short identity; the long `GAME_NAME` stays in the page title/manifest. */
export const HOME_WORDMARK = 'Lordly';
/** Texture key for the Home castle background (Danilo's Midjourney art, loaded in Boot). */
export const HOME_BG_KEY = 'home-castle';

// ---- Chrome art (story 5.2 — Danilo's Midjourney batch, picks 2026-07-27) ----

export const CHROME_BUTTON_KEY = 'chrome-button-frame';
export const CHROME_PANEL_KEY = 'chrome-panel-frame';
export const GROUND_TILE_KEY = 'ground-tile';
export const WORDMARK_KEY = 'lordly-wordmark';
/**
 * NineSlice corners render at TEXTURE scale (1 texture px = 1 game unit), so
 * the builders draw every frame at CHROME_SLICE_SCALE× and setScale back down
 * — corners then sample 3 texture px per logical px, staying crisp on the
 * DPR-3 backing store (the story-4.0 text-ceiling lesson, applied to art).
 */
export const CHROME_SLICE_SCALE = 3;
/** button-frame.png (400×200): the ornate border is ≈36 texture px → ≈12 logical px on a button. */
export const BUTTON_FRAME_SLICE = 36;
/**
 * panel-frame.png (300×400): slice at 30 texture px → a 10-logical-px border.
 * Deliberately SMALLER than the art's full ornate border (≈45px): the panels'
 * existing inner content (Draft detail title at +12, Battle log text) was laid
 * out against a 1px stroke — a 15px border swallowed it (Danilo's device pass,
 * 2026-07-27). 10px keeps the gold read without eating the content box.
 */
export const PANEL_FRAME_SLICE = 46;
/** Stone ground tile (512×512 source): drawn at this tile scale so stones read ~35px — a floor, not boulders. Device-tunable. */
export const GROUND_TILE_SCALE = 0.35;

// ---- Battle terrain (story 5.3) ----

/**
 * The biomes a battle can be fought on, in rotation order. Adding art is ONE
 * line here plus the Boot load — nothing else in the app knows how many there
 * are. Shell-side on purpose: a background is PRESENTATION and must never
 * enter `MatchSetup`, the `BattleLog`, or any engine type (AD-1/AD-2).
 */
export const BATTLE_BACKGROUNDS = ['terrain-castle', 'terrain-plains'] as const;
export type BattleBackgroundKey = (typeof BATTLE_BACKGROUNDS)[number];

/**
 * Which terrain a match is fought on — derived from the MATCH SEED, never from
 * `Math.random` (story 5.3, agreed 2026-07-27).
 *
 * The seed is the one value a replay restores verbatim (`MatchFlow.startReplay`
 * sets `state.seed = setup.seed`, and `commit()` writes `seed: state.seed`, so
 * the two are provably equal on both paths — pinned in battle-background.test.ts).
 * Deriving the terrain from it means a replayed battle is fought on the same
 * ground as the original, for free, with zero engine involvement. A random pick
 * would silently swap the scenery on replay.
 *
 * `>>> 0` keeps the index non-negative for the full uint32 seed space (AD-10)
 * even if a caller ever hands in a signed-looking value.
 */
/**
 * How far the terrain art is dimmed toward the app ground (story 5.3, FR39f).
 * The two shipped biomes are a dark castle courtyard and a BRIGHT plains
 * painting; every text/number treatment in Battle is tuned for a dark ground,
 * so the art is dimmed to a common floor rather than re-tuning every overlay
 * per biome. Device-tunable — the number Danilo's pass may move.
 */
export const TERRAIN_DIM_ALPHA = 0.45;
/** Extra scrim behind the top HUD band where small labels sit over the busiest part of the art. */
export const HUD_SCRIM_ALPHA = 0.5;
/** Battle's top HUD band height (passLabel y=22, enemyLabel y=56 both inside). */
export const BATTLE_HUD_BAND_H = 72;
/** Reveal's header band: title (y26), hint (y52) and the enemy label (y70). */
export const REVEAL_HUD_BAND_H = 84;

export function backgroundKeyForSeed(seed: number): BattleBackgroundKey {
  // The `?? [0]` is unreachable — `%` over a non-empty tuple is always in
  // range — but it keeps the function TOTAL for `noUncheckedIndexedAccess`
  // without an `as` cast that would hide a genuinely empty manifest. The
  // tuple's non-emptiness is itself pinned by battle-background.test.ts.
  return BATTLE_BACKGROUNDS[(seed >>> 0) % BATTLE_BACKGROUNDS.length] ?? BATTLE_BACKGROUNDS[0];
}

// Text render resolution multiplier: the game renders at the 360×640 base and
// Scale.FIT upscales the canvas, which softens text. Rendering glyphs to a
// higher-resolution texture keeps them crisp when the canvas is scaled up.
// Applied via `crispText` (config/ui.ts) so every label shares one setting.
export const TEXT_RESOLUTION = 3;

// Minimum label font size (story 2.0 AC2 — accessibility). Callers pass this
// for their smallest labels; it is a shared floor CONSTANT, not enforced by
// crispText (larger sizes stay their own literals). Epic 1 accumulated 8–9px
// micro-labels below comfortable reading size on a real phone (Danilo's device
// is the acceptance test). The full type scale is the epic-2 UX spec's job.
export const MIN_FONT_PX = 10;

// Class labels on the COMPACT unit cards (story 2.0 AC2 — accessibility,
// confirmed by multiple readers on real devices): the full words cannot fit
// a ~48px card at a readable size ('mercenary' overflows at 10px already),
// so compact cards show 3-letter codes at CARD_CLASS_FONT_PX instead — 30%
// bigger AND they fit. Keyed by the engine union (AD-4): a new class is a
// compile error here, never a missing label. Full names remain where space
// allows (the Draft class picker); 2.1's sprites make the word secondary.
export const CLASS_ABBREVIATIONS: Record<UnitClass, string> = {
  knight: 'KNI',
  mercenary: 'MER',
  archer: 'ARC',
  mage: 'WIZ', // D-1d: Mage displays as Wizard (engine key stays `mage`)
  cleric: 'CLE',
  witch: 'WIT',
  // Story 4.3 roster wave 1.
  berserker: 'BER',
  phalanx: 'PHA',
  ninja: 'NIN',
  valkyrie: 'VAL',
  sorceress: 'SOR',
  golem: 'GOL', // story 4.8
  // Story 5.4 roster wave — the humans (dossier ROSTER.md's Code column).
  fencer: 'FEN',
  dragonhunter: 'DRH',
  hawkman: 'HAW',
  vultan: 'VUL',
  raven: 'RAV',
  // Story 5.5 roster wave — the monsters (dossier ROSTER.md's Code column).
  gryphon: 'GRY',
  wyrm: 'WYR',
  hellhound: 'HEL',
  whelp: 'WHP',
  emberdrake: 'EMB',
  frostfang: 'FRF',
  stormscale: 'STM',
  cragmaw: 'CRG',
  nightwing: 'NGT',
  halowing: 'HAL',
};

/**
 * Full display names (story 4.3). SHELL-SIDE lookup keyed off the engine class
 * (AD-11 — like the codes): `mage` → "Wizard" (D-1d, a display rename only; the
 * engine key never changes, so pre-era history still renders). Everything else
 * is the class capitalized.
 */
export const CLASS_DISPLAY_NAME: Record<UnitClass, string> = {
  knight: 'Knight',
  mercenary: 'Mercenary',
  archer: 'Archer',
  mage: 'Wizard',
  cleric: 'Cleric',
  witch: 'Witch',
  berserker: 'Berserker',
  phalanx: 'Phalanx',
  ninja: 'Ninja',
  valkyrie: 'Valkyrie',
  sorceress: 'Sorceress',
  golem: 'Golem', // story 4.8
  // Story 5.4 roster wave — the humans. `dragonhunter` is the one engine key
  // whose display name is two words (the codes stay 3 letters regardless).
  fencer: 'Fencer',
  dragonhunter: 'Dragon Hunter',
  hawkman: 'Hawkman',
  vultan: 'Vultan',
  raven: 'Raven',
  // Story 5.5 roster wave — the monsters. Every one is a single word, so the
  // Draft tile's 8px label fits one line (the "Dragon Hunter" wrap stays the
  // roster's only two-word display name).
  gryphon: 'Gryphon',
  wyrm: 'Wyrm',
  hellhound: 'Hellhound',
  whelp: 'Whelp',
  emberdrake: 'Emberdrake',
  frostfang: 'Frostfang',
  stormscale: 'Stormscale',
  cragmaw: 'Cragmaw',
  nightwing: 'Nightwing',
  halowing: 'Halowing',
};
export const CARD_CLASS_FONT_PX = 13;

/**
 * Player-facing tactic labels (FR34, story 4.4), keyed off the engine `Tactic`
 * union so a missing entry is a compile error (AD-4). The picker shows these;
 * `leader` is present but the picker keeps it disabled until story 4.5.
 */
export const TACTIC_DISPLAY_NAME: Record<Tactic, string> = {
  autonomous: 'Autonomous',
  weakest: 'Attack Weakest',
  strongest: 'Attack Strongest',
  leader: 'Attack Leader',
};

/**
 * The leader-crown insignia (`{components.leader-crown}`, DESIGN.md, story 4.5):
 * glyph ♛ in gold — the crown color reuses `PALETTE.title` (the Night-theme
 * rendering of DESIGN's `{colors.gold}` "title accent"), never a side color
 * (gold = leader, side stays blue/red). Shown at placement/reveal/battle/history.
 */
export const LEADER_CROWN_GLYPH = '♛';

/** The full-beat banner text when a side's leader falls (FR35, EXPERIENCE.md — exact wording). */
export const BATTLE_LEADER_FELL_BANNER = 'The leader has fallen!';

/**
 * The Guard stance marker (`{components.guard-marker}`, DESIGN.md, story
 * 4.7): a persistent shield glyph from `GuardRaised` to `GuardEnded` — the
 * SAME status-icon treatment as `STATUS_GLYPHS` (2.2 AC6), but keyed
 * separately since Guard isn't a Witch `SpellKind`. A dedicated color (not a
 * side color, not gold — leader-crown reserves gold) keeps it visually
 * distinct from both.
 */
export const GUARD_MARKER_GLYPH = '🛡';
export const GUARD_MARKER_COLOR = '#8ea6c2';

/**
 * The damage-type mark on a unit-card move row (story 5.6; the TYPE lives
 * here — review 2026-07-29 — so CARD_GLYPHS/CARD_GLYPH_COLORS are genuinely
 * keyed by it rather than by a hand-copied literal union; flow/unitCard
 * derives rows AS this type and re-exports it).
 */
export type CardGlyph = 'physical' | 'magic' | 'shield' | 'heal';

/**
 * The card's glyph vocabulary (story 5.6): a small mark per move row —
 * OB64's "small, and placed where it makes sense" detail. Keyed by CardGlyph
 * so a new glyph kind is a compile error here.
 * Physical/magic get single-glyph marks; shield reuses the Guard marker's
 * glyph (one meaning, one symbol — GUARD_MARKER_GLYPH); heal is the
 * restorative cross, deliberately NOT an aggression read.
 */
export const CARD_GLYPHS: Record<CardGlyph, string> = {
  physical: '⚔',
  magic: '✦',
  shield: GUARD_MARKER_GLYPH,
  heal: '✚',
};

/**
 * The glyph marks' colors (story 5.6): none is a side colour and none is gold
 * (gold stays the leader's metal). Physical = bone (the default label ink);
 * magic = a neutral arcane violet (deliberately NOT a status hue — the glyph
 * says "magic damage", not "poison"); shield = the Guard marker's own colour
 * (one meaning, one look); heal = the heal-trace green (restorative, no
 * aggression read).
 */
export const CARD_GLYPH_COLORS: Record<CardGlyph, string> = {
  physical: '#e8e4d8',
  magic: '#b48ce0',
  shield: GUARD_MARKER_COLOR,
  heal: '#8fe0a0',
};

/** The caption stacked over a Guard-blocked hit's number (story 4.7) — the crit/dodge caption's sibling. */
export const GUARD_BLOCKED_CAPTION = 'GUARDED';

// FR39f (story 4.0): the class-code contrast treatment for units standing ON
// side-colored board tiles (Battle, Reveal). A dark outline stroke carries the
// letterform regardless of what's behind it — the token treatment DESIGN.md's
// unit-card component specifies; scenes consume it via `unitCodeStyle`, never
// restating the values. (Tray/panel codes on dark cards keep their own styles
// — the defect was tiles only.)
//
// RE-SCOPED story 5.8 (2026-07-29): board CODES are gone — Reveal and Battle
// identify units by sprite alone (the PO's call once 4.0 made the sprites
// crisp). The treatment survives because the RULE still applies to the one
// piece of text still standing on a solid tile: the Reveal soldier NAME, which
// spreads this style and overrides family/size. That single call site is also
// what keeps these exports consumed — a knip failure here means the name lost
// its stroke, not that the tokens are dead.
export const CODE_STROKE_COLOR = '#10131f';
export const CODE_STROKE_THICKNESS = 3;

/**
 * Text standing on the STONE GROUND (story 5.8 device round 5). The scene
 * ground (story 5.2) is a busy mid-dark texture, and small COLOURED labels lose
 * their letterforms on it — Danilo, on the Result screen: the summary link, both
 * army headings and the drill-down hint were "difficult to read", while the HP
 * percentages right above them were fine. The difference is not the ground, it
 * is the text: bone at 16px in a heavy mono survives a texture; a 10–13px
 * side-coloured label does not.
 *
 * So the hue stays (side colour is load-bearing — blue = you, red = enemy, AD-11)
 * and the letterform gets carried by a dark outline. This is deliberately the
 * SAME mechanism and the same stroke colour as `unitCodeStyle`'s FR39f
 * treatment, whose own DESIGN.md rationale is that the outline "carries the
 * letterform on any ground (incl. future landscape backdrops)" — story 4.0
 * scoped it to board tiles because that was the only busy ground at the time;
 * the stone floor is the same problem one scene over.
 *
 * Thinner than the board's `CODE_STROKE_THICKNESS`: these are chrome labels, not
 * text standing on a saturated tile. ONE constant to re-tune if a device pass
 * wants more or less.
 */
export const GROUND_TEXT_STROKE_PX = 2;

/** The 'Your army' / 'Enemy army' heading size on Result — a token so the ground-label pin can read it (story 5.8). */
export const COMP_HEADING_FONT_PX = 13;

/**
 * ResultScene's vertical anchors (story 5.8 review — the coupling fix). The
 * hint-band and link-band tests used to re-hardcode these as literals copied
 * out of the scene ("derives the band from Result's own layout" — from a COPY
 * of it), which is the 4.2 HistoryScene failure mode: re-lay the chips and the
 * test keeps green against yesterday's geometry. One token block, consumed by
 * BOTH the scene and the pins, so a re-lay moves them together or fails loudly.
 * Fractions are of BASE_HEIGHT; chip offsets are from the heading's y.
 */
export const RESULT_ANCHORS = {
  pctFrac: 0.27,
  yourArmyFrac: 0.4,
  enemyArmyFrac: 0.56,
  rematchFrac: 0.79,
  homeFrac: 0.9,
  /** Chip row centre, below its side's heading. */
  chipCYOffset: 44,
  chipH: 64,
  pctFontPx: 16,
} as const;

/** The ⌂ Home / ? Rules link size — the header affordances that sit on the bare ground in every scene (story 5.8). */
export const BACK_AFFORDANCE_FONT_PX = 13;

/**
 * The style for a label drawn over the scene ground. Callers pass their own
 * colour and size — the point of the helper is that the STROKE cannot drift or
 * be forgotten on a new label.
 */
export function groundLabelStyle(
  color: string,
  fontPx: number,
  fontFamily = 'Arial Black',
): { fontFamily: string; fontSize: string; color: string; stroke: string; strokeThickness: number } {
  return { fontFamily, fontSize: `${fontPx}px`, color, stroke: CODE_STROKE_COLOR, strokeThickness: GROUND_TEXT_STROKE_PX };
}

/** The one text style for text standing on a solid board tile — since story 5.8 that is the Reveal soldier NAME (its sole consumer; the class codes it was built for left the board with AC2). Read from here so the FR39f treatment cannot drift. */
export function unitCodeStyle(side: 'A' | 'B'): {
  fontFamily: string;
  fontSize: string;
  color: string;
  stroke: string;
  strokeThickness: number;
} {
  return {
    fontFamily: 'Arial Black',
    fontSize: `${CARD_CLASS_FONT_PX}px`,
    color: side === 'A' ? PALETTE.codeTextPlayer : PALETTE.codeTextEnemy,
    stroke: CODE_STROKE_COLOR,
    strokeThickness: CODE_STROKE_THICKNESS,
  };
}

// Story 4.0 text-ceiling fix (UX-DR11, deferred-work.md candidate (a)): the
// canvas BACKING STORE gets sized `BASE × backingScale` so supersampled glyphs
// stop being minified into a 360px store before the browser upscale. The scale
// is the devicePixelRatio ROUNDED to an integer (NEAREST pixel art needs
// integer duplication) and CAPPED — the fill-rate lever: a DPR-3 backing pushes
// ~9× the pixels of the 360 store, and NFR1's floor is verified on device
// against docs/performance-verdict.md's baseline. DPR 1 is exactly a no-op.
export const DPR_BACKING_CAP = 3;

/**
 * Pure core of the backing-store scale — `backingScale()` (config/ui.ts) feeds
 * it the devicePixelRatio (memoized at boot). Recorded tradeoff (4.0 review):
 * rounding keeps the scale INTEGER because fractional backing scales re-soften
 * the NEAREST pixel-art sprites — the very artifact the per-texture-NEAREST
 * pattern exists to avoid. Consequence: DPR 1.25 (Windows 125% scaling) rounds
 * to 1 and gets no backing-store benefit, while 1.5 rounds up to 2 (a slightly
 * oversampled store — harmless). The mobile target (FR30) sits at DPR 2–3 and
 * benefits fully; the desktop 1.25 case keeps the pre-4.0 rendering it always
 * had, which was device-accepted.
 */
export function backingScaleFor(dpr: number): number {
  if (!Number.isFinite(dpr)) return 1;
  return Math.min(DPR_BACKING_CAP, Math.max(1, Math.round(dpr)));
}

export const BUTTON_WIDTH = 220;
export const BUTTON_HEIGHT = 56;

// Scene labels (story 1.8) — kept here so tests and scenes share one source.
export const DRAFT_TITLE = 'Draft your army';
export const DRAFT_CONTINUE_LABEL = 'Continue';
/** Draft hint DERIVES its count from balance data (story 4.2 — the "3 units" literal died with the era; spine: counts read "slots" now). */
export function draftHint(slotBudget: number): string {
  return `Tap a class to draft (${slotBudget} slots, duplicates allowed)`;
}
export const PLACEMENT_TITLE = 'Place your units';
export const PLACEMENT_SUBMIT_LABEL = 'Ready';
/** Submit hint DERIVES its count (story 4.2), aligned with MatchFlow.commit()'s own error message. */
export function placementSubmitHint(unitCount: number): string {
  return `place all ${unitCount} units`;
}
/** Story 4.5: once every unit is placed, the Ready gate's last requirement is a crown — tell the player how. */
export const PLACEMENT_CROWN_HINT = 'tap a unit to crown a leader';
export const ENEMY_ARMY_LABEL = '▲  ENEMY ARMY  ▲';

// Reveal / Battle / Result scene labels (story 1.9) — one source for tests + scenes.
export const REVEAL_TITLE = 'Reveal';
export const REVEAL_HINT = 'Both armies face off. Tap to begin the battle.';
export const REVEAL_FIGHT_LABEL = 'Fight!';
export const RESULT_WIN_LABEL = 'Victory!';
export const RESULT_LOSE_LABEL = 'Defeat';
export const RESULT_DRAW_LABEL = 'Draw';
export const RESULT_REMATCH_LABEL = 'Rematch';
export const RESULT_HOME_LABEL = 'Home';
// Back-to-Home affordance shown on every post-Home scene (closes the 1.8 dead-end).
export const HOME_BACK_LABEL = '‹ Home';
/** Origin-aware back label (story 2.4 — Help returns to Home OR Draft). */
export const BACK_LABEL = '‹ Back';

// Help / Credits (story 2.4, FR27/FR31) — one source for scenes + tests.
export const HOME_HELP_LABEL = 'Help';
export const HOME_CREDITS_LABEL = 'Credits';

// History (story 3.1, FR28) — one source for scenes + tests.
export const HOME_HISTORY_LABEL = 'History';
export const HISTORY_TITLE = 'History';
/** EXPERIENCE.md pins this copy exactly — the drift-guarded empty state. */
export const HISTORY_EMPTY_LABEL = 'No battles yet — play your first match.';
/** Home spur row (story 3.1): three buttons across 360px — 3×104 + 2×12 = 336 ≤ BASE_WIDTH; height keeps the 44px floor. */
export const SPUR_COUNT = 3;
export const SPUR_BUTTON_WIDTH = 104;
/** Replay (story 3.2, FR20/AD-8) — one source for the scene + tests. */
export const HISTORY_REPLAY_LABEL = '▶';
export const HISTORY_NOT_REPLAYABLE_LABEL = 'not replayable';
export const DRAFT_RULES_LABEL = '? Rules';
export const CREDITS_TITLE = 'Credits';

// Battle-mode toggle on Home (story 1.10, FR17/FR19): Standard vs Wipeout.
export const MODE_HEADING = 'Battle mode';
// Toggle-button metrics — metrics live here, not in scene code (same rule as
// BUTTON_WIDTH/HEIGHT). 44px height meets the minimum tap-target size.
export const MODE_BUTTON_WIDTH = 128;
export const MODE_BUTTON_HEIGHT = 44;
export const MODE_BUTTON_GAP = 12;
export const MODE_STANDARD_LABEL = 'Standard';
export const MODE_WIPEOUT_LABEL = 'Wipeout';
export const MODE_STANDARD_HINT = 'one engagement — highest HP % wins';
/** Wipeout hint; the cap is READ from BALANCE.engagementCap, never hardcoded. */
export const modeWipeoutHint = (cap: number) => `fight until a side falls (max ${cap} engagements)`;
/** Engagement-boundary marker in the Battle scene (multi-engagement wipeout playback). */
export const engagementEndedLabel = (engagement: number) => `Engagement ${engagement} ended`;

// Battle playback pacing: the default beat is a DATA tuning constant, not
// inlined in scene code. ~600 ms per event at normal speed.
export const BATTLE_BEAT_MS = 600;

// FR23 speed controls (story 2.3): tappable speeds as DATA. The persisted
// settings value is a speed ID — an unknown/stale id from storage falls back
// to the first entry (normal speed; fast-forward is opt-in, never the default
// first watch). Replaces the epic-1 press-and-hold interim (BATTLE_FAST_FORWARD).
export const BATTLE_SPEEDS = [
  { id: '1x', label: '▶ 1×', factor: 1 },
  { id: '2x', label: '⏩ 2×', factor: 2 },
] as const;
export type BattleSpeedId = (typeof BATTLE_SPEEDS)[number]['id'];
export const DEFAULT_SPEED_ID: BattleSpeedId = '1x';

/** The speed entry for a persisted id — an unknown id (stale storage, future version) falls back to normal speed. */
export function battleSpeed(id: string): (typeof BATTLE_SPEEDS)[number] {
  return BATTLE_SPEEDS.find((s) => s.id === id) ?? BATTLE_SPEEDS[0];
}

export const BATTLE_SKIP_LABEL = '⏭ Skip';

// Shared iso-board geometry (story 2.2, ADR-0001): two tilted 3×3 diamond
// checkerboards in the `\` diagonal — enemy upper-left, player lower-right,
// front rows meeting along the clash gap. 2:1 diamond ratio per the UX mock
// (48×24 at 300-wide, scaled to the 360 base). Reveal and Battle project
// through battleView's one source so both stay pixel-consistent. The stacked
// origins serve the untuned '|' orientation (the seam ships, the toggle is
// deferred — deferred-work.md).
export const ISO_BOARD = {
  tileW: 74,
  tileH: 37,
  enemy: { ox: 124, oy: 118 },
  player: { ox: 236, oy: 330 },
  stackedEnemy: { ox: 180, oy: 96 },
  stackedPlayer: { ox: 180, oy: 320 },
} as const;

/**
 * Reveal's board frame — SEPARATE from Battle's since story 5.3's device pass
 * (Danilo: "we could enlarge the fight"). Battle is the hero scene and spreads
 * its boards down the terrain; Reveal cannot follow, because its lower third
 * belongs to the tactics block (ARMY TACTICS y=342, the picker bar, the enemy
 * line and the four-row dropdown, all above Fight at y=568). So Reveal grows
 * moderately and stays compact. Same 2:1 diamond, same component, same
 * projection — only the frame differs.
 */
/**
 * The Reveal tactic picker (story 5.8 — the FR30 correction). Shipped at 4.13
 * with a 24px bar and 24px option rows: both under FR30's 44px tap floor, so
 * every tactic choice was a mis-tap risk (logged in deferred-work.md, whose own
 * text said "revisit when Reveal is next laid out" — this story lays it out).
 *
 * Why a GRID and not taller rows in one column: the band between the picker and
 * the Fight button is finite. Four 44px rows stacked need 188px including
 * padding; the band gives ~150px. Two columns of two need 100px and fit with
 * slack. The open panel is also WIDER than the bar so the longest tactic name
 * has margin at 12px — the alternative was shrinking type, which fights FR30
 * rather than serving it.
 *
 * The open panel's own `pad` is 18, NOT SHEET_PAD (review 2026-08-01). It must
 * still beat the ornament (15.3px — at the original 6 the cells sat ON the
 * gold), but it cannot afford the sheets' 22: the panel is ANCHORED BELOW the
 * enemy tactic line (see below), and at pad 22 its bottom lands 2px past the
 * Fight button's top. 18 clears the ornament by 2.7px and Fight by 6px, and a
 * column is (300 − 36)/2 = 132px — ample for the longest tactic name at 12px.
 *
 * ANCHORING (the review's HIGH): the first cut computed the panel top as
 * `optionsTop − pad`, which the pad growth silently pushed UP to y416 — over
 * the enemy line's glyphs (411–425), burying the exact FR6 read this block
 * exists to keep visible. The panel now anchors at the enemy line's BOTTOM
 * plus `optionsGap`, cells inset `pad` inside it, and the layout test pins
 * `panel.y` against the enemy band — not just the cells.
 *
 * The options deliberately drop BELOW both fixed lines (bar, then the enemy's
 * tactic): the 2026-07-20 review's rule is that the enemy stance never jumps
 * away mid-choice, since that pairing is the FR6 read the player reacts to.
 * (It is also why the shared modal sheet is the wrong tool here — a modal would
 * cover the very line you are reacting to.)
 */
export const TACTIC_PICKER = {
  barW: 210,
  barH: 44,
  barY: 356,
  enemyGap: 6,
  enemyH: 24,
  optionsGap: 8,
  pad: 18,
  rowH: 44,
  cols: 2,
  panelW: 300,
} as const;

/**
 * The Reveal unit's sprite placement, and the name slot beneath it (story 5.8 —
 * tokens rather than literals in the scene, so `revealNameOffsetY` can derive
 * the monster-aware position and a test can pin BOTH sprite spans).
 * `…_GAP` is the clearance between the sprite's bottom edge and the name's
 * centre; `…_NAME_OFFSET_Y` is the floor — the slot the retired class code held.
 */
export const REVEAL_SPRITE_SIZE = 38;
export const REVEAL_SPRITE_OFFSET_Y = -13;
export const REVEAL_NAME_OFFSET_Y = 8;
export const REVEAL_NAME_GAP = 2;

export const ISO_BOARD_REVEAL = {
  tileW: 70,
  tileH: 35,
  enemy: { ox: 122, oy: 108 },
  player: { ox: 238, oy: 236 },
  stackedEnemy: { ox: 180, oy: 96 },
  stackedPlayer: { ox: 180, oy: 240 },
} as const;

/** The shape both board frames share — `battleView`'s projection takes one of these. */
export interface IsoBoardLayout {
  readonly tileW: number;
  readonly tileH: number;
  readonly enemy: { readonly ox: number; readonly oy: number };
  readonly player: { readonly ox: number; readonly oy: number };
  readonly stackedEnemy: { readonly ox: number; readonly oy: number };
  readonly stackedPlayer: { readonly ox: number; readonly oy: number };
}

// Iso tile fills/strokes (story 2.2) — the UX mock's NIGHT variant, matching
// the current dark ground (the full Heritage/Night theme system is deferred).
// Side is coded on tiles too: blue = you, red = enemy; front tiles are
// brighter with a gold-lite edge (the front-row indicator).
export const ISO_TILES = {
  you: 0x2c4d80,
  youFront: 0x4a8fe0,
  foe: 0x7d2f2c,
  foeFront: 0xc8483a,
  neutral: 0x2a3050,
  /** gold-deep-night — always a stroke, never a fill (DESIGN gold rule). */
  stroke: 0x9c7c26,
  /** gold-lite night — the front-row edge. */
  frontStroke: 0xf4d074,
} as const;

// Battle HUD / control-bar labels (story 2.2). Speed buttons are 2.3 (FR23).
// The FRONT ↘ / ↖ FRONT text labels are GONE (FR39e, story 4.0): the front row
// reads from the non-verbal indicator alone — brighter tiles + gold-lite edge
// (ISO_TILES.frontStroke, config/board.ts).
export const BATTLE_LOG_LABEL = '≡ Log';
export const BATTLE_ENEMY_LABEL = '▲ ENEMY';
export const BATTLE_PLAYER_LABEL = 'YOUR ARMY ▼';

// FR39a (story 4.0): player-facing wording says "Turn" where the engine says
// "pass" — a DISPLAY rename only. The engine vocabulary, `PassStarted` events,
// and the PRD glossary's "pass" are untouched; the glossary carries both words.
export const battleTurnLabel = (turn: number) => `Turn ${turn}`;
/** The log-panel boundary line for a new turn (flow/narration.ts). */
export const turnBoundaryLine = (turn: number) => `— Turn ${turn} —`;

// Persistent status icons (story 2.2, FR16 rendering): text glyphs via
// crispText — zero new art. Keyed by the engine union (AD-4). Lifecycle is
// exactly log-derivable: apply on StatusApplied; EngagementEnded clears all
// but poison (engine resolve.ts:77-79); icons leave with the corpse.
export const STATUS_GLYPHS: Record<SpellKind, string> = {
  sleep: 'Zzz',
  poison: '☠',
  weaken: '↓',
  confusion: '?',
};
export const STATUS_COLORS: Record<SpellKind, string> = {
  sleep: '#9ac7e8',
  poison: '#9b6bae',
  weaken: '#e0b050',
  confusion: '#e08ad0',
};

/** PoisonTicked carries no actor in its payload (types.ts), so poison numbers use this distinct neutral instead of a guessed side color. */
export const POISON_TEXT = '#9b6bae';

// Origin→target travel-trace colors (story 4.10). The rule, stated once
// (review: an earlier scene-side comment contradicted itself): ATTACK effects
// are side-colored by the ACTOR — the same DESIGN rule as combat numbers
// ("blue when you deal, red for the enemy"); the arrow keeps its 4.7 gold
// sliver. HEAL and SPELL traces are the exception: they carry no aggression
// read, so they use element/status-neutral hues, never a side color.
/** The heal trace — a restorative green, deliberately NOT a side hue. */
export const HEAL_TRACE_COLOR = 0x8fe0a0;
/**
 * A spell trace in its status hue — `STATUS_COLORS` as a Phaser numeric color.
 * Assumes the strict `#rrggbb` format, which constants.test.ts pins (review:
 * a future named/`#rgb` token would otherwise silently parse to NaN → black).
 */
export const statusTraceColor = (spell: SpellKind): number => parseInt(STATUS_COLORS[spell].slice(1), 16);

// The move-plate display vocabulary (FR39b, story 4.11, dossier D-3a — the
// OB64 "Thunder Arrow" register). Keyed by the engine unions (AD-4): a new
// MoveKind/SpellKind is a compile error here, never a blank plate. These are
// the PLATE names; the Draft card keeps `draftModel.moveLabel`'s terser row
// wording ("Slash") — two surfaces, two registers, both single-sourced.
/** Plate names for every non-blast move — blast composes from the actor's element below. */
export const MOVE_PLATE_NAMES: Record<Exclude<MoveKind, 'blast'>, string> = {
  slash: 'Sword Slash',
  arrow: 'Arrow',
  staff: 'Staff',
  bash: 'Bash',
  bolt: 'Magic Bolt', // story 5.4 (E5-D4) — the casters' single-target bolt; the Valkyrie overrides it below
  // Story 5.5 (E5-D7) — the dragons' row-AoE. The GENERIC fallback: every
  // shipped breath dragon names its own element flavor below (Ember/Frost/
  // Storm/Acid/Dread/Radiant), so this word only ever surfaces if a future
  // class takes `breath` without a named verb.
  breath: 'Breath',
};
/**
 * Per-(class, kind) display names OVER the generic plate vocabulary (story
 * 5.4, dossier E5-D10 — "display names over one kind"): the same engine
 * `slash` narrates as the Berserker's "Cleave" or the Ninja's "Rend". Keyed
 * by the engine unions both ways (AD-4), consulted FIRST by
 * `moveDisplayName`; a class absent here (or a kind absent for it) falls back
 * to `MOVE_PLATE_NAMES`/the blast composition — so the map stays sparse and a
 * new class needs no entry unless the dossier names its moves.
 */
export const CLASS_MOVE_NAMES: Partial<Record<UnitClass, Partial<Record<Exclude<MoveKind, 'blast'>, string>>>> = {
  mercenary: { slash: 'Cut Throat' },
  berserker: { slash: 'Cleave' },
  ninja: { slash: 'Rend' },
  golem: { slash: 'Smash' },
  phalanx: { bash: 'Pierce' },
  valkyrie: { slash: 'Pierce', bolt: 'Lightning' },
  fencer: { slash: 'Lunge' },
  dragonhunter: { slash: 'Skewer' },
  hawkman: { slash: 'Talon Strike' },
  vultan: { slash: 'Talon Strike', arrow: 'Wind Shot' },
  raven: { slash: 'Talon Strike', arrow: 'Thunder Arrow' },
  // Story 5.5 — the monsters (ROSTER.md's Front/Mid/Back verb columns). The
  // beasts bite or claw over `slash`; the Gryphon's back-row Wind Shot rides
  // `arrow` (E5-D14); each grown dragon's breath keeps its FLAVOR element
  // word (E5-D6: flavor only — the unit still rolls one of the four engine
  // elements, and the plate never reads that roll for a breath).
  gryphon: { slash: 'Claw', arrow: 'Wind Shot' },
  wyrm: { slash: 'Bite' },
  hellhound: { slash: 'Bite' },
  whelp: { slash: 'Bite' },
  emberdrake: { slash: 'Bite', breath: 'Ember Breath' },
  frostfang: { slash: 'Bite', breath: 'Frost Breath' },
  stormscale: { slash: 'Bite', breath: 'Storm Breath' },
  cragmaw: { slash: 'Bite', breath: 'Acid Breath' },
  nightwing: { slash: 'Bite', breath: 'Dread Breath' },
  halowing: { slash: 'Bite', breath: 'Radiant Breath' },
};
/** The blast's element flavor word (open Q2 default — EXPERIENCE.md names "Ice Blast" for water). */
export const BLAST_ELEMENT_WORD: Record<Element, string> = {
  fire: 'Fire',
  water: 'Ice',
  wind: 'Wind',
  earth: 'Stone',
};
/**
 * The plate name for a move: the actor class's own verb when the dossier
 * named one (CLASS_MOVE_NAMES, story 5.4), element-flavored for a blast
 * ("Ice Blast"), the fixed vocabulary otherwise.
 */
export const moveDisplayName = (kind: MoveKind, element: Element, cls: UnitClass): string =>
  kind === 'blast' ? `${BLAST_ELEMENT_WORD[element]} Blast` : (CLASS_MOVE_NAMES[cls]?.[kind] ?? MOVE_PLATE_NAMES[kind]);
/** The FR16 spell names, surfacing on the plate at last (dossier: a 2026-07-13 PO wish ships as a side effect). */
export const SPELL_DISPLAY_NAME: Record<SpellKind, string> = {
  sleep: 'Sleep',
  poison: 'Poison',
  weaken: 'Weaken',
  confusion: 'Confusion',
};
/** The heal's plate name (`UnitHealed` carries no MoveKind — the heal is its own vocabulary). */
export const HEAL_PLATE_LABEL = 'Heal';
/** The fizzle plate (a fizzled action is SPENT — FR16's no-valid-effect case earns a plate, unlike a skip). */
export const FIZZLE_PLATE_LABEL = 'Fizzle';

// FR3 element badge colors (cosmetic; the witch's spell keys off element — FR16).
// Keyed by the engine's `Element` union (AD-4) so a new element is a compile
// error here, never a runtime `undefined` fill. Hex values are the UX-
// authoritative set (DESIGN.md#Colors, reconciled in story 2.1 — one source,
// applied everywhere, shared by both future themes).
export const ELEMENT_COLORS: Record<Element, number> = {
  fire: 0xd1603b,
  water: 0x3f78c2,
  wind: 0x6bae8c,
  earth: 0xb0904f,
} as const;

// FR3 element badge geometry (story 2.1, DESIGN.md#Components element-badge):
// a single SOLID DOT — 12px diameter, full radius — identical in every scene.
// Element is never a card border or HP fill (those are side-coded); scenes
// render the badge through `addElementBadge` (config/ui.ts) so the treatment
// cannot drift per scene.
export const ELEMENT_BADGE_RADIUS = 6;
