# Story 1.4: Battle timeline and the BattleLog chassis

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the game's developer,
I want the engagement loop resolving on the AGI timeline over a validated input contract,
so that every combat mechanic lands on a proven, deterministic chassis.

## Acceptance Criteria

1. **Given** a valid `MatchSetup`, **when** `resolveBattle(setup)` runs, **then** it returns an immutable `BattleLog` (`logVersion` + ordered events) without mutating its input (AD-1, AD-12), scaffolding the event envelope with `BattleStarted`, `PassStarted`, `EngagementEnded`, and `BattleEnded`, **and** combat runs in passes: one action per living unit per pass, descending AGI across both armies, multihit split across passes, ties broken front-row → left → seeded coin flip; units with no actions remaining are skipped (FR13, FR17 loop structure).
2. **Given** a malformed `MatchSetup` (wrong army size, out-of-grid or overlapping placement, unknown class or element, `balanceVersion` mismatch), **when** `resolveBattle` is called, **then** it throws a typed validation error naming the violation — the only condition under which the engine throws (spine errors convention) — and each case is unit-tested.
3. **Given** the chassis test suite, **when** CI runs, **then** unit tests cover FR13's ordering, tie-breaking, and multihit split via the event stream, and property tests prove termination and seed identity (same setup → bit-identical log) (NFR2, FR20).

## Tasks / Subtasks

