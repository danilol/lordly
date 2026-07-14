# Story 3.0: Balance tuning pass — the blast tamed, the archer a caster-hunter

Status: ready-for-dev

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

- [ ] Task 1: Balance data change (AC: 1, 2, 3)
  - [ ] In `packages/engine/src/balance.ts`: add `formulas.blastAttenuation: { num: 3, den: 4 }` (the ×0.75 `Ratio`), restructure the RPS data for the one-way archer rule (see Dev Notes — **do not** make a symmetric multi-target `rpsBeats` naively), bump `version: 1` → `2`
  - [ ] Update `BalanceData`/type shapes and doc comments (every engine export carries doc comments — NFR3)
- [ ] Task 2: Damage pipeline (AC: 1, 2)
  - [ ] `packages/engine/src/resolve.ts` `damagePipeline` (~line 359): advantage check honors the multi-target/one-way data; disadvantage check stays triangle-only
  - [ ] Blast attenuation applied to Mage row-blast damage per target — after base, before RPS — including the **confused-Mage self-blast misfire path** (`misfire`, ~lines 264–272); Cleric staff attack and all non-blast paths unaffected
- [ ] Task 3: Re-pin and re-record (AC: 3)
  - [ ] `packages/engine/test/balance-hash.test.ts`: add `{ 2: '<newHash>' }` to `EXPECTED_HASHES` (keep entry for version 1 — the contiguity test requires it)
  - [ ] Re-record goldens (`vitest -u`) — **hand-re-verify each golden's asserted verdict first**, especially golden #4 (the blast golden); update verdict assertions where outcomes legitimately change
  - [ ] Recompute the derived-arithmetic expectations: `damage.test.ts` (mage→knight/archer blast values), `roster.test.ts` (blast per-target damage), `combat.test.ts`, `confusion.test.ts` (seeded misfire battles — attenuation shifts HP totals and can move death timing), `balance.test.ts` (rpsBeats/rpsHunts pins + formula-ratio invariants), and the **determinism anchor** in `sim.test.ts` (~lines 111–142) — recompute deliberately, never blind-update an anchor
- [ ] Task 4: New unit tests (AC: 1, 2)
  - [ ] Archer→Mage/Cleric/Witch each ×1.5; **regression: Cleric→Archer staff attack stays ×1.0** (the one-way guarantee) and Mage→Archer stays ×0.75 (triangle intact)
  - [ ] Blast attenuation order test: base → attenuation → RPS → Weaken → min-1 clamp, with hand-computed integer values; attenuation applies to confused-Mage misfire blast; does NOT apply to Cleric staff or Archer/melee attacks
- [ ] Task 5: Sim sweep mode knob + both-mode verification (AC: 5)
  - [ ] `packages/engine/sim/sweep.ts`: add `mode: 'single' | 'wipeout'` to `SweepConfig`, thread into the `MatchSetup` literal (~line 150, currently hardcoded `'single'`)
  - [ ] `packages/engine/sim/run.ts`: `--mode` CLI flag (default `single`) — note `arg()` (run.ts:25) matches only `--name=value` form AND is numeric-only; unmatched flags fall back silently to defaults, so the new mode flag needs its own string parsing (and consider failing on unrecognized argv to kill the silent-fallback trap)
  - [ ] `packages/engine/test/sim.test.ts`: second acceptance-band test for `mode: 'wipeout'` (≤65%, `flagged` empty); pick `runsPerPair` mindful of CI time — wipeout battles run up to 5 engagements (~5× compute); document the choice
  - [ ] Run a high-`runs` sweep locally in BOTH modes — CLI flags use `=` form: `--runs=500` (the space form `--runs 500` is **silently ignored** and runs the default 20); record the per-archetype results in this story's Dev Agent Record
- [ ] Task 6: Rules doc + drift guard (AC: 4)
  - [ ] `docs/rules.md`: rewrite the triangle passage (line 22 — the literal `×1.5`/`×0.75` strings are guard-asserted) to include the one-way archer-vs-casters rule; amend the Mage blast bullet (line 35) and table row with the attenuation
  - [ ] `apps/web/test/rules-doc.test.ts`: the guard iterates `rpsBeats` pairs (~lines 50–58) — update for the new data shape, add assertions pinning the archer-vs-casters wording and the blast-attenuation number to BALANCE
  - [ ] Draft cards decision (pinned): the cards' "beats X / weak vs X" line is derived from `BALANCE.rpsBeats` (`draftModel.ts:49,54`, rendered `DraftScene.ts:89`) and the drift guard's card↔rules check covers only role/behavior columns (`rules-doc.test.ts:41-48`) — with the additive `rpsHunts` shape the cards keep showing the triangle only, which stays true (incomplete, not false). **Intentional: no card/UI changes this story** (AC 1); the full one-way rule lives in rules.md/Help. Note it in the Dev Agent Record; surfacing hunts on the cards is Epic 4 UI fodder
- [ ] Task 7: Gate, deploy, sign-off (AC: 6)
  - [ ] Full gate green (typecheck, lint, tests incl. both-mode band, ≥90% engine coverage); push → CI deploy to prod
  - [ ] Danilo plays on his device — felt-balance acceptance recorded here before the story is done

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

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
