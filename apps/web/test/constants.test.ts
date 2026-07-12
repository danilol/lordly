import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, BASE_WIDTH, GAME_NAME, HOME_PLAY_LABEL } from '../src/config/constants';

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
