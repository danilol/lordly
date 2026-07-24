import { test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import type { MatchSetup, Row, Unit, UnitClass, UnitId } from '../src/types';
import { matchSetupArb } from './arbitraries';

/**
 * Story 4.7 — the Full/Half Guard shield (FR33, dossier §4, REVISED by Danilo
 * 2026-07-19: a damage shield, not the dossier's original redirect). Pins:
 * `GuardRaised` on raise, consumption (`GuardEnded`) on a LANDED hit — self OR
 * the ally directly behind — Full negate / Half halve+re-clamp, one-shot
 * (unshielded again until re-raised), magic/dodge bypass, and natural-end
 * expiry of an unconsumed charge.
 */
function setup(partial: Pick<MatchSetup, 'armies' | 'placements'>, o: Partial<Pick<MatchSetup, 'seed' | 'mode' | 'tactics' | 'leaders'>> = {}): MatchSetup {
  return {
    seed: o.seed ?? 7,
    balanceVersion: BALANCE.version,
    mode: o.mode ?? 'single',
    tactics: o.tactics ?? { A: 'autonomous', B: 'autonomous' },
    leaders: o.leaders ?? { A: 0, B: 0 },
    ...partial,
  };
}

const u = (cls: Unit['class'], element: Unit['element'], name: string): Unit => ({ class: cls, element, name });

describe('Full Guard (Phalanx) shields itself AND the ally directly behind it, then expires unconsumed at re-arm', () => {
  // A:0 = Phalanx front-center (guard-full, 2 actions — re-arms every action);
  // A:1 = archer mid-center, the ally DIRECTLY BEHIND A:0 (row+1, same col) —
  // designated A's leader so B's archer (tactic 'leader') always snipes it
  // directly, regardless of Autonomous priority. B's clerics also inherit
  // 'leader' (army-wide tactic) so their staff fallback hunts A:1 too.
  const FULL_GUARD_ALLY_BEHIND = {
    armies: {
      A: [
        u('phalanx', 'fire', 'Bram'),
        u('archer', 'water', 'Vess'),
        u('knight', 'wind', 'Cedric'),
        u('knight', 'earth', 'Doran'),
        u('mercenary', 'fire', 'Edmund'),
      ],
      B: [u('archer', 'earth', 'Falk'), u('cleric', 'fire', 'Gorm'), u('cleric', 'water', 'Hask'), u('cleric', 'wind', 'Ivo'), u('cleric', 'earth', 'Jarek')],
    },
    placements: {
      A: [
        { row: 'front', col: 'center' },
        { row: 'mid', col: 'center' },
        { row: 'front', col: 'left' },
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'left' },
      ],
      B: [
        { row: 'back', col: 'center' },
        { row: 'back', col: 'left' },
        { row: 'back', col: 'right' },
        { row: 'mid', col: 'left' },
        { row: 'mid', col: 'right' },
      ],
    },
  } satisfies Pick<MatchSetup, 'armies' | 'placements'>;

  const log = resolveBattle(setup(FULL_GUARD_ALLY_BEHIND, { seed: 1, tactics: { A: 'autonomous', B: 'leader' }, leaders: { A: 1, B: 0 } }));

  it('raises on the Phalanx front-row action (no attack, no UnitAttacked)', () => {
    const raises = log.events.filter((e) => e.type === 'GuardRaised' && e.unit === 'A:0');
    expect(raises.length).toBeGreaterThanOrEqual(1);
  });

  it('negates a landed hit on the ally BEHIND it to exactly 0, attributing the block via redirectedFrom — and the charge is spent (GuardEnded)', () => {
    const guardedHit = log.events.find((e) => e.type === 'UnitAttacked' && e.redirectedFrom === 'A:0');
    expect(guardedHit).toBeDefined();
    if (guardedHit?.type === 'UnitAttacked') {
      // The ATTACKED unit stays A:1 (no redirect) — only the guardian id differs.
      expect(guardedHit.targets).toEqual([{ unit: 'A:1', damage: 0, hpAfter: expect.any(Number), outcome: 'hit' }]);
      const i = log.events.indexOf(guardedHit);
      expect(log.events[i + 1]).toEqual({ type: 'GuardEnded', unit: 'A:0' });
    }
  });

  it("re-arms on the Phalanx front row's second action (a fresh GuardRaised after the first was consumed)", () => {
    const raises = log.events.filter((e) => e.type === 'GuardRaised' && e.unit === 'A:0');
    expect(raises.length).toBe(2);
  });

  it("a charge unconsumed by the engagement's natural end expires (GuardEnded, no shell lifecycle rule)", () => {
    const ends = log.events.filter((e) => e.type === 'GuardEnded' && e.unit === 'A:0');
    expect(ends.length).toBe(2); // one from consumption, one from natural-end expiry
    const engEndIdx = log.events.findIndex((e) => e.type === 'EngagementEnded');
    const lastEnd = ends[ends.length - 1];
    expect(log.events.indexOf(lastEnd as (typeof log.events)[number])).toBeLessThan(engEndIdx);
  });
});

