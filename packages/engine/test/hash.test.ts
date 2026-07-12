import { describe, expect, it } from 'vitest';
import { contentHash } from '../src/hash';

describe('contentHash (AD-8 canonical hashing)', () => {
  it('is independent of object key insertion order, recursively', () => {
    const a = { x: 1, y: { p: [1, 2], q: 'z' } };
    const b = { y: { q: 'z', p: [1, 2] }, x: 1 };
    expect(contentHash(a)).toBe(contentHash(b));
  });

  it('distinguishes nested structural differences', () => {
    expect(contentHash([1, [2, 3]])).not.toBe(contentHash([[1, 2], 3]));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: '1' }));
    expect(contentHash([])).not.toBe(contentHash([null]));
    expect(contentHash({})).not.toBe(contentHash([]));
  });

  it('rejects anything outside plain JSON instead of colliding silently', () => {
    expect(() => contentHash(undefined)).toThrow(TypeError);
    expect(() => contentHash([undefined])).toThrow(TypeError);
    expect(() => contentHash({ a: () => 1 })).toThrow(TypeError);
    expect(() => contentHash(NaN)).toThrow(TypeError);
    expect(() => contentHash(Infinity)).toThrow(TypeError);
    expect(() => contentHash(new Date(0))).toThrow(TypeError);
    expect(() => contentHash(new Map())).toThrow(TypeError);
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => contentHash(circular)).toThrow(TypeError);
  });

  it('accepts the full plain-JSON range', () => {
    expect(contentHash({ n: null, b: false, i: -0.5, s: '', a: [[]] })).toMatch(/^[0-9a-f]{8}$/);
  });
});
