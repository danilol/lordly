import { ALL_CLASSES, ALL_ELEMENTS, BALANCE } from '@lordly/engine';
import type { MatchSetup, Unit } from '@lordly/engine';
import { battleSpeed, DEFAULT_SPEED_ID } from '../config/constants';
import type { BattleSpeedId } from '../config/constants';

/**
 * The `web/storage` gateway (story 2.3, AD-8): the SOLE reader/writer of
 * localStorage in this codebase — no other module touches storage APIs, ever.
 * It owns the key manifest under the versioned `lordly.v1.*` namespace:
 * settings (story 2.3) and history (story 3.1, FR28).
 *
 * Resilience rules (AD-8 + NFR5): missing/corrupt/wrong-shape data → defaults,
 * never a throw (broken storage must not brick boot); a throwing backend
 * (Safari-private-mode class) degrades to in-memory defaults; unknown or
 * older namespaces (e.g. a hypothetical `lordly.v0.*`) are ignored, never
 * migrated silently. The backend is injectable so the gateway unit-tests in
 * node without jsdom.
 */

export const SETTINGS_KEY = 'lordly.v1.settings';
export const HISTORY_KEY = 'lordly.v1.history';

/** How many matches the on-device history remembers (FR28: the last 10). */
export const HISTORY_LIMIT = 10;

/**
 * One remembered match — EXACTLY the AD-8 shape: the full `MatchSetup`
 * (carrying seed and `balanceVersion`, so story 3.2 can re-resolve the whole
 * battle via determinism — FR20), the verdict, and an ISO 8601 date. There is
 * deliberately no `BattleLog` field and no derived extras (HP%, archetype):
 * storing a log is forbidden, and everything else is re-derivable.
 */
export interface HistoryEntry {
  setup: MatchSetup;
  winner: 'A' | 'B' | 'draw';
  date: string;
}

const CLASS_SET: ReadonlySet<string> = new Set(ALL_CLASSES);
const ELEMENT_SET: ReadonlySet<string> = new Set(ALL_ELEMENTS);

/**
 * A unit the History cards can render: a known class and element (AD-4
 * closed sets). Extra keys — including a missing pre-era `name` (story 4.2)
 * — are ignored: old nameless units still render, falling back to code-only
 * display.
 */
function isRenderableUnit(value: unknown): value is Unit {
  if (typeof value !== 'object' || value === null) return false;
  const unit = value as Record<string, unknown>;
  return typeof unit.class === 'string' && CLASS_SET.has(unit.class) && typeof unit.element === 'string' && ELEMENT_SET.has(unit.element);
}

/**
 * An army the History row can lay out (story 4.2): renderability is DISPLAY
 * TOLERANCE, never a legality gate — legality lives in validate.ts. Pre-era
 * 3-unit entries must still DISPLAY (marked non-replayable by the
 * balanceVersion check), so the bound is 1..slotBudget, NOT an exact-size
 * pin — an exact pin here silently dropped every pre-bump entry from
 * History (the story-4.2 recon catch). The upper bound still guards the
 * card layout against corrupt over-length arrays (story 3.2 review).
 */
function isRenderableArmy(value: unknown): value is Unit[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= BALANCE.slotBudget && value.every(isRenderableUnit);
}

/**
 * A setup the History scene can safely render: both armies are non-empty
 * arrays of at most `BALANCE.slotBudget` renderable units. Validated to the
 * DEPTH the renderer reaches (`setup.armies.{A,B}[].{class,element}`) AND a
 * bounded WIDTH — a corrupt over-length entry (which `.every()` would pass
 * vacuously) would overrun the Replay button off-canvas; drop it here
 * instead (story 3.2 review). Deliberately does NOT check
 * seed/placements/balanceVersion/tactics/leaders — those don't affect
 * display, and a stale-`balanceVersion` entry must still DISPLAY (marked
 * non-replayable, story 3.2); the engine re-validates the full setup at
 * replay time.
 */
function isRenderableSetup(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const armies = (value as Record<string, unknown>).armies;
  if (typeof armies !== 'object' || armies === null) return false;
  const { A, B } = armies as Record<string, unknown>;
  return isRenderableArmy(A) && isRenderableArmy(B);
}

/** Per-entry shape check (AD-8): one corrupt record drops, the list survives — validated to render depth. */
function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  const winnerOk = entry.winner === 'A' || entry.winner === 'B' || entry.winner === 'draw';
  return isRenderableSetup(entry.setup) && winnerOk && typeof entry.date === 'string';
}

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
  /** The remembered matches, NEWEST first (storage order = display order); [] on anything unreadable. */
  loadHistory(): HistoryEntry[];
  /** Prepends one entry and evicts past `HISTORY_LIMIT` (oldest first). Pre-existing corrupt data yields a clean one-entry list. */
  appendHistory(entry: HistoryEntry): void;
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
    loadHistory(): HistoryEntry[] {
      try {
        const raw = backend?.getItem(HISTORY_KEY);
        if (raw === null || raw === undefined) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isHistoryEntry);
      } catch {
        return []; // corrupt JSON or a throwing backend — history just reads empty
      }
    },
    appendHistory(entry: HistoryEntry): void {
      try {
        // Reuse the resilient read: corrupt prior data degrades to [] and the
        // new entry starts a clean list rather than throwing away the match.
        const next = [entry, ...this.loadHistory()].slice(0, HISTORY_LIMIT);
        backend?.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // Storage denied — this match just isn't remembered.
      }
    },
  };
}
