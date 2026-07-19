import { describe, expect, it } from 'vitest';
import type { BattleEvent, UnitSnapshot } from '@lordly/engine';
import { createNarrationState, narrateEvent } from '../src/flow/narration';

const snap = (id: string, cls: string, name: string, hp: number): UnitSnapshot =>
  ({
    id,
    side: id.startsWith('A') ? 'A' : 'B',
    class: cls,
    element: 'fire',
    name,
    placement: { row: 'front', col: 'center' },
    hp,
    maxHp: hp + 20,
  }) as UnitSnapshot;

const started: BattleEvent = {
  type: 'BattleStarted',
  units: [
    snap('A:0', 'knight', 'Kain', 90),
    snap('B:1', 'archer', 'Lyra', 78),
    snap('B:2', 'cleric', 'Sela', 60),
    snap('A:2', 'witch', 'Morwen', 70),
    snap('B:0', 'mercenary', 'Brand', 40),
  ],
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

describe('narration builder — the Log panel text (AC7, AD-2; names from story 4.2)', () => {
  it('renders attacks as "Name (CODE)" with true before→after HP (FR37 — dossier §7 display)', () => {
    const { lines } = run([
      started,
      { type: 'UnitAttacked', source: 'A:0', kind: 'slash', targets: [{ unit: 'B:1', damage: 12, hpAfter: 66, outcome: 'hit' }] },
    ]);
    expect(lines).toEqual(['Kain (KNI) struck Lyra (ARC) for 12 — 78→66 HP']);
  });

  it('narrates a CRIT distinctly with the boosted damage (story 4.6)', () => {
    const { lines } = run([
      started,
      { type: 'UnitAttacked', source: 'A:0', kind: 'slash', targets: [{ unit: 'B:1', damage: 18, hpAfter: 60, outcome: 'crit' }] },
    ]);
    expect(lines).toEqual(['Kain (KNI) CRIT Lyra (ARC) for 18 — 78→60 HP']);
  });

  it('narrates a DODGE distinctly — no damage, no HP delta (story 4.6)', () => {
    const { lines } = run([
      started,
      { type: 'UnitAttacked', source: 'A:0', kind: 'slash', targets: [{ unit: 'B:1', damage: 0, hpAfter: 78, outcome: 'dodged' }] },
    ]);
    expect(lines).toEqual(['Kain (KNI) struck at Lyra (ARC) — dodged!']);
  });

  it('falls back to the pre-era "Class id" form for a NAMELESS roster (old snapshots render code-only)', () => {
    const nameless: BattleEvent = {
      type: 'BattleStarted',
      units: [{ ...snap('A:0', 'knight', '', 90), name: '' as string }, snap('B:1', 'archer', 'Lyra', 78)],
    };
    const { lines } = run([
      nameless,
      { type: 'UnitAttacked', source: 'A:0', kind: 'slash', targets: [{ unit: 'B:1', damage: 12, hpAfter: 66, outcome: 'hit' }] },
    ]);
    expect(lines).toEqual(['Knight A:0 struck Lyra (ARC) for 12 — 78→66 HP']);
  });

  it('reports the TRUE prior HP on overkill (damage exceeds HP removed), not hpAfter+damage', () => {
    const { lines } = run([
      started,
      { type: 'UnitAttacked', source: 'A:0', kind: 'slash', targets: [{ unit: 'B:0', damage: 22, hpAfter: 18, outcome: 'hit' }] }, // 40→18
      { type: 'UnitAttacked', source: 'A:0', kind: 'slash', targets: [{ unit: 'B:0', damage: 24, hpAfter: 0, outcome: 'hit' }] }, // overkill: true before is 18
    ]);
    expect(lines[1]).toBe('Kain (KNI) struck Brand (MER) for 24 — 18→0 HP');
  });

  it('narrates a blast as one line per struck target, in payload order', () => {
    const { lines } = run([
      started,
      {
        type: 'UnitAttacked',
        source: 'A:0',
        kind: 'blast',
        targets: [
          { unit: 'B:1', damage: 10, hpAfter: 68, outcome: 'hit' },
          { unit: 'B:2', damage: 10, hpAfter: 50, outcome: 'hit' },
        ],
      },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('Kain (KNI) struck Sela (CLE) for 10 — 60→50 HP');
  });

  it('narrates heals with effective amount and before→after', () => {
    const { lines } = run([
      started,
      { type: 'UnitAttacked', source: 'A:0', kind: 'slash', targets: [{ unit: 'B:0', damage: 22, hpAfter: 18, outcome: 'hit' }] },
      { type: 'UnitHealed', source: 'B:2', target: 'B:0', amount: 15, hpAfter: 33 },
    ]);
    expect(lines[1]).toBe('Sela (CLE) healed Brand (MER) for 15 — 18→33 HP');
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
      'Morwen (WIT) cast sleep on Lyra (ARC)',
      'Brand (MER) is confused — the action misfires!',
      "Morwen (WIT)'s action fizzles",
      'Lyra (ARC) sleeps through the turn',
      'Kain (KNI) waits',
      'Poison sears Brand (MER) for 6 — 40→34 HP',
      'Lyra (ARC) falls!',
    ]);
  });

  it('narrates the v4 members (story 4.2): StatusCleared now, Guard/LeaderFell arms ready for 4.5/4.7', () => {
    const { lines } = run([
      started,
      { type: 'StatusCleared', unit: 'B:1', spell: 'sleep' },
      { type: 'GuardRaised', unit: 'A:0' },
      { type: 'GuardEnded', unit: 'A:0' },
      { type: 'LeaderFell', side: 'B', unit: 'B:0' },
      { type: 'LeaderFell', side: 'A', unit: 'A:0' },
    ]);
    expect(lines).toEqual([
      'The sleep lifts from Lyra (ARC)',
      'Kain (KNI) stands guard',
      "Kain (KNI)'s guard ends",
      'Leader Brand (MER) has fallen — the enemy army falters',
      'Leader Kain (KNI) has fallen — your army falters',
    ]);
  });

  it('marks turn and engagement boundaries and the verdict (FR39a: the panel says Turn, the engine says pass)', () => {
    const { lines } = run([
      started,
      { type: 'PassStarted', pass: 2, actionsRemaining: { 'A:0': 1, 'B:1': 1, 'B:2': 1, 'A:2': 1, 'B:0': 1 } },
      { type: 'EngagementEnded', engagement: 1, hp: { 'A:0': 90, 'B:1': 78, 'B:2': 60, 'A:2': 70, 'B:0': 40 } },
      { type: 'BattleEnded', winner: 'A', hpPct: { A: 62, B: 0 } },
    ]);
    expect(lines).toEqual(['— Turn 2 —', '— Engagement 1 ended —', 'You won — 62% vs 0%']);
  });

  it('resyncs its HP ledger from EngagementEnded (the authoritative snapshot)', () => {
    const { lines } = run([
      started,
      { type: 'EngagementEnded', engagement: 1, hp: { 'A:0': 90, 'B:1': 30, 'B:2': 60, 'A:2': 70, 'B:0': 40 } },
      { type: 'UnitAttacked', source: 'A:0', kind: 'slash', targets: [{ unit: 'B:1', damage: 10, hpAfter: 20, outcome: 'hit' }] },
    ]);
    expect(lines[1]).toBe('Kain (KNI) struck Lyra (ARC) for 10 — 30→20 HP');
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
    narrateEvent(s0, { type: 'UnitAttacked', source: 'A:0', kind: 'slash', targets: [{ unit: 'B:1', damage: 12, hpAfter: 66, outcome: 'hit' }] });
    expect(s0.hp.get('B:1')).toBe(before);
  });
});
