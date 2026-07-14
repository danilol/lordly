---
baseline_commit: 5b002fbf055c295c8f32a70573cfe0ab4494e5f5
---

# Story 2.3: Watchability controls and a worthy result screen

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to control battle pacing and get a satisfying verdict,
so that first battles are savored and rematch grinding stays fast.

Two halves: (1) the battle control bar grows its real FR23 controls — tappable speed (1× / 2×) and skip-to-result — replacing the interim press-and-hold, with the speed preference persisted through the codebase's **first storage gateway** (`web/storage`, AD-8, `lordly.v1.settings`); (2) the Result scene becomes a worthy verdict — full-screen banner, animated HP count-up, and both compositions with real sprites.

## Acceptance Criteria

**AC1 — Tappable speed + skip controls (FR23, AD-2).**
The Battle scene's bottom control bar gains **`▶ 1×`**, **`⏩ 2×`**, and **`⏭ Skip`** beside the existing `≡ Log` toggle (per the UX mock's four-control bar; every target ≥ 44px). Selected speed shows a visible selected state (gold-ish enabled treatment per the mock; the existing enabled-button stroke is acceptable this side of the theming story). Speed applies **immediately** (mid-beat: reschedule the pending wait at the new rate — the 1.9 latency lesson). **Skip resolves instantly to Result at any moment** — the same log, no rule divergence (AD-2: Result reads the same cached `BattleLog`; nothing is recomputed). The interim **press-and-hold ×4 is REMOVED** (EXPERIENCE.md: the control bar "replaces this with explicit, tappable speed buttons") along with its hint text, `gameout` guard, and holding machinery.

