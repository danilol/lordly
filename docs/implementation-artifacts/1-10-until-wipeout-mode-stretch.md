# Story 1.10: Until-wipeout mode (stretch)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want an extended battle mode where engagements repeat until one side falls,
so that Clerics and Witches get room to shine.

## Acceptance Criteria

_Verbatim from [Source: docs/planning-artifacts/epics.md#Story-1.10], including the AC2 amendment made via correct-course on 2026-07-13 (see `docs/planning-artifacts/sprint-change-proposal-2026-07-13.md`). epics.md is canonical — if anything here drifts, epics.md wins._

**AC1 — Engine wipeout mode (FR19, NFR2)**
- **Given** `MatchSetup.mode = 'wipeout'`
- **When** `resolveBattle` runs
- **Then** engagements repeat until a side is wiped; statuses clear between engagements **except poison**, which persists and ticks each engagement end; after **5** engagements judging falls back to FR18 (FR19).
- **And** `EngagementEnded` events delimit engagements in the log; determinism, termination, and golden-battle tests cover the mode (NFR2).

**AC2 — Player-facing mode choice (amended 2026-07-13)**
- **Given** the MVP UI
- **When** a player starts a match
- **Then** they can choose between two modes before drafting — **Standard** (single engagement, FR17, the default) and **Wipeout** (engagements repeat until one side falls, FR19, capped at 5 engagements) — surfaced as a **real, player-facing toggle** (e.g. on Home or Draft), not a dev/debug-only affordance. (Product decision made — see PRD Open Item 2.)

## Tasks / Subtasks

- [ ] **Task 1 — Accept `mode: 'wipeout'` in validation (AC1)**
  - [ ] In `packages/engine/src/validate.ts`, delete the `mode === 'wipeout'` rejection block (lines 70–74: the "Honest rejection until story 1.10" throw). Keep the `'invalid-mode'` check for unknown strings unchanged — `'wipeout'` already passes it.
  - [ ] Remove `'mode-not-implemented'` from the `MatchSetupViolation` union — nothing else uses it (verified), and a dead discriminant in a union documented as "every way a MatchSetup can be malformed" would be a lie.
  - [ ] In `packages/engine/test/validate.test.ts`, replace the "rejects wipeout mode until story 1.10" case (lines 71–73) with one asserting a valid wipeout setup **passes** validation. Keep the `mode: 'ranked'` → `'invalid-mode'` case (lines 85–89) as-is.

- [ ] **Task 2 — The wipeout engagement loop in `resolveBattle` (AC1)**
  - [ ] In `packages/engine/src/resolve.ts`, wrap the existing engagement body (from the tie-flip draw at ~line 64 down through the `EngagementEnded` push at ~line 121) in a per-engagement loop driven by `setup.mode`: `'single'` runs it once (today's behavior, bit-identical); `'wipeout'` repeats until a side is wiped or `BALANCE.engagementCap` engagements complete, then judges by FR18 exactly as today (`judge(judgedView(units), wiped)`).
  - [ ] **Per-engagement reset:** replenish every living unit's `actionsLeft` from `BALANCE.classes[u.class].actions[u.snapshot.placement.row]` (the `Row` string survives on the snapshot; `rowIndex` alone is not enough); clear `statuses` of `sleep`/`weaken`/`confusion` but **retain `poison`** (FR19). Do NOT reset `hp`, `alive`, or any identity field. `BattleStarted` is emitted once, before the loop; `BattleEnded` once, after it.
  - [ ] **Stream-ordering invariant (FR20):** the tie coin flip is drawn INSIDE engagement scope — the resolve.ts comment at lines 53–57 was written for exactly this loop. Each engagement draws its flip first, then its confusion draws, all sequentially on the same `streams.battle`. Engagement 1's draws are then bit-identical to single mode — this is what keeps every existing golden and seed pin green.
  - [ ] **Recorded decision — pass numbering:** `PassStarted.pass` restarts at 1 each engagement (the natural consequence of wrapping `let pass = 0` inside the loop; the shell disambiguates via the enclosing `EngagementEnded.engagement`). Document in the code comment.
  - [ ] **Recorded decision — poison vs. wipe:** an engagement that ends by instant wipe ends the whole battle and skips poison (same short-circuit as today — coherent, since the battle is over); every NON-final engagement reaches its natural end and poison ticks (`BALANCE.formulas.poisonDamage` per tick, deaths emit `PoisonTicked` + `UnitDied`, and a poison wipe/mutual-wipe ends the battle via `wipedSide`). Update the "FR19's wipeout mode revisits in 1.10" comments in resolve.ts (~lines 100–104) and types.ts (`PoisonTicked` doc, ~lines 240–245) to record the decision instead of deferring it.
  - [ ] **Termination:** the outer loop is bounded by `BALANCE.engagementCap` (already asserted `> 0` in balance.test.ts) — the cap is the termination guarantee, not just a judging rule (a Cleric can offset chip damage indefinitely). State this in the loop comment.

- [ ] **Task 3 — Engine tests for wipeout (AC1; NFR2, ≥90% engine coverage stays enforced)**
  - [ ] Unit tests (`resolve.test.ts` or a new `wipeout.test.ts`): a wipeout battle that wipes in engagement ≥2 ends there (no further engagements); statuses clear between engagements except poison (a slept unit acts again next engagement; a weakened unit deals full damage again); poison ticks at EVERY natural engagement end and persists to battle end; a no-wipe battle runs exactly `BALANCE.engagementCap` engagements then judges by FR18; `EngagementEnded.engagement` numbers run 1..N; `PassStarted.pass` restarts at 1 per engagement; single-mode output is byte-identical to before (pinned determinism anchor untouched).
  - [ ] Widen `packages/engine/test/arbitraries.ts` `matchSetupArb` to `mode: fc.constantFrom('single', 'wipeout')` (its docblock already promises "either mode" — currently stale) and make `resolve.test.ts`'s termination-ceiling property mode-aware (wipeout ceiling ≈ per-engagement bound × `BALANCE.engagementCap`, with `BattleStarted`/`BattleEnded` counted once). Seed-identity and no-mutation properties then cover wipeout automatically.
  - [ ] Golden snapshots: the **5 existing single-mode goldens must stay green with zero re-recording** — they are the regression tripwire proving the loop-wrap didn't change single mode. Add ≥2 wipeout goldens (`golden.test.ts`): one multi-engagement battle with persisting poison, one cap-fallback battle, each with hand-verified inline assertions on the verdict and engagement count.
  - [ ] Judging-symmetry property (`combat.test.ts`): now covers wipeout transitively via the widened arb; the existing `noMirrorTieArb` filter logic still holds (the per-engagement flip remains the sole mirror-match asymmetry).

- [ ] **Task 4 — Mode through the shell: `MatchState` + `MatchFlow` (AC2)**
  - [ ] Add `mode: Mode` to `MatchState` (`apps/web/src/flow/MatchState.ts`) — plain serializable data (AD-5), default `'single'`. Import `Mode` from `@lordly/engine` (already exported).
  - [ ] `MatchFlow` (`apps/web/src/flow/MatchFlow.ts`): `startMatch(mode?: Mode)` — when given, sets the mode; when omitted, **carries the current mode forward** (same pattern as `lastAiArchetypeId`), so Result→Rematch replays the same mode and changing mode means going Home. `commit()` reads `mode: this.state.mode` instead of the hardcoded `'single'`.
  - [ ] Tests (`apps/web/test/match-flow.test.ts`): mode defaults to `'single'`; `startMatch('wipeout')` → `commit()` produces a `mode: 'wipeout'` setup that passes `validateMatchSetup` and `resolve()` returns a log; rematch (`startMatch()` with no arg) carries the mode; the serializability round-trips still pass with the new field.

- [ ] **Task 5 — The Home-scene mode toggle + battle-scene engagement marker (AC2)**
  - [ ] `HomeScene` (`apps/web/src/scenes/HomeScene.ts`): a two-option toggle (e.g. two small selectable buttons under Play) — **Standard** (default, pre-selected) / **Wipeout** — whose selection is passed to `flow.startMatch(mode)` on Play. Labels + a one-line mode description from new constants in `config/constants.ts` (e.g. `MODE_STANDARD_LABEL`, `MODE_WIPEOUT_LABEL`, hint text mentioning the cap read from `BALANCE.engagementCap` — never a hardcoded "5"). Standard tap-target sizing (rect + `crispText`, like every button).
  - [ ] `BattleScene` (`apps/web/src/scenes/BattleScene.ts`): on `EngagementEnded`, set the pass label to an engagement-boundary marker (e.g. `Engagement ${event.engagement} ended`) so multi-engagement playback reads visibly. No other scene changes — the 1.9 scene was explicitly built NOT to special-case a single `EngagementEnded`, and `PassStarted` already re-labels each pass.

- [ ] **Task 6 — Gate & manual verification (AC1, AC2)**
  - [ ] `pnpm -r typecheck` clean; `pnpm test` green (engine coverage gate ≥90% still enforced); `pnpm --filter web build` succeeds.
  - [ ] Manual dev drive (`pnpm --filter web dev`, 360×640): play one **Standard** match end to end (unchanged behavior), then one **Wipeout** match — confirm the toggle works, multiple engagements play back with visible boundaries, and the Result screen shows a verdict. Rematch from a wipeout Result stays in wipeout mode.

## Dev Notes

### Why this stretch story is cheap (read first)

Every seam was pre-built: `MatchSetup.mode: 'single' | 'wipeout'` has existed since 1.3 (AD-9), `resolveBattle`'s tie flip was deliberately drawn inside engagement scope "so story 1.10 wraps this in a per-engagement loop" (resolve.ts:53–57), `EngagementEnded` carries the engagement counter and HP snapshot "the wipeout loop will read" (types.ts), **`BALANCE.engagementCap: 5` already exists in balance v1**, and the 1.9 Battle scene replays the log generically with no single-engagement assumption. The work is: delete one validation block, wrap one loop, reset three fields, add tests, and wire a toggle.

### The load-bearing architectural decisions

- **AD-1/FR20 — determinism above all.** The wipeout loop must not perturb single mode's battle-stream draws: engagement 1 in either mode consumes the identical sequence (flip first, then confusion draws in timeline order). The resolve.ts STREAM-ORDERING INVARIANT comment (lines 59–65) is the contract: "Reordering ANY of these changes every existing seed's battle." The 5 existing goldens staying green without re-recording is the proof. [Source: packages/engine/src/resolve.ts:53–65; ARCHITECTURE-SPINE.md#AD-1]
- **AD-12 — NO `logVersion` bump.** `LOG_VERSION` stays 3: no new event kinds (multi-engagement reuses `PassStarted`/`EngagementEnded`), and a multi-`EngagementEnded` log was always FR19's documented shape — the union doc and `EngagementEnded`'s own doc anticipate it, and 1.9's scene was built for it. Only *extending the union* bumps the version. [Source: packages/engine/src/types.ts:111–117, 253–256]
- **AD-8 — balance hash: read, don't add.** `engagementCap: 5` is already inside pinned hash `bfce425a` for `version: 1` (verified by direct computation). The dev **reads** `BALANCE.engagementCap` — adding nothing, bumping nothing. ONLY if a balance *value* changes does the two-step apply: bump `version` to 2 in balance.ts AND add `2: '<new hash>'` to `EXPECTED_HASHES` in `test/balance-hash.test.ts`. This story has no reason to change any value. [Source: packages/engine/src/balance.ts:29–33,70; test/balance-hash.test.ts]
- **AD-5/AD-13 — mode is match state, owned by `MatchFlow`.** `mode` joins `MatchState` as plain serializable data; scenes pass it only via the flow. The toggle lives on **Home** (chosen over Draft: mode is a match-level setting picked before a `MatchFlow` exists for the match — Home's Play handler is the single place `startMatch` is called with player input). [Source: ARCHITECTURE-SPINE.md#AD-5/AD-13]

### Engine internals (verified against source, 2026-07-13)

- **validate.ts:** rejection block to delete (67–74): the `mode !== 'single' && mode !== 'wipeout'` → `'invalid-mode'` check STAYS; the `mode === 'wipeout'` → `'mode-not-implemented'` throw GOES, along with `'mode-not-implemented'` in the `MatchSetupViolation` union (nothing else uses it). Validation order is documented and fixed: structure → seed → balanceVersion → mode → army sizes → classes/elements → placement parallelism → grid → overlaps — don't reorder.
- **judging.ts is already wipeout-ready.** `WipeState = Side | 'both' | undefined`; `wipedSide()` (vacuous-truth-guarded per side); `judge(units, wiped)` handles wipe → other side wins, `'both'` → draw, else exact integer cross-multiplication HP-% (floored `hpPct` is report-only). The cap fallback is literally the same `judge()` call single mode makes today. No changes to this file.
- **Per-engagement `UnitState` reset (the whole loop body change):**
  - `actionsLeft` — re-derive from `BALANCE.classes[u.class].actions[u.snapshot.placement.row]`; it drains to 0 during a pass loop (decremented even on dead/asleep skips). Placement never changes mid-battle (FR19 has no re-placement).
  - `statuses` — delete `sleep`, `weaken`, `confusion`; keep `poison` (FR16/FR19: "statuses clear between engagements except poison").
  - Persist untouched: `hp`, `alive`, `id`, `side`, `class`, `agi`, `rowIndex`, `colIndex`, `witchSpell`, `snapshot`.
- **Loop skeleton:** for each engagement (1-based counter, `while` no wipe `&&` count ≤ `BALANCE.engagementCap`): draw tie flip → build comparator → run the pass loop (unchanged) → if mid-pass wipe: `break` all the way out (battle over, poison skipped) → else natural end: poison ticks (may produce a wipe/mutual wipe via `wipedSide`) → push `EngagementEnded { engagement, hp }` → if wiped, exit loop. After the loop: `judge(judgedView(units), wiped)` → `BattleEnded`. Single mode = the same machinery with cap 1 effectively (run once); implement so `'single'` output is bit-identical to today.
- **The mid-pass wipe check** (`if turnEvents contain UnitDied → wipedSide → break battle`) stays exactly as-is inside each engagement — "FR18: wipe ends it, unspent actions lost."

### Test landscape (what exists, what changes)

- `test/arbitraries.ts` `matchSetupArb` currently pins `mode: fc.constant('single')` with a comment saying exactly why and pointing at this story — widen to `fc.constantFrom('single', 'wipeout')`; its docblock already promises "either mode."
- `resolve.test.ts` termination property pins a single-engagement event ceiling (`1 + 2 + 24 + 6 + 6 + 1 + 1`) — must become mode-aware (per-engagement bound × cap for wipeout, `BattleStarted`/`BattleEnded` once). Seed-identity + no-mutation + deep-freeze properties inherit wipeout coverage from the widened arb for free.
- `golden.test.ts`: 5 snapshots in `__snapshots__/golden.test.ts.snap`, all `mode: 'single'` via the file's setup helper. **They must not be re-recorded** — a diff there means the loop-wrap changed single mode, which is a bug, not a snapshot update. New wipeout goldens use the documented deliberate-re-record discipline (`vitest -u` with event-by-event review) only for their own initial recording.
- `combat.test.ts` judging-symmetry: `noMirrorTieArb` filters cross-side AGI ties because "the per-engagement coin flip is not side-symmetric" — with per-engagement flips this rationale is unchanged.
- Setup helpers hardcoding `mode: 'single'` (fine, no change needed): combat.test.ts:9, roster.test.ts:7, confusion.test.ts:13, resolve.test.ts:12, golden.test.ts:13.
- Engine coverage gate (≥90% lines, `vitest.config.ts` `packages/engine/**`) stays enforced — the new loop branches need covering, which Task 3's unit tests do naturally.

### Existing web state you build on (current as of the 1.9 review-patch commit 96a96ba)

- **`MatchFlow`** owns: idempotent `commit()` (assembles setup with hardcoded `mode: 'single'` at the `const setup: MatchSetup = {...}` — the one line Task 4 changes), idempotent `resolve()` (caches the log on a private field, cleared by `startMatch()`), `startMatch()` (fresh seed, carries `lastAiArchetypeId`; extend the carry-forward pattern to `mode`), phase FSM guards (`draftUnit`/`removeUnit`/`placeUnit` throw once committed), `Number.isInteger` bounds guards.
- **`MatchState`** — plain, JSON-serializable (AD-5), round-trip-tested including the committed state with nested `MatchSetup`. New `mode` field slots in beside `seed`/`phase`.
- **`HomeScene`** — title + enabled Play button; Play builds `new MatchFlow()`, calls `startMatch()`, starts Draft. The toggle renders above/below Play; selection is scene-local until Play passes it into `startMatch(mode)` (Home has no flow yet — the mode is the one piece of pre-flow input).
- **`BattleScene`** — pure log player; `render()` returns visibility (silent beats fast-skip); `EngagementEnded` currently just resyncs HP bars. Adding the engagement-boundary label makes the beat visible (return `true`) and gives wipeout playback its legibility. `passLabel` already exists for exactly this kind of text.
- **Conventions:** all labels via `crispText` (`config/ui.ts`); all colors/labels/metrics from `config/constants.ts`; data the UI shows is READ from engine data (`BALANCE.engagementCap` in the wipeout hint — the hardcoded-`3` lesson from 1.8's review applies verbatim); scene tests must not import Phaser (node env only — pure `MatchFlow`/model tests carry correctness, scenes verified by manual drive).

### Previous story intelligence (1.9 + its review)

- 1.9's review-patch pass hardened `BattleScene` (misfire pairing via `pendingMisfirePair`, silent-beat fast-skip, `gameout` handling, NaN guard) — extend `render()` carefully: the `EngagementEnded` case change must preserve the HP resync and the misfire-pair flag reset behavior (the `linkedToMisfire` capture happens before the switch).
- 1.9 deliberately did **not** special-case "exactly one `EngagementEnded`" — the epics analysis for 1.9 predicted "a wipeout-mode log should replay through 1.9's scene without scene changes." That prediction is now load-bearing: Task 5's scene delta is one label, nothing structural.
- The blurry-font report from 1.9's device confirmation is NOT this story's problem (tracked in deferred-work.md → tech-debt story).
- Gate sequence unchanged: `pnpm -r typecheck` → `pnpm test` → `pnpm --filter web build` → manual dev drive at 360×640. Node 24 via nvm PATH prefix for every command.

### Scope fences (things this story must NOT do)

- **The "no engine changes" fence LIFTS for this story** — the first engine change since 1.7 — but only for the wipeout loop + validation. **No balance value changes** (no version/hash bump), no new streams, no rng changes, no new event types (`LOG_VERSION` stays 3), no targeting/damage/judging rule changes.
- **No sim-harness mode knob** — `sim/sweep.ts` stays `mode: 'single'`; wipeout balance dynamics (poison archetypes gain value) are real but explicitly deferred. Note it in deferred-work.md if not already.
- **No mode persistence** — the chosen mode lives in `MatchState` for the session only; persisting a mode preference belongs to story 2.3's `web/storage` settings gateway.
- **No presentation polish** — the engagement marker is a `crispText` label, not an animation; Epic 2 (2.2) owns the show. No speed/skip controls (2.3), no help content (2.4).
- **Stretch framing stands** (PRD FR19: "ship only if cheap") — if implementation reveals the loop is NOT cheap (e.g. determinism regressions in the goldens), halt and surface rather than force it.

### Project Structure Notes

- Engine edits: `packages/engine/src/{validate,resolve}.ts`, comment updates in `types.ts`; tests in `packages/engine/test/{validate,resolve,golden,arbitraries}.ts` (+ optional new `wipeout.test.ts`).
- Shell edits: `apps/web/src/flow/{MatchState,MatchFlow}.ts`, `apps/web/src/scenes/{HomeScene,BattleScene}.ts`, `apps/web/src/config/constants.ts`; tests in `apps/web/test/match-flow.test.ts`.
- No new top-level dirs; no new packages; no dependency changes.

### References

- [Source: docs/planning-artifacts/epics.md#Story-1.10] — canonical ACs (AC2 as amended 2026-07-13)
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-07-13.md] — the correct-course decision making the mode player-facing
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md] — FR16 (poison), FR17, FR18, FR19, FR20; Open Item 2 (updated)
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md] — AD-1, AD-5, AD-8, AD-9, AD-12, AD-13
- [Source: packages/engine/src/resolve.ts:53–65, 100–104] — engagement scoping, stream-ordering invariant, poison short-circuit comments written for this story
- [Source: packages/engine/src/validate.ts:67–74] — the rejection block to delete
- [Source: packages/engine/src/judging.ts] — `WipeState`/`wipedSide`/`judge`, already wipeout-ready
- [Source: packages/engine/src/balance.ts:32–33,70] — `engagementCap: 5` already in v1
- [Source: packages/engine/test/{arbitraries,resolve,golden,validate,balance-hash}.test.ts] — the test surfaces that change
- [Source: apps/web/src/flow/MatchFlow.ts, MatchState.ts; apps/web/src/scenes/HomeScene.ts, BattleScene.ts] — the shell seams
- [Source: docs/implementation-artifacts/1-9-reveal-battle-playback-and-result-the-loop-closes.md] — prior-story conventions + review hardening to preserve

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log
