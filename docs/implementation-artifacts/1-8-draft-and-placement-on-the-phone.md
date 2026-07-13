---
baseline_commit: 49808cfeb07db375637b2df9620521e0d781b0c1
---

# Story 1.8: Draft and placement on the phone

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to draft three units, see their elements, and secretly place them on my grid by touch,
so that all my strategic decisions are made and locked in.

## Acceptance Criteria

1. **Given** the Home scene's now-enabled "Play vs AI", **when** I enter the Draft scene, **then** six class cards show name, sprite placeholder, and compact rules card (role, RPS relation, per-row behavior — FR2), **and** tapping adds a unit (duplicates allowed) up to exactly 3, each instantly showing its element rolled once via the engine's roll function on my `elements/A` stream (FR1, FR3, AD-9).
2. **Given** a drafted unit, **when** I remove it from my army, **then** the unit and its element are discarded; the element stream is **forward-only** — re-adding any unit draws the *next* value from `elements/A`, never rewinding or reusing a discarded roll (AD-10 determinism preserved).
3. **Given** my drafted army, **when** I place units on the Placement scene, **then** I drag each onto any empty cell of my 3×3 grid (portrait, touch-native, ~360×640 up — FR4, FR30) and can rearrange freely, **and** dropping onto an occupied cell swaps the two units; releasing a drag outside the grid returns the unit to where it came from (its previous cell or the unplaced tray) — no drop is ever lost or produces an illegal board.
4. **Given** fewer than 3 units are placed, **when** I look at the submit control, **then** it is visibly disabled with a "place all 3 units" affordance, and becomes enabled exactly when the third unit lands.
5. **Given** I submit, **when** the AI commits, **then** its setup comes from Story 1.7's module without any access to my choices (FR5, FR24), and nothing of the AI's board renders before the Reveal.
6. **Given** the whole flow, **when** state moves between scenes, **then** a single serializable `MatchState` owned by `MatchFlow` is passed explicitly — no Phaser-registry state, no scene-local copies (AD-5, AD-13), with a fresh `crypto.getRandomValues` seed per match, rematches included (AD-10).

## Tasks / Subtasks

- [x] Task 1: `MatchState` + `MatchFlow` — the serializable state and its sole owner (AC: 6, AD-5/AD-13)
  - [x] New `apps/web/src/flow/MatchState.ts`: a PLAIN, JSON-serializable interface (AD-5) — `{ seed: number; playerArmy: DraftedUnit[]; playerPlacements: (Placement|null)[]; elementsRolled: number; phase: MatchPhase; committedSetup?: MatchSetup; lastAiArchetypeId?: string }`. `DraftedUnit = { class: UnitClass; element: Element }`. NO live RNG `Stream`, NO Phaser object, NO function may live in `MatchState` — it must survive `JSON.parse(JSON.stringify(state))` unchanged (assert this in a test). `MatchPhase = 'draft' | 'placement' | 'committed'`
  - [x] SPEC DECISION (record): the forward-only element stream (AC2) is reconciled with AD-5's serializability by storing a monotonic **`elementsRolled` counter** in `MatchState`, NOT the live `Stream`. To roll the next element, `MatchFlow` calls `createStreams(seed)`, advances `elements/A` exactly `elementsRolled` times, draws once via `rollElement`, then increments the counter. Re-adding after a remove therefore always draws the NEXT never-seen value (removes don't decrement) — forward-only by construction, and fully reconstructible from `(seed, elementsRolled)` alone. Document the fast-forward cost is trivial (≤ a few draws per draft)
  - [x] New `apps/web/src/flow/MatchFlow.ts`: the controller that OWNS the `MatchState` and is the sole caller of the engine's AI module (AD-13). Pure-ish orchestration methods, Phaser-free and DOM-free EXCEPT the injected seed source: `startMatch(seed?)`, `draftUnit(class) → DraftedUnit` (rolls element, appends), `removeUnit(index)`, `placeUnit(unitIndex, cell)` / grid ops (or delegate to Task 3's model), `commit() → MatchSetup` (assembles + AI commit + validates), `getState()`. Seed comes from an injected `() => number` (default wraps `crypto.getRandomValues`) so tests pass a fixed seed — the ONE effectful dependency, isolated
  - [x] Unit tests (pure, node-env — NO Phaser, NO DOM; see Testing Constraints): `MatchState` round-trips through `JSON.stringify`/`parse` unchanged; `MatchFlow` with a fixed injected seed drafts deterministically; forward-only proven — draft 3, remove #2, re-add → the re-added element equals the 4th value of a fresh `elements/A` at that seed (never the discarded 2nd)
