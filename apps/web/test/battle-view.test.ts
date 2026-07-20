import { describe, expect, it } from 'vitest';
import { ALL_COLS, ALL_ROWS, ALL_SIDES, BALANCE } from '@lordly/engine';
import type { BattleEvent, Element, MoveKind, Placement, Side, UnitClass, UnitId, UnitSnapshot } from '@lordly/engine';
import { BASE_WIDTH, BATTLE_BEAT_MS, ISO_BOARD } from '../src/config/constants';
import {
  ALL_ORIENTATIONS,
  DEFAULT_ORIENTATION,
  beatDurationMs,
  boardTiles,
  buildBeatSchedule,
  eventTrace,
  movePlate,
  unitTileCenter,
} from '../src/flow/battleView';
import type { BoardOrientation, MovePlateContext } from '../src/flow/battleView';

/** Every owner-local cell, for exhaustive transform checks. */
const ALL_CELLS: Placement[] = ALL_ROWS.flatMap((row) => ALL_COLS.map((col) => ({ row, col })));

const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;

describe('iso projection — invariants for every orientation (AC1/AC2)', () => {
  it('ships the \\ diagonal as the default orientation', () => {
    expect(DEFAULT_ORIENTATION).toBe('\\');
    expect(ALL_ORIENTATIONS).toContain('|');
    expect(ALL_ORIENTATIONS).toContain('/');
  });

  for (const orientation of ['|', '\\', '/'] as BoardOrientation[]) {
    describe(`orientation '${orientation}'`, () => {
      it('is a bijection per side — 9 distinct tile centers per board', () => {
        for (const side of ALL_SIDES) {
          const centers = ALL_CELLS.map((c) => key(unitTileCenter(side, c, orientation)));
          expect(new Set(centers).size).toBe(9);
        }
      });

      it('A and B occupy disjoint boards — no shared tile centers', () => {
        const a = new Set(ALL_CELLS.map((c) => key(unitTileCenter('A', c, orientation))));
        for (const c of ALL_CELLS) expect(a.has(key(unitTileCenter('B', c, orientation)))).toBe(false);
      });

      it('every unit cell lands exactly on one of its board tiles, and front cells land on front-flagged tiles', () => {
        for (const side of ALL_SIDES) {
          const tiles = boardTiles(side, orientation);
          expect(tiles).toHaveLength(9);
          const tileByKey = new Map(tiles.map((t) => [key(t), t]));
          for (const cell of ALL_CELLS) {
            const tile = tileByKey.get(key(unitTileCenter(side, cell, orientation)));
            expect(tile, `${side} ${cell.row}/${cell.col}`).toBeDefined();
            expect(tile?.front).toBe(cell.row === 'front');
          }
        }
      });

      it('flags exactly 3 front tiles per board', () => {
        for (const side of ALL_SIDES) {
          expect(boardTiles(side, orientation).filter((t) => t.front)).toHaveLength(3);
        }
      });
    });
  }
});

