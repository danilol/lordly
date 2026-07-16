import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Scene } from 'phaser';
import { attachPerfSampler, isPerfQueryEnabled, pushSample, summarizePerfSamples } from '../src/config/perf';

describe('isPerfQueryEnabled (story 3.4) — the ?perf=1 diagnostic gate, same pattern as ?textres', () => {
  it('is true only for the exact value "1"', () => {
    expect(isPerfQueryEnabled('?perf=1')).toBe(true);
  });

  it('is false when absent, empty, or any other value', () => {
    expect(isPerfQueryEnabled('')).toBe(false);
    expect(isPerfQueryEnabled('?other=1')).toBe(false);
    expect(isPerfQueryEnabled('?perf=true')).toBe(false);
    expect(isPerfQueryEnabled('?perf=0')).toBe(false);
    expect(isPerfQueryEnabled('?perf')).toBe(false);
  });
});

describe('summarizePerfSamples (story 3.4) — pure stats over PER-FRAME fps samples', () => {
  it('reports 0s for an empty sample set rather than throwing (no frames captured yet)', () => {
    expect(summarizePerfSamples([])).toEqual({ count: 0, min: 0, median: 0, p1Low: 0 });
  });

  it('computes min/median correctly for an odd-length sample set', () => {
    // sorted: 10, 30, 55, 58, 60
    const s = summarizePerfSamples([58, 10, 60, 30, 55]);
    expect(s.count).toBe(5);
    expect(s.min).toBe(10);
    expect(s.median).toBe(55);
  });

  it('computes the median as the average of the two middle values for an even-length set', () => {
    // sorted: 20, 40, 60, 80 -> median = (40+60)/2 = 50
    expect(summarizePerfSamples([80, 20, 60, 40]).median).toBe(50);
  });

  it('the 1%-low is the average of the worst 1% of samples, not just the single min', () => {
    // Exactly 200 samples: 198 at 60fps plus two known worst values, 1 and 2.
    // 1% of 200 = 2 samples -> p1Low = (1 + 2) / 2 = 1.5. Hand-computed oracle —
    // deliberately NOT recomputed with the implementation's own sort/slice/reduce,
    // so a percentile-definition bug (floor vs round, slice off-by-one) fails here.
    const samples = [...Array(198).fill(60), 2, 1];
    const s = summarizePerfSamples(samples);
    expect(s.count).toBe(200);
    expect(s.min).toBe(1);
    expect(s.p1Low).toBeCloseTo(1.5, 10);
    expect(s.median).toBe(60);
  });

  it('falls back to the single worst sample when 1% of the set rounds below one sample', () => {
    // 40 samples: round(0.4) = 0, clamped to 1 -> p1Low = min = 12.
    const samples = [...Array(39).fill(60), 12];
    expect(summarizePerfSamples(samples).p1Low).toBe(12);
  });

  it('never mutates the input array (a live ring buffer is read repeatedly)', () => {
    const samples = [30, 10, 20];
    const copy = [...samples];
    summarizePerfSamples(samples);
    expect(samples).toEqual(copy);
  });
});

describe('pushSample (story 3.4 review) — capped buffer eviction, previously untested', () => {
  it('appends in arrival order while under the cap', () => {
    const samples: number[] = [];
    pushSample(samples, 60, 3);
    pushSample(samples, 58, 3);
    expect(samples).toEqual([60, 58]);
  });

  it('evicts exactly the oldest sample at the cap boundary', () => {
    const samples = [1, 2, 3];
    pushSample(samples, 4, 3);
    expect(samples).toEqual([2, 3, 4]);
  });

  it('recovers to the cap even from an over-full buffer', () => {
    const samples = [1, 2, 3, 4, 5];
    pushSample(samples, 6, 3);
    expect(samples).toEqual([4, 5, 6]);
  });
});