- [x] Task 2: Draft scene + the DraftModel (AC: 1, 2)
  - [x] New `apps/web/src/scenes/DraftScene.ts` (Phaser, thin renderer) registered in `main.ts`'s scene list; Home's "Play vs AI" enabled to start a match (via `MatchFlow.startMatch()`) and transition to Draft, passing `MatchFlow` explicitly through `scene.start('Draft', { flow })` — NOT the Phaser registry (AD-5)
  - [x] Six class cards (one per `ALL_CLASSES`) each showing: class name, a sprite PLACEHOLDER (colored rect + class initial/label — real sprites are story 2.1, scope fence), and a compact rules card. Rules-card CONTENT derives from engine data where it exists — `BALANCE.classes[c]` (per-row action counts, key stats) and `BALANCE.rpsBeats` (RPS relation) — plus short static role/behavior text keyed by class; do NOT hardcode stat numbers that live in `BALANCE` (the confusionMisfire lesson: data the UI shows must be READ from the data)
  - [x] Tap a card → `MatchFlow.draftUnit(class)`; render the growing army (up to 3) with each unit's rolled element shown immediately (FR3 owner-sees-at-draft); tapping a drafted unit removes it (`MatchFlow.removeUnit`); duplicates allowed; adding is blocked at 3
  - [x] A "continue to placement" control enabled only at exactly 3 drafted; transitions to Placement passing `flow`
  - [x] Extract any non-trivial selection/formatting logic (rules-card text assembly, can-add/can-continue predicates) into a pure `DraftModel`/helper module so it is unit-testable without Phaser; the scene stays a thin renderer. Unit-test the pure helpers
