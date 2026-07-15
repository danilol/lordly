---
baseline_commit: 1e86c3fd9c5994b8f5dd4a53eabf0752c2957599
---

# Story 3.1: Battle history

Status: done

## Story

As a player,
I want my last ten matches remembered on my phone,
so that I can see what I played and how it went.

## Acceptance Criteria

1. **Exactly one write per live match (FR28, AD-8, AD-13).** When a live match's `BattleEnded` lands, `MatchFlow` writes exactly one `HistoryEntry` — the full `MatchSetup` (which carries seed and `balanceVersion`), winner (`'A' | 'B' | 'draw'`), ISO date — through the `web/storage` gateway under the `lordly.v1.*` history key. Rematches write their own entry; a scene restart or double navigation never duplicates one.
2. **Ten most recent, oldest evicted first.** The stored list never exceeds 10 entries.
3. **No `BattleLog` is ever stored or cached (AD-8).** The entry shape makes it impossible; replay (story 3.2) will re-resolve from the setup.
4. **History screen from Home (FR28).** A History scene in the AD-5 FSM, reachable from a Home spur, lists each match's date, winner, and both compositions with class sprites and elements; `‹ Home` affordance; empty state shows exactly "No battles yet — play your first match." with a way back.
5. **Resilience (AD-8).** Entries from an unknown or older storage namespace are ignored, never migrated or crashed on; corrupt/wrong-shape stored data degrades to an empty (or partial) list, never a throw.

## Tasks / Subtasks

- [x] Task 1: Storage gateway grows history (AC: 1, 2, 3, 5) — RED first
  - [x] `apps/web/src/flow/storage.ts`: `HISTORY_KEY = 'lordly.v1.history'`; `HistoryEntry { setup: MatchSetup; winner: 'A' | 'B' | 'draw'; date: string }` (exactly the AD-8 shape — no log field, no hpPct); `loadHistory(): HistoryEntry[]` and `appendHistory(entry: HistoryEntry): void` on the `WebStorage` interface
  - [x] Eviction inside `appendHistory`: newest-first order recommended (display order = storage order), slice to 10
  - [x] Resilience mirrors `loadSettings`: corrupt JSON / non-array / throwing backend → `[]`; per-entry shape validation drops invalid entries instead of crashing (entry must have object `setup`, valid `winner` literal, string `date`); `saveSettings`-style silent catch on write
  - [x] Tests in `apps/web/test/storage.test.ts` using the existing Map-backed `fakeBackend`: round-trip, 11th-entry eviction (oldest gone, order kept), corrupt JSON → [], invalid entries dropped, `lordly.v0.*`/foreign keys never read or touched
