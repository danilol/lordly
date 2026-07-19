import type { BattleEvent, UnitClass, UnitId } from '@lordly/engine';
import { CLASS_ABBREVIATIONS, turnBoundaryLine } from '../config/constants';

/**
 * Pure narration builder for the Battle scene's Log panel (story 2.2, AC7):
 * turns each `BattleLog` event into human-readable lines like
 * "Knight A:0 struck Archer B:1 for 12 — 78→66 HP". It reads ONLY the log
 * the scene already holds — no new data, no rule evaluation (AD-2).
 *
 * The state is a tiny LEDGER folded over the events: class names (from the
 * `BattleStarted` roster — display names are shell-side, AD-11) and each
 * unit's last-known HP, so before→after renders truthfully even on OVERKILL
 * (`damage` may exceed the HP actually removed — types.ts; `hpAfter + damage`
 * would lie there). `EngagementEnded.hp` resyncs the ledger exactly like the
 * scene's HP bars (authoritative snapshot).
 */
export interface NarrationState {
  readonly classes: ReadonlyMap<UnitId, UnitClass>;
  /** Soldier names from the BattleStarted roster (FR37, story 4.2) — narration's display key. */
  readonly names: ReadonlyMap<UnitId, string>;
  readonly hp: ReadonlyMap<UnitId, number>;
}

export function createNarrationState(): NarrationState {
  return { classes: new Map(), names: new Map(), hp: new Map() };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "Kain (KNI)" — soldier name + class code (FR37/dossier §7, story 4.2).
 * Falls back to the pre-era "Knight A:0" form when the roster carried no
 * name, and to the bare id for an unknown unit.
 */
function unitName(state: NarrationState, id: UnitId): string {
  const cls = state.classes.get(id);
  if (!cls) return id;
  const name = state.names.get(id);
  return name ? `${name} (${CLASS_ABBREVIATIONS[cls]})` : `${cap(cls)} ${id}`;
}

/** Narrates one event: the lines it adds to the panel (empty for silent events) plus the advanced ledger. Pure — never mutates the input state. */
export function narrateEvent(state: NarrationState, event: BattleEvent): { lines: string[]; state: NarrationState } {
  switch (event.type) {
    case 'BattleStarted': {
      const classes = new Map<UnitId, UnitClass>();
      const names = new Map<UnitId, string>();
      const hp = new Map<UnitId, number>();
      for (const unit of event.units) {
        classes.set(unit.id, unit.class);
        if (unit.name) names.set(unit.id, unit.name);
        hp.set(unit.id, unit.hp);
      }
      return { lines: [], state: { classes, names, hp } };
    }
    case 'PassStarted':
      // FR39a (story 4.0): the panel says "Turn" — the engine event stays PassStarted.
      return { lines: [turnBoundaryLine(event.pass)], state };
    case 'UnitAttacked': {
      const hp = new Map(state.hp);
      // Story 4.7: `redirectedFrom` names the unit whose Guard shield reduced
      // this landed hit (FR33) — the attacked unit stays the target (no
      // redirect), so this only changes the WORDING, not who took the hit.
      const guardian = event.redirectedFrom !== undefined ? unitName(state, event.redirectedFrom) : undefined;
      const lines = event.targets.map((t) => {
        const before = hp.get(t.unit) ?? t.hpAfter + t.damage;
        hp.set(t.unit, t.hpAfter);
        const src = unitName(state, event.source);
        const tgt = unitName(state, t.unit);
        // Story 4.6: each outcome narrates distinctly (a dodge shows no damage).
        if (t.outcome === 'dodged') return `${src} struck at ${tgt} — dodged!`;
        if (guardian !== undefined) {
          return t.damage === 0
            ? `${src} struck ${tgt} — ${guardian}'s guard holds, fully blocked!`
            : `${src} struck ${tgt} — ${guardian}'s guard halves it to ${t.damage} — ${before}→${t.hpAfter} HP`;
        }
        if (t.outcome === 'crit') return `${src} CRIT ${tgt} for ${t.damage} — ${before}→${t.hpAfter} HP`;
        return `${src} struck ${tgt} for ${t.damage} — ${before}→${t.hpAfter} HP`;
      });
      return { lines, state: { classes: state.classes, names: state.names, hp } };
    }
    case 'UnitHealed': {
      const hp = new Map(state.hp);
      const before = hp.get(event.target) ?? event.hpAfter - event.amount;
      hp.set(event.target, event.hpAfter);
      return {
        lines: [`${unitName(state, event.source)} healed ${unitName(state, event.target)} for ${event.amount} — ${before}→${event.hpAfter} HP`],
        state: { classes: state.classes, names: state.names, hp },
      };
    }
    case 'StatusApplied':
      return { lines: [`${unitName(state, event.source)} cast ${event.spell} on ${unitName(state, event.target)}`], state };
    case 'ActionMisfired':
      return { lines: [`${unitName(state, event.unit)} is confused — the action misfires!`], state };
    case 'ActionFizzled':
      return { lines: [`${unitName(state, event.unit)}'s action fizzles`], state };
    case 'ActionSkipped':
      if (event.reason === 'dead') return { lines: [], state }; // silent, matching the scene's silent beat
      return { lines: [event.reason === 'asleep' ? `${unitName(state, event.unit)} sleeps through the turn` : `${unitName(state, event.unit)} waits`], state };
    case 'PoisonTicked': {
      const hp = new Map(state.hp);
      const before = hp.get(event.unit) ?? event.hpAfter + event.damage;
      hp.set(event.unit, event.hpAfter);
      return {
        lines: [`Poison sears ${unitName(state, event.unit)} for ${event.damage} — ${before}→${event.hpAfter} HP`],
        state: { classes: state.classes, names: state.names, hp },
      };
    }
    case 'UnitDied':
      return { lines: [`${unitName(state, event.unit)} falls!`], state };
    case 'GuardRaised':
      // In the v4 union from story 4.2; the engine emits it from 4.7 (FR33).
      return { lines: [`${unitName(state, event.unit)} stands guard`], state };
    case 'GuardEnded':
      return { lines: [`${unitName(state, event.unit)}'s guard ends`], state };
    case 'StatusCleared':
      // Story 4.2: the between-engagement clear is log-driven (dossier §5).
      return { lines: [`The ${event.spell} lifts from ${unitName(state, event.unit)}`], state };
    case 'LeaderFell':
      // In the v4 union from story 4.2; the engine emits it from 4.5 (FR35).
      return { lines: [`Leader ${unitName(state, event.unit)} has fallen — ${event.side === 'A' ? 'your army' : 'the enemy army'} falters`], state };
    case 'EngagementEnded': {
      const hp = new Map(state.hp);
      for (const [id, value] of Object.entries(event.hp)) hp.set(id as UnitId, value);
      return { lines: [`— Engagement ${event.engagement} ended —`], state: { classes: state.classes, names: state.names, hp } };
    }
    case 'BattleEnded': {
      const verdict = event.winner === 'draw' ? 'Draw' : event.winner === 'A' ? 'You won' : 'Enemy won';
      return { lines: [`${verdict} — ${event.hpPct.A}% vs ${event.hpPct.B}%`], state };
    }
  }
}
