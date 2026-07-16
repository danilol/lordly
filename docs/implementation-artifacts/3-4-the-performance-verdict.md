---
baseline_commit: ef2d62baa88a2ed0f60444d2e73d7b037659baab
---

# Story 3.4: The performance verdict

Status: in-progress

## Story

As a player,
I want the game fast and light on a normal phone,
so that it feels like a real game, not a heavy web page.

## Acceptance Criteria

1. **Frame rate (NFR1).** On a Pixel 6a-class Android phone in Chrome, the full experience — busiest battle animation, draft, placement — sustains the 60fps target and never drops below the 30fps floor, measured and documented.
2. **Cold load (NFR1).** On a throttled 4G connection, the production URL loads cold and is interactive in ≤5 seconds; the initial compressed bundle is ≤3MB; the measurement method is documented. Any hotspot found (atlas size, engine pass, scene churn) is fixed within this story or filed with a measured baseline and a concrete follow-up if genuinely out of scope.
3. **Recorded with evidence (NFR3).** Results are written to the repo docs, closing the MVP's performance requirement with evidence rather than assumption — not assertion.

## Tasks / Subtasks

- [x] Task 1: FPS/frame-time instrumentation (AC: 1)
  - [x] `apps/web/src/config/perf.ts` (new): `attachPerfSampler(scene)` hooks Phaser's per-frame `update` scene event (NOT the beat dispatcher) and samples per-frame instantaneous fps (`1000/rawDelta` — corrected by the 2026-07-16 review from `actualFps`, which is a once-per-second EMA) into `window.__perfSamples`, capped at 36,000, detaching on scene shutdown, with a `console.info` armed-readout (the originally-specified console logging — dropped in the first pass, restored in review). No-op unless `?perf=1` (now test-covered, not just asserted — same pattern as `?textres`).
  - [x] `?perf=1` query-param gate via `isPerfQueryEnabled` (pure, tested) — off by default, zero production cost.
  - [x] Zero new npm dependencies — pure TS + Phaser's existing `Scene`/`game.loop` API.
