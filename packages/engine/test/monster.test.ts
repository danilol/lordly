import { test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import { footprintCells } from '../src/targeting';
import { ALL_CLASSES } from '../src/types';
import type { BattleEvent, MatchSetup, Unit, UnitId } from '../src/types';
import { matchSetupArb } from './arbitraries';

/**
 * Story 4.8 (device revision, 2026-07-20): the Golem is the wave's only
 * monster (dossier D-1b — the dragon is deferred). A monster is a SINGLE-cell
 * unit that costs 2 slots and, at PLACEMENT time, reserves all 8 king-move
 * neighbors (validated in validate.test.ts). In BATTLE it is an ordinary
 * one-cell participant with monster stats — the earlier 2-cell "footprint"
 * TARGETED/ACTS semantics were removed at Danilo's direction.
 */
function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, o: Partial<Pick<MatchSetup, 'seed' | 'mode' | 'tactics' | 'leaders'>> = {}): MatchSetup {
  return {
    seed: o.seed ?? 7,
    balanceVersion: BALANCE.version,
    mode: o.mode ?? 'single',
    tactics: o.tactics ?? { A: 'autonomous', B: 'autonomous' },
    leaders: o.leaders ?? { A: 0, B: 0 },
    ...partial,
  };
}

const u = (cls: Unit['class'], element: Unit['element'], name: string): Unit => ({ class: cls, element, name });
const byType = <T extends BattleEvent['type']>(log: { events: readonly BattleEvent[] }, type: T) =>
  log.events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

describe('footprintCells — every unit occupies exactly ONE cell (device revision)', () => {
  it('a monster occupies exactly its placement cell, same as a small', () => {
    for (const cls of ALL_CLASSES) {
      expect(footprintCells(cls, { row: 'mid', col: 'left' })).toEqual([{ row: 'mid', col: 'left' }]);
      expect(footprintCells(cls, { row: 'back', col: 'right' })).toEqual([{ row: 'back', col: 'right' }]);
    }
  });
});

describe('a monster is an ordinary single-cell battle participant', () => {
  it('a Golem at the front blocks its column: melee lands on it, never on a small in a deeper row behind it', () => {
    // A: one melee attacker (front-center reaches all 3 enemy columns) + 4
    // clerics. B: a Golem front-center + a knight at back-center (a deeper row
    // in the Golem's own column; mid-center is blocked at placement, so this
    // is the nearest a small can sit behind it). FR8's nearest-occupied-row
    // blockade must land every melee swing on the Golem, never the knight.
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              u('knight', 'fire', 'Kain'),
              u('cleric', 'wind', 'Sela'),
              u('cleric', 'fire', 'Nera'),
              u('cleric', 'earth', 'Petra'),
              u('cleric', 'water', 'Quinn'),
            ],
            B: [u('golem', 'earth', 'Ogham'), u('knight', 'fire', 'Hargen'), u('archer', 'water', 'Ulf'), u('archer', 'wind', 'Falk')],
          },
          placements: {
            A: [
              { row: 'front', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'right' },
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
            ],
            B: [
              { row: 'front', col: 'center' }, // the Golem — a front-row occupant
              { row: 'back', col: 'center' }, // a knight directly behind it (deeper row, same column) — must be shielded
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
            ],
          },
        },
        { leaders: { A: 0, B: 1 } }, // B:0 is the Golem — a monster can never be crowned
      ),
    );
    const meleeHits = byType(log, 'UnitAttacked').filter((e) => e.source === 'A:0');
    expect(meleeHits.length).toBeGreaterThan(0);
    for (const hit of meleeHits) {
      expect(hit.targets.map((t) => t.unit)).not.toContain('B:1'); // the shielded knight, never reached
      expect(hit.targets.map((t) => t.unit)).toEqual(['B:0']); // always the Golem
    }
  });

  it('a Golem acts from its cell with its row-appropriate action count and move', () => {
    // Golem front-center → 2 front-row actions, all 'slash'. (No more
    // anchor/rear distinction — it acts from its single cell like any unit.)
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [u('golem', 'earth', 'Ogham'), u('cleric', 'fire', 'Nessa'), u('cleric', 'water', 'Olwen'), u('cleric', 'earth', 'Petra')],
            B: [u('knight', 'fire', 'H'), u('knight', 'water', 'U'), u('archer', 'earth', 'F'), u('archer', 'wind', 'D'), u('cleric', 'fire', 'B')],
          },
          placements: {
            A: [
              { row: 'front', col: 'center' },
              { row: 'back', col: 'left' },
              { row: 'back', col: 'center' },
              { row: 'back', col: 'right' },
            ],
            B: [
              { row: 'front', col: 'left' },
              { row: 'front', col: 'right' },
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'back', col: 'center' },
            ],
          },
        },
        { leaders: { A: 1, B: 0 } }, // A:0 is the Golem
      ),
    );
    const firstPass = byType(log, 'PassStarted')[0];
    expect(firstPass?.actionsRemaining['A:0']).toBe(BALANCE.classes.golem.actions.front);
    const golemStrikes = byType(log, 'UnitAttacked').filter((e) => e.source === 'A:0');
    expect(golemStrikes.length).toBe(BALANCE.classes.golem.actions.front);
    for (const s of golemStrikes) expect(s.kind).toBe(BALANCE.classes.golem.moves.front);
  });
});

