import { describe, expect, it } from 'vitest';
import { BALANCE, LOG_VERSION, NAME_TABLES, resolveBattle, SLOT_COST } from '@lordly/engine';
import type { BattleLog, BattleStarted, MatchSetup, Unit, UnitClass } from '@lordly/engine';
import { battleStats, clampStat, statsBarMax, statsStripLine } from '../src/flow/battleStats';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  MIN_FONT_PX,
  STATS_CARD,
  STATS_SHEET_ROWS,
  SUMMARY_CARD,
  SUMMARY_HINT,
  SUMMARY_LINK,
  SUMMARY_TITLE,
} from '../src/config/constants';

/**
 * The type metrics every width pin below derives from — ONE advance ratio per
 * family, scaled by the font size in the geometry constant (5.7 review: the
 * same 7.5px standing in for a digit at BOTH 10px and 11px is not a
 * measurement, it is a number that happened to pass twice).
 */
const COURIER_ADVANCE_EM = 0.6; // monospace: every glyph, one advance
const ARIAL_BLACK_DIGIT_EM = 0.75; // the heavy family's digits are its widest ordinary glyph
const ARIAL_CHAR_EM = 0.62; // mixed-case label text, average advance
const ARIAL_BLACK_CHAR_EM = 0.62; // mixed-case at 14px (the soldier name / sheet title)
/**
 * ▲/▼ (U+25B2/U+25BC) are GEOMETRIC SHAPES: Courier has no such glyphs, so
 * the browser falls back to a platform font whose advance is not the family's
 * 0.6em (5.7 review — the ▲▼ width pins silently assumed monospace arrows).
 * Charge each arrow a generous 1.2em so the pin holds under any fallback.
 */
const ARROW_FALLBACK_EM = 1.2;
/** A Courier line's worst-case width, charging its geometric arrows the fallback allowance. */
const courierLineW = (line: string, fontPx: number): number => {
  const arrows = [...line].filter((ch) => ch === '▲' || ch === '▼').length;
  return (line.length - arrows) * COURIER_ADVANCE_EM * fontPx + arrows * ARROW_FALLBACK_EM * fontPx;
};
/** The worst totals line any battle can produce: 4-digit damage (wipeout runs to 10 engagements), 2-digit counters, 3-digit heals. */
const WORST_TOTALS = {
  dealt: 9999,
  taken: 9999,
  poisonTaken: 999,
  crits: 99,
  dodges: 99,
  blocks: 99,
  healsGiven: 999,
  healsReceived: 999,
  statusesApplied: 99,
} as const;

/**
 * Story 5.7 — the battle-stats fold. Two layers of proof:
 * 1. a SYNTHETIC log with hand-written events pinning every counter's exact
 *    semantics (the fold is pure and provenance-agnostic, so a constructed
 *    log is the sharpest fixture — every number below is derived by eye);
 * 2. REAL battles (fixed seeds, both modes) pinning the invariants that must
 *    hold over any log the engine can produce.
 */

/** A minimal BattleStarted roster: two units per side. */
const started: BattleStarted = {
  type: 'BattleStarted',
  units: [
    { id: 'A:0', side: 'A', class: 'knight', name: 'Kain', element: 'fire', hp: 140, maxHp: 140, placement: { row: 'front', col: 'left' } },
    { id: 'A:1', side: 'A', class: 'cleric', name: 'Sela', element: 'water', hp: 90, maxHp: 90, placement: { row: 'back', col: 'center' } },
    { id: 'B:0', side: 'B', class: 'phalanx', name: 'Bram', element: 'earth', hp: 150, maxHp: 150, placement: { row: 'front', col: 'left' } },
    { id: 'B:1', side: 'B', class: 'witch', name: 'Morwen', element: 'wind', hp: 85, maxHp: 85, placement: { row: 'back', col: 'center' } },
  ] as BattleStarted['units'],
};

const syntheticLog = (events: BattleLog['events']): BattleLog => ({ logVersion: LOG_VERSION, events: [started, ...events] });

