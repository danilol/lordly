---
baseline_commit: 6f6530333a86c6b0ebaf5ce7e46fab4ff0268c53
---

# Story 5.10: The pre-PvP verdict

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the game's developer,
I want the full 27-class roster certified balanced and the era's evidence complete,
so that link-play opens on a game we can prove is fair.

> **Scope in one line.** This is the **epic-closing gate** — a certification + verdict story, not a feature build, and the direct sequel to story 4.12 (read it first: `4-12-the-squad-era-balance-verdict.md` is the template for how this is done here). The harness, the pool, the guards and both verdict documents already exist. 5.10 **re-certifies the post-5.4/5.5 roster at convergence in both modes, closes the ONE real FR19 coverage gap the blast's retirement opened, makes the PRD honest about the era before link-play reads it, runs the epic's closing `?perf=1` capture, and ends on Danilo's on-device felt-balance sign-off.** Tuning is CONDITIONAL — if nothing crosses the band, the verdict records "no tuning needed" and `balanceVersion` stays 11.

> **⚠️ ORDERING DEVIATION — read before AC2.** The epic sequenced 5.10 last, *after* 5.9's full-roster art. Danilo postponed 5.9 for art (2026-08-01), so **5.10 runs first** and its perf capture therefore precedes the full-roster sprite sheet that `epics.md:1181` names in the epic's visual load. This is a known, accepted gap — it must be **recorded in `performance-verdict.md`, not silently absorbed**. See Task 5.

## Acceptance Criteria

Reconciled from `epics.md` Story 5.10 (lines 1169–1187), plus the three work packages sprint-status assigns to this story. NFR1, NFR4, FR14/FR15/FR19/FR25/FR35/FR38.

1. **The full roster certifies in-band, at convergence, in both modes.** Every one of the **27** `UnitClass`es rides `STRATEGY_POOL` (build-guarded, not asserted in prose), the both-mode convergence sweep shows **no archetype above the ≤65% band** at `runs=200` **with a `runs=500` confirmation** (the sweep-convergence rule — 200 and 500 can disagree on band membership near the edge), and the pool's **viability floor** is re-checked and recorded. Any crossing is either **tuned** (with `balanceVersion` bump + hash re-pin + event-audited golden re-records) or **recorded as a conscious deviation** — never silent.

2. **FR19 compounding is verified for the row-AoE that actually exists.** Story 4.12 certified 10-engagement wipeout compounding partly via a **cross-engagement `blastAttenuation` pin** — and story 5.4 retired `blast` from every class, so that pin was succeeded by a *no*-attenuation pin for `bolt`. The only wipeout-attenuated row-AoE left is 5.5's `breath`, and it is pinned **only on its first hit**. This story closes that gap: attenuation is proven to still apply at the `engagementCap` = 10 boundary, and poison persistence across the cap is re-confirmed post-monster-wave.

3. **The PRD tells the truth about this era.** The four homeless follow-ups (assigned by Danilo 2026-07-29, fenced out of 5.8, explicitly refused by the epic-5 dossier) land as dated in-place amendments: **FR38** monster-wave wording, **FR15** table growth, **FR14** role vocabulary 7 → 10, and the **humans-only leader rule** (E5-D13) wherever leader designation is stated (FR35 area). Doc-only — no engine, no version bump. Story 5.0 is the precedent for bundling stale-PRD amendments into a non-feature story.

4. **The closing `?perf=1` capture covers the epic's visual load and the entry burst.** A device capture against the deployed production build shows **no NFR1 in-battle floor breach**, and — because this is also story 5.3's owed capture — it explicitly compares the **Battle scene-ENTRY burst** against the 5.0 baseline (~5 frames bottoming ~8fps) and the 5.2 addendum (~10.9fps), not just the in-battle floor. The 5.9 ordering gap above is recorded in `performance-verdict.md`.

5. **The verdict is recorded and Danilo signs off.** `docs/balance-verdict.md` gains an **epic-5 addendum** (converged rates both modes, methodology + seeds, the floor number, the compounding confirmation, the tuning decision), and on the deployed build Danilo plays real matches and accepts felt balance. **That sign-off is the "ready for link-play" certificate that closes Epic 5.**

## Tasks / Subtasks

