---
baseline_commit: ebd45e22d1392d178014ebf75f9c9c0e6e593e6e
---

# Story 3.0: Balance tuning pass — the blast tamed, the archer a caster-hunter

Status: done

## Story

As a player,
I want the Mage's row blast toned down and the Archer to counter every caster,
so that no single class dominates and battles stay tense before my history starts recording them.

## Acceptance Criteria

1. **FR14 amendment — archer vs casters (one-way).** An Archer's attack deals ×1.5 damage to Mage, Cleric, AND Witch. One-way: Cleric and Witch take **no new penalty** attacking the Archer (their attacks against the Archer stay ×1.0); the core triangle (Mage > Knight > Archer > Mage, ×1.5/×0.75 both directions) is unchanged. `rpsBeats`' one-target-per-class map becomes a small multi-target lookup — a contained balance-data shape change, no new events, no new player choices, no UI work.
2. **FR10 amendment — blast attenuation.** Each target of the Mage's row blast takes damage attenuated by the named `blastAttenuation` balance ratio (initial ×0.75), applied **after the base formula and before RPS** — integer math and FR15's fixed rounding order preserved (base → blast attenuation → RPS → status modifiers → min-1 clamp; FR20 determinism intact).
3. **AD-8 discipline.** `BALANCE.version` bumps (1 → 2), the balance-hash test is re-pinned, and golden battles are re-recorded with hand-re-verified verdicts.
4. **Rules doc honesty.** `docs/rules.md` reflects the tuned rules and numbers, and story 2.4's drift guard stays green — extended so the new numeric facts (archer-vs-casters rule, blast attenuation) are executable-guarded too (team agreement: numeric player-facing content ships with a drift guard).
5. **NFR4 both-mode sweep.** The sim harness gains the mode knob deferred since story 1.10 and the sweep runs in BOTH modes — single-engagement and wipeout. No archetype exceeds the ≤65% aggregate dominance band in either mode (asserted in CI and verifiable from the CLI).
6. **On-device felt-balance acceptance (sign-off gate).** On the deployed production build, Danilo plays real matches on his own device: the blast no longer reads "too broken" and melee comps feel viable.

## Tasks / Subtasks

- [x] Task 1: Balance data change (AC: 1, 2, 3)
  - [x] In `packages/engine/src/balance.ts`: add `formulas.blastAttenuation: { num: 3, den: 4 }` (the ×0.75 `Ratio`), restructure the RPS data for the one-way archer rule (see Dev Notes — **do not** make a symmetric multi-target `rpsBeats` naively), bump `version: 1` → `2`
  - [x] Update `BalanceData`/type shapes and doc comments (every engine export carries doc comments — NFR3)
- [x] Task 2: Damage pipeline (AC: 1, 2)
  - [x] `packages/engine/src/resolve.ts` `damagePipeline` (~line 359): advantage check honors the multi-target/one-way data; disadvantage check stays triangle-only
  - [x] Blast attenuation applied to Mage row-blast damage per target — after base, before RPS — including the **confused-Mage self-blast misfire path** (`misfire`, ~lines 264–272); Cleric staff attack and all non-blast paths unaffected. **DEVIATION (PO-approved during dev, see Debug Log): attenuation is WIPEOUT-MODE-SCOPED** — `blastDamage(attacker, defender, weakened, mode)`; single-mode blasts stay unattenuated
- [x] Task 3: Re-pin and re-record (AC: 3)
  - [x] `packages/engine/test/balance-hash.test.ts`: `{ 2: '19aeaa94' }` pinned (version-1 entry kept for contiguity)
  - [x] Goldens: #4 (blast, single) unchanged under mode-scoping; #5 and #8 hand-re-derived (arrow-kill of B's witch, new tick counts 3 and 6; #8's verdict B 0/60 verified to SURVIVE) then re-recorded with `vitest -u`
  - [x] Recomputed/retuned: `roster.test.ts` fatal-tick board (front-row archer keeps the tick lethal), `wipeout.test.ts` weaken board (B:0 → back-row knight soaks the first cast), `balance.test.ts` pins + ratio invariants; `damage.test.ts`/`combat.test.ts`/`confusion.test.ts`/`sim.test.ts` anchor verified — no changes needed (single-mode battles without archer-vs-caster damage are bit-identical to v1)