describe('battleStats — the pure fold, exact semantics on a synthetic log (story 5.7 AC1)', () => {
  it('pins every counter: dealt/taken/crits/dodges/blocks/heals/statuses/poison, with the guardian credited and the dodger credited', () => {
    const stats = battleStats(
      syntheticLog([
        // A:0 crits B:1 for 30 — attacker dealt+crit, target taken.
        { type: 'UnitAttacked', source: 'A:0', kind: 'slash', targets: [{ unit: 'B:1', damage: 30, hpAfter: 55, outcome: 'crit' }] },
        // A:0 swings at B:1 again; B:0's Guard absorbs it (halved to 8) —
        // redirectedFrom credits B:0 the BLOCK; B:1 still TAKES the 8
        // (attribution, not retarget — Danilo's 2026-07-19 revision).
        { type: 'UnitAttacked', source: 'A:0', kind: 'slash', redirectedFrom: 'B:0', targets: [{ unit: 'B:1', damage: 8, hpAfter: 47, outcome: 'hit' }] },
        // B:0 swings at A:0, who DODGES — damage 0, the dodger gets the credit.
        { type: 'UnitAttacked', source: 'B:0', kind: 'bash', targets: [{ unit: 'A:0', damage: 0, hpAfter: 140, outcome: 'dodged' }] },
        // B:1 (a wind witch) confuses A:1... who then MISFIRES a heal onto B:0:
        // healsGiven credits A:1 even across sides (hiding it would lie).
        { type: 'StatusApplied', source: 'B:1', target: 'A:1', spell: 'confusion' },
        { type: 'ActionMisfired', unit: 'A:1' },
        { type: 'UnitHealed', source: 'A:1', target: 'B:0', amount: 12, hpAfter: 150 },
        // A breath-style AoE: one event, two target entries — dealt sums both.
        {
          type: 'UnitAttacked',
          source: 'B:0',
          kind: 'breath',
          targets: [
            { unit: 'A:0', damage: 15, hpAfter: 125, outcome: 'hit' },
            { unit: 'A:1', damage: 21, hpAfter: 69, outcome: 'hit' },
          ],
        },
        // A reserved 'missed' outcome (unused by the engine today): counts
        // NOTHING by decision (5.7 review) — damage 0 by contract, no counter.
        { type: 'UnitAttacked', source: 'B:0', kind: 'bash', targets: [{ unit: 'A:0', damage: 0, hpAfter: 140, outcome: 'missed' }] },
        // Poison ticks A:1 for 15 — taken AND poisonTaken; attributed to nobody's dealt.
        { type: 'PoisonTicked', unit: 'A:1', damage: 15, hpAfter: 54 },
        { type: 'BattleEnded', winner: 'B', hpPct: { A: 60, B: 80 } },
      ] as BattleLog['events']),
    );
    const by = (id: string) => stats.units.find((u) => u.id === id)!;
    expect(by('A:0')).toMatchObject({ side: 'A', class: 'knight', name: 'Kain', dealt: 38, taken: 15, poisonTaken: 0, crits: 1, dodges: 1, blocks: 0 });
    expect(by('A:1')).toMatchObject({ dealt: 0, taken: 36, poisonTaken: 15, healsGiven: 12, healsReceived: 0, statusesApplied: 0 });
    expect(by('B:0')).toMatchObject({ dealt: 36, taken: 0, blocks: 1, healsReceived: 12, crits: 0 });
    expect(by('B:1')).toMatchObject({ dealt: 0, taken: 38, statusesApplied: 1, dodges: 0 });
    // Totals are per-side sums.
    expect(stats.totals.A).toMatchObject({
      dealt: 38,
      taken: 51,
      poisonTaken: 15,
      crits: 1,
      dodges: 1,
      blocks: 0,
      healsGiven: 12,
      healsReceived: 0,
      statusesApplied: 0,
    });
    expect(stats.totals.B).toMatchObject({
      dealt: 36,
      taken: 38,
      poisonTaken: 0,
      crits: 0,
      dodges: 0,
      blocks: 1,
      healsGiven: 0,
      healsReceived: 12,
      statusesApplied: 1,
    });
    // The conservation law, on this log: Σdealt (74) + Σpoison (15) = Σtaken (89).
    expect(stats.totals.A.dealt + stats.totals.B.dealt + stats.totals.A.poisonTaken + stats.totals.B.poisonTaken).toBe(
      stats.totals.A.taken + stats.totals.B.taken,
    );
  });

  it('a log that does not open with BattleStarted folds to EMPTY stats — provenance-agnostic means not crashing Result (5.7 review)', () => {
    expect(battleStats({ logVersion: LOG_VERSION, events: [] })).toEqual({
      units: [],
      totals: {
        A: { dealt: 0, taken: 0, poisonTaken: 0, crits: 0, dodges: 0, blocks: 0, healsGiven: 0, healsReceived: 0, statusesApplied: 0 },
        B: { dealt: 0, taken: 0, poisonTaken: 0, crits: 0, dodges: 0, blocks: 0, healsGiven: 0, healsReceived: 0, statusesApplied: 0 },
      },
    });
    expect(
      battleStats({ logVersion: LOG_VERSION, events: [{ type: 'BattleEnded', winner: 'draw', hpPct: { A: 0, B: 0 } }] as BattleLog['events'] }).units,
    ).toEqual([]);
  });

  it('clampStat: 4 digits pass through, 5+ clamp to "9999+" — the width pins’ own digit assumption, enforced (5.7 review)', () => {
    expect(clampStat(0)).toBe('0');
    expect(clampStat(9999)).toBe('9999');
    expect(clampStat(10000)).toBe('9999+');
    expect(
      statsStripLine({ dealt: 123456, taken: 5, poisonTaken: 0, crits: 0, dodges: 0, blocks: 0, healsGiven: 0, healsReceived: 0, statusesApplied: 0 }),
    ).toContain('▲9999+ ▼5');
  });

  it('units keep the BattleStarted roster order and every roster unit appears exactly once, acted or not', () => {
    const stats = battleStats(syntheticLog([{ type: 'BattleEnded', winner: 'draw', hpPct: { A: 100, B: 100 } }] as BattleLog['events']));
    expect(stats.units.map((u) => u.id)).toEqual(['A:0', 'A:1', 'B:0', 'B:1']);
    for (const u of stats.units) {
      expect(u).toMatchObject({ dealt: 0, taken: 0, poisonTaken: 0, crits: 0, dodges: 0, blocks: 0, healsGiven: 0, healsReceived: 0, statusesApplied: 0 });
    }
  });
});

