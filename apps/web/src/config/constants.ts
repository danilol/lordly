import type { Element, SpellKind, UnitClass } from '@lordly/engine';

export const GAME_NAME = 'Lord Battle Tactics';

export const HOME_PLAY_LABEL = 'Play vs AI';

// FR30 portrait baseline: ~360×640 CSS px, scaled up by Phaser.Scale.FIT.
export const BASE_WIDTH = 360;
export const BASE_HEIGHT = 640;

// Shared UI palette — the single source for colors used across scenes and
// the Phaser game config. Hex strings for text/config, numbers for shapes.
export const PALETTE = {
  background: '#1a1a2e',
  /** The same ground as `background`, as a number for shape fills (e.g. the Help scene's opaque header strip). */
  backgroundFill: 0x1a1a2e,
  title: '#e8d5a3',
  buttonFill: 0x3a3a4e,
  buttonStroke: 0x55556a,
  buttonTextDisabled: '#77778a',
  // Enabled-button + scene UI (story 1.8).
  buttonText: '#e8d5a3',
  buttonFillEnabled: 0x4a6a4e,
  buttonStrokeEnabled: 0x7ab07f,
  cardFill: 0x24243a,
  cardStroke: 0x44445e,
  bodyText: '#c8c8d8',
  mutedText: '#88889a',
  gridCellFill: 0x20203a,
  gridCellStroke: 0x44445e,
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
  hpBarBack: 0x2a2a3e,
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
} as const;

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
};
export const CARD_CLASS_FONT_PX = 13;

// FR39f (story 4.0): the class-code contrast treatment for units standing ON
// side-colored board tiles (Battle, Reveal). A dark outline stroke carries the
// letterform regardless of what's behind it — the token treatment DESIGN.md's
// unit-card component specifies; scenes consume it via `unitCodeStyle`, never
// restating the values. (Tray/panel codes on dark cards keep their own styles
// — the defect was tiles only.)
export const CODE_STROKE_COLOR = '#10131f';
export const CODE_STROKE_THICKNESS = 3;

/** The one text style for board-unit class codes — both scenes (Battle, Reveal) read it from here so the FR39f treatment cannot drift. */
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
  tileW: 56,
  tileH: 28,
  enemy: { ox: 120, oy: 100 },
  player: { ox: 240, oy: 224 },
  stackedEnemy: { ox: 180, oy: 88 },
  stackedPlayer: { ox: 180, oy: 236 },
} as const;

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
