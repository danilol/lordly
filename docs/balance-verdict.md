# Balance Verdict (NFR4)

Story 4.12 — the epic-4 closing certification. Swept and certified 2026-07-20 against the deployed squad-era build (`balanceVersion` 9; 4.8–4.11 shipped to production the same day). Not an ADR (no architectural decision) — a standing measurement record, per NFR3, sibling to `performance-verdict.md`. The numbers here are living (PRD Open Item 1): a future pool or balance edit re-runs this sweep and updates this doc.

## Verdict summary

| Requirement | Band / target | Result | Status |
|---|---|---|---|
| No dominant archetype, **single** mode (FR14/NFR4) | ≤ 65% aggregate win rate | **Top: cabal 64.1%** (stable at runs=200 **and** runs=500) — every archetype in band | ✅ Pass |
| No dominant archetype, **wipeout** mode (FR14/NFR4) | ≤ 65% aggregate win rate | **Top: farshot 65.3%** at convergence (runs=500) — a consciously-accepted 0.3% deviation (below); everything else ≤ 62.1% | ⚠️ Pass w/ recorded deviation |
| All 12 classes exercised by the sweep (Open Item 5) | 12/12 in ≥1 archetype | **12/12**, build-guarded by `ai.test.ts` reverse-coverage | ✅ Pass |
| Melee viable, not collapsed (the 3.0 wasted-swing floor) | wardens > 25%, ≤ band | **wardens: 31.7% single / 43.3% wipeout** (vs the 3.0 33% single baseline) | ✅ Pass |
| 10-engagement wipeout compounding (FR19) | poison persists + ticks; blast ×3/4 to the cap | Verified by `wipeout.test.ts` (poison persistence; blast attenuation to `engagementCap` = 10) | ✅ Pass |
| Recorded with evidence | NFR3 | This document | ✅ Pass |

**Tuning decision:** **none applied.** The squad era certifies in-band at `balanceVersion` **9** — no balance-data change, no version bump (a bump invalidates replay history, AD-8/3.2, so it is not free). The single marginal crossing (farshot, wipeout, 65.3%) was accepted as a recorded deviation rather than tuned (Danilo, 2026-07-20).

## Methodology

- **Harness:** the dev CLI in `packages/engine` — `sim/run.ts` (the only effectful file, reads flags + prints) over `sim/sweep.ts`'s pure `runSweep`. No app/Phaser/DOM dependency; engine purity (`purity.test.ts` + the lint AST rules) intact. Invoke: `pnpm --filter @lordly/engine sim -- --runs=N --seed=N --threshold=0.65 --mode=single|wipeout` (CLI caps at 500 runs).
- **What the sweep covers:** all 12 `STRATEGY_POOL` archetypes paired against each other (a self-pairing counts once, forced-neutral 0.5). Per pairing, each side independently draws its own **tactic** (all 4: autonomous / weakest / strongest / leader) and **leader index** from its own `ai/*` RNG stream via `chooseSetup`, and elements roll per side — so tactic × leader × element variation is exercised **across the run budget**, not fixed per archetype. Both monster compositions (`golem-wall` = 1 golem, `twin-golems` = 2) are in the pool.
- **Determinism:** every sweep is a pure function of (pool, baseSeed, runsPerPair, mode) — bit-identical every run (no clock, no `Math.random`). Reported numbers are reproducible from the commands below.
- **Convergence:** `sim.test.ts` documents convergence at runsPerPair ≥ 150–200. Both the runs=200 and runs=500 sweeps below were captured for this verdict; where they disagree on band membership the heavier (500) run is treated as the truth.
- **CI band:** `test/sim.test.ts` re-runs the identical band at a fast **runsPerPair 15, seed 1** in **both modes** — the enforced, deterministic gate on every build. It is a proxy for the convergence truth, not the truth itself (see the farshot deviation).

Commands of record:

```sh
pnpm --filter @lordly/engine sim -- --runs=200 --seed=1 --threshold=0.65 --mode=single
pnpm --filter @lordly/engine sim -- --runs=200 --seed=1 --threshold=0.65 --mode=wipeout
pnpm --filter @lordly/engine sim -- --runs=500 --seed=1 --threshold=0.65 --mode=single   # convergence confirmation
pnpm --filter @lordly/engine sim -- --runs=500 --seed=1 --threshold=0.65 --mode=wipeout  # convergence confirmation
```

## Converged win rates — single mode (runs=200, seed=1, 28,800 battles)

| Archetype | Win rate | Composition |
|---|---|---|
| cabal | 64.1% | cleric + mage + mage + ninja + witch |
| gale | 58.7% | archer + archer + mage + sorceress + witch |
| hex-coven | 56.2% | knight + knight + witch + witch + witch |
| longbows | 56.1% | archer + archer + archer + cleric + knight |
| farshot | 52.9% | archer + archer + cleric + mage + witch |
| ambushers | 52.7% | archer + mage + mercenary + mercenary + witch |
| three-mages | 51.2% | knight + knight + mage + mage + mage |
| bulwark | 50.2% | berserker + knight + knight + knight + knight |
| golem-wall | 45.3% | archer + archer + golem + witch |
| talons | 41.4% | archer + archer + archer + mercenary + valkyrie |
| twin-golems | 39.4% | cleric + golem + golem |
| wardens | 31.7% | archer + knight + mercenary + mercenary + phalanx |

Top **cabal 64.1%** — identical at runs=500 (cabal 64.1%, wardens 31.7%), confirming convergence. No archetype exceeds the band.

## Converged win rates — wipeout mode (runs=200, seed=1, 28,800 battles)

