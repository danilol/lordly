import { describe, expect, it } from 'vitest';
import { ENGINE_NAME } from '../src/index';

describe('@lordly/engine wiring', () => {
  it('exposes the engine name from src/index.ts', () => {
    expect(ENGINE_NAME).toBe('lordly-engine');
  });
});