describe('Half Guard (Knight) halves a landed hit, re-clamped to minDamage — and is a ONE-SHOT (the next hit that same engagement is unshielded)', () => {
  // A:0 = Knight mid-center (guard-half, 1 action — no re-arm this engagement).
  // B fields five clerics under 'leader' (staff fallback bonks A:0 directly,
  // clamped to 1 pre-guard) — seed 2 lands two consecutive staff pokes on A:0
  // in the SAME pass: the first is guarded (re-clamped to 1), the second is
  // NOT (the charge is already spent).
  const HALF_GUARD_OWN_CELL = {
    armies: {
      A: [
        u('knight', 'fire', 'Bram'),
        u('archer', 'water', 'Vess'),
        u('knight', 'wind', 'Cedric'),
        u('knight', 'earth', 'Doran'),
        u('mercenary', 'fire', 'Edmund'),
      ],
      B: [u('cleric', 'earth', 'Falk'), u('cleric', 'fire', 'Gorm'), u('cleric', 'water', 'Hask'), u('cleric', 'wind', 'Ivo'), u('cleric', 'earth', 'Jarek')],
    },
    placements: {
      A: [
        { row: 'mid', col: 'center' },
        { row: 'front', col: 'center' },
        { row: 'front', col: 'left' },
        { row: 'front', col: 'right' },
        { row: 'mid', col: 'left' },
      ],
      B: [
        { row: 'back', col: 'center' },
        { row: 'back', col: 'left' },
        { row: 'back', col: 'right' },
        { row: 'mid', col: 'left' },
        { row: 'mid', col: 'right' },
      ],
    },
  } satisfies Pick<MatchSetup, 'armies' | 'placements'>;

  const log = resolveBattle(setup(HALF_GUARD_OWN_CELL, { seed: 2, tactics: { A: 'autonomous', B: 'leader' }, leaders: { A: 0, B: 0 } }));

  it('shields its OWN cell (guardian === target) — a pre-guard 1-damage staff bonk re-clamps to minDamage (1), not 0', () => {
    const guardedHit = log.events.find((e) => e.type === 'UnitAttacked' && e.redirectedFrom === 'A:0');
    expect(guardedHit).toBeDefined();
    if (guardedHit?.type === 'UnitAttacked') {
      expect(guardedHit.targets).toEqual([{ unit: 'A:0', damage: BALANCE.formulas.minDamage, hpAfter: expect.any(Number), outcome: 'hit' }]);
    }
  });

  it('one-shot: the very next staff bonk on the same cell, same engagement, is UNSHIELDED (full 1 damage, no redirectedFrom)', () => {
    const guardedIdx = log.events.findIndex((e) => e.type === 'UnitAttacked' && e.redirectedFrom === 'A:0');
    expect(log.events[guardedIdx + 1]).toEqual({ type: 'GuardEnded', unit: 'A:0' });
    const nextHit = log.events.slice(guardedIdx + 2).find((e) => e.type === 'UnitAttacked' && e.targets.some((t) => t.unit === 'A:0'));
    expect(nextHit).toBeDefined();
    if (nextHit?.type === 'UnitAttacked') {
      expect(nextHit.redirectedFrom).toBeUndefined();
      expect(nextHit.targets[0]?.damage).toBe(BALANCE.formulas.minDamage); // unshielded — the plain clamp, not a halved re-clamp
    }
  });

  it("A:0's mid budget is 1 action — exactly one GuardRaised the whole engagement (no re-arm to test here)", () => {
    expect(log.events.filter((e) => e.type === 'GuardRaised' && e.unit === 'A:0')).toHaveLength(1);
  });
});

