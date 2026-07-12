import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { createStreams, nextInt, rollElement, STREAM_LABELS } from '../src/rng';
import type { StreamLabel } from '../src/rng';

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

/** Draw n values from a fresh stream for a given seed/label. */
function draw(seed: number, label: StreamLabel, n: number): number[] {
  const stream = createStreams(seed)[label];
  return Array.from({ length: n }, () => nextInt(stream, 0, 0x7fffffff));
}

describe('named seed streams (AD-10)', () => {
  it('exposes exactly the closed stream set', () => {
    expect([...STREAM_LABELS].sort()).toEqual(['ai/A', 'ai/B', 'battle', 'elements/A', 'elements/B'].sort());
    const streams = createStreams(42);
    expect(Object.keys(streams).sort()).toEqual([...STREAM_LABELS].sort());
  });

  test.prop([seedArb])('same seed → bit-identical sequences on every stream', (seed) => {
    for (const label of STREAM_LABELS) {
      expect(draw(seed, label, 16)).toEqual(draw(seed, label, 16));
    }
  });

  test.prop([seedArb])('different labels on the same seed → different sequences', (seed) => {
    const sequences = STREAM_LABELS.map((label) => draw(seed, label, 16).join(','));
    expect(new Set(sequences).size).toBe(STREAM_LABELS.length);
  });

  test.prop([seedArb, seedArb])('different seeds on the same label → different sequences', (a, b) => {
    fc.pre(a !== b);
    for (const label of STREAM_LABELS) {
      expect(draw(a, label, 16)).not.toEqual(draw(b, label, 16));
    }
  });

  it('nextInt stays within the requested inclusive bounds', () => {
    const stream = createStreams(7)['battle'];
    for (let i = 0; i < 1000; i++) {
      const v = nextInt(stream, 3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });
});

describe('rollElement (FR3, AD-9)', () => {
  test.prop([seedArb])('only ever returns the four elements', (seed) => {
    const stream = createStreams(seed)['elements/A'];
    for (let i = 0; i < 12; i++) {
      expect(['fire', 'water', 'wind', 'earth']).toContain(rollElement(stream));
    }
  });

  it('freezes the element roll order for a known seed (determinism anchor)', () => {
    const stream = createStreams(0xc0ffee)['elements/A'];
    const rolls = [rollElement(stream), rollElement(stream), rollElement(stream)];
    // Pinned at implementation time; a change here means the element order,
    // derivation, or generator changed — a determinism-breaking engine API change.
    expect(rolls).toEqual(['water', 'fire', 'fire']);
  });
});