- [x] Task 3: Placement scene + the pure PlacementModel (AC: 3, 4)
  - [x] New `apps/web/src/flow/placement.ts`: a PURE grid model — `applyDrop(placements, fromCell|'tray', toCell) → placements'` implementing the FR4 rules: drop on empty cell moves; drop on occupied cell SWAPS; a drop that would be illegal is impossible by construction (the model only ever returns a legal board — 3 units on distinct cells or in the tray). Owner-local coords (AD-11): rows front/mid/back, cols left/center/right. This is the testable heart of AC3 — cover empty-move, swap, tray↔grid, and the return-to-origin resolution in unit tests
  - [x] New `apps/web/src/scenes/PlacementScene.ts` (Phaser, thin renderer): render the 3×3 grid (owner-local; FR30 portrait touch targets) + an unplaced tray of the 3 drafted units; wire Phaser drag-and-drop to the PlacementModel
  - [x] Drag mechanics (Phaser 4 input — verify against installed 4.2.1, see Dev Notes): units `setInteractive({ draggable: true })`, grid cells are drop zones (`setInteractive({ dropZone: true })` or `Zone` objects); on `drop` → `applyDrop`; on `dragend` with no valid drop target → return the unit to its origin cell/tray (use `dragStartX/dragStartY` or the model's prior position — never lose a unit, AC3). Re-render from the model after every drop, don't mutate sprite positions as the source of truth
  - [x] Submit control: disabled with a visible "place all 3 units" affordance while < 3 placed; enabled exactly when the 3rd unit lands (derive from the model's placed-count, AC4)
  - [x] Submit → `MatchFlow.commit()` then transition to the post-submit seam (Task 4)
- [x] Task 4: Commit — AI opponent + MatchSetup assembly (AC: 5, 6)
  - [x] `MatchFlow.commit()`: human is side A (AD-11). Assemble `MatchSetup`: `armies.A` = drafted units (class+element, already rolled); `placements.A` = the placement model's board mapped to owner-local `{row,col}` parallel to `armies.A` by index. AI is side B: call `chooseSetup(STRATEGY_POOL, streams['ai/B'], { exclude: state.lastAiArchetypeId })` (AD-6/AD-13 — MatchFlow is the sole AI caller), roll B's 3 elements on `elements/B` in army order (AD-9), build `armies.B`/`placements.B`. Set `mode: 'single'`, `balanceVersion: BALANCE.version`
  - [x] Call `validateMatchSetup(setup)` before storing — the shell validates all user input before the engine trusts it (spine errors convention); a thrown `InvalidMatchSetupError` is a bug in assembly, surface it loudly in dev. Store the committed setup + the AI's `archetypeId` (into `lastAiArchetypeId` for the next match's no-repeat) in `MatchState`, set phase `committed`
  - [x] FR5/FR24 rendering fence: NOTHING of the AI's board (classes, elements, placements) may render before Reveal. The post-submit seam is a MINIMAL placeholder scene (e.g. `RevealScene` stub showing only "Both armies committed — reveal, battle & result arrive in story 1.9", NO board) that keeps the app runnable and demonstrable; the real Reveal/Battle/Result is story 1.9 (scope fence). Assert in a test that the committed AI data is present in `MatchState` but no scene reads/renders it yet
  - [x] Rematch seam: `startMatch` on an existing flow carries `lastAiArchetypeId` forward and rolls a FRESH seed (AD-10 — rematches included). Wiring the Result→Rematch button is story 1.9; just ensure `MatchFlow` supports it and unit-test the exclude-carry + fresh-seed behavior
- [x] Task 5: Wire the FSM + full gate (AC: all)
  - [x] `main.ts` scene list = `[HomeScene, DraftScene, PlacementScene, RevealScene(stub)]`; Home button enabled; every transition passes `MatchFlow` explicitly via `scene.start(key, { flow })` — grep-verify NO `this.registry` state writes and NO module-level mutable singletons hold match truth (AD-5)
  - [x] Extend `apps/web/src/config/constants.ts` for new UI values (grid metrics, card sizes, new palette entries, labels) — no scattered magic numbers/strings; mirror the existing PALETTE/label pattern. Update `test/constants.test.ts` if labels it asserts move
  - [x] Full gate green: `pnpm -r typecheck` (web has `noUnusedLocals`/`noUnusedParameters` — no dead params in scene callbacks), `pnpm test`, `pnpm --filter web build`. Manually run `pnpm --filter web dev` and drive the flow on a 360×640 viewport (the dev-run demo step) — scene rendering is NOT unit-tested (smoke-only convention), so the manual drive IS the correctness proof for the Phaser layers
  - [x] README: note the playable draft→placement flow now exists behind Home's button (NFR3 documented-steps)

## Dev Notes

### The load-bearing architectural decisions (read first)

1. **`MatchState` is serializable; the RNG stream is not — so it does NOT live in state (AD-5).** The forward-only element requirement (AC2) is the trap. Do NOT stash a live `Stream` in `MatchState` or a scene. Store `seed` + a monotonic `elementsRolled` count; reconstruct-and-fast-forward to draw the next element. `(seed, elementsRolled)` fully determines every element drawn so far — serializable, replayable, and forward-only because removes never decrement the counter. There is a `JSON` round-trip test to enforce this.
2. **`MatchFlow` is the sole engine/AI caller and sole `MatchState` mutator (AD-13).** Scenes never call `chooseSetup`/`resolveBattle`/`createStreams` directly and never mutate match truth — they call `MatchFlow` methods and render `MatchFlow.getState()`. This is the same functional-core/imperative-shell discipline the engine follows, applied inside the shell: pure models (`MatchState`, `placement.ts`, `DraftModel`) + thin Phaser renderers.
3. **State passes EXPLICITLY between scenes (AD-5).** Use `scene.start('Key', { flow })` and read `data.flow` in the target scene's `init(data)`/`create(data)`. The Phaser registry is NOT a state store — do not put `MatchFlow` or `MatchState` in `this.registry`. No module-level mutable singleton either.
4. **Human is always side A (AD-11).** Player draft/placement → side A; AI → side B on the `ai/B` stream. All placement coords are owner-local `{row,col}`; lane mirroring is a *renderer* concern that doesn't arrive until the battle scene (1.9/2.2) — Placement just renders the player's own grid.

### Testing constraints (hard — shaped by the current repo)

- **`apps/web` tests run in the DEFAULT node env** (no `jsdom`/`happy-dom` configured; root `vitest.config.ts` just globs `apps/*`). Existing web tests import pure constants/values only and never boot Phaser. Per the spine's test convention ("Shell: smoke-level scene tests only — the engine carries the correctness burden"), this story's tests cover the PURE modules — `MatchState` serialization, `MatchFlow` orchestration (fixed injected seed), `placement.ts` grid rules, `DraftModel` helpers — and MUST NOT import Phaser or touch the DOM. Do not add a browser test env or a Phaser-scene render test; if a behavior can only be checked by rendering, it's verified by the manual dev-run, not the suite.
- **`crypto.getRandomValues` is the only Web API needed** and it's isolated behind an injected seed source in `MatchFlow` — tests pass a literal seed, so no DOM env is required. `localStorage` is NOT used this story (the `web/storage` gateway is story 2.3/3.1 — scope fence; no persistence in 1.8).
- **`useDefineForClassFields: true` + `strictPropertyInitialization: false`** are already set in web tsconfig — Phaser scene subclass fields behave normally. `noUnusedLocals`/`noUnusedParameters` are ON: Phaser event callbacks that ignore args must omit them, not leave them unused.

### Phaser 4 input API (verify against installed phaser 4.2.1)

Drag/drop is stable Phaser 3→4 (rex-notes documents it for Phaser 4). Expected shape — CONFIRM against the installed version while implementing, since scene code isn't unit-tested:
- Make a unit draggable: `gameObject.setInteractive({ draggable: true })`.
- Grid cell as drop target: a `Zone` (or rect) with `setInteractive({ dropZone: true })`.
- Events: on the object, `gameObject.on('dragstart'|'drag'|'dragend', ...)`; the `drag` handler sets `gameObject.x/y` to the pointer; on the input plugin, `this.input.on('drop', (pointer, obj, zone) => ...)`. `dragend` fires after `drop`; use a "was I dropped on a valid zone?" flag or `dragStartX/dragStartY` to return-to-origin when no zone caught it (AC3 "no drop is ever lost").
- Re-render from the PlacementModel after each drop — the model is the source of truth, sprite x/y is just its projection. [Sources: rexrainbow.github.io/phaser3-rex-notes (Phaser 4 drag notes), phaser input drag examples]

### Existing web state you build on (verified at baseline)

- `apps/web/src/main.ts` — single `Game` with `scene: [HomeScene]`, `Scale.FIT` + `CENTER_BOTH`, base 360×640, `parent: 'game-container'`. Add scenes to this array.
- `apps/web/src/scenes/HomeScene.ts` — title + a DISABLED "Play vs AI" button (its comment literally says "Disabled until story 1.8 wires the Draft scene"). Enable it and wire the transition; reuse the button-building pattern.
- `apps/web/src/config/constants.ts` — `GAME_NAME`, `HOME_PLAY_LABEL`, `BASE_WIDTH/HEIGHT` (360/640), `PALETTE` (hex for text/config, numbers for shapes), `BUTTON_WIDTH/HEIGHT`. Extend here; `test/constants.test.ts` asserts some of these.
- `apps/web/test/*` — node-env smoke tests importing pure values only; follow this exact style for the new pure-module tests.
- Engine API (all exported, verified): `chooseSetup`, `STRATEGY_POOL`, `createStreams`, `rollElement`, `validateMatchSetup`, `InvalidMatchSetupError`, `BALANCE`, and types `MatchSetup`, `Unit`, `UnitClass`, `Element`, `Placement`, `Row`, `Col`, `Side`, `Stream`, `Streams`. Consume the engine as the source of all domain types (AD-4) — do NOT redeclare `UnitClass`/`Element`/`Placement` in the web app.

### Previous story intelligence (1.7 + its review)

- **Data the UI shows must be READ from the data (1.6/1.7 review lesson):** the rules cards display per-class stats and RPS relations — pull them from `BALANCE.classes`/`BALANCE.rpsBeats`, never retype the numbers into the web app. A drifted copy is the exact class of bug the confusionMisfire finding was.
- **`chooseSetup` contract (1.7):** `chooseSetup(pool, stream, {exclude?})` returns `{ archetypeId, classes, placement }` — NO elements (the caller rolls them, AD-9). Two draws per call from the `ai/B` stream (pick + mirror). Thread `state.lastAiArchetypeId` as `exclude` for rematch no-repeat. It throws on an empty pool / bad col now — you pass `STRATEGY_POOL`, so fine.
- **`createStreams(seed)` (1.3):** returns all 5 streams; `elements/A` for the player draft, `elements/B` + `ai/B` for the AI. `rollElement(stream)` draws one element. Seed must be uint32 — `crypto.getRandomValues(new Uint32Array(1))[0]` gives exactly that.
- **Toolchain:** PATH prefix `$HOME/.nvm/versions/node/v24.16.0/bin`; pnpm from repo root. Web dev server: `pnpm --filter web dev` → http://localhost:8080.

### Scope fences (things this story must NOT do)

- **NO Reveal/Battle/Result** (story 1.9): the post-submit target is a bare placeholder scene with no board render. NO `resolveBattle` call in this story (MatchFlow supports it later; 1.8 stops at a committed, validated `MatchSetup`).
- **NO real sprites/animations** (story 2.1/2.2): placeholders only (shapes + labels).
- **NO `web/storage`/localStorage/history/settings persistence** (story 2.3/3.1). MatchState lives in memory, passed between scenes.
- **NO engine changes** — the engine is complete for this story (1.7 shipped the AI). NO new engine exports, NO balance edits, NO new streams. If you think you need an engine change, you've mis-scoped.
- **NO new browser test environment** — pure-module tests in node env only (see Testing Constraints).
- **NO speed/skip/replay** (2.3), NO help/credits screens (2.4) — Home→Draft→Placement→(commit seam) only.

### Project Structure Notes

- NEW: `apps/web/src/flow/MatchState.ts`, `apps/web/src/flow/MatchFlow.ts`, `apps/web/src/flow/placement.ts`, `apps/web/src/scenes/DraftScene.ts`, `apps/web/src/scenes/PlacementScene.ts`, `apps/web/src/scenes/RevealScene.ts` (stub); optional `apps/web/src/scenes/draftModel.ts` (or colocate pure helpers). NEW tests under `apps/web/test/` for each pure module.
- MODIFIED: `apps/web/src/main.ts` (scene list), `apps/web/src/scenes/HomeScene.ts` (enable button + transition), `apps/web/src/config/constants.ts` (new UI values), `README.md`.
- The `flow/` directory matches the spine's structural seed (`web/flow/ — MatchFlow controller + MatchState (AD-5, AD-13)`).

### UX note (no design contract exists)

Per the epics and the readiness report, there is NO UX spec — draft/placement layout and ergonomics are designed inline here against FR30 (portrait, ~360×640, touch-native) only. Keep it functional, legible at 360-wide, and touch-friendly (large tap targets); the polish pass and any `bmad-ux` correction is an Epic-2 concern. This is the milestone where draft/placement ergonomics first become feel-able — flag anything awkward for the retro.

### References

- [Source: docs/planning-artifacts/epics.md#Story-1.8] — ACs (verbatim source of truth)
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#FR1, #FR2, #FR3, #FR4, #FR5, #FR6, #FR24, #FR30]
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-5 (scene FSM + one MatchState), #AD-6 (AI can't see player), #AD-9 (elements are data, rolled once), #AD-10 (seed + streams, fresh per match), #AD-11 (human is A, owner-local coords), #AD-13 (MatchFlow sole caller/writer)]
- [Source: docs/implementation-artifacts/1-7-the-ai-opponent-and-the-balancing-harness.md] — `chooseSetup` contract, stream discipline, data-must-be-read lesson
- [Source: docs/adr/ADR-001-engine-consumed-as-source.md] — engine consumed as raw TS source via exports map

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Opus 4.8, 1M context)

### Debug Log References

- TDD reds proven: `match-flow.test.ts` and `placement.test.ts` failed on missing modules; `draft-model.test.ts` failed on missing `draftModel`. All green after implementation.
- Forward-only element stream (AC2) — the crux — implemented exactly as the recorded spec decision: `MatchState.elementsRolled` counter, no live `Stream` in state. Proven by a test that drafts 3, removes #2, re-adds, and asserts the re-added element equals the 4th draw of a fresh `elements/A` (never the discarded 2nd). JSON round-trip test enforces serializability (AD-5).
- FR24/AD-6 proven structurally: a test commits two DIFFERENT player boards on the SAME seed and asserts identical AI boards — the AI's output depends only on its `ai/B` stream, never the player.
- Web `noUnusedLocals`/`noUnusedParameters` caught three dead symbols in `PlacementScene` (an unused `Geom` import + unused loop indices) — fixed.
- Phaser draggable-container risk (untested layer): switched from `setInteractive({ draggable: true })` to the canonical `setSize()` → `setInteractive()` → `input.setDraggable()` form, which reliably builds a centered rectangular hit area for containers. Drop zones via `zone.setRectangleDropZone`; input-level `drag`/`drop`/`dragend(dropped)` handlers; a `!dropped` dragend re-renders from the model so no unit is ever lost (AC3).
- Dev-run verification: started `pnpm --filter web dev`; confirmed the server serves, the entry transforms with all four scenes wired, and every new module (`DraftScene`/`PlacementScene`/`RevealScene`/`MatchFlow`/`placement`/`draftModel`/`MatchState`/`constants`) transforms HTTP 200 with no compile error. Interactive drag-drop drive on a 360×640 viewport is the human step (scene rendering is smoke-only by convention — the pure models carry the tested correctness).

### Completion Notes List

- All 5 tasks complete: 190 tests green (23 added, all pure node-env — MatchState serialization, MatchFlow draft/forward-only/commit/rematch, placement grid rules, draft rules-cards); typecheck clean (engine + web); web build OK (chunk-size note is the pre-existing Phaser-bundle warning).
- Functional-core/imperative-shell applied inside the shell: pure `MatchState`/`MatchFlow`/`placement`/`draftModel` modules hold all tested logic; Phaser scenes (`DraftScene`, `PlacementScene`, `RevealScene` stub) are thin renderers, no browser test env added.
- AD-5/AD-13 honored: `MatchFlow` owns and mutates `MatchState`, is the sole `chooseSetup` caller, passed explicitly via `scene.start(key, { flow })` — no `this.registry` state, no module-level singleton.
- Scope fences respected: no Reveal/Battle/Result (post-submit is a bare placeholder rendering NO AI board — FR5/FR24), no real sprites, no storage/localStorage, no engine changes (engine untouched — all engine tests still green), no new streams. Rematch seam (fresh seed + `lastAiArchetypeId` exclude carry) supported and unit-tested; the Result→Rematch button is story 1.9.
- Rules cards read stats/RPS/actions from `BALANCE` (data-must-be-read lesson) — a test asserts they echo BALANCE, guarding against drift.

### File List

- apps/web/src/flow/MatchState.ts (new — serializable state interface + DraftedUnit/MatchPhase)
- apps/web/src/flow/MatchFlow.ts (new — controller: sole engine/AI caller and state mutator, injected seed source)
- apps/web/src/flow/placement.ts (new — pure grid model: placeUnit/sameCell/placedCount)
- apps/web/src/flow/draftModel.ts (new — pure rules-card + draft-gating helpers, derived from BALANCE)
- apps/web/src/scenes/DraftScene.ts (new — draft renderer)
- apps/web/src/scenes/PlacementScene.ts (new — placement renderer + drag-and-drop)
- apps/web/src/scenes/RevealScene.ts (new — post-submit placeholder stub, renders no AI board)
- apps/web/src/scenes/HomeScene.ts (modified — enabled Play button, starts a match, transitions to Draft)
- apps/web/src/main.ts (modified — scene list: Home/Draft/Placement/Reveal)
- apps/web/src/config/constants.ts (modified — scene labels, palette entries, element colors, grid/card metrics, TEXT_RESOLUTION, enemy-marker colors/label)
- apps/web/src/config/ui.ts (new — `crispText` helper: renders text at TEXT_RESOLUTION so it stays sharp under Scale.FIT upscaling)
- apps/web/test/match-flow.test.ts (new — MatchState serialization + MatchFlow draft/forward-only/commit/rematch)
- apps/web/test/placement.test.ts (new — grid move/swap/tray/legality)
- apps/web/test/draft-model.test.ts (new — gating + rules-card-from-BALANCE)
- README.md (modified — playable draft→placement flow note)
- docs/implementation-artifacts/1-8-draft-and-placement-on-the-phone.md (story tracking)
- docs/implementation-artifacts/sprint-status.yaml (status tracking)

## Change Log

- 2026-07-13: Story created (ready-for-dev). Ultimate context engine analysis completed — comprehensive developer guide created: the serializable-MatchState-vs-live-RNG-stream tension resolved via a monotonic `elementsRolled` counter (forward-only by construction, AD-5 preserved); MatchFlow as sole engine/AI caller (AD-13) with an injected seed source isolating the one effectful dependency; functional-core/imperative-shell applied inside the shell (pure MatchState/placement/DraftModel + thin Phaser renderers) to fit the repo's node-env smoke-only test convention; Phaser 4 drag/drop API pinned (with verify-against-4.2.1 caveat since scene code isn't unit-tested); and hard scope fences against 1.9's Reveal/Battle/Result and 2.x's sprites/storage/help.
- 2026-07-13: Human-review UX polish (still in review): (1) fixed blurry text — the Scale.FIT canvas upscaling softened glyphs; all scene labels now render via a `crispText` helper at `TEXT_RESOLUTION` (3×) for sharp text; (2) added a red "▲ ENEMY ARMY ▲" banner + divider line above the placement grid so first-time players see where the opponent faces (FR6 groundwork). Typecheck + 190 tests still green; no logic changes.
- 2026-07-13: Story 1.8 implemented, status → review. The first web/shell story: the playable Home → Draft → Placement → commit flow lands. `MatchFlow` + serializable `MatchState` (AD-5/AD-13) with the forward-only element stream reconciled via an `elementsRolled` counter (no live RNG in state); pure `placement`/`draftModel` models carry the tested logic behind thin Phaser scenes; Draft rolls elements on `elements/A` and shows rules cards read from `BALANCE`; Placement is touch drag-and-drop over a 3×3 owner-local grid with move/swap/return-to-origin; submit gates on all-3-placed then commits the AI via `chooseSetup` on `ai/B` (AD-6 — no player channel) into a validated `MatchSetup`; post-submit is a Reveal placeholder rendering NO AI board (FR5/FR24 — real Reveal/Battle/Result is 1.9). 23 new tests (190 total), typecheck + build clean, engine untouched. Interactive drive is the human verification step (scenes are smoke-only by convention).
