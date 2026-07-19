import { describe, expect, it } from 'vitest';
import { fc, test } from '@fast-check/vitest';
import { BALANCE } from '../src/balance';
import { leaderPenaltyPhysical, physicalDamage, resolveBattle, rollHit } from '../src/resolve';
import { createStreams, nextInt } from '../src/rng';
import type { MatchSetup, Unit, UnitAttacked } from '../src/types';

/**
 * Story 4.6 — FR36 crit & dodge, frozen by ADR 0003 (the battle-stream draw
 * table). These tests pin: the two new draws' ORDER and COUNT (auditable
 * fixed-count), their DEX keying (dodge = defender, crit = attacker), the crit
 * ×3/2's position in the FR15 damage order (after RPS, before Weaken), and the
 * emitted `outcome` (dodge = damage 0, magic never crits/dodges).
 */

const divisor = BALANCE.formulas.dexChanceDivisor;
const threshold = (cls: Unit['class']): number => Math.floor(BALANCE.classes[cls].dex / divisor);

describe('rollHit — ADR 0003 A3 (dodge) + A4 (crit): order, count, DEX keying', () => {
  it('consumes EXACTLY two [0,99] draws, in order — a physical single-target hit is always 2 draws (fixed-count property)', () => {
    // The "two streams agree after N manual draws" idiom (mirrors ai.test.ts):
    // replaying two [0,99] draws leaves the manual stream at the same position
    // the code left the consumed stream — so rollHit drew exactly two, no more.
    const consumed = createStreams(12345).battle;
    rollHit('knight', 'knight', consumed);
    const manual = createStreams(12345).battle;
    nextInt(manual, 0, 99); // A3 dodge
    nextInt(manual, 0, 99); // A4 crit
    expect(nextInt(consumed, 0, 0xffff)).toBe(nextInt(manual, 0, 0xffff));
  });

  it('draws two regardless of the classes/outcome — high-DEX and low-DEX pairs both consume exactly 2 (count is outcome-independent)', () => {
    for (const [a, d] of [
      ['ninja', 'ninja'],
      ['cleric', 'phalanx'],
    ] as const) {
      const consumed = createStreams(999).battle;
      rollHit(a, d, consumed);
      const manual = createStreams(999).battle;
      nextInt(manual, 0, 99);
      nextInt(manual, 0, 99);
      expect(nextInt(consumed, 0, 0xffff), `${a}->${d}`).toBe(nextInt(manual, 0, 0xffff));
    }
  });

  test.prop([fc.integer({ min: 0, max: 0xffffffff })])(
    'dodge is keyed to the DEFENDER DEX (draw 1), crit to the ATTACKER DEX (draw 2) — exact threshold, any seed',
    (seed) => {
      const { dodged, crit } = rollHit('ninja', 'cleric', createStreams(seed).battle);
      // Replay the same stream by hand: draw 1 is dodge, draw 2 is crit.
      const s = createStreams(seed).battle;
      const draw1 = nextInt(s, 0, 99);
      const draw2 = nextInt(s, 0, 99);
      expect(dodged).toBe(draw1 < threshold('cleric')); // defender
      expect(crit).toBe(draw2 < threshold('ninja')); // attacker
    },
  );

  it('same seed → identical roll; the two DEX roles do not swap (defender vs attacker pinned)', () => {
    const SEED = 7;
    const s = createStreams(SEED).battle;
    const draw1 = nextInt(s, 0, 99);
    const draw2 = nextInt(s, 0, 99);
    // Same seed, attacker/defender swapped: dodge must follow the DEFENDER's
    // DEX and crit the ATTACKER's — so the booleans track the swapped classes.
    const a = rollHit('ninja', 'cleric', createStreams(SEED).battle);
    const b = rollHit('cleric', 'ninja', createStreams(SEED).battle);
    expect(a.dodged).toBe(draw1 < threshold('cleric'));
    expect(b.dodged).toBe(draw1 < threshold('ninja'));
    expect(a.crit).toBe(draw2 < threshold('ninja'));
    expect(b.crit).toBe(draw2 < threshold('cleric'));
  });
});

