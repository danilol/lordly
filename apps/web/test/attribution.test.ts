import { describe, expect, it } from 'vitest';
import { ALL_CLASSES } from '@lordly/engine';
import { ART_ATTRIBUTIONS, REDISTRIBUTABLE_LICENSES } from '../src/assets/attribution';

/**
 * Real files under the two asset roots, enumerated by Vite's `import.meta.glob`
 * (NOT node:fs — this is a browser-pure package with no @types/node; the 2.4
 * rules-doc test hit the same wall). Keys are test-relative (`../src/assets/…`,
 * `../public/…`); manifest paths are repo-relative (`apps/web/…`), so we map
 * one to the other below.
 */
const EXISTING_ASSETS = new Set(
  Object.keys({
    ...import.meta.glob('../src/assets/*.png'),
    ...import.meta.glob('../public/*.png'),
  }),
);
const toTestRelative = (repoPath: string) => `../${repoPath.replace(/^apps\/web\//, '')}`;

describe('art attribution manifest (story 2.1, AC2 / FR31)', () => {
  it('has at least one pack recorded', () => {
    expect(ART_ATTRIBUTIONS.length).toBeGreaterThan(0);
  });

  it('every pack carries the full attribution record (author, pack, url, license)', () => {
    for (const pack of ART_ATTRIBUTIONS) {
      expect(pack.pack).toBeTruthy();
      expect(pack.author).toBeTruthy();
      expect(pack.url).toMatch(/^https:\/\//);
      expect(pack.license).toBeTruthy();
      expect(pack.licenseName).toBeTruthy();
      expect(pack.licenseUrl).toMatch(/^https:\/\//);
      // A pack with no listed assets is a manifest bug: every entry must say
      // WHAT this repo actually redistributes from it (review finding, 2.1).
      expect(pack.assets.length, `${pack.pack} lists redistributed assets`).toBeGreaterThan(0);
    }
  });

  it('every listed asset file actually EXISTS on disk (story 3.3 review: a manifest pointing at a missing/uncommitted file is a lie)', () => {
    // Repo-relative paths (e.g. apps/web/public/icon-192.png). This guards the
    // FR31 manifest against typos AND against a derived asset that was
    // generated but never committed — the exact icon-tracking gap the 3.3
    // review caught; now it fails the build instead of shipping broken.
    for (const pack of ART_ATTRIBUTIONS) {
      for (const asset of pack.assets) {
        expect(EXISTING_ASSETS.has(toTestRelative(asset)), `${asset} exists on disk`).toBe(true);
      }
    }
  });

  it('every pack license permits redistribution in a public repo — the FR31 gate', () => {
    for (const pack of ART_ATTRIBUTIONS) {
      expect(REDISTRIBUTABLE_LICENSES, `${pack.pack} license ${pack.license}`).toContain(pack.license);
    }
  });

  it('every engine class traces to a source asset in some pack', () => {
    for (const cls of ALL_CLASSES) {
      const supplier = ART_ATTRIBUTIONS.find((pack) => cls in pack.classSources);
      expect(supplier, `source for ${cls}`).toBeDefined();
      expect(supplier?.classSources[cls]).toBeTruthy();
    }
  });
});
