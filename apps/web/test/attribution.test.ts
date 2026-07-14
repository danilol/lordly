import { describe, expect, it } from 'vitest';
import { ALL_CLASSES } from '@lordly/engine';
import { ART_ATTRIBUTIONS, REDISTRIBUTABLE_LICENSES } from '../src/assets/attribution';

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