/**
 * attachPerfSampler needs a browser-shaped `window` and a Phaser-shaped scene;
 * both are stubbed minimally. The emitter mirrors the EventEmitter surface the
 * sampler uses (`on`/`once`/`off`/`emit`) including Phaser's real shutdown
 * semantics: `Systems.shutdown` does NOT remove generic listeners — only the
 * sampler's own `once('shutdown', ...)` cleanup does.
 */
function fakeEmitter() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const bucket = (event: string) => {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    return set;
  };
  const emitter = {
    on: (event: string, fn: (...args: unknown[]) => void) => bucket(event).add(fn),
    once: (event: string, fn: (...args: unknown[]) => void) => {
      const wrapper = (...args: unknown[]) => {
        emitter.off(event, wrapper);
        fn(...args);
      };
      emitter.on(event, wrapper);
    },
    off: (event: string, fn: (...args: unknown[]) => void) => bucket(event).delete(fn),
    emit: (event: string, ...args: unknown[]) => {
      for (const fn of [...bucket(event)]) fn(...args);
    },
    count: (event: string) => bucket(event).size,
  };
  return emitter;
}

function fakeScene(events: ReturnType<typeof fakeEmitter>, loop: { rawDelta: number }): Scene {
  return { scene: { key: 'FakeScene' }, events, game: { loop } } as unknown as Scene;
}

function stubWindow(search: string): Window & { __perfSamples?: number[] } {
  const win = { location: { search } } as Window & { __perfSamples?: number[] };
  vi.stubGlobal('window', win);
  return win;
}

describe('attachPerfSampler (story 3.4 review) — gating, per-frame source, cleanup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is a full no-op when ?perf=1 is absent: no listener, no window global, no console output', () => {
    const win = stubWindow('');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const events = fakeEmitter();
    attachPerfSampler(fakeScene(events, { rawDelta: 16 }));
    expect(events.count('update')).toBe(0);
    expect(win.__perfSamples).toBeUndefined();
    expect(info).not.toHaveBeenCalled();
  });

  it('when armed, announces itself on the console and samples 1000/rawDelta per update (NOT the actualFps EMA)', () => {
    const win = stubWindow('?perf=1');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const events = fakeEmitter();
    const loop = { rawDelta: 20 };
    attachPerfSampler(fakeScene(events, loop));
    expect(info).toHaveBeenCalledOnce();
    events.emit('update');
    loop.rawDelta = 50; // a 50ms frame — the stutter the EMA would have smoothed away
    events.emit('update');
    expect(win.__perfSamples).toEqual([50, 20]);
  });

  it('skips frames with no meaningful delta (0, negative, NaN) instead of recording Infinity', () => {
    const win = stubWindow('?perf=1');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const events = fakeEmitter();
    const loop = { rawDelta: 0 };
    attachPerfSampler(fakeScene(events, loop));
    events.emit('update');
    loop.rawDelta = Number.NaN;
    events.emit('update');
    expect(win.__perfSamples).toEqual([]);
  });

  it('survives a harness resetting window.__perfSamples between scenarios instead of throwing every frame', () => {
    const win = stubWindow('?perf=1');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const events = fakeEmitter();
    attachPerfSampler(fakeScene(events, { rawDelta: 16 }));
    events.emit('update');
    win.__perfSamples = undefined; // page.evaluate reset between benchmark scenarios
    events.emit('update');
    expect(win.__perfSamples).toEqual([62.5]);
  });

  it('detaches on scene shutdown so a scene re-entry never stacks duplicate samplers', () => {
    const win = stubWindow('?perf=1');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const events = fakeEmitter();
    const scene = fakeScene(events, { rawDelta: 16 });

    attachPerfSampler(scene); // 1st create()
    events.emit('shutdown'); // scene.start elsewhere — Phaser keeps generic listeners; our cleanup must fire
    expect(events.count('update')).toBe(0);
    events.emit('update');
    expect(win.__perfSamples).toEqual([]);

    attachPerfSampler(scene); // 2nd create() of the SAME singleton scene
    events.emit('update');
    expect(events.count('update')).toBe(1); // exactly one sampler, not two
    expect(win.__perfSamples).toEqual([62.5]); // exactly one sample per frame
  });
});
