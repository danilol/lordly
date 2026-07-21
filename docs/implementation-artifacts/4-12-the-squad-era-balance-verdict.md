---
baseline_commit: 5eaa14b787b0c246e329a511f7eec686456c65a1
---

# Story 4.12: The squad-era balance verdict

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want the twelve-class squad era tuned and certified,
so that no composition, tactic, or monster dominates and the game stays fun.

> **Scope in one line.** This is the **epic-closing gate** — a certification + verdict story, not a feature build. The NFR4 harness already sweeps both modes in CI (`sim.test.ts`, ≤65% band); tactics and leaders are already real per-run dimensions; the 12 classes and both monster comps are already in `STRATEGY_POOL`. 4.12 **scales the sweep to convergence, certifies the whole squad era against the ≤65% band in both modes, verifies the 10-engagement wipeout compounding, produces a standing balance-verdict doc, and closes the epic on Danilo's on-device felt-balance sign-off** against the now-deployed production build. **Tuning is CONDITIONAL** — only if the sweep flags an out-of-band archetype; if none does, the verdict records "no tuning needed" and `balanceVersion` stays 9.

## Acceptance Criteria

Reconciled from epics.md Story 4.12 (lines 915–937). NFR4, FR14/FR19/FR35/FR36, PRD Open Item 5.

