import { describe, expect, it } from 'vitest';
import { BALANCE } from '@lordly/engine';
import type { MatchSetup } from '@lordly/engine';
import { HISTORY_EMPTY_LABEL, MODE_STANDARD_LABEL, MODE_WIPEOUT_LABEL, RESULT_DRAW_LABEL, RESULT_LOSE_LABEL, RESULT_WIN_LABEL } from '../src/config/constants';
import { formatHistoryRow } from '../src/flow/historyModel';
import type { HistoryEntry } from '../src/flow/storage';

/** A fixed setup fixture; only the fields the formatter reads matter here. */
const setup: MatchSetup = {
  seed: 7,
  balanceVersion: BALANCE.version, // tracks the engine — a future bump must not rot this fixture
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
      { class: 'witch', element: 'water' },
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

const entry = (winner: HistoryEntry['winner'], date = '2026-07-15T09:30:45.123Z'): HistoryEntry => ({ setup, winner, date });

describe('formatHistoryRow (story 3.1, FR28) — pure display model', () => {
  it('formats the ISO date as YYYY-MM-DD HH:MM deterministically (no locale APIs)', () => {
    expect(formatHistoryRow(entry('A')).dateLabel).toBe('2026-07-15 09:30');
  });

  it('passes a malformed date through raw rather than throwing or lying', () => {
    expect(formatHistoryRow(entry('A', 'not-a-date')).dateLabel).toBe('not-a-date');
    expect(formatHistoryRow(entry('A', '')).dateLabel).toBe('');
  });

  it("verdicts from side A's perspective, reusing the Result banner vocabulary verbatim (you are always side A — AD-11)", () => {
    expect(formatHistoryRow(entry('A')).verdictLabel).toBe(RESULT_WIN_LABEL);
    expect(formatHistoryRow(entry('B')).verdictLabel).toBe(RESULT_LOSE_LABEL);
    expect(formatHistoryRow(entry('draw')).verdictLabel).toBe(RESULT_DRAW_LABEL);
  });

  it('carries a machine outcome for styling, decoupled from the label copy (review: color must not string-match the banner)', () => {
    expect(formatHistoryRow(entry('A')).outcome).toBe('win');
    expect(formatHistoryRow(entry('B')).outcome).toBe('loss');
    expect(formatHistoryRow(entry('draw')).outcome).toBe('draw');
  });

  it("shows the battle mode via the Home toggle's own labels (PO amendment 2026-07-15: 'what I played' includes the mode)", () => {
    expect(formatHistoryRow(entry('A')).modeLabel).toBe(MODE_STANDARD_LABEL);
    const wipeout = { setup: { ...setup, mode: 'wipeout' as const }, winner: 'A' as const, date: '2026-07-15T09:30:45.123Z' };
    expect(formatHistoryRow(wipeout).modeLabel).toBe(MODE_WIPEOUT_LABEL);
    // Resilience: an odd stored mode reads as Standard rather than throwing.
    const odd = { setup: { ...setup, mode: 'weird' as never }, winner: 'A' as const, date: '2026-07-15T09:30:45.123Z' };
    expect(formatHistoryRow(odd).modeLabel).toBe(MODE_STANDARD_LABEL);
  });

  it('exposes both compositions in army order — yours is side A, the enemy side B', () => {
    const row = formatHistoryRow(entry('A'));
    expect(row.yourComp).toEqual(setup.armies.A);
    expect(row.enemyComp).toEqual(setup.armies.B);
  });

  it('pins the EXPERIENCE.md empty-state copy exactly', () => {
    expect(HISTORY_EMPTY_LABEL).toBe('No battles yet — play your first match.');
  });

  it('marks replayability by balanceVersion match — machine key, scene never re-derives (story 3.2, AD-8)', () => {
    expect(formatHistoryRow(entry('A')).replayable).toBe(true); // fixture carries the current version
    const stale = { setup: { ...setup, balanceVersion: 1 }, winner: 'A' as const, date: '2026-07-15T09:30:45.123Z' };
    expect(formatHistoryRow(stale).replayable).toBe(false);
    // A stale row still formats FULLY — display is never gated (EXPERIENCE.md:98).
    expect(formatHistoryRow(stale).verdictLabel).toBe(RESULT_WIN_LABEL);
    expect(formatHistoryRow(stale).yourComp).toEqual(setup.armies.A);
  });
});
