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
    armies: {
      A: [
        { class: 'knight', element: 'fire' },
        { class: 'archer', element: 'water' },
        { class: 'mage', element: 'wind' },
      ],
      B: [
        { class: 'witch', element: 'earth' },
        { class: 'cleric', element: 'fire' },
        { class: 'mercenary', element: 'water' },
      ],
    },
    placements: {
      A: [
        { row: 'front', col: 'left' },
        { row: 'mid', col: 'center' },
        { row: 'back', col: 'right' },
      ],
      B: [
        { row: 'front', col: 'center' },
        { row: 'back', col: 'left' },
        { row: 'back', col: 'right' },
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

  it('rejects wipeout mode until story 1.10 (honest error, not a wrong answer)', () => {
    expectViolation({ ...validSetup(), mode: 'wipeout' }, 'mode-not-implemented', /wipeout.*1\.10/);
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

  it('rejects wrong army size, naming the side', () => {
    const s = validSetup();
    s.armies.A = s.armies.A.slice(0, 2);
    s.placements.A = s.placements.A.slice(0, 2);
    expectViolation(s, 'wrong-army-size', /A/);
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
