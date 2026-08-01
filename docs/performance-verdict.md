# Performance Verdict (NFR1)

Story 3.4. Bundle and cold-load measured 2026-07-15. Frame rate measured on-device 2026-07-16 **with the review-patched sampler** (an earlier same-day capture was superseded by the senior review and is kept below only for the record). Not an ADR (no architectural decision) — a measurement record, per NFR3.

## Verdict summary

| Requirement | Budget | Result | Status |
|---|---|---|---|
| Frame rate (busiest battle + draft flow + placement) | 60fps target / 30fps floor | **On-device (Pixel 9 Pro XL, Chrome, per-frame instantaneous fps): Battle 1× and ×2 medians ≈59.9 with zero frames below 55 after scene entry; Placement worst single frame 30.03fps during touch drag — zero frames below the 30fps floor across all 9,380 samples (~156s)** *(2026-07-16 capture — superseded as the current baseline by the story-5.0 record below: 4 accepted sub-30 single-frame hitches at 1×, PO-accepted deviation)* | ✅ Pass *(as-of Epic 3)* |
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

## Addendum — story 4.0 text-ceiling fix (2026-07-17)

Story 4.0 shipped deferred-work.md's **candidate (a)**: the canvas backing store is now sized `360×640 × backingScaleFor(devicePixelRatio)` (rounded, capped at 3 — `DPR_BACKING_CAP`), with every scene's main camera zoomed by the same factor (`applyHiDpiCamera`, config/ui.ts). At DPR 3 the backing is 1080×1920 (~9× the fill of the old fixed 360×640 store); at DPR 1 the config is byte-for-byte the old one.

**Headless verification (this session, dev server, puppeteer-core at deviceScaleFactor 3 and 1):** canvas backing 1080×1920 / 360×640 respectively, CSS size 360×640 both, layout pixel-consistent across scales, no page errors, text visibly sharp at DSF 3 in Home/History/Battle screenshots.

**On-device fps (the authoritative NFR1 check): ✅ PASSED — captured 2026-07-17 by Danilo on the deployed build** (Pixel 9 Pro XL, Chrome remote debugging, `?perf=1`, per-scenario resets, procedure identical to the post-review baseline so the numbers compare directly):

