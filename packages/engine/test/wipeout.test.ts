import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { physicalDamage, resolveBattle } from '../src/resolve';
import type { BattleEvent, BattleLog, MatchSetup, Unit } from '../src/types';

/**
 * Until-wipeout mode (FR19, story 1.10): engagements repeat until a side is
 * wiped; statuses clear between engagements EXCEPT poison — narrated as
 * `StatusCleared` events at the seam since story 4.2, which `segments()`
 * places at the START of segments 2+; poison ticks at every natural
 * engagement end; after `BALANCE.engagementCap` engagements judging falls
 * back to FR18. Structural assertions here; golden.test.ts pins full logs.
 */
function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, seed: number, mode: MatchSetup['mode'] = 'wipeout'): MatchSetup {
  return {
    seed,
    balanceVersion: BALANCE.version,
    mode,
    tactics: { A: 'autonomous', B: 'autonomous' },
    leaders: { A: 0, B: 0 },
    ...partial,
  };
}

/** One drafted unit. Names are FR37 flavor — required data, zero gameplay effect. */
function u(cls: Unit['class'], element: Unit['element'], name: string): Unit {
  return { class: cls, element, name };
}

/** 5 knights vs 5 mercenaries, mirrored (front L/C/R + mid L/R): no healer,
 * so the knights out-grind the mercs — a hand-verifiable multi-engagement
 * wipe. Hand-derived (knight→merc 20 = 30 − floor(20/2), merc→knight 12 =
 * 26 − floor(28/2), no RPS either way; fronts have 2 actions, mids 1; melee
 * reach is COLUMN math, so mid units strike the front row, and once the
 * enemy front falls the swings spill onto the mid row):
 *   eng 1: fronts trade — flank mercs B:0/B:2 take 3 swings each (facing
 *          front knight ×2 + a mid knight) 110→50, B:1 takes 2 →70; flank
 *          knights A:0/A:2 take 3 merc swings 140→104, A:1 takes 2 →116.
 *   eng 2: same pattern — B:0/B:2 die on the knights' second pass, B:1 →30;
 *          A:0/A:2 →68, A:1 →92.
 *   eng 3: all five knight lanes converge on B:1, who dies in pass 1; the
 *          remaining five swings spill onto the mid mercs — B:3/B:4 110→50;
 *          A:0/A:2 →56 (one mid-merc swing each), A:1 →80.
 *   eng 4: pass 1 — B:4 dies (A:0, A:1, then A:3's kill), B:3 →10 (A:2, A:4);
 *          pass 2 — A:0 idles (B:3 out of reach), A:1 kills B:3: wipe.
 *          A ends 44 + 80 + 44 + 140 + 140 = 448/700 → 64% vs 0%. */
function knightsVsMercs(seed: number): MatchSetup {
  return setup(
    {
      armies: {
        A: [
          u('knight', 'fire', 'Aldric'),
          u('knight', 'water', 'Berold'),
          u('knight', 'wind', 'Cedric'),
          u('knight', 'earth', 'Doran'),
          u('knight', 'fire', 'Edmund'),
        ],
        B: [
          u('mercenary', 'earth', 'Falk'),
          u('mercenary', 'fire', 'Gorm'),
          u('mercenary', 'water', 'Hask'),
          u('mercenary', 'wind', 'Ivo'),
          u('mercenary', 'earth', 'Jarek'),
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'left' },
          { row: 'mid', col: 'right' },
        ],
        B: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'left' },
          { row: 'mid', col: 'right' },
        ],
      },
    },
    seed,
  );
}

