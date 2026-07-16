import type { Scene } from 'phaser';

/**
 * Frame-rate measurement (story 3.4, NFR1) — a dev-only diagnostic, same
 * `?query=1` gating pattern as `?textres=N` (config/ui.ts). Kept OFF the
 * render path unless explicitly enabled: zero runtime cost in production.
 *
 * Two real instrument bugs were caught by this story's review — don't
 * reintroduce them:
 * - Samples are per-frame INSTANTANEOUS fps derived from `game.loop.rawDelta`
 *   (the unsmoothed frame delta), NOT `actualFps` — that one is a
 *   once-per-second exponential moving average (Phaser TimeStep.updateFPS:
 *   `0.25·framesThisSecond + 0.75·prev`), so sampling it per frame records
 *   ~60 duplicates of a smoothed value and hides exactly the mid-beat tween
 *   stutters this instrument exists to catch.
 * - The listener is removed on scene shutdown. Phaser scenes are singletons
 *   and `Systems.shutdown` clears only TRANSITION_* listeners, so without
 *   cleanup every scene re-entry stacks another sampler — N pushes per frame,
 *   corrupting every sample-count-based statistic.
 */

// ~10min at 60fps — bounds memory while outlasting any one benchmark session
// (the original 3,600 cap proved too small: one ~96s ×2-speed device run overflows it).
const PERF_SAMPLE_CAP = 36_000;

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

/** Appends one sample and evicts the oldest past `cap`. Mutates `samples` (it IS the live buffer). */
export function pushSample(samples: number[], fps: number, cap: number = PERF_SAMPLE_CAP): void {
  samples.push(fps);
  if (samples.length > cap) samples.splice(0, samples.length - cap);
}

declare global {
  interface Window {
    /** Exposed only when `?perf=1` is active — a headless drive reads this via `page.evaluate`. */
    __perfSamples?: number[];
  }
}

/**
 * Attaches a per-frame fps sampler to `scene` when `?perf=1` is set; a no-op
 * otherwise. Each rendered frame pushes `1000 / game.loop.rawDelta` — the
 * instantaneous fps of THAT frame. Samples accumulate in `window.__perfSamples`
 * across scene transitions within one `?perf=1` session, capped at
 * `PERF_SAMPLE_CAP` (oldest evicted); a harness may reset the array between
 * scenarios (`= []`, `= undefined`, or `delete`) — the sampler recreates it.
 * Detaches itself on scene shutdown so re-entering a scene never double-samples.
 */
export function attachPerfSampler(scene: Scene): void {
  if (typeof window === 'undefined' || !isPerfQueryEnabled(window.location.search)) return;
  window.__perfSamples ??= [];
  // Gated diagnostic readout, same as `?textres` (config/ui.ts): an on-device
  // tester without a CDP harness needs proof the sampler is armed.
  console.info(`[lordly] perf sampler armed (${scene.scene.key}) — read window.__perfSamples`);
  const sample = (): void => {
    const rawDelta = scene.game.loop.rawDelta;
    if (!Number.isFinite(rawDelta) || rawDelta <= 0) return; // first frame / halted loop: no meaningful fps yet
    pushSample((window.__perfSamples ??= []), 1000 / rawDelta);
  };
  scene.events.on('update', sample);
  scene.events.once('shutdown', () => scene.events.off('update', sample));
}
