import { describe, expect, it } from 'vitest';
import type { MatchSetup } from '@lordly/engine';
import { createStorage, DEFAULT_SETTINGS, HISTORY_KEY, SETTINGS_KEY } from '../src/flow/storage';
import type { HistoryEntry } from '../src/flow/storage';

/** A Map-backed fake of the two Storage methods the gateway uses. */
function fakeBackend(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe('web/storage gateway (story 2.3, AD-8)', () => {
  it('uses the versioned settings key exactly', () => {
    expect(SETTINGS_KEY).toBe('lordly.v1.settings');
  });

  it('returns defaults when nothing is stored', () => {
    const storage = createStorage(fakeBackend());
    expect(storage.loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips settings through save/load', () => {
    const backend = fakeBackend();
    const storage = createStorage(backend);
    storage.saveSettings({ ...DEFAULT_SETTINGS, battleSpeed: '2x' });
    expect(storage.loadSettings().battleSpeed).toBe('2x');
    expect(backend.map.has(SETTINGS_KEY)).toBe(true);
  });

  it('falls back to defaults on corrupt JSON — never throws', () => {
    const storage = createStorage(fakeBackend({ [SETTINGS_KEY]: '{not json' }));
    expect(storage.loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to defaults on an unexpected shape (wrong type, null, array)', () => {
    for (const bad of ['null', '[]', '42', '"speed"', '{"battleSpeed": 7}']) {
      const storage = createStorage(fakeBackend({ [SETTINGS_KEY]: bad }));
      expect(storage.loadSettings(), bad).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('sanitizes an unknown persisted speed id back to the default (forward-compat)', () => {
    const storage = createStorage(fakeBackend({ [SETTINGS_KEY]: JSON.stringify({ battleSpeed: '16x' }) }));
    expect(storage.loadSettings().battleSpeed).toBe(DEFAULT_SETTINGS.battleSpeed);
  });

  it('ignores unknown/older namespaces — never migrates them (AD-8)', () => {
    const backend = fakeBackend({ 'lordly.v0.settings': JSON.stringify({ battleSpeed: '2x' }), 'other.app': 'x' });
    const storage = createStorage(backend);
    expect(storage.loadSettings()).toEqual(DEFAULT_SETTINGS); // v0 ignored
    storage.saveSettings(DEFAULT_SETTINGS);
    expect(backend.map.get('lordly.v0.settings')).toBe(JSON.stringify({ battleSpeed: '2x' })); // untouched
  });

  it('survives a throwing backend (Safari-private-mode class) — load defaults, save is a no-op', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const storage = createStorage(throwing);
    expect(storage.loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => storage.saveSettings(DEFAULT_SETTINGS)).not.toThrow();
  });

  it('survives a missing backend entirely (node env — no window.localStorage)', () => {
    const storage = createStorage(undefined);
    expect(storage.loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => storage.saveSettings(DEFAULT_SETTINGS)).not.toThrow();
  });
});

/** A minimal-but-valid MatchSetup for history fixtures; `seed` varies entries. */
function setupFixture(seed: number): MatchSetup {
  return {
    seed,
    balanceVersion: 2,
    mode: 'single',
    armies: {
      A: [
        { class: 'knight', element: 'fire' },
        { class: 'knight', element: 'water' },
        { class: 'mage', element: 'wind' },
      ],
      B: [
        { class: 'archer', element: 'earth' },
        { class: 'cleric', element: 'fire' },
        { class: 'mage', element: 'water' },
      ],
    },
    placements: {
      A: [
        { row: 'front', col: 'left' },
        { row: 'front', col: 'center' },
        { row: 'back', col: 'left' },
      ],
      B: [
        { row: 'back', col: 'left' },
        { row: 'back', col: 'center' },
        { row: 'back', col: 'right' },
      ],
    },
  };
}

function entryFixture(seed: number, winner: HistoryEntry['winner'] = 'A'): HistoryEntry {
  return { setup: setupFixture(seed), winner, date: `2026-07-15T0${seed % 10}:00:00.000Z` };
}

describe('web/storage gateway — history (story 3.1, FR28/AD-8)', () => {
  it('uses the versioned history key exactly', () => {
    expect(HISTORY_KEY).toBe('lordly.v1.history');
  });

  it('returns [] when nothing is stored', () => {
    expect(createStorage(fakeBackend()).loadHistory()).toEqual([]);
  });

  it('round-trips an entry — the full MatchSetup, winner, and ISO date come back verbatim', () => {
    const storage = createStorage(fakeBackend());
    const entry = entryFixture(1, 'draw');
    storage.appendHistory(entry);
    expect(storage.loadHistory()).toEqual([entry]);
  });

  it('keeps entries NEWEST-FIRST (storage order = display order)', () => {
    const storage = createStorage(fakeBackend());
    storage.appendHistory(entryFixture(1));
    storage.appendHistory(entryFixture(2));
    storage.appendHistory(entryFixture(3));
    expect(storage.loadHistory().map((e) => e.setup.seed)).toEqual([3, 2, 1]);
  });

  it('caps at 10: the 11th append evicts the OLDEST, order preserved (AC2)', () => {
    const storage = createStorage(fakeBackend());
    for (let seed = 1; seed <= 11; seed++) storage.appendHistory(entryFixture(seed));
    const seeds = storage.loadHistory().map((e) => e.setup.seed);
    expect(seeds).toHaveLength(10);
    expect(seeds).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]); // seed 1 (oldest) evicted
  });

  it('degrades to [] on corrupt JSON or a non-array shape — never throws (AC5)', () => {
    for (const bad of ['{not json', '{"a":1}', '"x"', '42', 'null']) {
      const storage = createStorage(fakeBackend({ [HISTORY_KEY]: bad }));
      expect(storage.loadHistory(), bad).toEqual([]);
    }
  });

  it('drops INDIVIDUAL invalid entries and keeps the valid ones (AC5 — one bad record must not nuke the list)', () => {
    const good = entryFixture(5);
    const stored = JSON.stringify([
      good,
      { setup: null, winner: 'A', date: '2026-07-15' }, // null setup
      { winner: 'B', date: '2026-07-15' }, // missing setup
      { setup: setupFixture(6), winner: 'C', date: '2026-07-15' }, // invalid winner literal
      { setup: setupFixture(7), winner: 'B', date: 42 }, // non-string date
      'garbage',
      null,
    ]);
    const storage = createStorage(fakeBackend({ [HISTORY_KEY]: stored }));
    expect(storage.loadHistory()).toEqual([good]);
  });

  it('drops entries whose setup is object-shaped but structurally broken — validated to RENDER depth (AC5, review)', () => {
    // The exact AD-8 threat: hand-edited / cross-version / partially-written
    // records that pass a shallow "setup is an object" check but would throw
    // when the History scene reaches setup.armies.A. Each of these must drop,
    // NOT survive to crash the render.
    const good = entryFixture(5);
    const broken = [
      { setup: {}, winner: 'A', date: '2026-07-15T00:00:00.000Z' }, // no armies at all
      { setup: { armies: {} }, winner: 'A', date: '2026-07-15T00:00:00.000Z' }, // armies present, A/B missing
      { setup: { armies: { A: 'nope', B: [] } }, winner: 'A', date: '2026-07-15T00:00:00.000Z' }, // A not an array
      { setup: { armies: { A: [{ class: 'dragon', element: 'fire' }], B: [] } }, winner: 'A', date: '2026-07-15T00:00:00.000Z' }, // unknown class
      { setup: { armies: { A: [{ class: 'knight', element: 'plasma' }], B: [] } }, winner: 'A', date: '2026-07-15T00:00:00.000Z' }, // unknown element
    ];
    const storage = createStorage(fakeBackend({ [HISTORY_KEY]: JSON.stringify([good, ...broken]) }));
    expect(storage.loadHistory()).toEqual([good]);
  });

  it('drops an off-length army even when every unit is valid — the row layout is fixed-width (story 3.2 review)', () => {
    // `.every()` passes vacuously for length 0 or 4+; an off-length army would
    // overrun the History row's Replay button. The width gate drops it.
    const good = entryFixture(5);
    const tooMany = { ...setupFixture(6), armies: { A: [...setupFixture(6).armies.A, { class: 'knight', element: 'fire' }], B: setupFixture(6).armies.B } };
    const empty = { ...setupFixture(7), armies: { A: [], B: [] } };
    const stored = JSON.stringify([
      good,
      { setup: tooMany, winner: 'A', date: '2026-07-15T00:00:00.000Z' }, // 4 units on A
      { setup: empty, winner: 'A', date: '2026-07-15T00:00:00.000Z' }, // 0 units
    ]);
    const storage = createStorage(fakeBackend({ [HISTORY_KEY]: stored }));
    expect(storage.loadHistory()).toEqual([good]);
  });

  it('KEEPS a stale-balanceVersion entry — it must still DISPLAY (marked non-replayable, story 3.2)', () => {
    const stale: HistoryEntry = { ...entryFixture(8), setup: { ...setupFixture(8), balanceVersion: 1 } };
    const storage = createStorage(fakeBackend({ [HISTORY_KEY]: JSON.stringify([stale]) }));
    expect(storage.loadHistory()).toEqual([stale]); // render depth is sound; version is 3.2's concern
  });

  it('appendHistory survives pre-existing corrupt storage — the new entry starts a clean list', () => {
    const storage = createStorage(fakeBackend({ [HISTORY_KEY]: '{not json' }));
    const entry = entryFixture(9);
    storage.appendHistory(entry);
    expect(storage.loadHistory()).toEqual([entry]);
  });

  it('never reads or touches foreign/older namespaces (AD-8)', () => {
    const backend = fakeBackend({ 'lordly.v0.history': JSON.stringify([entryFixture(1)]), 'other.app': 'x' });
    const storage = createStorage(backend);
    expect(storage.loadHistory()).toEqual([]); // v0 ignored
    storage.appendHistory(entryFixture(2));
    expect(backend.map.get('lordly.v0.history')).toBe(JSON.stringify([entryFixture(1)])); // untouched
    expect(backend.map.get('other.app')).toBe('x');
  });

  it('survives a throwing or missing backend — load [] and append is a no-op (AC5)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(createStorage(throwing).loadHistory()).toEqual([]);
    expect(() => createStorage(throwing).appendHistory(entryFixture(1))).not.toThrow();
    expect(createStorage(undefined).loadHistory()).toEqual([]);
    expect(() => createStorage(undefined).appendHistory(entryFixture(1))).not.toThrow();
  });
});