/** Real battles: build a valid setup and fold the actual engine output. */
const u = (cls: UnitClass, element: Unit['element'], name: string): Unit => ({ class: cls, element, name });
const realSetup = (seed: number, mode: 'single' | 'wipeout'): MatchSetup => ({
  seed,
  balanceVersion: BALANCE.version,
  mode,
  tactics: { A: 'autonomous', B: 'autonomous' },
  leaders: { A: 0, B: 0 },
  armies: {
    // Witches on both sides make statuses (incl. earth→poison and wind→confusion misfires) reachable across seeds.
    A: [u('knight', 'fire', 'Kain'), u('archer', 'water', 'Lyra'), u('witch', 'earth', 'Morwen'), u('cleric', 'wind', 'Sela'), u('fencer', 'fire', 'Lys')],
    B: [u('phalanx', 'earth', 'Bram'), u('mercenary', 'water', 'Dario'), u('witch', 'wind', 'Vex'), u('cleric', 'fire', 'Ithil'), u('ninja', 'earth', 'Kage')],
  },
  placements: {
    A: [
      { row: 'front', col: 'left' },
      { row: 'mid', col: 'right' },
      { row: 'back', col: 'center' },
      { row: 'back', col: 'left' },
      { row: 'front', col: 'right' },
    ],
    B: [
      { row: 'front', col: 'center' },
      { row: 'front', col: 'left' },
      { row: 'back', col: 'right' },
      { row: 'back', col: 'center' },
      { row: 'front', col: 'right' },
    ],
  },
});

