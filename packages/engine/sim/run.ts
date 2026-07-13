/**
 * The NFR4 balancing harness CLI — the ONLY effectful file in `sim/`
 * (console + process; the sweep itself is pure, see `sweep.ts`).
 *
 *   pnpm --filter @lordly/engine sim [--runs=N] [--seed=N] [--threshold=0.65]
 *
 * Sweeps AI-vs-AI round-robin over STRATEGY_POOL and reports win rates per
 * archetype and per composition. Exits non-zero when any archetype exceeds
 * the threshold (CI-composable), mirroring test/sim.test.ts's band.
 */
import { STRATEGY_POOL } from '../src/ai';
import { runSweep } from './sweep';
import type { SweepConfig } from './sweep';

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit === undefined) return fallback;
  const value = Number(hit.split('=')[1]);
  if (!Number.isFinite(value)) {
    console.error(`invalid --${name}: ${hit}`);
    process.exit(2);
  }
  return value;
}

const config: SweepConfig = {
  baseSeed: arg('seed', 1) >>> 0,
  runsPerPair: Math.max(1, Math.floor(arg('runs', 20))),
  threshold: arg('threshold', 0.65),
};

const pool = STRATEGY_POOL;
const report = runSweep(pool, config);

const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(6);
console.log(`lordly balancing sweep — ${pool.length} archetypes, ${report.totalGames} battles (runs=${config.runsPerPair}, seed=${config.baseSeed})\n`);

console.log('ARCHETYPES (win rate = wins + draws/2, per games):');
for (const a of report.archetypes) {
  console.log(`  ${pct(a.winRate)}  ${a.id.padEnd(12)} w${String(a.wins).padStart(4)} d${String(a.draws).padStart(4)} g${String(a.games).padStart(4)}  [${a.composition}]`);
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
