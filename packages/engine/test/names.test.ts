import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { BEAST_NAMES, CLASS_SEX, CONSTRUCT_NAMES, DRAGON_NAMES, FEMALE_NAMES, MALE_NAMES, NAME_TABLES, rollName } from '../src/names';
import type { NameSex } from '../src/names';
import { BALANCE, MAX_MONSTERS_PER_ARMY, SLOT_COST } from '../src/balance';
import { createStreams, nextInt } from '../src/rng';
import { ALL_CLASSES } from '../src/types';

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

describe('name tables (FR37, dossier §7, D-1f)', () => {
  it('both tables hold ~48 unique non-empty names', () => {
    for (const table of [MALE_NAMES, FEMALE_NAMES]) {
      expect(table.length).toBeGreaterThanOrEqual(40);
      expect(new Set(table).size).toBe(table.length);
      for (const name of table) {
        expect(typeof name).toBe('string');
        expect(name.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('CLASS_SEX covers every class with the D-1f gender split', () => {
    expect(Object.keys(CLASS_SEX).sort()).toEqual([...ALL_CLASSES].sort());
    expect(CLASS_SEX.knight).toBe('m');
    expect(CLASS_SEX.mercenary).toBe('m');
    expect(CLASS_SEX.mage).toBe('m');
    expect(CLASS_SEX.archer).toBe('f');
    expect(CLASS_SEX.cleric).toBe('f');
    expect(CLASS_SEX.witch).toBe('f');
  });

  it('NAME_TABLES keys the tables by sex', () => {
    expect(NAME_TABLES.m).toBe(MALE_NAMES);
    expect(NAME_TABLES.f).toBe(FEMALE_NAMES);
    expect(NAME_TABLES.c).toBe(CONSTRUCT_NAMES);
    expect(NAME_TABLES.b).toBe(BEAST_NAMES); // story 5.5
    expect(NAME_TABLES.d).toBe(DRAGON_NAMES); // story 5.5
  });

  it('EVERY table (not just the two human ones) holds unique, non-empty names', () => {
    for (const [key, table] of Object.entries(NAME_TABLES)) {
      expect(table.length, `${key} table is empty`).toBeGreaterThan(0);
      expect(new Set(table).size, `${key} table has duplicates`).toBe(table.length);
      for (const name of table) {
        expect(typeof name, `${key}: ${String(name)}`).toBe('string');
        expect(name.trim().length, `${key}: "${name}"`).toBeGreaterThan(0);
      }
    }
  });

  it('the creature tables draw from their OWN register — no name is shared between two tables (story 4.8 construct precedent, extended in 5.5)', () => {
    const entries = Object.entries(NAME_TABLES) as Array<[NameSex, readonly string[]]>;
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const [ka, a] = entries[i] as [NameSex, readonly string[]];
        const [kb, b] = entries[j] as [NameSex, readonly string[]];
        const shared = a.filter((n) => b.includes(n));
        expect(shared, `${ka} and ${kb} share ${shared.join(', ')}`).toEqual([]);
      }
    }
  });

  it('CLASS_SEX routes the 5.5 creatures: beasts to \u2018b\u2019, ALL dragonkind (Whelp included) to \u2018d\u2019', () => {
    expect(CLASS_SEX.golem).toBe('c');
    for (const cls of ['gryphon', 'wyrm', 'hellhound'] as const) expect(CLASS_SEX[cls], cls).toBe('b');
    for (const cls of ['whelp', 'emberdrake', 'frostfang', 'stormscale', 'cragmaw', 'nightwing', 'halowing'] as const) expect(CLASS_SEX[cls], cls).toBe('d');
    // The routing is RACE-shaped, not sizeClass-shaped: the Whelp is a small
    // and still draws a dragon name. Derived so a new class cannot drift.
    for (const cls of ALL_CLASSES) {
      const { race } = BALANCE.classes[cls];
      const expected: NameSex | undefined = race === 'golem' ? 'c' : race === 'beast' ? 'b' : race === 'dragon' ? 'd' : undefined;
      if (expected !== undefined) expect(CLASS_SEX[cls], `${cls} (${race})`).toBe(expected);
      else expect(['m', 'f'], `${cls} (human)`).toContain(CLASS_SEX[cls]);
    }
  });

  /**
   * DEDUP MARGIN (story 5.5). `rollName` keeps names unique inside one army by
   * walking forward from its single draw, so a table must be comfortably larger
   * than the most units of that table one LEGAL army can field. The worst case
   * is DERIVED from the balance data — slot budget, per-class slot cost, the
   * monster cap, and E5-D13's "every army needs a human" (which costs a
   * creature table one slot) — so growing the roster or retuning the budget
   * re-computes it instead of dating this comment.
   */
  it('every table is at least 4x the worst-case simultaneous draws one legal army can force', () => {
    const worstCase = (key: NameSex): number => {
      const classes = ALL_CLASSES.filter((cls) => CLASS_SEX[cls] === key);
      // A table with no human in it can never fill the last slot: E5-D13
      // requires one crownable human aboard.
      const anyHuman = classes.some((cls) => BALANCE.classes[cls].race === 'human');
      const budget = BALANCE.slotBudget - (anyHuman ? 0 : 1);
      return classes.reduce((best, cls) => {
        const { sizeClass } = BALANCE.classes[cls];
        const cap = sizeClass === 'monster' ? MAX_MONSTERS_PER_ARMY : Number.POSITIVE_INFINITY;
        return Math.max(best, Math.min(Math.floor(budget / SLOT_COST[sizeClass]), cap));
      }, 0);
    };
    for (const key of Object.keys(NAME_TABLES) as NameSex[]) {
      const worst = worstCase(key);
      expect(worst, `${key} has no class that can field a unit`).toBeGreaterThan(0);
      expect((NAME_TABLES[key] as readonly string[]).length, `${key}: worst case is ${worst} simultaneous names`).toBeGreaterThanOrEqual(worst * 4);
    }
  });

  it('a real army of four Whelps and a human gets four DISTINCT dragon names \u2014 the tightest case the margin rule protects', () => {
    const stream = createStreams(99)['names/A'];
    const taken: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const name = rollName(stream, 'whelp', taken);
      expect(DRAGON_NAMES).toContain(name);
      taken.push(name);
    }
    expect(new Set(taken).size).toBe(4);
  });
});

describe('rollName (FR37, AD-10 — one draw, deterministic dedup)', () => {
  test.prop([seedArb])('same seed and stream state → the same name, from the right sex table', (seed) => {
    for (const cls of ALL_CLASSES) {
      const a = rollName(createStreams(seed)['names/A'], cls, []);
      const b = rollName(createStreams(seed)['names/A'], cls, []);
      expect(a).toBe(b);
      expect(NAME_TABLES[CLASS_SEX[cls]]).toContain(a);
    }
  });

  test.prop([seedArb])('consumes EXACTLY one draw from the stream (dossier §7 — dedup never draws again)', (seed) => {
    const table = NAME_TABLES[CLASS_SEX.knight];
    // Roll with a `taken` list forcing a dedup walk; the stream must sit ONE
    // draw ahead afterwards, in lockstep with a single manual nextInt.
    const rolled = createStreams(seed)['names/A'];
    const manual = createStreams(seed)['names/A'];
    const first = rollName(rolled, 'knight', []);
    rollName(manual, 'knight', [first]); // dedup path: still one draw
    expect(nextInt(rolled, 0, 0x7fffffff)).toBe(nextInt(manual, 0, 0x7fffffff));
    expect(table.length).toBeGreaterThan(1);
  });

  test.prop([seedArb])('skips taken names by deterministic forward-advance', (seed) => {
    const stream = createStreams(seed)['names/A'];
    const check = createStreams(seed)['names/A'];
    const free = rollName(check, 'witch', []);
    const table = NAME_TABLES[CLASS_SEX.witch];
    const next = table[(table.indexOf(free) + 1) % table.length] as string;
    expect(rollName(stream, 'witch', [free])).toBe(next);
  });

  test.prop([seedArb])('a fully-taken table still returns a name (never hangs)', (seed) => {
    const table = NAME_TABLES[CLASS_SEX.archer];
    const name = rollName(createStreams(seed)['names/A'], 'archer', [...table]);
    expect(table).toContain(name);
  });
});
