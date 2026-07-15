---
baseline_commit: 57adededfb092146e6aa0e993c383ef9a6871b53
---

# Story 3.2: Replay any remembered battle

Status: done

## Story

As a player,
I want to rewatch a past battle exactly as it happened,
so that I can study a great read or show a friend.

## Acceptance Criteria

1. **Replay a matching entry (FR20, FR28, AD-13).** For a history entry whose `setup.balanceVersion` matches the current engine, tapping Replay re-resolves the battle from the stored `MatchSetup` via `MatchFlow` in **replay mode** — determinism guarantees tick-for-tick fidelity — and the Battle scene plays it with the full Epic 2 presentation and the existing speed/skip controls.
2. **Replay writes NOTHING (AD-13).** No new history entry, no state mutation of real match data — rewatching a battle leaves the history list byte-identical. The Result screen after a replay shows the verdict normally; Rematch from there starts a fresh LIVE draft (mode carried from the replayed setup) and that new match records normally.
3. **Stale entries display but don't replay (AD-8).** An entry whose `balanceVersion` no longer matches still displays fully in the list but is visibly marked non-replayable, with Replay disabled for it.

## Tasks / Subtasks

- [x] Task 1: MatchFlow replay mode (AC: 1, 2) — RED first
  - [x] `startReplay(setup: MatchSetup): void` — hydrates the flow straight to `phase: 'committed'`: `committedSetup = setup`, `seed`/`mode` from the setup, `playerArmy`/`playerPlacements` mirrored from `setup.armies.A`/`placements.A` (state readers stay coherent; serializability holds), `lastAiArchetypeId` untouched/undefined, cached log cleared. Guard: run the engine's `validateMatchSetup(setup)` first — it already throws `InvalidMatchSetupError('balance-version-mismatch')` on a stale version, giving the flow-level backstop behind the UI gate for free
  - [x] A private `replay` flag set by `startReplay`, cleared by `startMatch()` — this is AD-13's `mode: 'live' | 'replay'` landing on the flow (NOT on `MatchState`; same reasoning as 3.1's `historyWritten`)
  - [x] `recordResult()` no-ops in replay mode (ResultScene calls it unconditionally — the 3.1 choke point does its job): `if (this.replay || this.historyWritten) return;`
  - [x] Tests (match-flow.test.ts, wired-flow pattern from 3.1): replayed log EQUALS the original live resolve's log for the same setup (FR20 — resolve a live match, startReplay its stored setup on a fresh flow, compare event streams); full replay + recordResult leaves storage byte-identical; Rematch-after-replay (startMatch) records normally with a FRESH seed; startReplay on a stale-balanceVersion setup throws; state after startReplay survives the JSON round-trip (AD-5)
