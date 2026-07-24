import { describe, expect, it } from 'vitest';
import { fc, test } from '@fast-check/vitest';
import { BALANCE } from '../src/balance';
import { leaderPenaltyPhysical, physicalDamage, resolveBattle, rollHit } from '../src/resolve';
import { createStreams, nextInt } from '../src/rng';
import type { MatchSetup, Unit, UnitAttacked } from '../src/types';
import { matchSetupArb } from './arbitraries';

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

/**
 * Review follow-up (AC4/Task 3): the direct `rollHit` tests above prove the
 * EXACT draw count/order for that one function in isolation. This closes the
 * gap flagged at review — that the invariant should also hold END-TO-END
 * across every real call site, under fully arbitrary comps/placements/
 * tactics/seeds (`matchSetupArb`), not just the two hand-picked fixtures
 * above. `sawCrit`/`sawDodge` additionally close a related gap: proving the
 * dodge/crit branches are actually REACHED across the generated cases, not
 * merely correctly guarded if they were.
 */
describe('outcome invariant holds across ARBITRARY setups (matchSetupArb) — the AC4 end-to-end property', () => {
  let sawCrit = false;
  let sawDodge = false;

  test.prop([matchSetupArb])(
    'every physical UnitAttacked resolves hit/crit/dodged (never the reserved "missed"); every magic UnitAttacked always resolves "hit"',
    (s) => {
      const log = resolveBattle(s);
      for (const e of log.events) {
        if (e.type !== 'UnitAttacked') continue;
        const isMagic = e.kind === 'blast';
        for (const t of e.targets) {
          if (isMagic) {
            expect(t.outcome, 'magic never crits or is dodged (ADR 0003)').toBe('hit');
          } else {
            expect(['hit', 'crit', 'dodged'], 'missed is reserved, never emitted in wave 1').toContain(t.outcome);
            if (t.outcome === 'crit') sawCrit = true;
            if (t.outcome === 'dodged') sawDodge = true;
          }
        }
      }
    },
    20_000, // ~100 full battles brush Vitest's 5s default under v8-instrumented coverage load (story 5.0 review) — a load flake, not a slow assertion
  );

  it('the generated cases above actually exercised BOTH the crit and dodge branches (branch-reachability, not just correctness-if-reached)', () => {
    expect(sawCrit, 'no crit observed across the whole matchSetupArb property run').toBe(true);
    expect(sawDodge, 'no dodge observed across the whole matchSetupArb property run').toBe(true);
  });
});

/**
 * Story 4.7 — the Guard shield (`guard.test.ts` covers it in full) is a
 * post-pipeline damage reduction that runs strictly AFTER `rollHit`'s A3/A4
 * draws (and touches no stream itself — `applyGuard` takes no `Stream`
 * argument at all). This pins that the frozen draw table is UNMOVED even
 * when a hit lands on a Guard-shielded cell: a manual replay of "E1 once,
 * then A3+A4 per physical single-target `UnitAttacked`, in log order" must
 * predict EVERY outcome exactly — if Guard secretly consumed a draw, the
 * replay would desync starting at the very next hit and the predictions
 * below would stop matching.
 */
describe('a guarded hit consumes ZERO extra `battle` draws (ADR 0003, story 4.7)', () => {
  it('manually replaying E1 + 2 draws/hit predicts every outcome in a battle where a Half Guard fires', () => {
    // A:0 = Knight mid-center (guard-half); B fields five clerics whose staff
    // fallback (physical, ranged) pokes A:0 — some hits land guarded, some
    // don't, but EVERY UnitAttacked here is a physical single-target hit
    // (no blast, no confusion) — the simplest possible draw-count probe.
    const s: MatchSetup = {
      seed: 2,
      balanceVersion: BALANCE.version,
      mode: 'single',
      tactics: { A: 'autonomous', B: 'leader' },
      leaders: { A: 0, B: 0 },
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
    };
    const log = resolveBattle(s);
    const roster = new Map<string, Unit['class']>();
    const started = log.events[0];
    if (started?.type === 'BattleStarted') for (const un of started.units) roster.set(un.id, un.class);

    const attacks = log.events.filter((e): e is UnitAttacked => e.type === 'UnitAttacked');
    expect(attacks.length).toBeGreaterThan(0);
    expect(attacks.some((a) => a.redirectedFrom !== undefined)).toBe(true); // at least one guarded hit to make the pin meaningful

    const stream = createStreams(s.seed).battle;
    nextInt(stream, 0, 1); // E1 — the engagement tie flip, always first
    for (const atk of attacks) {
      expect(atk.kind).not.toBe('blast'); // sanity: this fixture is all-physical, single-target
      const target = atk.targets[0];
      if (!target) continue;
      const attackerClass = roster.get(atk.source) as Unit['class'];
      const defenderClass = roster.get(target.unit) as Unit['class'];
      const draw1 = nextInt(stream, 0, 99); // A3 dodge (defender)
      const draw2 = nextInt(stream, 0, 99); // A4 crit (attacker)
      const dodged = draw1 < threshold(defenderClass);
      const crit = draw2 < threshold(attackerClass);
      const expectedOutcome = dodged ? 'dodged' : crit ? 'crit' : 'hit';
      expect(target.outcome, `${atk.source}>${target.unit}`).toBe(expectedOutcome);
    }
  });
});
