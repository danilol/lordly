import { describe, expect, it } from 'vitest';
import { ALL_CLASSES, BALANCE, MAX_MONSTERS_PER_ARMY, SLOT_COST } from '@lordly/engine';
import type { UnitClass } from '@lordly/engine';
import { CLASS_DISPLAY_NAME } from '../src/config/constants';
import { classRulesCard } from '../src/flow/draftModel';
import { isTableSeparator } from '../src/flow/rulesDoc';

/**
 * The AC2 drift guard (story 2.4): docs/rules.md is the player-facing rules
 * artifact the Help scene renders — every NUMBER in it is pinned to the
 * engine's balance data here, so a future balance change that forgets the
 * rules doc fails the build instead of shipping a lying Help screen (the
 * FR31 license-gate pattern applied to rules content).
 */
// The same ?raw import the Help scene uses — typechecking it here also proves the mechanism.
import raw from '../../../docs/rules.md?raw';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The class-table row cells for one class, split on `|`. */
function tableRow(cls: UnitClass): string[] {
  const row = raw.split('\n').find((line) => line.startsWith(`| ${CLASS_DISPLAY_NAME[cls]} |`));
  expect(row, `table row for ${cls}`).toBeDefined();
  // Slice off the OUTER pipe segments only — interior empties keep position
  // (mirrors the parser; review: a shared filter bug had correlated failures).
  return (row as string)
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
}

describe('docs/rules.md drift guard (story 2.4, AC2/AC6 — numbers are law)', () => {
  it('has a table row for every engine class with the exact HP and per-row action counts', () => {
    for (const cls of ALL_CLASSES) {
      const [, , hp, actions] = tableRow(cls);
      const stats = BALANCE.classes[cls];
      expect(hp, `${cls} hp`).toBe(String(stats.hp));
      expect(actions, `${cls} actions`).toBe(`${stats.actions.front}/${stats.actions.mid}/${stats.actions.back}`);
    }
  });

  it('table roles and behaviors match the Draft cards (CLASS_TEXT via classRulesCard) — AC6 consistency', () => {
    for (const cls of ALL_CLASSES) {
      const [, role, , , behavior] = tableRow(cls);
      const card = classRulesCard(cls);
      expect(role, `${cls} role`).toBe(card.role);
      expect(behavior, `${cls} behavior`).toBe(card.behavior);
    }
  });

  it('states every ROLE matchup (story 4.3) and the exact multipliers', () => {
    // Matchups live on the role now (AD-4): the doc states each relation as
    // "<Attacker> beats <Defender>" (symmetric) or "<Attacker> hunts <Defender>"
    // (one-way, no reverse penalty), derived straight from balance data.
    for (const rel of BALANCE.roleRelations) {
      const verb = rel.kind === 'hunt' ? 'hunts' : 'beats';
      expect(raw, `${rel.attacker} ${verb} ${rel.defender}`).toContain(`${cap(rel.attacker)} ${verb} ${cap(rel.defender)}`);
    }
    expect(BALANCE.roleRelations.some((r) => r.kind === 'hunt')).toBe(true); // the one-way hunt exists — a silently emptied set must fail here
    const advantage = BALANCE.formulas.rpsAdvantage.num / BALANCE.formulas.rpsAdvantage.den;
    const disadvantage = BALANCE.formulas.rpsDisadvantage.num / BALANCE.formulas.rpsDisadvantage.den;
    expect(raw).toContain(`×${advantage}`);
    expect(raw).toContain(`×${disadvantage}`);
  });

  it('states the wipeout blast attenuation with the exact ratio (story 3.0 — wipeout-scoped)', () => {
    const attenuation = BALANCE.formulas.blastAttenuation.num / BALANCE.formulas.blastAttenuation.den;
    expect(raw).toContain(`takes only ×${attenuation} of the damage`);
  });

  it('states the poison damage and the wipeout engagement cap from balance data', () => {
    expect(raw).toContain(`${BALANCE.formulas.poisonDamage} damage`);
    expect(raw).toContain(`after ${BALANCE.engagementCap} engagements`);
  });

  it('states the leader-fall sober-package ratios with the exact multipliers (story 4.5)', () => {
    const dealt = BALANCE.formulas.leaderFallDealt.num / BALANCE.formulas.leaderFallDealt.den;
    const taken = BALANCE.formulas.leaderFallTaken.num / BALANCE.formulas.leaderFallTaken.den;
    expect(raw).toContain(`deal only ×${dealt}`);
    expect(raw).toContain(`take ×${taken}`);
  });

  it('states the crit multiplier and the DEX crit/dodge divisor from balance data (story 4.6)', () => {
    const crit = BALANCE.formulas.critMultiplier.num / BALANCE.formulas.critMultiplier.den;
    expect(raw).toContain(`×${crit}`); // ×1.5 crit
    expect(raw).toContain(`DEX ÷ ${BALANCE.formulas.dexChanceDivisor}`); // the crit/dodge chance rule
  });

  it('names every witch spell with its element pairing', () => {
    for (const [element, spell] of Object.entries(BALANCE.elementSpells)) {
      expect(raw.toLowerCase()).toContain(`${element} → ${spell}`.toLowerCase());
    }
  });
});

