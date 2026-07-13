---
baseline_commit: de845d9aba7df4f2d292cffb9897ec3c315af905
---

# Story 1.7: The AI opponent and the balancing harness

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want an AI that commits its own hidden army and formation,
so that I always have an opponent who can punish a lazy formation.

## Acceptance Criteria

1. **Given** the engine's AI module, **when** it picks, **then** `chooseSetup(strategyPool, aiStream)` is a pure function in `packages/engine` returning composition + placement, with no parameter through which the player's draft or placement could pass (FR24, AD-6), **and** it draws only from its own named stream (`ai/A` or `ai/B` — AD-10).
2. **Given** the curated strategy pool, **when** the AI plays repeated matches, **then** it varies over 8–12 archetypes with seeded variation (not the same board twice in a row), including at least one back-row-sniper archetype and one anti-front-stack archetype (FR25), **and** selection completes in under 1 second entirely client-side (FR26).
3. **Given** the sim harness (`engine/sim`), **when** run headlessly from the CLI, **then** it sweeps AI-vs-AI matches across compositions (each side on its own stream — no mirror-match artifact), reporting win rates per composition/archetype to flag dominant strategies (NFR4), **and** across the sweep no single archetype exceeds a 65% aggregate win rate `[initial acceptance band — tuning value]`; the ~50% human-vs-AI target (FR25) is explicitly deferred to playtesting (PRD Open Item 1).

## Tasks / Subtasks

