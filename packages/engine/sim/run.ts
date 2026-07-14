/**
 * The NFR4 balancing harness CLI — the ONLY effectful file in `sim/`
 * (console + process; the sweep itself is pure, see `sweep.ts`).
 *
 *   pnpm --filter @lordly/engine sim [--runs=N] [--seed=N] [--threshold=0.65] [--mode=single|wipeout]
 *
 * Sweeps AI-vs-AI round-robin over STRATEGY_POOL and reports win rates per
 * archetype and per composition. Exits non-zero when any archetype exceeds
 * the threshold (CI-composable), mirroring test/sim.test.ts's band — which
 * story 3.0 onward enforces in BOTH modes.
 */
import { STRATEGY_POOL } from '../src/ai';
import { MAX_SEED } from '../src/rng';
import { runSweep } from './sweep';
import type { SweepConfig } from './sweep';

/** Dev-tool sanity cap: pool² × runs stays a manual-run-friendly size. */
const MAX_RUNS = 500;

/**
 * Parses `--name=value`. Rejects (exit 2, clear message) rather than
 * silently coercing: an empty value (`Number('') === 0`, not NaN), a
 * non-finite value, or the flag repeated more than once.
 */
function arg(name: string, fallback: number): number {
  const hits = process.argv.filter((a) => a.startsWith(`--${name}=`));
  if (hits.length > 1) {
    console.error(`--${name} passed ${hits.length} times — pass it once`);
    process.exit(2);
  }
  if (hits.length === 0) return fallback;
  // Split on the FIRST '=' only and keep the whole remainder, so a stray '='
  // (`--runs=100=x`) is rejected below rather than silently truncated to '100'.
  const raw = hits[0]!.slice(`--${name}=`.length);
  const value = Number(raw);
  if (raw === '' || !Number.isFinite(value)) {
    console.error(`invalid --${name}: ${hits[0]}`);
    process.exit(2);
  }
  return value;
}

/** Parses the string-valued `--mode=`; same once-only, no-silent-coercion stance as `arg`. */
function modeArg(fallback: 'single' | 'wipeout'): 'single' | 'wipeout' {
  const hits = process.argv.filter((a) => a.startsWith('--mode='));
  if (hits.length > 1) {
    console.error(`--mode passed ${hits.length} times — pass it once`);
    process.exit(2);
  }
  if (hits.length === 0) return fallback;
  // First '=' only (see `arg`): `--mode=single=x` must fail, not truncate to 'single'.
  const raw = hits[0]!.slice('--mode='.length);
  if (raw !== 'single' && raw !== 'wipeout') {
    console.error(`--mode must be 'single' or 'wipeout', got ${hits[0]}`);
    process.exit(2);
  }
  return raw;
}

// Unrecognized argv is a hard error, not a silent fallback: `--runs 500`
// (space form) or a typoed flag would otherwise run the defaults and report
// a sweep the caller never asked for.
const KNOWN_FLAGS = ['runs', 'seed', 'threshold', 'mode'];
for (const a of process.argv.slice(2)) {
  if (!KNOWN_FLAGS.some((name) => a.startsWith(`--${name}=`))) {
    console.error(`unrecognized argument: ${a} (flags take the form --name=value; known: ${KNOWN_FLAGS.map((n) => `--${n}`).join(', ')})`);
    process.exit(2);
  }
}

const seedArg = arg('seed', 1);
if (!Number.isInteger(seedArg) || seedArg < 0 || seedArg > MAX_SEED) {
  // Matches createStreams' own uint32 contract (rng.ts) instead of silently
  // wrapping via `>>> 0` — the engine throws on an out-of-range seed
  // elsewhere; the CLI should be no more permissive than what it wraps.
  console.error(`--seed must be a uint32 (0..${MAX_SEED}), got ${seedArg}`);
  process.exit(2);
}

const runsArg = arg('runs', 20);
if (!Number.isFinite(runsArg) || runsArg < 1) {
  console.error(`--runs must be a positive number, got ${runsArg}`);
  process.exit(2);
}
if (runsArg > MAX_RUNS) {
  console.error(`--runs must be at most ${MAX_RUNS} (pool² × runs stays manual-run-sized), got ${runsArg}`);
  process.exit(2);
}

const thresholdArg = arg('threshold', 0.65);
if (thresholdArg < 0 || thresholdArg > 1) {
  console.error(`--threshold must be within [0, 1], got ${thresholdArg}`);
  process.exit(2);
}

const config: SweepConfig = {
  baseSeed: seedArg,
  runsPerPair: Math.floor(runsArg),
  threshold: thresholdArg,
  mode: modeArg('single'),
};

const pool = STRATEGY_POOL;
const report = runSweep(pool, config);

const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(6);
console.log(
  `lordly balancing sweep — ${pool.length} archetypes, ${report.totalGames} battles (runs=${config.runsPerPair}, seed=${config.baseSeed}, mode=${config.mode})\n`,
);

console.log('ARCHETYPES (win rate = wins + draws/2, per games):');
for (const a of report.archetypes) {
  console.log(
    `  ${pct(a.winRate)}  ${a.id.padEnd(12)} w${String(a.wins).padStart(4)} d${String(a.draws).padStart(4)} g${String(a.games).padStart(4)}  [${a.composition}]`,
  );
}

console.log('\nCOMPOSITIONS (archetypes sharing a class multiset, merged):');
for (const c of report.compositions) {
  console.log(`  ${pct(c.winRate)}  ${c.composition.padEnd(24)} via ${c.archetypeIds.join(', ')}`);
}

if (report.flagged.length > 0) {
  console.error(`\n⛔ DOMINANT (over ${pct(config.threshold).trim()}): ${report.flagged.join(', ')}`);
  process.exit(1);
}
console.log(`\n✅ no archetype exceeds the ${pct(config.threshold).trim()} band`);
