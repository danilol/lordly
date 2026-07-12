import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { createStreams, nextInt, rollElement, STREAM_LABELS } from '../src/rng';
import type { StreamLabel } from '../src/rng';
import { ALL_ELEMENTS } from '../src/types';

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

/** Draw n values from a fresh stream for a given seed/label. */
function draw(seed: number, label: StreamLabel, n: number): number[] {
  const stream = createStreams(seed)[label];
  return Array.from({ length: n }, () => nextInt(stream, 0, 0x7fffffff));
}

/** The FNV-1a label hash the PREVIOUS derivation used (regression fixture). */
function fnv(label: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
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

  it('rejects non-uint32 seeds instead of silently aliasing them (FR20)', () => {
    for (const bad of [-1, 1.5, 2 ** 32, NaN, Infinity]) {
      expect(() => createStreams(bad), String(bad)).toThrow(RangeError);
    }
    expect(() => createStreams(0)).not.toThrow();
    expect(() => createStreams(0xffffffff)).not.toThrow();
  });

  it('nextInt stays within the requested inclusive bounds', () => {
    const stream = createStreams(7)['battle'];
    for (let i = 0; i < 1000; i++) {
      const v = nextInt(stream, 3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
    expect(nextInt(stream, 5, 5)).toBe(5);
  });

  it('nextInt rejects inverted or non-integer bounds and foreign streams', () => {
    const stream = createStreams(7)['battle'];
    expect(() => nextInt(stream, 9, 3)).toThrow(RangeError);
    expect(() => nextInt(stream, 0.5, 2)).toThrow(RangeError);
    expect(() => nextInt({ label: 'battle' }, 0, 1)).toThrow(TypeError);
  });

  it('REGRESSION (review 1.3): no affine cross-label aliasing via the FNV delta', () => {
    // Old defect: stream L1 under seed X equaled L2 under X ^ (fnv(L1)^fnv(L2)).
    const x = 0x12345678;
    for (const l1 of STREAM_LABELS) {
      for (const l2 of STREAM_LABELS) {
        if (l1 === l2) continue;
        const aliasSeed = (x ^ (fnv(l1) ^ fnv(l2))) >>> 0;
        expect(draw(x, l1, 16), `${l1} vs ${l2}`).not.toEqual(draw(aliasSeed, l2, 16));
      }
    }
  });

  it('REGRESSION (review 1.3): first (A,B) element pair is not a function of seed % 4', () => {
    // Old defect: across the whole seed space, seed % 4 fully determined the
    // first rolled pair. Now each residue class must show variety.
    const pairsByResidue = new Map<number, Set<string>>();
    for (let seed = 0; seed < 64; seed++) {
      const streams = createStreams(seed);
      const pair = `${rollElement(streams['elements/A'])}+${rollElement(streams['elements/B'])}`;
      const residue = seed % 4;
      if (!pairsByResidue.has(residue)) pairsByResidue.set(residue, new Set());
      pairsByResidue.get(residue)?.add(pair);
    }
    for (const [residue, pairs] of pairsByResidue) {
      expect(pairs.size, `seed%4 === ${residue} produced a single fixed pair`).toBeGreaterThan(1);
    }
  });
});

describe('rollElement (FR3, AD-9)', () => {
  test.prop([seedArb])('only ever returns the four elements', (seed) => {
    const stream = createStreams(seed)['elements/A'];
    for (let i = 0; i < 12; i++) {
      expect(ALL_ELEMENTS).toContain(rollElement(stream));
    }
  });

  it('freezes the element roll order for a known seed (determinism anchor)', () => {
    const stream = createStreams(0xc0ffee)['elements/A'];
    const rolls = [rollElement(stream), rollElement(stream), rollElement(stream)];
    // Pinned at implementation time (re-pinned after the review-1.3 derivation
    // fix); a change here means the element order, derivation, or generator
    // changed — a determinism-breaking engine API change.
    expect(rolls).toEqual(['fire', 'water', 'earth']);
  });

  it('anchors nextInt across streams and seeds (replay determinism tripwire)', () => {
    // Wider anchor guarding the pure-rand exact pin: if generator behavior
    // shifts (e.g. a dependency bump), these values change.
    const s1 = createStreams(1);
    const s2 = createStreams(0xfffffffe);
    const observed = [
      nextInt(s1['battle'], 0, 999999),
      nextInt(s1['battle'], 0, 999999),
      nextInt(s1['ai/A'], 0, 999999),
      nextInt(s2['battle'], 0, 999999),
      nextInt(s2['elements/B'], 0, 999999),
    ];
    expect(observed).toEqual([301454, 522347, 94566, 411552, 697090]);
  });
});
