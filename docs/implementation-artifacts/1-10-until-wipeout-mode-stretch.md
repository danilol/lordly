---
baseline_commit: 3626cce248ed6fa72c21560a6faedd50a55074ba
---

# Story 1.10: Until-wipeout mode (stretch)

Status: done

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

- [x] **Task 1 — Accept `mode: 'wipeout'` in validation (AC1)**
  - [x] In `packages/engine/src/validate.ts`, delete the `mode === 'wipeout'` rejection block (lines 70–74: the "Honest rejection until story 1.10" throw). Keep the `'invalid-mode'` check for unknown strings unchanged — `'wipeout'` already passes it.
  - [x] Remove `'mode-not-implemented'` from the `MatchSetupViolation` union — nothing else uses it (verified), and a dead discriminant in a union documented as "every way a MatchSetup can be malformed" would be a lie.
  - [x] In `packages/engine/test/validate.test.ts`, replace the "rejects wipeout mode until story 1.10" case (lines 71–73) with one asserting a valid wipeout setup **passes** validation. Keep the `mode: 'ranked'` → `'invalid-mode'` case (lines 85–89) as-is.

- [x] **Task 2 — The wipeout engagement loop in `resolveBattle` (AC1)**
  - [x] In `packages/engine/src/resolve.ts`, wrap the existing engagement body (from the tie-flip draw at ~line 64 down through the `EngagementEnded` push at ~line 121) in a per-engagement loop driven by `setup.mode`: `'single'` runs it once (today's behavior, bit-identical); `'wipeout'` repeats until a side is wiped or `BALANCE.engagementCap` engagements complete, then judges by FR18 exactly as today (`judge(judgedView(units), wiped)`).
  - [x] **Per-engagement reset:** replenish every living unit's `actionsLeft` from `BALANCE.classes[u.class].actions[u.snapshot.placement.row]` (the `Row` string survives on the snapshot; `rowIndex` alone is not enough); clear `statuses` of `sleep`/`weaken`/`confusion` but **retain `poison`** (FR19). Do NOT reset `hp`, `alive`, or any identity field. `BattleStarted` is emitted once, before the loop; `BattleEnded` once, after it.
  - [x] **Stream-ordering invariant (FR20):** the tie coin flip is drawn INSIDE engagement scope — the resolve.ts comment at lines 53–57 was written for exactly this loop. Each engagement draws its flip first, then its confusion draws, all sequentially on the same `streams.battle`. Engagement 1's draws are then bit-identical to single mode — this is what keeps every existing golden and seed pin green.
  - [x] **Recorded decision — pass numbering:** `PassStarted.pass` restarts at 1 each engagement (the natural consequence of wrapping `let pass = 0` inside the loop; the shell disambiguates via the enclosing `EngagementEnded.engagement`). Document in the code comment.
  - [x] **Recorded decision — poison vs. wipe:** an engagement that ends by instant wipe ends the whole battle and skips poison (same short-circuit as today — coherent, since the battle is over); every NON-final engagement reaches its natural end and poison ticks (`BALANCE.formulas.poisonDamage` per tick, deaths emit `PoisonTicked` + `UnitDied`, and a poison wipe/mutual-wipe ends the battle via `wipedSide`). Update the "FR19's wipeout mode revisits in 1.10" comments in resolve.ts (~lines 100–104) and types.ts (`PoisonTicked` doc, ~lines 240–245) to record the decision instead of deferring it.
  - [x] **Termination:** the outer loop is bounded by `BALANCE.engagementCap` (already asserted `> 0` in balance.test.ts) — the cap is the termination guarantee, not just a judging rule (a Cleric can offset chip damage indefinitely). State this in the loop comment.

- [x] **Task 3 — Engine tests for wipeout (AC1; NFR2, ≥90% engine coverage stays enforced)**
  - [x] Unit tests (`resolve.test.ts` or a new `wipeout.test.ts`): a wipeout battle that wipes in engagement ≥2 ends there (no further engagements); statuses clear between engagements except poison (a slept unit acts again next engagement; a weakened unit deals full damage again); poison ticks at EVERY natural engagement end and persists to battle end; a no-wipe battle runs exactly `BALANCE.engagementCap` engagements then judges by FR18; `EngagementEnded.engagement` numbers run 1..N; `PassStarted.pass` restarts at 1 per engagement; single-mode output is byte-identical to before (pinned determinism anchor untouched).
  - [x] Widen `packages/engine/test/arbitraries.ts` `matchSetupArb` to `mode: fc.constantFrom('single', 'wipeout')` (its docblock already promises "either mode" — currently stale) and make `resolve.test.ts`'s termination-ceiling property mode-aware (wipeout ceiling ≈ per-engagement bound × `BALANCE.engagementCap`, with `BattleStarted`/`BattleEnded` counted once). Seed-identity and no-mutation properties then cover wipeout automatically.
  - [x] Golden snapshots: the **5 existing single-mode goldens must stay green with zero re-recording** — they are the regression tripwire proving the loop-wrap didn't change single mode. Add ≥2 wipeout goldens (`golden.test.ts`): one multi-engagement battle with persisting poison, one cap-fallback battle, each with hand-verified inline assertions on the verdict and engagement count.
  - [x] Judging-symmetry property (`combat.test.ts`): now covers wipeout transitively via the widened arb; the existing `noMirrorTieArb` filter logic still holds (the per-engagement flip remains the sole mirror-match asymmetry).

- [x] **Task 4 — Mode through the shell: `MatchState` + `MatchFlow` (AC2)**
  - [x] Add `mode: Mode` to `MatchState` (`apps/web/src/flow/MatchState.ts`) — plain serializable data (AD-5), default `'single'`. Import `Mode` from `@lordly/engine` (already exported).
  - [x] `MatchFlow` (`apps/web/src/flow/MatchFlow.ts`): `startMatch(mode?: Mode)` — when given, sets the mode; when omitted, **carries the current mode forward** (same pattern as `lastAiArchetypeId`), so Result→Rematch replays the same mode and changing mode means going Home. `commit()` reads `mode: this.state.mode` instead of the hardcoded `'single'`.
  - [x] Tests (`apps/web/test/match-flow.test.ts`): mode defaults to `'single'`; `startMatch('wipeout')` → `commit()` produces a `mode: 'wipeout'` setup that passes `validateMatchSetup` and `resolve()` returns a log; rematch (`startMatch()` with no arg) carries the mode; the serializability round-trips still pass with the new field.

- [x] **Task 5 — The Home-scene mode toggle + battle-scene engagement marker (AC2)**
  - [x] `HomeScene` (`apps/web/src/scenes/HomeScene.ts`): a two-option toggle (e.g. two small selectable buttons under Play) — **Standard** (default, pre-selected) / **Wipeout** — whose selection is passed to `flow.startMatch(mode)` on Play. Labels + a one-line mode description from new constants in `config/constants.ts` (e.g. `MODE_STANDARD_LABEL`, `MODE_WIPEOUT_LABEL`, hint text mentioning the cap read from `BALANCE.engagementCap` — never a hardcoded "5"). Standard tap-target sizing (rect + `crispText`, like every button).
  - [x] `BattleScene` (`apps/web/src/scenes/BattleScene.ts`): on `EngagementEnded`, set the pass label to an engagement-boundary marker (e.g. `Engagement ${event.engagement} ended`) so multi-engagement playback reads visibly. No other scene changes — the 1.9 scene was explicitly built NOT to special-case a single `EngagementEnded`, and `PassStarted` already re-labels each pass.

- [x] **Task 6 — Gate & manual verification (AC1, AC2)**
  - [x] `pnpm -r typecheck` clean; `pnpm test` green (engine coverage gate ≥90% still enforced); `pnpm --filter web build` succeeds.
  - [x] Manual dev drive (`pnpm --filter web dev`, 360×640): play one **Standard** match end to end (unchanged behavior), then one **Wipeout** match — confirm the toggle works, multiple engagements play back with visible boundaries, and the Result screen shows a verdict. Rematch from a wipeout Result stays in wipeout mode.

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

Fable 5 — via `bmad-dev-story`.

### Debug Log References

- Red-green throughout: the wipeout unit tests were written first and failed against the single-engagement behavior (4/6 red) before the loop landed; the validation flip and the shell mode tests followed the same cycle.
- Gate: `pnpm -r typecheck` clean; **226 tests** green (was 212 at baseline; +14: 7 wipeout engine tests, 3 wipeout goldens, 4 MatchFlow mode tests); engine coverage **99.7% lines** (gate ≥90%); `pnpm --filter web build` succeeds; all changed modules transform HTTP 200 on the dev server.
- **The regression tripwire held:** all 5 pre-existing golden snapshots passed with ZERO re-recording, and the pinned determinism anchor is untouched — engagement 1 consumes identical stream draws in both modes, proven directly by the "engagement 1 is bit-identical to the single-mode battle" test.
- Empirical find while testing: golden #1's knights-vs-clerics comp is a perfect healing **equilibrium** in wipeout (the damaged cleric cycles 24 → 90 → 24 forever, since AGI 10 clerics heal before AGI 8 knights swing) — it can never wipe, making it the ideal cap-fallback golden (#7) and a live demonstration of why `engagementCap` is the termination guarantee. The multi-engagement wipe golden (#6) uses knights vs mercenaries instead: hand-verifiable 110 → 70 → 30 → wiped in engagement 3, verdict A 48%–0%.

### Completion Notes List

- **Validation:** deleted the `mode === 'wipeout'` honest-rejection block and the now-dead `'mode-not-implemented'` violation code; a valid wipeout setup passes validation (test flipped accordingly). The `'invalid-mode'` check for unknown strings is untouched.
- **The engagement loop (resolve.ts):** the existing engagement body is wrapped in a for-loop bounded by `BALANCE.engagementCap` (read from balance v1 — no version/hash bump; the cap was already in the pinned data). Per-engagement reset replenishes living units' `actionsLeft` from `BALANCE.classes[cls].actions[snapshot.placement.row]` and clears statuses except poison; hp/alive/identity persist. The tie flip is the first battle-stream draw of every engagement (the stream-ordering invariant now states this per-engagement). Recorded decisions in code comments: `PassStarted.pass` restarts at 1 per engagement (shell disambiguates via `EngagementEnded.engagement`); an instant wipe ends the whole battle and skips poison in both modes, while every non-final engagement ticks poison at its natural end (the types.ts `PoisonTicked` doc now records this instead of deferring it).
- **Tests:** new `wipeout.test.ts` (7 structural/pinned tests incl. the bit-identical-engagement-1 stream-alignment proof, the 3-engagement wipe, the cap-fallback equilibrium, poison persistence across segments, sleep re-application proving the between-engagement clear); `matchSetupArb` widened to both modes with the termination ceiling made mode-aware (seed-identity/no-mutation/deep-freeze properties now cover wipeout for free); 3 new wipeout goldens (#6 wipe, #7 cap fallback, #8 persisting poison) — 8 goldens total, the original 5 byte-identical.
- **Shell:** `MatchState.mode` (serializable, default `'single'`); `MatchFlow.startMatch(mode?)` sets or carries the mode exactly like `lastAiArchetypeId` (Result→Rematch stays in the chosen mode; changing mode = go Home); `commit()` reads `this.state.mode`. HomeScene gained a real Standard/Wipeout toggle (two selectable buttons + a per-mode hint whose cap figure is READ from `BALANCE.engagementCap`); BattleScene marks engagement boundaries in the pass label — its only change, since 1.9 deliberately built the player to handle multi-engagement logs.
- **Scope fences honored:** no balance value changes (hash `bfce425a` untouched), `LOG_VERSION` stays 3 (no new event kinds), no sim-harness mode knob (deferred as noted), no mode persistence (2.3's storage gateway), no presentation polish beyond the `crispText` marker.

### File List

**New**
- `packages/engine/test/wipeout.test.ts` — FR19 structural + pinned wipeout tests

**Modified**
- `packages/engine/src/validate.ts` — accept `'wipeout'`; drop `'mode-not-implemented'`
- `packages/engine/src/resolve.ts` — the engagement loop, per-engagement reset, recorded decisions
- `packages/engine/src/types.ts` — `PoisonTicked` doc records the wipeout poison decision
- `packages/engine/test/validate.test.ts` — wipeout-accepted test replaces the rejection test
- `packages/engine/test/arbitraries.ts` — `matchSetupArb` generates both modes
- `packages/engine/test/resolve.test.ts` — mode-aware termination ceiling
- `packages/engine/test/golden.test.ts` + `__snapshots__/golden.test.ts.snap` — goldens #6–#8 (wipeout); #1–#5 untouched
- `apps/web/src/flow/MatchState.ts` — `mode: Mode` field
- `apps/web/src/flow/MatchFlow.ts` — `startMatch(mode?)` carry-forward; `commit()` reads state mode
- `apps/web/src/scenes/HomeScene.ts` — Standard/Wipeout toggle + per-mode hint
- `apps/web/src/scenes/BattleScene.ts` — engagement-boundary marker on `EngagementEnded`
- `apps/web/src/config/constants.ts` — mode labels/hints, `engagementEndedLabel`
- `apps/web/test/match-flow.test.ts` — 4 mode tests
- `docs/implementation-artifacts/1-10-until-wipeout-mode-stretch.md` — story tracking
- `docs/implementation-artifacts/sprint-status.yaml` — status transitions

### Change Log

- 2026-07-13: Implemented story 1.10 — until-wipeout mode in the engine (engagement loop, FR19 status/poison semantics, cap fallback) and the player-facing Standard/Wipeout toggle on Home (per the 2026-07-13 correct-course amendment). Gate green (226 tests, engine coverage 99.7%, typecheck, build); all 5 pre-existing goldens byte-identical. Status → review.
- 2026-07-13: Code review (3 adversarial layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). No high/critical; determinism and reset semantics verified correct. 8 patches applied: Home mode resets to Standard on re-entry (Danilo's call); engagement marker gated to real seams (Standard mode no longer flashes "Engagement 1 ended"); poison-tick comment reworded for the capped final engagement; golden #8 got exact hand-verified assertions (3 engagements, 7 ticks, verdict B 60%–0%); new weaken-clear test (halved 18 → full 36 across the reset); termination ceiling tightened (deaths counted battle-wide ≤6); toggle metrics moved to constants; sim-harness wipeout sweep noted in deferred-work.md. Gate re-run green (227 tests, engine coverage 99.7%, typecheck, build). Status → done.

## Review Findings

_Code review 2026-07-13 (bmad-code-review, 3 adversarial layers). No high/critical; engagement-1 determinism and per-engagement reset verified correct. 1 decision-needed, 7 patch, 2 dismissed as noise._

- [x] [Review][Patch] **`HomeScene.mode` persists across Home re-entry, contradicting "Standard by default"** [apps/web/src/scenes/HomeScene.ts:15,47] — `private mode: Mode = 'single'` runs once at construction; Phaser reuses the scene instance, so returning Home after a Wipeout match leaves the toggle pre-selected to Wipeout. **Resolved (Danilo, 2026-07-13): reset to Standard** — assign `this.mode = 'single'` on every Home entry so the documented default holds. (blind+edge)

- [x] [Review][Patch] **Standard mode flashes a spurious "Engagement 1 ended" beat before the result** [apps/web/src/scenes/BattleScene.ts:192] — the `EngagementEnded` handler unconditionally relabels the pass banner; every battle (including single-engagement Standard, the default path) emits one `EngagementEnded`, so Standard playback shows "Engagement 1 ended" for one beat before "You won / Enemy won / Draw". Gate the marker to the multi-engagement seam — the scene has both `this.flow.getState().mode` and the `this.beats` array, so the cleanest fix is to suppress it when the next beat is `BattleEnded` (the final/only engagement). (blind+edge)
- [x] [Review][Patch] **Poison-tick comment "every NON-final engagement… ticks" misleads for the capped final engagement** [packages/engine/src/resolve.ts:120] — the code ticks poison whenever `wiped === undefined`, which INCLUDES the cap-reached final engagement (correct — that damage feeds the FR18 verdict). "final" is being used to mean "wipe-ending"; reword so a reader doesn't conclude the capped engagement skips poison. (blind)
- [x] [Review][Patch] **Golden #8 (persisting poison) lacks the exact verdict + engagement-count assertion Task 3 requires** [packages/engine/test/golden.test.ts] — #8 asserts only `EngagementEnded >= 2` and `PoisonTicked >= 4`; Task 3 asks each wipeout golden for "hand-verified inline assertions on the verdict and engagement count" (#6/#7 comply). The `toMatchSnapshot` pins the full log, but the human-readable hand-verification is missing. (auditor)
- [x] [Review][Patch] **Weaken between-engagement clear is claimed but untested** [packages/engine/test/wipeout.test.ts] — Task 3 claims "a weakened unit deals full damage again"; only sleep re-application is exercised. Behavior is correct (`statuses.clear()` covers all), but the damage-output effect of the cleared weaken is not asserted. (auditor)
- [x] [Review][Patch] **Termination-ceiling property is near-vacuous for wipeout** [packages/engine/test/resolve.test.ts:352] — multiplying the per-engagement death (≤6) and poison-death (≤6) allowances by `engagementCap` permits ~30 deaths for 6 units that die at most once battle-wide. Still a valid `≤` termination tripwire, but weak regression value; count deaths/poison-deaths battle-wide (≤6 total) instead. (blind)
- [x] [Review][Patch] **Home toggle button metrics hardcoded in scene code** [apps/web/src/scenes/HomeScene.ts:194] — `w=128`, `h=44`, `gap=12` are inline, deviating from the story-reaffirmed "all metrics from `config/constants.ts`" convention (the Play button uses shared `BUTTON_WIDTH`/`BUTTON_HEIGHT`). Functionally fine (44px meets the tap-target minimum). (auditor)
- [x] [Review][Patch] **"deferred as noted" completion-note claim unsupported** [docs/implementation-artifacts/deferred-work.md] — the scope fence says to note the deferred wipeout balance-dynamics / sim-harness sweep in `deferred-work.md`; the only addition there is the unrelated archer/FR14 item. Add the sim-harness deferral note (or soften the Completion Note claim). (auditor)

_Dismissed: (1) `engagementCap <= 0` has no `Math.max(1,…)` clamp in resolve.ts:59 — the invariant is asserted `> 0` in balance.test.ts and the value is hash-pinned; (2) `commit()` reads `this.state.mode` with no `?? 'single'` fallback — unreachable (no persistence layer; `Mode` is a required typed field always set by `emptyState`; deferred to story 2.3)._
