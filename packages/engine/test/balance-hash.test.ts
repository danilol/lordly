import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { contentHash } from '../src/hash';

/**
 * AD-8 guard: editing balance data without bumping BALANCE.version fails CI.
 * Changing the data changes the content hash below; the fix is the deliberate
 * two-step — bump `version` in balance.ts AND pin the new hash here. The
 * structural assertions make silent re-pinning under the same version visible
 * in review: versions are contiguous history, and the newest must match.
 */
const EXPECTED_HASHES: Record<number, string> = {
  1: 'bfce425a',
  2: '19aeaa94', // story 3.0: rpsHunts (archer hunts casters) + blastAttenuation (wipeout-scoped ×3/4)
  3: 'b67d0f84', // story 4.2: slotBudget 5 + per-class sizeClass replace armySize (AD-1); engagementCap 10 (FR19)
  4: '6d243f05', // story 4.3: role + roleRelations replace rpsBeats/rpsHunts (AD-4); +5 small classes (berserker/phalanx/ninja/valkyrie/sorceress)
};

describe('balance-hash guard (AD-8)', () => {
  it('the balance content hash matches the pinned hash for the declared version', () => {
    const pinned = EXPECTED_HASHES[BALANCE.version];
    expect(pinned, `no pinned hash for balanceVersion ${BALANCE.version} — bump deliberately`).toBeDefined();
    expect(contentHash(BALANCE)).toBe(pinned);
  });

  it('BALANCE.version is the newest pinned version and the history is contiguous from 1', () => {
    const versions = Object.keys(EXPECTED_HASHES)
      .map(Number)
      .sort((a, b) => a - b);
    expect(versions[0]).toBe(1);
    expect(versions).toEqual(versions.map((_, i) => i + 1));
    expect(BALANCE.version).toBe(versions[versions.length - 1]);
  });
});
