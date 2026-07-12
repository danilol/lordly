import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { contentHash } from '../src/hash';

/**
 * AD-8 guard: editing balance data without bumping BALANCE.version fails CI.
 * Changing the data changes the content hash below; the fix is the deliberate
 * two-step — bump `version` in balance.ts AND pin the new hash here.
 */
const EXPECTED_HASHES: Record<number, string> = {
  1: 'bfce425a',
};

describe('balance-hash guard (AD-8)', () => {
  it('the balance content hash matches the pinned hash for the declared version', () => {
    const pinned = EXPECTED_HASHES[BALANCE.version];
    expect(pinned, `no pinned hash for balanceVersion ${BALANCE.version} — bump deliberately`).toBeDefined();
    expect(contentHash(BALANCE)).toBe(pinned);
  });
});
