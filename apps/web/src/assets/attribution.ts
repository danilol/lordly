import type { UnitClass } from '@lordly/engine';

// Art attribution manifest (story 2.1, FR31): the single in-repo record of
// every third-party art pack this game redistributes, and the data source the
// Credits scene (story 2.4) will render from. The repo is public — any pack
// listed here MUST carry a license that permits redistribution; the manifest
// test (apps/web/test/attribution.test.ts) enforces that gate.

export interface ArtPackAttribution {
  /** Pack name as published. */
  pack: string;
  author: string;
  /** Where the pack was obtained. */
  url: string;
  /** SPDX-style license id — must be in REDISTRIBUTABLE_LICENSES. */
  license: string;
  licenseName: string;
  licenseUrl: string;
  /** Files in this repo derived from the pack. */
  assets: readonly string[];
  /** Which engine class each redistributed sprite came from (source tile path inside the pack). Partial: a pack may supply only some classes. */
  classSources: Partial<Record<UnitClass, string>>;
}

/** Licenses that permit redistribution in a public repo (FR31 bar). CC0 needs no attribution; CC-BY needs the credit this manifest + Credits scene provide. */
export const REDISTRIBUTABLE_LICENSES = ['CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0'] as const;

export const ART_ATTRIBUTIONS: readonly ArtPackAttribution[] = [
  {
    pack: 'Dungeon Crawl Stone Soup 32x32 tiles (crawl-tiles Oct-5-2010)',
    author: 'Crawl Stone Soup team (rltiles project); OpenGameArt upload by medicalstorm',
    url: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    license: 'CC0-1.0',
    licenseName: 'Creative Commons Zero 1.0 (public domain)',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    assets: ['apps/web/src/assets/units.png'],
    classSources: {
      knight: 'dc-mon/vault_guard.png',
      mercenary: 'dc-mon/deep_elf_fighter.png',
      archer: 'dc-mon/deep_elf_master_archer.png',
      mage: 'dc-mon/wizard.png',
      cleric: 'dc-mon/deep_elf_high_priest.png',
      witch: 'dc-mon/unique/psyche.png',
    },
  },
];