describe('battleStats — invariants over REAL battles (story 5.7 AC1/AC2)', () => {
  it('conservation holds on every seed × mode: Σdealt + Σpoison = Σtaken, ΣhealsGiven = ΣhealsReceived; identity matches the roster', () => {
    for (const mode of ['single', 'wipeout'] as const) {
      for (const seed of [1, 2, 3, 7, 21]) {
        const log = resolveBattle(realSetup(seed, mode));
        const stats = battleStats(log);
        const roster = (log.events[0] as BattleStarted).units;
        expect(
          stats.units.map((x) => x.id),
          `${mode} seed ${seed}`,
        ).toEqual(roster.map((x) => x.id));
        const sum = (pick: (t: (typeof stats.totals)['A']) => number) => pick(stats.totals.A) + pick(stats.totals.B);
        expect(sum((t) => t.dealt) + sum((t) => t.poisonTaken), `${mode} seed ${seed} conservation`).toBe(sum((t) => t.taken));
        expect(
          sum((t) => t.healsGiven),
          `${mode} seed ${seed} heals`,
        ).toBe(sum((t) => t.healsReceived));
        // Totals really are the per-side sums of the unit rows.
        for (const side of ['A', 'B'] as const) {
          const mine = stats.units.filter((x) => x.side === side);
          expect(stats.totals[side].dealt).toBe(mine.reduce((acc, x) => acc + x.dealt, 0));
          expect(stats.totals[side].taken).toBe(mine.reduce((acc, x) => acc + x.taken, 0));
        }
      }
    }
  });

  it('is deterministic: folding the same log twice yields deeply equal stats (the replay contract — same events in, same stats out)', () => {
    const log = resolveBattle(realSetup(1, 'wipeout'));
    expect(battleStats(log)).toEqual(battleStats(log));
  });
});

