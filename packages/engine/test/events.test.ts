import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import { LOG_VERSION } from '../src/types';
import type { BattleEvent, BattleLog, MatchSetup, UnitClass, UnitId } from '../src/types';

describe('BattleLog event envelope (AD-12)', () => {
  it('LOG_VERSION is 4 (the squad-era union extension — story 4.2, AD-15)', () => {
    expect(LOG_VERSION).toBe(4);
  });

  it('admits the full closed 16-member discriminated union (v4)', () => {
    const events: BattleEvent[] = [
      {
        type: 'BattleStarted',
        units: [
          {
            id: 'A:0',
            side: 'A',
            class: 'knight',
            element: 'fire',
            name: 'Kain',
            placement: { row: 'front', col: 'left' },
            hp: 140,
            maxHp: 140,
          },
        ],
      },
      { type: 'PassStarted', pass: 1, actionsRemaining: { 'A:0': 2, 'B:0': 1 } },
      { type: 'UnitAttacked', source: 'A:0', kind: 'slash', targets: [{ unit: 'B:1', damage: 36, hpAfter: 54, outcome: 'hit' }] },
      { type: 'UnitHealed', source: 'B:2', target: 'B:1', amount: 30, hpAfter: 84 },
      { type: 'StatusApplied', source: 'A:2', target: 'B:0', spell: 'sleep' },
      { type: 'ActionMisfired', unit: 'B:0' },
      { type: 'ActionFizzled', unit: 'B:0' },
      { type: 'ActionSkipped', unit: 'A:0', reason: 'asleep' },
      { type: 'PoisonTicked', unit: 'B:1', damage: 15, hpAfter: 39 },
      { type: 'UnitDied', unit: 'B:1' },
      { type: 'GuardRaised', unit: 'A:0' },
      { type: 'GuardEnded', unit: 'A:0' },
      { type: 'StatusCleared', unit: 'B:0', spell: 'sleep' },
      { type: 'LeaderFell', side: 'B', unit: 'B:0' },
      { type: 'EngagementEnded', engagement: 1, hp: { 'A:0': 140 } },
      { type: 'BattleEnded', winner: 'draw', hpPct: { A: 100, B: 100 } },
    ];

    const log: BattleLog = { logVersion: LOG_VERSION, events };
    expect(log.events).toHaveLength(16);
    const types = new Set(log.events.map((e) => e.type));
    expect(types.size).toBe(16); // every member of the closed set represented once
    for (const e of log.events) {
      if (e.type === 'StatusApplied') expect(['sleep', 'poison', 'weaken', 'confusion']).toContain(e.spell);
      if (e.type === 'UnitHealed') expect(e.amount).toBeGreaterThanOrEqual(0);
      if (e.type === 'PoisonTicked') expect(e.damage).toBeGreaterThan(0);
      if (e.type === 'StatusCleared') expect(['sleep', 'weaken', 'confusion']).toContain(e.spell); // poison persists — never cleared
    }
  });

  it('UnitAttacked admits the 4.7 Guard-redirect field and every 4.6 outcome (AD-15 — complete union now)', () => {
    const redirected: BattleEvent = {
      type: 'UnitAttacked',
      source: 'B:0',
      kind: 'arrow',
      redirectedFrom: 'A:2',
      targets: [{ unit: 'A:1', damage: 12, hpAfter: 0, outcome: 'crit' }],
    };
    expect(redirected.type).toBe('UnitAttacked');
    for (const outcome of ['hit', 'crit', 'dodged', 'missed'] as const) {
      const e: BattleEvent = { type: 'UnitAttacked', source: 'A:0', kind: 'staff', targets: [{ unit: 'B:0', damage: 0, hpAfter: 10, outcome }] };
      expect(e).toBeDefined();
    }
  });

  it('rejects non-members of the closed union (compile-time)', () => {
    // @ts-expect-error — 'UnitTeleported' is not a BattleEvent type
    const bad: BattleEvent = { type: 'UnitTeleported' };
    expect(bad).toBeDefined();
  });
});