/**
 * Property tests over ARBITRARY monster armies (matchSetupArb): broad
 * invariants a single hand-built fixture can't exhaustively prove.
 */
describe('monster invariants hold across ARBITRARY battles (matchSetupArb)', () => {
  let sawMonster = false;
  let sawTwoMonsterSide = false;

  // Explicit 20s timeouts on both properties below (story 5.0): each resolves
  // ~100 arbitrary full battles and brushes Vitest's 5s default under
  // v8-instrumented coverage + parallel project load (the pnpm-coverage flake,
  // deferred-work 2026-07-20 — this file's duplicate-target property was the
  // recorded offender) — a load flake, not a slow assertion.
  test.prop([matchSetupArb])(
    'every UnitAttacked target list has no duplicate unit id (a monster in a blast row is hit exactly once)',
    (s) => {
      for (const side of ['A', 'B'] as const) {
        const count = s.armies[side].filter((unit) => BALANCE.classes[unit.class].sizeClass === 'monster').length;
        if (count >= 1) sawMonster = true;
        if (count === 2) sawTwoMonsterSide = true;
      }
      const log = resolveBattle(s);
      for (const e of log.events) {
        if (e.type !== 'UnitAttacked') continue;
        const ids = e.targets.map((t) => t.unit);
        expect(new Set(ids).size, JSON.stringify(e)).toBe(ids.length);
      }
    },
    20_000,
  );

  it('the generated cases above actually exercised monster armies, incl. a 2-monster side (branch reachability)', () => {
    expect(sawMonster, 'no monster observed across the whole matchSetupArb property run').toBe(true);
    expect(sawTwoMonsterSide, 'no 2-monster side observed across the whole matchSetupArb property run').toBe(true);
  });

  test.prop([matchSetupArb])(
    'every unit id referenced anywhere in the log belongs to the BattleStarted roster',
    (s) => {
      const log = resolveBattle(s);
      const started = log.events[0];
      const roster = new Set<UnitId>(started?.type === 'BattleStarted' ? started.units.map((unit) => unit.id) : []);
      for (const e of log.events) {
        const ids: UnitId[] = [];
        switch (e.type) {
          case 'UnitAttacked':
            ids.push(e.source, ...e.targets.map((t) => t.unit));
            if (e.redirectedFrom !== undefined) ids.push(e.redirectedFrom);
            break;
          case 'UnitHealed':
          case 'StatusApplied':
            ids.push(e.source, e.target);
            break;
          case 'ActionMisfired':
          case 'ActionFizzled':
          case 'ActionSkipped':
          case 'PoisonTicked':
          case 'UnitDied':
          case 'GuardRaised':
          case 'GuardEnded':
          case 'StatusCleared':
          case 'LeaderFell':
            ids.push(e.unit);
            break;
          default:
            break;
        }
        for (const id of ids) expect(roster.has(id), `${e.type}: ${id}`).toBe(true);
      }
    },
    20_000,
  );
});
