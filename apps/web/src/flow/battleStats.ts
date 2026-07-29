import type { BattleLog, Side, UnitClass, UnitId } from '@lordly/engine';

/**
 * The battle-stats fold (story 5.7, AD-2 — the log already carries
 * everything): ONE pass over `log.events` into per-unit counters + per-side
 * totals. Pure — no Phaser, no flow state — so the Result scene is only a
 * projection and the semantics live in tests.
 *
 * The semantics (the story's contract, restated where they're enforced):
 * - `dealt` sums raw `targets[].damage` by SOURCE — the popup numbers, which
 *   can exceed HP removed on a killing blow (the OB64-honest read; `hpAfter`
 *   stays the bars' business). Misfire friendly-fire counts: the marker's
 *   effect event carries the real source, and hiding it would lie.
 * - `taken` sums the same entries by TARGET, plus `PoisonTicked.damage`
 *   (tracked separately as `poisonTaken` too — poison has NO actor, so it is
 *   nobody's `dealt`; the conservation law is Σdealt + Σpoison = Σtaken).
 * - `crits` count the source's `'crit'` entries; `dodges` credit the DODGER
 *   (the attacker's whiff is the same event seen from the other side).
 * - `blocks` credit the GUARDIAN via `redirectedFrom` — attribution, not a
 *   retarget (Danilo's 2026-07-19 revision): the attacked unit still takes
 *   the (already post-Guard) damage.
 * - `healsGiven`/`healsReceived` sum `UnitHealed.amount` — the EFFECTIVE
 *   restore (FR11 caps at max HP), so give and receive conserve exactly.
 * - `statusesApplied` counts `StatusApplied` by source (a wasted no-stack
 *   cast emits `ActionFizzled`, so it never counts).
 * Every other event type is deliberately outside the fold — including
 * `EngagementEnded.hp`, which legitimately disagrees with damage sums under
 * overkill and must never be cross-checked against them.
 */

/** One unit's battle line. Identity comes from the `BattleStarted` roster (AC2: id-keyed, so wipeout aggregation and mid-battle deaths keep their sums). */
export interface UnitStats {
  id: UnitId;
  side: Side;
  class: UnitClass;
  name: string;
  dealt: number;
  taken: number;
  /** The poison share of `taken`, kept visible on its own (the epic names poison ticks as a first-class read). */
  poisonTaken: number;
  crits: number;
  dodges: number;
  blocks: number;
  healsGiven: number;
  healsReceived: number;
  statusesApplied: number;
}

/** The per-side sums of the unit rows — same counter names, no extras. */
export type SideTotals = Omit<UnitStats, 'id' | 'side' | 'class' | 'name'>;

export interface BattleStats {
  /** BattleStarted roster order — the same order every comp surface renders. */
  units: UnitStats[];
  totals: Record<Side, SideTotals>;
}

const zeroCounters = () => ({ dealt: 0, taken: 0, poisonTaken: 0, crits: 0, dodges: 0, blocks: 0, healsGiven: 0, healsReceived: 0, statusesApplied: 0 });

/**
 * Folds a complete battle log into per-unit stats + per-side totals.
 * Deterministic: same events in, same stats out (the replay contract).
 * Provenance-agnostic FOR REAL (5.7 review): a log that doesn't open with
 * `BattleStarted` (empty, foreign, corrupt) folds to empty stats instead of
 * crashing the Result screen — the engine guarantees the shape, this
 * function doesn't get to assume it.
 */