describe('battleStats — the story’s real-battle scenarios (AC2 wipeout identity, blocks, misfire friendly-fire)', () => {
  it('WIPEOUT seed 1: poison ticks across ≥2 engagements fold into poisonTaken, and a mid-battle death keeps its accumulated stats (probed fixture — re-probe if it drifts)', () => {
    const log = resolveBattle(realSetup(1, 'wipeout'));
    // Fixture guards: this seed really exercises the scenario.
    let engagement = 0;
    const tickEngagements = new Set<number>();
    let poisonTotal = 0;
    for (const e of log.events) {
      if (e.type === 'EngagementEnded') engagement += 1;
      if (e.type === 'PoisonTicked') {
        tickEngagements.add(engagement);
        poisonTotal += e.damage;
      }
    }
    expect(tickEngagements.size, 'seed 1 must tick poison in ≥2 engagements — re-probe').toBeGreaterThanOrEqual(2);
    const firstDeath = log.events.find((e) => e.type === 'UnitDied');
    expect(firstDeath, 'seed 1 must kill someone — re-probe').toBeDefined();

    const stats = battleStats(log);
    const sumPoison = stats.totals.A.poisonTaken + stats.totals.B.poisonTaken;
    expect(sumPoison).toBe(poisonTotal); // every tick folded, across ALL engagements
    // RETENTION, actually proven (5.7 review — the old "row exists and took
    // damage" was tautological): fold the log TRUNCATED at the death, and the
    // dead unit's row must be IDENTICAL to the full-log fold's — dead units
    // never act, are never targeted, and never tick, so any difference means
    // the fold lost or reset something after the death.
    const deathIdx = log.events.findIndex((e) => e === firstDeath);
    const deadId = (firstDeath as { unit: string }).unit;
    const truncated = battleStats({ ...log, events: log.events.slice(0, deathIdx + 1) });
    expect(stats.units.find((x) => x.id === deadId)).toEqual(truncated.units.find((x) => x.id === deadId));
    // And the death really was MID-battle: engagements ended after it.
    expect(log.events.slice(deathIdx).some((e) => e.type === 'EngagementEnded')).toBe(true);
    expect(truncated.units.find((x) => x.id === deadId)!.taken).toBeGreaterThan(0);
  });

  it('BLOCKS credit the guardian on a real battle: each unit’s counter equals its redirectedFrom appearances (wipeout seed 1 carries several)', () => {
    const log = resolveBattle(realSetup(1, 'wipeout'));
    const expected = new Map<string, number>();
    let blockEvents = 0;
    for (const e of log.events) {
      if (e.type === 'UnitAttacked' && e.redirectedFrom !== undefined) {
        expected.set(e.redirectedFrom, (expected.get(e.redirectedFrom) ?? 0) + 1);
        blockEvents += 1;
      }
    }
    expect(blockEvents, 'seed 1 must contain Guard blocks — re-probe').toBeGreaterThan(0);
    const stats = battleStats(log);
    for (const unit of stats.units) {
      expect(unit.blocks, unit.id).toBe(expected.get(unit.id) ?? 0);
    }
  });

  it('MISFIRE friendly-fire counts as dealt on a real battle (probed: seed 1 of the confusion fixture — a confused B archer arrows its own side)', () => {
    // The confusion.test.ts fixture shape: A's wind witch confuses B's
    // back-row actors; B:4 (archer) misfires an arrow onto its own side.
    const log = resolveBattle({
      seed: 1,
      balanceVersion: BALANCE.version,
      mode: 'single',
      tactics: { A: 'autonomous', B: 'autonomous' },
      leaders: { A: 0, B: 0 },
      armies: {
        A: [
          u('witch', 'wind', 'Sylwen'),
          u('knight', 'fire', 'Bramgar'),
          u('cleric', 'water', 'Nerienne'),
          u('knight', 'earth', 'Thorvald'),
          u('mercenary', 'fire', 'Kestrel'),
        ],
        B: [
          u('mercenary', 'fire', 'Dorn'),
          u('mercenary', 'earth', 'Rooke'),
          u('knight', 'water', 'Hargen'),
          u('berserker', 'wind', 'Grum'),
          u('archer', 'fire', 'Vess'),
        ],
      },
      placements: {
        A: [
          { row: 'back', col: 'center' },
          { row: 'front', col: 'center' },
          { row: 'back', col: 'left' },
          { row: 'front', col: 'left' },
          { row: 'front', col: 'right' },
        ],
        B: [
          { row: 'front', col: 'center' },
          { row: 'front', col: 'left' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'center' },
          { row: 'back', col: 'center' },
        ],
      },
    });
    // Fixture guard: find the marker+attack pair and prove it is friendly fire.
    let misfire: { source: string; target: string; damage: number } | undefined;
    log.events.forEach((e, i) => {
      const next = log.events[i + 1];
      if (!misfire && e.type === 'ActionMisfired' && next?.type === 'UnitAttacked' && next.targets.some((t) => t.damage > 0)) {
        misfire = { source: next.source, target: next.targets[0]!.unit, damage: next.targets[0]!.damage };
      }
    });
    expect(misfire, 'seed 1 must misfire an attack — re-probe').toBeDefined();
    expect(misfire!.source[0], 'the probed misfire is friendly fire').toBe(misfire!.target[0]);
    const stats = battleStats(log);
    const source = stats.units.find((x) => x.id === misfire!.source)!;
    expect(source.dealt, 'friendly-fire damage counts as dealt — hiding it would lie').toBeGreaterThanOrEqual(misfire!.damage);
    // And conservation still closes over a battle containing the misfire.
    const sum = (pick: (t: (typeof stats.totals)['A']) => number) => pick(stats.totals.A) + pick(stats.totals.B);
    expect(sum((t) => t.dealt) + sum((t) => t.poisonTaken)).toBe(sum((t) => t.taken));
  });
});

