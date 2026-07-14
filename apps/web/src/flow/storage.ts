import { battleSpeed, DEFAULT_SPEED_ID } from '../config/constants';
import type { BattleSpeedId } from '../config/constants';

/**
 * The `web/storage` gateway (story 2.3, AD-8): the SOLE reader/writer of
 * localStorage in this codebase — no other module touches storage APIs, ever.
 * It owns the key manifest under the versioned `lordly.v1.*` namespace; this
 * story ships exactly ONE key (settings). History keys (`HistoryEntry`,
 * replay gating) arrive with Epic 3 and live behind this same gateway.
 *
 * Resilience rules (AD-8 + NFR5): missing/corrupt/wrong-shape data → defaults,
 * never a throw (broken storage must not brick boot); a throwing backend
 * (Safari-private-mode class) degrades to in-memory defaults; unknown or
 * older namespaces (e.g. a hypothetical `lordly.v0.*`) are ignored, never
 * migrated silently. The backend is injectable so the gateway unit-tests in
 * node without jsdom.
 */

export const SETTINGS_KEY = 'lordly.v1.settings';

/** Player preferences. Extensible — later settings (e.g. the deferred theme toggle) add fields here, same key. */
export interface Settings {
  battleSpeed: BattleSpeedId;
}

export const DEFAULT_SETTINGS: Settings = { battleSpeed: DEFAULT_SPEED_ID };

/** The two Storage methods the gateway uses — injectable for tests. */
export type StorageBackend = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * The guarded browser default; undefined in node/test environments. The
 * getter access itself is wrapped: merely READING `window.localStorage`
 * throws a SecurityError in blocked-storage contexts (sandboxed iframes,
 * hardened privacy settings) — the one path the load/save try/catches can't
 * reach (review: the gateway's contract is "never throw", including here).
 */
function defaultBackend(): StorageBackend | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export interface WebStorage {
  loadSettings(): Settings;
  saveSettings(next: Settings): void;
}

export function createStorage(backend: StorageBackend | undefined = defaultBackend()): WebStorage {
  return {
    loadSettings(): Settings {
      try {
        const raw = backend?.getItem(SETTINGS_KEY);
        if (raw === null || raw === undefined) return DEFAULT_SETTINGS;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return DEFAULT_SETTINGS;
        const speed = (parsed as Record<string, unknown>).battleSpeed;
        // battleSpeed() sanitizes unknown/stale ids back to the default entry (forward-compat).
        if (typeof speed !== 'string') return DEFAULT_SETTINGS;
        return { battleSpeed: battleSpeed(speed).id };
      } catch {
        return DEFAULT_SETTINGS; // corrupt JSON or a throwing backend — never brick boot
      }
    },
    saveSettings(next: Settings): void {
      try {
        backend?.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Storage denied (quota, private mode) — preferences just don't persist this session.
      }
    },
  };
}
