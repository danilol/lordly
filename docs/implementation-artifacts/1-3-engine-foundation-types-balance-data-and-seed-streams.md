---
baseline_commit: b698b16910586282dd2def8eed675afddb102526
---

# Story 1.3: Engine foundation — types, balance data, and seed streams

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the game's developer,
I want the engine package to own the domain vocabulary, balance numbers, and deterministic randomness,
so that every later rule is built on one shared, tested foundation.

## Acceptance Criteria

1. **Given** `packages/engine`, **when** the foundation lands, **then** `types.ts` defines the canonical `MatchSetup` exactly as AD-9 fixes it (seed, balanceVersion, mode, armies of `{class, element}`, owner-local placements), sides `'A' | 'B'`, unit ids `side:index`, and the PRD Glossary vocabulary (AD-4, AD-11), **and** `balance.ts` holds the FR15 class table (HP, STR, VIT, INT, MEN, AGI, DEX, per-row action counts) and formula constants as data with a `balanceVersion` integer.
2. **Given** the balance data, **when** CI runs, **then** a test asserts the balance content hash matches the declared `balanceVersion`, so a forgotten bump fails the build (AD-8).
3. **Given** a 32-bit match seed, **when** randomness is requested, **then** `rng.ts` exposes exactly the closed stream set `elements/A`, `elements/B`, `ai/A`, `ai/B`, `battle` over pure-rand, the raw seed is not directly consumable, and streams are independent (AD-10), **and** an engine-exported `rollElement(stream)` returns Fire/Water/Wind/Earth (FR3), **and** property tests prove: same seed → identical streams; different labels → uncorrelated sequences.
4. **Given** the engine package, **when** its public API is reviewed, **then** every export carries doc comments (NFR3) and the package imports nothing effectful (AD-1 paradigm check).

## Tasks / Subtasks

- [x] Task 1: Domain types in `packages/engine/src/types.ts` (AC: 1)
  - [x] Closed unions: `UnitClass` (`'knight' | 'mercenary' | 'archer' | 'mage' | 'cleric' | 'witch'`), `Element` (`'fire' | 'water' | 'wind' | 'earth'`), `Side` (`'A' | 'B'`), `Row` (`'front' | 'mid' | 'back'`), `Col` (`'left' | 'center' | 'right'`), `Mode` (`'single' | 'wipeout'`), `SpellKind` (`'sleep' | 'poison' | 'weaken' | 'confusion'`)
  - [x] `UnitId` = template literal `` `${Side}:${number}` `` (AD-11: assigned from `MatchSetup.armies` order; display names are shell-side)
  - [x] `Unit = { class: UnitClass; element: Element }`, `Placement = { row: Row; col: Col }` (owner-local coordinates ONLY — AD-11; lane mirroring is renderer math, never engine data)
  - [x] `MatchSetup` EXACTLY per AD-9's canonical shape: `{ seed: number; balanceVersion: number; mode: Mode; armies: { A: Unit[]; B: Unit[] }; placements: { A: Placement[]; B: Placement[] } }` (placements parallel-indexed to armies)
  - [x] Doc comments use the PRD Glossary vocabulary verbatim (match, battle, engagement, pass, action, reach, facing column, element, RPS, judging, seed) — the engine owns this vocabulary (AD-4); new domain words go to the Glossary first
  - [x] NO `BattleLog`/event types — that union is story 1.4's scope (AD-12 lands there)
- [x] Task 2: Balance data in `packages/engine/src/balance.ts` (AC: 1, 2)
  - [x] `balanceVersion = 1` (monotonic integer) — as `BALANCE.version`
  - [x] Class table verbatim from PRD FR15 (values in Dev Notes below) as plain data: per class HP/STR/VIT/INT/MEN/AGI/DEX + per-row action counts `{ front, mid, back }`
  - [x] Formula constants as data (integer math — FR15: every division/multiplier floors, in fixed order base → RPS → status): RPS advantage ×1.5 and disadvantage ×0.75 stored as integer ratios (`{ num: 3, den: 2 }`, `{ num: 3, den: 4 }`), heal = INT × 1.25 as `{ num: 5, den: 4 }`, minimum damage 1, poison damage 15, confusion misfire chance as ratio `{ num: 1, den: 2 }`, engagement cap 5 (FR19), army size **3** (AD-1: army size is DATA, never a hardcoded constant elsewhere)
  - [x] RPS triangle as data: mage > knight, knight > archer, archer > mage (FR14; mercenary/cleric/witch neutral)
  - [x] Element→spell mapping as data: water→sleep, earth→poison, fire→weaken, wind→confusion (FR16)
  - [x] Unit tests: table has exactly 6 classes; every class has all 7 attributes + 3 action counts; spot-check a few PRD values (e.g. knight HP 140, witch AGI 26); RPS map is the exact 3-edge triangle
