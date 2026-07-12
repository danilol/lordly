# Story 1.3: Engine foundation — types, balance data, and seed streams

Status: ready-for-dev

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

- [ ] Task 1: Domain types in `packages/engine/src/types.ts` (AC: 1)
  - [ ] Closed unions: `UnitClass` (`'knight' | 'mercenary' | 'archer' | 'mage' | 'cleric' | 'witch'`), `Element` (`'fire' | 'water' | 'wind' | 'earth'`), `Side` (`'A' | 'B'`), `Row` (`'front' | 'mid' | 'back'`), `Col` (`'left' | 'center' | 'right'`), `Mode` (`'single' | 'wipeout'`), `SpellKind` (`'sleep' | 'poison' | 'weaken' | 'confusion'`)
  - [ ] `UnitId` = template literal `` `${Side}:${number}` `` (AD-11: assigned from `MatchSetup.armies` order; display names are shell-side)
  - [ ] `Unit = { class: UnitClass; element: Element }`, `Placement = { row: Row; col: Col }` (owner-local coordinates ONLY — AD-11; lane mirroring is renderer math, never engine data)
  - [ ] `MatchSetup` EXACTLY per AD-9's canonical shape: `{ seed: number; balanceVersion: number; mode: Mode; armies: { A: Unit[]; B: Unit[] }; placements: { A: Placement[]; B: Placement[] } }` (placements parallel-indexed to armies)
  - [ ] Doc comments use the PRD Glossary vocabulary verbatim (match, battle, engagement, pass, action, reach, facing column, element, RPS, judging, seed) — the engine owns this vocabulary (AD-4); new domain words go to the Glossary first
  - [ ] NO `BattleLog`/event types — that union is story 1.4's scope (AD-12 lands there)
- [ ] Task 2: Balance data in `packages/engine/src/balance.ts` (AC: 1, 2)
  - [ ] `balanceVersion = 1` (monotonic integer)
  - [ ] Class table verbatim from PRD FR15 (values in Dev Notes below) as plain data: per class HP/STR/VIT/INT/MEN/AGI/DEX + per-row action counts `{ front, mid, back }`
  - [ ] Formula constants as data (integer math — FR15: every division/multiplier floors, in fixed order base → RPS → status): RPS advantage ×1.5 and disadvantage ×0.75 stored as integer ratios (`{ num: 3, den: 2 }`, `{ num: 3, den: 4 }`), heal = INT × 1.25 as `{ num: 5, den: 4 }`, minimum damage 1, poison damage 15, confusion misfire chance as ratio `{ num: 1, den: 2 }`, engagement cap 5 (FR19), army size **3** (AD-1: army size is DATA, never a hardcoded constant elsewhere)
  - [ ] RPS triangle as data: mage > knight, knight > archer, archer > mage (FR14; mercenary/cleric/witch neutral)
  - [ ] Element→spell mapping as data: water→sleep, earth→poison, fire→weaken, wind→confusion (FR16)
  - [ ] Unit tests: table has exactly 6 classes; every class has all 7 attributes + 3 action counts; spot-check a few PRD values (e.g. knight HP 140, witch AGI 26); RPS map is the exact 3-edge triangle
- [ ] Task 3: Balance-hash guard test (AC: 2)
  - [ ] Deterministic content hash of the FULL balance data (e.g. FNV-1a 32-bit over a canonical `JSON.stringify` — implement the tiny hash in the engine or test util; no new deps)
  - [ ] `packages/engine/test/balance-hash.test.ts`: an `expectedHashes: Record<number, string|number>` map pinning `{ 1: <computed hash> }`; the test asserts `hash(balanceData) === expectedHashes[balanceVersion]` — editing balance data without bumping `balanceVersion` AND updating the map fails CI (AD-8's two-step deliberate bump)
  - [ ] RED-GREEN proof: temporarily change one stat, watch the test fail, revert
- [ ] Task 4: Seed streams in `packages/engine/src/rng.ts` (AC: 3)
  - [ ] Closed label union: `StreamLabel = 'elements/A' | 'elements/B' | 'ai/A' | 'ai/B' | 'battle'` — adding a stream is an engine API change (AD-10)
  - [ ] Label-keyed derivation: per-stream seed = 32-bit hash (e.g. FNV-1a) mixing the label bytes with the match seed → `xoroshiro128plus(derivedSeed)`; the raw seed itself is NEVER fed to a generator directly, and knowing one stream's values must not yield another's (AD-10)
  - [ ] Export a stream factory (e.g. `createStreams(seed)` returning one stream per label, or `stream(seed, label)`) plus a minimal draw API (e.g. `nextInt(stream, from, to)` wrapping `uniformInt`) — the underlying pure-rand generator must NOT leak out of the module's types
  - [ ] `rollElement(stream): Element` — `uniformInt(rng, 0, 3)` indexed into a FIXED order array `['fire', 'water', 'wind', 'earth']` (order is part of determinism; freeze it with a test)
  - [ ] Property tests via `@fast-check/vitest` (first use — API verified, see Dev Notes): for arbitrary 32-bit seeds — same seed → bit-identical sequences per stream; different labels on the same seed → sequences differ; different seeds on the same label → sequences differ; `rollElement` only ever returns the 4 elements
- [ ] Task 5: Purity and docs audit (AC: 4)
  - [ ] Doc comment on EVERY export in types.ts, balance.ts, rng.ts, and the index re-exports (NFR3)
  - [ ] `src/index.ts` re-exports the public API (keep `ENGINE_NAME` from 1.1 or retire it — dev's call; if retired, update the 1.1 placeholder test accordingly, never delete the wiring test outright)
  - [ ] Purity guard test: a static test that reads the engine `src/` files and asserts none contain `Math.random`, `Date.now`, `new Date`, `import ... from 'phaser'`, `process.`, `localStorage`, or `fetch(` — AD-1 enforced by CI, not discipline
  - [ ] Full gate green: `pnpm -r typecheck`, `pnpm coverage`, `pnpm --filter web build` (web untouched but must not regress)

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

### Debug Log References

### Completion Notes List

### File List
