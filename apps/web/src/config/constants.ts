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
  mage: 'MAG',
  cleric: 'CLE',
  witch: 'WIT',
};
export const CARD_CLASS_FONT_PX = 13;

export const BUTTON_WIDTH = 220;
export const BUTTON_HEIGHT = 56;

// Scene labels (story 1.8) — kept here so tests and scenes share one source.
export const DRAFT_TITLE = 'Draft your army';
export const DRAFT_CONTINUE_LABEL = 'Continue';
export const DRAFT_HINT = 'Tap a class to draft (3 units, duplicates allowed)';
export const PLACEMENT_TITLE = 'Place your units';
export const PLACEMENT_SUBMIT_LABEL = 'Ready';
export const PLACEMENT_SUBMIT_HINT = 'place all 3 units';
export const ENEMY_ARMY_LABEL = '▲  ENEMY ARMY  ▲';

// Reveal / Battle / Result scene labels (story 1.9) — one source for tests + scenes.
export const REVEAL_TITLE = 'Reveal';
export const REVEAL_HINT = 'Both armies face off. Tap to begin the battle.';
export const REVEAL_FIGHT_LABEL = 'Fight!';
export const BATTLE_HINT = 'Press and hold to fast-forward';
export const RESULT_WIN_LABEL = 'Victory!';
export const RESULT_LOSE_LABEL = 'Defeat';
export const RESULT_DRAW_LABEL = 'Draw';
export const RESULT_REMATCH_LABEL = 'Rematch';
export const RESULT_HOME_LABEL = 'Home';
// Back-to-Home affordance shown on every post-Home scene (closes the 1.8 dead-end).
export const HOME_BACK_LABEL = '‹ Home';

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

// Battle playback pacing (AC2): the default beat is a DATA tuning constant, not
// inlined in scene code. ~600 ms per event at normal speed; press-and-hold
// fast-forwards by BATTLE_FAST_FORWARD× (interim until FR23's controls, story 2.3).
export const BATTLE_BEAT_MS = 600;
export const BATTLE_FAST_FORWARD = 4;

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
export const BATTLE_LOG_LABEL = '≡ Log';
export const BATTLE_ENEMY_LABEL = '▲ ENEMY';
export const BATTLE_PLAYER_LABEL = 'YOUR ARMY ▼';
export const BATTLE_FRONT_ENEMY_LABEL = 'FRONT ↘';
export const BATTLE_FRONT_PLAYER_LABEL = '↖ FRONT';

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