- [x] Task 2: MatchFlow is the sole writer (AC: 1, 3) — RED first
  - [x] `MatchFlow` constructor gains injectable `storage: WebStorage` (default `createStorage()`) and `clock: () => string` (default `() => new Date().toISOString()`) alongside the existing `seedSource` — the flow stays unit-testable with fakes, same pattern as `SeedSource`
  - [x] New idempotent `recordResult(): void`: requires the resolved log (throw if not resolved — same guard style as `resolve()`); reads winner from the final `BattleEnded` event; builds the entry from `state.committedSetup`; writes via `appendHistory` ONCE per match — a private `historyWritten` flag (on the flow, NOT on `MatchState` — the state's JSON-serializability test must stay untouched), reset in `startMatch()`
  - [x] Story-3.2 seam (design note, no behavior yet): `recordResult` is the single choke point a future `replay` mode bypasses — keep it the only path to `appendHistory`
  - [x] Tests in `apps/web/test/match-flow.test.ts` (pinned seed pattern already in that file): exactly-once under double `recordResult()`, reset across `startMatch()` (rematch writes a second entry), throw before resolve, entry content matches the committed setup + injected clock
- [x] Task 3: ResultScene triggers the write (AC: 1)
  - [x] `ResultScene.create()` calls `this.flow.recordResult()` right after `this.flow.resolve()` (~line 43) — idempotence makes the Phaser singleton-scene restart trap harmless, but still verify: replaying the SAME match through Result twice writes once
  - [x] No other scene WRITES history; grep-verifiable: `appendHistory` has exactly two callers — MatchFlow and tests (reads via `loadHistory` are open — HistoryScene reads directly)
- [x] Task 4: History scene + Home spur (AC: 4, 5)
  - [x] `apps/web/src/scenes/HistoryScene.ts`, registered in `main.ts`'s scene array (History IS in AD-5's closed nine-scene list — this is filling a planned slot, not extending the FSM)
  - [x] Home spur: `HOME_HISTORY_LABEL = 'History'` in constants; **layout rework required** — `spurButton` (HomeScene:90-101) hardcodes a 2-button row (`2 * MODE_BUTTON_WIDTH + MODE_BUTTON_GAP`); make it a 3-across row (recompute width from count) while holding button height ≥ 44px tap target (epic-2 review theme — do not shrink height to fit)
  - [x] Each row: date (via a pure formatter — see Task 5), winner from side A's perspective (**you are always side A** — AD-11; blue=you / red=enemy side colors are BINDING per DESIGN.md), both compositions rendered with the existing `addUnitSprite` + `addElementBadge` helpers (ui.ts:78-92) — compact unit cards use the 3-letter code + 12px dot treatment (DESIGN.md `{components.unit-card}`); this story is the sanctioned moment to land History's cards dot-only per the deferred-work normalization note
  - [x] Scroll: 10 rows will overflow 640px — reuse `enableDragScroll` (ui.ts:125, shipped in the 2.4 review with Credits); clamped bounds. **Phaser 4 quirk (memorized, screenshot-confirmed in 2.4): GeometryMask silently fails to clip scroll containers** — do NOT reach for a mask; copy the shipped workaround verbatim: an opaque header strip at depth 10 covering the top band, back affordance at depth 11 (HelpScene.ts:48-60, CreditsScene.ts:63-71)
  - [x] Back affordance: use `addBackAffordance(label, cb, 11)` with the `wasDrag()` guard — the Help/Credits scrollable-scene pattern — NOT `addHomeBack`, which has no depth param and no drag guard (its bare pointerup would re-introduce the 2.4 review bug: a drag releasing over ‹ Back ejects the reader mid-scroll; ui.ts:122-123 documents this)
  - [x] Empty state: exact string "No battles yet — play your first match." (EXPERIENCE.md pins the copy) + tappable route back to Home/Play
  - [x] **Reading history:** HistoryScene is entered from Home with NO `MatchFlow` in existence (Home constructs a flow only on Play — HomeScene.ts:70) — the scene instantiates its own gateway and reads directly: `createStorage().loadHistory()`, the BattleScene.ts:76 precedent. AD-13's sole-writer rule constrains WRITES only; reads via the gateway are open to scenes
  - [x] Singleton-scene discipline: ALL transient fields reset in `create()` (team agreement; 2.2 review lesson) — including the drag-scroll teardown if it registers scene-level listeners
