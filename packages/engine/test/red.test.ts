import { expect, it } from 'vitest';
import { ENGINE_NAME } from '../src/index';

it('deliberately red: proves CI blocks merge', () => {
  expect(ENGINE_NAME).toBe('not-the-real-name');
});
