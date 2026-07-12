import { describe, expect, it } from 'vitest';
import { GAME_NAME } from '../src/config/constants';

describe('web smoke test', () => {
  it('exposes the game name without booting Phaser', () => {
    expect(GAME_NAME).toBe('Lord Battle Tactics');
  });
});
