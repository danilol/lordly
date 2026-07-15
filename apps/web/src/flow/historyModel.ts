import { BALANCE } from '@lordly/engine';
import type { Unit } from '@lordly/engine';
import { MODE_STANDARD_LABEL, MODE_WIPEOUT_LABEL, RESULT_DRAW_LABEL, RESULT_LOSE_LABEL, RESULT_WIN_LABEL } from '../config/constants';
import type { HistoryEntry } from './storage';

/**
 * Pure display model for the History scene (story 3.1, FR28) — the
 * rulesDoc/credits pattern: the formatting logic is real-tested here and the
 * scene stays a thin renderer of these row specs.
 */

/** Side A's outcome (you are always side A — AD-11); the scene keys color off THIS, never the label string. */
export type Outcome = 'win' | 'loss' | 'draw';

/** One rendered history row: what the scene draws, nothing it must derive. */
export interface HistoryRow {
  /** `YYYY-MM-DD HH:MM` from the entry's ISO date; a malformed date passes through raw. */
  dateLabel: string;
  /** Side A's verdict, verbatim from the Result banner vocabulary (you are always side A — AD-11). */
  verdictLabel: string;
  /** Machine outcome for styling — decoupled from `verdictLabel`'s copy so a banner rename can't miscolor a row. */
  outcome: Outcome;
  /**
   * Battle mode, in the Home toggle's own vocabulary (PO amendment
   * 2026-07-15: "what I played" includes the mode). Read from the stored
   * setup — no schema change. Opponent type (vs AI / PvP) is deliberately
   * NOT here: PvP doesn't exist, so every pre-link-play entry is provably
   * vs AI ("field absent = AI" backfills correctly forever); the opponent
   * field is the link-play epic's design item (see deferred-work.md).
   */
  modeLabel: string;
  /**
   * True iff the entry's `balanceVersion` matches the running engine — the
   * AD-8 replay gate (story 3.2). The scene keys the Replay button off THIS;
   * a stale entry still displays fully, marked non-replayable.
   */
  replayable: boolean;
  yourComp: readonly Unit[];
  enemyComp: readonly Unit[];
}

/** Strict `YYYY-MM-DDTHH:MM…` prefix — matched by slicing, no Date/locale APIs (device-deterministic). */
const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Maps one stored entry to its display row. Pure; never throws on odd data. */
export function formatHistoryRow(entry: HistoryEntry): HistoryRow {
  const dateLabel = ISO_PREFIX.test(entry.date) ? `${entry.date.slice(0, 10)} ${entry.date.slice(11, 16)}` : entry.date;
  const outcome: Outcome = entry.winner === 'draw' ? 'draw' : entry.winner === 'A' ? 'win' : 'loss';
  const verdictLabel = outcome === 'draw' ? RESULT_DRAW_LABEL : outcome === 'win' ? RESULT_WIN_LABEL : RESULT_LOSE_LABEL;
  // Strict equality so an odd stored mode degrades to Standard, never throws.
  const modeLabel = entry.setup.mode === 'wipeout' ? MODE_WIPEOUT_LABEL : MODE_STANDARD_LABEL;
  const replayable = entry.setup.balanceVersion === BALANCE.version;
  return { dateLabel, verdictLabel, outcome, modeLabel, replayable, yourComp: entry.setup.armies.A, enemyComp: entry.setup.armies.B };
}