describe("iso projection — the shipped '\\' layout (AC1)", () => {
  const mean = (side: Side, cells: Placement[]) => {
    const pts = cells.map((c) => unitTileCenter(side, c, '\\'));
    return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  };

  it('places the enemy board upper-left and the player board lower-right', () => {
    const enemy = mean('B', ALL_CELLS);
    const player = mean('A', ALL_CELLS);
    expect(enemy.x).toBeLessThan(player.x);
    expect(enemy.y).toBeLessThan(player.y);
  });

  it('front rows meet along the clash gap — front rows are closer across boards than back rows', () => {
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const fronts = dist(
      mean(
        'A',
        ALL_COLS.map((col) => ({ row: 'front', col })),
      ),
      mean(
        'B',
        ALL_COLS.map((col) => ({ row: 'front', col })),
      ),
    );
    const backs = dist(
      mean(
        'A',
        ALL_COLS.map((col) => ({ row: 'back', col })),
      ),
      mean(
        'B',
        ALL_COLS.map((col) => ({ row: 'back', col })),
      ),
    );
    expect(fronts).toBeLessThan(backs);
  });

  it("CHIRALITY (2026-07-15 device report): the player's board is the placement ROTATED, never reflected — A's left column renders left of A's right", () => {
    // Danilo's regression case: knights front/left + front/center, mage
    // back/left rendered with the mage on the RIGHT — projection() was a
    // transpose (det −1, a reflection). Rotated correctly, everything the
    // player put in the left column stays on the screen-left of the right
    // column, front and back alike.
    for (const row of ALL_ROWS) {
      const left = unitTileCenter('A', { row, col: 'left' }, '\\');
      const right = unitTileCenter('A', { row, col: 'right' }, '\\');
      expect(left.x, `A ${row}: left col left of right col`).toBeLessThan(right.x);
    }
    // The mage stays on the knights' side: back/left sits screen-left of back/right.
    const mage = unitTileCenter('A', { row: 'back', col: 'left' }, '\\');
    const frontLeft = unitTileCenter('A', { row: 'front', col: 'left' }, '\\');
    expect(Math.abs(mage.x - frontLeft.x)).toBeLessThanOrEqual(ISO_BOARD.tileW); // same flank, one diagonal step per row
  });

  it("CHIRALITY: the enemy board faces us — B's left column renders on OUR screen-right (a facing army's left is our right)", () => {
    for (const row of ALL_ROWS) {
      const left = unitTileCenter('B', { row, col: 'left' }, '\\');
      const right = unitTileCenter('B', { row, col: 'right' }, '\\');
      expect(left.x, `B ${row}: left col right of right col (facing us)`).toBeGreaterThan(right.x);
    }
  });

  it("mirrors columns for side B (FR7): A's left lane faces B's right, closer than B's left", () => {
    const aFrontLeft = unitTileCenter('A', { row: 'front', col: 'left' }, '\\');
    const bFacing = unitTileCenter('B', { row: 'front', col: 'right' }, '\\');
    const bNonFacing = unitTileCenter('B', { row: 'front', col: 'left' }, '\\');
    const d = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    expect(d(aFrontLeft, bFacing)).toBeLessThan(d(aFrontLeft, bNonFacing));
  });

  it('keeps every tile inside the canvas width with the diamond extents included', () => {
    for (const side of ALL_SIDES) {
      for (const t of boardTiles(side, '\\')) {
        expect(t.x - ISO_BOARD.tileW / 2).toBeGreaterThanOrEqual(0);
        expect(t.x + ISO_BOARD.tileW / 2).toBeLessThanOrEqual(BASE_WIDTH);
      }
    }
  });

  it('uses the 2:1 diamond ratio from the UX spec', () => {
    expect(ISO_BOARD.tileW).toBe(2 * ISO_BOARD.tileH);
  });

  it('checker-flags tiles in an alternating pattern (side color vs neutral)', () => {
    // Adjacent tiles along a board edge alternate checker parity.
    for (const side of ALL_SIDES) {
      const tiles = boardTiles(side, '\\');
      const withChecker = tiles.filter((t) => t.checker).length;
      expect(withChecker).toBeGreaterThan(0);
      expect(withChecker).toBeLessThan(9);
    }
  });
});

describe('buildBeatSchedule — playback pacing', () => {
  const events: BattleEvent[] = [
    { type: 'BattleStarted', units: [] },
    { type: 'PassStarted', pass: 1, actionsRemaining: {} },
    { type: 'BattleEnded', winner: 'A', hpPct: { A: 100, B: 0 } },
  ];

  it('produces one beat per event, order preserved 1:1', () => {
    const beats = buildBeatSchedule(events, BATTLE_BEAT_MS);
    expect(beats.map((b) => b.event.type)).toEqual(['BattleStarted', 'PassStarted', 'BattleEnded']);
    expect(beats.map((b) => b.index)).toEqual([0, 1, 2]);
  });

  it('schedules beats back-to-back at the beat duration', () => {
    const beats = buildBeatSchedule(events, BATTLE_BEAT_MS);
    expect(beats[0]?.atMs).toBe(0);
    expect(beats[1]?.atMs).toBe(BATTLE_BEAT_MS);
    expect(beats[2]?.atMs).toBe(2 * BATTLE_BEAT_MS);
    expect(beats.every((b) => b.durationMs === BATTLE_BEAT_MS)).toBe(true);
  });

  it('handles an empty log without producing beats', () => {
    expect(buildBeatSchedule([], BATTLE_BEAT_MS)).toEqual([]);
  });
});

