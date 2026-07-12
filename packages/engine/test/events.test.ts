import { describe, expect, it } from 'vitest';
import { LOG_VERSION } from '../src/types';
import type { BattleEvent, BattleLog } from '../src/types';

describe('BattleLog event envelope (AD-12)', () => {
  it('LOG_VERSION is a positive integer starting at 1', () => {
    expect(LOG_VERSION).toBe(1);
  });

  it('admits the five chassis event shapes as a closed discriminated union', () => {
    const events: BattleEvent[] = [
      {
        type: 'BattleStarted',
        units: [
          {
            id: 'A:0',
            side: 'A',
            class: 'knight',
            element: 'fire',
            placement: { row: 'front', col: 'left' },
            hp: 140,
            maxHp: 140,
          },
        ],
      },
      { type: 'PassStarted', pass: 1 },
      { type: 'ActionSkipped', unit: 'A:0', reason: 'idle' },
      { type: 'EngagementEnded', engagement: 1, hp: { 'A:0': 140 } },
      { type: 'BattleEnded', winner: 'draw', hpPct: { A: 100, B: 100 } },
    ];

    const log: BattleLog = { logVersion: LOG_VERSION, events };
    expect(log.events).toHaveLength(5);
    // Discriminated-union narrowing works on `type`
    for (const e of log.events) {
      if (e.type === 'ActionSkipped') expect(['dead', 'asleep', 'idle']).toContain(e.reason);
      if (e.type === 'BattleEnded') expect(['A', 'B', 'draw']).toContain(e.winner);
    }
  });

  it('rejects non-members of the closed union (compile-time)', () => {
    // @ts-expect-error — 'UnitTeleported' is not a BattleEvent type
    const bad: BattleEvent = { type: 'UnitTeleported' };
    expect(bad).toBeDefined();
  });
});
