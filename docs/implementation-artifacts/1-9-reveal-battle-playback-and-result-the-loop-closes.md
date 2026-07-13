# Story 1.9: Reveal, battle playback, and result — the loop closes

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to watch the battle resolve and see who won, then rematch in one tap,
so that I can play complete matches on my phone, end to end.

## Acceptance Criteria

_Verbatim from [Source: docs/planning-artifacts/epics.md#Story-1.9]. epics.md is canonical — if anything here drifts, epics.md wins._

**AC1 — Reveal (FR6, AD-11)**
- **Given** both boards are committed
- **When** the Reveal scene shows
- **Then** both boards display **face to face** with classes and elements visible (FR6), rendering the mirrored lanes correctly **from owner-local coordinates** (AD-11).

**AC2 — Battle playback (AD-2, AD-13)**
- **Given** the reveal
- **When** the battle plays
- **Then** `MatchFlow` calls `resolveBattle` **exactly once** (AD-13) and the Battle scene plays the `BattleLog` **sequentially** — functional presentation (simple shapes/labels acceptable this epic): each event visibly rendered **in order**, HP bars deplete, deaths disappear, statuses marked (AD-2; FR21's full animation arrives in Epic 2).
- **And** playback pacing is defined: a default beat duration per event (**~600 ms** at normal speed, **a tuning constant in data, not code**) with **press-and-hold to fast-forward ×4** — an interim affordance until FR23's controls land in story 2.3.
- **And** the scene evaluates **no combat rule** — deleting the engine from it leaves no game logic behind.

**AC3 — Result & loop close (FR18, FR22 functional, FR27)**
- **Given** the battle ends
- **When** the Result scene shows
- **Then** winner (or draw) with **both final HP percentages** and **both compositions** display (FR18, FR22 functional), with **Rematch** (one tap → fresh Draft with a new seed) and **Home** (FR27).
- **And** a full loop **Home → Draft → Placement → Reveal → Battle → Result → Rematch** completes in **under 5 minutes** on a phone with no account and no tutorial gate (FR27).
- **And** the deployed **production URL** delivers this complete loop on **Android Chrome**.

## Tasks / Subtasks

- [ ] **Task 1 — Add the resolve-once seam to `MatchFlow` (AC2; AD-13)**
  - [ ] Add a method `resolve(): BattleLog` to `apps/web/src/flow/MatchFlow.ts` that: requires `phase === 'committed'` and `committedSetup` present (throw a clear error otherwise, mirroring `commit()`'s guard style); calls `resolveBattle(this.state.committedSetup)` **exactly once**; caches the log and returns the same frozen log on any subsequent call (**idempotent**, like `commit()`).
  - [ ] Cache the log in a **private field on `MatchFlow`** (e.g. `private log?: BattleLog`), **NOT** inside `MatchState` — keep `MatchState` JSON-serializable (AD-5); the existing round-trip test must still pass unchanged.
  - [ ] Import `resolveBattle` and `BattleLog` from `@lordly/engine` (AD-4 — never redeclare engine types).
  - [ ] Unit-test in `apps/web/test/match-flow.test.ts`: deterministic log for a fixed seed, idempotence (second `resolve()` returns the same object, does not re-run), and that calling before commit throws.

- [ ] **Task 2 — Pure lane-mirroring transform module (AC1; AD-11)**
  - [ ] Create `apps/web/src/flow/battleView.ts` (pure, no Phaser) exporting a function that maps an owner-local `Placement` + `Side` to a screen cell on the shared board — side B faces side A, `own col i faces enemy col 2−i` (front rows face each other). Read grid geometry from constants; do not hardcode.
  - [ ] Unit-test the transform in `apps/web/test/battle-view.test.ts` (node env, no Phaser): every (side, row, col) maps to the expected screen cell; A and B mirror correctly; the mapping is a bijection per side.

- [ ] **Task 3 — Pure playback sequencer/pacing model (AC2)**
  - [ ] In `battleView.ts` (or a sibling pure module), model the beat schedule: given `log.events` and a beat-duration constant, produce the ordered beat list (one beat per event) and expose the fast-forward ×4 factor as data. Keep it engine-free and DOM-free so it is unit-testable.
  - [ ] Add the beat-duration (`~600 ms`) and the ×4 fast-forward factor to `apps/web/src/config/constants.ts` as named tuning constants (data, not code).
  - [ ] Unit-test: event order is preserved 1:1; the normal vs fast-forward durations are derived from the constants.

- [ ] **Task 4 — Reveal scene: both boards face to face (AC1)**
  - [ ] Replace the `RevealScene` placeholder (`apps/web/src/scenes/RevealScene.ts`). Read `flow.getState().committedSetup` and the `BattleStarted` roster (via `flow.resolve()`), and render **both** boards (side A and side B) with class + element visible, using the lane-mirror transform from Task 2. The FR5/FR24 fence lifts **here** — side B renders for the first time.
  - [ ] Reuse `crispText` (`config/ui.ts`), `PALETTE`, `ELEMENT_COLORS`, and enemy-side markers (`PALETTE.enemyText`/`enemyLine`, `ENEMY_ARMY_LABEL`) already in constants. Read class/element strictly from the snapshot/setup — never retype.
  - [ ] Provide a control to advance Reveal → Battle, and a **Home** affordance (see Task 6).

- [ ] **Task 5 — Battle scene: sequential log playback (AC2)**
  - [ ] Create `apps/web/src/scenes/BattleScene.ts`. Build sprites/HP-bars from the `BattleStarted` snapshot roster, keyed by `UnitId`. Iterate `log.events` in array order, rendering one beat per event on the beat schedule (Phaser tween/timer). Drive HP bars from `hpAfter` (authoritative); render damage popups from `damage` (may exceed HP removed on overkill). Remove sprites on `UnitDied`; mark statuses on `StatusApplied`; narrate `ActionMisfired` with its following effect event as a pair.
  - [ ] Handle every one of the 12 `BattleEvent` members (`BattleStarted`, `PassStarted`, `UnitAttacked`, `UnitHealed`, `StatusApplied`, `ActionMisfired`, `ActionFizzled`, `ActionSkipped`, `PoisonTicked`, `UnitDied`, `EngagementEnded`, `BattleEnded`) with a visible rendering — use a `switch` on `event.type` (`noFallthroughCasesInSwitch` is on).
  - [ ] Implement **press-and-hold to fast-forward ×4**; release returns to normal speed. No skip/normal-vs-fast toggle (that is FR23 / story 2.3).
  - [ ] Do **not** special-case "exactly one `EngagementEnded`" — replay the event stream generically so story 1.10's multi-engagement wipeout logs replay without scene changes.
  - [ ] Transition to Result when the stream (ending in `BattleEnded`) is exhausted.

- [ ] **Task 6 — Result scene + close the loop (AC3; FR22, FR27)**
  - [ ] Create `apps/web/src/scenes/ResultScene.ts`. Read `winner` and `hpPct.{A,B}` **off the `BattleEnded` event** (never recompute; never call `judge`). Show winner or **draw**, both final HP %, and both compositions (classes + elements). Add result labels/colors to `constants.ts`.
  - [ ] **Rematch** button: `flow.startMatch()` (fresh seed, carries `lastAiArchetypeId` forward for AI no-repeat), then `scene.start('Draft', { flow })` — reuse the same flow instance.
  - [ ] **Home** button: `scene.start('Home')` (Home builds a fresh `MatchFlow` on Play).
  - [ ] **Close the dead-end (1.8 deferral):** ensure a Home/back affordance exists from **every** post-Home scene (Draft, Placement, Reveal, Battle, Result). If adding Placement→Draft back-nav, note the forward-only element stream (re-adding re-rolls the next element — expected, not a bug) and respect the committed-phase FSM guards.

- [ ] **Task 7 — Register scenes & wire transitions (AC1–AC3)**
  - [ ] Add `BattleScene` and `ResultScene` to the scene array in `apps/web/src/main.ts`. Confirm the full FSM: Home → Draft → Placement → Reveal → Battle → Result → (Rematch → Draft | Home). Pass `flow` explicitly via `scene.start(key, { flow })` — never the Phaser registry (AD-5).

- [ ] **Task 8 — Gate & manual verification (AC2, AC3)**
  - [ ] `pnpm -r typecheck` clean; `pnpm test` green (new pure-module tests included); `pnpm --filter web build` succeeds.
  - [ ] Manual dev drive (`pnpm --filter web dev`, http://localhost:8080) on a **360×640** viewport: complete the full loop end to end, confirm both boards reveal face-to-face, the log plays in order with HP depletion / deaths / statuses, press-and-hold fast-forwards, Result shows winner/HP%/compositions, Rematch reaches a fresh Draft with a new seed, and Home works from every scene.

## Dev Notes

### The load-bearing architectural decisions (read first)

- **AD-2 — the engine resolves, the shell replays.** The battle scene is a **pure player** of the `BattleLog`. It evaluates no combat rule; anything the UI shows must already be an event/field in the log. AC2's litmus test: "deleting the engine from the scene leaves no game logic behind." [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-2]
- **AD-13 — `MatchFlow` is the SOLE engine caller and SOLE state mutator.** The scene must **not** call `resolveBattle`/`chooseSetup`/`createStreams`. `resolveBattle` runs **exactly once** per match, inside `MatchFlow`; the scene receives the log **read-only** through `flow`, never via the Phaser scene-data bag. This is the exact double-resolution / truth-by-another-door trap the AD was written to prevent. [Source: ARCHITECTURE-SPINE.md#AD-13; reviews/review-adversarial.md#Finding-5]
- **AD-11 — owner-local coordinates; mirroring is renderer-only.** All positions everywhere (engine, log, storage) are owner-local `{ side, row, col }` with `col` from the owner's own perspective. The human is **always side A**. The mirroring of facing lanes (your left column faces the enemy's right, drawn as one straight lane) is **presentation math confined to the battle/reveal renderer** — and 1.9 is the **first** story where that transform exists. Unit identity is `side:index`. [Source: ARCHITECTURE-SPINE.md#AD-11; PRD#FR7]
- **AD-5 — one serializable `MatchState`, scene FSM, explicit hand-off.** Each screen is a Phaser Scene; match progress lives in a single plain **serializable** `MatchState` owned by `MatchFlow`, passed explicitly on every transition. No state library; the registry is not a store. **Keep the `BattleLog` OFF `MatchState`** (cache it as a private field on `MatchFlow`) so the serializability invariant — and its round-trip test — stay intact. [Source: ARCHITECTURE-SPINE.md#AD-5]
- **AD-10 — one fresh seed per match, rematches included.** Rematch = new match = new seed. The seam already exists: `MatchFlow.startMatch()` rolls a fresh `crypto.getRandomValues` uint32 and carries `lastAiArchetypeId` forward (FR25 no-repeat). 1.9 only wires the Rematch button to it. [Source: ARCHITECTURE-SPINE.md#AD-10]
- **AD-12 — the `BattleLog` is a closed, versioned event union.** `LOG_VERSION = 3`; the full closed set shipped in stories 1.4–1.6. Every observable outcome is an event. [Source: ARCHITECTURE-SPINE.md#AD-12]

### The engine contract 1.9 consumes (all from `@lordly/engine`)

- **The only call:** `resolveBattle(setup: MatchSetup): BattleLog` — pure, validates internally, returns a **deep-frozen** log; identical setup → bit-identical log (FR20). Throws `InvalidMatchSetupError` only on malformed input (already validated at commit, so a throw would be a bug). [Source: packages/engine/src/resolve.ts, index.ts]
- **`BattleLog = { logVersion: number; events: readonly BattleEvent[] }`.** Events are already in strict playback order: `BattleStarted` → per pass (`PassStarted`, then each unit's turn events) → engagement end (`PoisonTicked`/`UnitDied`) → one `EngagementEnded` → `BattleEnded` last. **Replay = iterate `events` in array order, one beat each.** [Source: packages/engine/src/types.ts, resolve.ts]
- **`BattleEvent` (12-member closed union) — shapes 1.9 renders:** [Source: packages/engine/src/types.ts lines 123–298]
  - `BattleStarted { units: UnitSnapshot[] }` — build both boards from this roster.
  - `PassStarted { pass: number }` (1-based; FR13 multihit boundary).
  - `UnitAttacked { source: UnitId; targets: AttackTarget[] }`, `AttackTarget = { unit: UnitId; damage: number; hpAfter: number }` — **HP bars driven by `hpAfter` (authoritative); popups show `damage` (may exceed HP removed on overkill)**. Mage blast = multiple targets.
  - `UnitHealed { source; target: UnitId; amount; hpAfter }` — `amount` = effective HP restored (capped).
  - `StatusApplied { source; target: UnitId; spell: SpellKind }`, `SpellKind = 'sleep'|'poison'|'weaken'|'confusion'`.
  - `ActionMisfired { unit }` — **marker**, immediately followed by the redirected effect event(s); narrate as a pair.
  - `ActionFizzled { unit }`; `ActionSkipped { unit; reason: 'dead'|'asleep'|'idle' }`.
  - `PoisonTicked { unit; damage; hpAfter }` (end-of-engagement, before judging).
  - `UnitDied { unit: UnitId }` — remove the sprite ("deaths disappear").
  - `EngagementEnded { engagement: number; hp: Record<UnitId, number> }`.
  - `BattleEnded { winner: Side | 'draw'; hpPct: { A: number; B: number } }` — **the Result screen's sole source**.
- **`UnitSnapshot = { id: UnitId; side: Side; class: UnitClass; element: Element; placement: Placement; hp: number; maxHp: number }`.** `UnitId = `${Side}:${number}`` — key sprites/HP-bars off this.
- **Result rule (do NOT recompute):** `judge`/`JudgedUnit` are **module-internal** (not exported from `index.ts`). The winner is already decided in `BattleEnded.winner`; `hpPct` are **floored report-only** ints for display — never derive the winner from them (flooring can manufacture false ties). Read `winner` + `hpPct` off the event. [Source: packages/engine/src/judging.ts]

### The `MatchFlow` seam (where the engine call goes)

- The committed setup is already on state: `flow.getState().committedSetup: MatchSetup | undefined`, `phase === 'committed'`, populated by the idempotent `commit()`. [Source: apps/web/src/flow/MatchFlow.ts]
- **1.9 adds `MatchFlow.resolve(): BattleLog`** — resolve `committedSetup` once, cache on a private field, return the same frozen log thereafter. The scene calls `flow.resolve()` (or reads the cached log); it never touches the engine directly. This keeps the scene a thin renderer and satisfies AD-13's "resolved exactly once."
- **Rematch is already wired in the controller:** `startMatch()` rolls a fresh seed and carries `lastAiArchetypeId` (unit-tested). 1.9 wires the button → `startMatch()` → `scene.start('Draft', { flow })`, reusing the flow instance. `mode: 'live'|'replay'` from AD-13 does **not** exist on `MatchState` yet — replay/history is Epic 3 (3.1/3.2); 1.9 is live-only, no history write.

### Existing web state you build on (verified at baseline)

- **Scenes** (`apps/web/src/scenes/`): `HomeScene` (builds a fresh `MatchFlow` on Play; its comment already anticipates 1.9's Rematch), `DraftScene`, `PlacementScene`, `RevealScene` (**a 39-line text stub** rendering only `REVEAL_PLACEHOLDER`, no board, no exit — this is the dead-end to replace). Registered in `main.ts`: `scene: [HomeScene, DraftScene, PlacementScene, RevealScene]`. Scene keys: `'Home'`, `'Draft'`, `'Placement'`, `'Reveal'`.
- **Scene pattern:** `extends Scene` (from `'phaser'`), `super('Key')`, `init(data: { flow: MatchFlow })` storing `private flow!: MatchFlow`; transition via `this.scene.start('Key', { flow: this.flow })`. Background via `this.cameras.main.setBackgroundColor(PALETTE.background)`.
- **Dynamic-redraw idiom:** keep a `private dynamic: GameObjects.GameObject[]`; `redraw()` destroys and rebuilds from `flow.getState()`. The **model is the source of truth; sprite x/y is its projection.**
- **Text:** ALL labels via `crispText(scene, x, y, text, style)` from `config/ui.ts` (renders at `TEXT_RESOLUTION = 3` to stay sharp under `Scale.FIT`). Never `scene.add.text` directly (blur regression from 1.8).
- **Constants:** `config/constants.ts` is the single source for colors/labels/metrics — `PALETTE` (hex strings for text/config, `0x` numbers for shapes), `BASE_WIDTH=360`/`BASE_HEIGHT=640`, `BUTTON_WIDTH=220`/`BUTTON_HEIGHT=56`, `ELEMENT_COLORS: Record<Element, number>` (keyed off the engine union — a new element is a compile error), enemy markers `PALETTE.enemyText`/`enemyLine`/`ENEMY_ARMY_LABEL`. **Extend this file** for 1.9's new values (result labels, winner/draw colors, battle-scene metrics, the ~600 ms beat + ×4 factor). No scattered magic numbers/strings.
- **Data-must-be-read lesson (recurring, load-bearing):** anything the UI shows that lives in engine data is **read** from it, never retyped — `BALANCE.armySize` (not literal `3`), `BALANCE.classes[c]`, element colors keyed off the engine union. The 1.8 review patched a hardcoded `3` for exactly this. The battle/result UI reads HP/stats from the log's snapshot and `hpAfter` fields — never recomputes.

### Testing constraints (hard — shaped by the current repo)

- **Shell tests are smoke-only; the engine carries correctness.** `apps/web` tests run in the **default node env — no jsdom/happy-dom**. **Tests must NOT import Phaser or touch the DOM.** [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions; 1-8...md testing constraints]
- **1.9's testable surface is pure logic:** the new `MatchFlow.resolve()` (deterministic log, idempotence, pre-commit throw), the lane-mirroring transform, and the playback sequencer/pacing model. Extract these into pure modules (`flow/battleView.ts`) mirroring how 1.8 extracted `placement.ts`/`draftModel.ts`, and unit-test them. `BattleScene`/`ResultScene`/`RevealScene` Phaser classes stay **untested renderers** verified by the manual dev-run.
- **Test style:** `vitest` `describe/it/expect`; fixed injected seed via `new MatchFlow(() => seed)` (see `flowWithSeed` in `match-flow.test.ts`). Do **not** add a browser test env.
- **Coverage gate applies to the engine package only** (≥90% lines, `vitest.config.ts` `packages/engine/**`); no threshold on `apps/web`. Do not touch/lower the engine gate.
- **Gate sequence:** `pnpm -r typecheck` → `pnpm test` → `pnpm --filter web build` → manual `pnpm --filter web dev` (localhost:8080) on 360×640. The manual drive **is** the correctness proof for the Phaser layer.

### Phaser API notes (verify against the INSTALLED version)

- `package.json` specs `phaser ^4.2.1`, but the version **installed on disk is 4.1.10** (the spine pins 4.2.x). 1.8's notes said "4.2.1" — the resolved install is **4.1.10**. Since scene code isn't unit-tested, **verify the tween/timer/input APIs you use against the installed 4.1.10** while implementing.
- Battle playback likely needs **tweens/timed events** to sequence beats over time, and **press-and-hold** input (pointerdown/pointerup) for fast-forward. Drag/drop proved stable 3→4 in `PlacementScene`.
- **TS strictness:** `noUnusedLocals`/`noUnusedParameters` are **ON** — Phaser event callbacks must **omit** unused args (prefix `_` like the existing `_pointer`/`_obj`), not leave them dangling. `useDefineForClassFields: true` + `strictPropertyInitialization: false` → the `private flow!: MatchFlow` pattern works. `noFallthroughCasesInSwitch: true` → the event `switch` needs `break`/`return` per case.

### Previous story intelligence (1.8 + its review, and the chassis stories)

- **1.8 delivered the shell up to submit:** `MatchFlow`/`MatchState` (single serializable state, AD-13), `placement.ts`/`draftModel.ts` pure models, Draft/Placement scenes, `crispText`, the enemy-side markers. Its review added **phase FSM guards** (`draftUnit`/`removeUnit`/`placeUnit` throw once `committed`) and made `commit()` idempotent + bounds-checked. Respect/extend these guards if 1.9 adds re-entry/back-nav — a post-commit mutation must not silently desync `committedSetup`. [Source: docs/implementation-artifacts/1-8-...md]
- **1.8's `RevealScene` deliberately renders no board** (FR5/FR24 fence) and has no exit — the stranded dead-end. **1.9 owns closing it.** [Source: 1-8...md Review Findings; deferred-work.md]
- **1.4 built the BattleLog chassis; 1.5 melee/judging; 1.6 the full closed event union.** There are currently **zero** consumers of `resolveBattle`/`BattleLog`/`BattleEvent` in `apps/web` — 1.9 is the **first** consumer, exactly as every prior story predicted ("no shell consumes the log until 1.9"). [Source: 1-4/1-5/1-6...md]

### Scope fences (things this story must NOT do)

- **NO engine changes.** The engine is complete (`LOG_VERSION 3`, judging live, AI shipped). No new exports, no balance edits, no rng/stream changes; `BALANCE.version` stays 1. If you think you need an engine change, you've mis-scoped.
- **Functional presentation only** — simple shapes/labels + `crispText`. Real sprites/atlases/animations are stories **2.1/2.2**.
- **NO FR23 speed/skip controls** — only the interim **press-and-hold ×4**. Normal/fast toggle + skip-to-result + persisted speed preference are story **2.3**.
- **NO `web/storage`/localStorage/history/settings persistence** — the storage gateway ships in 2.3 (settings) and 3.1 (history). `MatchState` stays in-memory; no history write, no `mode:'live'|'replay'` field.
- **NO Help/Rules/Credits screens** — story 2.4 (the rest of FR27's help affordance).
- **NO player-facing mode selector / wipeout UI** — `commit()` always sets `mode:'single'`; wipeout is story 1.10 (engine + dev toggle only). 1.9 replays single-engagement logs, but **do not special-case exactly one `EngagementEnded`** so 1.10's multi-engagement logs replay unchanged.
- **Beat duration is a data constant** (~600 ms normal) in `constants.ts`, not inlined in scene code.

### Project Structure Notes

- New pure module: `apps/web/src/flow/battleView.ts` (lane-mirror transform + playback/pacing model) with `apps/web/test/battle-view.test.ts`.
- New scenes: `apps/web/src/scenes/BattleScene.ts`, `apps/web/src/scenes/ResultScene.ts`. Replace stub `apps/web/src/scenes/RevealScene.ts`.
- Edit: `apps/web/src/flow/MatchFlow.ts` (`resolve()`), `apps/web/src/main.ts` (register scenes), `apps/web/src/config/constants.ts` (new UI/timing constants), scenes for Home/back affordances.
- Extend tests: `apps/web/test/match-flow.test.ts` (the `resolve()` method). `constants.test.ts` asserts some labels — update it if any asserted label moves.
- Naming/paths follow the established `scenes/`, `flow/`, `config/` layout. No new top-level dirs.

### UX note (no design contract exists)

- **No UX spec exists** (confirmed: no `*ux*` doc under `docs/`; epics.md#UX-Design-Requirements suggests running `bmad-ux` before the presentation epic). Reveal/Battle/Result layout, playback pacing feel, and result ergonomics are designed **inline** against FR30 only: portrait ~**360×640**, touch-native, large tap targets, legible. Polish (camera perspective, victory banner, HP count-up, legibility floors) is Epic 2 (2.2/2.3). This is the milestone where the full match loop first becomes feel-able end to end — **flag anything awkward for the epic-1 retro.**

### References

- [Source: docs/planning-artifacts/epics.md#Story-1.9] — canonical ACs, epic context, 1.10 relationship
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md] — AD-2, AD-5, AD-10, AD-11, AD-12, AD-13; test/perf conventions; stack pins
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/reviews/review-adversarial.md#Finding-5] — the double-resolution trap that AD-13 prevents (Findings 3/4/5 bind 1.9)
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md] — FR6, FR7, FR18, FR20, FR21, FR22, FR23, FR27, FR30; NFR1
- [Source: packages/engine/src/types.ts] — `BattleLog`, `BattleEvent` union (12 members), `UnitSnapshot`, `AttackTarget`, `UnitId`, `Side`, `LOG_VERSION`
- [Source: packages/engine/src/resolve.ts] — event ordering; `resolveBattle` signature
- [Source: packages/engine/src/judging.ts] — result rule (module-internal; read `BattleEnded`, never recompute)
- [Source: packages/engine/src/index.ts] — the exact `@lordly/engine` export surface (AD-4)
- [Source: apps/web/src/scenes/RevealScene.ts, HomeScene.ts, main.ts] — stub to replace, rematch anticipation, scene registration
- [Source: apps/web/src/flow/MatchFlow.ts, MatchState.ts] — `committedSetup`, `commit()` idempotence, `startMatch()` rematch seam, phase guards
- [Source: apps/web/src/config/constants.ts, ui.ts] — `PALETTE`, `ELEMENT_COLORS`, enemy markers, `crispText`/`TEXT_RESOLUTION`
- [Source: docs/implementation-artifacts/deferred-work.md] — the 1.8 navigation dead-end 1.9 must close
- [Source: docs/implementation-artifacts/1-8-draft-and-placement-on-the-phone.md] — prior-story conventions, phase-guard/idempotence patterns, testing constraints
- [Source: docs/adr/ADR-001-engine-consumed-as-source.md] — engine-consumed-as-source import convention

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log
