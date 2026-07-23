---
baseline_commit: 54c01996a4680dd06e05de4c7a1b1e8ede98d8fc
---

# Story 5.0: Housekeeping and gate reliability

Status: ready-for-dev

<!-- Epic 5 opener (epics.md §Epic 5). Three independent debt threads, no feature work. Runs FIRST in the epic: AC1's capture is the fresh perf baseline stories 5.2/5.3/5.10 measure against, and it MUST NOT survive a fourth deferral (epic-4 retro action item 2). -->

## Story

As the game's developer,
I want the rolled-forward evidence and tooling debts paid before new work begins,
So that the epic builds on a trustworthy gate and honest documents.

## Acceptance Criteria

1. **The `?perf=1` capture runs and fills the stub.** The device session against the deployed production build follows `docs/performance-verdict.md`'s exact post-review procedure (three-mages-wipeout Replay at 1× and ×2, per-scenario `window.__perfSamples` copy + reset, single-read traces, `summarizePerfSamples` stats), covers the accumulated churn (4.10 traces, 4.11 move plate, post-monster asset load, 4.13 Reveal picker), fills the STUBBED table in the 4.10 addendum (`docs/performance-verdict.md:201-204`), and is recorded as the epic's fresh baseline. Pass bar: zero frames under the 30fps floor (NFR1), compared against the 2026-07-16 baseline table.
2. **`pnpm coverage` passes repeatedly without retry.** The instrumentation-timeout flake (recorded across 4.8/4.10/4.11; deferred-work.md 2026-07-20 entry) is fixed — known-heavy tests get explicit timeouts with rationale comments (the established `sim.test.ts`/`combat.test.ts` pattern) and/or coverage-run contention is reduced — then 5 consecutive full `pnpm coverage` runs pass clean, and the chosen approach is recorded in this story.
3. **The stale planning text is corrected with dated amendments.** PRD FR38 describes the shipped single-cell king-move monster (two-cell text amended, not silently rewritten); the shipped Wipeout-as-Home-default is recorded against FR17/FR19; the AD-14 spine entry and dossier §2 gain dated amendments to the single-cell model; AD-2's mid-battle-tactics deferral note is verified present (it may already exist) and extended with 4.13's recorded relaxation if missing; epics.md's story-4.8 section gains a dated shipped-reality note; and a short PRD index paragraph covers Epic 5's new player-facing surfaces (unit-data card, battle-stats summary).
4. **The engine is untouched.** No version bump; balance hash and goldens byte-identical; the full gate (`pnpm test`, `pnpm typecheck`, `pnpm lint`) stays green.

## Tasks / Subtasks

- [ ] Task 1: The owed `?perf=1` on-device capture (AC: 1)
  - [ ] Verify production is current (main deployed through 4.13; check the prod URL loads the Reveal tactic picker)
  - [ ] Prep Danilo's session: prod URL + `?perf=1`, Chrome remote debugging, confirm the sampler's armed `console.info` appears
  - [ ] Scenarios in procedure order, resetting `window.__perfSamples = []` between them: Battle 1× (the seeded three-mages-wipeout Replay), Battle ×2 (same replay)
  - [ ] Compute min / median / 1%-low / floor-breach counts with the `summarizePerfSamples` definitions; fill the stubbed table at `docs/performance-verdict.md:201-204` and write a short story-5.0 note naming this the epic-5 baseline
  - [ ] Compare against the 2026-07-16 post-review baseline (Battle 1× min 40.0 / median 59.88 / zero floor breaches); if the floor breaks, STOP and surface — that is a real finding, not a doc chore
- [ ] Task 2: Kill the coverage flake (AC: 2, 4)
  - [ ] Reproduce first: run `pnpm coverage` a few times and note which test times out (history says `monster.test.ts:134`'s `matchSetupArb` property — default 5s timeout, no explicit override — and occasionally the `sim.test.ts` single-mode band test at :209)
  - [ ] Extend the explicit-timeout house pattern to the known-heavy tests that lack one (rationale comment required, mirroring `sim.test.ts:248-250` / `combat.test.ts:421-424` — "a load flake, not a slow assertion"); do NOT blanket-raise a global `testTimeout`
  - [ ] If timeouts alone don't hold, reduce coverage-run thread contention (root `vitest.config.ts` — it currently sets NO pool options; a coverage-scoped `--max-workers` on the root `coverage` script is the least invasive lever) and/or trim the heaviest arbitrary further (4.8's `VALID_MONSTER_PLACEMENTS` memoization is the precedent)
  - [ ] Prove it: 5 consecutive clean `pnpm coverage` runs; record run count + approach in Completion Notes; update the deferred-work.md entry to RESOLVED with a pointer here
