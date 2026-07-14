import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { physicalDamage, resolveBattle } from '../src/resolve';
import type { BattleEvent, BattleLog, MatchSetup } from '../src/types';

/**
 * Until-wipeout mode (FR19, story 1.10): engagements repeat until a side is
 * wiped; statuses clear between engagements EXCEPT poison; poison ticks at
 * every natural engagement end; after `BALANCE.engagementCap` engagements
 * judging falls back to FR18. Structural assertions here; golden.test.ts
 * pins two full wipeout logs.
 */
function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, seed: number, mode: MatchSetup['mode'] = 'wipeout'): MatchSetup {
  return { seed, balanceVersion: BALANCE.version, mode, ...partial };
}

/** Knights vs mercenaries, mirrored front rows: no healer, so knights grind
 * the mercs down 110→70→30→0 over exactly three engagements (20 dmg × 2 hits
 * each per engagement) — a hand-verifiable multi-engagement wipe. */
function knightsVsMercs(seed: number): MatchSetup {
  return setup(
    {
      armies: {
        A: [
          { class: 'knight', element: 'fire' },
          { class: 'knight', element: 'water' },
          { class: 'knight', element: 'wind' },
        ],
        B: [
          { class: 'mercenary', element: 'earth' },
          { class: 'mercenary', element: 'fire' },
          { class: 'mercenary', element: 'water' },
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
        ],
        B: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
        ],
      },
    },
    seed,
  );
}

/** Golden #1's comp: knights vs a healing cleric column — the clerics (AGI 10)
 * heal before the knights (AGI 8) swing, settling into a perfect 24→90→24
 * equilibrium that can never wipe: the comp the engagement cap exists for. */
function knightsVsClerics(seed: number, mode: MatchSetup['mode'] = 'wipeout'): MatchSetup {
  return setup(
    {
      armies: {
        A: [
          { class: 'knight', element: 'fire' },
          { class: 'knight', element: 'water' },
          { class: 'knight', element: 'wind' },
        ],
        B: [
          { class: 'cleric', element: 'earth' },
          { class: 'cleric', element: 'fire' },
          { class: 'cleric', element: 'water' },
        ],
      },
      placements: {
        A: [
          { row: 'front', col: 'left' },
          { row: 'front', col: 'center' },
          { row: 'front', col: 'right' },
        ],
        B: [
          { row: 'front', col: 'right' },
          { row: 'mid', col: 'right' },
          { row: 'back', col: 'right' },
        ],
      },
    },
    seed,
    mode,
  );
}

/** Mirror clerics: heals outpace staff bonks — nobody ever wipes (cap-fallback comp). */
function mirrorClerics(seed: number): MatchSetup {
  const army = [
    { class: 'cleric', element: 'fire' },
    { class: 'cleric', element: 'water' },
    { class: 'cleric', element: 'wind' },
  ] as const;
  const placement = [
    { row: 'back', col: 'left' },
    { row: 'back', col: 'center' },
    { row: 'back', col: 'right' },
  ] as const;
  return setup(
    {
      armies: { A: army.map((u) => ({ ...u })), B: army.map((u) => ({ ...u })) },
      placements: { A: placement.map((p) => ({ ...p })), B: placement.map((p) => ({ ...p })) },
    },
    seed,
  );
}