/** A slot-legal named 5-unit wipeout setup with a witch, tuned to survive engagement 1 (StatusCleared coverage). */
function wipeoutSetup(seed: number): MatchSetup {
  return {
    seed,
    balanceVersion: BALANCE.version,
    mode: 'wipeout',
    tactics: { A: 'autonomous', B: 'autonomous' },
    leaders: { A: 0, B: 0 },
    armies: {
      A: [
        { class: 'witch', element: 'fire', name: 'Morwen' }, // fire → weaken casts
        { class: 'knight', element: 'water', name: 'Kain' },
        { class: 'knight', element: 'earth', name: 'Aldric' },
        { class: 'cleric', element: 'wind', name: 'Sela' },
        { class: 'knight', element: 'fire', name: 'Ulric' },
      ],
      B: [
        { class: 'knight', element: 'earth', name: 'Gerhart' },
        { class: 'knight', element: 'fire', name: 'Roland' },
        { class: 'knight', element: 'water', name: 'Konrad' },
        { class: 'cleric', element: 'wind', name: 'Ithil' },
        { class: 'knight', element: 'earth', name: 'Falk' },
      ],
    },
    placements: {
      A: [
        { row: 'back', col: 'center' },
        { row: 'front', col: 'left' },
        { row: 'front', col: 'center' },
        { row: 'back', col: 'left' },
        { row: 'front', col: 'right' },
      ],
      B: [
        { row: 'front', col: 'left' },
        { row: 'front', col: 'center' },
        { row: 'front', col: 'right' },
        { row: 'back', col: 'center' },
        { row: 'mid', col: 'center' },
      ],
    },
  };
}

describe('the 4.2 emissions (AC4 — kind/outcome, actionsRemaining, StatusCleared)', () => {
  const log = resolveBattle(wipeoutSetup(1234));
  const roster = new Map<UnitId, UnitClass>();
  const started = log.events[0];
  if (started?.type === 'BattleStarted') for (const u of started.units) roster.set(u.id, u.class);

  const EXPECTED_KIND: Record<UnitClass, string> = {
    knight: 'slash',
    mercenary: 'slash',
    archer: 'arrow',
    mage: 'blast',
    cleric: 'staff',
    witch: 'staff', // unreachable in 4.2 (witches cast, never strike) — the map stays total
  };

  it('every UnitAttacked carries the class-derived kind and unconditional outcome "hit" (no 4.6 draws yet)', () => {
    const attacks = log.events.filter((e) => e.type === 'UnitAttacked');
    expect(attacks.length).toBeGreaterThan(0);
    for (const e of attacks) {
      if (e.type !== 'UnitAttacked') continue;
      expect(e.kind).toBe(EXPECTED_KIND[roster.get(e.source) as UnitClass]);
      expect(e.redirectedFrom).toBeUndefined(); // Guard interception is 4.7's
      for (const t of e.targets) expect(t.outcome).toBe('hit');
    }
  });

  it('every PassStarted snapshots per-unit remaining actions; pass 1 of engagement 1 equals the row budgets', () => {
    const passes = log.events.filter((e) => e.type === 'PassStarted');
    expect(passes.length).toBeGreaterThan(0);
    for (const e of passes) {
      if (e.type !== 'PassStarted') continue;
      expect(Object.keys(e.actionsRemaining).sort()).toEqual([...roster.keys()].sort());
      for (const n of Object.values(e.actionsRemaining)) expect(n).toBeGreaterThanOrEqual(0);
    }
    const first = passes[0];
    if (first?.type === 'PassStarted' && started?.type === 'BattleStarted') {
      for (const u of started.units) {
        expect(first.actionsRemaining[u.id], u.id).toBe(BALANCE.classes[u.class].actions[u.placement.row]);
      }
    }
  });

  it('between-engagement resets emit StatusCleared per actually-cleared status — never poison, never mid-engagement', () => {
    const cleared = log.events.filter((e) => e.type === 'StatusCleared');
    expect(cleared.length).toBeGreaterThan(0); // the fire witch weakens; weaken must visibly lift at the seam
    for (const e of cleared) {
      if (e.type !== 'StatusCleared') continue;
      expect(e.spell).not.toBe('poison');
    }
    // StatusCleared sits ONLY in the seam: after an EngagementEnded, before the next PassStarted.
    let inSeam = false;
    for (const e of log.events) {
      if (e.type === 'EngagementEnded') inSeam = true;
      else if (e.type === 'PassStarted') inSeam = false;
      else if (e.type === 'StatusCleared') expect(inSeam).toBe(true);
    }
  });

  it('a cleared status was actually ON the unit: every StatusCleared pairs with a prior un-lifted StatusApplied', () => {
    const active = new Map<string, Set<string>>();
    for (const e of log.events) {
      if (e.type === 'StatusApplied') {
        if (!active.has(e.target)) active.set(e.target, new Set());
        active.get(e.target)?.add(e.spell);
      }
      if (e.type === 'StatusCleared') {
        expect(active.get(e.unit)?.has(e.spell), `${e.unit} ${e.spell}`).toBe(true);
        active.get(e.unit)?.delete(e.spell);
      }
    }
  });
});
