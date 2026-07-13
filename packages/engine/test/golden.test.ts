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
function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, seed: number, mode: MatchSetup['mode'] = 'single'): MatchSetup {
  return { seed, balanceVersion: BALANCE.version, mode, ...partial };
}

describe('golden battles', () => {
  it('golden #1: knights grind through a healing cleric column (staff clamp + heal visible)', () => {
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
    // Hand-verified (re-pinned 1.6 — clerics now heal): staff bonks clamp to
    // 1; B:2 heals B:0 +30 mid-grind; B:0 survives at 24. A 417/420 = 99%.
    const verdict = log.events[log.events.length - 1];
    if (verdict?.type === 'BattleEnded') {
      expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 99, B: 75 } });
    }
    expect(log.events.some((e) => e.type === 'UnitHealed')).toBe(true);
    expect(log).toMatchSnapshot();
  });

  it('golden #2: an HP-percentage decision — the water witch sleeps two attackers', () => {
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
    // Hand-verified (re-pinned 1.6 — the witch acts): sleep lands on A's
    // archer then (prefer-unaffected) A's merc, both visibly skipping asleep.
    // A 304/340 = 89%, B 249/305 = 81%.
    const verdict = log.events[log.events.length - 1];
    if (verdict?.type === 'BattleEnded') {
      expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 89, B: 81 } });
    }
    expect(log.events.filter((e) => e.type === 'ActionSkipped' && e.reason === 'asleep').length).toBeGreaterThanOrEqual(3);
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

describe('golden battles (story 1.6 — full roster era)', () => {
  it('golden #4: the mage blast — archers soften a row, one blast kills two', () => {
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              { class: 'archer', element: 'fire' },
              { class: 'archer', element: 'water' },
              { class: 'mage', element: 'wind' },
            ],
            B: [
              { class: 'mage', element: 'earth' },
              { class: 'mage', element: 'fire' },
              { class: 'knight', element: 'water' },
            ],
          },
          placements: {
            A: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'back', col: 'center' },
            ],
            B: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'front', col: 'center' },
            ],
          },
        },
        7,
      ),
    );
    // Hand-verified (roster.test pins the same battle's mechanics): A's mage
    // finishes both 1-hp enemy mages with a single two-target blast.
    expect(log.events.filter((e) => e.type === 'UnitDied').length).toBe(3);
    expect(log).toMatchSnapshot();
  });

  it('golden #5: the poison duel — mirrored earth witches, death after the last action', () => {
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              { class: 'archer', element: 'fire' },
              { class: 'archer', element: 'water' },
              { class: 'witch', element: 'earth' },
            ],
            B: [
              { class: 'witch', element: 'earth' },
              { class: 'knight', element: 'earth' },
              { class: 'knight', element: 'water' },
            ],
          },
          placements: {
            A: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'back', col: 'center' },
            ],
            B: [
              { row: 'back', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'right' },
            ],
          },
        },
        5,
      ),
    );
    // Hand-verified (roster.test pins the tick order and the poison kill):
    // four PoisonTicked events after the final action, B:0 dying at 0.
    expect(log.events.filter((e) => e.type === 'PoisonTicked').length).toBe(4);
    expect(log.events.some((e) => e.type === 'PoisonTicked' && e.hpAfter === 0)).toBe(true);
    expect(log).toMatchSnapshot();
  });
});

describe('golden battles (story 1.10 — until-wipeout mode)', () => {
  it('golden #6: the multi-engagement wipe — knights grind mercs down over three engagements', () => {
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
              { class: 'mercenary', element: 'earth' },
              { class: 'mercenary', element: 'fire' },
              { class: 'mercenary', element: 'water' },
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
        0xdead,
        'wipeout',
      ),
    );
    // Hand-verified: mercs take 2 × 20 per engagement (110 → 70 → 30 → wiped
    // in engagement 3); knights take 2 × 12 (140 → 68). Winner A, 48% vs 0%.
    expect(log.events.filter((e) => e.type === 'EngagementEnded').length).toBe(3);
    const verdict = log.events[log.events.length - 1];
    expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 48, B: 0 } });
    expect(log).toMatchSnapshot();
  });

  it('golden #7: the cap fallback — a healing equilibrium runs all five engagements, then FR18 judges', () => {
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
        'wipeout',
      ),
    );
    // Hand-verified: golden #1's comp in wipeout settles into a steady state —
    // the damaged cleric heals 24 → 90 and is beaten back to 24 every
    // engagement (clerics at AGI 10 act before knights at AGI 8), so nobody
    // ever wipes. The BALANCE.engagementCap (5) fires and FR18 judges A ahead.
    expect(log.events.filter((e) => e.type === 'EngagementEnded').length).toBe(BALANCE.engagementCap);
    expect(log.events.some((e) => e.type === 'UnitDied')).toBe(false);
    const verdict = log.events[log.events.length - 1];
    expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 99, B: 75 } });
    expect(log).toMatchSnapshot();
  });

  it('golden #8: persisting poison — the earth-witch duel across engagements (FR19 Witch synergy)', () => {
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              { class: 'archer', element: 'fire' },
              { class: 'archer', element: 'water' },
              { class: 'witch', element: 'earth' },
            ],
            B: [
              { class: 'witch', element: 'earth' },
              { class: 'knight', element: 'earth' },
              { class: 'knight', element: 'water' },
            ],
          },
          placements: {
            A: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'back', col: 'center' },
            ],
            B: [
              { row: 'back', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'right' },
            ],
          },
        },
        5,
        'wipeout',
      ),
    );
    // Hand-verified: golden #5's comp in wipeout runs exactly 3 engagements.
    // The witches poison each other's sides (A:2 dots B:0/B:1/B:2, B:0 dots
    // A:1/A:2); the status persists between engagements and ticks 7 × 15 dmg
    // across the natural engagement ends. B's witch falls to the mutual dots,
    // but her knights (ending at 118/103 HP) wipe side A in engagement 3 —
    // verdict B, 60% vs 0%. (wipeout.test.ts pins the structural properties;
    // this snapshot pins the exact log.)
    expect(log.events.filter((e) => e.type === 'EngagementEnded').length).toBe(3);
    expect(log.events.filter((e) => e.type === 'PoisonTicked').length).toBe(7);
    expect(log.events[log.events.length - 1]).toEqual({ type: 'BattleEnded', winner: 'B', hpPct: { A: 0, B: 60 } });
    expect(log).toMatchSnapshot();
  });
});