- [x] Task 2: historyModel grows `replayable` (AC: 1, 3) — RED first
  - [x] `HistoryRow.replayable: boolean` = `entry.setup.balanceVersion === BALANCE.version` — pure, the scene keys the button state off this (never re-derives)
  - [x] Tests: matching version → true; stale (v1) → false; the row still formats fully either way (stale entries DISPLAY — pinned in 3.1's storage tests)
- [x] Task 3: Replay affordance on the History rows (AC: 1, 3)
  - [x] **Layout math (measured):** current cards span to x=327 (MARGIN 16, CARD_W 46, CARD_GAP 3, `renderUnitCard` returns `x + CARD_W + CARD_GAP`, vs advance `x += 20`), leaving only 17px — NOT enough for a ≥44px target. Shrink to fit: `CARD_W 46→42`, `CARD_GAP 3→2`, vs advance 20→12 ⇒ with the existing `+CARD_W+CARD_GAP` return pattern: yours end 148, vs ..160, enemy end **290**, **Replay button 296..344 (48 wide, full CARD_H height ≥44px)**, 16px right margin. Don't chase ±2px against these figures — derive from the code's own advance pattern. Re-verify code/dot/sprite legibility at 42px in the screenshot pass (sprite stays 32px; `CARD_CLASS_FONT_PX` 13 fits)
  - [x] Replayable row: a bordered `▶` button (PALETTE button tokens), drag-guarded via `wasDrag()`. **Scope restructure required:** `wasDrag` is currently a local const created AFTER the row loop (enableDragScroll needs the final content height — HistoryScene.ts:70) — hoist it (`let wasDrag: () => boolean` declared before the loop, assigned after; the pointerup closures only fire post-create, so the late assignment is safe) or store it on a field reset in create()
  - [x] Tap → `const flow = new MatchFlow(); flow.startReplay(entry.setup); this.scene.start('Battle', { flow })` — straight to Battle (no Reveal; the reveal moment belongs to live play), matching the epics AC "the Battle scene plays it"
  - [x] **Guard the tap against render-valid-but-replay-invalid entries:** `isHistoryEntry` deliberately validates only to RENDER depth (no seed/placements — 3.1's two-tier design), so a corrupt entry can carry `balanceVersion: 2` (button enabled) yet fail `validateMatchSetup` at the tap. Wrap the handler: on `InvalidMatchSetupError`, do NOT crash — disable the button and show the non-replayable marker for that row (graceful demotion). Test the flow-level throw; the scene path rides the drive
  - [x] Stale row: the button renders disabled (muted fill/stroke, no interactivity) AND the row carries a visible "non-replayable" marker (muted text near the date — EXPERIENCE.md:98's "visibly marked"); everything else renders normally
- [x] Task 4: Post-replay Result behavior (AC: 2)
  - [x] No ResultScene code change expected: `recordResult()` no-ops (Task 1), Rematch already calls `startMatch()` (flips the flow to live, fresh seed, carries the replayed mode — document this as the DECIDED behavior), Home works as-is. Verify by test (Task 1) + drive (Task 5)
- [x] Task 5: Gate + drive + device (all ACs)
  - [x] Full gate green (typecheck, lint, all tests, engine coverage untouched ≥90%)
  - [x] Headless-Chrome drive (the 3.1 harness in scratchpad): seed history with a fresh-version entry + a stale-v1 entry → screenshot the list (enabled ▶ vs disabled + marker); tap Replay → screenshot the Battle scene mid-playback; skip → Result renders; confirm via page-evaluate that `lordly.v1.history` is BYTE-IDENTICAL after the whole replay journey
  - [x] **On-device ACCEPTED (2026-07-15, Danilo on prod, post-review-patches build eb24f64):** "everything works as expected in prod." STORY DONE.

## Review Findings

Three-layer adversarial review (2026-07-15, Opus 4.8 reviewers), triaged. Acceptance Auditor: **zero AC violations** — all three ACs genuinely satisfied and tested (the cross-flow determinism equality test and byte-identical-storage test are real). The four load-bearing invariants (no-write replay, FR20 determinism, AD-8 version gate, AD-5 serializability) verified sound by all three layers. Five patches applied, one dismissed.

- [x] [Review][Patch] Replay button had no double-tap re-entry guard — reintroduced the memorized singleton-scene bug class (two rapid taps → two `scene.start('Battle')`). [HistoryScene.ts] — added a `transitioning` latch (reset in `create()`), matching `BattleScene.skipToResult`'s precedent.
- [x] [Review][Patch] Army length never bounded before the fixed-width row layout — the render guard's `.every()` passed vacuously for 0 or 4+ units, so a corrupt entry would overrun the Replay button off-canvas. [storage.ts:59] — `isRenderableSetup` now requires exactly `BALANCE.armySize` units per side (strengthens 3.1's render-depth guard along its width dimension); new storage test.
- [x] [Review][Patch] `scene.start` sat inside the demotion `try`, so a transition error would be silently mislabeled "not replayable". [HistoryScene.ts] — restructured: only `startReplay` is guarded; `scene.start` runs after.
- [x] [Review][Patch] Graceful demotion double-drew a slot+glyph over the still-present button. [HistoryScene.ts] — the catch now mutes the existing objects in place and adds only the marker (shared `notReplayableMarker` helper).
- [x] [Review][Patch] `startReplay` dropped `lastAiArchetypeId`, so a Rematch-after-replay could repeat the replayed opponent (FR25). [MatchFlow.ts:112] — documented as an accepted, deliberate gap (the archetype id isn't stored in a HistoryEntry, so it's unrecoverable; a replay isn't a "previous live match").
- [x] [Review][Dismiss] `committedSetup` shares references with the stored history entry [MatchFlow.ts] — no live defect (mirrors `commit()`'s pattern; `resolveBattle` is pure and `loadHistory()` re-parses fresh); both deep-divers concurred it's safe.
- [x] [Review][Adjacent] Story-3.0's wipeout-band sim test flaked on a load-induced 5s timeout during the gate (not a 3.2 regression — zero engine/sim changes here). Hardened with an explicit 20s timeout (the wipeout sweep is ~5× single-mode compute).

## Dev Notes

### The flow seam (exact, from the current code)

- `BattleScene.init({ flow })` → `create()` calls `this.flow.resolve()` (BattleScene.ts:148) and plays; skip/end → `scene.start('Result', { flow })` (BattleScene.ts:195). `ResultScene.create()` calls `resolve()` then `recordResult()` unconditionally (ResultScene.ts:43-48); Rematch = `startMatch()` + `scene.start('Draft', { flow })` (ResultScene.ts:99-100). Neither Battle nor Result reads `getState()` at all (only Draft/Placement/Reveal do — verified) — a replay-hydrated flow rides this ENTIRE pipeline untouched. The only new flow surface: `startReplay` + the replay flag + the no-op branch in `recordResult`.
- `resolve()` (MatchFlow.ts:180-187) requires `phase === 'committed' && committedSetup` — exactly what `startReplay` hydrates (`commit()` is 131-169; don't confuse the two). `resolveBattle` internally validates the setup, which REJECTS a stale `balanceVersion` (validate.ts:61-66) — hence validating in `startReplay` up front: fail at the tap, not mid-scene.
- `historyWritten` and the new `replay` flag both live on the flow instance; `startMatch()` (MatchFlow.ts:73-77) resets `log`/`historyWritten` — clear `replay` there too. That single line makes Rematch-from-replay a correct live match with zero extra code. Rematch's fresh seed comes from the default `cryptoSeed` source (MatchFlow.ts:12,46), and `chooseSetup` with `exclude: undefined` filters nothing (ai.ts:188) — an undefined `lastAiArchetypeId` after replay is safe.
- Hydration details: engine `Unit` is structurally identical to `DraftedUnit` and `Placement[]` assigns to `(Placement | null)[]` — the mirrors are type-clean. Set `elementsRolled` coherently (e.g. `BALANCE.armySize`) — drafting is phase-blocked anyway, but the AD-5 round-trip test serializes the field.
- **Do NOT set `historyWritten = true` as the replay mechanism** (tempting shortcut): it works today but conflates two concepts, and AD-13 names `live | replay` explicitly — reviews here flag concept-conflation. An explicit flag costs one field.

### Determinism is the feature (FR20)

Same `MatchSetup` → bit-identical `BattleLog` on any device. The stored entry carries the FULL setup (seed, mode, armies with elements, placements, balanceVersion). No log was ever stored (AD-8 forbids it) — the replay re-resolves. The Task 1 equality test (live log vs replayed log, `toEqual` on `events`) is the story's core assertion.

### UX bindings

- EXPERIENCE.md:98 + :177-179: matching entry offers **Replay**; mismatched "still displays fully but is marked non-replayable; Replay is disabled". The non-replayable marker is copy — keep it short and muted (e.g. "not replayable" near the date); add it as a constant, and pin it with a test if any numeric/rule claim appears in it (house rule).
- Speed/skip in replay come FREE: BattleScene's controls (FR23) don't know live from replay — AD-2's log-player purity paying out. Do not fork the scene.
- Tap targets ≥44px (the Replay button is full card-row height); drag-vs-tap disambiguation on every interactive element of a scrolling surface (2.3/2.4 review theme, `wasDrag()` already returned by `enableDragScroll`).
- Side colors/cards: unchanged from 3.1 apart from the width math in Task 3.

### Architecture compliance

- AD-13: `MatchFlow` stays sole engine caller (HistoryScene constructs a flow exactly like HomeScene's Play does) and sole history writer — replay never writes, enforced at the choke point, tested by byte-identical storage.
- AD-8: replay only on matching `balanceVersion`; storing/caching a `BattleLog` remains forbidden (nothing new is persisted at all).
- AD-5: `MatchState` stays plain/serializable — the replay flag is flow-internal like `historyWritten`; re-assert with the round-trip test.
- AD-2: zero BattleScene/renderer changes.
- Zero engine changes (validateMatchSetup already does the version gate).

### Testing standards summary

Vitest from the root; RED→GREEN per task; wired-flow + fakeBackend patterns from 3.1's tests; pure modules carry correctness, scenes stay smoke-free; hand-verify any expected log equality by construction (same setup), never by pasting run output. Node 24 via nvm PATH prefix; `pnpm coverage` = the CI gate.

### Previous story intelligence (3.1, same day)

- The 3.1 review's top finding was render-depth validation — `isRenderableSetup` now guards what History DRAWS, deliberately NOT `balanceVersion` (so stale entries display). `startReplay`'s `validateMatchSetup` is the DEEP gate at replay time — the two-tier validation is by design; don't "unify" them.
- `formatHistoryRow` carries machine keys (`outcome`) precisely so scenes never string-match labels — `replayable` follows the same pattern.
- PO amendment precedent: mode tag ships on the row header line; the Replay button must coexist with verdict + mode + date up top and the marker copy (stale rows) — screenshot before calling it done.
- The headless-drive harness is a ~40-line recipe, rebuilt per session (the 3.1 scripts lived in a session-scratchpad that no longer resolves): `npm i --no-save puppeteer-core` in a temp dir, `puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })`, viewport 360×640, `goto http://localhost:5173` (dev server via `pnpm --filter web dev`), seed `localStorage['lordly.v1.history']` via `page.evaluate`, reload, `mouse.click(296, 576)` opens History from Home, then click the row's Replay center (recompute from the final layout), screenshot per state. The byte-identical assertion targets `lordly.v1.history` ONLY — `lordly.v1.settings` legitimately changes if a speed button is touched mid-replay (BattleScene.ts:176).

### Project Structure Notes

- Modified: `flow/MatchFlow.ts`, `flow/historyModel.ts`, `scenes/HistoryScene.ts`, `config/constants.ts` (marker/button labels), tests (`match-flow.test.ts`, `history-model.test.ts`). No new files expected. No engine diffs.

### References

- [Source: docs/planning-artifacts/epics.md#Story-3.2] — BDD ACs (FR20/FR28/AD-8/AD-13)
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md:98,177-179] — replay offer, stale marking
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-8,AD-13] — version-gated replay, live|replay modes, never-cache-a-log
- [Source: apps/web/src/flow/MatchFlow.ts:73-77,131-169,180-187,202-210] — startMatch reset, commit, resolve, recordResult choke point
- [Source: packages/engine/src/validate.ts:52-119] — validateMatchSetup incl. the balance-version-mismatch throw
- [Source: apps/web/src/scenes/BattleScene.ts:104-160,190-196; ResultScene.ts:35-48,90-99] — the untouched replay pipeline
- [Source: apps/web/src/scenes/HistoryScene.ts] — row layout to rework (card metrics at top), wasDrag wiring
- [Source: apps/web/src/flow/historyModel.ts; test/history-model.test.ts] — the pure-row pattern to extend
- [Source: docs/implementation-artifacts/3-1-battle-history.md#Review-Findings] — two-tier validation rationale, outcome-key pattern

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

- RED→GREEN held per task: replay-mode flow (5 failing → 34 green), replayable model (in-pass with the fixture made version-tracking: `balanceVersion: BALANCE.version` instead of a hardcoded 2 — a future bump must not rot the fixture).
- `wasDrag` hoist implemented exactly as the story specified (`let` before the row loop, assigned after `enableDragScroll`; handlers close over the variable and fire post-create) — the back affordance shares the same binding.
- Full-journey headless drive: History list (green ▶ on the fresh row; muted slot + "not replayable" marker on the stale Wipeout row — layout fits at 42px cards, nothing clips) → tap Replay → Battle playing (control bar intact; incidentally shows the chirality fix: seeded mage renders back-LEFT) → Skip (214,600) → Result (Victory! banner, Rematch/Home) → `lordly.v1.history` **byte-identical** across the entire journey.

### Completion Notes List

- **AC1 ✅** `startReplay(setup)` validates via the engine (`validateMatchSetup` — stale version throws) then hydrates straight to committed; the untouched Battle→Result pipeline replays with full presentation + speed/skip. FR20 equality test: replayed `events` deep-equal the original live log's.
- **AC2 ✅** Explicit AD-13 `replay` flag (deliberately separate from `historyWritten`); `recordResult()` no-ops in replay — byte-identical storage proven by unit test AND the drive; `startMatch()` clears the flag, so Rematch-after-replay is a live match with a fresh seed that records normally (tested).
- **AC3 ✅** `HistoryRow.replayable` (machine key, version comparison in the pure model); stale rows render fully with a muted disabled slot + `not replayable` marker; render-valid-but-replay-invalid entries demote gracefully at the tap (try/catch) instead of crashing — the 3.1 two-tier validation honored end to end.
- **Zero engine changes; zero ResultScene changes** — the 3.1 choke point absorbed the entire feature.
- 342 tests green (6 new), typecheck + lint clean, engine coverage gate untouched.
- **On-device ✅** Danilo on prod (2026-07-15, build eb24f64 with all review patches): "everything works as expected in prod."

### File List

- `apps/web/src/flow/MatchFlow.ts` — MODIFIED: `startReplay`, AD-13 replay flag, `recordResult` no-op branch, `startMatch` clears the flag
- `apps/web/src/flow/historyModel.ts` — MODIFIED: `HistoryRow.replayable` (BALANCE.version comparison)
- `apps/web/src/scenes/HistoryScene.ts` — MODIFIED: card metrics 42/2/12, Replay button (drag-guarded, graceful demotion), non-replayable slot + marker, `wasDrag` hoist
- `apps/web/src/config/constants.ts` — MODIFIED: `HISTORY_REPLAY_LABEL`, `HISTORY_NOT_REPLAYABLE_LABEL`
- `apps/web/test/match-flow.test.ts` — MODIFIED: 5 replay-mode tests (FR20 equality, byte-identical, rematch-flip, hydration round-trip, stale throw)
- `apps/web/test/history-model.test.ts` — MODIFIED: replayable test + version-tracking fixture
- `docs/implementation-artifacts/sprint-status.yaml`, this story file — MODIFIED: tracking

### Change Log

- 2026-07-15: Story 3.2 implemented — replay mode lands on MatchFlow through the 3.1 choke point (validate → hydrate → the untouched pipeline replays; replays never write; Rematch flips live automatically), version-gated Replay affordance with the measured card-shrink layout, graceful demotion for two-tier-validation stragglers. RED→GREEN per task; 342 tests; full replay journey screenshot-verified with byte-identical storage. Pending: on-device check post-review.
