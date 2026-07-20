import { nextInt } from './rng';
import type { Stream } from './rng';
import type { UnitClass } from './types';

/**
 * Soldier name generation (FR37, dossier §7, story 4.2).
 *
 * Names are FLAVOR: no gameplay effect, and this module is deliberately
 * SEPARATE from `balance.ts` so the tables sit OUTSIDE `contentHash(BALANCE)`
 * (AD-4/AD-8) — editing a name never invalidates history or forces a
 * balanceVersion bump. Edits to the lists below are free; keep them
 * OB64-adjacent in register and unique within each list.
 */

/** A name table's key. 'c' (construct) joins 'm'/'f' in story 4.8 for the Golem — it has no sex (dossier §1 row: '—'). */
export type NameSex = 'm' | 'f' | 'c';

/**
 * Which table each class draws from (dossier D-1f):
 * male — Knight/Mercenary/Wizard; female — Archer/Cleric/Witch.
 * Story 4.3's new classes extend this map; story 4.8's Golem draws from the
 * separate construct-designation list (dossier §7) via the `'c'` key.
 */
export const CLASS_SEX: Record<UnitClass, NameSex> = {
  knight: 'm',
  mercenary: 'm',
  mage: 'm',
  archer: 'f',
  cleric: 'f',
  witch: 'f',
  // Story 4.3 (D-1f gender split): Berserker/Phalanx/Ninja male; Valkyrie/Sorceress female.
  berserker: 'm',
  phalanx: 'm',
  ninja: 'm',
  valkyrie: 'f',
  sorceress: 'f',
  // Story 4.8: the Golem has no sex — a construct-designation list (dossier §7).
  golem: 'c',
};

/** ~48 male names, OB64-adjacent fantasy register. Plain data — edits are free (see module doc). */
export const MALE_NAMES: readonly string[] = [
  'Kain',
  'Aldric',
  'Magnus',
  'Baldur',
  'Corvin',
  'Dagmar',
  'Erwin',
  'Falk',
  'Gerhart',
  'Hadrian',
  'Ivo',
  'Jarek',
  'Konrad',
  'Leon',
  'Merrick',
  'Nolan',
  'Osric',
  'Percival',
  'Quentin',
  'Roland',
  'Sigmund',
  'Tristan',
  'Ulric',
  'Volker',
  'Wendell',
  'Xavier',
  'Yorick',
  'Zane',
  'Ansel',
  'Bertram',
  'Caspian',
  'Dietrich',
  'Emeric',
  'Fenwick',
  'Gawain',
  'Horst',
  'Ingmar',
  'Joachim',
  'Lambert',
  'Morcant',
  'Norbert',
  'Odell',
  'Pryce',
  'Reinhold',
  'Stellan',
  'Tancred',
  'Vance',
  'Wolfram',
];

/** ~48 female names, OB64-adjacent fantasy register. Plain data — edits are free (see module doc). */
export const FEMALE_NAMES: readonly string[] = [
  'Lyra',
  'Aveline',
  'Brienne',
  'Celia',
  'Deirdre',
  'Elara',
  'Freya',
  'Gwendolyn',
  'Helga',
  'Isolde',
  'Juniper',
  'Katarin',
  'Liadan',
  'Morwen',
  'Nerys',
  'Ophelia',
  'Petra',
  'Rowena',
  'Seraphine',
  'Thessaly',
  'Una',
  'Vespera',
  'Wilhelmina',
  'Yseult',
  'Adela',
  'Bronwyn',
  'Carys',
  'Delphine',
  'Eirlys',
  'Fiora',
  'Giselle',
  'Hesper',
  'Ilsa',
  'Jocasta',
  'Kerensa',
  'Lunete',
  'Maribel',
  'Nimue',
  'Odile',
  'Primrose',
  'Quilla',
  'Rhoswen',
  'Sabeline',
  'Tamsin',
  'Verena',
  'Winifred',
  'Ysabel',
  'Zephyrine',
];

/** ~12 rune-flavored construct designations for the Golem (dossier §7) — plain data, edits are free. */
export const CONSTRUCT_NAMES: readonly string[] = [
  'Bram',
  'Ogham',
  'Karrick',
  'Thunion',
  'Vundor',
  'Grondle',
  'Ossek',
  'Marrow',
  'Talrune',
  'Enkil',
  'Duskan',
  'Foragrim',
];

/** The tables keyed by name-table key — `rollName` indexes through this. */
export const NAME_TABLES: Record<NameSex, readonly string[]> = { m: MALE_NAMES, f: FEMALE_NAMES, c: CONSTRUCT_NAMES };

/**
 * Rolls one soldier name (FR37, dossier §7): EXACTLY ONE `nextInt` draw for
 * the table index, then a deterministic forward-advance past names already in
 * `taken` — dedup never consumes extra randomness, so replay counters stay
 * one-per-unit (AD-10). If every table entry is taken (impossible with the
 * ~48-name tables and 5-slot armies, but defended), the drawn name returns
 * as-is rather than hanging.
 *
 * The draft flow calls this once per drafted unit on the owner's `names/*`
 * stream; the result is stored in `MatchSetup` as plain data (AD-9).
 */
export function rollName(stream: Stream, cls: UnitClass, taken: readonly string[]): string {
  const table = NAME_TABLES[CLASS_SEX[cls]];
  const drawn = nextInt(stream, 0, table.length - 1);
  for (let step = 0; step < table.length; step++) {
    const candidate = table[(drawn + step) % table.length] as string;
    if (!taken.includes(candidate)) return candidate;
  }
  return table[drawn] as string;
}
