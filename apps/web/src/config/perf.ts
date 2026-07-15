import type { Scene } from 'phaser';

/**
 * Frame-rate measurement (story 3.4, NFR1) — a dev-only diagnostic, same
 * `?query=1` gating pattern as `?textres=N` (config/ui.ts). Kept OFF the
 * render path unless explicitly enabled: zero runtime cost in production.
 *
 * CRITICAL: samples must be taken PER RENDERED FRAME (~60/sec), never per
 * beat/event (~2-7/sec) — frame rate is a property of the render loop, not
 * the battle-log dispatcher. `attachPerfSampler` hooks Phaser's scene UPDATE
 * event, which fires every frame regardless of whether that scene defines
 * an `update()` method.
 */

const PERF_SAMPLE_CAP = 3600; // ~60s at 60fps — bounds memory; the tail is what matters for a scripted benchmark

/** True only for the literal `?perf=1` — same strict-match discipline as `?textres`. */
export function isPerfQueryEnabled(search: string): boolean {
  return new URLSearchParams(search).get('perf') === '1';
}

export interface PerfSummary {
  count: number;
  min: number;
  median: number;
  /** Average of the worst 1% of samples (min 1) — the stutter signal a bare min/median can hide. */
  p1Low: number;
}

/** Pure stats over a per-frame fps sample set. Never mutates its input; never throws on empty input. */
export function summarizePerfSamples(samples: readonly number[]): PerfSummary {
  if (samples.length === 0) return { count: 0, min: 0, median: 0, p1Low: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2 : (sorted[mid] as number);
  const onePctCount = Math.max(1, Math.round(sorted.length * 0.01));
  const p1Low = sorted.slice(0, onePctCount).reduce((sum, v) => sum + v, 0) / onePctCount;
  return { count: sorted.length, min: sorted[0] as number, median, p1Low };
}

declare global {
  interface Window {
    /** Exposed only when `?perf=1` is active — a headless drive reads this via `page.evaluate`. */
    __perfSamples?: number[];
  }
}

/**
 * Attaches a per-frame fps sampler to `scene` when `?perf=1` is set; a no-op
 * otherwise. Reads `scene.game.loop.actualFps` on Phaser's own per-frame
 * UPDATE event — NOT the battle-log beat dispatcher, and NOT gated on the
 * scene defining its own `update()` (none of Draft/Placement/Battle do).
 * Samples accumulate in `window.__perfSamples` across scene transitions
 * within one `?perf=1` session, capped at `PERF_SAMPLE_CAP` (oldest evicted).
 */
export function attachPerfSampler(scene: Scene): void {
  if (typeof window === 'undefined' || !isPerfQueryEnabled(window.location.search)) return;
  window.__perfSamples ??= [];
  scene.events.on('update', () => {
    const samples = window.__perfSamples as number[];
    samples.push(scene.game.loop.actualFps);
    if (samples.length > PERF_SAMPLE_CAP) samples.splice(0, samples.length - PERF_SAMPLE_CAP);
  });
}