| Archetype | Win rate (runs=200) | Win rate (runs=500) | Composition |
|---|---|---|---|
| farshot | 64.4% | **65.3%** ⚠️ | archer + archer + cleric + mage + witch |
| longbows | 62.3% | 62.1% | archer + archer + archer + cleric + knight |
| hex-coven | 58.5% | 58.9% | knight + knight + witch + witch + witch |
| cabal | 57.7% | 57.8% | cleric + mage + mage + ninja + witch |
| twin-golems | 52.0% | 52.9% | cleric + golem + golem |
| golem-wall | 49.7% | 49.3% | archer + archer + golem + witch |
| bulwark | 47.9% | 48.7% | berserker + knight + knight + knight + knight |
| ambushers | 46.4% | 44.8% | archer + mage + mercenary + mercenary + witch |
| wardens | 43.3% | 42.8% | archer + knight + mercenary + mercenary + phalanx |
| three-mages | 42.4% | 40.9% | knight + knight + mage + mage + mage |
| gale | 40.3% | 41.2% | archer + archer + mage + sorceress + witch |
| talons | 35.0% | 35.6% | archer + archer + archer + mercenary + valkyrie |

## The farshot deviation (wipeout, 65.3%) — recorded, accepted, not tuned

At runs=200 farshot reads 64.4% (in band). At the heavier runs=500 convergence it reads a **stable 65.3% across seeds 1, 2, and 3** — a genuine 0.3% crossing of the ≤65% band, not seed noise. (The systematic 200→500 lift is the additional tactic/leader/element combinations sampled at the higher run count tilting slightly in farshot's favor; it is a global-range snipe-and-support comp that benefits from wider sampling.)

**Decision (Danilo, 2026-07-20): accept as a conscious band widening, do not tune.** Rationale:

- The breach is 0.3%, at the very edge of the band.
- farshot is only **52.9% single-mode** — it is not dominant across modes, only marginally in the wipeout tail.
- Tuning would be a `STRATEGY_POOL` placement edit (in `ai.ts`, cheap — no `balanceVersion` bump, no golden re-record, no replay invalidation) but risked nudging the chasing pack (longbows 62.1%) and re-opening a settled meta for a sub-1% gain.
- The enforced CI gate (`sim.test.ts`, runsPerPair 15, seed 1) stays green in both modes; this doc carries the honest converged number. The discrepancy is annotated in `sim.test.ts` beside the wipeout band test.

## Melee floor — the 3.0 wasted-swing check

Story 3.0 flagged the melee-heavy `wardens` at a 33% single-mode floor and hoped tactics would lift it. Converged here:

- **wardens single-mode: 31.7%** — around the 3.0 mark (the 4.4 melee blockade means a target tactic no longer strictly *lifts* melee, so this is a happy result, not a regression). Viable, well above the 25% collapse line, and not dominant.
- **wardens wipeout: 43.3%** — comfortably healthy; the longer grind favors its durable front.

Melee is a playable strategy across both modes, pinned in CI by `sim.test.ts`'s wardens viability assertion (`> 0.25`, `≤ band`).

## 10-engagement wipeout compounding (FR19)

`engagementCap` = **10** (`balance.ts`), raised 5→10 per FR19's 2026-07-16 amendment. Verified in `wipeout.test.ts`:

- **Poison persists across engagements and ticks at every natural engagement end** — the between-engagement reset clears every status *except* poison (narrated as `StatusCleared` at the seam); poison keeps ticking while its carrier lives. (Existing pin, re-confirmed green post-monster / post-4.7-guard.)
- **`blastAttenuation` ×3/4 is wipeout-only and applies through the whole 10-engagement grind** (story 4.12 addition): a three-mage battery screened behind knights vs a five-cleric wall runs the full `engagementCap` with no deaths, and every Mage row-blast — engagement 1 through engagement 10 — lands the attenuated value (13 vs the un-attenuated 18 at `balanceVersion` 9). The same comp in single mode lands the un-attenuated value in engagement 1. This is the FR10 compounding guard the wipeout band relies on: without it, un-attenuated blasts compound across engagements into dominance (the v1 baseline had three-mages at 74.6%).
- **The cap is the termination guarantee**: an equilibrium comp (mutual heals outpacing chip) runs exactly 10 engagements then judges by FR18.

## Coverage certification (Open Item 5 / AC1)

- **All 12 classes** (knight, mercenary, archer, mage, cleric, witch, berserker, phalanx, ninja, valkyrie, sorceress, golem) appear in ≥1 `STRATEGY_POOL` archetype — the five 4.3 smalls folded in via single-unit swaps, the golem via the two dedicated 4.8 monster comps. **Build-guarded** by the reverse-coverage test in `ai.test.ts` (a class silently dropped from every archetype now fails CI).
- **Tactics:** all 4 exercised as a per-side per-run stream draw (pinned in `ai.test.ts`).
- **Leaders:** seeded leader-index variation drawn per side per run (never always unit 0; monsters ineligible to be crowned).
- **Monsters:** both compositions present (`golem-wall`, `twin-golems`), both in band in both modes.
- **Harness stays a dev CLI** in `packages/engine` — no app/runtime dependency, engine purity intact.

## Scope note

The sweep covers only boards the AI pool can pick; it says nothing about human-only compositions (PRD Open Item 1) — a human draft can build shapes deliberately left out of the pool (e.g. dominant full-RPS spreads, kept as discoverable player tech). Felt balance for real human play is the on-device sign-off (Task 6, house device-acceptance pattern), captured separately against the deployed production build.
