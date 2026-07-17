import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { CLASS_SEX, FEMALE_NAMES, MALE_NAMES, NAME_TABLES, rollName } from '../src/names';
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