describe('crit ×3/2 lands in the FR15 order: base → RPS → crit → Weaken → clamp (ADR 0003 §Chances)', () => {
  it('neutral crit: knight → knight = 24 (16 → ×3/2)', () => {
    expect(physicalDamage('knight', 'knight', false, true)).toBe(24);
  });

  it('crit AFTER RPS (stacks on the advantage): knight → archer = 54 (24 → ×3/2 adv 36 → ×3/2 crit)', () => {
    expect(physicalDamage('knight', 'archer', false, true)).toBe(54);
  });

  it('ORDER DISCRIMINATOR — crit BEFORE Weaken: archer → knight weakened+crit = 5 (base 10 → ×3/4 RPS 7 → crit floor(10.5)=10 → weaken 5; the after-Weaken order would give 4)', () => {
    // archer→knight is a ×3/4 disadvantage giving an ODD post-RPS value (7),
    // so the crit/Weaken flooring order is observable: crit-then-weaken = 5,
    // weaken-then-crit = floor(floor(7/2)·3/2) = floor(4.5) = 4.
    expect(physicalDamage('archer', 'knight', true, true)).toBe(5);
    expect(physicalDamage('archer', 'knight', false, true)).toBe(10); // same, un-weakened
    expect(physicalDamage('archer', 'knight')).toBe(7); // no crit (regression anchor)
  });

  it('crit min-1 clamp still LAST: cleric → knight crit = 1 (negative base survives)', () => {
    expect(physicalDamage('cleric', 'knight', false, true)).toBe(1);
  });

  it('leader-fall penalty composes OUTSIDE crit: A-fallen dealt ×3/4 on a neutral crit = 18 (16 → crit 24 → ×3/4 dealt)', () => {
    const f = leaderPenaltyPhysical('A', 'B', { A: true, B: false });
    expect(f('knight', 'knight', false, true)).toBe(18);
    expect(f('knight', 'knight', false, false)).toBe(12); // non-crit dealt: 16 → ×3/4
  });
});

// A drafted unit (FR37 names are required flavor, zero gameplay effect).
function u(cls: Unit['class'], element: Unit['element'], name: string): Unit {
  return { class: cls, element, name };
}

/** All ninjas vs all clerics: max-DEX attackers (crit/dodge 10%) over many hits. */
const NINJAS_VS_CLERICS: Pick<MatchSetup, 'armies' | 'placements'> = {
  armies: {
    A: [u('ninja', 'fire', 'Kage'), u('ninja', 'water', 'Rin'), u('ninja', 'wind', 'Sora'), u('ninja', 'earth', 'Taki'), u('ninja', 'fire', 'Yuki')],
    B: [u('cleric', 'earth', 'Mira'), u('cleric', 'fire', 'Nessa'), u('cleric', 'water', 'Olwen'), u('cleric', 'wind', 'Petra'), u('cleric', 'earth', 'Quinn')],
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
};

function setup(seed: number, mode: MatchSetup['mode'] = 'wipeout'): MatchSetup {
  return {
    seed,
    balanceVersion: BALANCE.version,
    mode,
    tactics: { A: 'autonomous', B: 'autonomous' },
    leaders: { A: 0, B: 0 },
    ...NINJAS_VS_CLERICS,
  };
}

describe('in-battle emission (AC3): crit & dodge fire, dodge = damage 0, magic never crits/dodges', () => {
  it('crits AND dodges both occur across seeds, and every outcome is well-formed', () => {
    let sawCrit = false;
    let sawDodge = false;
    for (let seed = 1; seed <= 40; seed++) {
      const log = resolveBattle(setup(seed));
      for (const e of log.events) {
        if (e.type !== 'UnitAttacked') continue;
        for (const t of (e as UnitAttacked).targets) {
          if (t.outcome === 'crit') sawCrit = true;
          if (t.outcome === 'dodged') {
            sawDodge = true;
            expect(t.damage, 'a dodge deals zero damage').toBe(0);
          }
          expect(t.outcome).not.toBe('missed'); // reserved, never emitted in wave 1
        }
      }
    }
    expect(sawCrit, 'expected at least one crit across 40 ninja-vs-cleric seeds').toBe(true);
    expect(sawDodge, 'expected at least one dodge across 40 ninja-vs-cleric seeds').toBe(true);
  });

  it('a dodged hit never kills and leaves HP unchanged for that beat', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const log = resolveBattle(setup(seed));
      const events = log.events;
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e?.type !== 'UnitAttacked') continue;
        for (const t of e.targets) {
          if (t.outcome !== 'dodged') continue;
          expect(t.damage).toBe(0);
          // No UnitDied for a dodging target should immediately follow this attack.
          const next = events[i + 1];
          if (next?.type === 'UnitDied') expect(next.unit).not.toBe(t.unit);
        }
      }
    }
  });

  it('magic (Mage/Sorceress blast, Cleric heal) never reports crit or dodged', () => {
    // Blast is magic — zero crit/dodge draws (ADR 0003). A mage army makes the point.
    const magicSetup: MatchSetup = {
      ...setup(3),
      armies: {
        A: [u('mage', 'fire', 'Zar'), u('mage', 'water', 'Vex'), u('mage', 'wind', 'Nyx'), u('mage', 'earth', 'Rho'), u('mage', 'fire', 'Kai')],
        B: NINJAS_VS_CLERICS.armies.B,
      },
    };
    const log = resolveBattle(magicSetup);
    for (const e of log.events) {
      if (e.type !== 'UnitAttacked' || e.kind !== 'blast') continue;
      for (const t of e.targets) expect(['hit']).toContain(t.outcome);
    }
  });

  it('replays from the seed alone — same setup → byte-identical log (crits/dodges included, FR20)', () => {
    const s = setup(11);
    expect(resolveBattle(s)).toEqual(resolveBattle(s));
  });
});