1. **NFR4 scaling pass (Open Item 5).** The archetype pool and run budget demonstrably cover **12 classes × tactics × leaders × monster compositions**: every one of the 12 `UnitClass`es appears in ≥1 `STRATEGY_POOL` archetype (pinned by a test, not asserted in prose), all 4 tactics and seeded leader variation are exercised as real dimensions (already wired via per-side stream draws), and both single + wipeout comps are present. The harness **stays a dev CLI in `packages/engine`** (`sim/run.ts` + `test/sim.test.ts` — no app/runtime dependency, engine purity intact). Both-mode sweeps complete in a **workable budget**: the fast deterministic CI band (runsPerPair 15) plus a documented convergence run (~150–200) for the verdict.
2. **The band holds in both modes, at convergence.** A convergence sweep (both modes) shows **no archetype exceeds the ≤65% aggregate win-rate band** in either mode. The melee-witch **wasted-swing floor is re-checked against 3.0's wardens baseline** (3.0 flagged wardens at a 33% single-mode floor; tactics + the melee-blockade fix should have lifted it — confirm it is viable, not collapsed, and in-band). **10-engagement wipeout compounding is verified (FR19):** poison persists and ticks at every natural engagement end, `blastAttenuation` (×0.75, wipeout-only) applies, and the cap fires at `engagementCap` = 10.
3. **Any tuning is versioned and drift-guarded (CONDITIONAL).** If the sweep forces a balance-data change, each change **bumps `balanceVersion`** (9→10…) with the **balance-hash re-pinned** and **all goldens re-recorded** (`pnpm --filter @lordly/engine test -u`, audited event-by-event), and `docs/rules.md` / Help reflect the final numbers (the `rules-doc.test.ts` drift guard stays green). **If no tuning is needed, this is recorded explicitly and `balanceVersion` stays 9** (no gratuitous bump — a bump invalidates replay history, AD-8/3.2).
4. **The verdict is recorded.** A standing `docs/balance-verdict.md` (sibling to `performance-verdict.md`, per NFR3's measurement-record pattern) captures: the converged per-archetype win rates in both modes, the run budget/methodology, the wardens-floor number, the 10-engagement compounding confirmation, and the tuning decision (changed-what or none-needed).
5. **On-device felt-balance sign-off closes the epic.** On the **deployed production URL** (`lordly.lol-gaming.workers.dev` — 4.8–4.11 shipped 2026-07-20), Danilo plays real matches and accepts that squads, tactics, leaders, monsters, and crits feel fair and fun, **and** performance is re-verified against `performance-verdict.md`'s baseline with the post-monster asset load (the deferred `?perf=1` capture from `deferred-work.md`, which now also covers the 4.10 from→to traces + the 4.11 move-plate). This on-device sign-off is the epic's closing gate.

## Tasks / Subtasks

- [x] **Task 1 — Scaling/coverage audit (AC: 1)**
  - [x] Add a coverage test in `packages/engine/test/ai.test.ts` (or sim.test.ts): assert **every** `UnitClass` in `ALL_CLASSES` appears in at least one `STRATEGY_POOL` archetype's `classes` — the five 4.3 smalls (berserker, phalanx, ninja, valkyrie, sorceress) were folded in via single-unit swaps, and the golem via the two dedicated monster comps golem-wall/twin-golems (4.8) — but nothing currently *fails the build* if one is dropped. The existing test only checks each pool class is a valid class (`ai.test.ts:33`), not the reverse-coverage. This is the concrete Open-Item-5 "12 classes covered" guard. **DONE: reverse-coverage test added; 12/12 covered, build-guarded.**
  - [x] Confirm (and note in the verdict) the dimensions already covered without code change: tactics (all 4 appear — `ai.test.ts:119`) and seeded leader variation are drawn per side per run in `sweep.ts` (`chooseSetup` → `tactics`/`leaders` into `MatchSetup`), so tactic × leader are exercised across the run budget, not the pool; both monster comps (`golem-wall`, `twin-golems`) are present. **DONE: confirmed + recorded in the verdict's coverage section.**
  - [x] Confirm the harness stays a **dev CLI**: `sim/run.ts` imports only engine internals (no app/Phaser/DOM), engine purity lint + `purity.test.ts` still pass; the sweep is invoked via `pnpm --filter @lordly/engine sim` and CI's `sim.test.ts`, nothing else. **DONE: purity suite green in the full gate; no app dependency added.**
- [x] **Task 2 — Convergence certification sweep, both modes (AC: 2)**
  - [x] Run the CLI at convergence for the record: `pnpm --filter @lordly/engine sim -- --runs=200 --seed=1 --threshold=0.65 --mode=single` and `--mode=wipeout`. Capture per-archetype + per-composition win rates for both. (Convergence ≈150–200 per the `sim.test.ts` note; the CLI caps at 500.) **DONE: both modes at runs=200 + a runs=500 confirmation (seeds 1/2/3) captured in the verdict.**
  - [x] Verify **no archetype > 65%** in either mode. If one does → Task 4 (tuning). If none does → certified, record the numbers. **DONE: single all in band (top cabal 64.1%); wipeout one marginal crossing — farshot 65.3% at runs=500 — see Task 4.**
  - [x] **Wardens floor re-check:** confirm `wardens` is viable and in-band (the existing `sim.test.ts` pin asserts `> 0.25`; record the actual converged number vs 3.0's 33% single-mode baseline — did tactics + the melee blockade lift it?). **DONE: wardens 31.7% single (≈ the 3.0 33% mark) / 43.3% wipeout — viable, not collapsed.**
  - [x] Keep the CI band fast + deterministic (runsPerPair 15, seed 1) — do NOT raise CI's per-pair budget (the 4.4 lesson: the heavy run is a manual/verdict artifact, CI stays cheap). If CI's 15-run rates and the 200-run convergence rates disagree on band membership, the convergence run is the truth — note the discrepancy and widen only if a real crossing is found. **DONE: CI stays at 15-run; the farshot 200-vs-500 discrepancy noted in `sim.test.ts` + the verdict.**
- [x] **Task 3 — 10-engagement wipeout compounding (AC: 2)**
  - [x] Verify FR19 compounding over the raised cap: `engagementCap = 10` (`balance.ts:155`), poison persists across engagements and ticks at every natural end, `blastAttenuation` ×0.75 applies in wipeout only. `wipeout.test.ts` already grinds to the 10-engagement cap and pins poison PERSISTENCE (though not to the 10-cap) — confirm it still holds post-monster/post-4.7-guard. **Blast-attenuation compounding across engagements is NOT covered in `wipeout.test.ts`** (no blast comp there; `blastAttenuation` is only exercised single-hit in damage/sim tests) — add an explicit cross-engagement blast-attenuation assertion. Record both in the verdict. **DONE: poison-persistence test re-confirmed green; new test pins blast ×3/4 applying every engagement through the cap=10 (13 vs the single-mode 18).**
- [x] **Task 4 — Tuning (CONDITIONAL — only if Task 2/3 flags out-of-band; AC: 3)**
  - [x] Adjust the offending value(s) in `packages/engine/src/balance.ts` (stats, `roleRelations`, `blastAttenuation`, `guardHalf`, leader-penalty ratio, crit/dodge params — whichever the sweep implicates). Prefer the smallest lever; re-run the convergence sweep to confirm the fix and that it didn't push another archetype out. **N/A: no balance-data tuning applied — see below.**
  - [x] Bump `balance.ts` `version` (9→10), re-pin the balance hash (`balance-hash.test.ts` fails until re-pinned), re-record ALL goldens (`pnpm --filter @lordly/engine test -u`) and audit event-by-event, update `docs/rules.md` + Help numbers (keep `rules-doc.test.ts` green). **N/A: no bump.**
  - [x] **If NO tuning is needed:** check this task off with an explicit "none needed — the era certified in-band at `balanceVersion` 9" note; do NOT bump the version (replay-history invalidation is not free). **DONE: no tuning. `balanceVersion` stays 9. The one marginal crossing (farshot, wipeout, 65.3% at convergence) was ACCEPTED as a conscious recorded deviation, not tuned (Danilo, 2026-07-20) — a fun snipe-and-support comp, only 52.9% single-mode; tuning risked nudging the pack (longbows 62.1%) for a sub-1% gain. Enforced CI gate stays green at 15-run.**
- [x] **Task 5 — The verdict document + gate (AC: 4)**
  - [x] Write `docs/balance-verdict.md` (NFR3 measurement-record pattern, sibling to `performance-verdict.md`): converged per-archetype win rates (both modes), run budget/methodology + seed, wardens-floor number vs the 3.0 baseline, the 10-engagement compounding confirmation, and the tuning verdict (what changed, or "none needed"). Cross-link from the epic-4 dossier if useful. **DONE: `docs/balance-verdict.md` written.**
  - [x] Full gate: `pnpm typecheck`, `pnpm lint`, `pnpm coverage` (engine ≥90%), `pnpm --filter web build`. If Task 4 tuned, the sweep test + goldens + hash must all be green. **DONE: typecheck ✓, lint ✓, coverage (568 tests, engine 99.42% lines) ✓, web build ✓.**
- [x] **Task 6 — On-device felt-balance sign-off + perf re-verify (AC: 5)** *(the epic's closing gate — Danilo)*
  - [x] Danilo plays real matches on the **deployed production URL** and accepts felt balance — squads, tactics, leaders, monsters, crits all fair and fun. **DONE: Danilo's sign-off, 2026-07-20 — "you have my approval."**
  - [ ] Run the deferred `?perf=1` on-device capture against the deployed build (the procedure in `performance-verdict.md`; `three-mages`-wipeout Replay at 1× and ×2, per-scenario resets, single-read traces), fill the stubbed 4.10 table, and confirm the 60/30 floor holds with the post-monster asset load + the 4.10 traces + the 4.11 plate. This clears the `deferred-work.md` capture item and closes the epic. **DEFERRED (PO call, 2026-07-20): not run — Danilo closed 4.12 on the balance certification + felt-balance sign-off. The `?perf=1` capture stays deferred (re-logged to `deferred-work.md`); the `performance-verdict.md` 4.10 stub table remains open. NOT checked (honesty: it was not performed).**

## Dev Notes

### This is a gate, not a feature — most of the machinery already exists (verified)
- **Sweep harness:** `packages/engine/sim/run.ts` (CLI, the only effectful file) + `sim/sweep.ts` (pure `runSweep`) + `test/sim.test.ts` (the CI band at runsPerPair 15, threshold 0.65, **both modes**). `pnpm --filter @lordly/engine sim -- --runs=N --seed=N --threshold=0.65 --mode=single|wipeout`, caps at 500 runs. [Source: packages/engine/sim/run.ts, sim/sweep.ts, test/sim.test.ts]
- **Tactics + leaders are already real dimensions:** `sweep.ts:playMatch` calls `chooseSetup([arch], stream)` per side, which draws that side's `tactic` (all 4) and `leader` index from its own `ai/*` stream — so across `runsPerPair` seeds, tactic × leader combinations are exercised. NOT a per-archetype fixed field. [Source: packages/engine/sim/sweep.ts:160-185, src/ai.ts:44-50]
- **The pool (`STRATEGY_POOL`, 12 archetypes)** already includes both monster comps (`golem-wall` = 1 monster, `twin-golems` = 2) and folded every newcomer in via single-unit swaps (4.3 notes). The gap: nothing *fails the build* if a class silently drops out of the pool — Task 1 closes that. [Source: packages/engine/src/ai.ts:85-270]
- **Convergence:** `sim.test.ts` documents converged truth at runsPerPair ≥150–200 (CI's 15 is a fast proxy on a fixed seed, deterministic, no flake). The 200-run manual sweep is the verdict's evidence. [Source: packages/engine/test/sim.test.ts:22-53]
- **Wardens floor:** `sim.test.ts:217-229` already pins `wardens.winRate > 0.25` (viable, not collapsed) — the 3.0 wasted-swing floor, revised for the 4.4 melee blockade. Record the converged number in the verdict. [Source: packages/engine/test/sim.test.ts:217-229]
- **10-engagement wipeout:** `engagementCap = 10` (`balance.ts:155`, raised 5→10 per FR19's 2026-07-16 amendment); `blastAttenuation` ×0.75 wipeout-only (FR10 amendment); poison persists + ticks at every natural end. `wipeout.test.ts` already grinds a battle to the 10-engagement cap. [Source: packages/engine/src/balance.ts:155, test/wipeout.test.ts]

### Versioning discipline (AC3 — do NOT bump gratuitously)
`balanceVersion` is currently **9** (`balance.ts:153`). The balance-hash test (`balance-hash.test.ts`) fails the build if balance data changes without a version bump — and vice versa, a bump with no data change is pointless. A bump invalidates replay history (AD-8; the 3.2 UX marks stale entries non-replayable), so **only tune if the sweep forces it**. Every tuning change re-records goldens and re-pins the hash. [Source: packages/engine/src/balance.ts:59,149-153; test/balance-hash.test.ts]

### The drift guard (AC3)
`docs/rules.md` is the single source the Help scene renders (`?raw` import); `apps/web/test/rules-doc.test.ts` pins every NUMBER in it to `BALANCE` so a stat/ratio change that skips the doc fails the build. If Task 4 tunes, update rules.md and keep this green. [Source: apps/web/test/rules-doc.test.ts]

### Previous-story intelligence (4.11, done `f07cfaf`; 4.8–4.11 deployed to production 2026-07-20)
- Main was fast-forwarded and pushed (`ecf7d86..f07cfaf`), CI green, **deployed to `lordly.lol-gaming.workers.dev`** — so AC5's device pass runs against a real production build carrying 4.8 (monster engine), 4.9 (monster render), 4.10 (from→to attack motion), 4.11 (action ledger).
- **Two things owed on the deployed build, folded into Task 6:** (a) the deferred `?perf=1` capture (`deferred-work.md` — now covers the monster asset load + the 4.10 traces + the 4.11 plate together); (b) two review-decided visuals NOT yet device-seen — 4.10's arrival-timed impact effects + guardian-ring flash, and 4.11's "↳" misfire plate prefix. Glance all three during AC5.
- **The coverage-flake** (`deferred-work.md`, logged in 4.11's review): `pnpm coverage` occasionally times out one heavy engine test under instrumentation — this story runs coverage in its gate, so expect a possible retry; not a real failure.
- Balance is UNCHANGED since 4.7's `balanceVersion` 8→9 (the golem class row, 4.8). 4.9/4.10/4.11 were all pure shell (no balance/logVersion change), so the sweep numbers from 4.8 still stand as the pre-certification baseline: both-mode in band (golem-wall 44.5%/49.3%, twin-golems 40.7%/53.6%).

### What this story is NOT
- Not a new mechanic, class, or UI. If the felt-balance pass surfaces a *design* want (not a tuning value), it's a wave-2/correct-course item (e.g. the parked OB64 unit-data card, `deferred-work.md`), not 4.12 scope.
- Not a re-litigation of the frozen draw order (ADR 0003) or the move/guard tables (those are tunable DATA — a value change is fine; a structural change is a different story).

### Testing standards
Sweep/floor/coverage/compounding are engine tests (`sim.test.ts`, `wipeout.test.ts`, `ai.test.ts`); the convergence run is a documented manual CLI artifact in `docs/balance-verdict.md`. Felt balance + the fps capture are device-accepted (house pattern). Full gate before review: `pnpm typecheck`, `pnpm lint`, `pnpm coverage` (engine ≥90%), `pnpm --filter web build`. `logVersion` stays 4; `balanceVersion` stays 9 unless Task 4 tunes.

### Project Structure Notes
- Touch (mostly engine + docs): `packages/engine/test/ai.test.ts` (class-coverage guard), possibly `packages/engine/test/wipeout.test.ts` (explicit compounding pin), `docs/balance-verdict.md` (NEW). CONDITIONAL (only if tuning): `packages/engine/src/balance.ts` (+ version bump), goldens (`__snapshots__`), `balance-hash.test.ts`, `docs/rules.md`. No web/app code unless a device finding demands it.
- No new dependency. No new RNG stream.

### References
- [Source: docs/planning-artifacts/epics.md#Story-4.12 (915-937)] — the 4 AC blocks + the epic-closing-gate framing.
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md] — NFR4 (154); FR14 role-relations + ≤65% both-mode mandate (71); FR19 10-engagement cap + compounding (106); FR10 `blastAttenuation` ×0.75 wipeout-only (64); FR35 leader penalty (123); FR36 crit/dodge (132); Open Item 5 / #1 balance-numbers-are-living (175).
- [Source: packages/engine/sim/run.ts + sim/sweep.ts + test/sim.test.ts] — the harness, the pure sweep, the CI band + convergence note + wardens floor.
- [Source: packages/engine/src/ai.ts:25-270] — `StrategyArchetype`, `AiChoice`, `chooseSetup`, `STRATEGY_POOL` (all 12 archetypes incl. both monster comps).
- [Source: packages/engine/src/balance.ts:59,149-155] — `version` 9, `engagementCap` 10, the hash-bump contract.
- [Source: packages/engine/test/wipeout.test.ts] — the existing 10-engagement grind; [test/balance-hash.test.ts] the bump guard; [apps/web/test/rules-doc.test.ts] the Help-number drift guard.
- [Source: docs/performance-verdict.md] — the fps baseline + the 4.10 addendum's stubbed table (Task 6 fills it); [docs/implementation-artifacts/deferred-work.md] — the deferred `?perf=1` capture + the coverage flake.

## Open questions for Danilo (not blockers; sensible defaults chosen)
1. **Convergence run budget** — default `--runs=200` for the verdict (the documented convergence point). Tell me if you want a heavier one-off (up to the CLI's 500 cap) for extra confidence before certifying.
2. **If an archetype is marginally over-band** (say 66–68%) — default: tune the smallest lever and re-certify. If it's a *fun* comp you'd rather keep, say so and we widen the band consciously (a recorded deviation) instead.
3. **Verdict doc home** — default `docs/balance-verdict.md` (sibling to `performance-verdict.md`). OK, or fold into the epic-4 dossier?
4. **Felt-balance scope** — default: you play a handful of real vs-AI matches across modes on the production URL and give a gut yes/no. Tell me if you want me to seed specific matchups (e.g. via Replay) to stress a particular comp.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]`.

### Debug Log References

- Exploration (throwaway `_explore.test.ts`, since deleted) found a clean 10-engagement no-death stall (3 mages screened by knights vs 5 clerics, seed `0xdead`) where the wipeout blast lands 13 every engagement vs the single-mode 18 — the fixture for the new blast-attenuation pin.
- Convergence sweeps captured via the dev CLI (`pnpm exec tsx sim/run.ts …` from `packages/engine`, since `pnpm --filter … sim -- …` double-passes the `--` separator).

### Completion Notes List

- **Tasks 1–5 complete and gated; Task 6 (on-device felt-balance sign-off + `?perf=1` capture) is the epic's closing gate and is Danilo's — the story stays in-progress until that device pass.**
- **The era certifies in-band at `balanceVersion` 9 — no tuning applied, no version bump, no golden/hash re-record, `logVersion` stays 4.** Replay history stays valid (AD-8/3.2).
- **One recorded deviation:** `farshot` converges at 65.3% wipeout (runs=500, stable across seeds 1/2/3; reads 64.4% at runs=200). Danilo's call (2026-07-20) was to accept it as a conscious 0.3% band widening rather than re-tune the pool board. Documented in `docs/balance-verdict.md` and annotated beside the wipeout band test in `sim.test.ts`. The enforced CI gate (runsPerPair 15, seed 1) stays green in both modes.
- **Single mode:** all 12 in band, top cabal 64.1% (identical at runs 200 and 500). **Wardens floor:** 31.7% single (≈ the 3.0 33% baseline) / 43.3% wipeout — melee viable, not collapsed.
- **New tests:** reverse class-coverage guard (`ai.test.ts`, 12/12 build-guarded); cross-engagement blast-attenuation pin (`wipeout.test.ts`, ×3/4 applied every engagement through cap=10). Poison-persistence pin re-confirmed green post-monster/post-4.7-guard.
- **Full gate green:** typecheck, lint, coverage (40 files, 568 tests; engine 99.42% lines ≥ the 90% gate), web build.

### File List

- `packages/engine/test/ai.test.ts` — added the reverse class-coverage guard (every `ALL_CLASSES` member appears in ≥1 `STRATEGY_POOL` archetype).
- `packages/engine/test/wipeout.test.ts` — added the `magesVsClerics` fixture + the cross-engagement blast-attenuation test (imports `blastDamage`).
- `packages/engine/test/sim.test.ts` — annotated the wipeout band test with the runs=200-vs-500 farshot convergence discrepancy + the accepted deviation.
- `docs/balance-verdict.md` — NEW. The standing NFR4 certification record.
- `docs/implementation-artifacts/4-12-the-squad-era-balance-verdict.md` — story bookkeeping (frontmatter `baseline_commit`, task checkboxes, this record).
- `docs/implementation-artifacts/sprint-status.yaml` — status → in-progress.

### Change Log

- 2026-07-20 — **CLOSED (done).** Danilo's on-device felt-balance sign-off given ("you have my approval") — the epic's closing gate met. The `?perf=1` on-device capture (Task 6's second half) was NOT run and stays deferred (`deferred-work.md`; `performance-verdict.md` 4.10 stub still open) — a conscious PO call to close 4.12 on the balance certification + felt-balance rather than block on the long-deferred perf capture. All epic-4 stories now done; `epic-4-retrospective` is available (optional).
- 2026-07-20 — Tasks 1–5 implemented. Class-coverage guard + cross-engagement blast-attenuation test added; both-mode convergence sweep captured (runs=200 + a runs=500 confirmation). Era certified in-band at `balanceVersion` 9 — no tuning. One conscious recorded deviation: farshot 65.3% wipeout at convergence (Danilo-accepted, not tuned). `docs/balance-verdict.md` written. Full gate green (568 tests, engine 99.42% lines, web build). Task 6 (on-device sign-off + `?perf=1` capture against the production URL) remains — the epic's closing gate, owned by Danilo.
- 2026-07-20 — Story created (baseline `f07cfaf`; 4.8–4.11 deployed to production the same day). The epic-closing gate: certify the 12-class squad era against the ≤65% both-mode band at convergence, re-check the wardens wasted-swing floor, verify 10-engagement wipeout compounding, produce a standing `docs/balance-verdict.md`, and close the epic on Danilo's on-device felt-balance sign-off + the deferred `?perf=1` capture against the live build. Tuning is CONDITIONAL (bump `balanceVersion` 9→10 + re-pin hash + re-record goldens ONLY if the sweep flags out-of-band; else record "none needed", no bump). Harness already covers tactics/leaders (per-run stream draws) + both monster comps; the one real code gap is a class-coverage guard (Task 1). `logVersion` stays 4. 4 non-blocking open questions.