- [x] Task 4: New unit tests (AC: 1, 2)
  - [x] Archer→Mage/Cleric/Witch each ×1.5; Cleric→Archer stays ×1.0 (one-way regression); Mage→Archer stays ×0.75 (triangle intact); Witch→Archer pipeline regression
  - [x] Blast tests: wipeout table (25/13/14/13/15/17), single≡magicDamage equivalence sweep, order discriminator (knight-INT blast → archer = 1, after-RPS order would give 2), weakened chain (23→17→25→12), min-1 clamp last
- [x] Task 5: Sim sweep mode knob + both-mode verification (AC: 5)
  - [x] `SweepConfig.mode` ('single' | 'wipeout', defaults 'single'), threaded into `playMatch`
  - [x] `run.ts`: `--mode=` string flag + hard error on ANY unrecognized argv (kills the silent-fallback trap)
  - [x] `sim.test.ts`: wipeout acceptance-band test at the same `runsPerPair: 15` (fits the budget; documented) + default-mode≡single test
  - [x] 500-run sweeps recorded below (both modes pass; plus the full attribution matrix that drove the mode-scoping decision)
- [x] Task 6: Rules doc + drift guard (AC: 4)
  - [x] `docs/rules.md`: triangle passage gains the caster-hunt sentence; blast bullet gains the wipeout attenuation sentence
  - [x] `rules-doc.test.ts`: two new guard tests — hunter's complete ×1.5 prey list built from `rpsBeats`+`rpsHunts` (fails on a silently emptied map), and the exact `×0.75` attenuation literal
  - [x] Draft cards: intentionally unchanged (triangle-only "beats" line stays true; full rule lives in Help/rules.md; hunts-on-cards is Epic 4 UI fodder)
- [x] Task 7: Gate, deploy, sign-off (AC: 6)
  - [x] Full gate green: typecheck ✓, lint ✓, 309 tests ✓ (incl. both-mode bands), engine coverage 99.7% lines (≥90% gate)
  - [x] Code review complete (3-layer adversarial, Opus 4.8): zero shipping defects, 4 low robustness patches applied — see Review Findings above; gate re-verified green after patches (309 tests)
  - [x] Pushed (e6a06c4) → CI green → deployed to prod
  - [x] **AC6 ACCEPTED (2026-07-15, Danilo on device):** "the mage blast is feeling better and less OP. 3-0 is done." Felt-balance sign-off recorded — STORY DONE.

## Dev Notes

### The one-way trap (read before touching balance.ts)

The current pipeline derives BOTH multipliers from one map (`resolve.ts:359-366`):

```ts
const rps = rpsBeats[attacker] === defender ? formulas.rpsAdvantage
          : rpsBeats[defender] === attacker ? formulas.rpsDisadvantage
          : undefined;
```

If you naively generalize `rpsBeats` to `{ archer: ['mage','cleric','witch'], ... }` and keep the symmetric derivation, the disadvantage branch (`rpsBeats[defender].includes(attacker)`) makes **Cleric→Archer and Witch→Archer deal ×0.75** — precisely what the amended FR14 forbids. The advantage and disadvantage relations are no longer mirror images.

