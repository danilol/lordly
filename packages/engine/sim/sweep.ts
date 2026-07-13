import { chooseSetup } from '../src/ai';
import type { StrategyArchetype } from '../src/ai';
import { BALANCE } from '../src/balance';
import { resolveBattle } from '../src/resolve';
import { createStreams, rollElement } from '../src/rng';
import type { MatchSetup } from '../src/types';

/**
 * The PURE sweep core of the NFR4 balancing harness: AI-vs-AI round-robin
 * over the strategy pool, flagging dominant archetypes. Importable by tests
 * (the CI acceptance band lives on top of `runSweep`); the CLI entry
 * (`sim/run.ts`) is the only effectful file in `sim/`.
 *
 * Deterministic by construction: every match seed derives from
 * (baseSeed, pair index, run index) — no clock, no ambient randomness — so
 * a sweep is replayable from its config alone.
 */
export interface SweepConfig {
  /** uint32 base for the deterministic per-match seed schedule. */
  baseSeed: number;
  /** Battles per ordered archetype pairing. */
  runsPerPair: number;
  /** Aggregate win-rate line above which an archetype is flagged (AC3 band: 0.65). */
  threshold: number;
}

/** Per-archetype tally. Win rate = (wins + draws/2) / games (draws are half-credit — recorded decision). */
export interface ArchetypeStats {
  id: string;
  name: string;
  /** Sorted class-multiset key, e.g. "archer+archer+knight" — the composition this archetype fields. */
  composition: string;
  games: number;
  wins: number;
  draws: number;
  winRate: number;
}

/** Archetypes sharing a class multiset, merged — compositions are the NFR4 balance question. */
export interface CompositionStats {
  composition: string;
  archetypeIds: string[];
  games: number;
  wins: number;
  draws: number;
  winRate: number;
}

export interface SweepReport {
  /** Total battles resolved (pool² × runsPerPair). */
  totalGames: number;
  /** Per-archetype stats, sorted by descending win rate. */
  archetypes: ArchetypeStats[];
  /** Per-composition rollup, sorted by descending win rate. */
  compositions: CompositionStats[];
  /** Archetype ids whose aggregate win rate exceeds the threshold. */
  flagged: string[];
}

/** The sorted class-multiset key for an archetype's composition. */
function compositionKey(archetype: StrategyArchetype): string {
  return [...archetype.classes].sort().join('+');
}

/**
 * Sweeps every ordered archetype pairing (self-pairings included — the
 * sides' streams differ, so a mirror pairing is a legitimate match, not an
 * artifact) × `runsPerPair` seeded battles, and tallies verdicts.
 *
 * Each match is assembled EXACTLY as MatchFlow will (recorded spec
 * decision — the sim is the shell's reference implementation): the pairing
 * is forced through a SINGLETON pool per side, so the real `chooseSetup`
 * pick+mirror path runs on the real `ai/A`/`ai/B` streams; elements are
 * rolled per unit in army order on `elements/A`/`elements/B` (AD-9); the
 * verdict is read from `BattleEnded` only (AD-2/AD-12 — the log is the
 * contract).
 */
export function runSweep(pool: readonly StrategyArchetype[], config: SweepConfig): SweepReport {
  const tally = new Map<string, ArchetypeStats>();
  for (const a of pool) {
    if (tally.has(a.id)) throw new Error(`runSweep: duplicate archetype id "${a.id}"`);
    tally.set(a.id, { id: a.id, name: a.name, composition: compositionKey(a), games: 0, wins: 0, draws: 0, winRate: 0 });
  }

  let totalGames = 0;
  pool.forEach((archA, indexA) => {
    pool.forEach((archB, indexB) => {
      const pairIndex = indexA * pool.length + indexB;
      // A self-pairing (archA.id === archB.id) shares ONE tally entry for
      // both "sides" (`tally.get` returns the identical object). Its
      // "winner" is an artifact of tie-breaks/positional asymmetry between
      // two IDENTICAL archetypes — it says nothing about dominance over
      // OTHER strategies, so it is credited as a draw (0.5) unconditionally,
      // as ONE game (review-caught defect: the original code counted it as
      // TWO games, which happened to still average to a neutral 0.5 only by
      // arithmetic coincidence — see the fixed test's derivation).
      const selfPair = archA.id === archB.id;
      for (let run = 0; run < config.runsPerPair; run++) {
        // Deterministic uint32 seed schedule; >>> 0 keeps createStreams' contract.
        const seed = (config.baseSeed + pairIndex * config.runsPerPair + run) >>> 0;
        const winner = playMatch(archA, archB, seed);
        totalGames += 1;

        const statsA = tally.get(archA.id) as ArchetypeStats;
        const statsB = tally.get(archB.id) as ArchetypeStats;
        statsA.games += 1;
        if (selfPair) {
          statsA.draws += 1;
          continue;
        }
        statsB.games += 1;
        if (winner === 'A') statsA.wins += 1;
        else if (winner === 'B') statsB.wins += 1;
        else {
          statsA.draws += 1;
          statsB.draws += 1;
        }
      }
    });
  });

  const archetypes = [...tally.values()].map((s) => ({ ...s, winRate: s.games === 0 ? 0 : (s.wins + s.draws / 2) / s.games }));
  archetypes.sort((a, b) => b.winRate - a.winRate || a.id.localeCompare(b.id));

  const byComposition = new Map<string, CompositionStats>();
  for (const a of archetypes) {
    const comp = byComposition.get(a.composition) ?? { composition: a.composition, archetypeIds: [], games: 0, wins: 0, draws: 0, winRate: 0 };
    comp.archetypeIds.push(a.id);
    comp.games += a.games;
    comp.wins += a.wins;
    comp.draws += a.draws;
    byComposition.set(a.composition, comp);
  }
  const compositions = [...byComposition.values()].map((c) => ({ ...c, winRate: c.games === 0 ? 0 : (c.wins + c.draws / 2) / c.games }));
  compositions.sort((a, b) => b.winRate - a.winRate || a.composition.localeCompare(b.composition));

  const flagged = archetypes.filter((a) => a.winRate > config.threshold).map((a) => a.id);

  return { totalGames, archetypes, compositions, flagged };
}

/** One AI-vs-AI battle: forced pairing, real streams, verdict from the log. */
function playMatch(archA: StrategyArchetype, archB: StrategyArchetype, seed: number): 'A' | 'B' | 'draw' {
  const streams = createStreams(seed);
  const a = chooseSetup([archA], streams['ai/A']);
  const b = chooseSetup([archB], streams['ai/B']);
  const setup: MatchSetup = {
    seed,
    balanceVersion: BALANCE.version,
    mode: 'single',
    armies: {
      A: a.classes.map((cls) => ({ class: cls, element: rollElement(streams['elements/A']) })),
      B: b.classes.map((cls) => ({ class: cls, element: rollElement(streams['elements/B']) })),
    },
    placements: { A: a.placement, B: b.placement },
  };
  const log = resolveBattle(setup);
  for (const event of log.events) {
    if (event.type === 'BattleEnded') return event.winner;
  }
  /* v8 ignore next 2 -- resolveBattle always ends with BattleEnded (AD-12); unreachable by contract. */
  throw new Error('BattleLog missing BattleEnded');
}
