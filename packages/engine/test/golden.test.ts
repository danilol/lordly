import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import type { MatchSetup } from '../src/types';

/**
 * Golden battles (NFR2): full BattleLog snapshots for fixed setups/seeds.
 * They guard against accidental RULE changes when tuning numbers — an
 * intentional rules/balance change re-records these deliberately
 * (`vitest -u`) with the diff reviewed event by event.
 */
function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, seed: number): MatchSetup {
  return { seed, balanceVersion: BALANCE.version, mode: 'single', ...partial };
}

describe('golden battles (story 1.5 — melee era)', () => {
  it('golden #1: a death — concentrated knights kill the front cleric', () => {
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              { class: 'knight', element: 'fire' },
              { class: 'knight', element: 'water' },
              { class: 'knight', element: 'wind' },
            ],
            B: [
              { class: 'cleric', element: 'earth' },
              { class: 'cleric', element: 'fire' },
              { class: 'cleric', element: 'water' },
            ],
          },
          placements: {
            A: [
              { row: 'front', col: 'left' },
              { row: 'front', col: 'center' },
              { row: 'front', col: 'right' },
            ],
            B: [
              { row: 'front', col: 'right' },
              { row: 'mid', col: 'right' },
              { row: 'back', col: 'right' },
            ],
          },
        },
        0xdead,
      ),
    );
    // Hand-verified verdict (audit 2026-07-12): 4×24 kills B:0; B ends 180/270.
    const verdict = log.events[log.events.length - 1];
    if (verdict?.type === 'BattleEnded') {
      expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 100, B: 66 } });
    }
    expect(log.events.some((e) => e.type === 'UnitDied' && e.unit === 'B:0')).toBe(true);
    expect(log).toMatchSnapshot();
  });

  it('golden #2: an HP-percentage decision — knight duel vs mercenary line', () => {
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              { class: 'knight', element: 'fire' },
              { class: 'mercenary', element: 'water' },
              { class: 'archer', element: 'wind' },
            ],
            B: [
              { class: 'mercenary', element: 'earth' },
              { class: 'mercenary', element: 'fire' },
              { class: 'witch', element: 'water' },
            ],
          },
          placements: {
            A: [
              { row: 'front', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'back', col: 'center' },
            ],
            B: [
              { row: 'front', col: 'center' },
              { row: 'mid', col: 'left' },
              { row: 'back', col: 'right' },
            ],
          },
        },
        0xcafe,
      ),
    );
    // Hand-verified verdict (audit 2026-07-12): A 304/340 = 89%, B 233/305 = 76%.
    const verdict = log.events[log.events.length - 1];
    if (verdict?.type === 'BattleEnded') {
      expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 89, B: 76 } });
    }
    expect(log).toMatchSnapshot();
  });

  it('golden #3: an exact-tie draw — mirrored triple knights, symmetric totals', () => {
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              { class: 'knight', element: 'fire' },
              { class: 'knight', element: 'water' },
              { class: 'knight', element: 'wind' },
            ],
            B: [
              { class: 'knight', element: 'earth' },
              { class: 'knight', element: 'fire' },
              { class: 'knight', element: 'water' },
            ],
          },
          placements: {
            A: [
              { row: 'front', col: 'left' },
              { row: 'front', col: 'center' },
              { row: 'front', col: 'right' },
            ],
            B: [
              { row: 'front', col: 'left' },
              { row: 'front', col: 'center' },
              { row: 'front', col: 'right' },
            ],
          },
        },
        0xfeed,
      ),
    );
    const verdict = log.events[log.events.length - 1];
    if (verdict?.type === 'BattleEnded') expect(verdict.winner).toBe('draw');
    expect(log).toMatchSnapshot();
  });
});