/** Golden #1's comp grown to the 5-slot era: knights that can't break through
 * healing (clerics AGI 10 act before knights AGI 8). B's two extra clerics
 * stack the BACK line (back-left/back-center: 2 actions each → 8 cleric
 * actions × 30 heal), which fully offsets the five knights' chip. Hand-derived
 * damage lanes (knight→cleric 24 = 30 − floor(12/2), neutral RPS):
 *   B:0 (front-right) absorbs A:0×2 + A:1×2 + A:3 = 120/eng — the col-right
 *   knights A:2/A:4 reach only cols {left,center}, whose sole occupants are
 *   the back-row clerics, facing column left → B:3 absorbs A:2×2 + A:4 = 72.
 *   Steady state, re-established at the end of EVERY engagement from eng 1 on:
 *   B:0 cycles 30 →(pass-1 heals) 90 →(knight pass 1) 18 →(pass-2 heals) 78
 *   →(knight pass 2) 30; B:3 cycles 48 → 90 → 42 → 72 → 48. In-cycle minima
 *   18 and 42 — nobody EVER dies, so only the cap can end it. Cleric staff
 *   pokes (min-clamped 1 dmg, rearmost-in-reach → the mid knights): all five
 *   clerics poke in eng 1 (A:3 −3, A:4 −2); from eng 2 on only B:2 still finds
 *   everyone full at its turn (A:3 −1/eng). After 10 engagements A holds
 *   140×3 + 128 + 138 = 686/700 → 98%; B holds 30+90+90+48+90 = 348/450 → 77%. */
function knightsVsClerics(seed: number, mode: MatchSetup['mode'] = 'wipeout'): MatchSetup {
  return setup(
    {
      armies: {
        A: [
          u('knight', 'fire', 'Aldric'),
          u('knight', 'water', 'Berold'),
          u('knight', 'wind', 'Cedric'),
          u('knight', 'earth', 'Doran'),
          u('knight', 'fire', 'Edmund'),
        ],
        B: [
          u('cleric', 'earth', 'Mira'),
          u('cleric', 'fire', 'Nessa'),
          u('cleric', 'water', 'Olwen'),
          u('cleric', 'wind', 'Petra'),
          u('cleric', 'earth', 'Quinn'),
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'left' },
          { row: 'mid', col: 'right' },
        ],
        B: [
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'right' },
          { row: 'back', col: 'right' },
          { row: 'back', col: 'left' },
          { row: 'back', col: 'center' },
        ],
      },
    },
    seed,
    mode,
  );
}

/** Mirror clerics (back row 3 + mid 2): heals (30) outpace staff bonks
 * (cleric→cleric 8 − 6 = 2) — nobody ever wipes (cap-fallback comp). */
function mirrorClerics(seed: number): MatchSetup {
  const army = [
    u('cleric', 'fire', 'Rhea'),
    u('cleric', 'water', 'Sela'),
    u('cleric', 'wind', 'Tamsin'),
    u('cleric', 'earth', 'Una'),
    u('cleric', 'fire', 'Vesna'),
  ] as const;
  const placement = [
    { row: 'back', col: 'left' },
    { row: 'back', col: 'center' },
    { row: 'back', col: 'right' },
    { row: 'mid', col: 'left' },
    { row: 'mid', col: 'right' },
  ] as const;
  return setup(
    {
      armies: { A: army.map((unit) => ({ ...unit })), B: army.map((unit) => ({ ...unit })) },
      placements: { A: placement.map((p) => ({ ...p })), B: placement.map((p) => ({ ...p })) },
    },
    seed,
  );
}

/** Splits a log into per-engagement segments (each ending with its
 * EngagementEnded). The seam's StatusCleared events (story 4.2) are emitted
 * AFTER an EngagementEnded, so they open the NEXT segment. */
function segments(log: BattleLog): BattleEvent[][] {
  const out: BattleEvent[][] = [];
  let current: BattleEvent[] = [];
  for (const e of log.events) {
    if (e.type === 'BattleStarted' || e.type === 'BattleEnded') continue;
    current.push(e);
    if (e.type === 'EngagementEnded') {
      out.push(current);
      current = [];
    }
  }
  return out;
}