describe('the presentation contracts (story 5.7 AC3 — geometry as arithmetic, strings pinned)', () => {
  it('statsStripLine renders the exact compact read', () => {
    // ▲ = dealt (sent out), ▼ = taken (received) — the device-pass fix: the
    // original `312/288` slash pair made Danilo ask which number was which.
    // The line's WIDTH is pinned where it actually renders: inside the summary
    // sheet's inner width (5.7 review — the old canvas-wide pin here belonged
    // to the always-on strip, retired at device round 2).
    expect(
      statsStripLine({ dealt: 312, taken: 288, poisonTaken: 30, crits: 4, dodges: 2, blocks: 1, healsGiven: 45, healsReceived: 45, statusesApplied: 3 }),
    ).toBe('▲312 ▼288 · CRIT 4 · DGE 2 · BLK 1 · HEAL 45');
  });

  it('the BATTLE SUMMARY link’s 44px tap zone sits inside the free band DERIVED from Result’s own layout fractions', () => {
    // The band is not a fiat 190–250 (5.7 review): it is what ResultScene's
    // own anchors leave free — the HP count-up at BASE_HEIGHT*0.27 in a 16px
    // line, and the "Your army" heading at BASE_HEIGHT*0.4 in a 13px one.
    const bandTop = BASE_HEIGHT * 0.27 + 16 / 2;
    const bandBottom = BASE_HEIGHT * 0.4 - 13 / 2;
    expect(SUMMARY_LINK.tapH).toBeGreaterThanOrEqual(44); // FR30
    expect(SUMMARY_LINK.y - SUMMARY_LINK.tapH / 2).toBeGreaterThanOrEqual(bandTop);
    expect(SUMMARY_LINK.y + SUMMARY_LINK.tapH / 2).toBeLessThanOrEqual(bandBottom);
    expect(SUMMARY_LINK.tapW).toBeLessThanOrEqual(BASE_WIDTH);
  });

  it('the SUMMARY sheet’s vertical budget adds up at the WORST roster, DERIVED from the slot budget, inside the canvas, ✕ at the floor', () => {
    // Ten rows is not a fiat number (5.7 review): it is both sides filling the
    // slot budget with the cheapest units the roster sells.
    const worstRows = (2 * BALANCE.slotBudget) / Math.min(...Object.values(SLOT_COST));
    expect(worstRows).toBe(10); // the arithmetic, stated — a slotBudget change lands here first
    const content = SUMMARY_CARD.pad + SUMMARY_CARD.titleH + SUMMARY_CARD.totalsH + worstRows * SUMMARY_CARD.rowH + SUMMARY_CARD.footerH + SUMMARY_CARD.pad;
    expect(content).toBeLessThanOrEqual(SUMMARY_CARD.h);
    expect(SUMMARY_CARD.y + SUMMARY_CARD.h).toBeLessThanOrEqual(BASE_HEIGHT);
    expect(SUMMARY_CARD.x + SUMMARY_CARD.w).toBeLessThanOrEqual(BASE_WIDTH);
    expect(SUMMARY_CARD.closeSize).toBeGreaterThanOrEqual(44);
    // The bar row's horizontal budget: avatar + the shared-scale bar + a
    // clamped 4-digit dealt value never collide.
    const barMaxW = SUMMARY_CARD.w - 2 * SUMMARY_CARD.pad - SUMMARY_CARD.avatarW - 4 - SUMMARY_CARD.valueW;
    expect(barMaxW).toBeGreaterThanOrEqual(200); // a bar shorter than this stops reading as a bar
    expect(clampStat(9999).length * ARIAL_BLACK_DIGIT_EM * MIN_FONT_PX).toBeLessThanOrEqual(SUMMARY_CARD.valueW);
    // And the totals lines still fit the sheet's inner width at worst wipeout
    // numbers — arrows charged the fallback allowance, not a monospace 6px.
    expect(courierLineW(statsStripLine(WORST_TOTALS), MIN_FONT_PX)).toBeLessThanOrEqual(SUMMARY_CARD.w - 2 * SUMMARY_CARD.pad);
  });

  it('the SUMMARY sheet’s clearances hold: title clear of the ✕ zone, both totals lines inside their band, the footer hint inside the width', () => {
    const inner = SUMMARY_CARD.w - 2 * SUMMARY_CARD.pad;
    // The title runs left-to-right from the padding; the ✕'s 44px zone owns
    // the top-right corner (the 5.6 clearance discipline, missing here — 5.7 review).
    expect(SUMMARY_TITLE.length * ARIAL_BLACK_CHAR_EM * SUMMARY_CARD.titleFontPx).toBeLessThanOrEqual(inner - SUMMARY_CARD.closeSize);
    // Two side lines at totalsLineH must fit the totals band they share.
    expect(2 * SUMMARY_CARD.totalsLineH).toBeLessThanOrEqual(SUMMARY_CARD.totalsH);
    // …and each line's own 10px type fits inside its row (no vertical overlap).
    expect(MIN_FONT_PX).toBeLessThanOrEqual(SUMMARY_CARD.totalsLineH);
    // The footer hint — centred, so the whole string must fit the inner width.
    expect(SUMMARY_HINT.length * ARIAL_CHAR_EM * MIN_FONT_PX).toBeLessThanOrEqual(inner);
    // It must also NAME the chips and the dismissal: the sheet blocks the very
    // chips it points at (5.7 review — "hold a unit" alone stranded the reader).
    expect(SUMMARY_HINT).toMatch(/close/i);
    expect(SUMMARY_HINT).toMatch(/chip/i);
  });

  it('statsBarMax: one shared scale over dealt AND taken, floored at 1 (an all-guard zero-damage battle must not produce NaN bars)', () => {
    const mk = (dealt: number, taken: number) =>
      ({
        id: 'A:0',
        side: 'A',
        class: 'knight',
        name: 'K',
        dealt,
        taken,
        poisonTaken: 0,
        crits: 0,
        dodges: 0,
        blocks: 0,
        healsGiven: 0,
        healsReceived: 0,
        statusesApplied: 0,
      }) as const;
    expect(statsBarMax([mk(100, 40), mk(30, 250)])).toBe(250); // taken can set the scale
    expect(statsBarMax([mk(0, 0)])).toBe(1);
    expect(statsBarMax([])).toBe(1);
  });

  it('STATS_SHEET_ROWS surfaces EVERY SideTotals counter exactly once — a new counter fails here, never ships silently missing', () => {
    const surfaced = STATS_SHEET_ROWS.map(([, key]) => key);
    expect(new Set(surfaced).size).toBe(surfaced.length);
    const counters = Object.keys(battleStats(resolveBattle(realSetup(1, 'single'))).totals.A).sort();
    expect([...surfaced].sort()).toEqual(counters);
  });

  it('the STATS_CARD vertical budget adds up exactly, inside the canvas, with the FR30 ✕ floor', () => {
    // EQUALITY, not ≤ (5.7 review): the constant's comment says "246 exactly",
    // so the test must fail if a row count or padding change leaves dead space.
    expect(STATS_CARD.pad + STATS_CARD.headerH + STATS_SHEET_ROWS.length * STATS_CARD.rowH + STATS_CARD.pad).toBe(STATS_CARD.h);
    expect(STATS_CARD.y + STATS_CARD.h).toBeLessThanOrEqual(BASE_HEIGHT);
    expect(STATS_CARD.x + STATS_CARD.w).toBeLessThanOrEqual(BASE_WIDTH);
    expect(STATS_CARD.closeSize).toBeGreaterThanOrEqual(44);
  });

  it('the sheet’s row budget carries the DERIVED worst content: longest label + a 4-digit value never collide (the 5.6 discipline)', () => {
    const longestLabel = Math.max(...STATS_SHEET_ROWS.map(([label]) => label.length));
    const labelW = longestLabel * ARIAL_CHAR_EM * MIN_FONT_PX;
    // The value column: a CLAMPED worst value in the sheet's own value type
    // size, plus a gap — both scaled from the one digit ratio (5.7 review).
    const valueW = clampStat(9999).length * ARIAL_BLACK_DIGIT_EM * STATS_CARD.valueFontPx + 8;
    expect(labelW + valueW).toBeLessThanOrEqual(STATS_CARD.w - 2 * STATS_CARD.pad);
    // And the header name budget: the longest soldier name in any table, at the
    // header's own name type size, clear of the ✕ zone.
    const longestName = Math.max(...Object.values(NAME_TABLES).flatMap((t) => t.map((n) => n.length)));
    expect(48 + longestName * ARIAL_BLACK_CHAR_EM * STATS_CARD.nameFontPx).toBeLessThanOrEqual(STATS_CARD.w - 2 * STATS_CARD.pad - STATS_CARD.closeSize);
  });
});