- [ ] Task 3: The stale-text bundle — dated amendments, never silent rewrites (AC: 3)
  - [ ] PRD `prds/prd-lordly-2026-07-11/prd.md` FR38 (:126): amend to the shipped model — a monster occupies ONE cell, costs 2 slots, reserves all 8 king-move neighbors at placement (no unit may stand adjacent); the two-cell semantics paragraph is superseded (story 4.8 device revision, 2026-07-20); wave 1 shipped Golem-only (dossier D-1b); roster growth is now Epic 5's 5.1/5.4/5.5
  - [ ] Same file, light dated touches: the Epic-4 intro (:16), the dragon vignette (:37), the "12 classes ... dragon and golem" note (:93), Open Item 3 (:177 — mark superseded by the shipped single-cell model). LEAVE FR35's Tamer/Master synergies and the addendum's future-wave text alone (future-wave content, not stale claims about shipped code)
  - [ ] FR17/FR19: add a dated note that Wipeout is the shipped product-facing default on Home (Danilo, story-4.5 device session; EXPERIENCE.md already amended) — the engine-level `'single'` fallback in MatchFlow is deliberate and unchanged
  - [ ] Add a short PRD index paragraph (Feature-6b style) for Epic 5's new player-facing surfaces: the unit-data card and the Result battle-stats summary
  - [ ] `ARCHITECTURE-SPINE.md` AD-14 (:133): dated amendment — `footprintCells` is now identity (single cell); the deployment rule is the 8-neighbor king-move reservation in validate.ts; anchor/derived-second-cell language superseded. Match the file's existing amendment styles (inline italic dated notes, `[ADOPTED ...]` tags)
  - [ ] `ARCHITECTURE-SPINE.md` AD-2 area: the mid-battle-tactics deferral bullet already exists (~:239-242) — VERIFY it, and add 4.13's recorded relaxation (post-commit `setTactic` folds into `committedSetup.tactics.A` + cache invalidation; pre-battle only, AD-2-compatible) if not yet noted
  - [ ] `epic-4-dossier/DOSSIER.md` §2 (:80-85): amendment block in the established style ("#### Amendment (story 4.8 device revision, 2026-07-20, Danilo) — ...") — single-cell + king-move; TARGETED/ACTS two-cell semantics dead; update the D-1b PRD-follow-ups pointer (:168-173) to note this story applied the corrections
  - [ ] `epics.md` story-4.8 section (:839-857): one dated note at the section top recording shipped reality (single-cell Golem-only; the AC text below is the pre-revision plan); do NOT rewrite the ACs themselves
  - [ ] Update deferred-work.md's "PRD follow-up (from story 4.8's dossier, D-1b...)" section to RESOLVED with a pointer here
- [ ] Task 4: Gate (AC: 4)
  - [ ] `pnpm test` + `pnpm typecheck` + `pnpm lint` green; confirm zero engine-source diffs in the File List (Task 2 touches only test files/config); balance hash untouched (no balance.ts diff — nothing to re-pin)

## Dev Notes

### Why this story exists (epic-4 retro, 2026-07-22)

Three debts rolled forward with teeth: the `?perf=1` capture was deferred **three consecutive times** (4.10 → 4.12) and is a named retro action item ("must not survive a fourth deferral"); the coverage flake was called "quiet erosion — a gate that only passes on retry" at 4.11's review; and Epic 4's device-driven design revisions left the PRD/dossier/spine describing a monster model that no longer exists. No feature work here — that is the whole point.

### Thread 1 — the capture (Danilo does the driving; you prep and record)

- The sampler (`apps/web/src/config/perf.ts`, story 3.4, corrected by its review): `?perf=1` query-gated, per-frame `1000 / game.loop.rawDelta` on scene UPDATE, detaches on shutdown, caps at 36,000 samples, exposes `window.__perfSamples`. Wired into Battle, Draft, Placement.
- Procedure is `docs/performance-verdict.md:48-66` verbatim: prod URL, console armed-readout confirmed, per-scenario `copy(JSON.stringify(...))` then reset. The stub to fill is ONLY the two battle rows (:201-204) — Placement re-capture is not owed.
- The benchmark stays the **three-mages wipeout Replay** — the 4.10 addendum (:180-187) already decided monster comps are lighter (3 units, single-target melee). Don't re-litigate.
- The comparison base is the 2026-07-16 **post-review** table (:52-66), NOT the superseded first capture (:81-90) — the 3.4 review invalidated that one (wrong metric). "Verify the meter" is a standing team agreement.
- This capture also closes the two never-device-seen 4.10 review decisions (arrival-timed impact effects, guardian-side ring) and the 4.11 misfire `↳` plate — the epic-4 retro recorded Danilo's 4.13 mobile pass as covering them, but this session is the formal evidence pass; if anything looks wrong on device, log it, don't fix-in-story.

### Thread 2 — the flake (test infra only, zero engine source)