**Recommended shape** (final naming is dev's call; the *semantics* below are pinned by AC 1 and the Task 4 tests):

```ts
// triangle: symmetric — attacker deals ×1.5, reverse direction deals ×0.75 (unchanged semantics)
rpsBeats: { mage: 'knight', knight: 'archer', archer: 'mage' },
// one-way hunts: attacker deals ×1.5; NO reverse penalty
rpsHunts: { archer: ['cleric', 'witch'] },
```

Pipeline: advantage if `rpsBeats[attacker] === defender || rpsHunts[attacker]?.includes(defender)`; disadvantage if `rpsBeats[defender] === attacker` (untouched). This keeps the triangle exactly as-is, makes the one-way rule structurally incapable of leaking a penalty, and is the "small multi-target lookup" the change proposal describes.

**The `rpsBeats` shape must stay `Partial<Record<UnitClass, UnitClass>>`** — do NOT restructure it. Two more consumers pin the current shape: `apps/web/src/flow/draftModel.ts:49,54` derives the Draft cards' `beats`/`beatenBy` fields from it at runtime (typed against the current shape; `draft-model.test.ts:39-46` pins the derivation), and `packages/engine/test/balance.test.ts:55` asserts `toEqual({ mage: 'knight', knight: 'archer', archer: 'mage' })`. With the recommended additive `rpsHunts`, draftModel compiles and passes unchanged; `balance.test.ts` needs its pin extended for `rpsHunts` (and `blastAttenuation` added to the formula-ratio structural invariants at `balance.test.ts:27-43`).

### Blast attenuation placement

- Named ratio in `formulas` (`Ratio = { num, den }` integer pairs — the established pattern, `balance.ts:8-11`): `blastAttenuation: { num: 3, den: 4 }`.
- In production code `magicDamage` is called from exactly the two blast sites and nowhere else: normal blast (`act` case `'mage'`, `resolve.ts:204-208` → `strike`) and confused-Mage self-blast (`misfire`, `resolve.ts:264-272`). The Cleric staff attack uses `physicalDamage` (`resolve.ts:221`), so it cannot be hit through `magicDamage`. Caveat before baking attenuation into `magicDamage` itself: it is exported public API (`packages/engine/src/index.ts:30`) and directly table-tested per-call (`damage.test.ts:39-52`) — folding attenuation in changes the exported contract's meaning. Prefer a `blastDamage` wrapper or an explicit pipeline parameter; either way both blast call sites get it and nothing else does (staff, Archer shots, melee all unattenuated — Task 4 tests pin this).
- Fixed integer order (PRD FR15, amended): base → `floor(base × 3/4)` → RPS floor → Weaken halve → `max(minDamage, …)`. Every stage floors. Worked example for tests (magic mitigates with **MEN**, not VIT — `magicDamage` passes `'men'` to the pipeline, `resolve.ts:348-350`): Mage→Knight (INT 30, knight MEN 14): base = 30 − floor(14/2) = 23 → attenuated floor(23×3/4) = 17 → RPS advantage floor(17×3/2) = **25** (pre-attenuation value is 34, pinned today at `damage.test.ts:41`).

### AD-8 mechanics (exact, from the code)

- `BALANCE.version` lives at `balance.ts:68` (field is `version`, not `balanceVersion` — that name is the `MatchSetup` field populated from it).
- Hash guard: `test/balance-hash.test.ts` pins `EXPECTED_HASHES: Record<number, string>` (line 12, currently `{ 1: 'bfce425a' }`); hash = 32-bit FNV-1a over key-sorted canonical JSON (`src/hash.ts`). Two-step re-pin: bump version, then ADD the new entry — versions must stay contiguous from 1 and `BALANCE.version` must be the newest key. Run the test once to learn the new hash value from the failure message.
- Goldens: `test/golden.test.ts`, 8 snapshots in `test/__snapshots__/golden.test.ts.snap`, re-record via `vitest -u`. Each golden also asserts a hand-verified **verdict** — re-verify those by reading the new logs, don't just accept new snapshots. Every golden's `setup` helper pins `balanceVersion: BALANCE.version`, so they track the bump automatically.
- History/replay staleness: NOT a concern — history storage doesn't exist yet (that's story 3.1; the whole point of sequencing 3.0 first). Only `lordly.v1.settings` is in storage today.

### Sim harness facts

- CLI: `pnpm --filter @lordly/engine sim` (`tsx sim/run.ts`); flags `--runs` (default 20, `MAX_RUNS` 500), `--seed` (default 1), `--threshold` (default 0.65); exits 1 when any archetype's `winRate > threshold` (strictly greater — exactly 0.65 passes).
- CI band test: `sim.test.ts` `ACCEPTANCE_BAND = 0.65`, config `{ baseSeed: 1, runsPerPair: 15, threshold: 0.65 }` (runsPerPair was raised from 5 for sampling noise — see comment at sim.test.ts:22-30; keep that lesson in mind when choosing the wipeout run count).
- Win rate = `(wins + draws/2) / games`; total games = pool² × runsPerPair.
- If the band FAILS after tuning: that is the story working as designed — adjust `blastAttenuation` (and only then other numbers) and re-run; every adjustment is still one version-2 change until the story ships. The 2026-07-13 open question "is it archer weakness or Witch strength (AGI 26 first-strike + sleep/confusion)?" gets answered empirically here — report what the sweep shows either way.

