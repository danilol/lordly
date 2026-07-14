import { describe, expect, it } from 'vitest';
import { ALL_CLASSES, BALANCE } from '@lordly/engine';
import type { UnitClass } from '@lordly/engine';
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
  const row = raw.split('\n').find((line) => line.startsWith(`| ${cap(cls)} |`));
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

  it('states the RPS triangle pairs and the exact multipliers', () => {
    for (const [attacker, target] of Object.entries(BALANCE.rpsBeats)) {
      expect(raw).toContain(`${cap(attacker)} beats ${cap(target as string)}`);
    }
    const advantage = BALANCE.formulas.rpsAdvantage.num / BALANCE.formulas.rpsAdvantage.den;
    const disadvantage = BALANCE.formulas.rpsDisadvantage.num / BALANCE.formulas.rpsDisadvantage.den;
    expect(raw).toContain(`×${advantage}`);
    expect(raw).toContain(`×${disadvantage}`);
  });

  it('states the one-way caster hunt: every hunter named with its full ×1.5 prey list (story 3.0)', () => {
    const advantage = BALANCE.formulas.rpsAdvantage.num / BALANCE.formulas.rpsAdvantage.den;
    expect(Object.keys(BALANCE.rpsHunts).length).toBeGreaterThan(0); // the rule exists — a silently emptied map must fail here
    for (const [hunter, hunted] of Object.entries(BALANCE.rpsHunts)) {
      // The doc states the hunter's COMPLETE ×1.5 prey list: triangle prey (if
      // any — a hunter need not sit inside the triangle) + hunts, in data order.
      const triangle = BALANCE.rpsBeats[hunter as UnitClass];
      const prey = [...(triangle ? [triangle] : []), ...(hunted as readonly string[])].map(cap);
      const list = prey.length === 1 ? (prey[0] as string) : `${prey.slice(0, -1).join(', ')}, and ${prey[prey.length - 1]}`;
      expect(raw).toContain(`${cap(hunter)} hunts every caster`);
      expect(raw).toContain(`×${advantage} to ${list}`);
    }
  });

  it('states the wipeout blast attenuation with the exact ratio (story 3.0 — wipeout-scoped)', () => {
    const attenuation = BALANCE.formulas.blastAttenuation.num / BALANCE.formulas.blastAttenuation.den;
    expect(raw).toContain(`takes only ×${attenuation} of the damage`);
  });

  it('states the poison damage and the wipeout engagement cap from balance data', () => {
    expect(raw).toContain(`${BALANCE.formulas.poisonDamage} damage`);
    expect(raw).toContain(`after ${BALANCE.engagementCap} engagements`);
  });

  it('names every witch spell with its element pairing', () => {
    for (const [element, spell] of Object.entries(BALANCE.elementSpells)) {
      expect(raw.toLowerCase()).toContain(`${element} → ${spell}`.toLowerCase());
    }
  });
});

describe('docs/rules.md drift guard — the review additions (every STATED number is law)', () => {
  it('the speed-order sentence lists classes exactly as balance AGI sorts them', () => {
    const order = [...ALL_CLASSES]
      .sort((a, b) => BALANCE.classes[b].agi - BALANCE.classes[a].agi)
      .map(cap)
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
