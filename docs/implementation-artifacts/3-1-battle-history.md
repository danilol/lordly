# Story 3.1: Battle history

Status: ready-for-dev

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

- [ ] Task 1: Storage gateway grows history (AC: 1, 2, 3, 5) — RED first
  - [ ] `apps/web/src/flow/storage.ts`: `HISTORY_KEY = 'lordly.v1.history'`; `HistoryEntry { setup: MatchSetup; winner: 'A' | 'B' | 'draw'; date: string }` (exactly the AD-8 shape — no log field, no hpPct); `loadHistory(): HistoryEntry[]` and `appendHistory(entry: HistoryEntry): void` on the `WebStorage` interface
  - [ ] Eviction inside `appendHistory`: newest-first order recommended (display order = storage order), slice to 10
  - [ ] Resilience mirrors `loadSettings`: corrupt JSON / non-array / throwing backend → `[]`; per-entry shape validation drops invalid entries instead of crashing (entry must have object `setup`, valid `winner` literal, string `date`); `saveSettings`-style silent catch on write
  - [ ] Tests in `apps/web/test/storage.test.ts` using the existing Map-backed `fakeBackend`: round-trip, 11th-entry eviction (oldest gone, order kept), corrupt JSON → [], invalid entries dropped, `lordly.v0.*`/foreign keys never read or touched
- [ ] Task 2: MatchFlow is the sole writer (AC: 1, 3) — RED first
  - [ ] `MatchFlow` constructor gains injectable `storage: WebStorage` (default `createStorage()`) and `clock: () => string` (default `() => new Date().toISOString()`) alongside the existing `seedSource` — the flow stays unit-testable with fakes, same pattern as `SeedSource`
  - [ ] New idempotent `recordResult(): void`: requires the resolved log (throw if not resolved — same guard style as `resolve()`); reads winner from the final `BattleEnded` event; builds the entry from `state.committedSetup`; writes via `appendHistory` ONCE per match — a private `historyWritten` flag (on the flow, NOT on `MatchState` — the state's JSON-serializability test must stay untouched), reset in `startMatch()`
  - [ ] Story-3.2 seam (design note, no behavior yet): `recordResult` is the single choke point a future `replay` mode bypasses — keep it the only path to `appendHistory`
  - [ ] Tests in `apps/web/test/match-flow.test.ts` (pinned seed pattern already in that file): exactly-once under double `recordResult()`, reset across `startMatch()` (rematch writes a second entry), throw before resolve, entry content matches the committed setup + injected clock
- [ ] Task 3: ResultScene triggers the write (AC: 1)
  - [ ] `ResultScene.create()` calls `this.flow.recordResult()` right after `this.flow.resolve()` (~line 43) — idempotence makes the Phaser singleton-scene restart trap harmless, but still verify: replaying the SAME match through Result twice writes once
  - [ ] No other scene WRITES history; grep-verifiable: `appendHistory` has exactly two callers — MatchFlow and tests (reads via `loadHistory` are open — HistoryScene reads directly)
- [ ] Task 4: History scene + Home spur (AC: 4, 5)
  - [ ] `apps/web/src/scenes/HistoryScene.ts`, registered in `main.ts`'s scene array (History IS in AD-5's closed nine-scene list — this is filling a planned slot, not extending the FSM)
  - [ ] Home spur: `HOME_HISTORY_LABEL = 'History'` in constants; **layout rework required** — `spurButton` (HomeScene:90-101) hardcodes a 2-button row (`2 * MODE_BUTTON_WIDTH + MODE_BUTTON_GAP`); make it a 3-across row (recompute width from count) while holding button height ≥ 44px tap target (epic-2 review theme — do not shrink height to fit)
  - [ ] Each row: date (via a pure formatter — see Task 5), winner from side A's perspective (**you are always side A** — AD-11; blue=you / red=enemy side colors are BINDING per DESIGN.md), both compositions rendered with the existing `addUnitSprite` + `addElementBadge` helpers (ui.ts:78-92) — compact unit cards use the 3-letter code + 12px dot treatment (DESIGN.md `{components.unit-card}`); this story is the sanctioned moment to land History's cards dot-only per the deferred-work normalization note
  - [ ] Scroll: 10 rows will overflow 640px — reuse `enableDragScroll` (ui.ts:125, shipped in the 2.4 review with Credits); clamped bounds. **Phaser 4 quirk (memorized, screenshot-confirmed in 2.4): GeometryMask silently fails to clip scroll containers** — do NOT reach for a mask; copy the shipped workaround verbatim: an opaque header strip at depth 10 covering the top band, back affordance at depth 11 (HelpScene.ts:48-60, CreditsScene.ts:63-71)
  - [ ] Back affordance: use `addBackAffordance(label, cb, 11)` with the `wasDrag()` guard — the Help/Credits scrollable-scene pattern — NOT `addHomeBack`, which has no depth param and no drag guard (its bare pointerup would re-introduce the 2.4 review bug: a drag releasing over ‹ Back ejects the reader mid-scroll; ui.ts:122-123 documents this)
  - [ ] Empty state: exact string "No battles yet — play your first match." (EXPERIENCE.md pins the copy) + tappable route back to Home/Play
  - [ ] **Reading history:** HistoryScene is entered from Home with NO `MatchFlow` in existence (Home constructs a flow only on Play — HomeScene.ts:70) — the scene instantiates its own gateway and reads directly: `createStorage().loadHistory()`, the BattleScene.ts:76 precedent. AD-13's sole-writer rule constrains WRITES only; reads via the gateway are open to scenes
  - [ ] Singleton-scene discipline: ALL transient fields reset in `create()` (team agreement; 2.2 review lesson) — including the drag-scroll teardown if it registers scene-level listeners
- [ ] Task 5: Pure display model (AC: 4) — the testable-logic pattern
  - [ ] A small pure module (e.g. `apps/web/src/flow/historyModel.ts`, like `rulesDoc.ts`/`credits.ts`): `formatHistoryRow(entry) → { dateLabel, verdictLabel, yourComp, enemyComp }` — date formatting (keep it simple and deterministic: e.g. `YYYY-MM-DD HH:MM` from the ISO string, no locale APIs — `toLocaleString` varies by device and breaks test determinism), verdict wording **reusing the existing Result banner constants** (`RESULT_WIN_LABEL = 'Victory!'` etc., constants.ts:98-100 — import them, don't restate literals; a hand-typed "Victory" without the bang would silently diverge from the banner), compositions as `{ class, element }[]` per side
  - [ ] Unit tests for the formatter incl. a draw and a malformed-date passthrough
- [ ] Task 6: Gate + device verification (all ACs)
  - [ ] Full gate green (typecheck, lint, all tests, engine coverage untouched at ≥90%)
  - [ ] Drive it: play a match → History shows the entry; rematch → two entries; 11 matches → oldest evicted (fabricate via a seeded backend in a test rather than 11 manual plays; on device just verify a couple)
  - [ ] On-device check rides the story-3.0 sign-off session: same deploy, Danilo confirms History renders on his phone

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

### Debug Log References

### Completion Notes List

### File List
