import { expect, it } from 'vitest';
import { ENGINE_NAME } from '../src/index';

it('deliberately red: recheck merge-block with enforce_admins=false', () => {
  expect(ENGINE_NAME).toBe('still-not-the-real-name');
});
