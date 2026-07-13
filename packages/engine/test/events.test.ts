import { describe, expect, it } from 'vitest';
import { LOG_VERSION } from '../src/types';
import type { BattleEvent, BattleLog } from '../src/types';

describe('BattleLog event envelope (AD-12)', () => {
  it('LOG_VERSION is 3 (union completed with the full closed set in story 1.6)', () => {
    expect(LOG_VERSION).toBe(3);
  });

  it('admits the full closed 12-member discriminated union', () => {
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
      { type: 'UnitAttacked', source: 'A:0', targets: [{ unit: 'B:1', damage: 36, hpAfter: 54 }] },
      { type: 'UnitHealed', source: 'B:2', target: 'B:1', amount: 30, hpAfter: 84 },
      { type: 'StatusApplied', source: 'A:2', target: 'B:0', spell: 'sleep' },
      { type: 'ActionMisfired', unit: 'B:0' },
      { type: 'ActionFizzled', unit: 'B:0' },
      { type: 'ActionSkipped', unit: 'A:0', reason: 'asleep' },
      { type: 'PoisonTicked', unit: 'B:1', damage: 15, hpAfter: 39 },
      { type: 'UnitDied', unit: 'B:1' },
      { type: 'EngagementEnded', engagement: 1, hp: { 'A:0': 140 } },
      { type: 'BattleEnded', winner: 'draw', hpPct: { A: 100, B: 100 } },
    ];

    const log: BattleLog = { logVersion: LOG_VERSION, events };
    expect(log.events).toHaveLength(12);
    const types = new Set(log.events.map((e) => e.type));
    expect(types.size).toBe(12); // every member of the closed set represented once
    for (const e of log.events) {
      if (e.type === 'StatusApplied') expect(['sleep', 'poison', 'weaken', 'confusion']).toContain(e.spell);
      if (e.type === 'UnitHealed') expect(e.amount).toBeGreaterThanOrEqual(0);
      if (e.type === 'PoisonTicked') expect(e.damage).toBeGreaterThan(0);
    }
  });

  it('rejects non-members of the closed union (compile-time)', () => {
    // @ts-expect-error — 'UnitTeleported' is not a BattleEvent type
    const bad: BattleEvent = { type: 'UnitTeleported' };
    expect(bad).toBeDefined();
  });
});