export function battleStats(log: BattleLog): BattleStats {
  const first = log.events[0];
  if (first?.type !== 'BattleStarted') {
    return { units: [], totals: { A: zeroCounters(), B: zeroCounters() } };
  }
  const roster = first.units;
  const units: UnitStats[] = roster.map((snap) => ({ id: snap.id, side: snap.side, class: snap.class, name: snap.name, ...zeroCounters() }));
  const byId = new Map<UnitId, UnitStats>(units.map((entry) => [entry.id, entry]));

  for (const event of log.events) {
    switch (event.type) {
      case 'UnitAttacked': {
        const source = byId.get(event.source);
        if (event.redirectedFrom !== undefined) {
          const guardian = byId.get(event.redirectedFrom);
          if (guardian) guardian.blocks += 1;
        }
        for (const hit of event.targets) {
          const target = byId.get(hit.unit);
          if (source) {
            source.dealt += hit.damage;
            if (hit.outcome === 'crit') source.crits += 1;
          }
          if (target) {
            target.taken += hit.damage;
            if (hit.outcome === 'dodged') target.dodges += 1;
          }
          // `outcome: 'missed'` (reserved in the union, unused by the engine)
          // deliberately counts NOTHING here — its damage is 0 by contract,
          // and no counter claims it. A decision, not an accident (5.7
          // review): if 'missed' ever activates, this line is where its
          // semantics get chosen, and a synthetic-log test pins today's.
        }
        break;
      }
      case 'UnitHealed': {
        const source = byId.get(event.source);
        const target = byId.get(event.target);
        if (source) source.healsGiven += event.amount;
        if (target) target.healsReceived += event.amount;
        break;
      }
      case 'StatusApplied': {
        const source = byId.get(event.source);
        if (source) source.statusesApplied += 1;
        break;
      }
      case 'PoisonTicked': {
        const unit = byId.get(event.unit);
        if (unit) {
          unit.taken += event.damage;
          unit.poisonTaken += event.damage;
        }
        break;
      }
      default:
        break; // markers, guards, deaths, engagement/battle framing — not counters
    }
  }

  const totals: Record<Side, SideTotals> = { A: zeroCounters(), B: zeroCounters() };
  for (const entry of units) {
    const side = totals[entry.side];
    side.dealt += entry.dealt;
    side.taken += entry.taken;
    side.poisonTaken += entry.poisonTaken;
    side.crits += entry.crits;
    side.dodges += entry.dodges;
    side.blocks += entry.blocks;
    side.healsGiven += entry.healsGiven;
    side.healsReceived += entry.healsReceived;
    side.statusesApplied += entry.statusesApplied;
  }
  return { units, totals };
}

/** A stat for a width-budgeted surface: 4 digits, then `9999+` (5.7 review — nothing pinned the pins' own digit assumption). */
export function clampStat(n: number): string {
  return n > 9999 ? '9999+' : String(n);
}

/**
 * One side's compact totals line for the SUMMARY SHEET (story 5.7 — pure
 * string building, so the exact read is pinned by test, not eyeballed):
 * `▲dealt ▼taken · CRIT n · DGE n · BLK n · HEAL given`. The arrows are the
 * device-round-1 fix (2026-07-29: Danilo read `633/198` and asked what it
 * meant — a slash pairs two numbers without saying which is which; ▲ = sent
 * out, ▼ = received). Round 2 moved these lines INSIDE the summary sheet and
 * dropped the old `DMG ` prefix: the arrows carry the label, and the worst
 * wipeout width must fit the sheet's inner 316px (pinned) — full words never
 * fit any of these budgets. Poison and statuses stay off the line — the
 * per-unit sheet carries the full table.
 */
export function statsStripLine(t: SideTotals): string {
  return `▲${clampStat(t.dealt)} ▼${clampStat(t.taken)} · CRIT ${t.crits} · DGE ${t.dodges} · BLK ${t.blocks} · HEAL ${t.healsGiven}`;
}

/**
 * The summary sheet's bar scale (story 5.7, device round 2 — the LoL-style
 * read): ONE max across every unit's dealt AND taken, so all bars share a
 * scale and lengths are comparable across units, sides, and the two metrics.
 * Never below 1 — a zero-damage battle (all-guard walls) must not divide by
 * zero into NaN-width bars.
 */
export function statsBarMax(units: UnitStats[]): number {
  return Math.max(1, ...units.map((entry) => Math.max(entry.dealt, entry.taken)));
}