- [x] Task 1: The strategy pool — curated AI data (AC: 2)
  - [x] New `packages/engine/src/ai.ts`: `StrategyArchetype { id, name, classes: [UnitClass, UnitClass, UnitClass], placement: [Placement, Placement, Placement] }` — placement parallel to `classes` by index (same parallelism contract as `MatchSetup.armies`/`placements`); `id` a stable kebab-case string (goes in sim reports)
  - [x] `STRATEGY_POOL: readonly StrategyArchetype[]` — 8–12 curated archetypes. MUST include: ≥1 back-row-sniper (e.g. double-archer mid/back formation — FR9 arcs over front lines) and ≥1 anti-front-stack (e.g. mage-led artillery — FR10's row blast massacres everyone-in-front boards). Round out with: knight wall + cleric sustain, mercenary tempo, witch-control openings, balanced triangle spreads — curate AGAINST the sim results (Task 4 is the feedback loop), not by vibes
  - [x] Pool validity is a TEST, not a runtime check: every archetype's classes are legal, placements are 3 distinct in-grid cells, pool size in [8, 12], required roles present (assert by structural predicate — e.g. "has ≥2 units with back/mid placement and rearmost-targeting class" — not by hardcoded id list, so curation stays free)
- [x] Task 2: `chooseSetup` — the pure seeded pick (AC: 1, 2)
  - [x] `chooseSetup(pool, stream, options?)` in `ai.ts` → `{ archetypeId, classes, placement }`. Parameters admit NOTHING player-derived: pool + stream (+ options.exclude) only — FR24 holds by construction (AD-6). Do NOT return a `MatchSetup` fragment with elements: elements are NOT the AI's to roll (see spec decision 1)
  - [x] `options.exclude?: string` — an archetype id excluded from the pick (SPEC DECISION 2: "not the same board twice in a row" is the CALLER threading the previous match's `archetypeId` back in; a pure function cannot remember). With exclude matching a pool id, pick uniformly over the remaining pool; without (first match), over the whole pool
  - [x] AI-STREAM ORDERING INVARIANT (document prominently like resolve.ts's battle-stream comment): per `chooseSetup` call, draws are ① one archetype pick `nextInt(stream, 0, eligible-1)`, ② one placement-mirror flip `nextInt(stream, 0, 1)` — nothing else draws from `ai/*`. Story 1.8's shell and the sim MUST produce identical boards from identical stream states
  - [x] Mirror flip (SPEC DECISION 3): on 1, each placement's col is mirrored left↔right (owner-local; rows untouched) — doubles board variety per archetype while preserving its row intent; on 0, placements verbatim. Center col is its own mirror
  - [x] Unit tests: determinism (same seed+label → identical choice, twice); exclude honored (never picks the excluded id — property over seeds); exclude of an id NOT in the pool = whole pool eligible; mirror flip pins (a known seed hand-verified to mirrored cols — determinism-anchor style, verify WHICH board, not just "it ran"); purity (input pool not mutated, frozen-pool safe); a property: `chooseSetup` output + 3 `rollElement` draws per side always assembles into a `MatchSetup` that passes `validateMatchSetup`
- [x] Task 3: Engine exports + purity (AC: 1)
  - [x] `index.ts`: export `chooseSetup`, `STRATEGY_POOL`, types `StrategyArchetype`, `AiChoice` (or the equivalent names chosen); doc comments on every export (NFR3)
  - [x] `purity.test.ts`: add `ai.ts` to the exact src file list — the guard fails otherwise BY DESIGN
  - [x] `ai.ts` imports only engine-internal modules + nothing effectful (AD-1); coverage: `src/ai.ts` falls under the enforced ≥90% engine line gate automatically
- [x] Task 4: The sim harness — `packages/engine/sim/` (AC: 3)
  - [x] `sim/sweep.ts` — the PURE sweep core (importable by tests): `runSweep(pool, config) → SweepReport`. Per matchup: derive a deterministic match seed from (base seed, pair index, run index), kept inside uint32 (`>>> 0` / modular math — `createStreams` REJECTS anything else) — NO `Date.now()`/`Math.random()` anywhere; a sweep is replayable from its config
  - [x] Sweep shape: round-robin every archetype pairing (including self-pairings — a mirror pairing is legitimate BECAUSE the sides' streams differ) × N seeded runs each. Force the pairing by passing a SINGLETON pool per side: side A = `chooseSetup([archA], streams['ai/A'])`, side B = `chooseSetup([archB], streams['ai/B'])` — round-robin coverage AND the real pick+mirror code path on the real per-side streams (no mirror-match artifact, the AC's explicit trap; `exclude` is not needed in the sweep — it's the 1.8 shell's affordance). Then assemble each `MatchSetup` exactly as MatchFlow will (SPEC DECISION 4): elements = 3 × `rollElement` per side on `elements/A`/`elements/B` in army order (AD-9), `mode: 'single'`, engine's `BALANCE.version`; tally from `BattleEnded.winner` only (the log is the contract — AD-2/AD-12)
  - [x] `SweepReport`: per-archetype games/wins/draws/aggregate win rate, per-composition rollup (archetypes sharing a class multiset merge — compositions are the balance question, NFR4), flagged list (rate > threshold). Win rate = `(wins + draws/2) / games` (SPEC DECISION 5)
  - [x] `sim/run.ts` — thin CLI entry: parse `--runs`, `--seed`, `--threshold` (defaults: enough runs for stable rates, base seed 1, 0.65), call `runSweep`, print a readable table + flagged archetypes, exit non-zero when any archetype exceeds the threshold (CI-composable). Console/process usage lives ONLY here — `sim/` is outside the purity guard's src list but keep `sweep.ts` pure anyway (it's the testable core)
  - [x] Wire the CLI: engine `package.json` gets `"sim": "tsx sim/run.ts"` + `tsx` devDependency (^4 latest). TRAP: engine `tsconfig.json` has `"include": ["src", "test"]` — add `"sim"` or the harness silently escapes `tsc --noEmit` (verified at baseline). Node 24's native type-stripping CANNOT run it: the engine's relative imports are extensionless, and type stripping requires explicit extensions (verified 2026-07-13, nodejs.org/api/typescript.html) — do not burn time trying `node sim/run.ts`
  - [x] README: a short "Balancing harness" section — `pnpm --filter @lordly/engine sim`, what the report means, the 65% band (NFR3's documented-steps convention)
- [x] Task 5: The acceptance band in CI (AC: 3)
  - [x] `test/sim.test.ts`: a REDUCED deterministic sweep (fixed base seed, runs sized to keep the whole suite comfortably under ~10 s added) asserting no archetype's aggregate win rate exceeds 0.65 — the band is a named constant with the `[initial acceptance band — tuning value]` comment
  - [x] Determinism anchor: pin one sweep cell (archetype pair, seed → winner) hand-verified from the log, so a silent stream/ordering change trips loudly (rng-lessons convention)
  - [x] If the band FAILS: tune the POOL first (drop/adjust the dominant archetype — pool curation is AI data, freely editable this story). Touch `BALANCE` only as a last resort: that requires a version bump + hash update + golden re-records + re-pinned anchors across 5 suites — a documented, deliberate cascade, not a quick fix
  - [x] Meta tests from Task 1 (pool size/validity/required roles) live here or in `test/ai.test.ts` — dev's structural call
- [x] Task 6: Property + regression sweep (AC: 1, 2, 3)
  - [x] Property: over arbitrary uint32 seeds, `chooseSetup` on `ai/A` vs `ai/B` from the SAME match seed picks independently (not always-equal — the no-mirror-artifact guarantee, testable because the streams are avalanche-derived)
  - [x] Property: assembled AI-vs-AI `MatchSetup`s always resolve (termination holds — reuse `matchSetupArb` patterns; the existing engine properties already cover resolution, this covers the ASSEMBLY path)
  - [x] FR26's <1 s: the sim test IS the evidence (hundreds of `chooseSetup` calls in seconds); no dedicated perf test — note it in the test file comment
  - [x] Existing suites untouched and green: this story adds NO battle-stream draws, NO event types, NO balance changes → goldens and anchors must NOT move. A golden diff = you broke stream derivation or resolution — stop and investigate

## Dev Notes

### The two hard constraints (read first)

1. **FR24 by construction, not discipline (AD-6):** `chooseSetup`'s signature is the security boundary. No parameter, option, or closure may carry the player's draft/placement. The AI cannot cheat because there is no channel — keep it that way.
2. **Stream discipline (AD-10):** `ai/A`, `ai/B` already exist in `rng.ts`'s closed `STREAM_LABELS` — consume them, do NOT add streams. `chooseSetup` never touches `battle` or `elements/*`. The engine's existing goldens pin the battle stream; if any golden changes in this story, something leaked.

### Spec decisions this story RECORDS (each also goes in a code comment)

1. **Elements are not the AI's choice**: `chooseSetup` returns classes + placement only; the CALLER (MatchFlow in 1.8, the sim here) rolls elements on `elements/<side>` per AD-9 — one flow for human and AI sides. Consequence, stated honestly: the AI cannot adapt its placement to its Witch's element (a human can — FR3 shows the owner elements before placement). Accepted MVP asymmetry; revisit only if playtesting shows witch archetypes underperforming. FR24's "commits …spells" is satisfied: the spell keys off the element (FR16), which is seeded data the player never influences.
2. **No-repeat is caller-threaded**: `options.exclude` carries the previous match's `archetypeId`. Purity survives; 1.8's `MatchState` and the sim's pairing loop both thread it naturally. First match of a session: no exclude.
3. **Seeded mirror flip** is the second `ai/*` draw: col-mirrored placements (left↔right owner-local) double the board variety per archetype. Draw order ①pick ②flip is an INVARIANT — document like resolve.ts's battle-stream comment.
4. **The sim assembles MatchSetups exactly as MatchFlow will** — same stream, same order, same roll count. When 1.8 builds the real flow, the sim is its reference implementation.
5. **Win rate = (wins + draws/2) / games** — draws are half-credit, so a draw-heavy archetype can't hide at "49% wins, 40% draws".

### Existing code you build on (current state, verified at baseline)

- `rng.ts` — `createStreams(seed)` returns all 5 streams keyed by label; `nextInt(stream, from, to)` inclusive bounds, the ONLY randomness API; `rollElement(stream)` uniform over `ALL_ELEMENTS`. Streams are avalanche-derived (murmur3 fmix32) — cross-label independence is tested, lean on it.
- `validate.ts` — `validateMatchSetup` throws typed `InvalidMatchSetupError`; the property test "AI output always validates" closes the loop against ALL its checks (army size from `BALANCE.armySize`, distinct cells, class/element membership).
- `types.ts` — `UnitClass`, `Placement { row, col }`, `MatchSetup` (armies `{class, element}[]`, placements parallel by index), `ALL_ROWS`/`ALL_COLS` for mirror math (`col` mirror: index `i` → `2 − i` over `ALL_COLS` — same arithmetic as targeting's facing-column math, but owner-local, do NOT import targeting for it).
- `resolve.ts` — consume via `resolveBattle(setup).events` → find `BattleEnded { winner }`. Never re-derive outcomes from intermediate events (AD-2).
- `balance.ts` — `BALANCE.armySize` (3) and `BALANCE.version` are data; the pool hardcodes NEITHER (build archetypes as 3-tuples but read sizes from data where a check exists).
- Root `vitest.config.ts` — coverage includes `packages/*/src/**` only: `sim/` is OUTSIDE the coverage metric (deliberate — CLI glue), but `src/ai.ts` is inside the enforced ≥90% gate.
- Engine `package.json` — `"main": "src/index.ts"`, plain-TS package, scripts: only `typecheck` today; `sim` script lands beside it.

### Previous story intelligence (1.6 + its review — critical)

- **The confusionMisfire lesson (1.6 review finding):** a balance/data field that code doesn't actually read is a silent trap. Applied here: if you declare pool data, thresholds, or run counts as "tunable data", the code MUST read them from that data — no shadow constants.
- **Determinism anchors, hand-verified**: every seeded behavior pins at least one anchor where the EXPECTED value was derived by hand/trace, not by running the test and pasting (1.4's coin-flip lesson, re-proven in 1.6). For `chooseSetup`: pin which archetype AND which mirror state for a known seed.
- **Probed-seed technique** (1.6): when a scenario needs a specific random branch, scan seeds for one exhibiting it, then pin it with a comment saying it was probed. Useful for exclude/mirror branch coverage.
- **Purity guard has an exact file list** — `ai.ts` must be added to `purity.test.ts` or it fails by design (1.6 confirmed the mechanism).
- **Toolchain:** PATH prefix `$HOME/.nvm/versions/node/v24.16.0/bin`; pnpm from repo root; goldens re-record ONLY via deliberate `vitest -u` with the diff reviewed — and this story expects ZERO golden movement.
- **Deferred-work note that lands here** (1.5 review): engine hot-path allocation churn (per-swing projections, `judgedView` per turn) "matters for NFR4's sim throughput". Measure before optimizing: thousands of 6-unit battles are likely fine (1.6's 141-test suite runs in ~8 s). If the sweep is slow, REDUCE CI run counts first; engine optimization belongs to the pre-epic-2 tech-debt story, not this one.

### Latest tech notes (verified 2026-07-13)

- **Node 24 native TS won't run the sim**: type stripping requires explicit `.ts` extensions in relative imports; the engine is extensionless throughout. Use `tsx` (devDependency `^4`, engine package only) — `"sim": "tsx sim/run.ts"`. Do not rewrite engine imports to gain `node`-native execution; that's churn across every src file for zero story value. [Source: nodejs.org/api/typescript.html]
- Stack pins unchanged: Vitest 4.1.x, fast-check 4.x via `@fast-check/vitest`, pure-rand 8.4.2 — no bumps needed or wanted this story.

### Scope fences (things this story must NOT do)

- NO shell/web changes — MatchFlow integration is story 1.8 (`chooseSetup` + decision 2's exclude-threading are its ready-made seam). NO scene, no UI, no `apps/web` edits.
- NO new streams, NO battle-stream draws, NO event-union changes (`LOG_VERSION` stays 3), NO validate.ts changes.
- NO `BALANCE` edits unless the 65% band genuinely cannot be met by pool curation — and then only with the full documented cascade (version bump, hash, goldens, anchors).
- NO difficulty tiers, NO human-vs-AI ~50% tuning (PRD Open Item 1 — playtesting), NO wipeout mode (`'wipeout'` stays rejected).
- The sim is a dev CLI inside `packages/engine` (spine's recorded location decision) — no new workspace package, no UI, no CI-workflow edit (the band test rides the existing vitest run).

### Project Structure Notes

- NEW `packages/engine/src/ai.ts` (pool + chooseSetup — the only new src file; purity list grows by exactly one).
- NEW `packages/engine/sim/{run.ts,sweep.ts}` — sim was reserved in the spine's structural seed; `sweep.ts` pure core, `run.ts` the only file allowed console/process.
- NEW `test/ai.test.ts`, `test/sim.test.ts` beside the existing suites; `index.ts` export block grows; engine `package.json` gains the `sim` script + `tsx`.

### References

- [Source: docs/planning-artifacts/epics.md#Story-1.7] — ACs (verbatim source of truth)
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#FR24, #FR25, #FR26, #NFR4, #Open-Items(1)]
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-6 (pure seeded AI), #AD-9 (elements are data), #AD-10 (named streams), #AD-2/AD-12 (log is the contract), #Deferred (sim stays a dev CLI)]
- [Source: docs/implementation-artifacts/1-6-full-class-roster-archer-mage-cleric-and-witch.md#Review-Findings] — data-must-be-read lesson; #Dev-Notes — anchors, probed seeds, toolchain
- [Source: docs/implementation-artifacts/deferred-work.md#story-1.5] — sim-throughput allocation note (measure, don't pre-optimize)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- TDD reds proven per task: ai.test (module missing), purity guard (file-list mismatch flagged ai.ts by design), sim.test (sweep module missing).
- Anchors probed then HAND-derived (rng-lessons convention): seed 1 ai/A → pick 6/flip 0; seed 2 ai/A → pick 1/flip 1 — mapped onto the pool literal by hand (seed-2 mirror hand-computed left↔right). Sim anchor bulwark-vs-three-mages fully derived on paper (blast 34 = 23×3/2, knights die on blast 5 early in pass 2 after exactly 3 swings of 19 → B wipe, hpPct 0/76) and passed first run.
- THE HARNESS EARNED ITS KEEP IMMEDIATELY: the first curated-by-reasoning pool failed the band spectacularly (triangle 92%, artillery 81%, skirmishers 10%). Probing revealed matchups between fixed boards are NEAR-DETERMINISTIC across seeds (identical tallies vs different opponents decompose into 100%-cross-wins + self-pair padding) — the band is a property of the matchup MATRIX, not of variance.
- Response: computed a full 20-candidate pairwise matrix (scratch tooling over runSweep) and searched all C(20,10) subsets honoring the sniper/anti-front-stack constraints, maximizing the weakest member under a 62% cap. First optimizer pass "won" by keeping punching bags (twin-coven 22%) — re-ran with maximize-min objective for a competitive pool.
- The dominant knight/archer/mage full-RPS spread family (`triangle`, 92%; `lancers` its only hard counter, itself 100% vs artillery) was deliberately LEFT OUT of the pool — no band-compliant pool containing it exists in the candidate space. Recorded in the pool doc comment as discoverable player tech.
- CLI verified end-to-end at 4× the CI sample (2000 battles): max ambushers 63.2%, min wardens 35.0% — band holds with margin. CI band config: 500 battles, max ≈60%.
- Typecheck trap found beyond the story's tsconfig one: `sim/run.ts` needs `process` typings; solved with a minimal `sim/env.d.ts` ambient declaration instead of `@types/node` (full node globals would let effectful code typecheck inside src/, weakening AD-1's type-level isolation).

### Completion Notes List

- All 6 tasks complete: 161 tests green (20 added), engine src 99.69% lines under the enforced ≥90% gate; typecheck + web build green.
- ZERO golden movement (as the story demanded): no battle-stream draws added, no event types, no balance edits — BALANCE stays version 1.
- chooseSetup: pure, two-draw invariant documented, exclude threading + singleton-pool forcing both tested; FR24 satisfied by signature construction (AD-6).
- STRATEGY_POOL: 10 archetypes, empirically balanced 35–63% pool-relative aggregate; required roles present (longbows/talons snipers, three-mages anti-front-stack).
- Sim harness: pure `runSweep` core + thin tsx CLI (`pnpm --filter @lordly/engine sim`), deterministic seed schedule, draws-half-credit rates, per-composition rollup, non-zero exit on flagged; 65% band enforced in CI via test/sim.test.ts.
- All 5 recorded spec decisions implemented as specified and documented in code comments.

### File List

- packages/engine/src/ai.ts (new — StrategyArchetype/AiChoice/ChooseSetupOptions, STRATEGY_POOL, chooseSetup)
- packages/engine/src/index.ts (modified — ai exports)
- packages/engine/sim/sweep.ts (new — pure sweep core: runSweep, SweepConfig/SweepReport/ArchetypeStats/CompositionStats)
- packages/engine/sim/run.ts (new — CLI entry; only effectful sim file)
- packages/engine/sim/env.d.ts (new — minimal `process` ambient typing, deliberately not @types/node)
- packages/engine/test/ai.test.ts (new — pool meta, chooseSetup determinism/exclude/mirror anchors, assembly+resolution property, A/B independence)
- packages/engine/test/sim.test.ts (new — sweep determinism, accounting, rollup, hand-derived anchor, 65% acceptance band)
- packages/engine/test/purity.test.ts (modified — ai.ts in the exact src list)
- packages/engine/package.json (modified — sim script, tsx devDependency)
- packages/engine/tsconfig.json (modified — include sim/)
- README.md (modified — Balancing harness section)
- docs/implementation-artifacts/1-7-the-ai-opponent-and-the-balancing-harness.md (story tracking)
- docs/implementation-artifacts/sprint-status.yaml (status tracking)

## Change Log

- 2026-07-13: Story created (ready-for-dev). Ultimate context engine analysis completed — comprehensive developer guide created: AI purity boundary (AD-6) and stream discipline (AD-10) as hard constraints, 5 recorded spec decisions (caller-rolled elements, caller-threaded no-repeat, seeded mirror flip, sim-as-MatchFlow-reference, draw-half-credit win rate), tsx-not-node CLI decision verified against Node 24 type-stripping limits, and the 1.6 review's data-must-be-read lesson carried forward.
- 2026-07-13: Story 1.7 implemented, status → review. The AI opponent lives: pure `chooseSetup` (FR24 by signature construction, two-draw ai-stream invariant, exclude-threaded no-repeat, seeded mirror flip) over a 10-archetype STRATEGY_POOL curated EMPIRICALLY — the first reasoned pool failed its own acceptance band (triangle 92%!), so the pool was selected from a 20-candidate pairwise matchup matrix (matchups are near-deterministic; balance lives in the matrix). NFR4 sim harness: pure runSweep + tsx CLI with per-archetype/per-composition draws-half-credit win rates, deterministic seed schedule, 65% band enforced both in CI (500-battle sweep, max ≈60%) and at 4× sample via CLI (max 63.2%). 20 new tests incl. three hand-derived determinism anchors; 161 green, engine 99.69% lines, zero golden movement, BALANCE untouched.