- [x] Task 3: Balance-hash guard test (AC: 2)
  - [x] Deterministic content hash of the FULL balance data — FNV-1a 32-bit over canonical JSON (recursively sorted keys) in `src/hash.ts`; no new deps
  - [x] `packages/engine/test/balance-hash.test.ts`: `EXPECTED_HASHES` map pinning `{ 1: 'bfce425a' }`; the test asserts `contentHash(BALANCE) === EXPECTED_HASHES[BALANCE.version]` — editing balance data without bumping `version` AND updating the map fails CI (AD-8's two-step deliberate bump)
  - [x] RED-GREEN proof: temporarily change one stat, watch the test fail, revert — done (knight hp 140→141 failed the guard; reverted, green)
- [x] Task 4: Seed streams in `packages/engine/src/rng.ts` (AC: 3)
  - [x] Closed label union: `StreamLabel = 'elements/A' | 'elements/B' | 'ai/A' | 'ai/B' | 'battle'` — adding a stream is an engine API change (AD-10)
  - [x] Label-keyed derivation: per-stream seed = FNV-1a over label chars mixed with the match seed → `xoroshiro128plus(derivedSeed)`; the raw seed itself is NEVER fed to a generator directly (AD-10)
  - [x] `createStreams(seed): Streams` (one stream per label) + `nextInt(stream, from, to)` wrapping `uniformInt`; the pure-rand generator is typed `@internal` and never leaks past the module's exported types
  - [x] `rollElement(stream): Element` — uniform 0..3 into the FIXED order `['fire', 'water', 'wind', 'earth']`; frozen by a pinned-rolls determinism-anchor test (seed 0xc0ffee → water, fire, fire)
  - [x] Property tests via `@fast-check/vitest`: same seed → bit-identical sequences per stream; different labels on the same seed → all 5 sequences distinct; different seeds on the same label → sequences differ; `rollElement` codomain; `nextInt` bounds
- [x] Task 5: Purity and docs audit (AC: 4)
  - [x] Doc comment on EVERY export in types.ts, balance.ts, rng.ts, hash.ts, and the index re-exports (NFR3)
  - [x] `src/index.ts` re-exports the public API — `ENGINE_NAME` kept (guards the 1.1 wiring tests), all types + `BALANCE` + rng surface + `contentHash` exported
  - [x] Purity guard test: reads all engine `src/` files (via Vitest raw imports — no node-types dep) and asserts none contain `Math.random`, `Date.now`, `new Date(`, phaser/node: imports, `process.`, `localStorage`, `fetch(`, `window.`, `document.`; also asserts the ONLY runtime dependency is pure-rand and that the file list is complete — AD-1 enforced by CI, not discipline
  - [x] Full gate green: `pnpm -r typecheck`, `pnpm coverage`, `pnpm --filter web build` (web untouched but must not regress)

### Review Findings

_Reviewed 2026-07-12 via `bmad-code-review` (Blind Hunter + Edge Case Hunter + Acceptance Auditor, diff b698b16..HEAD scoped to packages/engine). Acceptance Auditor: full pass on all 4 ACs (48 balance values verified cell-by-cell; hash guard re-proven live). Blind Hunter found two REAL, empirically verified correctness defects in the RNG derivation — both independently re-verified by the review orchestrator before triage._

- [x] [Review][Patch] **HIGH — First-draw bias:** `deriveSeed`'s single FNV multiply + xoroshiro128plus's weak state init make the first output ≈ `~derivedSeed`; the game's first visible (A,B) element pair is a pure function of `seed % 4` — only 4 of 16 pairings can ever occur, and A's first element determines B's (violates FR3's "random element" for the first roll) [packages/engine/src/rng.ts]. Fix: avalanche finalizer (splitmix32/fmix32) in deriveSeed + warm-up draws after seeding; re-pin the determinism anchor.
- [x] [Review][Patch] **HIGH — Cross-label stream aliasing:** the derivation is affine in the seed, so stream L1 under seed X is bit-identical to L2 under seed `X ^ (H(L1) ^ H(L2))` (verified exactly), and the FNV prime is invertible so a derived seed recovers the match seed → every other stream. AD-10's "knowing one stream must not yield another" is currently false [packages/engine/src/rng.ts]. Same fix as above (non-invertible avalanche mixing).
- [x] [Review][Patch] Seed contract unvalidated: `createStreams` silently coerces via `>>> 0` — seeds `1`, `1.9`, `2^32+1` alias identical streams; property tests only sample the well-behaved range [packages/engine/src/rng.ts]. Fix: typed RangeError on non-uint32 (fits the spine's errors convention) + alias-regression test.
- [x] [Review][Patch] `pure-rand` is caret-ranged (`^8.4.2`) under a bit-identical-determinism requirement — a minor bump could silently change generator behavior. Fix: exact pin `8.4.2` [packages/engine/package.json].
- [x] [Review][Patch] Stream opacity is a comment, not a mechanism: `Stream.gen` is public; any consumer can call `.next()`/`.jump()` and desync replays. Fix: hide the generator behind a module-private WeakMap [packages/engine/src/rng.ts].
- [x] [Review][Patch] Balance-hash guard doesn't force the version bump: re-pinning the hash under the SAME version key passes. Fix: assert `BALANCE.version === max(EXPECTED_HASHES keys)` and keys contiguous from 1 [packages/engine/test/balance-hash.test.ts].
- [x] [Review][Patch] `contentHash`/`canonicalJson` silently collides on undefined/functions/NaN/Date/Map (e.g. `[undefined]` ≡ `[]`), crashes on top-level undefined and circular refs, and has zero direct tests. Fix: throw TypeError on non-plain-JSON input; add direct tests (key-order independence, nested arrays, rejection cases) [packages/engine/src/hash.ts].
- [x] [Review][Patch] Purity guard gaps: non-recursive glob (a future `src/battle/resolve.ts` escapes entirely); regexes miss `performance.`, `crypto.`, `setTimeout/Interval`, dynamic `import(`, side-effect `import 'x'`, bare `Date()`, `Intl`/`localeCompare` (a real cross-device determinism hazard) [packages/engine/test/purity.test.ts]. Fix: `../src/**/*.ts` + extended pattern list.
- [x] [Review][Patch] No runtime enumeration source of truth: `ELEMENT_ORDER` is private and there's no exported `ALL_CLASSES`/`ALL_ELEMENTS`; the engine's own tests hand-redeclare the class list (AD-4 intent). Fix: export const arrays and derive the unions from them [packages/engine/src/types.ts].
- [x] [Review][Patch] Small hardening batch: `nextInt` throws on inverted/non-integer bounds (pure-rand yields NaN on empty ranges); structural `Ratio` invariants test (`den > 0`, integers — survives tuning unlike the exact-value spot-checks); `rpsBeats` typed as tunable data rather than a frozen literal type; negative type tests (`@ts-expect-error`) proving the closed unions reject invalid members [packages/engine/src/rng.ts, test/balance.test.ts, src/balance.ts, test/types.test.ts].
- [x] [Review][Defer] Regex-based purity guard is inherently a sieve; an ESLint `no-restricted-globals`/`no-restricted-imports` or AST-based check would be categorically stronger — deferred: the lint-tooling decision is already in deferred-work.md from story 1.1's review
- **Dismissed (3):** "MatchSetup admits invalid states / no validator" — explicitly deferred to story 1.4 by this story's own Dev Notes ("full MatchSetup validation is story 1.4"); "package.json dependency additions escaped the diff" — factually wrong, pure-rand/fast-check were added in story 1.1's baseline; "types.test.ts assertions are vacuous" — they're deliberate smoke-level wiring checks, and the actionable part (negative type tests) is folded into the hardening patch above.

**Resolution (2026-07-12, all 10 patches applied):** `deriveSeed` now uses double murmur3 fmix32 avalanche with the label hash folded between rounds + 4 warm-up draws; both HIGH defects re-probed dead (first-pair variety 9–13 per residue class vs exactly 1 before; aliasing probe false). `createStreams` throws RangeError on non-uint32 seeds; `nextInt` guards bounds and foreign streams; generator opacity enforced via module-private WeakMap; pure-rand pinned exactly `8.4.2` with a 5-value cross-stream `nextInt` anchor as the version tripwire; `contentHash` is strict (throws on non-plain-JSON) with a dedicated test file; hash guard now asserts contiguous version history with `BALANCE.version` newest; purity guard glob is recursive with 14 additional forbidden patterns (incl. `Intl`/`localeCompare` locale hazards); runtime `ALL_*` enum arrays exported and unions derive from them; `rpsBeats` typed as tunable data; `Ratio` structural invariants + `@ts-expect-error` negative type tests added. Determinism anchors re-pinned (0xc0ffee → fire, water, earth). 36 tests green (12 added by the review response); balance data untouched (hash `bfce425a` still valid).

## Dev Notes

### Architecture constraints that bind THIS story (from ARCHITECTURE-SPINE.md)

- **AD-1:** engine is pure — no I/O, no clock, no `Math.random()`, no DOM, no Phaser, no Node APIs; only runtime dep `pure-rand`. All combat arithmetic integer math. Army size is data.
- **AD-4:** ALL domain types + balance data live here and are imported from here; no app redeclares a domain type. Balance is a versioned DATA file, not code.
- **AD-8 (the hash test):** a CI test asserts the balance content hash matches `balanceVersion` so a forgotten bump fails the build.
- **AD-9:** canonical `MatchSetup` shape (fixed, verbatim in Task 1). Elements are stored data rolled once by the shell via the engine's roll function — `resolveBattle` (story 1.4) will read them as plain data.
- **AD-10:** one 32-bit seed per match; closed stream set `elements/A`, `elements/B`, `ai/A`, `ai/B`, `battle`; label-keyed derivation; raw seed never consumed directly.
- **AD-11:** sides `'A' | 'B'` only; owner-local coordinates everywhere; unit id `side:index`.
- **Errors convention:** the engine throws typed errors ONLY on invalid input — nothing in this story should throw except (optionally) a malformed-label guard; full `MatchSetup` validation is story 1.4.

### Balance data (verbatim from PRD FR15 — initial tuning values; the RULES are the requirements)

| Class | HP | STR | VIT | INT | MEN | AGI | DEX | Actions front/mid/back |
|---|---|---|---|---|---|---|---|---|
| knight | 140 | 30 | 28 | 8 | 14 | 8 | 16 | 2 / 1 / 1 |
| mercenary | 110 | 26 | 20 | 10 | 14 | 14 | 18 | 2 / 1 / 1 |
| archer | 90 | 24 | 12 | 10 | 12 | 22 | 24 | 1 / 2 / 2 |
| mage | 80 | 6 | 8 | 30 | 22 | 12 | 14 | 1 / 1 / 2 |
| cleric | 90 | 8 | 12 | 24 | 24 | 10 | 12 | 1 / 1 / 2 |
| witch | 85 | 6 | 10 | 26 | 20 | 26 | 16 | 1 / 1 / 2 |

- Formulas (FR15): physical = `STR − VIT(target)/2`; magic = `INT − MEN(target)/2`; both then RPS (FR14 ×1.5 / ×0.75), minimum 1; heal = `INT × 1.25`. Integer math: every division/multiplication floors, fixed order base → RPS → status. DEX is RESERVED (no miss/crit in MVP) but lives in the table.
- FR16 spells: water→sleep, earth→poison (15 dmg at engagement end, before judging), fire→weaken (damage halved), wind→confusion (50% seeded misfire). Same spell never stacks.
- FR13 tie-break order (for doc comments; implemented in 1.4): front row → left → seeded coin flip.

### Verified API facts (read from the INSTALLED packages 2026-07-12 — do NOT trust training data)

- **pure-rand 8.4.2 has NO root export.** `import ... from 'pure-rand'` FAILS with ERR_PACKAGE_PATH_NOT_EXPORTED. Use subpaths only: `import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus'` and `import { uniformInt } from 'pure-rand/distribution/uniformInt'`.
- **Generators are MUTABLE in 8.x:** `next()` "alters current generator" (returns int32 in [−0x8000_0000, 0x7fff_ffff]); also `clone()`, `getState()`, and `jump()` (mutating). `uniformInt(rng, from, to): number` mutates `rng` and returns the value — no `[value, nextRng]` tuples (that was the old immutable API in training data).
- Mutable generators inside the engine are fine: purity holds at the FUNCTION boundary (same seed in → same outputs out); generators are created per call/stream and never escape the module's public types.
- **@fast-check/vitest 0.4.1:** `import { fc, test, it } from '@fast-check/vitest'`; property style is the builder `test.prop([fc.integer({min: 0, max: 0xffffffff})])('description', (seed) => { ... })`. `fast-check` 4.9.0 is re-exported as `fc`.

### Previous story intelligence (stories 1.1/1.2 — see their Dev Agent Records)

- **Toolchain:** agent commands need `export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"`; run pnpm from the REPO ROOT (a subdir cwd broke `pnpm coverage` once in 1.2).
- **No CI changes needed:** engine tests are auto-discovered by the root vitest `projects` config; CI already runs `pnpm coverage` via the `.github/actions/setup-workspace` composite action. Do NOT touch ci.yml or the composite action this story.
- **Test conventions:** engine tests in `packages/engine/test/`; TDD red-green with honest red proofs (both prior stories did deliberate-failure checks); tests import from `'vitest'` explicitly (resolved via root walk-up), fast-check tools from `'@fast-check/vitest'` (engine devDep).
- **Existing placeholder:** `src/index.ts` exports `ENGINE_NAME`; `test/placeholder.test.ts` and `apps/web/test/engine-resolution.test.ts` assert on it. If the index is reworked, keep both tests meaningful (they prove workspace wiring per 1.1's ACs) — `engine-resolution.test.ts` in particular guards ADR-001's exports-map path.
- **Coverage:** report-only until story 1.6 — do NOT uncomment the threshold glob in vitest.config.ts yet, even though this story pushes engine coverage up.

### Scope fences (things this story must NOT do)

- NO `resolveBattle`, NO targeting, NO combat resolution, NO `BattleLog`/event types (stories 1.4/1.5), NO AI module (1.7), NO sim harness (1.7).
- NO web/app changes at all (apps/web is untouched; its build just must not regress).
- NO new dependencies — pure-rand, fast-check, @fast-check/vitest, typescript are all already installed and pinned.
- NO CI/workflow changes; NO coverage-threshold activation (1.6).

### Testing standards for this story

- Every AC has a direct test: type shape (compile-time, exercised by tests constructing a valid `MatchSetup`), balance table content, balance-hash guard (with a red-green proof), stream identity/independence properties, rollElement codomain, purity guard.
- Property tests are the story's center of gravity — this is the first fast-check usage and sets the pattern stories 1.4–1.6 inherit (termination, judging symmetry, seed identity all build on this).

### Project Structure Notes

- New files: `packages/engine/src/types.ts`, `src/balance.ts`, `src/rng.ts` (spine structural seed); tests beside existing `test/placeholder.test.ts`.
- `src/index.ts` becomes the real public-API barrel (exports types, balance, rng surfaces).

### References

- [Source: docs/planning-artifacts/epics.md#Story-1.3] — ACs (verbatim source of truth)
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-1, #AD-4, #AD-8, #AD-9, #AD-10, #AD-11, #Consistency-Conventions, #Structural-Seed]
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#FR13, #FR14, #FR15, #FR16, #FR20, #NFR2, #NFR3, #Glossary]
- Verified from installed packages (2026-07-12): pure-rand 8.4.2 exports map + RandomGenerator/JumpableRandomGenerator d.ts; @fast-check/vitest 0.4.1 export surface

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Fable 5)

### Debug Log References

- TDD note: type-only imports are erased at runtime, so Task 1's red showed in `tsc --noEmit` (TS2307 on the missing module), not in vitest — both gates matter for red proofs on type-heavy code.
- Balance-hash red-green proof: knight hp 140→141 → guard failed with hash mismatch; reverted → 24/24 green. Pinned hash for version 1: `bfce425a`.
- The first purity-test draft used `node:fs`/`import.meta.dirname`, which fails engine typecheck (no `@types/node`, correctly absent). Rewritten with Vitest raw imports (`import.meta.glob(..., { query: '?raw' })` + a local `test/test-env.d.ts` typing) — zero new deps, and the guard also asserts the src file list is complete so new modules can't dodge it.
- Determinism anchor pinned: seed 0xc0ffee on `elements/A` rolls water, fire, fire.

### Implementation Plan

- `types.ts` = vocabulary only (no BattleLog — 1.4); doc comments carry the Glossary.
- `balance.ts` = one `BALANCE: BalanceData` export; multipliers as integer `Ratio` pairs; army size + engagement cap as data (AD-1).
- `hash.ts` = FNV-1a over canonical JSON (recursively sorted keys) — order-independent, dependency-free; exported as `contentHash` (reusable for golden tests later).
- `rng.ts` = closed `STREAM_LABELS` tuple → `StreamLabel` union; per-stream seed = FNV-1a(label) mixed with match seed; opaque `Stream` wrapper so pure-rand's mutable generator never escapes; `nextInt` is the only draw API.
- pure-rand 8.4.2 subpath imports used exactly as verified (`pure-rand/generator/xoroshiro128plus`, `pure-rand/distribution/uniformInt`, type from `pure-rand/types/JumpableRandomGenerator`).

### Completion Notes List

- All 5 tasks complete; 24 tests green (17 new this story: 3 type-shape, 6 balance, 1 hash guard, 7 rng incl. 4 fast-check property tests, 3 purity), typecheck + coverage + web build all green.
- Engine src statement coverage ~97% — comfortably above the 90% line gate that story 1.6 will activate (still report-only now, per plan).
- First `@fast-check/vitest` usage establishes the property-test pattern (builder `test.prop([arb])(name, fn)`) that stories 1.4–1.6 inherit for termination/symmetry/seed-identity properties.
- `ENGINE_NAME` kept; 1.1's placeholder test and the web engine-resolution test untouched and green.

### File List

- packages/engine/src/types.ts (new)
- packages/engine/src/balance.ts (new)
- packages/engine/src/hash.ts (new)
- packages/engine/src/rng.ts (new)
- packages/engine/src/index.ts (modified — public-API barrel)
- packages/engine/test/types.test.ts (new)
- packages/engine/test/balance.test.ts (new)
- packages/engine/test/balance-hash.test.ts (new)
- packages/engine/test/rng.test.ts (new)
- packages/engine/test/purity.test.ts (new)
- packages/engine/test/test-env.d.ts (new)
- docs/implementation-artifacts/1-3-engine-foundation-types-balance-data-and-seed-streams.md (story tracking)
- docs/implementation-artifacts/sprint-status.yaml (status tracking)

## Change Log

- 2026-07-12: Story 1.3 implemented. Engine foundation: canonical domain types (AD-4/9/11), versioned FR15 balance data with integer-ratio formula constants, FNV-1a balance-hash CI guard (AD-8, red-green proven), closed named seed streams over pure-rand with label-keyed derivation + rollElement (AD-10, property-tested), purity guard enforcing AD-1 by CI. 17 new tests; full gate green.
- 2026-07-12: `bmad-code-review` — Acceptance Auditor full pass on all ACs, but Blind Hunter empirically proved two HIGH RNG defects the property tests missed: first-element-pair biased to `seed % 4`, and affine cross-label stream aliasing (AD-10 violated). Root cause: FNV-1a is not an avalanche function + xoroshiro's weak state init. All 10 patch findings fixed same day (avalanche derivation, seed validation, WeakMap stream opacity, exact pure-rand pin, strict contentHash, hardened hash guard + purity guard, runtime enum exports, structural invariants, negative type tests); both defects re-probed dead; regression tests pin the old attack shapes. 36 tests green. Status → done.
