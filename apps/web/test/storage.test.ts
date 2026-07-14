import { describe, expect, it } from 'vitest';
import { createStorage, DEFAULT_SETTINGS, SETTINGS_KEY } from '../src/flow/storage';

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