### Drift guard interplay (story 2.4's mechanism)

- `apps/web/test/rules-doc.test.ts` imports `docs/rules.md?raw` + `BALANCE` and asserts: per-class HP/actions, roles/behaviors vs Draft `classRulesCard`, **every `rpsBeats` pair as "{Attacker} beats {Target}" plus the literal `×1.5`/`×0.75` computed from the ratios** (lines 50–58), poison/cap, element→spell, AGI order, misfire %, one table row per class. The RPS iteration must be updated for the new data shape and extended to the one-way rule + attenuation.
- `docs/rules.md` passages to touch: line 22 (triangle prose), line 16 (Mage table row), line 35 (blast bullet). Player-worded, like 2.4 wrote it — e.g. "Arrows find the robes: the Archer deals ×1.5 to Mage, Cleric, and Witch — they get no such bonus back."
- The guard runs in CI via the full suite (`pnpm coverage`, ci.yml:35). RED→GREEN: expect the guard red immediately after the BALANCE change, green after the doc edit — same discipline 2.4 used.

### Architecture compliance

- AD-1/AD-4: pure engine, balance as versioned data — this story is entirely inside that boundary. Zero `apps/web` runtime changes (only the guard test; the Draft cards intentionally stay triangle-only — see Task 6). No new events, no `logVersion` bump — the next `logVersion` bump is Epic 4's single combined one (crit flag + StatusCleared); do not add events here.
- AD-2: nothing to render differently — damage numbers flow through existing `UnitAttacked` payloads.
- No ADR required: no spine AD is amended (AD-8's version-bump mechanism is being *used*, not changed). If the RPS data restructure feels load-bearing during dev, a short ADR is welcome but optional.
- Engine coverage gate ≥90% still applies (NFR2).

### Testing standards summary

Vitest 4.1.x workspace-wide; engine tests in `packages/engine/test/*.test.ts`, table-driven arithmetic style (see `damage.test.ts`); property tests via `@fast-check/vitest` must stay green untouched (termination, judging symmetry, seed identity); goldens re-recorded deliberately with verdict re-verification; run everything through `pnpm coverage` at the root for the CI-equivalent gate. Node 24 via nvm PATH prefix for every command.

### Project Structure Notes

- All engine edits under `packages/engine/{src,test,sim}` — matches the spine's structural seed exactly.
- `docs/rules.md` is the player-facing artifact; `apps/web/test/rules-doc.test.ts` is its guard; `apps/web/src/flow/rulesDoc.ts` (parser) should need no changes.
- No conflicts with the unified structure detected.

### Previous story intelligence (2.4 + epic-2 retro)

- 2.4 authored `docs/rules.md` FROM `BALANCE` so the guard was green on first run — same trick applies in reverse here: change BALANCE first, let the guard's failure list enumerate every doc line needing an edit.
- The guard pins **exact literals** (`×1.5`, `×0.75`) — new numbers must appear in the doc exactly as the ratios compute.
- Review-theme watchlist from epic 2 (30 patches): derived-value drift between tests and data, positional-parsing fragility in the guard, blind snapshot updates. Golden verdicts are the blind-update risk in THIS story.
- Zero engine changes happened all of epic 2 — this is the first engine touch since 1.10; expect the purity lint layer (AST guard, story 2.0) to be strict about anything effectful in `packages/engine/src/**`.

### Git intelligence

Recent commits (`40549b1` correct-course docs, `1d8d90e` retro, `d418c9b` story 2.4) confirm: docs-driven change flow, story commits as single commits titled "Story X.Y: …", CI (`ci` check) + deploy on main green each push. Follow the same commit convention: `Story 3.0: balance tuning pass — blast attenuation, archer hunts casters`.

### References

- [Source: docs/planning-artifacts/sprint-change-proposal-2026-07-14.md] — the approved change proposal (scope, rationale, sequencing)
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#Feature-3/4] — amended FR10 (blast attenuation), FR14 (archer-vs-casters), FR15 (fixed order)
- [Source: docs/planning-artifacts/epics.md#Story-3.0] — story ACs (BDD form)
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-8] — versioned balance discipline; also AD-1, AD-4, conventions
- [Source: packages/engine/src/balance.ts:41,67-89] — rpsBeats, version, formulas (current shapes)
- [Source: packages/engine/src/resolve.ts:204-208,264-272,301-315,339-366] — blast, misfire, strike, damage pipeline
- [Source: packages/engine/test/balance-hash.test.ts:12-30] — hash pin mechanism
- [Source: packages/engine/test/golden.test.ts:6-14] — golden re-record discipline
- [Source: packages/engine/sim/sweep.ts:18-25,98-150; sim/run.ts:24-92; test/sim.test.ts:20-31,111-150] — sweep config, mode fence, acceptance band, determinism anchor
- [Source: apps/web/test/rules-doc.test.ts:41-58; docs/rules.md:16,22,35] — drift guard ↔ rules doc coupling (card check = role/behavior only)
- [Source: packages/engine/test/balance.test.ts:27-43,55; apps/web/src/flow/draftModel.ts:47-59; apps/web/test/draft-model.test.ts:39-46] — the other rpsBeats consumers pinning its shape
- [Source: docs/implementation-artifacts/2-4-help-rules-and-credits-screens.md#Dev-Agent-Record] — guard authoring lessons
- [Source: docs/implementation-artifacts/epic-2-retro-2026-07-14.md] — team agreements, sequencing discovery

## Review Findings

Three-layer adversarial review (2026-07-14, Opus 4.8 reviewers), triaged: **zero shipping-behavior defects** — Blind Hunter and Acceptance Auditor both verified every domain invariant by running the suite (one-way hunt can't leak a reverse penalty, pipeline order correct, mode threaded to both blast sites, single-mode blast bit-identical to v1, purity/determinism intact). All six ACs confirmed genuinely satisfied; AC6 correctly open. Four low-severity robustness patches applied (test/CLI/guard code, no product-behavior change); two dismissed.

- [x] [Review][Patch] Drift guard prey-list robust to a hunter with no triangle prey + single-element list [apps/web/test/rules-doc.test.ts:63-69] — a future non-triangle hunter (e.g. mercenary) would have crashed the guard with an opaque `cap(undefined)` TypeError; now builds the prey list defensively.
- [x] [Review][Patch] Balance invariant: a hunt must not contradict the triangle [packages/engine/test/balance.test.ts:60-70] — added assertion that no hunted class beats the hunter in `rpsBeats`, since the pipeline's advantage-OR would silently flip that ×0.75 to ×1.5. Latent (current data safe); now guarded.
- [x] [Review][Patch] Sim CLI rejects a stray `=` instead of truncating [packages/engine/sim/run.ts:32,50] — `--mode=single=x` / `--runs=100=x` now fail (slice on the first `=` and validate the remainder), honoring the file's no-silent-coercion stance.
- [x] [Review][Patch] Documented longbows as the wipeout band's binding constraint [packages/engine/test/sim.test.ts] — both reviewers flagged the ~1.3-pt wipeout margin; comment points future tuners at wipeout-longbows first (matches the existing ambushers-fragility note).
- [x] [Review][Dismiss] "Provided diff incomplete" (Auditor) — an artifact of how the review diff was assembled, not a code issue; reviewers read source directly and covered every file.
- [x] [Review][Dismiss] "rules.md is customer-facing copy" (Blind Hunter, process note) — in-game help text, not external/regulated content; the human-review gate is Danilo's AC6 on-device sign-off.

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5); review by Claude Opus 4.8 (three parallel layers)

### Debug Log References

- RED→GREEN held: 14 new-test failures before the implementation, all green after; the cascade then shook out exactly as the story predicted (hash ×2, goldens, roster/wipeout boards, sim band).
- **THE TUNING SAGA (the sweep did its job).** The approved numbers as written — global blast ×0.75 + hunts ×1.5 — failed AC 5 in single mode: `longbows` (archer+archer+knight) at **75.3%**. Systematic attribution (deterministic 500-run sweeps): attenuation ALONE → longbows 69.8%; hunts ALONE → 57.7% ✓. The blast nerf, not the archer buff, was the driver: single mode is an HP-% chip-ledger war, mage chip was half the pool's police force, and *any* attenuation value (4/5, 5/6, 7/8, 9/10 all tested) hands the meta to the archer wall (~74% each — the meta is knife-edged on exact integer thresholds). Side-lever candidates all failed: archer STR 22/20 (74.2/73.3), archer HP 80/75 (73.9 both — longbows' ledger strength is the untouched 140 HP wall knight, and kills land after the chip is banked), merc STR 28/30 (74.9/74.5), knight HP 120/110 (75.1/75.0), heal ×3/2 (75.0, and pushes farshot to 64.1 in wipeout), +phalanx pool archetype (68.1, but drags bulwark over at 65.4).
- **Head-to-head matrix exposed the structure**: longbows went 100% vs every mage comp (post-attenuation blast needs 7 hits vs a 90 HP archer — impossible in one engagement; melee mathematically cannot break a 140 HP wall in one engagement either), countered ONLY by bulwark (0%). In wipeout the same comp is healthy (0–41% vs sustain/status comps).
- **The v1 baseline was measured for the first time in wipeout** (the knob deferred since 1.10): **three-mages 74.6% dominant** — Danilo's felt "blast too broken" empirically confirmed, and located: blasts compound across engagements. Single-mode v1 was fine (60.3% max) — there the triangle polices mages.
- **Resolution (PO decision, AskUserQuestion during dev): mode-scoped attenuation** — ×0.75 in wipeout only. Both modes pass: single 59.7% max (ambushers), wipeout 62.9% max (longbows). PRD FR10 / epics AC / rules.md updated to record the scoping and its evidence.
- Test-board casualties of the hunt (both preserved by intent, not weakened): roster fatal-tick board (4 back-row arrows now kill the witch outright → one archer moved to front row: 3×28 = 84 leaves her at 1 hp for the tick), wipeout weaken board (the eng-1 arrow-kill of B's fire witch let eng-2's first cast re-weaken the knight pre-swing → B:0 is now a back-row knight, arrows bounce at 7).
- Golden #8's verdict (B, 0%/60%) survived the retune by coincidence worth noting: the witch dies to arrows instead of dots, one tick fewer, same final percentages — verified by hand before `vitest -u`.
- Prettier caught run.ts formatting on the gate pass; fixed.

### Completion Notes List

- **AC1 ✅** `rpsHunts: { archer: ['cleric', 'witch'] }` — additive one-way map; `rpsBeats` shape untouched (draftModel/balance.test pins hold); pipeline advantage = triangle OR hunt, disadvantage = triangle ONLY (the symmetric-penalty trap from Dev Notes is structurally excluded and regression-tested: cleric→archer = 2 neutral, witch→archer = 20 neutral, mage→archer = 18 disadvantage).
- **AC2 ✅ (amended, PO-approved)** `blastDamage(attacker, defender, weakened, mode)`: base → ×3/4 attenuation (WIPEOUT ONLY) → RPS → weaken → min-1, exported alongside an untouched `magicDamage`; both blast call sites (normal + confused self-blast) mode-aware. Single-mode blast ≡ magicDamage, equivalence-tested.
- **AC3 ✅** version 2, hash `19aeaa94` pinned, goldens re-recorded with hand-verified verdicts (#4 byte-identical, #5/#8 re-derived).
- **AC4 ✅** rules.md states the hunt (data-built prey list "Mage, Cleric, and Witch" + ×1.5) and the wipeout attenuation (×0.75 literal); both drift-guarded; Draft cards intentionally triangle-only.
- **AC5 ✅** Mode knob shipped (SweepConfig + `--mode=` + argv hardening); CI band enforced in BOTH modes; 500-run record below. The 1.10-deferred wipeout sweep debt is paid — and it immediately found the v1 wipeout dominance.
- **AC6 ✅** Deployed (e6a06c4, CI green); Danilo's on-device acceptance 2026-07-15: "the mage blast is feeling better and less OP. 3-0 is done."
- **500-run sweep record (balance v2, seed 1):**
  - single: ambushers 59.7, longbows 57.7, three-mages 57.0, gale 51.7, farshot 51.7, cabal 50.1, talons 48.4, bulwark 45.4, hex-coven 45.2, wardens 33.0 — ✅ band
  - wipeout: longbows 62.9, wardens 58.0, cabal 53.9, farshot 51.0, hex-coven 50.3, bulwark 47.9, talons 45.6, ambushers 45.5, gale 43.7, three-mages 41.1 — ✅ band
  - Witch-strength question (2026-07-13): answered — no witch comp dominates in either mode (hex-coven ≤50.3); the 2026-07-13 loss pattern is explained by v1's wipeout mage dominance + pre-hunt archer weakness vs casters, both now addressed.
  - Watch item for the retro: wardens at 33% single / hex-coven mid-table — melee-witch comps are the new floor; Danilo's "melee too weak" instinct shows up here and is Epic 4's tactics territory (attack-weakest would fix wardens' wasted swings).

### File List

- `packages/engine/src/balance.ts` — MODIFIED: version 2, `rpsHunts`, `formulas.blastAttenuation` (+ types/doc comments)
- `packages/engine/src/resolve.ts` — MODIFIED: pipeline advantage/hunt + optional pre-RPS ratio; exported mode-aware `blastDamage`; mode threaded through takeTurn/act/misfire
- `packages/engine/src/index.ts` — MODIFIED: export `blastDamage`
- `packages/engine/sim/sweep.ts` — MODIFIED: `SweepConfig.mode` threaded to `playMatch`
- `packages/engine/sim/run.ts` — MODIFIED: `--mode=` flag, unrecognized-argv hard error, mode in header
- `packages/engine/test/balance.test.ts` — MODIFIED: rpsHunts pin + one-way structural invariants, blastAttenuation ratio pins
- `packages/engine/test/damage.test.ts` — MODIFIED: hunts cases, one-way regressions, blastDamage suite (wipeout table, single≡magic, order discriminator, weaken chain, clamp)
- `packages/engine/test/balance-hash.test.ts` — MODIFIED: version-2 hash pinned
- `packages/engine/test/golden.test.ts` — MODIFIED: #5/#8 assertions re-derived; snapshots re-recorded (`__snapshots__/golden.test.ts.snap`)
- `packages/engine/test/roster.test.ts` — MODIFIED: fatal-tick board retuned (front-row archer)
- `packages/engine/test/wipeout.test.ts` — MODIFIED: weaken-reset board retuned (back-row knight soak)
- `packages/engine/test/sim.test.ts` — MODIFIED: wipeout band test, default-mode≡single test
- `apps/web/test/rules-doc.test.ts` — MODIFIED: hunt prey-list + attenuation drift-guard tests
- `docs/rules.md` — MODIFIED: caster-hunt sentence, wipeout-attenuation sentence
- `README.md` — MODIFIED: sim CLI `--mode` docs, both-mode band note
- `docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md` — MODIFIED: FR10/FR15 mode-scoping (PO-approved deviation recorded)
- `docs/planning-artifacts/epics.md` — MODIFIED: story 3.0 AC2 + FR10 inventory line mode-scoping
- `docs/implementation-artifacts/sprint-status.yaml`, this story file — MODIFIED: tracking

### Change Log

- 2026-07-14: Story 3.0 implemented — archer one-way caster hunt (`rpsHunts`, ×1.5 to Mage/Cleric/Witch, no reverse penalty) + Mage blast attenuation (×0.75, **wipeout-scoped** — a PO-approved amendment driven by both-mode sweep evidence: v1 wipeout was three-mages-dominant at 74.6%, global attenuation made single-mode archer walls dominant at ~75%). balanceVersion 2, hash re-pinned, goldens hand-re-verified + re-recorded, sweep mode knob shipped (the 1.10 debt), CI band now enforced in both modes, rules.md + drift guard extended. 309 tests green, engine coverage 99.7%. Pending: deploy + on-device felt-balance sign-off (post-review).