describe('beatDurationMs — the FR23 speed math (story 2.3 review: keep it pure and tested)', () => {
  it('divides the beat by the speed factor', () => {
    expect(beatDurationMs(BATTLE_BEAT_MS, 1)).toBe(BATTLE_BEAT_MS);
    expect(beatDurationMs(BATTLE_BEAT_MS, 2)).toBe(BATTLE_BEAT_MS / 2);
  });

  it('guards degenerate factors — non-positive plays at normal speed, and the result never floors to 0ms', () => {
    expect(beatDurationMs(BATTLE_BEAT_MS, 0)).toBe(BATTLE_BEAT_MS);
    expect(beatDurationMs(BATTLE_BEAT_MS, -3)).toBe(BATTLE_BEAT_MS);
    expect(beatDurationMs(1, 1000)).toBe(1);
  });
});

describe('eventTrace — the pure from→to seam (story 4.10, AC1/AC2)', () => {
  // The three events that carry a `source` read as a travel; every other event
  // is origin-less and MUST return null (AC2 — no fabricated travel).
  it('reads an attack as source → the whole struck target set, carrying the MoveKind (never the class)', () => {
    const attack: BattleEvent = {
      type: 'UnitAttacked',
      source: 'A:0',
      kind: 'arrow',
      targets: [{ unit: 'B:1', damage: 12, hpAfter: 8, outcome: 'hit' }],
    };
    expect(eventTrace(attack)).toEqual({ fromId: 'A:0', toIds: ['B:1'], kind: 'arrow' });
  });

  it('fans a blast out to every struck unit as multiple toIds', () => {
    const blast: BattleEvent = {
      type: 'UnitAttacked',
      source: 'B:0',
      kind: 'blast',
      targets: [
        { unit: 'A:0', damage: 10, hpAfter: 0, outcome: 'hit' },
        { unit: 'A:1', damage: 10, hpAfter: 5, outcome: 'crit' },
        { unit: 'A:2', damage: 0, hpAfter: 20, outcome: 'dodged' },
      ],
    };
    expect(eventTrace(blast)).toEqual({ fromId: 'B:0', toIds: ['A:0', 'A:1', 'A:2'], kind: 'blast' });
  });

  it('keeps the trace on the ORIGINAL target for a guarded hit — redirectedFrom (the guardian) does not retarget it (story 4.7)', () => {
    const guarded: BattleEvent = {
      type: 'UnitAttacked',
      source: 'A:0',
      kind: 'slash',
      redirectedFrom: 'B:2', // the guarding unit — attribution only, NOT a retarget
      targets: [{ unit: 'B:1', damage: 0, hpAfter: 40, outcome: 'hit' }],
    };
    // fromId stays the attacker, toIds stays the attacked unit — never the guardian.
    expect(eventTrace(guarded)).toEqual({ fromId: 'A:0', toIds: ['B:1'], kind: 'slash' });
  });

  it('reads a heal as healer → ally', () => {
    const heal: BattleEvent = { type: 'UnitHealed', source: 'A:0', target: 'A:1', amount: 15, hpAfter: 55 };
    expect(eventTrace(heal)).toEqual({ fromId: 'A:0', toIds: ['A:1'], kind: 'heal' });
  });

  it('reads a spell as caster → target, carrying the SpellKind (the scene styles the trace from this alone)', () => {
    const spell: BattleEvent = { type: 'StatusApplied', source: 'B:0', target: 'A:1', spell: 'sleep' };
    expect(eventTrace(spell)).toEqual({ fromId: 'B:0', toIds: ['A:1'], kind: 'spell', spell: 'sleep' });
  });

  it('carries every melee-style MoveKind through unchanged — bash and staff, not just slash (review: these were untested)', () => {
    for (const kind of ['bash', 'staff'] as const) {
      const hit: BattleEvent = {
        type: 'UnitAttacked',
        source: 'A:0',
        kind,
        targets: [{ unit: 'B:1', damage: 7, hpAfter: 3, outcome: 'hit' }],
      };
      expect(eventTrace(hit)).toEqual({ fromId: 'A:0', toIds: ['B:1'], kind });
    }
  });

  it('reads a self-heal honestly — source === target is a valid trace (the scene skips the zero-length travel)', () => {
    const selfHeal: BattleEvent = { type: 'UnitHealed', source: 'A:0', target: 'A:0', amount: 10, hpAfter: 60 };
    expect(eventTrace(selfHeal)).toEqual({ fromId: 'A:0', toIds: ['A:0'], kind: 'heal' });
  });

  it('returns null for every origin-less event — no source to trace from (AC2 honest rendering)', () => {
    const originless: BattleEvent[] = [
      { type: 'PoisonTicked', unit: 'A:1', damage: 5, hpAfter: 20 }, // victim only, no source (the crux of AC2)
      { type: 'UnitDied', unit: 'A:1' },
      { type: 'GuardRaised', unit: 'A:0' },
      { type: 'GuardEnded', unit: 'A:0' },
      { type: 'StatusCleared', unit: 'A:1', spell: 'poison' },
      { type: 'ActionSkipped', unit: 'A:1', reason: 'asleep' },
      { type: 'ActionFizzled', unit: 'A:0' },
      { type: 'ActionMisfired', unit: 'A:0' }, // the marker is on-unit; the redirected effect that FOLLOWS traces on its own
      { type: 'LeaderFell', side: 'A', unit: 'A:0' },
      { type: 'BattleStarted', units: [] },
      { type: 'PassStarted', pass: 1, actionsRemaining: {} },
      { type: 'EngagementEnded', engagement: 1, hp: {} },
      { type: 'BattleEnded', winner: 'A', hpPct: { A: 100, B: 0 } },
    ];
    for (const event of originless) expect(eventTrace(event), event.type).toBeNull();
  });
});