- [x] **Task 1 — Coverage audit: confirm, don't rebuild (AC: 1)**
  - [x] Confirm the reverse-coverage guard still bites at 27: `ai.test.ts:80` derives from `ALL_CLASSES`, so the 5.4/5.5 waves were picked up automatically — **verify, then say the number out loud in the verdict** (27/27). Do NOT re-author this guard.
  - [x] Confirm the pool-size pin: `ai.test.ts:35` asserts `STRATEGY_POOL.length === 18` exactly (PO-ratified 2026-07-29; FR25's "~8–12" was amended in `epics.md:53`). If Task 4 tunes by *adding* an archetype, this pin and the FR25 amendment BOTH move — a pool edit is never a one-line change.
  - [x] Confirm the other dimensions need no work: all 4 tactics appear (`ai.test.ts:199`), and tactic × leader are drawn per side per run inside `sweep.ts`, so they are exercised across the run budget rather than fixed per archetype (4.12 verified this; re-state it in the verdict, don't re-derive it).
  - [x] Note in the verdict that the **FR25 anti-front-stack guard was re-pointed on 2026-08-01** (5.4 engine review): it now asserts an archetype *places* a unit on a row-AoE row, derived from `BALANCE`, because the old "≥2 mages — row blasts punish stacked rows" premise died with E5-D4. Three archetypes qualify (Breath Battery / Wyrmhold / Stormflight).

- [x] **Task 2 — The convergence certification sweep, both modes (AC: 1)**
  - [x] Run the CLI at convergence for the record. **Invocation gotcha (4.12 debug log, re-confirmed):** run it directly — `cd packages/engine && pnpm exec tsx sim/run.ts --runs=200 --seed=1 --threshold=0.65 --mode=single` (and `--mode=wipeout`). `pnpm --filter @lordly/engine sim -- --flags` double-passes the `--` separator. CLI caps at 500 runs (`sim/run.ts:18`).
  - [x] Then the **`runs=500` confirmation across seeds 1/2/3**, both modes — this is not optional ceremony. It is exactly how 4.12 found `farshot` at 65.3% when `runs=200` read 64.4%, and how 5.4 flagged longbows as edge-close.
  - [x] **The numbers to beat (story 5.5's certified baseline, `sim.test.ts:294-296`):** converged maxima are **single 64.3% (twin-golems)** and **wipeout 63.8% (longbows)**. Both are inside the band but neither has much room. **There is currently NO accepted deviation carried** — 4.12's farshot widening was retired by 5.5's re-tune, so a crossing here is a fresh decision, not an existing allowance.
  - [x] Record per-archetype + per-composition rates for both modes.
  - [x] **Do NOT raise CI's per-pair budget.** `CI_CONFIG` stays `{ baseSeed: 21, runsPerPair: 15 }` (`sim.test.ts:56`) — the heavy run is a manual verdict artifact, CI stays cheap (the 4.4 lesson). If the 15-run proxy and the converged run disagree on band membership, **the converged run is the truth**; note the discrepancy rather than chasing it. If Task 4 tunes, re-verify baseSeed 21 still samples in-band in both modes and re-pin only if it does not (5.5's precedent: re-verified, no re-pin needed).

- [x] **Task 3 — The viability floor, re-framed (AC: 1)**
  - [x] **Read this before running anything: the floor moved, and the old check no longer means what it says.** `sim.test.ts:249` is named for the melee-heavy `wardens` because 3.0 flagged it at a 33% single-mode floor. Since 5.4 bolted the casters, **melee became the meta's muscle — wardens converges ~61% single / ~53% wipeout**, near the band's *ceiling*. Its `> 0.25` assertion is now a floor guard pointed at what may be the pool's strongest comp.
  - [x] So: identify the pool's **actual weakest archetype** at convergence in each mode and record its rate in the verdict (baseSeed-21 proxy floors read 28.9% single / 29.8% wipeout — the converged floor is what matters). Confirm it is *viable, not collapsed*.
  - [x] Decide and record: does the `wardens`-named test stay as-is (historical continuity, both bounds genuinely bite today) or get re-pointed at the measured floor archetype? **Either is defensible — state which and why.** This is the same failure mode the 5.4 review just caught three times: a guard that keeps passing while the thing it was written to watch moved out from under it.

- [x] **Task 4 — Tuning (CONDITIONAL — only if Task 2/3 flags out-of-band; AC: 1)**
  - [x] Adjust the smallest lever in `packages/engine/src/balance.ts` (stats, `roleRelations`, `blastAttenuation`, `guardHalf`, leader-penalty ratios, crit/dodge params) **or** an archetype's placement in `ai.ts` — 5.5's farshot fix was a single column slide (mid/right → mid/left) that cost the comp nothing and beat a stat change. Re-run the convergence sweep to confirm the fix and that it did not push another archetype out.
  - [x] If balance DATA changed: bump `balance.ts` `version` (11 → 12), re-pin the hash in `balance-hash.test.ts`, re-record goldens (`pnpm --filter @lordly/engine test -u`) **audited event-by-event**, and keep `docs/rules.md` + the `rules-doc.test.ts` drift guard green. If only `ai.ts` placement changed, **no bump** — the pool is not hashed balance data (5.5's precedent: goldens stayed byte-identical, md5-verified).
  - [x] **If NO tuning is needed:** check this off with an explicit "none needed — the era certified in-band at `balanceVersion` 11" and do **not** bump. A bump invalidates replay history (AD-8; 3.2 marks stale entries non-replayable) and is not free.

- [x] **Task 5 — FR19 compounding: close the gap the blast left behind (AC: 2)**
  - [x] **The gap, precisely.** 4.12 added a cross-engagement pin proving `blastAttenuation` ×3/4 still applied at engagement 10. Story 5.4 (E5-D4) left **no class carrying a `blast` row**, so that pin could no longer be built from real data and was succeeded by `wipeout.test.ts:316` — which pins the *opposite* property (the `bolt` is NEVER attenuated, both modes, every engagement). Correct and valuable, but it means **no test proves a row-AoE's wipeout attenuation survives to the cap any more.** The only wipeout-attenuated row-AoE in the game is 5.5's `breath`, and `roster.test.ts:1023` checks only `[0]` — the FIRST breath of the battle.
  - [x] Add the missing pin: a dragon comp that grinds to `engagementCap` = 10 in wipeout, asserting the ×3/4 breath attenuation holds on the LAST engagement as well as the first. `magesVsClerics` in `wipeout.test.ts` is the shape to copy (a no-death stall that runs the full cap); `roster.test.ts:1023`'s `dragonsAndWall` fixture gives the dragon arithmetic (21 → 15, 19 → 14).
  - [x] Poison: **know what the existing guard actually asserts before re-confirming it.** `wipeout.test.ts:357` proves poison survives the between-engagement clear by asserting ticks in **≥ 2 engagements** — it does NOT walk the status to the `engagementCap` = 10 boundary (4.12 flagged this parenthetically and left it). Re-confirm it is green post-monster-wave, and decide whether to strengthen it to the cap while you are building the cap-grinding breath fixture next door. **If you leave it at ≥2, say so in the verdict** — do not let "FR19 compounding verified" imply cap-boundary coverage it does not have.
  - [x] Record both in the verdict as the FR19 confirmation. **Say plainly in the verdict that the blast-era pin was succeeded, not simply dropped** — a reader comparing 4.12's verdict to this one must not conclude coverage was lost.

- [x] **Task 6 — The four homeless PRD follow-ups (AC: 3) — doc-only**
  - [x] **FR38** (`prd.md:126`) — the 2026-07-20 supersession note already corrected two-cell → single-cell king-move and Golem-only, and says "dragons arrive with Epic 5's roster". They have: append a dated note that story 5.5 shipped the monster wave — **10 monsters (3 beasts + 7 dragonkind), 27 classes total**, the Whelp a 1-slot SMALL exception (E5-P3), and the `race` field.
  - [x] **FR15** (`prd.md:72`) — the class table grew 6 → 12 (4.3) → 17 (5.4) → 27 (5.5). Amend the wording so it is not frozen at a stale count, and point at `BALANCE.classes` + the dossier's `ROSTER.md` as the normative table rather than restating rows the PRD will never keep current.
  - [x] **FR14** (`prd.md:71`) — the role vocabulary is now **10**, not the 7 the text implies: `vanguard, skirmisher, sniper, artillery, support, control, brute` **+ `dragon`, `beast`, `dragonslayer`** (`types.ts:69`). Record the **dragonslayer → dragon one-way ×1.5 hunt** (E5-P1, `balance.ts` `roleRelations`) as part of the shipped relation set — it shipped inert in 5.4 and went live in 5.5.
  - [x] **The humans-only leader rule (E5-D13)** — FR35 (`prd.md:123`) states leader designation with no race constraint. Amend it: **only `race: 'human'` units can be crowned**, enforced end-to-end (validate / draft gate + hint / crown gesture / AI leader draw), and note that the AI's leader draw filters on `race`, superseding 4.8's `sizeClass` filter which would have crowned a Whelp.
  - [x] **Style rule for all four:** amend **in place with a dated note**, never rewrite history — the FR38 supersession note and the `epics.md:53` FR25 amendment are the two house patterns. Every one of these is doc-only: **no engine change, no version bump.**

- [x] **Task 7 — The verdict document (AC: 5)**
  - [x] Add an **epic-5 addendum** to `docs/balance-verdict.md` (do not rewrite the 4.12 body — it is the squad-era record and stays). It needs: converged per-archetype rates both modes with the run budget/seeds, the measured viability floor, the FR19 compounding confirmation *including the blast→breath succession*, the coverage certification (27/27 classes, 18 archetypes), and the tuning decision (changed-what, or none-needed).
  - [x] State the era's identity plainly for the link-play reader: `logVersion` **4** (untouched all epic — the fence held), `balanceVersion` **11** (or 12 if Task 4 tuned), 27 classes, 18 archetypes.
  - [x] Full gate: `pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm coverage` (engine ≥90% lines), `pnpm --filter web build`.

- [ ] **Task 8 — The closing device session (AC: 4, 5)** *(Danilo's — the epic's closing gate)*
  - [x] **Sequencing: Tasks 1–7 must be committed and merged to `main` BEFORE this task starts.** Deployment is CI-driven — `.github/workflows/ci.yml` runs typecheck → lint → knip → coverage → web build → deploy, and the deploy job only fires on `main`. So the order is: finish 1–7 → push (or PR + merge) → confirm the CI deploy job went green → then hand the device session to Danilo. A capture taken before the deploy lands is measuring the previous build.
  - [x] This capture must run against the **deployed production build** (`lordly.lol-gaming.workers.dev`), not a dev server — dev-server timings are not comparable to any figure in `performance-verdict.md`.
  - [x] Run `?perf=1` per `performance-verdict.md`'s procedure (three-mages wipeout Replay at 1× and ×2, **per-scenario resets** — the missed reset in 5.0 and 5.2 both produced prefix-duplicated traces that had to be sliced by hand; do not repeat it a third time). *(2026-08-01: RAN — but the benchmark had to be RE-POINTED first: the three-mages fixture is a 3-unit army at `balanceVersion` 2, invalid at `slotBudget` 5, and its "3 targets per blast" premise died with E5-D4. Replaced by a measurement-chosen mirrored Emberdrake + 3 Knights board (heaviest per-beat comp: 68 attacks / 82 target-instances / full 10-engagement cap). **And the reset was missed a THIRD time** — the ×2 trace contained the 1× trace as an exact 2,888-sample prefix; verified element-wise and sliced, nothing lost. Logged as a procedure problem in deferred-work.)*
  - [x] **Compare the scene-ENTRY burst, not only the in-battle floor.** Baselines to beat: 5.0 recorded ~5 frames bottoming ~8fps at Battle entry; 5.2 confirmed it unchanged at ~10.9fps. Story 5.3 then added two full-screen terrain textures and enlarged the board ~55% at exactly that moment and shipped **without a capture** — this is that owed measurement (`deferred-work.md`, owner: 5.10). *(2026-08-01: DONE — entry burst read 5 frames bottoming **2.61fps** vs ~8fps at 5.0 and ~10.9fps at 5.2. Same event, materially deeper; one session, so flagged for a second reading rather than treated as settled. 5.3's owed measurement is discharged.)*
  - [x] **Record the 5.9 ordering gap in `performance-verdict.md`:** this capture PRECEDES the full-roster sprite sheet the epic intended it to cover. Either commit to a light re-capture riding 5.9's eventual device pass, or accept the gap explicitly at the epic close — **Danilo's call, and it gets written down either way.** *(2026-08-01: recorded in `performance-verdict.md` BEFORE the capture ran, so the document is honest either way; the light-re-capture-vs-accept call is still open and rides the epic close.)*
  - [ ] Danilo plays real matches on the deployed build and accepts felt balance across the full roster — humans, monsters, dragons, tactics, leaders, crits. **This sign-off closes Epic 5.**
  - [x] Carry the device-class caveat forward unchanged (Pixel 9 Pro XL vs AC1's 6a-class floor — an accepted, documented deviation since 2026-07-16).

## Dev Notes

### This is a gate, not a feature — nearly all the machinery exists (verified against the current tree)

- **Harness:** `packages/engine/sim/run.ts` (CLI, the only effectful file) + `sim/sweep.ts` (pure `runSweep`) + `test/sim.test.ts` (the CI band, both modes). Engine purity holds — the sim imports engine internals only, no app/Phaser/DOM. [Source: packages/engine/sim/run.ts, sim/sweep.ts, test/sim.test.ts]
- **Guards already build-enforced:** reverse class-coverage from `ALL_CLASSES` (`ai.test.ts:80`, auto-picked-up the 5.4/5.5 waves), pool size pinned at exactly 18 (`ai.test.ts:35`), all-four-tactics coverage (`ai.test.ts:199`), the band in both modes (`sim.test.ts:243,297`), the balance-hash bump contract (`balance-hash.test.ts`), the rules.md number drift guard (`apps/web/test/rules-doc.test.ts`).
- **Current era identity:** `logVersion` **4** (untouched since 4.2 — Epic 5's fence held all the way through), `balanceVersion` **11** (5.5's monster wave, hash `7a76b29f`), **27** classes, **18** archetypes, `engagementCap` **10**.
- **What is NOT already covered, and is the real engineering in this story:** the cross-engagement row-AoE attenuation pin (Task 5). Everything else is running, reading, deciding, and writing down.

### The convergence rule — this is where the last two verdicts got bitten

`runs=200` and `runs=500` can disagree on band membership near the edge. 4.12 accepted a `farshot` deviation at 65.3% that only appeared at 500 (200 read 64.4%); 5.5's monster wave then pushed it to 66.0%, made "accept" untenable, and the eventual fix cost the comp nothing. 5.4 separately flagged longbows at 64.9% wipeout as "edge-close — watch at 5.5". **Run the heavy confirmation before certifying anything**, and treat a 200-run pass as provisional. [Source: sim.test.ts:287-296; story 5.4 sprint-status entry; memory: sweep-convergence gotcha]

### The lesson from the 5.4 engine review — it applies directly to this story

The review that closed 5.4 (2026-08-01, commit `6f65303`) found the same defect three times: **retiring `blast` from the roster broke nothing, but quietly emptied three separate guards that all kept passing.** Two magic-exemption assertions in `crit-dodge.test.ts` filtered on `kind === 'blast'` and iterated zero times; FR25's anti-front-stack guard decayed into a class-presence check. All three are fixed. **Why it matters here:** Task 3's floor check is a fourth instance of the same pattern (a guard named for `wardens` when `wardens` is no longer the floor), and Task 5's compounding gap is a fifth (the 4.12 blast pin's coverage did not survive its own succession). If Task 4 tunes anything, re-read every guard that mentions the tuned value by name. [Source: docs/implementation-artifacts/5-4-roster-wave-humans.md#Review-Findings]

### Versioning discipline (AC1) — do NOT bump gratuitously

`balanceVersion` is **11**. The hash test fails the build if balance data changes without a bump — and a bump with no data change is pointless churn that invalidates every stored replay (AD-8; 3.2's UX marks stale entries non-replayable and it is the player-visible cost). **Only tune if the sweep forces it.** Note the asymmetry Task 4 depends on: `ai.ts`'s `STRATEGY_POOL` is **not** hashed balance data, so an archetype placement fix needs no bump and leaves goldens byte-identical — 5.5 verified this by md5. [Source: packages/engine/src/balance.ts:153; test/balance-hash.test.ts; story 5.5 record]

### Perf: three documents, one owed measurement

`docs/performance-verdict.md` holds the chain: the **5.0 capture is the epic-5 baseline** (2026-07-24, with an explicit scene-transition exemption rule and an honest flag that the *entry burst itself regressed* to ~5 frames bottoming ~8fps); the **5.2 addendum** confirmed the chrome was perf-neutral and the burst unchanged (~10.9fps); **5.3 ran no capture at all** (PO-deferred) after adding the terrain and enlarging the board ~55% — and named this story as owner. The 5.0 record's own standing instruction says story 5.10's closing capture re-checks the floor after 5.2/5.3/5.9. **5.9 will not be in it** — that is the ordering deviation, and Task 8 records it. [Source: docs/performance-verdict.md:208-245; deferred-work.md:215]

### What this story is NOT

- **Not a new mechanic, class, tactic, or UI.** The epic's fence (no new systems) holds to the last story. If the felt-balance pass surfaces a *design* want rather than a tuning value, it goes to `deferred-work.md` as an Epic 6 / correct-course input — **do not self-scope it** (the standing rule; see the PO-wishes-defer pattern).
- **Not a re-litigation of ADR 0003** (the frozen draw table — amended 2026-08-01 to classify `bolt`/`breath`, itself a prose correction, not a resequencing) **or of the dossier's move tables** (those are tunable DATA — a value change is fine, a structural change is a different story).
- **Not 5.9's art.** 5.9 stays postponed and floats on Danilo's Midjourney batches; the epic's art-story split is unchanged.

### Previous story intelligence (5.4 review closed 2026-08-01, `6f65303`; 5.5–5.8 shipped)

- The tree is clean and the full gate is green as of `6f65303`: typecheck, lint, **752 tests** (365 engine), engine coverage well above the 90% line gate.
- **5.8 shipped the flow corrections and the board-code decision**; **5.7** the battle-stats summary; **5.6** the unit-data card; all three reviewed with **zero engine defects**. The engine has been stable since 5.5 — this story is certifying a settled system, not a moving one.
- **`pnpm coverage` instrumentation flake** was fixed in 5.0 (explicit timeouts on the heavy suites). If a heavy sweep test times out under coverage, add an explicit timeout to that test rather than trimming the sweep — the 5.0 pattern.
- **Nothing has changed balance since 5.5.** 5.6/5.7/5.8 were shell-only and the 5.4 review patched only tests and docs, so 5.5's converged numbers stand as this story's pre-certification baseline.

### Testing standards

Coverage/floor/band/compounding are engine tests (`ai.test.ts`, `sim.test.ts`, `wipeout.test.ts`, `roster.test.ts`); the convergence sweep is a documented manual CLI artifact recorded in `docs/balance-verdict.md`. Felt balance and the fps capture are device-accepted (the house pattern — Danilo's word is the acceptance record). Full gate before review: `pnpm typecheck`, `pnpm lint`, `pnpm knip`, `pnpm coverage` (engine ≥90% lines), `pnpm --filter web build`. `logVersion` stays **4**; `balanceVersion` stays **11** unless Task 4 tunes balance data.

### Project Structure Notes

- **Touch (engine tests + docs):** `packages/engine/test/wipeout.test.ts` (the new cross-engagement breath pin), possibly `packages/engine/test/sim.test.ts` (floor-test re-point + converged-number comments), `docs/balance-verdict.md` (epic-5 addendum), `docs/performance-verdict.md` (closing capture + the 5.9 gap), `docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md` (the four amendments), `docs/implementation-artifacts/deferred-work.md` (retire the 5.3 capture item once run).
- **CONDITIONAL (only if tuning):** `packages/engine/src/balance.ts` (+ version bump), `packages/engine/src/ai.ts` (placement fix — no bump), `__snapshots__/golden.test.ts.snap`, `balance-hash.test.ts`, `docs/rules.md`.
- **No web/app code** unless a device finding demands it. No new dependency, no new RNG stream, no new event type.

### References

- [Source: docs/planning-artifacts/epics.md#Story-5.10 (1169-1187)] — the three AC blocks and the "ready for link-play certificate" framing; epic-5 fence + art-float rule at (957).
- [Source: docs/implementation-artifacts/sprint-status.yaml:115] — the ordering note (5.9 postponed → 5.10 first), the four homeless PRD follow-ups, and the inherited 5.3 perf capture.
- [Source: docs/implementation-artifacts/4-12-the-squad-era-balance-verdict.md] — the precedent: task shape, the CLI double-`--` gotcha, the conditional-tuning discipline, the "N/A if none needed" honesty pattern.
- [Source: packages/engine/test/sim.test.ts:24-56, 243-304] — `CI_CONFIG` baseSeed 21 rationale, the 5.4/5.5 re-verify notes, the retired farshot deviation, the certified converged maxima (single 64.3% twin-golems / wipeout 63.8% longbows), the wardens floor test.
- [Source: packages/engine/test/ai.test.ts:35,80,199] — pool-size pin at 18, reverse class-coverage from `ALL_CLASSES`, tactic coverage.
- [Source: packages/engine/test/wipeout.test.ts:188-347] — the cap-grinding fixture shape and the bolt no-attenuation pin that succeeded 4.12's blast pin; [test/roster.test.ts:1023] — the first-hit-only breath attenuation check.
- [Source: packages/engine/src/balance.ts:153] — `version: 11`; [src/types.ts:69] — the 10-role vocabulary; [src/ai.ts] — `STRATEGY_POOL`, 18 archetypes.
- [Source: docs/performance-verdict.md:208-245] — the 5.0 epic-5 baseline + its standing instruction, the 5.2 addendum, the 5.3 no-capture record naming 5.10 as owner.
- [Source: docs/balance-verdict.md] — the 4.12 body this story appends an addendum to (do not rewrite it).
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md:71,72,123,126] — FR14, FR15, FR35, FR38: the four amendment targets.
- [Source: docs/adr/0003-battle-stream-draw-order.md] — the frozen draw table, amended 2026-08-01 for `bolt`/`breath`; [docs/planning-artifacts/epic-5-dossier/DOSSIER.md] — E5-D4 (blast retirement), E5-D13 (humans-only crown), E5-P1 (dragonslayer hunt).

## Open questions for Danilo (not blockers; sensible defaults chosen)

1. **The 5.9 perf gap** — default: run the capture now, record the gap, and ride a **light re-capture** on 5.9's eventual device pass. Say the word if you'd rather accept the gap outright at the epic close and skip the re-capture.
2. **If an archetype is marginally over-band** (say 65–67%) — default: try the cheapest `ai.ts` placement lever first (5.5's farshot fix cost nothing and needed no version bump), and only touch `balance.ts` if placement can't do it. If it's a comp you *like* at that rate, say so and we record a conscious deviation instead — but note 4.12's widening had to be un-accepted one epic later.
3. **The `wardens` floor test** (Task 3) — default: keep the test, re-point its *name and comment* at the measured floor archetype so it stops advertising a floor it no longer watches. Tell me if you'd rather leave it as historical continuity.
4. **Felt-balance scope** — default: a handful of real vs-AI matches across both modes on the production URL, gut yes/no. Tell me if you want specific matchups seeded (e.g. dragon comps vs the Dragon Hunter, to feel the new hunt relation) via Replay.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`.

### Debug Log References

- **Convergence sweeps** run via the dev CLI directly from `packages/engine` (`pnpm exec tsx sim/run.ts --runs=… --seed=… --mode=…`) — the 4.12-recorded `pnpm --filter … sim -- --flags` double-`--` problem is still real. Eight sweeps captured: `runs=200` both modes, `runs=500 × seeds 1/2/3` both modes. Single mode is fast (~2.3s at runs=200); wipeout is ~3× that (cap-length battles).
- **Fixture discovery for Task 5** used throwaway `tsx` probes (since deleted, never committed): the `roster.test.ts` dragon-mirror shape turned out to already run to the 10-engagement cap in wipeout with breath firing in all 10 at constant damages — no fixture design needed, just moving it into wipeout mode. The poison probe was the opposite: the existing fixture ends by wipe at engagement 4, so a *new* mirrored witch+2cleric+2phalanx stall was needed (verified stable at seeds 0xdead/1/7 — 10 engagements, zero deaths, ticks in all 10).
- **Both new pins mutation-verified.** Dropping the wipeout branch in `breathDamage` fails the new cross-engagement pin (plus the two pre-existing breath tests). A first pass of the derived floor guard was deliberately set to `0.35` to watch it fail on `gale` before settling at the real `0.25`.

### Completion Notes List

- **Tasks 1–7 complete and gated. Task 8 (the closing device session + felt-balance sign-off) is Danilo's and is NOT done** — the story stays **in-progress** until that device pass, exactly as story 4.12 did. Nothing in Task 8 is checked, because none of it was performed.
- **THE ERA CERTIFIES IN-BAND — no tuning, no version bump.** `balanceVersion` stays **11**, `logVersion` stays **4**, goldens and hash untouched, replay history intact. Converged maxima: **single 64.3–64.4%** (twin-golems), **wipeout 63.8%** (longbows), stable across seeds 1/2/3 at runs=500. Floors: `gale` 29.6% single / `breath-battery` 30.3% wipeout. All 27 classes covered, 18 archetypes.
- **No accepted deviation is carried.** 4.12's `farshot` band widening was retired by 5.5 and nothing replaced it — a stronger closing position than the squad era's.
- **The convergence rule mattered again, in the reverse direction.** `runs=200` read wipeout `longbows` at **64.6%** — 0.8 points ABOVE its converged 63.8%, close enough to the band to look edge-critical. 4.12's lesson was that 200 runs can *understate* a real crossing; this is the mirror case where it *overstated* one. Recorded in both `sim.test.ts` and the verdict: certify on 500, across seeds.
- **Task 3 found the fourth instance of the 5.4 guard-decay pattern, and it was worse than the story predicted.** The story flagged that `wardens` was no longer the floor; measurement showed it is **2nd of 18 in single (57.3%)** — its `> 0.25` floor assertion had drifted onto nearly the pool's *strongest* comp, while the real floor went unwatched for four epics. (The `sim.test.ts` comment claiming "~61% single" was stale too.) Fixed with a **derived** guard that takes the minimum over the report, so it follows the floor wherever the next wave moves it. The `wardens` test stays — melee-specifically-viable is still worth asserting — with its comment rewritten to say what it does and does not cover.
- **Task 5's gap was real and is now closed twice over.** No test proved a row-AoE's wipeout attenuation survived to the cap (4.12's blast pin was *succeeded*, not replaced, when E5-D4 retired the blast; `breath` was pinned first-hit-only). Added: breath attenuation asserted in **all 10** engagements with a single-mode discriminator proving it pins the *mode split*; and poison ticking in **all 10** engagements of a zero-death stall. The pre-existing poison test was also tightened from `>= 2` segments to its exact shape (4 segments, ticks in 3) with a comment stating what it actually proves — poison outliving its caster, which is a different property from cap persistence.
- **Task 6: all four PRD amendments landed as dated in-place notes**, no history rewritten, doc-only. FR14 (role vocabulary 7 → 10 + the live `dragonslayer` → `dragon` hunt), FR15 (table growth 6 → 12 → 17 → 27, with `BALANCE.classes`/`ROSTER.md` named normative instead of restating 27 rows, plus its two now-stale blast clauses flagged), FR35 (humans-only crown, E5-D13, incl. the AI draw's `race` filter superseding 4.8's `sizeClass` one), FR38 (the monster wave shipped — 10 classes, the Whelp's 1-slot exception, the `race` field).
- **`performance-verdict.md` carries the 5.9 ORDERING GAP now, written before the capture** so the document is honest either way: it states exactly what the closing capture covers (5.2 chrome, 5.3 terrain + enlarged board, 5.6/5.7/5.8) and what it cannot (5.9's sheet), and leaves the resolution — light re-capture vs accept-at-close — as Danilo's recorded call.
- **Full gate green:** typecheck ✓, lint ✓, knip ✓, coverage ✓ (47 files, **755 tests**; engine 99.06% lines vs the 90% gate), web build ✓.
- **Open question 3 was answered by implementing its stated default** (keep the `wardens` test, re-point its name/comment) since it did not block. Questions 1, 2 and 4 remain Danilo's: Q2 never triggered (nothing crossed), Q1 and Q4 belong to the device session.

#### AC4 — SATISFIED WITH A RECORDED DEVIATION (the story-5.3 precedent), not satisfied as written

AC4 asks for a capture that "shows **no NFR1 in-battle floor breach**." **It does not.** Recording this precisely, because the honest status of this AC is the most important thing in this story:

- **The benchmark had to be re-pointed before the capture could mean anything.** The three-mages fixture in `performance-verdict.md` was invalid twice over: it is a 3-unit army at `balanceVersion` 2 (fails `validateMatchSetup` at `slotBudget` 5, and would display non-replayable at 11), and its entire worst-case premise — "3 simultaneous targets per blast" — died with story 5.4's E5-D4. The old worst case had silently become one of the *lightest* comps. Replaced by a measurement-chosen mirrored **Emberdrake + 3 Knights** board (68 attacks / 82 target-instances / 110 events / the full 10-engagement cap), seeded to History at `balanceVersion` 11 and driven through Replay so it is byte-identical run to run. **This is a fourth instance of the 5.4 guard-decay pattern — this time in the performance methodology rather than a test.**
- **The result: the 30fps in-battle floor fails, decisively.** 275 of 2,878 in-battle frames below 30fps at 1× (9.56%), against the 5.0 baseline's 4 in 4,205 (0.095%). ×2 is worse (median 40.16, 13.8% sub-30). Median goes **40.00 → 59.88 between the first and second half** of the battle as units die — load tracks living units and *concurrent* row-AoE popups, which points at the per-beat trace/popup/wash churn this document has named since story 3.4.
- **The evidence is unusually clean, so it should not be re-litigated.** The device held 60Hz all session (zero samples >100fps) and values quantise exactly to vsync multiples with the **50–58fps band empty** — so 5.0's adaptive-refresh caveat does not apply and a 40fps sample is a genuine 25ms frame.
- **PO decision (Danilo, 2026-08-01): recorded deviation, DEFERRED to a dedicated performance story "at the very end."** His felt-experience is the deciding input under the 5.0 precedent: *"it felt smooth still. i didn't see performance downgrade."* Both facts stand — the failure is measured AND imperceptible on the target device. Full record in `performance-verdict.md`; the story is scoped and logged in `deferred-work.md` with pooling named as the lever.
- **Flagged for the schedule, not decided here:** Epic 6 adds network send/receive onto the same per-beat budget this capture says has no headroom. "At the very end" versus "before link-play" is worth one explicit decision at the epic-5 retro or the link-play design pass rather than defaulting.
- **What AC4 DID satisfy:** story 5.3's owed measurement is discharged (entry burst read 2.61fps vs ~8fps at 5.0 and ~10.9fps at 5.2 — same event, materially deeper, one session so flagged for a second reading), and the 5.9 ordering gap was recorded in `performance-verdict.md` *before* the capture ran.
- **Third consecutive missed per-scenario reset** (5.0, 5.2, 5.10): the ×2 trace again contained the 1× trace as an exact prefix (2,888 samples, verified element-wise, sliced — nothing lost or double-counted). Three for three is a procedure problem, not user error; a tooling fix is proposed in `deferred-work.md`.

**AC5 remains OPEN.** The felt-*balance* sign-off across the full roster — real matches, humans/monsters/dragons/tactics/leaders/crits — has not happened. "It felt smooth" is a performance observation about a replayed dragon fixture, not the balance certificate. That sign-off is the epic's closing gate and is the only thing still standing between this story and `review`.

### Change Log

- 2026-08-01: Tasks 1–7 — the era certified in-band at `balanceVersion` 11 with no tuning; FR19 cap-boundary compounding pinned for both `breath` and poison; the pool viability floor re-pointed from a named comp to a derived minimum; four PRD amendments; the epic-5 balance-verdict addendum; the 5.9 perf ordering gap recorded. Task 8 (device session) outstanding.
- 2026-08-01: Task 8 PERF HALF — benchmark re-pointed (the three-mages fixture was invalid and its worst-case premise died with E5-D4), capture run on the deployed build, NFR1 in-battle floor FAILS on the new worst case (275/2,878 sub-30 at 1×). PO decision: recorded deviation, deferred to a dedicated performance story; felt smooth on device. Story 5.3's owed capture discharged. AC4 satisfied-with-deviation; **AC5 (felt-balance sign-off) still open** — story stays in-progress.

### File List

- `packages/engine/test/sim.test.ts` — derived pool-viability floor guard (single + wipeout, the latter reusing the existing heavy sweep); `wardens` test re-titled and its stale premise rewritten; 5.10 certification block added to the `CI_CONFIG` header
- `packages/engine/test/wipeout.test.ts` — NEW: cross-engagement `breath` attenuation pin through the cap (4.12's blast-pin successor) + cap-length poison-persistence pin; existing poison test tightened from `>= 2` to its exact shape
- `docs/balance-verdict.md` — the epic-5 addendum (converged tables both modes, methodology + the reverse-direction convergence lesson, the floor-drift record, the compounding succession, coverage certification, a sharpened PvP scope note)
- `docs/performance-verdict.md` — the story-5.10 section: the recorded 5.9 ordering gap + what the closing capture must cover (capture record itself pending Task 8)
- `docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md` — dated amendments to FR14, FR15, FR35, FR38
- `docs/implementation-artifacts/5-10-the-pre-pvp-verdict.md` — this record
- `docs/performance-verdict.md` — (2nd pass) the benchmark re-point + the full story-5.10 capture record, verdict and PO deviation
- `docs/implementation-artifacts/deferred-work.md` — NEW entry: the performance story (NFR1 floor failure, pooling lever, sequencing-vs-link-play input, the reset-procedure tooling fix)
- `docs/implementation-artifacts/sprint-status.yaml` — 5-10 status