describe('docs/rules.md drift guard — per-row moves and Guard (story 4.7, FR32/FR33)', () => {
  it('names exactly the classes/rows the frozen move table (BALANCE.classes[*].moves) actually varies', () => {
    // Knight: mid row Guards (half); front/back stay slash — pinned by the
    // "Mid row Guards instead of attacking" behavior string (drift-checked
    // against classRulesCard above) PLUS the data fact itself here.
    expect(BALANCE.classes.knight.moves.mid).toBe('guard-half');
    expect(BALANCE.classes.knight.moves.front).toBe('slash');
    expect(BALANCE.classes.knight.moves.back).toBe('slash');
    expect(raw).toContain('Knight in the mid row');

    // Phalanx: front+mid Guard (full); back bashes.
    expect(BALANCE.classes.phalanx.moves.front).toBe('guard-full');
    expect(BALANCE.classes.phalanx.moves.mid).toBe('guard-full');
    expect(BALANCE.classes.phalanx.moves.back).toBe('bash');
    expect(raw).toContain('a Phalanx in the front or mid row');

    // Wizard(mage)/Sorceress: front is a physical melee-targeted staff jab, not the blast.
    for (const cls of ['mage', 'sorceress'] as const) {
      expect(BALANCE.classes[cls].moves.front, cls).toBe('staff');
      expect(BALANCE.classes[cls].moves.mid, cls).toBe('blast');
      expect(BALANCE.classes[cls].moves.back, cls).toBe('blast');
    }
    expect(raw).toContain('front row swings a weak, melee-targeted staff jab');

    // Every OTHER class stays uniform across all three rows — the doc never
    // claims a row-dependent move for them.
    for (const cls of ALL_CLASSES) {
      if (['knight', 'phalanx', 'mage', 'sorceress'].includes(cls)) continue;
      const { front, mid, back } = BALANCE.classes[cls].moves;
      expect(front, cls).toBe(mid);
      expect(mid, cls).toBe(back);
    }
  });

  it('states the Full/Half Guard shield with the exact Half ratio (BALANCE.formulas.guardHalf)', () => {
    expect(raw).toContain('negates it completely'); // Full — no ratio needed, damage is exactly 0
    const half = BALANCE.formulas.guardHalf.num / BALANCE.formulas.guardHalf.den;
    expect(half, 'guardHalf must be exactly 1/2 for "halves" to read true').toBe(0.5);
    expect(raw).toContain("Knight's halves it");
  });
});

describe('docs/rules.md drift guard — the review additions (every STATED number is law)', () => {
  it('the speed-order sentence lists classes exactly as balance AGI sorts them', () => {
    const order = [...ALL_CLASSES]
      .sort((a, b) => BALANCE.classes[b].agi - BALANCE.classes[a].agi)
      .map((c) => CLASS_DISPLAY_NAME[c])
      .join(', ');
    expect(raw).toContain(order);
  });

  it('the confusion misfire chance matches balance data', () => {
    const pct = (100 * BALANCE.formulas.confusionMisfire.num) / BALANCE.formulas.confusionMisfire.den;
    expect(raw).toContain(`${pct}% chance`);
  });

  it('the class table has exactly one data row per engine class — no stale or duplicate rows', () => {
    const rows = raw.split('\n').filter((l) => l.trim().startsWith('|') && !isTableSeparator(l.trim()));
    expect(rows).toHaveLength(ALL_CLASSES.length + 1); // + the header row
  });
});

describe('docs/rules.md drift guard — Monsters (story 4.8, FR38)', () => {
  it('states the Golem’s slot cost and the monster-count cap from balance data', () => {
    expect(raw).toContain(`costs **${SLOT_COST.monster} of your ${BALANCE.slotBudget} slots**`);
    expect(raw).toContain(`at most **${MAX_MONSTERS_PER_ARMY}**`);
    expect(BALANCE.classes.golem.sizeClass).toBe('monster');
  });

  it('states the Golem’s role exactly as BALANCE.classes.golem.role reads, with no role-relation bonus either way', () => {
    expect(BALANCE.classes.golem.role).toBe('brute');
    expect(raw).toContain('Brute');
    expect(BALANCE.roleRelations.some((r) => r.attacker === 'brute' || r.defender === 'brute')).toBe(false);
  });

  // Device-reported follow-up (2026-07-19): the initial ship only forbade two
  // monsters SHARING a column; a player found two Golems standing in
  // neighboring columns (visibly touching) still went through. A second round
  // confirmed against the source game found the ban is broader still — NO
  // unit, human or monster, may stand beside one — and found a Golem could be
  // crowned as leader. All three are now real engine rules — pin the doc's
  // wording of each so a future rewrite can't silently drop them.
  it('states no unit — human or monster — may stand directly beside a Golem', () => {
    expect(raw).toContain('No unit may stand directly beside one');
  });

  it('states a Golem can never be crowned as leader', () => {
    expect(raw.toLowerCase()).toContain('cannot be crowned');
  });
});
