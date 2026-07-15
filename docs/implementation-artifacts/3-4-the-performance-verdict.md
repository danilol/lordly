# Story 3.4: The performance verdict

Status: ready-for-dev

## Story

As a player,
I want the game fast and light on a normal phone,
so that it feels like a real game, not a heavy web page.

## Acceptance Criteria

1. **Frame rate (NFR1).** On a Pixel 6a-class Android phone in Chrome, the full experience — busiest battle animation, draft, placement — sustains the 60fps target and never drops below the 30fps floor, measured and documented.
2. **Cold load (NFR1).** On a throttled 4G connection, the production URL loads cold and is interactive in ≤5 seconds; the initial compressed bundle is ≤3MB; the measurement method is documented. Any hotspot found (atlas size, engine pass, scene churn) is fixed within this story or filed with a measured baseline and a concrete follow-up if genuinely out of scope.
3. **Recorded with evidence (NFR3).** Results are written to the repo docs, closing the MVP's performance requirement with evidence rather than assumption — not assertion.

## Tasks / Subtasks

- [ ] Task 1: FPS/frame-time instrumentation (AC: 1)
  - [ ] The codebase has ZERO existing perf instrumentation (verified: no `requestAnimationFrame`, `actualFps`, or FPS overlay anywhere in `apps/web/src`; `main.ts:31-49`'s `Game` config carries no `fps:` block). Add a minimal, dev-only frame-time sampler — **sample PER RENDERED FRAME (~60/sec), NOT per beat (~2-7/sec)**: `BattleScene` has no `update()` method today, but Phaser calls a scene's `update(time, delta)` EVERY frame automatically once one exists — add it (or hook `this.events.on(Phaser.Scenes.Events.UPDATE, ...)`) and sample `this.game.loop.actualFps` there. Sampling from the beat dispatcher (`render(event: BattleEvent)`, BattleScene.ts:260-342 — a DIFFERENT method, fires once per ~150-600ms beat, not once per frame) would give ~5 samples/sec and completely miss the mid-beat tween stutters (wash circles, popups) Task 5 is worried about. The same per-frame hook must exist on Draft/Placement too (Task 2's other benchmarks) — make it a small reusable mixin/helper, not BattleScene-only code, since neither of those scenes has a beat dispatcher to piggyback on anyway
  - [ ] Keep it OFF the render path in production — a `?perf=1` query-param gate (the codebase's existing diagnostic-flag pattern — `config/ui.ts:27-41` has the precedent for `?textres=N`; no scene currently reads `URLSearchParams` directly, so a new small module alongside it is the right shape) that logs to `console` and exposes a `window.__perfSamples` array `page.evaluate` can read
  - [ ] No new npm dependency (matches the story 3.2/3.3 zero-new-deps discipline) — this is ~20 lines, not a library
- [ ] Task 2: A reproducible "busiest battle" benchmark (AC: 1)
  - [ ] Reuse story 3.2's Replay feature as the repeatability seam: construct a wipeout-mode `MatchSetup` for the heaviest known composition — `three-mages` vs `three-mages` (`packages/engine/src/ai.ts:81`, both back-row, so every blast hits all 3 targets every pass) is the worst-case beat: 3 simultaneous `wash` circles (BattleScene.ts:423-428) + 3 `popup` texts (BattleScene.ts:512-530) + a `PoisonTicked`/status flurry across up to 5 engagements (`BALANCE.engagementCap`). Seed one `HistoryEntry` with this setup directly into `lordly.v1.history` (the 3.1/3.2 drive-harness technique) and tap Replay — deterministic, scriptable, and re-runs identically on every measurement pass
  - [ ] Also benchmark Draft (many sprite/text redraws on rapid taps) and Placement (drag) — lighter, but AC1 names them explicitly
- [ ] Task 3: On-device + headless frame-rate measurement (AC: 1)
  - [ ] Primary evidence: Danilo on his own Pixel-6a-class device via Chrome remote debugging (`chrome://inspect`) — Performance panel recording across the Task 2 benchmark battle at normal AND ×2 speed (the worse case), reading the FPS meter / frame-time chart directly. This is the real, load-bearing measurement — a laptop's headless Chrome is not a Pixel 6a
  - [ ] Secondary/regression evidence: headless-Chrome CDP trace (the established puppeteer-core recipe — see 3.2/3.3 story Dev Notes; rebuild the ~40-line script per session in scratchpad, NOT committed) with `Emulation.setCPUThrottlingRate` (~4x, a rough Pixel-6a-vs-dev-laptop ratio) driving the same Replay benchmark, reading `window.__perfSamples` from Task 1. Useful for a fast pre-check before bothering with a physical device, but the on-device numbers are the acceptance evidence
  - [ ] Record: min/median/1%-low fps per scenario, whether the 30fps floor was ever breached, and under what conditions (normal vs ×2 speed — FR23's speed control is the worst-case multiplier, since beats complete faster with the same object churn)
- [ ] Task 4: Bundle size + cold-load interactive time (AC: 2)
  - [ ] Bundle: `pnpm --filter web build`, then measure `apps/web/dist/assets/*.js` gzip (and note brotli) sizes — methodology: report the INITIAL bundle (the two chunks the entry HTML loads: `phaser-*.js` + `index-*.js`; PWA precache extras like icons/sw.js are NOT part of the "initial bundle" the 3MB budget targets, they're offline infrastructure from story 3.3). At last measurement (2026-07-15, pre-3.4 changes) this was **~0.36 MB gzip / ~0.29 MB brotli — about 12% of the 3MB budget**; re-measure fresh, don't trust a stale number
  - [ ] Cold-load interactive time: Chrome DevTools Network throttling preset "Slow 4G" (or `page.emulateNetworkConditions` in a headless script) against the DEPLOYED prod URL (not localhost — real TLS/CDN latency matters), timing from navigation start to the Home scene's "Play vs AI" button being tappable. **Do NOT use CDP network emulation under conditions where a service worker might intercept** (the exact false-pass trap documented in story 3.3's Dev Notes, Chromium bug 852127) — for a COLD load this is moot (no SW registered yet on first-ever visit), but if re-testing an already-installed device, clear site data first so the fetch genuinely goes over the throttled network
  - [ ] If either budget is breached: profile with the browser's Coverage/Performance panels, fix the hotspot, re-measure. If genuinely out of scope for this story, file it in `deferred-work.md` with the measured baseline and a concrete follow-up (AC2's explicit escape hatch) — do not silently ship over-budget
- [ ] Task 5: The GameObject-churn hotspot — measure before touching (AC: 1, 2)
  - [ ] The one architecturally-plausible hotspot, found by code reading, NOT yet measured: `BattleScene.render()` creates and destroys GameObjects on nearly every beat with zero pooling — `popup()` (BattleScene.ts:512-530, a new `crispText` per damage/heal/status/misfire/fizzle/poison-tick beat — almost every beat has one), `attackFlavor()`'s per-target `wash` circles for Mage blasts (BattleScene.ts:423-428, up to 3 per beat), `healGlow()` (BattleScene.ts:446-451). `crispText` is the most expensive Phaser GameObject type in this codebase (the same supersampled-glyph primitive behind the deferred text-ceiling issue — see Dev Notes). **Do not preemptively pool or optimize this** — the codebase's established doctrine is empirical-over-reasoned (screenshot/measurement-verified, not guessed; see the Phaser-quirks memory). Measure first (Tasks 2-3); only build a pooling fix if the data shows a real floor breach during the three-mages-wipeout benchmark. If fps holds, document the finding and move on — a fix with no measured problem is exactly the kind of unrequested scope this codebase's conventions reject
- [ ] Task 6: The text-ceiling item — link, don't re-diagnose or fix (AC: 2, 3)
  - [ ] `deferred-work.md`'s "REOPENED: text still reads soft" entry is ALREADY fully diagnosed (canvas backing fixed at 360×640 regardless of DPR) and explicitly flagged as needing verification "against NFR1's 60fps budget" before any of its candidate fixes (DPR-sized backing, 720×1280 redesign, DOM overlay — all multiply GPU fill cost up to ~9×) can be scheduled. This story does NOT implement any of those fixes (they are not in the epics.md ACs for 3.4) — it only needs to (a) confirm the CURRENT fps numbers from Task 3 as the baseline the eventual fix must not regress below, and (b) cross-link that baseline into the deferred-work entry so whoever picks up the text-ceiling fix later inherits a real number instead of re-measuring from scratch
- [ ] Task 7: Record the verdict (AC: 3)
  - [ ] New `docs/performance-verdict.md` (repo-root docs convention, like `docs/rules.md`) — NOT an ADR (no architectural decision is being made, only measurements recorded): device/browser used, methodology per Tasks 3-4, the three-mages-wipeout benchmark composition and why it's worst-case, fps numbers (min/median/1%-low, normal + ×2 speed), bundle size (gzip/brotli, initial-vs-full breakdown), cold-load interactive time, pass/fail against NFR1's 60/30/5s/3MB, and any hotspot fixed or filed
  - [ ] Link from README (one line, alongside the 3.3 "Install / offline" note) and from `deferred-work.md`'s text-ceiling entry (Task 6)
- [ ] Task 8: Gate + device sign-off (all ACs)
  - [ ] Full gate green (typecheck, lint, all tests, engine coverage untouched — this story should add zero or near-zero engine/test surface; the perf sampler is dev-web-only)
  - [ ] Danilo's on-device measurement session IS this story's evidence (Task 3) — there is no separate "on-device acceptance" step after the fact the way 3.0-3.3 had it; the device session produces the numbers Task 7 records. Sign-off = Danilo confirms the recorded verdict matches what he observed

## Dev Notes

### There is no existing perf scaffolding — this is greenfield methodology

Confirmed by direct search: zero `requestAnimationFrame`/`actualFps`/FPS-overlay code anywhere in `apps/web/src`; zero Lighthouse config, `web-vitals` dependency, or perf npm script in any of the three `package.json` files; zero CI perf job (`.github/workflows/ci.yml` only builds + deploys). No retro or prior story ever recorded a measured fps number — **3.4 is the first time this happens for real.** Do not assume a prior "it felt fine on device" comment (epic-2 retro) constitutes measurement — it's the reason this story exists.

### The reproducible-benchmark trick: reuse Replay (3.2)

Story 3.2 built the exact seam this story needs for free: `MatchFlow.startReplay(setup)` re-resolves a stored `MatchSetup` deterministically (FR20) and plays it through the unmodified Battle scene. Seed one `HistoryEntry` for `three-mages` vs `three-mages` (`packages/engine/src/ai.ts:81` — both mage-only, back-row) in wipeout mode directly into `lordly.v1.history` (same technique as the 3.1/3.2 drive scripts: `page.evaluate((d) => localStorage.setItem('lordly.v1.history', d), JSON.stringify([entry]))`), then tap the Replay button. This gives a **byte-identical, scriptable worst-case battle** to profile against, on-device or headless, as many times as needed — no manual drafting required per run.

### Per-frame vs per-beat — don't conflate them (the sampler's whole point)

`BattleScene.render(event: BattleEvent)` (BattleScene.ts:260-342) is the BEAT dispatcher — it runs once per log event (~150-600ms apart depending on speed), not once per rendered frame (~16ms apart at 60fps). Frame rate is a property of the render loop, not the beat loop: a beat can look instantaneous in the log while the tweens/objects it spawned animate across MANY frames afterward, and that's exactly where a frame could drop. Task 1's sampler must hook actual per-frame callbacks (`update(time, delta)` or the `UPDATE` scene event), never the beat dispatcher — sampling at beat cadence would produce ~5 samples/sec and silently miss every stutter this story exists to catch.

### The one real hotspot candidate (measure, don't guess-fix)

Per-beat GameObject creation with NO pooling anywhere (this churn happens once per BEAT, but its cost is paid across the FRAMES that follow while tweens animate):
- `popup()` (BattleScene.ts:512-530): new `crispText` per beat carrying a number/word (damage, heal, status name, "confused!", "fizzle", poison tick — nearly every beat qualifies), destroyed via tween `onComplete` ~500ms later.
- `attackFlavor()` (BattleScene.ts:380-429): a new `rectangle` "arrow" for Archer shots (:408-411); a new `circle` "wash" **per struck target** for Mage blasts (:423-428) — up to 3 in one beat against a full back row.
- `healGlow()` (BattleScene.ts:446-451): a new `circle` per heal.
- `resetSprite()` (BattleScene.ts:369-372) calls `this.tweens.killTweensOf(v.sprite)` on nearly every action — tween churn, not GameObject churn, but still per-beat allocation.
- Persistent (NOT per-beat, don't confuse with the above): `applyStatusIcon()` (BattleScene.ts:462-473) creates one icon per unique status per unit, kept until cleared — this one is fine, it's bounded by unit count not beat count.
- `buildUnit()` (BattleScene.ts:199-233) creates the 5-GameObjects-+-container-per-unit rig ONCE at battle start (6 units max) — not a per-beat concern.

**Do not fix this preemptively.** The codebase's established doctrine (three Phaser quirks memorized in epic 2, all "caught by screenshot, never by reasoning") is empirical-over-reasoned. If the three-mages-wipeout benchmark holds 30fps+ on Danilo's device, the correct action is to document the finding, not add pooling nobody asked for. If it breaks the floor, THEN a small object pool for `popup`/`wash`/`healGlow` (reuse-and-reset instead of create-and-destroy) is the targeted, measured fix — implement it only in that branch.

### The text-ceiling cross-link (do not re-open this can)

`deferred-work.md`'s "REOPENED: text still reads soft" entry already diagnosed the root cause precisely (canvas backing store fixed at 360×640 regardless of devicePixelRatio; no `?textres=N` value can ever fix it) and named three candidate fixes, all flagged as needing fps verification because they multiply GPU fill cost up to ~9× on a Pixel 6a. **None of the three fixes are in scope for 3.4** — epics.md's ACs for this story say nothing about text resolution or DPR. This story's only obligation to that item is supplying the CURRENT fps baseline (Task 3's numbers) so that whoever eventually implements one of those three fixes has a real "must not regress below this" number instead of re-measuring from scratch. Link, don't relitigate.

### Bundle size is already comfortable — verify, don't assume

Last measured (2026-07-15, before any 3.4 changes): `phaser-*.js` + `index-*.js` gzip ≈ 0.36 MB (brotli ≈ 0.29 MB) against the 3MB budget — roughly 12% used. The game draws everything with Phaser primitives plus one 4KB inlined sprite sheet; there's no texture-atlas bloat to chase. **Re-measure fresh** rather than citing this number in the final doc — a `pnpm install`/dependency bump between now and implementation could shift it, and "measured, not guessed" is the whole point of this story.

### Architecture compliance

- Zero engine changes expected — this is entirely `apps/web` instrumentation + measurement + (conditionally) a `BattleScene` object-pooling fix if data demands it.
- AD-2 (log-player purity) must hold even if Task 5's pooling fix ships: pooling changes HOW a GameObject is obtained, never WHAT the scene decides to render — the scene still derives every visual purely from `BattleEvent` payloads.
- The `?perf=1` diagnostic flag (Task 1) follows the same pattern as the deferred `?textres=N` — a query-param gate, never a default-on runtime cost, never touching `import.meta.env` (the codebase has zero DEV/PROD behavior forks today — don't introduce the first one carelessly; gate on the query string, not on env).
- NFR3: the verdict doc is NOT an ADR (`docs/adr/` is for load-bearing architectural DECISIONS, per the 0001/0002 precedent) — it's a measurement record, so it's a plain doc at `docs/performance-verdict.md`.

### Testing standards summary

This story is unusually light on unit tests — its "test" IS the measurement session. If Task 1's sampler or Task 5's pooling fix touch shared code, cover them with the existing Vitest suite (smoke-level for scenes, per the spine convention); don't invent new test infrastructure for a one-off perf harness. Full gate (`pnpm coverage`) must still stay green — this story should not regress the 344-test baseline from 3.3.

### Previous story intelligence (3.0-3.3, same sprint)

- The `?query=value` diagnostic-flag pattern, the headless-puppeteer-core drive recipe (rebuilt per session, not committed), and the "seed localStorage directly for a reproducible scenario" trick are all established conventions from 3.0-3.3 — reuse them verbatim rather than inventing new ones.
- 3.3's Dev Notes contain a real CDP gotcha worth remembering here too: network/offline emulation under CDP doesn't reliably reach service-worker-intercepted fetches. For a genuinely cold load this doesn't apply (no SW yet), but be deliberate about it if any measurement re-tests an already-installed PWA.
- The house standard for "done" on every 3.x story has been Danilo's own on-device confirmation, quoted verbatim into the story file. This story is unusual in that the on-device session IS the work product (Task 3), not a separate final check — call this out explicitly so the workflow doesn't expect a redundant final device pass.
- Sim harness precedent: `STRATEGY_POOL` archetype names and shapes (`packages/engine/src/ai.ts`) are stable and safe to reference by id for the benchmark composition.

### Project Structure Notes

- New: `docs/performance-verdict.md`. Possibly modified: `apps/web/src/main.ts` or a new small module for the `?perf=1` sampler (dev's call on exact location — keep it out of `flow/` since it's not match logic; a `config/perf.ts` alongside `config/ui.ts` fits the existing structure). Possibly modified: `apps/web/src/scenes/BattleScene.ts` ONLY if Task 5's measurement demands the pooling fix. Modified: `README.md` (one line), `docs/implementation-artifacts/deferred-work.md` (the text-ceiling cross-link).
- No wrangler/CI changes expected.

### References

- [Source: docs/planning-artifacts/epics.md#Story-3.4] — the exact BDD ACs (NFR1/NFR3)
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#NFR1] — "60fps target, 30 floor... initial load ≤5s on 4G"
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md] — NFR1 performance-budget convention, "checked at review, not yet tooled" (this story tools it)
- [Source: apps/web/src/scenes/BattleScene.ts:199-233,260-342,369-372,380-429,446-451,462-473,512-530] — buildUnit, render dispatcher, resetSprite, attackFlavor, healGlow, applyStatusIcon, popup — the full per-beat churn map
- [Source: packages/engine/src/ai.ts:59-161] — STRATEGY_POOL, incl. `three-mages` (id, line 81) — the benchmark composition
- [Source: apps/web/vite/config.prod.mjs] — terser/manualChunks build config (bundle measurement baseline methodology)
- [Source: docs/implementation-artifacts/deferred-work.md] — the text-ceiling diagnosis (full quote in Dev Notes)
- [Source: docs/implementation-artifacts/epic-2-retro-2026-07-14.md] — "the deferred formal fps check + text-ceiling fix both point at 3.4" (scheduling pointer, not a hard AC)
- [Source: docs/implementation-artifacts/3-2-replay-any-remembered-battle.md; 3-3-install-it-play-it-offline.md] — the Replay-as-benchmark-seam idea, the puppeteer-core drive recipe, the CDP-offline-emulation gotcha

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
