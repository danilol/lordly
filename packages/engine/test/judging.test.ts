import { describe, expect, it } from 'vitest';
import { judge, wipedSide } from '../src/judging';
import type { JudgedUnit } from '../src/judging';

function unit(side: 'A' | 'B', hp: number, maxHp: number): JudgedUnit {
  return { side, alive: hp > 0, hp, maxHp };
}

describe('FR18 wipe detection', () => {
  it('detects a fully dead side', () => {
    const units = [unit('A', 50, 140), unit('B', 0, 90), unit('B', 0, 90)];
    expect(wipedSide(units)).toBe('B');
  });

  it('no wipe while any unit lives', () => {
    const units = [unit('A', 50, 140), unit('B', 0, 90), unit('B', 1, 90)];
    expect(wipedSide(units)).toBeUndefined();
  });

  it("mutual wipe is 'both', not first-checked side (1.6 poison seam)", () => {
    const units = [unit('A', 0, 140), unit('B', 0, 90)];
    expect(wipedSide(units)).toBe('both');
  });

  it('an absent side is not vacuously wiped', () => {
    const units = [unit('A', 50, 140)];
    expect(wipedSide(units)).toBeUndefined();
  });
});

describe('FR18 judging', () => {
  it('wipe = instant win for the survivor; the wiped side reports 0%', () => {
    const units = [unit('A', 10, 140), unit('A', 0, 140), unit('B', 0, 90), unit('B', 0, 90)];
    const verdict = judge(units, 'B');
    expect(verdict.winner).toBe('A');
    expect(verdict.hpPct.B).toBe(0);
  });

  it('higher exact HP share wins even when floored percentages TIE (the false-tie floor bug)', () => {
    // A: 100/300 = 33.33% → floors to 33. B: 67/200 = 33.5% → floors to 33.
    // Exact: 100×200 = 20000 vs 67×300 = 20100 → B wins despite equal floored pct.
    const units = [unit('A', 100, 300), unit('B', 67, 200)];
    const verdict = judge(units, undefined);
    expect(verdict.hpPct).toEqual({ A: 33, B: 33 });
    expect(verdict.winner).toBe('B');
  });

  it('exact tie → draw', () => {
    const units = [unit('A', 70, 140), unit('B', 45, 90)]; // both exactly 50%
    expect(judge(units, undefined).winner).toBe('draw');
  });

  it("mutual wipe → draw with both sides at 0%", () => {
    const units = [unit('A', 0, 140), unit('B', 0, 90)];
    const verdict = judge(units, 'both');
    expect(verdict.winner).toBe('draw');
    expect(verdict.hpPct).toEqual({ A: 0, B: 0 });
  });

  it('zero starting total reports 0%, never NaN (latent guard; unreachable via validation)', () => {
    const verdict = judge([unit('A', 0, 0), unit('B', 45, 90)], undefined);
    expect(verdict.hpPct.A).toBe(0);
    expect(Number.isNaN(verdict.hpPct.A)).toBe(false);
  });

  it('reports floored percentages', () => {
    const units = [unit('A', 296, 320), unit('B', 250, 290)];
    const verdict = judge(units, undefined);
    expect(verdict.hpPct).toEqual({ A: 92, B: 86 });
    expect(verdict.winner).toBe('A');
  });
});
