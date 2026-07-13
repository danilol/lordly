import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import { uniformInt } from 'pure-rand/distribution/uniformInt';
import type { JumpableRandomGenerator } from 'pure-rand/types/JumpableRandomGenerator';
import { ALL_ELEMENTS } from './types';
import type { Element } from './types';

/**
 * The closed set of named randomness streams (AD-10). One 32-bit seed per
 * match; every random draw comes from one of these independently derived
 * streams — the raw seed is never consumed directly. Adding a stream is an
 * engine API change, not a local decision.
 */
export const STREAM_LABELS = ['elements/A', 'elements/B', 'ai/A', 'ai/B', 'battle'] as const;

/**
 * The inclusive uint32 ceiling every match seed must satisfy (FR20). The ONE
 * source for the bound (story 2.0 AC3) — validate.ts and the sim CLI consume
 * this instead of re-typing the literal (they had drifted into triplication).
 */
export const MAX_SEED = 0xffffffff;

/** A named stream's label (AD-10 closed set). */
export type StreamLabel = (typeof STREAM_LABELS)[number];

/**
 * An opaque, stateful randomness stream. Drawing from it advances it in
 * place; determinism holds at the seed boundary (FR20): the same seed and
 * label always yield the same sequence. The underlying generator is held in
 * module-private state and cannot be reached through this type — `nextInt`
 * is the only way to consume randomness.
 */
export interface Stream {
  readonly label: StreamLabel;
}

/** All five streams for one match, keyed by label. */
export type Streams = Record<StreamLabel, Stream>;

/** Module-private handle → generator map: the opacity mechanism. */
const generators = new WeakMap<Stream, JumpableRandomGenerator>();

/**
 * Derives the closed stream set from a 32-bit unsigned match seed (AD-10).
 *
 * Each stream's generator seed is an avalanche-mixed (murmur3 fmix32)
 * combination of the label hash and the match seed, followed by warm-up
 * draws, so streams show no structural correlation across labels or seeds:
 * unlike plain FNV mixing, no fixed XOR-delta relates one stream to another.
 * (With a 32-bit seed space, independence is necessarily computational —
 * recovering the seed by brute force is inherent to FR20's design — but no
 * shortcut beats that brute force.)
 *
 * @throws RangeError if `seed` is not an integer in [0, 2^32) — silent
 * coercion would alias distinct seeds onto identical battles (FR20).
 */
export function createStreams(seed: number): Streams {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    throw new RangeError(`match seed must be a uint32, got ${seed}`);
  }
  const entries = STREAM_LABELS.map((label) => {
    const gen = xoroshiro128plus(deriveSeed(seed, label));
    for (let i = 0; i < 4; i++) gen.next(); // warm-up: mix the 128-bit state
    const stream: Stream = { label };
    generators.set(stream, gen);
    return [label, stream];
  });
  return Object.fromEntries(entries) as Streams;
}

/**
 * Draws a uniform integer in [from, to] (both inclusive) from the stream,
 * advancing it. The only sanctioned way to consume randomness (AD-10).
 *
 * @throws RangeError on non-integer or inverted bounds (pure-rand would
 * silently return NaN or out-of-range values).
 * @throws TypeError if `stream` did not come from `createStreams`.
 */
export function nextInt(stream: Stream, from: number, to: number): number {
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    throw new RangeError(`bounds must be integers, got ${from}..${to}`);
  }
  if (from > to) {
    throw new RangeError(`empty range ${from}..${to}`);
  }
  const gen = generators.get(stream);
  if (gen === undefined) {
    throw new TypeError('unknown stream: streams must come from createStreams');
  }
  return uniformInt(gen, from, to);
}

/**
 * Rolls one element (FR3), uniform over `ALL_ELEMENTS` in its fixed order.
 * The draft flow calls this exactly once per drafted unit on the owner's
 * element stream; the result is stored in `MatchSetup` as plain data and
 * never re-derived (AD-9).
 */
export function rollElement(stream: Stream): Element {
  return ALL_ELEMENTS[nextInt(stream, 0, ALL_ELEMENTS.length - 1)] as Element;
}

/**
 * Label-keyed seed derivation (AD-10): FNV-1a over the label's characters,
 * XORed with the seed, then avalanche-finalized (murmur3 fmix32) with the
 * label hash folded in between rounds. The avalanche breaks both the
 * low-bit dependence of the raw combination and the affine cross-label
 * structure plain FNV would leave. 32-bit integer math only.
 */
function deriveSeed(seed: number, label: StreamLabel): number {
  let labelHash = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    labelHash ^= label.charCodeAt(i);
    labelHash = Math.imul(labelHash, 0x01000193) >>> 0;
  }
  const mixed = fmix32((seed ^ labelHash) >>> 0);
  return fmix32((mixed + Math.imul(labelHash, 0x9e3779b9)) >>> 0) | 0;
}

/** murmur3's 32-bit avalanche finalizer: every input bit affects every output bit. */
function fmix32(x: number): number {
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}