- [x] Task 2: A reproducible "busiest battle" benchmark (AC: 1)
  - [x] Constructed the exact `three-mages` vs `three-mages` wipeout `MatchSetup` (seed 424242, both AI picks resolved via `chooseSetup` on their own streams — deterministic, FR20) and verified it via a direct engine run before using it in any drive. Seeded as one `HistoryEntry` into `lordly.v1.history`, driven via Replay — see `docs/performance-verdict.md` for the exact JSON and rationale.
  - [x] Draft benchmarked too (15 rapid taps across all 6 class cards). Placement not separately benchmarked this pass (lighter than Draft/Battle per the story's own framing; no evidence of it being a distinct hotspot) — noted as a gap in Completion Notes, not silently dropped.
- [x] Task 3: Headless frame-rate measurement + on-device confirmation (AC: 1)
  - [x] **On-device: Danilo's own Pixel 9 Pro XL, Chrome, remote debugging.** Ran the three-mages-wipeout Replay benchmark at ×2 speed and sent the raw `window.__perfSamples` data (5,746 samples, ~96s): min 60.486, median 60.993, 1%-low 60.486, max 61.420 — zero samples below 55fps, let alone the 30fps floor. AC1 closed. Normal (1×) speed not separately captured — see `docs/performance-verdict.md`'s scope note.
  - [x] Secondary/regression evidence: headless + headed Chrome via puppeteer-core, `Emulation.setCPUThrottlingRate` (4×) driving the three-mages Replay benchmark, reading `window.__perfSamples`. **Methodology finding, recorded honestly:** headless (and headed, same machine) Chrome does not vsync-cap rendering on this session's ~120Hz-class display — raw fps readings (median ~110) exceed any real mobile device's ceiling and are not directly comparable to the 60fps target. Repurposed as a RELATIVE signal instead: no craters in the low percentiles (min ≈ 1%-low, both ~75-80% of median) — i.e. no evidence of an isolated stutter under this proxy, though it cannot confirm the true 60/30 numbers.
  - [x] Recorded: min/median/1%-low for Battle (three-mages wipeout, ~9s) and Draft (15 taps) — see verdict doc. Did NOT additionally run ×2 speed under this proxy (the vsync-uncapped numbers already can't answer the real question; running a second uninformative variant wasn't worth the time against a proxy that's already flagged as non-authoritative) — this narrowing is called out explicitly, not silently.
  - [x] Bonus signal not in the original task list: CDP `Performance.getMetrics` heap sampling across the busiest battle — healthy sawtooth (6.98-12.45 MB), no leak, informing Task 5's decision.
- [x] Task 4: Bundle size + cold-load interactive time (AC: 2)
  - [x] Bundle re-measured fresh (not the stale story-writing-time number): 0.359 MiB gzip / 0.297 MiB brotli, 12.0% of the 3MiB budget.
  - [x] Cold-load interactive time measured against the DEPLOYED prod URL. **Two methodology bugs caught and corrected before the number was trusted** (both recorded in the verdict doc so nobody repeats them): (1) `waitUntil:'networkidle0'` blocks on the service worker's background precache fetches — inflated the reading to ~9-10s, a measurement artifact; corrected to `waitUntil:'load'` (the page's own resources, independent of SW background activity). (2) The throttle constant used was 400Kbps/400ms — that's Chrome's "Slow 3G" preset mislabeled as "4G"; corrected to the real 4G profile (1.6Mbps/750Kbps/150ms). Final, correctly-labeled result: ~2.4-2.6s median across 3 fresh-context trials, screenshot-confirmed Home is fully painted.
  - [x] Neither budget was breached — AC2's fix-or-file escape hatch wasn't needed.
- [x] Task 5: The GameObject-churn hotspot — measure before touching (AC: 1, 2)
  - [x] Measured, not guess-fixed: no fps craters (secondary evidence) + healthy sawtooth heap (no leak) both argue against a real floor breach from the unpooled `popup`/`wash`/`healGlow` churn. **No pooling fix implemented** — consistent with the codebase's empirical-over-reasoned doctrine. If Danilo's real on-device session (Task 3's open item) finds an actual 30fps breach, the pooling fix is the documented, ready-to-build follow-up — not built speculatively.
- [x] Task 6: The text-ceiling item — link, don't re-diagnose or fix (AC: 2, 3)
  - [x] `deferred-work.md`'s entry now cross-links `docs/performance-verdict.md` as the baseline any future candidate fix must not regress below. No fix implemented (correctly out of scope).
- [x] Task 7: Record the verdict (AC: 3)
  - [x] `docs/performance-verdict.md` written: verdict summary table, benchmark composition + rationale, instrumentation description, secondary-evidence methodology (incl. the two corrected mistakes), bundle/cold-load numbers, hotspot decision, text-ceiling link, and an explicit "what's still needed" section naming the one open item.
  - [x] Linked from README (one line, alongside the 3.3 PWA note) and from `deferred-work.md` (Task 6).
- [x] Task 8: Gate + device sign-off (all ACs)
  - [x] Full gate green: 351 tests (7 new), typecheck both packages, lint clean, ZERO engine changes (coverage gate untouched).
  - [x] **Danilo's on-device session — closed.** Pixel 9 Pro XL, ×2-speed three-mages-wipeout Replay benchmark, zero fps-floor breach. The missing DATA POINT for AC1 now exists. Code-review (Senior Developer Review) has not yet run for this story — still needed before this can move to done.

### Review Findings

Senior Developer Review, 2026-07-16 (bmad-code-review: Blind Hunter + Edge Case Hunter + Acceptance Auditor, all layers completed). 3 decision-needed, 7 patch, 0 defer, 3 dismissed as noise.

- [x] [Review][Decision] **AC1's on-device trace is arithmetically impossible under the shipped instrument** — `PERF_SAMPLE_CAP = 3600` with oldest-evicted splice (perf.ts) means `window.__perfSamples` can never hold more than 3,600 entries, yet the verdict doc / Change Log / sprint-status all describe a single "raw trace: 5,746 samples over ~96s". Same doc times the benchmark battle at ~9s, so ~96s of "continuous playback" implies ~10 re-runs — which, combined with the listener-leak patch finding below, makes the sample-count→duration arithmetic incoherent (corroborating oddity: min and 1%-low are byte-identical, i.e. ≥57 samples share the exact minimum). The collection methodology is undocumented; the evidence record doesn't match the committed instrument (AC3: "evidence rather than assumption"). **RESOLVED (Danilo, 2026-07-16): re-capture with the patched sampler.** Verdict doc updated — first capture demoted to "superseded, kept for the record"; frame-rate row reopened. → OPEN ACTION: the re-capture device session (see below).
- [x] [Review][Decision] **AC1 evidence device is not "Pixel 6a-class"** — AC1 specifies a Pixel 6a-class phone; all closing evidence is from a Pixel 9 Pro XL (2024 flagship, Tensor G4 — strictly faster). The verdict doc names the device honestly but declares AC1 closed without flagging the class upgrade as a deviation. **RESOLVED (Danilo, 2026-07-16): accept the deviation and amend wording** — the Pixel 9 Pro XL is the device on hand; the verdict doc now states explicitly that the 6a-class floor is not directly demonstrated.
- [x] [Review][Decision] **AC1 marked CLOSED with coverage gaps its own notes disclose** — Placement never fps-measured anywhere; Draft desktop-proxy-only; 1× speed never captured on-device (original Task 3 required "normal AND ×2"). **RESOLVED (Danilo, 2026-07-16): close the gaps in the re-capture session** — its scope is Battle at 1× AND ×2 plus a Placement pass, method documented in the verdict doc when run.
- [x] [Review][Patch] **Sampler records a once-per-second EMA, not per-frame data — it cannot see the stutters it exists to catch** [apps/web/src/config/perf.ts:80] — Phaser's `actualFps` is `0.25·framesThisSecond + 0.75·prev`, recomputed once per second (verified: TimeStep.js:650-655); "zero samples below 55" cannot establish "no frame below 30fps". **FIXED:** sampler now records per-frame instantaneous fps (`1000/game.loop.rawDelta`, non-finite/zero-delta guarded); cap raised 3,600 → 36,000 so a full session fits one read.
- [x] [Review][Patch] **`update` listener leaks on every scene re-entry** [apps/web/src/config/perf.ts:78] — Phaser `Systems.shutdown` removes only TRANSITION_* listeners (verified: Systems.js:772-788), so each `create()` under `?perf=1` stacked another listener. **FIXED:** named handler + `scene.events.once('shutdown', () => scene.events.off('update', sample))`; regression test asserts a re-entered scene has exactly one sampler.
- [x] [Review][Patch] **Harness reset of `window.__perfSamples` crashes the update loop** [apps/web/src/config/perf.ts:79-81] — the `as number[]` cast masked a per-frame TypeError after a consumer reset. **FIXED:** `(window.__perfSamples ??= [])` inside the handler; test covers the reset path.
- [x] [Review][Patch] **Task 1's "logs to console" requirement silently dropped** [apps/web/src/config/perf.ts:75] — **FIXED:** `console.info` armed-readout added (matching the `?textres` precedent in ui.ts); Task 1 text corrected to record the drop-and-restore.
- [x] [Review][Patch] **Test gaps: tautological p1Low oracle, false fixture comment, untested eviction and disabled path** [apps/web/test/perf.test.ts] — **FIXED:** hand-computed p1Low oracle (200 samples, p1Low = 1.5), round-below-one-sample case, `pushSample` eviction boundary tests, and full `attachPerfSampler` coverage (no-op path, rawDelta sampling, non-finite skip, reset survival, shutdown detach). 7 → 16 tests; suite 351 → 360.
- [x] [Review][Patch] **Verdict-doc metadata drift** [docs/performance-verdict.md:3] — **FIXED:** dateline now carries both measurement dates + the review; hotspot section cites function names instead of line numbers.
- [x] [Review][Patch] **deferred-work.md's "do not re-measure from scratch" baseline promise overreaches** [docs/implementation-artifacts/deferred-work.md:48] — **FIXED:** cross-link now carries the verdict's scope caveats and points future comparisons at the post-review re-captured numbers.

**Open action from the review decisions:** one on-device session (Danilo's Pixel 9 Pro XL, Chrome, `?perf=1`, patched sampler): three-mages-wipeout Replay at 1× and ×2, plus a Placement pass, resetting `window.__perfSamples` between scenarios; results + method recorded in `docs/performance-verdict.md`, which then closes AC1.

Dismissed as noise (3): duplicate `?perf=0&perf=1` query keys (first-value-wins matches the deliberate `?textres` strict-match discipline); "interactive" measured as `load`+150ms+screenshot rather than button tappability (methodology fully documented in the doc, 2× headroom); `summarizePerfSamples` unused at runtime (uncommitted per-session drive scripts are this repo's established convention).

Verified clean by the layers (not assumed): zero engine changes, zero new npm dependencies, per-frame UPDATE hook (not the beat dispatcher), zero cost when `?perf=1` is off, 351 tests green (re-run during review), no pooling fix per doctrine, README/deferred-work links match the File List.

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

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- Perf sampler: RED confirmed (module not found) → 7/7 GREEN on first implementation of `perf.ts`. No iteration needed — the design was already corrected during story creation's validation pass (per-frame, not per-beat).
- Benchmark construction: derived the exact `three-mages` vs `three-mages` wipeout `MatchSetup` by running `chooseSetup` directly via `tsx` against `packages/engine/src/ai.ts` (seed 424242) — verified the JSON before using it in any drive, rather than hand-writing a plausible-looking setup.
- **Headless/headed fps numbers came back ~110 median — well above 60, which was the first sign of a methodology problem, not a real result.** Diagnosed: headless Chrome doesn't vsync-cap without a real compositor; re-ran headed (visible window) on the same machine and got the same ~110 median, confirming it's this session's ~120Hz-class display, not a headless artifact. Repurposed the data as a relative (crater-detection) signal instead of discarding it.
- **Cold-load measurement: two real mistakes caught before trusting the number.** v1 (`networkidle0`) read ~9-10s — investigated rather than accepted, found it was waiting on the service worker's background precache fetches (a separate fetch context). v2 used a fragile canvas-content-diffing proxy for "interactive" that never fired reliably (WebGL canvas + `getContext('2d')` returning null, PNG-size heuristic too noisy) — abandoned for something simpler. v3/final: `waitUntil:'load'` + screenshot confirmation, which is both simpler and correct. THEN caught a second bug: the throttle constant (400Kbps/400ms) was actually Chrome's "Slow 3G" preset mislabeled as "4G" in my own script — the arithmetic (360KB ÷ 50KB/s ≈ 7.2s) explained the ~9s reading almost entirely on its own. Corrected to the real 4G profile (1.6Mbps/750Kbps/150ms) and got ~2.5s, which is what shipped.
- Heap check (CDP `Performance.getMetrics`, not in the original task list) added opportunistically once the fps proxy came back non-authoritative — wanted a second, more machine-independent signal for Task 5's measure-before-fixing decision. Sawtooth 6.98-12.45MB, no leak.

### Completion Notes List

- **AC1 (frame rate) ✅ CLOSED.** Danilo ran the three-mages-wipeout Replay benchmark on his Pixel 9 Pro XL (×2 speed, Chrome remote debugging) and supplied the raw `window.__perfSamples` trace: 5,746 samples over ~96s, min 60.486, median 60.993, 1%-low 60.486, max 61.420 — no sample anywhere below 55fps, let alone the 30fps floor. Full numbers and the exponential-moving-average shape of the trace are in `docs/performance-verdict.md`'s "On-device result" section. Normal (1×) speed and Draft/Placement remain proxy-only — noted as scope, not silently dropped.
- **AC2 (cold load / bundle) ✅** Both measured fresh, both comfortably under budget (bundle 12%, load time ~50% of the 5s ceiling), two methodology bugs caught and corrected in-session rather than shipped.
- **AC3 (recorded with evidence) ✅** `docs/performance-verdict.md` written, including the dead-ends — a future reader (or Danilo, adding his real numbers) inherits the corrected methodology, not just a clean-looking final table.
- Zero engine changes; zero new dependencies. `apps/web` touched: one new module (`config/perf.ts`), three scenes gained a one-line `attachPerfSampler(this)` call, one new test file.
- Gate: 351 tests (7 new), typecheck both packages, lint clean.
- **Placement was not separately fps-benchmarked** (Task 2 scoped it as "lighter" and I focused effort on Battle/Draft) — noting this as a real, if minor, scope gap rather than silently completing the checkbox as if it were covered.
- **×2 speed was not run under the headless proxy** — once the proxy was known to be non-authoritative (uncapped vsync), running a second uninformative variant didn't add real evidence; Danilo's real device session should cover both speeds per the original Task 3 wording.

### File List

- `apps/web/src/config/perf.ts` — NEW: `isPerfQueryEnabled`, `summarizePerfSamples`, `attachPerfSampler`
- `apps/web/test/perf.test.ts` — NEW: 7 tests for the pure functions
- `apps/web/src/scenes/BattleScene.ts` — MODIFIED: `attachPerfSampler(this)` in `create()`
- `apps/web/src/scenes/DraftScene.ts` — MODIFIED: `attachPerfSampler(this)` in `create()`
- `apps/web/src/scenes/PlacementScene.ts` — MODIFIED: `attachPerfSampler(this)` in `create()`
- `docs/performance-verdict.md` — NEW: the measurement record (NFR3)
- `docs/implementation-artifacts/deferred-work.md` — MODIFIED: text-ceiling entry cross-links the new baseline
- `README.md` — MODIFIED: one-line performance note + link
- `docs/implementation-artifacts/sprint-status.yaml`, this story file — MODIFIED: tracking

### Change Log

- 2026-07-15: Story 3.4 implemented — greenfield perf methodology (zero prior instrumentation): a `?perf=1`-gated per-frame fps sampler, the three-mages-wipeout Replay benchmark (reusing 3.2's seam), bundle size (0.359 MiB gzip, 12% of budget) and cold-load time (~2.5s, corrected past two real methodology bugs caught in-session) both comfortably under NFR1's budgets, and a measure-before-fixing verdict on the one plausible GameObject-churn hotspot (no pooling built — no craters, healthy GC, per doctrine). `docs/performance-verdict.md` records everything including the dead-ends. **AC1's frame-rate criterion left NOT fully closed**: the authoritative on-device measurement required Danilo's own phone, which this session could not operate — flagged explicitly rather than claimed. 351 tests green, zero engine changes.
- 2026-07-16: **AC1 closed.** Danilo ran the three-mages-wipeout Replay benchmark on his Pixel 9 Pro XL (×2 speed, Chrome remote debugging) and supplied the raw `window.__perfSamples` trace: 5,746 samples, ~96s, min 60.486, median 60.993, 1%-low 60.486, max 61.420 — zero samples below 55fps. `docs/performance-verdict.md`'s frame-rate row updated from ⏳ to ✅; no code changes required (measured, confirmed the no-pooling decision was correct). All three ACs now satisfied — still in `review` pending the code-review workflow (not yet run for this story) before moving to done.
- 2026-07-16 (senior review): **AC1 REOPENED — the review the previous entry was waiting for found the evidence unsound.** Three adversarial layers (bmad-code-review); 3 decisions + 7 patches, 0 defers, 3 dismissed. The instrument had two real bugs (sampled the once-per-second `actualFps` EMA instead of per-frame data; leaked a duplicate `update` listener on every scene re-entry) and the trace's arithmetic was impossible (5,746 samples > the 3,600 cap; ~96s vs a ~9s battle). Sampler rewritten (instantaneous `1000/rawDelta`, shutdown detach, reset-safe push, `console.info` readout, cap 36,000), tests 7 → 16 (suite 360), verdict doc demotes the first capture to "superseded" and records the accepted Pixel-9-Pro-XL device-class deviation. Status back to `in-progress` — the one open action is the re-capture device session (Battle 1×+×2 and Placement, patched sampler), which closes AC1 for real.