- [x] Task 5: Pure display model (AC: 4) — the testable-logic pattern
  - [x] A small pure module (e.g. `apps/web/src/flow/historyModel.ts`, like `rulesDoc.ts`/`credits.ts`): `formatHistoryRow(entry) → { dateLabel, verdictLabel, yourComp, enemyComp }` — date formatting (keep it simple and deterministic: e.g. `YYYY-MM-DD HH:MM` from the ISO string, no locale APIs — `toLocaleString` varies by device and breaks test determinism), verdict wording **reusing the existing Result banner constants** (`RESULT_WIN_LABEL = 'Victory!'` etc., constants.ts:98-100 — import them, don't restate literals; a hand-typed "Victory" without the bang would silently diverge from the banner), compositions as `{ class, element }[]` per side
  - [x] Unit tests for the formatter incl. a draw and a malformed-date passthrough
- [x] Task 6: Gate + device verification (all ACs)
  - [x] Full gate green (typecheck, lint, all tests, engine coverage untouched at ≥90%)
  - [x] Drive it: headless Chrome drive of the REAL app, screenshot-verified (empty state exact copy; 7-entry list with win/loss/draw colors, side-colored cards, dots, dates; drag-scroll under the header strip; ‹ Home returns to the 3-across spur row). Eviction + rematch-writes-twice covered by seeded-backend unit tests; the live write path (ResultScene → recordResult) is unit-tested and compile-checked — full live-match E2E lands with the device check
  - [x] **On-device check ACCEPTED (2026-07-15, Danilo on prod):** "it's great now. I consider it done." — entry appears with verdict, mode tag, and both comps. STORY DONE.

## Review Findings

Three-layer adversarial review (2026-07-15, Opus 4.8 reviewers), triaged. Two hunters independently converged on the top finding; auditor + blind hunter on the second. All ACs (1–5) verified genuinely satisfied; engine untouched; AC6 correctly deferred. Two patches applied, one dismissed.

- [x] [Review][Patch] Storage guard validated only one level deep — a structurally-broken `setup` (object, but no `armies`) passed `isHistoryEntry` and then threw in `formatHistoryRow` mid-render, aborting the whole History scene before the back affordance attached (user stranded). [apps/web/src/flow/storage.ts:39] — deepened to `isRenderableSetup`: both armies must be arrays of units with known class + element (AD-4 sets). Also closes the unknown-class/element garbage-card and >3-unit overflow variants (same root cause). Deliberately does NOT gate on `balanceVersion` — a stale entry must still DISPLAY (story 3.2), pinned by a new test; the "one bad record drops, list survives" contract now has render-depth coverage.
- [x] [Review][Patch] Verdict COLOR string-matched the banner label literals (`verdictLabel === 'Draw'/'Defeat'`), fragile drift that fails toward blue "win" if a constant is renamed. [apps/web/src/scenes/HistoryScene.ts:88] — `formatHistoryRow` now carries a machine `outcome: 'win'|'loss'|'draw'`; the scene keys color off that, fully decoupled from copy. New formatter test pins it.
- [x] [Review][Dismiss] `recordResult` casts `log.events[last] as BattleEnded` unchecked [MatchFlow.ts:207] — engine-contract-guaranteed (a resolved log always ends in BattleEnded; `resolve()` makes the identical cast). Not reachable; matches the established pattern.

## Dev Notes

### Where the write goes (the exact seam)

- `MatchFlow.resolve()` (`MatchFlow.ts:159-166`) caches the log; `ResultScene.create()` (`ResultScene.ts:43-45`) already does `const log = this.flow.resolve()` and reads the final `BattleEnded`. The write hook is a new `recordResult()` called from ResultScene right there — EXPERIENCE.md:175 pins this: "On a live match this [Result] is where the single HistoryEntry gets written (AD-13); replays write nothing."
- **Why not write inside `resolve()`:** BattleScene and RevealScene also call `resolve()` (RevealScene.ts:72, BattleScene.ts:148) — writing there would triple-fire or record matches the player skipped out of before the verdict. `recordResult()` keeps the write at the verdict moment with one caller.
- `MatchFlow` currently has NO storage dependency and is "Phaser-free and DOM-free apart from the injected seed source" (MatchFlow.ts:12-19). Keep that property: inject storage + clock with working defaults, exactly like `seedSource`/`cryptoSeed` (MatchFlow.ts:6-10). `new Date().toISOString()` lives in the default clock only — never inline in flow logic (test determinism).
- `historyWritten` goes on the MatchFlow instance, not `MatchState`: `MatchState` has a JSON-serializability test and a documented "plain data only" contract (MatchState.ts:16-31). `startMatch()` (MatchFlow.ts:53-56) already resets per-match flow state (`this.log = undefined`) — reset the flag there too.

### Storage gateway facts (story 2.3's module — extend, don't fork)

- `apps/web/src/flow/storage.ts` — note the path: it lives in `flow/`, not a `storage/` directory. One key today: `SETTINGS_KEY = 'lordly.v1.settings'`. The gateway contract (storage.ts:4-17): sole localStorage toucher, never throws (missing/corrupt/throwing backend → defaults), unknown namespaces ignored, injectable `StorageBackend` (`Pick<Storage, 'getItem' | 'setItem'>`) so tests run in node without jsdom.
- Follow `loadSettings`' resilience shape exactly (storage.ts:53-66): try/catch around the whole read, `JSON.parse` result type-checked before use, sane default on any failure. For history add per-entry validation — one corrupt entry drops that entry, not the list.
- `BattleScene` instantiates its own gateway (`private readonly storage = createStorage()`, BattleScene.ts:76) — that stays for settings; MatchFlow gets its OWN injected instance for history. Two instances over the same backend are fine (stateless reads/writes), and AD-8's "sole writer" refers to the module, not one object.
- Test fake: `fakeBackend` Map wrapper in storage.test.ts:5-12 — reuse it.

### HistoryEntry shape is pinned by the spine — resist enrichment

AD-8 (architecture spine): "A `HistoryEntry` stores the full `MatchSetup` (which includes seed and `balanceVersion`), winner (`'A' | 'B' | 'draw'`), and ISO date." Do NOT add hpPct, log excerpts, or archetype ids — anything the History/Replay screens need beyond this is re-derivable via determinism (FR20), and storing a `BattleLog` is explicitly forbidden. The Result screen's HP% is NOT shown in the history list (FR28 asks date/winner/compositions only).

### UX bindings (DESIGN.md / EXPERIENCE.md — the spec is a contract)

- History screen spec (EXPERIENCE.md:177-179): last 10, each row = date + winner + both comps with sprites and elements; empty state EXACT copy "No battles yet — play your first match."; unknown-namespace entries ignored. The Replay button and non-replayable marking belong to STORY 3.2 — do not build them here, but don't paint the row layout into a corner that can't fit a Replay affordance on the right.
- Side identity: you are ALWAYS side A in vs-AI (AD-11); unit cards carry a side-colored border — `blue-you` / `red-enemy`, never gold (DESIGN.md:208). The blue=you rule has already caught one scoping shortcut this project — treat it as law.
- Compact unit cards: 3-letter class code (weight 800) + 12px element dot, 15px label floor, MIN_FONT_PX 10 hard floor (DESIGN.md:174,208). `addUnitSprite`/`addElementBadge` (ui.ts:78-92) already implement the shared treatments — History must NOT introduce a new badge shape (the 2.1 deferred-work normalization designates History's cards as dot-only).
- Tap targets ≥ 44px (epic-2 review theme — it was patched twice; don't reintroduce).
- Home hub spec (EXPERIENCE.md:152): Home gains the History entry alongside Help/Credits (Settings is NOT this story — its realization is still an open UX call).

### Architecture compliance

- AD-5: History is in the closed nine-scene FSM list — register in `main.ts:42`'s array. No new scenes beyond it.
- AD-13: MatchFlow = sole engine caller AND sole history writer; scenes render `getState()` and call flow methods. The write is exactly-once per live match; replay-mode never-writes is 3.2's job but the choke point ships here.
- AD-11: owner-local everywhere; entries store the `MatchSetup` verbatim — no side flipping, no coordinate transforms in storage. Rendering maps side A → "you" at display time only.
- AD-8: versioned key `lordly.v1.history`; no migration logic; `balanceVersion` rides inside the stored `MatchSetup` (currently 2 after story 3.0) — replay gating against it is 3.2.
- Zero engine changes. Zero `packages/engine` diffs expected in this story.

### Testing standards summary

Vitest 4.1.x from the repo root (`pnpm vitest run apps/web`, full gate `pnpm coverage`). Web-package pattern: pure logic modules get real unit tests (storage, match-flow, historyModel); scenes get smoke-level coverage only — the flow/model carries correctness (spine test convention). No jsdom for the gateway (injected backend). Node 24 via nvm PATH prefix. RED→GREEN: write Task 1/2 tests first against the not-yet-existing API.

### Previous story intelligence (3-0, same day)

- Balance v2 shipped: `BALANCE.version === 2`; entries recorded now carry `balanceVersion: 2`. Story 3-0 is still awaiting Danilo's on-device felt-balance sign-off — if it fails and a v3 retune lands, any v2 entries become non-replayable in 3.2 (accepted: no release, staleness explicitly a non-issue per the 2026-07-14 correct-course).
- House style enforced in review: executable guards for player-facing numbers, no silent coercion, hand-verified expectations (never blind-update). The 3-0 review also showed the singleton-scene and 44px-target themes remain active watch items.
- `pnpm --filter web dev` for the local drive; prod deploys on every main push (CI `ci` check + deploy job).

### Project Structure Notes

- New files: `apps/web/src/scenes/HistoryScene.ts`, `apps/web/src/flow/historyModel.ts`, `apps/web/test/history-model.test.ts` (or fold into an existing pattern-consistent name). Modified: `flow/storage.ts`, `flow/MatchFlow.ts`, `scenes/ResultScene.ts`, `scenes/HomeScene.ts`, `config/constants.ts`, `main.ts`, `test/storage.test.ts`, `test/match-flow.test.ts`.
- No conflicts with the spine's structural seed; `flow/storage.ts` path is the established (if spine-divergent) home of the gateway — do not relocate it in this story.

### References

- [Source: docs/planning-artifacts/epics.md#Story-3.1] — BDD ACs (FR28, AD-8, AD-13)
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-8,AD-11,AD-13] — HistoryEntry shape, sole-writer, owner-local
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md:34-46,89-98,152,175-179] — Home spur, empty/stale states, History spec, write-at-Result
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md:121,174,208] — element badge consistency, type floors, side-colored unit cards
- [Source: apps/web/src/flow/storage.ts:1-75] — gateway contract + resilience pattern to mirror
- [Source: apps/web/src/flow/MatchFlow.ts:6-56,110-166] — injection pattern, startMatch reset, resolve idempotence
- [Source: apps/web/src/flow/MatchState.ts:16-31] — serializability contract (keep the flag off the state)
- [Source: apps/web/src/scenes/ResultScene.ts:43-45,95-99] — the write call site; rematch path
- [Source: apps/web/src/scenes/HomeScene.ts:82-101] — spur row layout to rework for 3 buttons
- [Source: apps/web/src/config/ui.ts:78-125] — addUnitSprite, addElementBadge, addBackAffordance (+ wasDrag guard), enableDragScroll
- [Source: apps/web/src/scenes/HelpScene.ts:25-60; CreditsScene.ts:63-71] — the scrollable-scene pattern to copy: opaque header strip depth 10, back affordance depth 11, GeometryMask avoided (silent-fail quirk)
- [Source: apps/web/src/config/constants.ts:98-100] — RESULT_WIN_LABEL and banner vocabulary to reuse in the formatter
- [Source: apps/web/test/storage.test.ts:1-30] — fakeBackend test pattern
- [Source: docs/implementation-artifacts/deferred-work.md] — element-badge dot-only normalization (History designated), 2.2 StatusCleared note (NOT this story)

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

- RED→GREEN held per task: storage (10 failing → 19 green), recordResult (6 failing → 29 green), formatter (module-not-found → 5 green). All existing tests stayed green throughout.
- Found and used the canonical `CLASS_ABBREVIATIONS` map + `CARD_CLASS_FONT_PX` (constants.ts:72-80) instead of a reinvented `slice(0,3).toUpperCase()` — the map is AD-4-keyed (a new class is a compile error, never a missing label); all six current codes coincidentally matched, which is exactly how drift ships.
- Home spur 3-across: new `SPUR_COUNT`/`SPUR_BUTTON_WIDTH = 104` (3×104 + 2×12 = 336 ≤ 360); height stays `MODE_BUTTON_HEIGHT = 44` (the tap-target floor). Mode toggle untouched.
- Headless-drive harness (puppeteer-core over system Chrome, 360×640 viewport, scratchpad script): seeded `lordly.v1.history` via localStorage, drove Home → History, screenshot-verified all four states (empty, populated ×7, drag-scrolled, back-to-Home). The 2.4 scroll pattern (header strip depth 10 + affordance depth 11) held — no GeometryMask anywhere.
- Prettier caught 2 files on the gate pass; fixed.

### Completion Notes List

- **AC1 ✅** `MatchFlow.recordResult()` — idempotent once-per-match guard on the flow (NOT MatchState — serializability test untouched and re-asserted post-write); injectable `storage` + `clock` alongside `seedSource`; ResultScene calls it at the verdict moment; grep-verified: `appendHistory` has exactly one production caller (MatchFlow.ts:208).
- **AC2 ✅** `HISTORY_LIMIT = 10`, newest-first, 11th append evicts oldest — unit-tested.
- **AC3 ✅** `HistoryEntry { setup, winner, date }` — the exact AD-8 shape, no log field, no derived extras.
- **AC4 ✅** HistoryScene (fills AD-5's planned slot, registered in main.ts): rows = verdict (Result banner vocabulary + win/lose/draw colors) + `YYYY-MM-DD HH:MM` date + both comps as DESIGN compact unit-cards (blue=you / red=enemy borders + 15% wash, 32px sprite, canonical 3-letter code, 12px element dot — History's cards land dot-only per the deferred-work normalization); drag-scroll with the Help/Credits header-strip pattern; drag-guarded `‹ Home`; exact EXPERIENCE.md empty-state copy (pinned by test); right edge left free for 3.2's Replay.
- **AC5 ✅** loadHistory: corrupt/non-array → [], per-entry validation drops bad records keeping good ones, appendHistory recovers over corrupt prior data, foreign/older namespaces never read or touched, throwing/missing backend safe — all unit-tested.
- **AC6 (device) ✅** Deployed (c887cdc, CI green); Danilo's on-device acceptance 2026-07-15: "it's great now. I consider it done."
- 332 tests green (23 new), typecheck + lint clean, engine untouched (coverage gate unaffected).

### File List

- `apps/web/src/flow/storage.ts` — MODIFIED: HISTORY_KEY/HISTORY_LIMIT, HistoryEntry, loadHistory/appendHistory + per-entry validation
- `apps/web/src/flow/MatchFlow.ts` — MODIFIED: injectable storage+clock, idempotent recordResult(), startMatch re-arm
- `apps/web/src/flow/historyModel.ts` — NEW: pure formatHistoryRow (date, verdict via banner constants, comps)
- `apps/web/src/scenes/HistoryScene.ts` — NEW: the FR28 screen (scroll pattern, compact side-colored unit cards, empty state)
- `apps/web/src/scenes/ResultScene.ts` — MODIFIED: recordResult() at the verdict moment
- `apps/web/src/scenes/HomeScene.ts` — MODIFIED: 3-across spur row + History spur
- `apps/web/src/config/constants.ts` — MODIFIED: HISTORY_* labels, SPUR_COUNT/SPUR_BUTTON_WIDTH
- `apps/web/src/main.ts` — MODIFIED: HistoryScene registered in the FSM
- `apps/web/test/storage.test.ts` — MODIFIED: 10 history gateway tests
- `apps/web/test/match-flow.test.ts` — MODIFIED: 6 recordResult tests
- `apps/web/test/history-model.test.ts` — NEW: 5 formatter tests (incl. the pinned empty-state copy)
- `docs/implementation-artifacts/sprint-status.yaml`, this story file — MODIFIED: tracking

### Change Log

- 2026-07-15 (PO amendment, during review): history rows now show the battle MODE (Standard/Wipeout) — display-only, read from the already-stored `setup.mode`, rendered via the Home toggle's own label constants; resilient (odd stored mode reads Standard). Danilo's companion ask (opponent type vs AI/PvP) deferred to the link-play epic with the "absent = AI" backfill guarantee — see deferred-work.md. EXPERIENCE.md History spec updated accordingly.
- 2026-07-15: Story 3.1 implemented — history gateway (lordly.v1.history, cap 10, AD-8 resilience), MatchFlow sole-writer recordResult (idempotent, injectable clock/storage), HistoryScene with DESIGN compact cards + Help/Credits scroll pattern, Home 3-across spurs. RED→GREEN per task; 332 tests green; headless-Chrome screenshot verification of all screen states. Pending: on-device confirmation post-review.
