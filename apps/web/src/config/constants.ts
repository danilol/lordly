import type { Element } from '@lordly/engine';

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
    // Battle/result (story 1.9). Player = side A (green family); enemy = side B (red family).
    playerText: '#7ab07f',
    hpBarBack: 0x2a2a3e,
    hpBarPlayer: 0x4a6a4e,
    hpBarEnemy: 0x8a3a3a,
    winText: '#7ab07f',
    loseText: '#e06a6a',
    drawText: '#c8c8d8',
} as const;

// Text render resolution multiplier: the game renders at the 360×640 base and
// Scale.FIT upscales the canvas, which softens text. Rendering glyphs to a
// higher-resolution texture keeps them crisp when the canvas is scaled up.
// Applied via `crispText` (config/ui.ts) so every label shares one setting.
export const TEXT_RESOLUTION = 3;

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

// Shared battle-board geometry (story 1.9): six stacked rows (side B on top,
// side A on the bottom) of a 3-wide grid, with a gap between the two facing
// front rows. Reveal and Battle scenes project cells through this one source
// (via battleView.screenCellCenter) so both stay pixel-consistent.
export const BATTLE_BOARD = {
    cell: 56,
    gap: 4,
    top: 120,
    /** Extra vertical space between B.front (row 2) and A.front (row 3) — the "no man's land". */
    midGap: 16,
} as const;

// FR3 element badge colors (cosmetic; the witch's spell keys off element — FR16).
// Keyed by the engine's `Element` union (AD-4) so a new element is a compile
// error here, never a runtime `undefined` fill.
export const ELEMENT_COLORS: Record<Element, number> = {
    fire: 0xc0563a,
    water: 0x3a76c0,
    wind: 0x6ab08a,
    earth: 0xa98a52,
} as const;
