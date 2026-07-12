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
} as const;

export const BUTTON_WIDTH = 220;
export const BUTTON_HEIGHT = 56;