**AC2 — The `web/storage` gateway ships, settings-only (AD-8).**
A new `apps/web/src/flow/storage.ts` module is the **sole reader/writer of localStorage** in the codebase (AD-8's rule — no other module touches storage APIs, ever). It owns the versioned key manifest under `lordly.v1.*`; **this story ships exactly one key: `lordly.v1.settings`** (history keys arrive in Epic 3 — do not add them). Behavior per AD-8 + resilience:
- Settings shape: a small versioned object holding `battleSpeed` (extensible for later settings — theme arrives with the deferred theming story, NOT here).
- Missing key, corrupt JSON, or an unexpected shape → **defaults, never a throw** (a broken localStorage must not brick boot).
- Unknown/older namespaces are **ignored, never migrated silently**.
- Node-testable: the localStorage backend is injectable (default guarded `window.localStorage`); unit tests use a fake. The gateway is pure logic + one effect seam.

**AC3 — Speed preference persists across matches (FR23, AD-8).**
Selecting a speed saves it through the gateway; the next battle (and the next session) starts at the saved speed with the bar reflecting it. **Singleton-scene rule (2.2 review lesson — this exact state was the named next candidate):** the speed is LOADED in `create()`, not reset — but every other transient field keeps its 2.2 reset. Skip is an action, not a preference — never persisted.

**AC4 — A worthy Result screen (FR22, FR27).**
- **Full-screen verdict banner**: Victory! / Defeat / Draw treatment that owns the screen (large type; side-colored — blue win / red loss / neutral draw — plus a simple procedural flourish, e.g. a brief banner slide/fade; zero new art).
- **Animated count-up** of BOTH final HP percentages from 0 to `BattleEnded.hpPct` (~800ms, tabular numbers; under reduced motion: land instantly). Values come ONLY from the event payload (AD-2).
- **Both compositions with real sprites**: each unit chip shows its 32px class sprite (`addUnitSprite`), 3-letter code, and the **shared 12px element dot** (`addElementBadge` — this closes the 2.1-deferred Result badge normalization; the element *word* may stay, chips have room).
- **One-tap Rematch → fresh Draft with a new seed** (existing `flow.startMatch()` path — FR27, mode carried) and one-tap Home. Both already work — do not regress them.

**AC5 — Regression guard + gate + on-device sign-off.**
Log panel, beat vocabulary, status icons, wipeout seams, and Reveal all unchanged. `pnpm -r typecheck && pnpm lint && pnpm coverage && pnpm --filter web build` green; new pure logic (gateway, speed math) unit-tested in `apps/web/test/`; scenes stay smoke-free. **Final acceptance: Danilo on his Android phone** — speed buttons respond, preference survives an app reload, skip lands on Result instantly, the verdict feels like a verdict.

## Tasks / Subtasks

- [x] **Task 1 — The `web/storage` gateway (AC2)**
  - [x] RED: 9 unit tests (defaults on missing/corrupt/wrong-shape, round-trip, key exactness, unknown-namespace ignorance, unknown-speed-id sanitization, throwing backend, missing backend) — confirmed failing first.
  - [x] GREEN: `flow/storage.ts` — `createStorage(backend?)` with `loadSettings`/`saveSettings`, `SETTINGS_KEY = 'lordly.v1.settings'`, guarded browser default, AD-8 doc comment (sole owner; history keys Epic 3).
- [x] **Task 2 — Speed model as data (AC1, AC3)**
  - [x] `BATTLE_SPEEDS` (1×/2×) + `BattleSpeedId` + `DEFAULT_SPEED_ID` + `battleSpeed(id)` sanitizer in constants; unknown persisted ids fall back to 1× (tested via the gateway suite). Beat duration = `BATTLE_BEAT_MS / factor` in `scheduleNext`.
- [x] **Task 3 — Battle control bar (AC1, AC3)**
  - [x] Press-and-hold REMOVED: `holding`/`setHolding`, the 3 global pointer listeners, `BATTLE_HINT`, `BATTLE_FAST_FORWARD`, `fastForwardMs` (+ its test) all retired — zero remnants (grep-verified). With no global pointerdown, stray taps can't touch the beat timer at all.
  - [x] Four ≥44px targets: `▶ 1×`(72) `⏩ 2×`(72) `⏭ Skip`(84) `≡ Log`(84) across 360px; speed taps persist via the gateway + redraw selected state + reschedule a pending non-silent beat immediately; same-speed taps no-op (no stall class).
  - [x] Skip: cancels the pending timer → `scene.start('Result')`; the same cached log, nothing recomputed (AD-2). Verified headlessly.
  - [x] `create()` LOADS the saved speed (the one non-reset field — singleton rule, comment updated); `speedUi` added to the reset block.
- [x] **Task 4 — Result scene polish (AC4)**
  - [x] Full-screen verdict: side-colored band (wash + edge lines) + 40px banner with Back.easeOut entrance (skipped under reduced motion).
  - [x] Count-up: one `tweens.addCounter` 0→1 over 800ms driving both percentages (mono/800, stable line), `onComplete` pins exact payload values; reduced motion lands instantly.
  - [x] Chips: 104×52 side-colored border+wash, 32px sprite, code, element word, shared 12px dot (`addElementBadge` — the last placeholder square retired; 2.1's deferred Result normalization closed).
  - [x] Rematch/Home untouched; `prefersReducedMotion` promoted to a shared `config/ui.ts` helper (BattleScene refactored onto it).
- [x] **Task 5 — Regression + gate + acceptance (AC5)**
  - [x] Headless drive: 1×→2× tap (selected state + visibly faster), `localStorage['lordly.v1.settings']={"battleSpeed":"2x"}` written, Skip → Result instantly, **full page reload → new match → bar pre-selected at 2×** (persistence proven), Log panel intact. Zero pageerrors.
  - [x] Full gate green: typecheck, lint, **267 tests** (31 files; +9 storage, −1 retired FF), build.
  - [x] On-device sign-off with Danilo (speed feel, persistence across a real reload, skip, verdict). _Danilo 2026-07-14: "everything is working as expected" — speed, persistence, skip, verdict all accepted._
### Review Findings (code review 2026-07-14)

_3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor), full mode vs baseline 5b002fb. Storage sanitizer/shape-guard, singleton reset, count-up, skip timer lifecycle, and complete press-and-hold removal all independently verified clean. 7 patch (ALL APPLIED), 0 defer, 3 dismissed. Post-patch: gate green (272 tests, +5 for the speed math/sanitizer), persistence drive re-verified clean._

- [x] [Review][Patch] Gateway can throw at backend acquisition — the "denied storage bricks boot" case AD-8 forbids [apps/web/src/flow/storage.ts:32] — reading the `window.localStorage` getter throws `SecurityError` synchronously in blocked-storage contexts, and `defaultBackend()` reads it OUTSIDE any try/catch (the try blocks are only inside load/save). Low reachability for a top-level PWA, but it's the gateway's one unguarded path and its whole contract is "never throw." Fix: wrap the getter access, return undefined on throw. (blind)
- [x] [Review][Patch] Rapidly alternating 1×/2× taps can stall the beat timer [apps/web/src/scenes/BattleScene.ts setSpeed] — a genuine speed change does `pendingTimer.remove(); scheduleNext()`, which starts a FRESH full beat wait from now instead of preserving elapsed time; sustained alternating taps restart the wait every tap → progression stalls (recoverable by stopping). Same class as the 2.2 holding-restart fix. Fix: reschedule the REMAINING beat time scaled by prevFactor/nextFactor, never a full restart. (edge)
- [x] [Review][Patch] Speed math ships untested — AC5 requires it, and prior coverage was deleted [apps/web/src/scenes/BattleScene.ts scheduleNext; constants.ts battleSpeed] — the beat-duration divide is inline in the (smoke-free) scene, the `fastForwardMs` test was removed with no replacement, and `battleSpeed()` is only tested indirectly. Fix: extract a pure `beatDurationMs(factor)` helper + direct tests for it and the `battleSpeed` sanitizer. (auditor)
- [x] [Review][Patch] Control-bar layout positionally hardcoded — a 3rd speed collides with Skip [apps/web/src/scenes/BattleScene.ts buildControlBar] — `BATTLE_SPEEDS` is framed as extensible data, but Skip/Log grab `layout[2]`/`layout[3]` by hand, so a `4x` entry would draw over Skip (overlapping hit areas). Fix: derive slot positions from the speed count. (blind)
- [x] [Review][Patch] Unselected speed button uses the DISABLED text token — reads as unavailable [apps/web/src/scenes/BattleScene.ts buildControlBar/setSpeed] — a live, tappable toggle option styled with `buttonTextDisabled` invites "1× is disabled." Fix: unselected uses normal `buttonText`; selection stays signalled by the enabled fill+stroke. (blind)
- [x] [Review][Patch] Skip has no double-tap re-entry guard [apps/web/src/scenes/BattleScene.ts skipToResult] — two rapid Skip taps before shutdown each call `scene.start('Result')`. Cheap `transitioning` boolean closes it (natural end path shares the target but is protected by the pending-timer removal). (edge)
- [x] [Review][Patch] deferred-work.md still lists the now-closed Result badge item [docs/implementation-artifacts/deferred-work.md] — the 10px square → shared 12px dot normalization shipped here; strike/annotate the deferred-work entry. (auditor)

Dismissed (3): animation tween durations don't scale at 2× so effects bleed slightly into the next beat (self-cleaning tweens, no leak; the 2× feel was accepted on-device — noted as possible future polish); `prefersReducedMotion` isn't reactive to a mid-scene OS toggle (the doc comment accurately says "from the next scene entry"); "full-screen banner" shipped as a 76px band (Task 4 specifies "band" and it passed on-device sign-off).

## Dev Notes

### AD-8 verbatim (the load-bearing contract this story introduces)
> "the `web/storage` module is the **sole** reader/writer of localStorage. It owns a key manifest under the versioned namespace `lordly.v1.*` (history, settings — e.g. battle speed); no other module touches storage APIs. […] Unknown/older namespaces are ignored, never migrated silently." [Source: ARCHITECTURE-SPINE.md#AD-8]
This story ships the gateway with **settings only**; `HistoryEntry`/replay rules in AD-8 are Epic 3's half — do not implement them. `MatchFlow` remains the only writer of *history* later (AD-13); *settings* are read/written by the scenes that own the control (BattleScene) through the gateway.

### Current code being changed (verified this session)
- **BattleScene** (`apps/web/src/scenes/BattleScene.ts`, post-2.2-review): the press-and-hold machinery to REMOVE is `holding` field + `setHolding()` (engage-only reschedule — keep that reschedule PATTERN for speed taps) + the three `this.input.on('pointerdown'/'pointerup'/'gameout')` listeners + `BATTLE_HINT` text in `buildLogPanel()`. `scheduleNext()` currently reads `this.holding ? fastForwardMs(...) : BATTLE_BEAT_MS` — becomes the speed-factor computation. The **create() reset block** (2.2 review) must keep resetting all transients; speed LOADS instead. The Log button (80×44 at `BASE_WIDTH−56`) restyles into the four-button bar.
- **`fastForwardMs`** (`flow/battleView.ts`) and `BATTLE_FAST_FORWARD` (constants) retire with press-and-hold — replace with the speed-factor helper (update `battle-view.test.ts` accordingly).
- **ResultScene** (`apps/web/src/scenes/ResultScene.ts:75-94`): `drawComposition` chips are 96×40 `cardFill` rects + code + element word + a **10×10 square** at `x+chipW/2−12` — the square becomes `addElementBadge`, and a 32px sprite joins the chip (chips likely grow to ~50px tall; 3×96+2×10 = 308 ≤ 360 ✓). Banner at `BASE_HEIGHT*0.16` 34px; HP line at 0.27 — these become the full-screen treatment + count-up. Rematch (`flow.startMatch()` → Draft) and Home handlers at :65-71 — keep as-is.
- **MatchFlow**: `startMatch(mode?)` carries mode + `lastAiArchetypeId` (FR25/FR27) — no changes needed for this story. Do NOT put settings in `MatchState` (it's match truth, not preferences).

### Singleton-scene rule (2.2 review — this story is the named next candidate)
Phaser scenes are singletons: `create()` re-runs, fields persist, and a down-event's up can die with a scene transition. The 2.2 reset block exists for exactly this; **speed is the one field that LOADS (from the gateway) rather than resets**. Skip must not leave a pending timer alive (cancel before `scene.start`). [Source: project memory phaser-scenes-are-singletons; BattleScene create() reset block]

### UX contract (binding)
- **Control bar** [Source: EXPERIENCE.md#Battle; battle-screen-mock.html]: pinned bottom bar with `▶ 1×` (selected = gold fill in the mock — the current enabled-green treatment is the accepted stand-in until the theming story), `⏩ 2×`, `⏭ Skip`, `≡ Log`. "Controls playback only; never rules." Fast-forward is opt-in, never the default first watch (default speed = 1× for a fresh install).
- **Skip** [Source: EXPERIENCE.md#State Patterns]: "Same log, played faster or resolved instantly to Result — no rule divergence (FR23, AD-2)."
- **Result** [Source: EXPERIENCE.md#Result; epics.md#Story 2.3]: "full-screen victory/defeat/draw banner, an animated count-up of both final HP percentages, and both compositions with sprites and elements, plus one-tap Rematch / Home"; rematch reaches a fresh Draft (new seed) in a single tap (FR27). Win = blue-side, lose = red-side, draw = neutral (DESIGN side rule — already true post-2.1).
- **Banned** [Source: EXPERIENCE.md#Interaction Primitives]: any control that pauses for a *rules* decision; hover-dependent affordances.

### Scope fences (must NOT)
- **No theme toggle / Settings scene** — DESIGN sketches the theme toggle "beside the battle-speed control" but the two-theme system is explicitly deferred (deferred-work.md, story-2.1 section); the settings OBJECT is extensible, the UI is not built here. Epics 2.3 contains no theme work.
- **No history keys / HistoryEntry / replay** (Epic 3 stories 3.1/3.2), **no engine changes**, **no new art**, **no Battle-scene rendering changes** beyond the control bar, **no Help/Credits** (2.4).
- Log any new wishes to `deferred-work.md`; don't self-scope.

### Hard-won lessons (memories — do not re-trip)
- **Singleton scenes**: above.
- **Taps must not stall the beat timer** (2.2 review): reschedule the pending wait only when it makes playback FASTER/changed, never restart at full duration from a stray tap. Speed-change taps SHOULD reschedule (that's the feature); Log/other taps must not (no global pointer listeners remain once press-and-hold is gone — the problem dissolves, note it in the removal).
- **Phaser 4 `add.polygon` renders quads as triangles** — irrelevant here unless the banner gets fancy; use Graphics paths if it does.
- **Text softness = the 360px backing-store ceiling** (deferred, prod-identical) — the count-up numerals will look like all other text; not a 2.3 bug.
- **Empirical over reasoned**: drive it (the puppeteer-core scratchpad pattern: `drive*.mjs`; a reload-persistence check is one `page.reload()` away).

### Testing standards
- Gateway + speed math: pure/unit tests in `apps/web/test/` (fake backend; no jsdom needed if the backend is injected). Scenes stay smoke-free.
- Engine coverage gate (≥90 lines) unaffected — no engine changes.
- `localStorage` quirk: a throwing backend (Safari private mode historically) must not crash — test it.

### Project Structure Notes
- New: `apps/web/src/flow/storage.ts` (+ `apps/web/test/storage.test.ts`). The spine's structural seed names `web/storage` — `flow/` is this repo's realized home for pure-ish shell modules (battleView, narration, MatchFlow precedent).
- Modified: `BattleScene.ts` (bar + speed), `ResultScene.ts` (verdict), `constants.ts` (speeds as data; retire `BATTLE_FAST_FORWARD`/`BATTLE_HINT`), `battleView.ts` (retire/replace `fastForwardMs`), tests.
- Both 2.1 and 2.2 are committed and deployed (`5b002fb` on prod) — clean baseline.

### References
- [Source: docs/planning-artifacts/epics.md#Story 2.3 (lines 431–450)] — the three BDD ACs (controls, persistence, result).
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-8] — the gateway rule (quoted above); AD-13 (MatchFlow owns history writes — later); AD-2 (skip = same log).
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md#Battle, #Result, #State Patterns, #Interaction Primitives] + [DESIGN.md#Components button/theme-toggle note] + [mockups/battle-screen-mock.html control bar].
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md] — FR22 (result), FR23 (speed/skip), FR25 (AI no-repeat), FR27 (rematch loop), NFR5 (persistence resilience).
- Code: `apps/web/src/scenes/BattleScene.ts` (bar/holding/scheduleNext), `apps/web/src/scenes/ResultScene.ts` (chips/banner), `apps/web/src/flow/MatchFlow.ts:53` (startMatch), `apps/web/src/config/constants.ts`, `apps/web/src/config/ui.ts` (addUnitSprite/addElementBadge/crispText).
- Prior stories: `2-2-…md` (control-bar groundwork, singleton lesson, review findings), `2-1-…md` (sprite/badge helpers), `deferred-work.md` (theming fence, Result-badge normalization → closed HERE).

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code

### Implementation Plan

TDD on the gateway first (RED 9 tests → GREEN `flow/storage.ts`), speed model as data in constants, then the scene work: control bar replacing press-and-hold in BattleScene, verdict/count-up/sprite-chips in ResultScene, `prefersReducedMotion` promoted to `config/ui.ts`. Every behavior headless-driven (speed switch, skip, reload persistence) before booking.

### Debug Log References

- RED: storage suite fails on missing module → GREEN 9/9; full suite 267/267 (31 files).
- Press-and-hold removal grep-verified to zero remnants (`BATTLE_FAST_FORWARD`/`fastForwardMs`/`BATTLE_HINT`/`holding`/`gameout`).
- Headless drive5: `[stored] {"battleSpeed":"2x"}` on tap; `[after-reload] {"battleSpeed":"2x"}`; bar pre-selected 2× in the post-reload match; skip landed on Result instantly; zero pageerrors.

### Completion Notes List

- **AC1 ✅** Four-button bar (1×/2×/Skip/Log, all ≥44px); speed applies mid-beat (reschedule); skip = instant Result off the same cached log (AD-2); press-and-hold + its whole machinery retired per EXPERIENCE.md.
- **AC2 ✅** `web/storage` gateway: sole localStorage owner, `lordly.v1.settings` only, versioned-namespace ignorance, corrupt/wrong-shape/throwing/missing-backend resilience — all test-pinned (9 tests). History keys explicitly left for Epic 3.
- **AC3 ✅** Speed persists across matches AND reloads (headless-proven). Singleton-scene rule honored: speed LOADS in create(), everything else keeps the 2.2 reset (+`speedUi`).
- **AC4 ✅** Full-screen side-colored verdict band + entrance, 800ms dual count-up pinned to `BattleEnded.hpPct` on complete, sprite chips with side borders + the shared element dot (Result badge normalization done — the deferred-work item can be struck). Rematch/Home untouched.
- **AC5 ✅→⏳** Gate green (267 tests), regressions driven clean (Log panel, wipeout untouched paths). Remaining: Danilo's on-device sign-off.
- Scope fences honored: no theme toggle/Settings scene, no history keys, no engine changes, no new art.

### File List

- `apps/web/src/flow/storage.ts` — NEW: the AD-8 gateway (settings only)
- `apps/web/test/storage.test.ts` — NEW: 9 gateway tests
- `apps/web/src/config/constants.ts` — MODIFIED: `BATTLE_SPEEDS`/`battleSpeed`/`DEFAULT_SPEED_ID`/`BATTLE_SKIP_LABEL`; retired `BATTLE_FAST_FORWARD` + `BATTLE_HINT`
- `apps/web/src/scenes/BattleScene.ts` — MODIFIED: control bar (speed/skip), storage-loaded speed, press-and-hold machinery removed, `prefersReducedMotion` shared helper
- `apps/web/src/scenes/ResultScene.ts` — MODIFIED: verdict band + count-up + sprite chips with shared dot
- `apps/web/src/config/ui.ts` — MODIFIED: `prefersReducedMotion` shared helper
- `apps/web/src/flow/battleView.ts` — MODIFIED: `fastForwardMs` retired
- `apps/web/test/battle-view.test.ts` — MODIFIED: FF test retired
- `docs/implementation-artifacts/sprint-status.yaml`, this story file — MODIFIED: tracking

### Change Log

- 2026-07-14: Story 2.3 implemented — FR23 tappable speed (1×/2×, persisted via the new AD-8 `web/storage` gateway) + skip-to-result; press-and-hold interim retired; Result verdict polish (full-screen band, HP count-up, sprite chips + shared element dot). 267 tests green; speed persistence proven across a full page reload headlessly. Pending: on-device sign-off.

### Debug Log References

### Completion Notes List

### File List

- 2026-07-14 (code review): 3-layer adversarial review vs 5b002fb — 7 patches applied (gateway acquisition guard, scaled-remaining speed reschedule killing the alternating-tap stall, pure beatDurationMs + sanitizer tests restoring AC5 coverage, derived bar layout, live label color, Skip re-entry guard, deferred-work strike), 3 dismissed. Gate re-run green (272 tests); persistence re-driven clean. Status → done.