- **Current config state (verified 2026-07-23):** exactly ONE vitest config — root `vitest.config.ts` with `projects: ['packages/*', 'apps/*']`, v8 coverage, engine 90%-lines threshold. NO testTimeout, NO pool options anywhere. Scripts: root `"coverage": "vitest run --coverage"`.
- **Only two explicit timeouts exist:** `sim.test.ts:270` (60s, wipeout band sweep) and `combat.test.ts:444` (15s, side-swap property). Both carry the house rationale comment — copy that style.
- **Prime suspect:** `monster.test.ts:134` — `test.prop([matchSetupArb])` duplicate-target property, default 5s, no override. `matchSetupArb` resolves full battles per case; under v8 instrumentation + parallel project load it brushes 5s. (Story 4.8 already memoized `VALID_MONSTER_PLACEMENTS` for exactly this; the arbitrary itself is fine.)
- **Order of levers (deferred-work.md's own list):** (1) explicit per-test timeouts on the known-heavy suites; (2) coverage-scoped worker reduction — prefer a flag on the root `coverage` script over config so `pnpm test` parallelism is untouched; (3) further arbitrary trimming. Stop at the first lever that makes 5-in-a-row pass.
- **Trap:** do not raise the global default timeout — it would mask genuinely-hung tests suite-wide. Per-test with rationale, per house style.
- **Memory that applies:** verify under `pnpm coverage`, not just `pnpm test` — instrumentation is the variable that makes this flake exist at all.

### Thread 3 — the stale text (docs only; the shipped model is the authority)

- **The shipped monster model** (story 4.8 device revision, device-approved, senior-reviewed): a monster is a SINGLE-cell unit, 2 slots, reserving all 8 king-move neighbors (orthogonal + diagonal) — no unit, human or monster, may stand in any of the 8 cells around it. No second body cell, no special battle targeting. `docs/rules.md`, the engine, and its tests already say this; only planning docs lag.
- **Verbatim stale text located (2026-07-23 recon):** PRD FR38 :126 (full two-cell paragraph + "dragon and golem"), prd.md :16/:37/:93/:177; DOSSIER §2 :80-85 (TARGETED/ACTS two-cell semantics, "blocks both rows", "counts in each row"); SPINE AD-14 :133-137 (anchor + derived `footprintCells`); epics.md :839-857 (story 4.8 ACs) plus scattered mentions (:41, :64, :113, :161, :181, :637, :683, :862-877) — for the scatter, one dated note per SECTION beats line-by-line surgery.
- **Guard is already clean** — dossier §4 carries the 4.7 amendment block and D-2a's SUPERSEDED note. Confirm, don't touch.
- **AD-2's deferral note likely exists already** (spine :239-242 has a dated "Mid-battle tactic switching ... incompatible with AD-2's resolve-once model" bullet). The only possibly-missing piece is 4.13's relaxation record. Verify before writing.
- **House amendment styles to match** (never invent a new one): PRD/spine inline italic `*amended YYYY-MM-DD ...*`; spine `[ADOPTED YYYY-MM-DD]` tags; dossier `#### Amendment (story N.N, YYYY-MM-DD, Danilo) — ...` blocks and bold inline `SUPERSEDED ...` notes.
- **Scope fence:** FR35's Tamer/Master leader-monster synergies and addendum future-wave text stay — they describe future waves, not shipped reality. The Epic 5 dossier (story 5.1) may revisit them; not this story's job.

### Project Structure Notes

- Files touched: `docs/performance-verdict.md`, `docs/implementation-artifacts/deferred-work.md`, `docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md`, `docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md`, `docs/planning-artifacts/epic-4-dossier/DOSSIER.md`, `docs/planning-artifacts/epics.md`, root `vitest.config.ts` and/or root `package.json` (coverage script), plus explicit timeouts in `packages/engine/test/monster.test.ts` (and any other reproduced offender).
- NOT touched: anything under `packages/engine/src/`, `apps/web/src/` (unless the capture surfaces a real defect — which is a STOP-and-surface, not an in-story fix).
- `docs/rules.md` needs nothing — 4.8 already rewrote its Monsters section; `rules-doc.test.ts` drift guards stay green untouched.

### Previous Story Intelligence (4.12/4.13 tail)

- 4.12's sim-CLI gotcha: `pnpm --filter @lordly/engine sim -- --flags` double-passes `--`; use `pnpm exec tsx sim/run.ts` directly. (Only relevant if you re-run a sweep — this story shouldn't need one.)
- 4.13's review pattern: validate-before-mutate, singleton resets above early-returns — not exercised here (no scene code), but its 572-test gate is the green bar this story must keep.
- The last three commits are docs/planning only (retro `f7e134b`, Epic 5 breakdown `e43c824`, sprint planning `54c0199`) — working tree is clean docs-wise; your diffs will be the only ones.

### References

- [Source: docs/planning-artifacts/epics.md#Story 5.0] — ACs and epic fence
- [Source: docs/implementation-artifacts/epic-4-retro-2026-07-22.md#Action items] — item 2, the no-fourth-deferral deadline
- [Source: docs/performance-verdict.md:48-66, :176-206] — procedure, baseline, and the stub to fill
- [Source: docs/implementation-artifacts/deferred-work.md:159, :167] — the two debt entries this story closes (line refs pre-edit)
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md:104, :106, :126] — FR17/FR19/FR38 current text
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md:37-41, :133-137, :236-242] — AD-2, AD-14, deferral trailer
- [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md:80-85, :96-111, :168-173] — §2, §4 (already amended), PRD-follow-ups
- [Source: vitest.config.ts; packages/engine/test/sim.test.ts:248-270; packages/engine/test/combat.test.ts:421-444; packages/engine/test/monster.test.ts:130-150] — the flake surface

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
