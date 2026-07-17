import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { InvalidMatchSetupError, validateMatchSetup } from '../src/validate';
import type { MatchSetup } from '../src/types';

/** A minimal valid single-mode setup for mutation-based violation tests. */
function validSetup(): MatchSetup {
  return {
    seed: 12345,
    balanceVersion: BALANCE.version,
    mode: 'single',
    tactics: { A: 'autonomous', B: 'autonomous' },
    leaders: { A: 0, B: 0 },
    armies: {
      A: [
        { class: 'knight', element: 'fire', name: 'Kain' },
        { class: 'archer', element: 'water', name: 'Lyra' },
        { class: 'mage', element: 'wind', name: 'Aldous' },
        { class: 'mercenary', element: 'earth', name: 'Brand' },
        { class: 'cleric', element: 'water', name: 'Sela' },
      ],
      B: [
        { class: 'witch', element: 'earth', name: 'Morwen' },
        { class: 'cleric', element: 'fire', name: 'Ithil' },
        { class: 'mercenary', element: 'water', name: 'Dario' },
        { class: 'knight', element: 'wind', name: 'Gerhart' },
        { class: 'archer', element: 'fire', name: 'Vess' },
      ],
    },
    placements: {
      A: [
        { row: 'front', col: 'left' },
        { row: 'mid', col: 'center' },
        { row: 'back', col: 'right' },
        { row: 'front', col: 'right' },
        { row: 'back', col: 'center' },
      ],
      B: [
        { row: 'front', col: 'center' },
        { row: 'back', col: 'left' },
        { row: 'back', col: 'right' },
        { row: 'mid', col: 'left' },
        { row: 'mid', col: 'right' },
      ],
    },
  };
}

function expectViolation(setup: MatchSetup, violation: string, messagePart: string | RegExp) {
  let caught: unknown;
  try {
    validateMatchSetup(setup);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(InvalidMatchSetupError);
  const err = caught as InvalidMatchSetupError;
  expect(err.violation).toBe(violation);
  expect(err.message).toMatch(messagePart);
}

describe('validateMatchSetup (AC2, spine errors convention)', () => {
  it('accepts a valid single-mode setup', () => {
    expect(() => validateMatchSetup(validSetup())).not.toThrow();
  });

  it('rejects malformed runtime structure as InvalidMatchSetupError, never a raw TypeError', () => {
    // Runtime callers are not bound by the TS unions; null/undefined shapes
    // must surface as the engine's one typed error, not a bare TypeError.
    expectViolation(null as unknown as MatchSetup, 'not-an-object', /object/);
    expectViolation(undefined as unknown as MatchSetup, 'not-an-object', /object/);
    expectViolation({ ...validSetup(), armies: undefined as never }, 'not-an-object', /armies/);
    const nullUnit = validSetup();
    (nullUnit.armies.A as unknown[])[0] = null;
    expectViolation(nullUnit, 'unknown-class', /not an object/);
    const nullCell = validSetup();
    (nullCell.placements.B as unknown[])[1] = null;
    expectViolation(nullCell, 'out-of-grid', /not an object/);
  });

  it('accepts wipeout mode (story 1.10 — the multi-engagement loop is implemented)', () => {
    expect(() => validateMatchSetup({ ...validSetup(), mode: 'wipeout' })).not.toThrow();
  });

  it('rejects a non-uint32 seed, naming the value', () => {
    for (const seed of [-1, 1.5, 2 ** 32, NaN]) {
      expectViolation({ ...validSetup(), seed }, 'invalid-seed', String(seed));
    }
  });

  it('rejects a balanceVersion mismatch, naming both versions', () => {
    expectViolation({ ...validSetup(), balanceVersion: 999 }, 'balance-version-mismatch', /999/);
  });

  it('rejects an unknown mode', () => {
    const s = validSetup();
    (s as unknown as { mode: string }).mode = 'ranked';
    expectViolation(s, 'invalid-mode', /ranked/);
  });

  it('rejects a wrong slot total, naming the side, the budget, and the total (AD-1, story 4.2)', () => {
    const s = validSetup();
    s.armies.A = s.armies.A.slice(0, 4);
    s.placements.A = s.placements.A.slice(0, 4);
    expectViolation(s, 'wrong-slot-total', /A.*5.*4|A.*budget/);
  });

  it('rejects an over-budget army by SLOTS, not unit count (AD-1)', () => {
    const s = validSetup();
    s.armies.B = [...s.armies.B, { class: 'knight', element: 'fire', name: 'Ulric' }];
    s.placements.B = [...s.placements.B, { row: 'mid', col: 'left' }];
    expectViolation(s, 'wrong-slot-total', /B/);
  });

  it('rejects an unknown class, naming side and index', () => {
    const s = validSetup();
    (s.armies.B[1] as { class: string }).class = 'paladin';
    expectViolation(s, 'unknown-class', /B.*1|paladin/);
  });

  it('rejects an unknown element, naming side and index', () => {
    const s = validSetup();
    (s.armies.A[0] as { element: string }).element = 'void';
    expectViolation(s, 'unknown-element', /void/);
  });

  it('rejects an invalid or missing unit name, naming side and index (FR37, story 4.2)', () => {
    const empty = validSetup();
    (empty.armies.A[2] as { name: string }).name = '   ';
    expectViolation(empty, 'invalid-name', /A.*2/);
    const missing = validSetup();
    delete (missing.armies.B[1] as { name?: string }).name;
    expectViolation(missing, 'invalid-name', /B.*1/);
  });

  it('rejects a tactic outside ALL_TACTICS on either side (AD-9, story 4.2)', () => {
    const s = validSetup();
    (s as unknown as { tactics: { A: string; B: string } }).tactics.A = 'berserk';
    expectViolation(s, 'invalid-tactic', /berserk/);
    const missing = validSetup();
    delete (missing as unknown as { tactics?: unknown }).tactics;
    expectViolation(missing, 'invalid-tactic', /A/);
  });

  it('rejects a leader index that does not point into that side’s army (AD-9, story 4.2)', () => {
    for (const bad of [-1, 5, 1.5, NaN]) {
      const s = validSetup();
      s.leaders.B = bad;
      expectViolation(s, 'invalid-leader', /B/);
    }
    const missing = validSetup();
    delete (missing as unknown as { leaders?: unknown }).leaders;
    expectViolation(missing, 'invalid-leader', /A/);
  });

  it('rejects placements not parallel to armies, naming the side', () => {
    const s = validSetup();
    s.placements.B = s.placements.B.slice(0, 2);
    expectViolation(s, 'placements-mismatch', /B/);
  });

  it('rejects an out-of-grid placement, naming the offending cell', () => {
    const s = validSetup();
    (s.placements.A[2] as { row: string }).row = 'rear';
    expectViolation(s, 'out-of-grid', /rear/);
    const s2 = validSetup();
    (s2.placements.A[2] as { col: string }).col = 'middle';
    expectViolation(s2, 'out-of-grid', /middle/);
  });

  it('rejects two same-side units on one cell, naming side and cell', () => {
    const s = validSetup();
    s.placements.A[1] = { row: 'front', col: 'left' }; // same as A[0]
    expectViolation(s, 'overlapping-placement', /front.*left|left.*front/);
  });

  it('allows opposing sides to occupy mirror cells (grids are separate)', () => {
    const s = validSetup();
    s.placements.B[0] = { ...s.placements.A[0]! };
    // must relocate old B0 cell? B already had front/center; set B0 = front/left like A0 — legal.
    expect(() => validateMatchSetup(s)).not.toThrow();
  });
});