/**
 * The Guard replay invariant (FR33), reconstructed from the event log across
 * ARBITRARY battles (matchSetupArb) — this is the tool that actually proves
 * one-shot-ness, own-cell/ally-behind shielding, magic bypass, and dodge
 * non-consumption hold everywhere, not just in the two hand-picked fixtures
 * above (mirrors the crit-dodge.test.ts AC4 end-to-end property pattern).
 */
describe('Guard shield replay invariant holds across ARBITRARY battles (matchSetupArb)', () => {
  let sawFull = false;
  let sawHalf = false;
  let sawAllyBehind = false;

  test.prop(
    [matchSetupArb],
    // Default 100 runs made the "ally directly behind" sub-case (needs two
    // specific smalls stacked in one column, one Guard-capable) flaky after
    // story 4.8's arbitrary started spending some armies' slots on monsters
    // instead of smalls — 500 runs brings its observation odds back up.
    { numRuns: 500 },
  )(
    'every redirectedFrom names a unit whose Guard charge was LIVE at that moment, tier-consistent damage, never on magic/dodge',
    (s) => {
      const log = resolveBattle(s);
      const roster = new Map<UnitId, { class: UnitClass; row: Row }>();
      const started = log.events[0];
      if (started?.type === 'BattleStarted') {
        for (const unit of started.units) roster.set(unit.id, { class: unit.class, row: unit.placement.row });
      }

      const live = new Set<UnitId>();
      for (const e of log.events) {
        if (e.type === 'GuardRaised') {
          const info = roster.get(e.unit);
          if (info) expect(['guard-full', 'guard-half']).toContain(BALANCE.classes[info.class].moves[info.row]);
          live.add(e.unit);
        }
        if (e.type === 'GuardEnded') {
          expect(live.has(e.unit), `GuardEnded for ${e.unit} with no live charge`).toBe(true);
          live.delete(e.unit);
        }
        if (e.type === 'UnitAttacked') {
          // Magic (blast) never Guards — structurally, since Guard is gated on
          // the ADR-0003 physical dodge/crit roll, which blast never carries.
          if (e.kind === 'blast') expect(e.redirectedFrom).toBeUndefined();
          if (e.redirectedFrom !== undefined) {
            expect(live.has(e.redirectedFrom), `redirectedFrom ${e.redirectedFrom} not live`).toBe(true);
            const info = roster.get(e.redirectedFrom);
            const tier = info ? BALANCE.classes[info.class].moves[info.row] : undefined;
            for (const t of e.targets) {
              expect(t.outcome).not.toBe('dodged'); // a dodge never reaches the guard check
              if (tier === 'guard-full') {
                sawFull = true;
                expect(t.damage).toBe(0);
              } else if (tier === 'guard-half') {
                sawHalf = true;
                expect(t.damage).toBeGreaterThanOrEqual(BALANCE.formulas.minDamage);
              }
              if (t.unit !== e.redirectedFrom) sawAllyBehind = true;
            }
          }
          // A dodged target's own event is never itself the guarded attribution
          // (single-target physical events carry exactly one target).
          for (const t of e.targets) {
            if (t.outcome === 'dodged') expect(e.redirectedFrom).toBeUndefined();
          }
        }
      }
    },
    40_000, // 500 runs (up from the default 100, see above) needs more than vitest's 5000ms default. Measured instrumented-idle: ~209ms vs the 100-run properties' ~58-85ms — 40s keeps a ≥190× load margin, same order as their 20s (story 5.0 + review)
  );

  it('the generated cases above actually exercised BOTH Guard tiers and the ally-behind case (branch reachability)', () => {
    expect(sawFull, 'no Full Guard block observed across the whole matchSetupArb property run').toBe(true);
    expect(sawHalf, 'no Half Guard block observed across the whole matchSetupArb property run').toBe(true);
    expect(sawAllyBehind, 'no ally-behind Guard block observed (only own-cell) across the whole matchSetupArb property run').toBe(true);
  });
});
