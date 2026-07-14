import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, BASE_WIDTH, BATTLE_SPEEDS, battleSpeed, DEFAULT_SPEED_ID, GAME_NAME, HOME_PLAY_LABEL } from '../src/config/constants';

describe('web smoke test', () => {
  it('exposes the game name without booting Phaser', () => {
    expect(GAME_NAME).toBe('Lord Battle Tactics');
  });

  it('exposes the Home scene labels and portrait base resolution (FR30)', () => {
    expect(HOME_PLAY_LABEL).toBe('Play vs AI');
    expect(BASE_WIDTH).toBe(360);
    expect(BASE_HEIGHT).toBe(640);
    expect(BASE_HEIGHT).toBeGreaterThan(BASE_WIDTH);
  });
});

describe('battleSpeed sanitizer (FR23, story 2.3)', () => {
  it('resolves every known speed id to its own entry', () => {
    for (const speed of BATTLE_SPEEDS) {
      expect(battleSpeed(speed.id)).toBe(speed);
    }
  });

  it('falls back to normal speed for unknown/stale ids (forward-compat with future settings)', () => {
    expect(battleSpeed('16x')).toBe(BATTLE_SPEEDS[0]);
    expect(battleSpeed('')).toBe(BATTLE_SPEEDS[0]);
    expect(BATTLE_SPEEDS[0].id).toBe(DEFAULT_SPEED_ID);
  });

  it('keeps fast-forward opt-in: the default entry is normal speed, factor 1', () => {
    expect(battleSpeed(DEFAULT_SPEED_ID).factor).toBe(1);
  });
});