/** Splits a log into per-engagement segments (each ending with its EngagementEnded). */
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
    // Hand-verified: mercs at 110 HP take 2 × 20 per engagement (knight STR 30
    // − merc VIT 20/2, mirrored lanes) → 70, 30, dead in engagement 3; knights
    // take 2 × 12 → end at 68 each. Winner A, 48% vs 0%.
    expect(segs.length).toBe(3);
    for (const id of ['B:0', 'B:1', 'B:2']) {
      expect(log.events.some((e) => e.type === 'UnitDied' && e.unit === id)).toBe(true);
    }
    const verdict = log.events[log.events.length - 1];
    expect(verdict).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 48, B: 0 } });
    // The wiping engagement is the last — nothing resolves after a wipe.
    expect(segs[2]?.[segs[2].length - 1]).toMatchObject({ type: 'EngagementEnded', engagement: 3 });
  });

  it('the equilibrium comp proves the cap is the termination guarantee — heals fully offset chip damage', () => {
    // Golden #1's comp in wipeout: after engagement 1 the damaged cleric
    // cycles 24 → healed to 90 → beaten back to 24, every engagement, forever.
    // Hand-verified steady state: cap fires at 5 with A ahead 99% to 75%.
    const log = resolveBattle(knightsVsClerics(0xdead));
    const segs = segments(log);
    expect(segs.length).toBe(BALANCE.engagementCap);
    expect(log.events.some((e) => e.type === 'UnitDied')).toBe(false);
    expect(log.events[log.events.length - 1]).toEqual({ type: 'BattleEnded', winner: 'A', hpPct: { A: 99, B: 75 } });
  });

  it('EngagementEnded numbers run 1..N and PassStarted restarts at 1 in every engagement', () => {
    const log = resolveBattle(knightsVsClerics(0xdead));
    const segs = segments(log);
    segs.forEach((seg, i) => {
      const end = seg[seg.length - 1];
      expect(end).toMatchObject({ type: 'EngagementEnded', engagement: i + 1 });
      const firstPass = seg.find((e) => e.type === 'PassStarted');
      // Every engagement has passes (actions were replenished) and restarts at 1.
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
    // Golden #5's comp: mirrored earth witches poison each other's sides early.
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              { class: 'archer', element: 'fire' },
              { class: 'archer', element: 'water' },
              { class: 'witch', element: 'earth' },
            ],
            B: [
              { class: 'witch', element: 'earth' },
              { class: 'knight', element: 'earth' },
              { class: 'knight', element: 'water' },
            ],
          },
          placements: {
            A: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'back', col: 'center' },
            ],
            B: [
              { row: 'back', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'right' },
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

  it('weaken does not persist between engagements — the same attacker deals FULL damage again', () => {
    // Hand-verified (story 3.0 retune: B:0 is a BACK-ROW KNIGHT soaking the
    // witch's first cast — the original fire witch there now dies to the
    // hunt-boosted arrows (4×28 > 85) mid-engagement-1, which let the eng-2
    // first cast re-weaken B:2 BEFORE his swing and destroyed the scenario;
    // arrows bounce off the knight at 7). A's witch (A:2, back center,
    // 2 actions) weakens B:0 then knight B:2 in engagement 1, so B:2's second
    // swing on archer A:0 lands halved — 18 = floor(36/2). The
    // between-engagement reset clears the status, and in engagement 2 the
    // witch's FIRST cast re-targets B:0 (prefer-unaffected, rearmost), so
    // B:2's pass-1 swing on A:0 is back to full damage before she gets around
    // to re-weakening him: 36 = physicalDamage(knight, archer).
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              { class: 'archer', element: 'fire' },
              { class: 'archer', element: 'water' },
              { class: 'witch', element: 'fire' },
            ],
            B: [
              { class: 'knight', element: 'fire' },
              { class: 'knight', element: 'earth' },
              { class: 'knight', element: 'water' },
            ],
          },
          placements: {
            A: [
              { row: 'back', col: 'left' },
              { row: 'back', col: 'right' },
              { row: 'back', col: 'center' },
            ],
            B: [
              { row: 'back', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'front', col: 'right' },
            ],
          },
        },
        0xdead,
      ),
    );
    // Walk the log tracking live weaken statuses (applied on StatusApplied,
    // wiped at every EngagementEnded — the reset under test).
    const weakened = new Set<string>();
    let engagement = 1;
    const hitsOnA0: { engagement: number; damage: number; weak: boolean }[] = [];
    for (const e of log.events) {
      if (e.type === 'StatusApplied' && e.spell === 'weaken') weakened.add(e.target);
      if (e.type === 'EngagementEnded') {
        engagement += 1;
        weakened.clear();
      }
      if (e.type === 'UnitAttacked' && e.source === 'B:2') {
        for (const t of e.targets) {
          if (t.unit === 'A:0') hitsOnA0.push({ engagement, damage: t.damage, weak: weakened.has('B:2') });
        }
      }
    }
    const full = physicalDamage('knight', 'archer');
    const halved = physicalDamage('knight', 'archer', true);
    expect(halved).toBe(Math.floor(full / 2)); // weaken really halves (FR16)
    expect(hitsOnA0).toContainEqual({ engagement: 1, damage: halved, weak: true });
    expect(hitsOnA0).toContainEqual({ engagement: 2, damage: full, weak: false });
  });

  it('sleep does not persist between engagements — the same target can be slept again (no-stack proves the clear)', () => {
    // Golden #2's comp: the water witch sleeps A's attackers in engagement 1.
    // FR16: the same spell never stacks and the witch prefers unaffected
    // targets — a sleep landing on the SAME unit in a later engagement is
    // only possible if the status cleared in between.
    const log = resolveBattle(
      setup(
        {
          armies: {
            A: [
              { class: 'knight', element: 'fire' },
              { class: 'mercenary', element: 'water' },
              { class: 'archer', element: 'wind' },
            ],
            B: [
              { class: 'mercenary', element: 'earth' },
              { class: 'mercenary', element: 'fire' },
              { class: 'witch', element: 'water' },
            ],
          },
          placements: {
            A: [
              { row: 'front', col: 'center' },
              { row: 'front', col: 'left' },
              { row: 'back', col: 'center' },
            ],
            B: [
              { row: 'front', col: 'center' },
              { row: 'mid', col: 'left' },
              { row: 'back', col: 'right' },
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
