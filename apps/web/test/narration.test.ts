import { describe, expect, it } from 'vitest';
import type { BattleEvent, UnitSnapshot } from '@lordly/engine';
import { createNarrationState, narrateEvent } from '../src/flow/narration';

const snap = (id: string, cls: string, hp: number): UnitSnapshot =>
  ({ id, side: id.startsWith('A') ? 'A' : 'B', class: cls, element: 'fire', placement: { row: 'front', col: 'center' }, hp, maxHp: hp + 20 }) as UnitSnapshot;

const started: BattleEvent = {
  type: 'BattleStarted',
  units: [snap('A:0', 'knight', 90), snap('B:1', 'archer', 78), snap('B:2', 'cleric', 60), snap('A:2', 'witch', 70), snap('B:0', 'mercenary', 40)],
};

/** Runs a sequence of events, returning all lines plus the final state. */
function run(events: BattleEvent[]) {
  let state = createNarrationState();
  const lines: string[] = [];
  for (const event of events) {
    const out = narrateEvent(state, event);
    state = out.state;
    lines.push(...out.lines);
  }
  return { lines, state };
}

describe('narration builder — the Log panel text (AC7, AD-2)', () => {
  it('renders the spec example verbatim: attack with true before→after HP', () => {
    const { lines } = run([started, { type: 'UnitAttacked', source: 'A:0', targets: [{ unit: 'B:1', damage: 12, hpAfter: 66 }] }]);
    expect(lines).toEqual(['Knight A:0 struck Archer B:1 for 12 — 78→66 HP']);
  });

  it('reports the TRUE prior HP on overkill (damage exceeds HP removed), not hpAfter+damage', () => {
    const { lines } = run([
      started,
      { type: 'UnitAttacked', source: 'A:0', targets: [{ unit: 'B:0', damage: 22, hpAfter: 18 }] }, // 40→18
      { type: 'UnitAttacked', source: 'A:0', targets: [{ unit: 'B:0', damage: 24, hpAfter: 0 }] }, // overkill: true before is 18
    ]);
    expect(lines[1]).toBe('Knight A:0 struck Mercenary B:0 for 24 — 18→0 HP');
  });

  it('narrates a blast as one line per struck target, in payload order', () => {
    const { lines } = run([
      started,
      {
        type: 'UnitAttacked',
        source: 'A:0',
        targets: [
          { unit: 'B:1', damage: 10, hpAfter: 68 },
          { unit: 'B:2', damage: 10, hpAfter: 50 },
        ],
      },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('Knight A:0 struck Cleric B:2 for 10 — 60→50 HP');
  });

  it('narrates heals with effective amount and before→after', () => {
    const { lines } = run([
      started,
      { type: 'UnitAttacked', source: 'A:0', targets: [{ unit: 'B:0', damage: 22, hpAfter: 18 }] },
      { type: 'UnitHealed', source: 'B:2', target: 'B:0', amount: 15, hpAfter: 33 },
    ]);
    expect(lines[1]).toBe('Cleric B:2 healed Mercenary B:0 for 15 — 18→33 HP');
  });

  it('narrates statuses, misfires, fizzles, sleeps, poison, deaths, and skips silent events', () => {
    const { lines } = run([
      started,
      { type: 'StatusApplied', source: 'A:2', target: 'B:1', spell: 'sleep' },
      { type: 'ActionMisfired', unit: 'B:0' },
      { type: 'ActionFizzled', unit: 'A:2' },
      { type: 'ActionSkipped', unit: 'B:1', reason: 'asleep' },
      { type: 'ActionSkipped', unit: 'A:0', reason: 'dead' }, // silent
      { type: 'ActionSkipped', unit: 'A:0', reason: 'idle' },
      { type: 'PoisonTicked', unit: 'B:0', damage: 6, hpAfter: 34 }, // 40→34
      { type: 'UnitDied', unit: 'B:1' },
    ]);
    expect(lines).toEqual([
      'Witch A:2 cast sleep on Archer B:1',
      'Mercenary B:0 is confused — the action misfires!',
      "Witch A:2's action fizzles",
      'Archer B:1 sleeps through the turn',
      'Knight A:0 waits',
      'Poison sears Mercenary B:0 for 6 — 40→34 HP',
      'Archer B:1 falls!',
    ]);
  });

  it('marks pass and engagement boundaries and the verdict', () => {
    const { lines } = run([
      started,
      { type: 'PassStarted', pass: 2 },
      { type: 'EngagementEnded', engagement: 1, hp: { 'A:0': 90, 'B:1': 78, 'B:2': 60, 'A:2': 70, 'B:0': 40 } },
      { type: 'BattleEnded', winner: 'A', hpPct: { A: 62, B: 0 } },
    ]);
    expect(lines).toEqual(['— Pass 2 —', '— Engagement 1 ended —', 'You won — 62% vs 0%']);
  });

  it('resyncs its HP ledger from EngagementEnded (the authoritative snapshot)', () => {
    const { lines } = run([
      started,
      { type: 'EngagementEnded', engagement: 1, hp: { 'A:0': 90, 'B:1': 30, 'B:2': 60, 'A:2': 70, 'B:0': 40 } },
      { type: 'UnitAttacked', source: 'A:0', targets: [{ unit: 'B:1', damage: 10, hpAfter: 20 }] },
    ]);
    expect(lines[1]).toBe('Knight A:0 struck Archer B:1 for 10 — 30→20 HP');
  });

  it('BattleStarted emits no line but seeds the ledger; a draw verdict reads as a draw', () => {
    const first = narrateEvent(createNarrationState(), started);
    expect(first.lines).toEqual([]);
    const draw = narrateEvent(first.state, { type: 'BattleEnded', winner: 'draw', hpPct: { A: 40, B: 40 } });
    expect(draw.lines).toEqual(['Draw — 40% vs 40%']);
  });

  it('is pure — narrating an event does not mutate the input state', () => {
    const s0 = narrateEvent(createNarrationState(), started).state;
    const before = s0.hp.get('B:1');
    narrateEvent(s0, { type: 'UnitAttacked', source: 'A:0', targets: [{ unit: 'B:1', damage: 12, hpAfter: 66 }] });
    expect(s0.hp.get('B:1')).toBe(before);
  });
});