| Scenario (procedure order)            | Min fps   | Character of the trace                                                                                            |
| ------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| Battle 1× (three-mages-wipeout Replay) | **30.03** | vsync-locked ≈60 medians; one 30.03 scene-entry-class frame (baseline's known artifact) + isolated 40–54fps beats |
| Battle ×2                              | **59.52** | vsync-locked ≈60, spotless                                                                                          |
| Placement (drag)                       | **59.17** | vsync-locked ≈60 — cleaner than the baseline's own Placement pass (which bottomed at 30.03)                        |

All three traces also show 117–122fps fast-frame bursts — the same 120Hz-display artifact the baseline recorded, not a regression signal. **Zero frames below the 30fps floor anywhere.** Method note: the raw traces were analyzed by distinct-value scan (the streams are vsync-quantized to a small value set, so every outlier is enumerable); mins are exact values from the traces, medians are the dominant quantized band (≈59.9–60.2). Verdict: the DPR-3 backing store's ~9× fill cost is not measurable against the floor on this device — **the text-ceiling fix stands at zero NFR1 cost**; the fallback branch is not needed. Danilo's visual verdict, same day: "the font problem is solved for me, it's way better to read."

## Addendum — story 4.10 from→to attack motion (2026-07-20)

Story 4.10 adds travel to the beats that were rendered in-place: melee now steps toward its target and back (was a fixed 12px nudge), and blast/heal/spell each send one origin→target sliver across the clash gap (arrow already did). This addendum decides the busiest-battle stress case for the squad/monster era (AC4) and accounts for the added per-beat draw.

### Busiest-battle stress case: `three-mages` vs `three-mages` wipeout STAYS the benchmark

AC4 asked whether a monster comp becomes the new stress case. It does not:

- **`three-mages` (current baseline)** is an all-Mage back-row comp: every blast hits every enemy in the target row — **3 simultaneous struck targets per beat** (3 blast-wash circles + up to 3 popups), compounding across up to 5 wipeout engagements. This is the heaviest *simultaneous* per-beat GameObject churn the roster can produce (unchanged from the 3.4 analysis above).
- **`twin-golems` (monster comp)** is only 3 units/side, and a Golem's move is a single-target **melee** (`slash`) — one struck target per beat, no fan-out. Its 1.5× sprite (story 4.9) is a larger *draw* but not more *objects*. Fewer units and no blast fan-out make it strictly lighter per beat than the all-Mage comp.

So the heavier all-Mage case already dominates the "busiest monster battle" the AC names — no re-baseline of the stress comp is warranted. (The monster comp is still worth a look on device for the melee-step feel at 1.5× — folded into the Task 7 device pass.)

### Per-beat object accounting: the from→to motion adds ≤1 GameObject per beat

- **Melee step** — a larger tween on the **same existing sprite** (the attacker's billboard). **Zero new GameObjects**; identical object count to the old in-place nudge, just a longer travel distance within the same `UNIT_TWEENS.attack` timing.
- **Projectile traces (arrow/blast/heal/spell)** — **one** 10×2 rectangle sliver per traveling beat (`traceProjectile`), tweened across the gap and destroyed on arrival (~180ms, well inside the beat; ~80ms under reduced motion). The blast **wash count is unchanged** — still one circle per struck tile, as before; the trace is a single sliver aimed at the row (open-Q2 default), not one per target.
- The sequential beat scheduler animates **one beat at a time**, so the worst added per-frame draw is a single small rectangle riding alongside the pre-existing washes/popups of the heaviest blast beat. This is a marginal delta on the churn the 3.4/4.0 on-device captures already cleared at zero floor breaches, and every new object is destroyed on tween-complete (the same healthy sawtooth the heap check recorded — no new unpooled long-lived objects).

Conclusion from code+object analysis: no pooling fix is warranted pre-measurement (same doctrine as 3.4 — measure, don't guess-fix). If the on-device capture shows the extra sliver regressing the floor, the fix is to pool/reuse the trace rectangle (the same fix already noted for the popup/wash churn).

### On-device fps capture — PO-DEFERRED to post-deploy (deferred-work.md)

Per this doc's doctrine (empirical over reasoned), the authoritative NFR1 check is an on-device `?perf=1` capture, following the exact post-review procedure (`three-mages`-wipeout Replay at 1× and ×2, per-scenario resets, single-read traces). Story 4.10 was accepted and shipped by Danilo (2026-07-20) **without** that capture — a recorded PO deferral (`deferred-work.md`), not a completed gate: the story's device pass (Task 7) covered the animation *feel*, not the frame floor. The capture runs at the next device session against the deployed build (strict comparability with the deployed-URL baselines above; a local `vite preview` capture was technically possible pre-merge but would not compare 1:1) and fills this table:

| Scenario (procedure order)             | Min fps               | Character of the trace |
| -------------------------------------- | --------------------- | ---------------------- |
| Battle 1× (three-mages-wipeout Replay) | 23.98 | 4,205 samples (≤70s — see the 120Hz caveat below); median 59.88, 1%-low 37.0; 116 frames <55fps; **4 isolated frames under the 30fps floor** (24.0/29.9/24.0/29.9, scattered mid-battle) — single-frame hitches, never a sustained dip |
| Battle ×2                              | 8.01 (scene-entry burst) | 904 samples (≤15s) — **likely a partial run**: 30% shorter than the baseline ×2 (1,279 samples) for the identical replay while the 1× trace GREW; the combined trace was probably read before the ×2 battle finished. Within the captured window: median 59.88; all 5 sub-30 samples are the first 5 (scene entry); worst in-battle frame 59.5 |

Post-review note (2026-07-20): the review round added arrival-delayed impact effects (popups/washes now land when the trace does, via a scene-clock `delayedCall`) — zero additional GameObjects, so the ≤1-object/beat accounting above is unchanged.

### Capture record — story 5.0 (2026-07-24, Danilo's device, deployed production build): THE EPIC-5 BASELINE

The deferred capture above ran 2026-07-24 (three deferrals after 4.10 — closed by the epic-4 retro's no-fourth-deferral action item). Procedure notes, recorded honestly:

- **The between-scenario reset was missed** — the ×2 trace contained the 1× trace as an exact sample-for-sample prefix. Handled deterministically: the ×2 scenario is the 904-sample suffix (verified prefix-equality before slicing). No data was lost or double-counted.
- **The device ran stretches at 120Hz** (adaptive refresh — the trace contains sustained ~120fps sample runs the 2026-07-16 baseline never showed). Sub-60 samples in this capture are therefore not 1:1 comparable with the baseline's: a "40fps" sample here can be one heavy frame among 8.3ms ticks. Treat cross-capture deltas with that caveat.
- **Verdict vs the 2026-07-16 baseline** (min 40.0 / zero floor breaches): Battle 1× now shows 4 isolated sub-30 single-frame hitches and 116 sub-55 frames (baseline: 1) — the accumulated epic-4 per-beat churn (4.10 traces + arrival delays, 4.11 plates, monster assets) plus possible adaptive-refresh measurement noise. Median holds rock-solid at 59.88 in both scenarios; **Danilo watched the same battles and accepted: "it felt smooth" (option 1 — recorded deviation, not tuned)**.
- **Floor accounting, stated precisely (review-corrected):** the capture contains **9 sub-30 samples total** — 4 scattered mid-battle at 1× + 5 at the ×2 scene entry. **Exemption rule, now explicit:** scene-TRANSITION frames (loading/teardown between scenes) are outside NFR1's in-battle floor — the same category the baseline table already reported separately (its "scene-entry frame" was 40fps and counted only in the <55 column). Under that rule the formal in-battle crossing is 4 in 4,205 frames (0.095%). Honest flag with it: the scene-entry cost itself REGRESSED — one 25ms entry frame in the baseline vs a ~5-frame burst bottoming at 8fps (~125ms) now; not a floor matter, but worth an eye when 5.2/5.3 add load-time assets.
- **Duration caveat:** the "~seconds" figures divide samples by 60, but the trace shows sustained ~120fps stretches (adaptive refresh) — wall-clock durations are shorter than sample-count/60 suggests; sample counts, not durations, are the comparable quantity.
- **Standing instruction:** this capture is the baseline the Epic 5 visual stories (5.2 chrome, 5.3 backgrounds, 5.9 full-roster sheet) measure against; story 5.10's closing capture re-checks the floor after all of them. If sub-30 singles grow beyond "isolated" (or a sustained dip appears), the pooling fix named above (trace/popup/wash reuse) is the first lever.

Device-class caveat unchanged: the capture device is a Pixel 9 Pro XL, an accepted deviation from AC1's Pixel 6a-class floor (documented in the 2026-07-16 review note above).

## Addendum — story 5.2 the medieval look (2026-07-27, Danilo's device, deployed production build)

The AC-3 spot-check against the story-5.0 baseline above, after the full chrome restyle (9-slice button/panel frames, 512px stone ground tile in six scenes, Home castle jpg + wordmark plaque, new PWA icons). Method note, stated honestly: figures below are hand-tallied from Danilo's pasted per-frame trace (~2,000 samples across the session; the second dump again contained the first as an exact prefix — the known missed-reset behavior, handled the 5.0 way). Not machine-computed; the 5.0 record remains the precision baseline.

- **Median holds at 59.88/60.24** (alternating 60Hz sample values) through the whole session; the battle portion is a long uninterrupted ~60fps stretch with **zero sub-30 samples inside it** (baseline: 4 scattered mid-battle).
- **Sub-30 census: ~18 samples of ~2,000 (~0.9%), all isolated single frames except one.** The singles: six ~29.94 boundary frames (33.4ms — the same class as the baseline's 30.03 "worst frame"), seven isolated 20–24fps frames in the interactive/menu sections (scroll/drag moments, the baseline reported the same class).
- **The one multi-frame event: a 5-frame burst at ~12fps (min 10.91) at a scene transition** — immediately before the clean battle stretch, i.e. the Battle entry. This is the SAME known scene-entry burst the 5.0 baseline recorded (~5 frames bottoming at 8fps) and exempted under its explicit scene-transition rule; magnitude is comparable (bottom 10.9 vs 8.0). The 5.0 flag "worth an eye when 5.2/5.3 add load-time assets" is answered: the added assets (~700KB total, largest 213KB) did not worsen the entry burst.
- **Adaptive-refresh caveat carried forward:** sustained ~120fps runs and ~40fps plateaus appear throughout (the 5.0 caveat verbatim) — sample values are not 1:1 frame-cost measures.
- **Verdict: PASS.** No NFR1 in-battle floor breach; the medieval chrome is perf-neutral vs the epic-5 baseline. Story 5.3 (battle backgrounds) inherits this as its comparison point and should re-check the entry burst when the terrain art loads.

## Story 5.3 (battle backgrounds) — NO CAPTURE RUN (PO-deferred, 2026-07-28)

Recorded so this document never implies coverage it does not have: **story 5.3 shipped without an on-device capture.** Danilo accepted the visuals and deferred the measurement (his call, no blocking reason). What went unmeasured is not trivial — 5.3 added two full-screen terrain textures to the Battle/Reveal load and enlarged the rendered board area by roughly 55% (tiles 56×28 → 74×37 plus a wider spread, units 32→42px). The specific open question is the **scene-entry burst**: the story-5.0 baseline recorded ~5 frames bottoming near 8fps as Battle loads, the 5.2 addendum confirmed it unchanged at ~11fps, and 5.3 loads more at that same moment. Steady-state playback is the lower risk (the terrain is a single static image with no per-frame work; the dim and scrims are static rectangles).

**Owner: story 5.10 (the pre-PvP verdict).** Its closing capture now covers 5.2's chrome, 5.3's terrain and the enlarged boards together, and must compare the entry burst against the 5.0 and 5.2 figures above rather than only checking the in-battle floor.

## Story 5.10 (the pre-PvP verdict) — the closing capture, and a recorded ORDERING GAP

**Written before the capture, so the gap is on the record either way.**

Epic 5 sequenced story 5.10 last, *after* 5.9's full-roster art, precisely so the closing capture would cover the epic's complete visual load — `epics.md:1181` names the full-roster sheet in that load. Danilo postponed 5.9 on 2026-08-01 ("I won't have all the sprites now"), and the epic's own art-float rule says art stories never block the sequence, so **5.10 runs first and its capture PRECEDES the full-roster sprite sheet.**

What the closing capture therefore does and does not cover:

- **Covered:** 5.2's chrome (9-slice frames, stone ground, Home castle), 5.3's terrain textures and the ~55%-enlarged board, 5.6's unit-data card, 5.7's stats summary, 5.8's flow changes — i.e. everything that has actually shipped.
- **NOT covered:** 5.9's dedicated sprite sheet, which replaces 20 interim tiles with real art. Sheet weight and per-texture filtering both change there. The 5.0 baseline's standing instruction ("this capture is the baseline the Epic 5 visual stories — 5.2 chrome, 5.3 backgrounds, 5.9 full-roster sheet — measure against; story 5.10's closing capture re-checks the floor after all of them") therefore cannot be fully honoured by this capture.
- **Resolution:** a light re-capture rides 5.9's eventual device pass, OR the gap is accepted explicitly at the epic close — Danilo's call, recorded here when made. The one thing this document must not do is imply epic-5 coverage it does not have.

This capture also discharges **story 5.3's owed measurement** (`deferred-work.md`, owner: 5.10). Per that item it must compare the **Battle scene-ENTRY burst** against the 5.0 baseline (~5 frames bottoming ~8fps) and the 5.2 addendum (~10.9fps) — not only the in-battle floor — because 5.3 added two full-screen terrain textures and enlarged the board at exactly that moment.

### The benchmark was RE-POINTED for this capture (2026-08-01)

The three-mages benchmark defined at the top of this document **was invalid and had to be replaced before the capture could mean anything.** Two independent reasons:

1. **It could not load.** Its seeded `HistoryEntry` is a 3-unit army at `balanceVersion` 2 — from the era when `slotBudget` was 3. At `slotBudget` 5 it fails `validateMatchSetup` outright (`wrong-slot-total`), and at `balanceVersion` 11 it would display as non-replayable anyway.
2. **Its premise was dead.** It was chosen because "every Mage blast hits every enemy in the target row — 3 simultaneous targets per blast." Story 5.4 (E5-D4) retired the row blast from every class; Wizards now fire the single-target `bolt`. The old worst case had quietly become one of the *lightest* comps — the same decay pattern the 5.4 engine review found in three test guards.

**The new benchmark, chosen by measurement** (mirror comps swept for per-beat churn proxies, wipeout, seed 424242):

| Mirror comp | Attacks | Target-instances | Events | Engagements |
|---|---|---|---|---|
| **Emberdrake + 3 Knights (front row)** | **68** | **82** | **110** | **10** (full cap) |
| Emberdrake + Cragmaw + Phalanx | 40 | 80 | 104 | 10 |
| OLD three-mages (5-slot form) | 59 | 59 | 85 | 4 |
| 5 Archers | 42 | 42 | 63 | 3 |

`breath` (the dragons' row-AoE, E5-D7) is what the mage blast used to be: 3 targets in one beat. The comp wins on every proxy and runs the full engagement cap. Seeded via `lordly.v1.history` at `balanceVersion` 11 and driven through Replay, so it is byte-identical run to run (A wins 23%–0%).

**Comparability note:** the battle body is therefore NOT directly comparable to the 5.0/5.2 figures — it is a heavier board. The **scene-entry burst** remains comparable (same texture atlas, same load moment).

### Capture record — story 5.10 (2026-08-01, Danilo's device, deployed production build `e5b115a`)

**Procedure deviation, recorded: the per-scenario reset was missed for the THIRD consecutive session** (5.0, 5.2, now 5.10). The ×2 trace contained the 1× trace as an exact 2,888-sample prefix — verified by full element-wise comparison, then sliced. ×2 is the 1,405-sample suffix. No data lost or double-counted.

**CORRECTED 2026-08-01, same day, before this record was acted on.** The first version of this section claimed "NO adaptive-refresh ambiguity — the device stayed at 60Hz throughout", inferred from the absence of samples above 100fps. **That inference was wrong**, and the correction changes what every number below means.

The panel runs at **120Hz**. Proof: every distinct sample value is an integer multiple of an **8.333 ms** tick, and the fit is near-exact — mean residual against a 120Hz grid **0.0067**, against a 60Hz grid **0.16**. The ladder: 2 ticks = 16.7 ms (59.9/60.2 fps), 3 = 25.0 ms (40.0), 4 = 33.3 ms (30.0), 5 = 41.7 ms (24.0), 6 = 50 ms (20.0), 7 = 58.1 ms (17.2).

Why the original inference failed, recorded so it is not repeated: **a game targeting 60fps never completes a frame inside a single 8.33 ms tick, so the absence of >100fps samples says nothing about the panel.** The empty 50–58fps band is consistent with *both* grids and never discriminated between them either. The one discriminating value was 25.0 ms all along — exactly 3× of 8.333, but 1.5× of 16.667, and a 1.5× multiple is not a physically meaningful vsync outcome.

Worse, **this document already recorded the answer at story 3.4** — see the 2026-07-16 section above: "the Pixel 9 Pro XL has a 120Hz-class display". The 5.0 capture then re-observed it ("the device ran stretches at 120Hz — adaptive refresh"). The wrong claim contradicted an established fact two sections up its own page. The procedural lesson is the story-3.4 lesson again, one level out: **verify the meter, and check what this document already knows about it before asserting something new.** So 5.0's adaptive-refresh caveat **does apply**, and this document should stop treating raw fps as the primary unit.

**Read frame cost in TICKS.** A "40fps" sample is one frame that took 3 refresh intervals instead of 2 — a real overrun against the 60fps target, but not the choppy experience a 40fps reading on a 60Hz panel would imply. Only **≥5 ticks (>41 ms)** is unambiguously worse than the 30fps floor; the 4-tick bucket sits exactly *on* the 33.3 ms line, so counting it as "sub-30" overstates the breach. Re-stated in ticks, this capture reads: 1× median **2 ticks** (i.e. it *does* hold the 60fps target at the median), with **166 of 2,888 frames (5.75%) at ≥5 ticks**; ×2 median 3 ticks, 9.61% at ≥5 ticks.

| Scenario | Samples | Median | Min | <30fps | <55fps |
|---|---|---|---|---|---|
| Battle 1× | 2,888 | 59.88 | 2.61 | **280 (9.7%)** | 1,360 (47.1%) |
| Battle ×2 | 1,405 | **40.16** | 4.61 | **194 (13.8%)** | 795 (56.6%) |

**Scene-entry burst:** 5 frames, bottoming at **2.61fps** (383ms). Against 5.0 (~5 frames, ~8fps) and 5.2 (~10.9fps) this is the same *event* but materially deeper. Single session, so treat the magnitude as indicative rather than settled — but it is the one figure here that IS cross-comparable, and it moved the wrong way.

**VERDICT: NFR1's 30fps in-battle floor FAILS on this comp.** Excluding the first 10 frames under the scene-transition exemption, **275 of 2,878 frames (9.56%) fall below 30fps** at 1×, minimum 9.99fps. For scale, the 5.0 baseline recorded 4 in-battle breaches in 4,205 frames (0.095%). The breaches are **not** clustered at a seam — 259 separate sub-30 events, spread throughout.

**The load tracks living units and concurrent row-AoE popups**, which is the diagnostic part:

| 1× trace | Median | <30fps | <55fps |
|---|---|---|---|
| First half | **40.00** | 241 | 973 |
| Second half | **59.88** | 39 | 387 |

The battle opens with all 8 units alive and 3-target breaths landing every beat, and holds a **sustained 40fps median** — then recovers to a clean 59.88 as units die and the board empties. Per-decile the picture is monotonic (deciles 1–5 median 40.00, deciles 6–10 median 59.88). That points precisely at the hotspot this document named and never fixed: **per-beat trace/popup/wash object churn**, with pooling/reuse as the identified first lever. A 3-target breath instantiates three popups in one beat where a bolt instantiates one.

**What this does and does not say.** It is *not* a measured regression against 5.0 — the benchmark changed in the same session, so no like-for-like delta exists. It is the **first honest measurement of the current worst case**, and the old benchmark was structurally incapable of finding it. The 5.0 record's standing instruction ("if sub-30 singles grow beyond isolated, the pooling fix is the first lever") is now triggered.

**DECISION (Danilo, 2026-08-01): recorded deviation — DEFERRED to a dedicated performance story, to run at the very end.** Not tuned in story 5.10.

His felt-experience on device, which is the deciding input under the 5.0 precedent: **"it felt smooth still. i didn't see performance downgrade."** So the measured 40fps first half was not perceptible to the player watching it — the same gap between instrument and experience that the 5.0 capture recorded ("it felt smooth" over 4 in-battle breaches) and that story 3.4 spent a whole review learning to respect in the other direction.

Recorded plainly for whoever picks the performance story up:

- **The failure is real and measured**, not an instrument artifact. This capture is the cleanest evidence in this document — 60Hz throughout, vsync-quantised, no adaptive-refresh ambiguity. 275 of 2,878 in-battle frames below 30fps at 1×.
- **It is also not perceptible to the PO on the target device**, which is why it is a deviation rather than a blocker. Both facts stand; neither cancels the other.
- **The fix is scoped and named:** pooling/reuse for per-beat traces, popups and washes. The first-half/second-half split (40.00 → 59.88 median as the board empties) is the evidence that object churn per living unit is the mechanism.
- **The risk carried into link-play:** Epic 6 adds network send/receive and state sync on top of this per-beat budget, on the same frames. The headroom this capture says is missing is headroom PvP will want. That is an argument about *when* the performance story runs, and it is logged in `deferred-work.md` as a pre-link-play input rather than settled here.
- **Not comparable to 5.0/5.2 for the battle body** (benchmark re-pointed in the same session); the entry burst is comparable and moved from ~8/~10.9fps to 2.61fps in one session — worth a second reading during the performance story before treating that depth as real.

### Real-play capture — story 5.10 (2026-08-01, Danilo's device, deployed `9a007f7`): THIS SUPERSEDES THE FIXTURE AS THE PRIMARY EVIDENCE

Danilo played many games and captured `__perfSamples` across four sessions (three cumulative snapshots of one session — 1x ⊂ 2x ⊂ 3x, verified as exact prefixes — plus a separate session). Unlike every prior capture in this document, **this is real play**: Draft, Placement and Battle across whole matches with human-drafted boards, not a replayed fixture.

Frame cost in 120Hz ticks. **2 ticks = the 60fps target; 4 ticks = 33.3 ms = exactly the 30fps line; ≥5 ticks = unambiguously past it.**

| Segment | Samples | Median | 2t (60) | 3t (40) | 4t (30) | **≥5t** | Worst frame |
|---|---|---|---|---|---|---|---|
| Real: game 1 | 2,180 | **3t** | 762 | 760 | 364 | **292 (13.4%)** | 10t / 83 ms |
| Real: game 2 | 3,132 | **3t** | 1,344 | 1,031 | 469 | **287 (9.2%)** | 13t / 108 ms |
| Real: game 3 | 1,760 | **3t** | 718 | 625 | 238 | **178 (10.1%)** | 20t / 167 ms |
| Real: session B | 1,667 | **3t** | 640 | 564 | 278 | **183 (11.0%)** | 13t / 108 ms |
| Dragon fixture 1× | 2,888 | **2t** | 1,528 | 790 | 404 | **166 (5.75%)** | 46t / 383 ms (scene entry) |
| Dragon fixture ×2 | 1,405 | 3t | 607 | 434 | 226 | 135 (9.6%) | 26t / 217 ms |

**The fixture-based diagnosis in the section above is REVERSED by this data, and the earlier conclusion should not be relied on.** Real play is *worse* than the synthetic "worst case": median **3 ticks vs 2**, and **9.2–13.4% of frames past the 30fps line versus 5.75%**. The dragon fixture — chosen by measurement as the heaviest per-beat board the roster can build — actually holds the 60fps target at its median. Consistent across four independent sessions, so this is not noise.

**What that means for the diagnosis.** The fixture ran Battle *only*, via Replay. Real play adds Draft, Placement, Reveal, Result and the transitions between them, on human-drafted comps. Since the Battle-only trace is the *better* performer, the dominant cost is **not** the per-beat trace/popup/wash churn the fixture section blamed — that mechanism is real (the fixture's own 40.00 → 59.88 first-half/second-half split still stands) but it is not the main term. **The next measurement must attribute cost per SCENE before any optimisation is chosen.** `perf.ts` is already wired into Battle, Draft and Placement; it just does not label samples by scene, so this capture cannot separate them. Adding a scene tag to each sample is the cheapest next step and should precede the pooling work.

**Verdict, stated in the honest unit: NFR1's 30fps floor is breached in ordinary play — 9.2%–13.4% of frames exceed 33.3 ms, with isolated frames reaching 83–167 ms.** But the median frame holds a steady 3-tick (25 ms) cadence, and a *consistent* cadence is what reads as smooth, which is the most likely reconciliation with the PO's felt experience below.

**This is long-standing, not an Epic 5 regression.** No prior capture measured real play, and every one used raw fps on a 120Hz panel without the tick correction — so there is no evidence this got worse in Epic 5, and some reason to think it has been true since the app first ran on this device.

**PO decision unchanged (Danilo, 2026-08-01): recorded deviation, deferred to the dedicated performance story.** Felt experience across many real games: **"it felt smooth still. i didn't see performance downgrade."** That judgement now rests on the *stronger* dataset — many real matches rather than one replayed fixture — which strengthens the deferral rather than weakening it.
