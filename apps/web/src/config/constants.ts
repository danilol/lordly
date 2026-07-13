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
export const REVEAL_PLACEHOLDER = 'Both armies committed.\nReveal, battle & result arrive in story 1.9.';

// FR3 element badge colors (cosmetic; the witch's spell keys off element — FR16).
// Keyed by the engine's `Element` union (AD-4) so a new element is a compile
// error here, never a runtime `undefined` fill.
export const ELEMENT_COLORS: Record<Element, number> = {
    fire: 0xc0563a,
    water: 0x3a76c0,
    wind: 0x6ab08a,
    earth: 0xa98a52,
} as const;
