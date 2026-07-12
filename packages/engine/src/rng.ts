import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';
import { uniformInt } from 'pure-rand/distribution/uniformInt';
import type { JumpableRandomGenerator } from 'pure-rand/types/JumpableRandomGenerator';
import type { Element } from './types';

/**
 * The closed set of named randomness streams (AD-10). One 32-bit seed per
 * match; every random draw comes from one of these independently derived
 * streams — the raw seed is never consumed directly. Adding a stream is an
 * engine API change, not a local decision.
 */
export const STREAM_LABELS = ['elements/A', 'elements/B', 'ai/A', 'ai/B', 'battle'] as const;

/** A named stream's label (AD-10 closed set). */
export type StreamLabel = (typeof STREAM_LABELS)[number];

/**
 * An opaque, stateful randomness stream. Drawing from it advances it in
 * place; determinism holds at the seed boundary (FR20): the same seed and
 * label always yield the same sequence. The underlying generator never
 * leaks out of this module.
 */
export interface Stream {
  /** @internal pure-rand generator; do not touch outside rng.ts. */
  readonly gen: JumpableRandomGenerator;
}

/** All five streams for one match, keyed by label. */
export type Streams = Record<StreamLabel, Stream>;

/**
 * Derives the closed stream set from a 32-bit match seed (AD-10).
 * Each stream's generator is seeded with a label-keyed FNV-1a mix of the
 * label bytes and the seed, so streams are mutually independent: knowing
 * one stream's values does not yield another's, and the raw seed itself
 * never seeds a generator.
 */
export function createStreams(seed: number): Streams {
  const entries = STREAM_LABELS.map((label) => [label, { gen: xoroshiro128plus(deriveSeed(seed, label)) }]);
  return Object.fromEntries(entries) as Streams;
}

/**
 * Draws a uniform integer in [from, to] (both inclusive) from the stream,
 * advancing it. The only sanctioned way to consume randomness (AD-10).
 */
export function nextInt(stream: Stream, from: number, to: number): number {
  return uniformInt(stream.gen, from, to);
}

/**
 * Fixed element order for rolls — part of the determinism contract (FR20):
 * reordering this array is an engine API change that breaks replays.
 */
const ELEMENT_ORDER: readonly Element[] = ['fire', 'water', 'wind', 'earth'];

/**
 * Rolls one element (FR3). The draft flow calls this exactly once per drafted
 * unit on the owner's element stream; the result is stored in `MatchSetup`
 * as plain data and never re-derived (AD-9).
 */
export function rollElement(stream: Stream): Element {
  return ELEMENT_ORDER[nextInt(stream, 0, ELEMENT_ORDER.length - 1)] as Element;
}

/**
 * Label-keyed seed derivation (AD-10): FNV-1a over the label's characters,
 * mixed with the match seed. 32-bit integer math only.
 */
function deriveSeed(seed: number, label: StreamLabel): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    hash ^= label.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= seed >>> 0;
  hash = Math.imul(hash, 0x01000193) >>> 0;
  return hash | 0;
}
