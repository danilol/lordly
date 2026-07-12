import { describe, expect, it } from 'vitest';
import { ENGINE_NAME } from '@lordly/engine';

describe('@lordly/engine resolution from apps/web', () => {
  it('resolves the workspace package via its exports map (ADR-001)', () => {
    expect(ENGINE_NAME).toBe('lordly-engine');
  });
});