- [ ] Task 1: BattleLog event types in `packages/engine/src/types.ts` (AC: 1)
  - [ ] `BattleLog = { logVersion: number; events: readonly BattleEvent[] }` with `LOG_VERSION = 1` exported; `BattleEvent` is a closed discriminated union on `type` (past-tense names, one event per (actor, action), carrying all render data — AD-12)
  - [ ] Chassis events (the full 12-member union completes by story 1.6; extending it bumps `LOG_VERSION` per AD-12):
    - `BattleStarted` — carries the full initial roster the UI renders from: per unit `{ id: UnitId, side, class, element, placement, hp, maxHp }` (the player never re-derives state)
    - `PassStarted` — `{ pass: number }` (1-based; makes FR13's multihit split visible)
    - `ActionSkipped` — `{ unit: UnitId, reason: 'dead' | 'asleep' | 'idle' }` (see design decision in Dev Notes: in the chassis every taken turn emits `ActionSkipped { reason: 'idle' }` — stories 1.5/1.6 replace acted turns with real `UnitAttacked`/`UnitHealed`/... events; `'asleep'` is reserved for 1.6, `'dead'` documents units that lost unspent actions)
    - `EngagementEnded` — `{ engagement: number; hp: Record<UnitId, number> }` (snapshot for FR18/FR19 later)
    - `BattleEnded` — `{ winner: Side | 'draw'; hpPct: { A: number; B: number } }`
  - [ ] Doc comments per export (NFR3), PRD Glossary vocabulary (pass, action, engagement, judging)
- [ ] Task 2: Validation in `packages/engine/src/validate.ts` (AC: 2)
  - [ ] `export class InvalidMatchSetupError extends Error` with a `violation` discriminant code and a message NAMING the violation (e.g. which side/unit index/cell) — the engine's ONLY throw path (spine errors convention)
  - [ ] `validateMatchSetup(setup)` checks, in a fixed documented order: seed is a uint32 integer (pre-empting rng.ts's RangeError so callers see one error type); `balanceVersion === BALANCE.version`; each army length `=== BALANCE.armySize`; every unit class in `ALL_CLASSES` and element in `ALL_ELEMENTS` (runtime callers are not bound by TS unions); placements parallel to armies (same length); every placement row/col in `ALL_ROWS`/`ALL_COLS`; no two units of the SAME side on the same cell (opposing sides never share a grid)
  - [ ] One unit test per violation case (7+) asserting both the error type and that the message names the offender; plus a valid setup passes
- [ ] Task 3: `resolveBattle` chassis in `packages/engine/src/resolve.ts` (AC: 1)
  - [ ] `resolveBattle(setup: MatchSetup): BattleLog` — validates first (Task 2), derives streams via `createStreams(setup.seed)` using ONLY the `battle` stream in this story
  - [ ] Initial unit state built from `armies` + `placements` + `BALANCE`: id `side:index` (AD-11), hp = maxHp = class hp, actions budget = `BALANCE.classes[class].actions[placement.row]` (units never move; the budget is fixed by starting row)
  - [ ] Timeline per FR13/FR17: while any living unit has actions remaining → emit `PassStarted`; within a pass every living unit with actions remaining takes exactly ONE action in order: AGI descending → front row before mid before back (`ALL_ROWS` order) → left before center before right (`ALL_COLS` order) → seeded coin flip **rolled once per engagement** from the `battle` stream deciding which SIDE goes first on exact cross-side ties; the acting turn decrements the unit's remaining actions and emits its event (chassis: `ActionSkipped { reason: 'idle' }`)
  - [ ] Engagement end when all actions spent → `EngagementEnded` with hp snapshot; `mode: 'single'` → exactly one engagement (FR17); `mode: 'wipeout'` also resolves single-engagement in this story with a `// story 1.10` note (its loop is out of scope, but the mode must not throw — it's valid input per AD-9)
  - [ ] `BattleEnded`: with no damage mechanics yet, every battle is an exact tie → `{ winner: 'draw', hpPct: { A: 100, B: 100 } }` (FR18's real judging is story 1.5)
  - [ ] Immutability: the returned log and its events array are `Object.freeze`d; the input `setup` is never mutated (assert via deep-clone comparison in tests)
- [ ] Task 4: Chassis test suite (AC: 3)
  - [ ] `test/arbitraries.ts` — reusable fast-check arbitrary for VALID `MatchSetup`s (armies of `BALANCE.armySize` sampled from `ALL_CLASSES`×`ALL_ELEMENTS`, placements as distinct cells per side, uint32 seed, both modes) — stories 1.5/1.6 inherit this
  - [ ] FR13 ordering unit tests reading the event stream: descending-AGI order across both armies within a pass (e.g. Witch 26 → Archer 22 → Mercenary 14 → Mage 12 → Cleric 10 → Knight 8); front-before-back and left-before-right tiebreaks (same-class same-side setups); cross-side exact tie decided by the per-engagement coin flip — pin BOTH outcomes with two seeds chosen to flip each way
  - [ ] Multihit split test: a front-row Knight (2 actions) acts exactly once in pass 1 and once in pass 2, never twice in one pass; back-row Knight (1 action) appears only in pass 1
  - [ ] Envelope shape test: exactly one `BattleStarted` first and one `BattleEnded` last; `PassStarted` count equals the max per-unit action budget; every unit's turn count equals its row's action budget
  - [ ] Property tests (fast-check over the arbitrary): termination (resolves, event count bounded by a computable ceiling); seed identity — same setup → deep-equal (bit-identical) log; input non-mutation — setup deep-equals its pre-call clone; determinism anchor: one pinned full event-type sequence for a known setup/seed (golden-lite; full golden battles arrive in 1.5)
- [ ] Task 5: Integration, purity, docs (AC: 1, 2, 3)
  - [ ] Export `resolveBattle`, `validateMatchSetup`, `InvalidMatchSetupError`, `LOG_VERSION`, and the event types from `src/index.ts` with doc comments
  - [ ] UPDATE `test/purity.test.ts`'s expected file list to include the new src modules (`resolve.ts`, `validate.ts`) — the guard asserts the exact list and WILL fail otherwise (this is by design from 1.3's review)
  - [ ] New src files must pass the purity patterns (no `Date`, no `Math.random`, no `Intl`, etc. — see the FORBIDDEN list)
  - [ ] Full gate green: `pnpm -r typecheck`, `pnpm coverage`, `pnpm --filter web build`

## Dev Notes

### Architecture constraints that bind THIS story (from ARCHITECTURE-SPINE.md)

- **AD-1:** `resolveBattle(setup) → BattleLog` pure; identical inputs → bit-identical output; integer math only; input never mutated.
- **AD-2:** the engine resolves the ENTIRE battle up front into the ordered log; anything the UI will need must be an event (that's why `BattleStarted` carries the full roster).
- **AD-11:** unit ids `side:index` from `armies` order; positions owner-local.
- **AD-12:** closed versioned event union, past tense, one event per (actor, action), carrying all render data. Extending the union bumps `logVersion`.
- **Errors convention:** typed errors ONLY on invalid input; the engine never throws mid-battle — an impossible state mid-resolution is a bug caught by tests.

### Chassis design decision (resolves an AC tension — record in the story, carry to 1.5)

AC1 scaffolds only envelope events, but AC3 requires FR13 ordering/ties/multihit "visible via the event stream" — invisible with pass-level events alone. Inventing a non-union event would violate AD-12's closed set. Resolution: the chassis emits **`ActionSkipped { reason: 'idle' }`** (a union member) for every taken turn — the actor sequence makes FR13 fully testable now, and stories 1.5/1.6 replace acted turns with `UnitAttacked`/`UnitHealed`/etc. while `ActionSkipped` keeps its real meanings ('asleep' from Sleep, 'dead' for lost actions). `LOG_VERSION` starts at 1; the union extension in 1.6 bumps it per AD-12.

### FR13 precise semantics (from the PRD — implement exactly)

- Passes repeat until every action is spent. In each pass, every living unit with actions remaining takes exactly ONE action, descending AGI across BOTH armies (the timeline weaves between sides).
- Tie order: equal AGI → front row before back (`ALL_ROWS` order front/mid/back) → left before right (`ALL_COLS` order left/center/right) → **seeded coin flip across players, rolled ONCE per engagement** (one `nextInt(battle, 0, 1)` deciding which side wins all remaining exact ties that engagement).
- Multihit split: a 2-action unit acts once per pass across two passes — never twice in one pass.
- Dead/sleeping units lose unspent actions (chassis: nothing dies yet, but the state model must carry `alive` so 1.5 slots in).
- AGI values (balance v1) give the natural order Witch 26 → Archer 22 → Mercenary 14 → Mage 12 → Cleric 10 → Knight 8.

### Previous story intelligence (1.3 + its code review — critical)

- **Purity guard WILL fail on new src files** until `test/purity.test.ts`'s expected list is updated (`['balance.ts','hash.ts','index.ts','resolve.ts','rng.ts','types.ts','validate.ts']` sorted). Its FORBIDDEN patterns include `globalThis`, `Intl`, `localeCompare`, `setTimeout`, dynamic `import(` — write resolve.ts accordingly (plain sorts with explicit comparators only; `Array.prototype.sort` with a numeric comparator is fine, never locale-dependent default string sort).
- **rng API contract (post-review):** streams come ONLY from `createStreams` (foreign objects throw TypeError via the WeakMap); `nextInt` throws RangeError on inverted/non-integer bounds; pure-rand is pinned exactly 8.4.2 with anchor tests — do NOT touch rng.ts or the anchors.
- **Sorting determinism:** use a single explicit comparator implementing the FR13 tie chain; never rely on `Array.prototype.sort` stability semantics across engines as a tiebreak (V8 is stable, but the comparator must fully order units anyway — the coin flip completes the total order).
- **Test conventions:** `@fast-check/vitest` builder `test.prop([arb])(name, fn)`; determinism anchors are pinned literals with a comment explaining that changing them is an engine API change; red-green proofs for at least the validation error cases and one ordering test.
- **Toolchain:** `export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"` on every command; run pnpm from the repo root; no CI changes needed (tests auto-discovered).
- `contentHash` is available from `src/hash.ts` if the golden-lite anchor wants a compact log fingerprint (it throws on non-plain-JSON — the log must stay plain data anyway per AD-12).

### Scope fences (things this story must NOT do)

- NO damage, NO targeting, NO RPS, NO healing, NO statuses, NO real judging (all story 1.5/1.6) — `BattleEnded` is a hardcoded all-full-HP draw.
- NO until-wipeout loop internals (story 1.10) — `mode: 'wipeout'` validates and resolves as a single engagement with a code note.
- NO AI (1.7), NO web changes, NO new dependencies, NO CI changes, NO coverage-threshold activation (1.6), NO changes to rng.ts/balance.ts/hash.ts.
- Do NOT emit the not-yet-implemented event types (`UnitAttacked`, `UnitHealed`, `StatusApplied`, `ActionMisfired`, `ActionFizzled`, `PoisonTicked`, `UnitDied`) — declare only the 5 chassis members now; 1.5/1.6 extend the union (with the `LOG_VERSION` bump).

### Testing standards for this story

- The event stream IS the test surface (AD-2): every FR13 rule asserted by reading event order, never by poking internal state.
- Property tests: termination, seed identity, input non-mutation over the shared arbitrary. The arbitrary lives in `test/arbitraries.ts` for reuse.
- Every validation violation has a dedicated failing-input test naming the offender.

### Project Structure Notes

- New: `packages/engine/src/resolve.ts`, `src/validate.ts`, `test/resolve.test.ts`, `test/validate.test.ts`, `test/arbitraries.ts`. Extended: `src/types.ts` (BattleLog/events), `src/index.ts`, `test/purity.test.ts` (file list).
- `targeting.ts` is deliberately NOT created yet (story 1.5 per the spine seed).

### References

- [Source: docs/planning-artifacts/epics.md#Story-1.4] — ACs (verbatim source of truth)
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-1, #AD-2, #AD-11, #AD-12, #Consistency-Conventions (errors, state mutation)]
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#FR13, #FR15 (action counts), #FR17, #FR20, #NFR2, #Glossary]
- [Source: docs/implementation-artifacts/1-3-engine-foundation-types-balance-data-and-seed-streams.md#Review-Findings, #Dev-Agent-Record] — rng contract, purity-guard file list, determinism-anchor conventions

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