describe('movePlate — the FR39b ledger seam (story 4.11, D-3a: the ledger IS the move-name plate)', () => {
  /** A minimal roster snapshot for the plate's static-facts channel (class → element/row). */
  const snap = (id: UnitId, cls: UnitClass, element: Element, row: Placement['row']): UnitSnapshot => ({
    id,
    side: id.startsWith('A') ? 'A' : 'B',
    class: cls,
    element,
    name: 'Test',
    placement: { row, col: 'center' },
    hp: 100,
    maxHp: 100,
  });
  const ctx = (roster: UnitSnapshot[], actionsRemaining: Record<UnitId, number>): MovePlateContext => ({
    actionsRemaining,
    roster: new Map(roster.map((u) => [u.id, u])),
  });
  const strike = (source: UnitId, kind: MoveKind): BattleEvent => ({
    type: 'UnitAttacked',
    source,
    kind,
    targets: [{ unit: 'B:0', damage: 5, hpAfter: 10, outcome: 'hit' }],
  });

  it('names a slash with its display name and shifts the pips: snapshot 2 → 1 remaining AFTER this act, max from BALANCE', () => {
    // Knight front row: actions {front: 2} — the dossier D-3a example. Rendering
    // remaining = snapshot (unshifted, ●●) is the exact bug the story pins against.
    const c = ctx([snap('A:0', 'knight', 'fire', 'front')], { 'A:0': 2 });
    expect(movePlate(strike('A:0', 'slash'), c)).toEqual({ unitId: 'A:0', label: 'Sword Slash', remaining: 1, max: 2 });
  });

  it('depletes across passes — the budget is per ENGAGEMENT, refreshed snapshots only shrink (pass 2: snapshot 1 → 0 left)', () => {
    const c = ctx([snap('A:0', 'knight', 'fire', 'front')], { 'A:0': 1 });
    expect(movePlate(strike('A:0', 'slash'), c)).toEqual({ unitId: 'A:0', label: 'Sword Slash', remaining: 0, max: 2 });
  });

  it("flavors a blast by the actor's roster element (EXPERIENCE names 'Ice Blast' — the static-facts channel)", () => {
    const water = ctx([snap('B:1', 'mage', 'water', 'back')], { 'B:1': 2 });
    expect(movePlate(strike('B:1', 'blast'), water)?.label).toBe('Ice Blast');
    const fire = ctx([snap('B:1', 'mage', 'fire', 'back')], { 'B:1': 2 });
    expect(movePlate(strike('B:1', 'blast'), fire)?.label).toBe('Fire Blast');
    const wind = ctx([snap('B:1', 'mage', 'wind', 'back')], { 'B:1': 2 });
    expect(movePlate(strike('B:1', 'blast'), wind)?.label).toBe('Wind Blast');
    const earth = ctx([snap('B:1', 'mage', 'earth', 'back')], { 'B:1': 2 });
    expect(movePlate(strike('B:1', 'blast'), earth)?.label).toBe('Stone Blast');
  });

  it('names a heal and a spell (the FR16 spell names finally surface)', () => {
    const healer = ctx([snap('A:1', 'cleric', 'water', 'mid')], { 'A:1': 1 });
    const heal: BattleEvent = { type: 'UnitHealed', source: 'A:1', target: 'A:0', amount: 10, hpAfter: 60 };
    expect(movePlate(heal, healer)).toEqual({ unitId: 'A:1', label: 'Heal', remaining: 0, max: BALANCE.classes.cleric.actions.mid });

    const witch = ctx([snap('B:2', 'witch', 'wind', 'back')], { 'B:2': 2 });
    const spell: BattleEvent = { type: 'StatusApplied', source: 'B:2', target: 'A:0', spell: 'confusion' };
    expect(movePlate(spell, witch)).toEqual({ unitId: 'B:2', label: 'Confusion', remaining: 1, max: BALANCE.classes.witch.actions.back });
  });

  it('names a Guard raise by its tier from the BALANCE move table (Q4 default)', () => {
    const knight = ctx([snap('A:0', 'knight', 'fire', 'mid')], { 'A:0': 1 });
    expect(movePlate({ type: 'GuardRaised', unit: 'A:0' }, knight)?.label).toBe('Guard (half)');
    const phalanx = ctx([snap('A:1', 'phalanx', 'earth', 'front')], { 'A:1': 2 });
    expect(movePlate({ type: 'GuardRaised', unit: 'A:1' }, phalanx)?.label).toBe('Guard (full)');
  });

  it('shows a Fizzle plate — a fizzled action is a SPENT action', () => {
    const c = ctx([snap('A:0', 'witch', 'wind', 'back')], { 'A:0': 2 });
    expect(movePlate({ type: 'ActionFizzled', unit: 'A:0' }, c)).toEqual({ unitId: 'A:0', label: 'Fizzle', remaining: 1, max: 2 });
  });

  it('the misfire pair yields EXACTLY ONE plate — none on the marker, a normal one on the paired effect', () => {
    // The marker beat keeps its wiggle + "confused!" popup; the plate rides the
    // effect event, which carries the actual misfired move's kind (AD-2 —
    // payload-derived, no shell-side re-derivation of the move table). One
    // action, one plate, single decrement by construction.
    const c = ctx([snap('A:0', 'mercenary', 'fire', 'front')], { 'A:0': 1 });
    expect(movePlate({ type: 'ActionMisfired', unit: 'A:0' }, c)).toBeNull();
    // The paired effect (a strike on an ally) plates normally:
    expect(movePlate(strike('A:0', 'slash'), c)).toEqual({ unitId: 'A:0', label: 'Sword Slash', remaining: 0, max: 2 });
  });

  it('shows NO plate for skipped turns (Q3 default — the Zzz/waits popup already reads) or any no-actor event', () => {
    const c = ctx([snap('A:0', 'knight', 'fire', 'front')], { 'A:0': 2 });
    const noPlate: BattleEvent[] = [
      { type: 'ActionSkipped', unit: 'A:0', reason: 'asleep' },
      { type: 'ActionSkipped', unit: 'A:0', reason: 'idle' },
      { type: 'ActionSkipped', unit: 'A:0', reason: 'dead' },
      { type: 'PoisonTicked', unit: 'A:0', damage: 5, hpAfter: 20 },
      { type: 'UnitDied', unit: 'A:0' },
      { type: 'GuardEnded', unit: 'A:0' },
      { type: 'StatusCleared', unit: 'A:0', spell: 'poison' },
      { type: 'LeaderFell', side: 'A', unit: 'A:0' },
      { type: 'BattleStarted', units: [] },
      { type: 'PassStarted', pass: 1, actionsRemaining: {} },
      { type: 'EngagementEnded', engagement: 1, hp: {} },
      { type: 'BattleEnded', winner: 'A', hpPct: { A: 100, B: 0 } },
    ];
    for (const event of noPlate) expect(movePlate(event, c), event.type).toBeNull();
  });

  it('is defensive: an actor missing from the roster → null; a 0 snapshot clamps to 0 remaining, never negative', () => {
    const c = ctx([snap('A:0', 'knight', 'fire', 'front')], {});
    expect(movePlate(strike('B:9', 'slash'), c)).toBeNull(); // B:9 is not in the roster
    // Missing snapshot entry reads as 0 → remaining stays 0 (a dead unit reads 0 in the payload).
    expect(movePlate(strike('A:0', 'slash'), c)?.remaining).toBe(0);
  });
});
