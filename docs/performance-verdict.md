# Performance Verdict (NFR1)

Story 3.4. Bundle and cold-load measured 2026-07-15. Frame rate measured on-device 2026-07-16 **with the review-patched sampler** (an earlier same-day capture was superseded by the senior review and is kept below only for the record). Not an ADR (no architectural decision) — a measurement record, per NFR3.

## Verdict summary

| Requirement | Budget | Result | Status |
|---|---|---|---|
| Frame rate (busiest battle + draft flow + placement) | 60fps target / 30fps floor | **On-device (Pixel 9 Pro XL, Chrome, per-frame instantaneous fps): Battle 1× and ×2 medians ≈59.9 with zero frames below 55 after scene entry; Placement worst single frame 30.03fps during touch drag — zero frames below the 30fps floor across all 9,380 samples (~156s)** | ✅ Pass |
| Initial compressed bundle | ≤ 3 MB | **0.359 MiB gzip / 0.297 MiB brotli — 12.0% of budget** | ✅ Pass |
| Cold-load interactive time | ≤ 5 s on throttled 4G | **~2.4–2.6 s** (median of 3 trials) | ✅ Pass |
| Recorded with evidence | NFR3 | This document | ✅ Pass |

**Honest scope note:** the codebase's methodology doctrine (established across epic 2's three memorized Phaser quirks) is "empirical over reasoned" — measured, not guessed. Everything that could be measured without a physical device (bundle size, cold-load time, heap/GC behavior, a headless proxy fps signal) was measured for real, with corrected methodology after two dead-end approaches (documented below so a future reader doesn't repeat them). The frame-rate requirement's authoritative evidence — a real Android phone in Chrome — was first supplied by Danilo on 2026-07-16, then demoted by the same day's senior review (below). The story's own pattern held: every number in this document that survived did so by being checked, and this one didn't survive the check.

### Review note (2026-07-16) — the first on-device capture is superseded

The senior code review (bmad-code-review, three adversarial layers) found three defects in the first on-device capture; Danilo chose re-capture over re-documentation:

1. **Impossible arithmetic.** The record claimed a single "raw `window.__perfSamples` trace: 5,746 samples over ~96s", but the shipped sampler capped the array at 3,600 (oldest evicted) — no single read can produce that count. The same doc timed the benchmark battle at ~9s, so ~96s implies ~10 undocumented re-runs; a listener-stacking bug (each scene re-entry added another per-frame sampler) plausibly multiplied push rates as well. The capture methodology was never recorded. Both instrument bugs are now patched (shutdown cleanup; cap raised to 36,000 so a long session fits in one read).
2. **Wrong metric.** The samples were Phaser's `game.loop.actualFps` — an exponential moving average recomputed **once per second** (`0.25·framesThisSecond + 0.75·prev`), so per-frame sampling recorded ~60 duplicates/sec of a smoothed value. A 150ms mid-beat hitch (~9 dropped frames — exactly the tween stutter the instrument exists to catch) would move the reading only from 60 to ~58; "no sample below 55" therefore does not establish "no frame below the 30fps floor". The patched sampler records per-frame **instantaneous** fps (`1000 / rawDelta`).
3. **Device class.** AC1 specifies a Pixel 6a-class phone; the capture device is a Pixel 9 Pro XL — a strictly faster flagship. **Accepted deviation** (review decision, 2026-07-16): it is the device actually on hand; this document states plainly that the 6a-class floor is not directly demonstrated, rather than implying it.

**Re-capture executed the same day** — see "On-device result (patched sampler)" below: three-mages-wipeout Replay at 1× and ×2 plus a Placement pass, `window.__perfSamples` reset between scenarios, each read in a single copy. All three scenarios pass with zero floor breaches.

## Frame rate

### The benchmark: three-mages vs three-mages, wipeout mode

The worst-case composition, chosen by code reading (`packages/engine/src/ai.ts:81`, the `three-mages` archetype): both sides field 3 mages, both back row. Every Mage blast hits every enemy in the target row — with an all-mage back-row comp, that's 3 simultaneous targets per blast, every pass, compounding across up to 5 wipeout engagements (`BALANCE.engagementCap`). This is the single heaviest per-beat GameObject churn the current class roster can produce (see "The hotspot candidate" below).

Made reproducible via story 3.2's Replay feature: one `HistoryEntry` for this exact `MatchSetup` (seed `424242`, both AI picks resolved via `chooseSetup` on their own streams — fully deterministic, FR20) seeded directly into `lordly.v1.history`, then Replay. Same battle, byte-identical, every run:

```json
{
  "seed": 424242, "balanceVersion": 2, "mode": "wipeout",
  "armies": {
    "A": [{"class":"mage","element":"wind"},{"class":"mage","element":"fire"},{"class":"mage","element":"fire"}],
    "B": [{"class":"mage","element":"earth"},{"class":"mage","element":"wind"},{"class":"mage","element":"earth"}]
  },
  "placements": {
    "A": [{"row":"back","col":"left"},{"row":"back","col":"center"},{"row":"back","col":"right"}],
    "B": [{"row":"back","col":"right"},{"row":"back","col":"center"},{"row":"back","col":"left"}]
  }
}
```

### Instrumentation

`apps/web/src/config/perf.ts` (new, story 3.4; corrected by the 2026-07-16 review): `?perf=1` query-gated, zero production cost, announces itself with a `console.info` when armed. Samples per-frame **instantaneous fps** (`1000 / game.loop.rawDelta`) on Phaser's per-FRAME scene `UPDATE` event (~60/sec) — deliberately NOT the battle-log beat dispatcher (~2-7/sec), and deliberately NOT `actualFps` (a once-per-second EMA); either would silently miss the mid-beat tween stutters this measurement exists to catch. Detaches on scene shutdown (Phaser scenes are singletons — without cleanup, re-entries stack duplicate samplers). Wired into Battle, Draft, and Placement (the three scenes AC1 names). Exposes `window.__perfSamples` (cap 36,000 ≈ 10min) for a headless drive to read.

### On-device result (Pixel 9 Pro XL, Chrome, 2026-07-16, patched sampler — the authoritative evidence)

Method: production URL with `?perf=1` (console armed-readout confirmed the patched sampler was live), Chrome remote debugging. Three scenarios, `window.__perfSamples` copied via the console (`copy(JSON.stringify(...))`) and reset (`= []`) between them:

1. **Battle 1×** — the seeded three-mages-wipeout Replay at normal speed.
2. **Battle ×2** — the same replay at ×2 speed.
3. **Placement** — a live match: quick draft, then ~70s of unit dragging on the placement grid (the scene the first round never measured).

Samples are per-frame instantaneous fps (`1000 / rawDelta`); stats computed with the exact `summarizePerfSamples` definitions (min / median / average-of-worst-1%):

| Scenario | Samples | ~Duration | min | median | 1%-low | Frames < 55fps | Frames < 30fps floor |
|---|---|---|---|---|---|---|---|
| Battle 1× | 3,685 | ~61s | 40.0 | 59.88 | 59.0 | 1 (scene-entry frame) | **0** |
| Battle ×2 | 1,279 | ~21s | 40.0 | 59.88 | 58.0 | 1 (scene-entry frame) | **0** |
| Placement (drag) | 4,416 | ~74s | 30.03 | 59.88 | 57.4 | 6 | **0** |

Reading the artifacts honestly:
- The single 40fps sample in each Battle capture is the **second frame after scene create** (one ~25ms frame while the scene builds its GameObjects) — a real frame, but a one-off scene-entry cost, not battle-churn stutter. After scene entry, no Battle frame dropped below 59.5 at either speed.
- Occasional ~119–122fps samples are 8.3ms frames: the Pixel 9 Pro XL has a 120Hz-class display and Chrome sometimes schedules the next frame on the earlier vsync slot. Harmless — they're *fast* frames.
- Placement's six sub-55 frames (worst 30.03fps, a single 33.3ms frame) all occur during active touch drags — consistent with Chrome's touch-event handling, and still on the right side of the 30fps floor. Sample counts and durations are internally coherent (unlike the superseded capture), and all fit in one read under the 36,000 cap.

**AC1 is closed**: the busiest battle animation at both speeds, and the placement interaction, sustain the 60fps target with zero 30fps-floor breaches on the real device, measured per-frame with an instrument whose numbers can actually show a single long frame. (Device-class deviation — Pixel 9 Pro XL vs the AC's "Pixel 6a-class" — accepted per the review note above.)

### First on-device capture (Pixel 9 Pro XL, Chrome, 2026-07-16) — SUPERSEDED, kept for the record

**Superseded by the review note above** — the numbers below were recorded with the pre-review sampler (once-per-second EMA, listener-stacking bug, undocumented multi-read collection) and are retained only so the correction trail stays legible. Do not cite them as AC1 evidence; the re-capture section will replace this.

Danilo ran the three-mages-wipeout Replay benchmark on his own Pixel 9 Pro XL in Chrome (remote debugging, `window.__perfSamples`), at ×2 speed, and sent the raw per-frame `actualFps` samples back for analysis:

| Metric | Value |
|---|---|
| Samples | 5,746 |
| Duration (at ~60 samples/sec) | ~95.8 s of continuous playback |
| min | 60.486 |
| median | 60.993 |
| 1%-low | 60.486 |
| max | 61.420 |
| Any sample below 55fps | **No** |
| Any sample below the 30fps floor | **No** |

The trace is essentially flat — but it is an exponential-moving-average `actualFps` signal, so "flat" here means the once-per-second smoothed average never dipped, **not** that no individual frame did (the review's central point: this metric cannot show a single long frame). The capture remains a weak positive signal — a sustained fps collapse would have dragged the EMA down and didn't — but it is not floor-breach evidence, and its sample count (5,746 > the 3,600 cap) means the collection method was never what the record described. **AC1 is NOT closed by this capture**; see the review note and the planned re-capture.

### Secondary evidence (headless Chrome, this session — NOT the authoritative device)

Methodology dead-ends worth recording (so nobody repeats them):
- **Headless Chrome doesn't vsync-cap rendering** — with no real display compositor, `actualFps` readings exceed the display's real refresh rate (observed median ~110fps even under 4× CPU throttle, both headless AND headed on this session's ProMotion-class ~120Hz dev display). These numbers are **only useful as a relative regression signal** (do the low percentiles crater relative to the median — i.e. is there a stutter), never as a substitute for a 60Hz-panel device number.
- Running headed (a real, visible Chrome window) didn't change the picture — same display, same refresh rate. Confirms the numbers are dev-machine-shaped, not evidence of a true fps cap.

Measured (`?perf=1`, 4× CPU throttle via CDP `Emulation.setCPUThrottlingRate`, production build served via `vite preview`):

| Scenario | Samples | min | median | 1%-low |
|---|---|---|---|---|
| Battle (three-mages wipeout, ~9s of playback incl. multiple engagements) | 1069 | 83.3 | 110.8 | 83.3 |
| Draft (15 rapid taps across all 6 class cards) | 208 | 73.0 | 82.8 | 77.9 |

Both scenarios: **the worst 1% of frames sits within ~75-80% of the median, with no isolated craters** (min and 1%-low are nearly identical — no long-tail stutter). That absence-of-craters pattern is the real signal from this proxy, not the absolute numbers.

**Heap/GC check** (CDP `Performance.getMetrics`, sampled every 500ms across the three-mages battle): `JSHeapUsedSize` oscillates 6.98–12.45 MB in a healthy sawtooth (grows, GCs, repeats) — no monotonic growth. The per-beat GameObject churn described below (popups, blast-wash circles, heal glows — all unpooled) is being reclaimed correctly by the garbage collector, not leaking.

### The hotspot candidate — measured, not fixed

Code reading identified one architecturally-plausible hotspot before any measurement: `BattleScene.render()` (the per-beat event dispatcher in `apps/web/src/scenes/BattleScene.ts` — function names cited rather than line numbers, which drift) creates and destroys GameObjects with zero pooling on nearly every beat:
- `popup()` — a new `crispText` per damage/heal/status/misfire/poison-tick beat (crispText is the most expensive GameObject type in this codebase — the same supersampled-glyph primitive behind the text-ceiling issue, see below).
- `attackFlavor()` — a new `circle` "wash" per struck target for Mage blasts (up to 3 in the benchmark's worst beat).
- `healGlow()` — a new `circle` per heal.

Per this codebase's established doctrine (empirical over reasoned — three real Phaser rendering bugs in epic 2 were all caught by screenshot, never by reasoning alone), **this hotspot was measured, not guess-fixed**: the no-craters fps pattern under the desktop proxy and the clean sawtooth heap both argued against a real floor breach from this churn, and the patched-sampler on-device result above confirms it per-frame — after scene entry, not one Battle frame below 59.5fps at either speed, straight through the heaviest three-target blast beats. **No pooling fix was implemented, and the per-frame evidence shows none is needed.**

### The text-ceiling item (linked, not fixed here)

`deferred-work.md`'s "REOPENED: text still reads soft" entry needed a current fps baseline before any of its three candidate fixes (all of which multiply GPU fill cost up to ~9× on a Pixel 6a) could be responsibly scheduled. This document is now that baseline — the entry has been cross-linked back here. None of the three fixes are implemented in this story (not in its ACs).

### What was still needed — now closed

The re-capture demanded by the review ran the same day (2026-07-16) with the patched sampler and is recorded as the authoritative "On-device result" above: Battle at both speeds plus Placement, per-scenario resets, zero floor breaches. Nothing about the frame-rate requirement remains open. The remaining known softness is the accepted device-class deviation (documented in the review note) and Draft being desktop-proxy-only — both explicitly recorded rather than implied away.

## Cold load / bundle size

### Bundle (measured, `pnpm --filter web build`, 2026-07-15)

| Chunk | raw | gzip | brotli |
|---|---|---|---|
| `index-*.js` (app code) | 65,428 B | 24,720 B | 21,513 B |
| `phaser-*.js` (engine, its own chunk per `vite/config.base.mjs`'s `phaserChunks`) | 1,374,303 B | 352,055 B | 282,331 B |
| **Total (initial JS only)** | 1,439,731 B | **376,775 B ≈ 0.359 MiB** | 303,844 B ≈ 0.297 MiB |

**12.0% of the 3 MiB budget used (gzip).** PWA infrastructure (icons, `manifest.webmanifest`, `sw.js`, `workbox-*.js` — story 3.3) is offline precache, not part of the initial-load bundle this budget targets. There is no texture-atlas payload to chase — the game draws with Phaser primitives plus one 4 KB inlined sprite sheet.

### Cold-load interactive time (measured against the DEPLOYED prod URL — TLS/CDN latency matters)

Methodology, including one corrected mistake: the first attempt used `waitUntil: 'networkidle0'`, which blocks on the service worker's background install/precache fetches (a separate fetch context that re-downloads the same assets) — that inflated the number to ~9-10s, a measurement artifact, not a real regression. Corrected to `waitUntil: 'load'` (the standard DOM load event, which fires once the *page's own* resource requests finish, independent of the SW's background activity) plus a screenshot to visually confirm Home is actually painted by that point.

Throttle profile: Chrome DevTools/Lighthouse's standard "4G" (aka "Regular 4G") preset — **1.6 Mbps down / 750 Kbps up / 150ms RTT**. (A second mistake caught before it shipped: an earlier draft used 400 Kbps/400ms RTT, which is actually the "Slow 3G" preset mislabeled — that alone accounts for most of the initial ~9s reading via simple arithmetic: 360KB ÷ 50KB/s ≈ 7.2s of download time alone at that profile.)

Three fresh-context trials (no cache, no service worker — genuinely cold):

| Trial | `load` event | +150ms settle |
|---|---|---|
| 1 | 2462ms | 2613ms |
| 2 | 2341ms | 2492ms |
| 3 | 2362ms | 2514ms |

**Median ≈ 2.5s, well under the 5s budget.** Screenshot-confirmed: Home renders fully (title, Play vs AI button, mode toggle) by the settle point.

## Fixes applied this story

None. Bundle and cold-load both pass comfortably with headroom; the one architecturally-plausible frame-rate hotspot was measured (no craters, healthy GC) rather than fixed pre-emptively, per doctrine. Nothing here required AC2's "fix or file with a baseline" escape hatch for a budget breach — both budgets already had large margin.
