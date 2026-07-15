import { describe, expect, it } from 'vitest';
import { isPerfQueryEnabled, summarizePerfSamples } from '../src/config/perf';

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

  it('the 1%-low is the average of the worst 1% of samples (min 1 sample), not just the single min', () => {
    // 200 samples: 100 at 60fps, then a ramp DOWN 59..0 for the worst 100 (worst-first descent).
    // 1% of 200 = 2 samples -> the two worst: 0 and 1 -> average 0.5.
    const good = Array(100).fill(60);
    const bad = Array.from({ length: 100 }, (_, i) => 99 - i).filter((v) => v >= 0 && v <= 59); // 59..0, 60 values
    const samples = [...good, ...bad];
    const s = summarizePerfSamples(samples);
    expect(s.count).toBe(samples.length);
    const onePctCount = Math.max(1, Math.round(samples.length * 0.01));
    const sorted = [...samples].sort((a, b) => a - b);
    const expectedP1Low = sorted.slice(0, onePctCount).reduce((sum, v) => sum + v, 0) / onePctCount;
    expect(s.p1Low).toBeCloseTo(expectedP1Low, 10);
    expect(s.p1Low).toBeLessThan(s.median); // the low-percentile stutter signal is distinct from the median
  });

  it('never mutates the input array (a live ring buffer is read repeatedly)', () => {
    const samples = [30, 10, 20];
    const copy = [...samples];
    summarizePerfSamples(samples);
    expect(samples).toEqual(copy);
  });
});