describe('wipeout mode (FR19)', () => {
  it('engagement 1 is bit-identical to the single-mode battle — the loop must not perturb the stream (FR20)', () => {
    const single = resolveBattle(knightsVsClerics(0xdead, 'single'));
    const wipeout = resolveBattle(knightsVsClerics(0xdead, 'wipeout'));
    const firstEnd = wipeout.events.findIndex((e) => e.type === 'EngagementEnded');
    // Single's log = BattleStarted + engagement 1 + EngagementEnded (+ BattleEnded).
    expect(wipeout.events.slice(0, firstEnd + 1)).toEqual(single.events.slice(0, -1));
  });

  it('continues past engagement 1 and ends the battle when a side is wiped', () => {
    const log = resolveBattle(knightsVsMercs(0xdead));
    const segs = segments(log);
    // Hand-verified structure (unchanged by story 4.6): the mercs are ground
    // out over four engagements — wipe at engagement 4. B:0 (front-left) is B's
    // DEFAULT leader (index 0): it falls early, arming B's sober package (story
    // 4.5, FR35) — from then on B's surviving mercs deal ×3/4 PHYSICAL to A, so
    // A's knights outlast them (was 448/700 → 64% pre-4.5, 463/700 → 66% at 4.5).
    // Story 4.6 (ADR 0003): both sides now draw dodge/crit per physical swing
    // (knight/merc DEX 16/18 → ~5-6% each). On seed 0xdead exactly one crit
    // fires and no swing dodges: B:0 (a mercenary) crits A:2 (a knight) for 18
    // (12 neutral base × 3/2 — no role relation between skirmisher/vanguard),
    // costing A the extra 6, nudging A's final hold to 461/700 → 65% vs 0%.
    // A's own leader never falls, so A is never penalised.
    expect(segs.length).toBe(4);
    for (const id of ['B:0', 'B:1', 'B:2', 'B:3', 'B:4']) {
      expect(log.events.some((e) => e.type === 'UnitDied' && e.unit === id)).toBe(true);
    }
    // Exactly one leader falls (B's, once) — the once-per-side guard holds.
    expect(log.events.filter((e) => e.type === 'LeaderFell')).toEqual([{ type: 'LeaderFell', side: 'B', unit: 'B:0' }]);
    const verdict = log.events[log.events.length - 1];
    expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 65, B: 0 } });
    // The wiping engagement is the last — nothing resolves after a wipe.
    expect(segs[3]?.[segs[3].length - 1]).toMatchObject({ type: 'EngagementEnded', engagement: 4 });
  });

  it('the equilibrium comp proves the cap is the termination guarantee — heals fully offset chip damage', () => {
    // Golden #1's comp in wipeout: from engagement 1 on the two damage sinks
    // cycle B:0 30→90→18→78→30 and B:3 48→90→42→72→48, every engagement,
    // forever (derivation on the fixture). Hand-verified: no death is ever
    // possible, the cap fires at 10 with A ahead 98% to 77%.
    const log = resolveBattle(knightsVsClerics(0xdead));
    const segs = segments(log);
    expect(segs.length).toBe(BALANCE.engagementCap);
    expect(log.events.some((e) => e.type === 'UnitDied')).toBe(false);
    expect(log.events[log.events.length - 1]).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 98, B: 77 } });
  });

  it('EngagementEnded numbers run 1..N and PassStarted restarts at 1 in every engagement', () => {
    const log = resolveBattle(knightsVsClerics(0xdead));
    const segs = segments(log);
    segs.forEach((seg, i) => {
      const end = seg[seg.length - 1];
      expect(end).toMatchObject({ type: 'EngagementEnded', engagement: i + 1 });
      const firstPass = seg.find((e) => e.type === 'PassStarted');
      // Every engagement has passes (actions were replenished) and restarts
      // at 1 — the find-by-type skips the seam's StatusCleared openers.
      expect(firstPass).toMatchObject({ type: 'PassStarted', pass: 1 });
    });
  });

  it('a battle nobody can win runs exactly BALANCE.engagementCap engagements, then judges by FR18', () => {
    const log = resolveBattle(mirrorClerics(0xbeef));
    const segs = segments(log);
    expect(segs.length).toBe(BALANCE.engagementCap);
    expect(log.events.some((e) => e.type === 'UnitDied')).toBe(false);
    expect(log.events[log.events.length - 1]?.type).toBe('BattleEnded');
  });

  it('poison persists across engagements and ticks at every natural engagement end', () => {
    // Golden #5's comp grown to 5v5: mirrored earth witches poison each
    // other's sides in engagement 1 (each targets the other, rearmost-in-
    // reach, then a second victim on pass 2). A's hunt-boosted archers
    // (4×28) kill B's witch by the end of engagement 1, but her poison has
    // already stuck — it survives the seam and ticks again at every natural
    // end while its carriers (A's untouched back line) live.
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              u('archer', 'fire', 'Kestrel'),
              u('archer', 'water', 'Lark'),
              u('witch', 'earth', 'Morgause'),
              u('knight', 'fire', 'Osric'),
              u('knight', 'water', 'Percival'),
            ],
            B: [
              u('witch', 'earth', 'Nimue'),
              u('knight', 'earth', 'Ragnar'),
              u('knight', 'water', 'Sigurd'),
              u('mercenary', 'fire', 'Torvald'),
              u('mercenary', 'water', 'Ulf'),
            ],
          },
          placements: {
            A: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'back', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'right' },
            ],
            B: [
              { row: 'back', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'right' },
              { row: 'mid', col: 'left' },
              { row: 'mid', col: 'right' },
            ],
          },
        },
        5,
      ),
    );
    const segs = segments(log);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    // Ticks in at least two different engagements — the status survived the
    // between-engagement clear (FR19's Witch-in-wipeout synergy).
    const segsWithTicks = segs.filter((seg) => seg.some((e) => e.type === 'PoisonTicked'));
    expect(segsWithTicks.length).toBeGreaterThanOrEqual(2);
  });

  it('weaken does not persist between engagements — the status is cleared at the boundary (FR19)', () => {
    // A's fire witch (AGI 26, back-right, 2 actions) weakens under FR9 global
    // range: each engagement she casts on the rearmost living enemies, landing
    // weaken on B:0 (back-center). While weakened, B:0's melee swing at the
    // front-center knight A:3 is HALVED — 8 = floor(physicalDamage(knight,
    // knight)/2). The FR19 between-engagement reset then clears the status:
    // a `StatusCleared { unit: B:0, spell: 'weaken' }` fires at the engagement
    // boundary (story 4.2's log-driven clear) — the direct evidence that
    // weaken does not carry over. (The witch re-weakens the same rearmost unit
    // at the top of every engagement, so the cleared-then-reapplied cycle is
    // exactly what the StatusCleared/StatusApplied pair records.)
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              u('archer', 'fire', 'Vale'),
              u('archer', 'water', 'Wren'),
              u('witch', 'fire', 'Xanthe'),
              u('knight', 'earth', 'Yorick'),
              u('knight', 'wind', 'Zane'),
            ],
            B: [
              u('knight', 'fire', 'Bram'),
              u('knight', 'earth', 'Corwin'),
              u('knight', 'water', 'Dietrich'),
              u('knight', 'wind', 'Ebbe'),
              u('knight', 'fire', 'Falkor'),
            ],
          },
          placements: {
            A: [
              { row: 'back', col: 'center' },
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'front', col: 'center' },
              { row: 'mid', col: 'center' },
            ],
            B: [
              { row: 'back', col: 'center' },
              { row: 'front', col: 'center' },
              { row: 'front', col: 'right' },
              { row: 'mid', col: 'right' },
              { row: 'back', col: 'right' },
            ],
          },
        },
        0xdead,
      ),
    );
    // Walk the log tracking live weaken statuses (applied on StatusApplied,
    // cleared at the engagement boundary — the reset under test).
    const weakened = new Set<string>();
    const hitsOnA3ByWeakenedB0: { damage: number; weak: boolean }[] = [];
    let clearedWeakenOnB0 = false;
    for (const e of log.events) {
      if (e.type === 'StatusApplied' && e.spell === 'weaken') weakened.add(e.target);
      if (e.type === 'StatusCleared' && e.spell === 'weaken') {
        weakened.delete(e.unit);
        if (e.unit === 'B:0') clearedWeakenOnB0 = true; // the FR19 reset, log-driven
      }
      if (e.type === 'UnitAttacked' && e.source === 'B:0') {
        for (const t of e.targets) {
          if (t.unit === 'A:3') hitsOnA3ByWeakenedB0.push({ damage: t.damage, weak: weakened.has('B:0') });
        }
      }
    }
    const full = physicalDamage('knight', 'knight');
    const halved = physicalDamage('knight', 'knight', true);
    expect(halved).toBe(Math.floor(full / 2)); // weaken really halves (FR16)
    // While weakened, B:0's swing at A:3 is halved …
    expect(hitsOnA3ByWeakenedB0).toContainEqual({ damage: halved, weak: true });
    // … and the status is cleared at the engagement boundary (does not persist).
    expect(clearedWeakenOnB0).toBe(true);
  });

  it('sleep does not persist between engagements — the same target can be slept again (no-stack proves the clear)', () => {
    // Golden #2's comp grown to 5v5: B's water witch (back-right, reach
    // {left, center}) sleeps A's back-line archers in engagement 1 — facing
    // column left first (A:4), then the unaffected back-center (A:2). FR16:
    // the same spell never stacks and the witch prefers unaffected targets —
    // a sleep landing on the SAME unit in a later engagement (or a slept
    // archer taking a real action again) is only possible if the status
    // cleared in between.
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              u('knight', 'fire', 'Gareth'),
              u('mercenary', 'water', 'Hilda'),
              u('archer', 'wind', 'Jora'),
              u('mercenary', 'fire', 'Idris'),
              u('archer', 'earth', 'Kell'),
            ],
            B: [
              u('mercenary', 'earth', 'Lunn'),
              u('mercenary', 'fire', 'Marek'),
              u('witch', 'water', 'Ondine'),
              u('knight', 'water', 'Pike'),
              u('mercenary', 'wind', 'Njal'),
            ],
          },
          placements: {
            A: [
              { row: 'front', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'back', col: 'center' },
              { row: 'front', col: 'right' },
              { row: 'back', col: 'left' },
            ],
            B: [
              { row: 'front', col: 'center' },
              { row: 'mid', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'right' },
            ],
          },
        },
        0xcafe,
      ),
    );
    const segs = segments(log);
    expect(segs.length).toBeGreaterThanOrEqual(2);
    const sleepTargetsPerSeg = segs.map(
      (seg) => new Set(seg.filter((e) => e.type === 'StatusApplied' && e.spell === 'sleep').map((e) => (e.type === 'StatusApplied' ? e.target : ''))),
    );
    const seenBefore = new Set<string>();
    let resleptOrActed = false;
    sleepTargetsPerSeg.forEach((targets, i) => {
      if (i > 0) {
        for (const t of targets) if (seenBefore.has(t)) resleptOrActed = true;
        // ...or a previously slept unit takes a real action this engagement.
        for (const t of seenBefore) {
          if (segs[i]?.some((e) => (e.type === 'UnitAttacked' && e.source === t) || (e.type === 'ActionSkipped' && e.unit === t && e.reason === 'idle'))) {
            resleptOrActed = true;
          }
        }
      }
      for (const t of targets) seenBefore.add(t);
    });
    expect(seenBefore.size).toBeGreaterThan(0);
    expect(resleptOrActed).toBe(true);
  });
});
