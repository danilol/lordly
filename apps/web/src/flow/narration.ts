import type { BattleEvent, UnitClass, UnitId } from '@lordly/engine';

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
  readonly hp: ReadonlyMap<UnitId, number>;
}

export function createNarrationState(): NarrationState {
  return { classes: new Map(), hp: new Map() };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Knight A:0" — capitalized class + engine unit id; falls back to the bare id for an unknown unit. */
function unitName(state: NarrationState, id: UnitId): string {
  const cls = state.classes.get(id);
  return cls ? `${cap(cls)} ${id}` : id;
}

/** Narrates one event: the lines it adds to the panel (empty for silent events) plus the advanced ledger. Pure — never mutates the input state. */
export function narrateEvent(state: NarrationState, event: BattleEvent): { lines: string[]; state: NarrationState } {
  switch (event.type) {
    case 'BattleStarted': {
      const classes = new Map<UnitId, UnitClass>();
      const hp = new Map<UnitId, number>();
      for (const unit of event.units) {
        classes.set(unit.id, unit.class);
        hp.set(unit.id, unit.hp);
      }
      return { lines: [], state: { classes, hp } };
    }
    case 'PassStarted':
      return { lines: [`— Pass ${event.pass} —`], state };
    case 'UnitAttacked': {
      const hp = new Map(state.hp);
      const lines = event.targets.map((t) => {
        const before = hp.get(t.unit) ?? t.hpAfter + t.damage;
        hp.set(t.unit, t.hpAfter);
        return `${unitName(state, event.source)} struck ${unitName(state, t.unit)} for ${t.damage} — ${before}→${t.hpAfter} HP`;
      });
      return { lines, state: { classes: state.classes, hp } };
    }
    case 'UnitHealed': {
      const hp = new Map(state.hp);
      const before = hp.get(event.target) ?? event.hpAfter - event.amount;
      hp.set(event.target, event.hpAfter);
      return {
        lines: [`${unitName(state, event.source)} healed ${unitName(state, event.target)} for ${event.amount} — ${before}→${event.hpAfter} HP`],
        state: { classes: state.classes, hp },
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
        state: { classes: state.classes, hp },
      };
    }
    case 'UnitDied':
      return { lines: [`${unitName(state, event.unit)} falls!`], state };
    case 'EngagementEnded': {
      const hp = new Map(state.hp);
      for (const [id, value] of Object.entries(event.hp)) hp.set(id as UnitId, value);
      return { lines: [`— Engagement ${event.engagement} ended —`], state: { classes: state.classes, hp } };
    }
    case 'BattleEnded': {
      const verdict = event.winner === 'draw' ? 'Draw' : event.winner === 'A' ? 'You won' : 'Enemy won';
      return { lines: [`${verdict} — ${event.hpPct.A}% vs ${event.hpPct.B}%`], state };
    }
  }
}
