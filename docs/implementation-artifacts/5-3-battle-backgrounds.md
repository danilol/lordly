---
baseline_commit: b14a3904255e8a3ba4f3b7723d01f42ec568f958
---

# Story 5.3: Battle backgrounds

Status: review

## Story

As a player,
I want the battle fought over real terrain instead of a flat dark backdrop,
so that every clash feels like a place in a medieval world.

## Acceptance Criteria

1. **Terrain under the boards, in both battle-facing scenes, with a recorded deterministic rule.** Given Danilo's Midjourney background batch, when backgrounds land in **Battle and Reveal**, the terrain renders under the floating formation grids on the 360×640 logical canvas, **at least two biomes ship** (both are already picked: `selected/castle-battleground.png`, `selected/green-battlefield.png`) with a **deterministic selection rule that is written down**, and reduced-motion preferences add no parallax or movement.
2. **Legibility survives the art (FR39f).** Given the FR39f legibility constraint, when labels, damage numbers, the move plate and the log render over the terrain, they stay readable on device — via the art's calm upper region and, if needed, a translucent scrim behind text — with **Danilo's device pass as the acceptance gate**.
3. **NFR1 holds.** Given NFR1, when the busiest case replays (three-mages wipeout per the perf doc), the capture against the 5.0 baseline shows **no 30fps-floor breach**, recorded as a perf-verdict addendum.

## Tasks / Subtasks

- [x] Task 1: The deterministic selection rule (AC: 1)
  - [x] Add a shell-side background manifest (`config/constants.ts`): an ordered `readonly` array of texture keys, one per biome. New art = one line. Keep it shell-side — a background is PRESENTATION and must never enter `MatchSetup` or the engine.
  - [x] Pick by **match seed**, not `Math.random`: `BACKGROUNDS[seed % BACKGROUNDS.length]` as a PURE exported helper (e.g. `backgroundKeyForSeed(seed)`) in `constants.ts` or `flow/battleView.ts`, unit-tested. Rationale (already agreed and logged in deferred-work.md, 2026-07-27): a replay re-resolves from the stored setup + seed, so a seed-derived pick reproduces the ORIGINAL terrain; `Math.random` would silently swap scenery on replay.
  - [x] **Read the seed from `committedSetup.seed`, not `MatchState.seed`** — verify against `MatchFlow.startReplay` which path a replay populates, and pin whichever you choose with a test asserting a replayed setup yields the same key. (`MatchState.seed` is the live match's seed; `committedSetup` is what history stores and replay restores — `packages/engine/src/types.ts:165`.)
  - [x] The background is per-MATCH, not per-engagement: a Wipeout run's 2–5 engagements all play on the same terrain (the seed doesn't change mid-match — state the invariant in a test).
  - [x] Record the rule in `docs/rules.md`? **No** — it is not a game rule. Record it in the story's Dev Agent Record + a one-line note in `DESIGN.md`'s story-5.2 amendment block (the chrome/ground paragraph), which is where the shipped look is now documented.
- [x] Task 2: Process and load the art (AC: 1, 3)
  - [x] Both picks are RAW 1.7–1.9 MB PNGs. Preprocess exactly like 5.2's Home castle: downscale to the display target and convert to jpg (5.2 precedent: 816×1456 png → 717×1280 jpg ≈ 213 KB, via `sips`). Two backgrounds ≈ 400–450 KB total — check the precache delta and state the real number (the 5.2 review caught an understated one).
  - [x] Load in `BootScene.preload` beside the existing chrome (same `this.load.image` + `loaderror` failure path; Boot already fails loudly rather than booting a broken game).
  - [x] Workbox glob already covers `jpg` (5.2). Verify the new files appear in `dist/sw.js` precache after `pnpm --filter web build`.
- [x] Task 3: Render the terrain (AC: 1, 2)
  - [x] **DEPTH TRAP — read this before writing a line:** `drawIsoBoard` (`config/board.ts:20`) already draws each board's Graphics at **depth −10**, and `addSceneGround` (`config/ui.ts`) also uses −10. The terrain must sit BELOW both (e.g. −20) or it will fight the boards for z-order. Do not reuse `addSceneGround` here — that helper is the menu-scene stone floor; battle terrain is its own thing.
  - [x] Add a shared helper (`config/ui.ts`, beside `addSceneGround`) so Battle and Reveal cannot drift: cover-scale the image onto the 360×640 stage (the `HomeScene.ts` pattern: `setScale(Math.max(BASE_WIDTH / img.width, BASE_HEIGHT / img.height))`), depth below the boards, no tween.
  - [x] Wire into `BattleScene.create()` and `RevealScene.create()` right after `applyHiDpiCamera`. Both scenes keep `cameras.main.setBackgroundColor(PALETTE.background)` as the letterbox/underlay.
  - [x] **Reduced motion:** the AC says no parallax or movement. The simplest compliant implementation is a STATIC image — then `prefersReducedMotion()` needs no branch at all. If you add any drift/parallax, it must be gated on `prefersReducedMotion()` (`config/ui.ts`) — but static is the recommended ship (it also costs nothing at NFR1).
- [x] Task 4: Legibility over the terrain (AC: 2)
  - [x] Audit what now sits over art in Battle: `passLabel` (y=22), `enemyLabel` (y=56), `BATTLE_PLAYER_LABEL`, board-tile unit codes (already carry the FR39f light-tint + dark-outline treatment built precisely for "future landscape backdrops" — `PALETTE.codeTextPlayer/codeTextEnemy` + `CODE_STROKE_COLOR`), floating combat numbers, the crit/dodge caption, the move plate (its own gold plate — fine), status glyphs, and the leader-fall banner. In Reveal: title, hint, `ARMY TACTICS`, the tactic bar/dropdown (now a framed panel — fine).
  - [x] The 5.2 review's repeated lesson applies here in full: **translucent washes vanish over photographic art.** Any element still using low alpha over the new terrain needs an opaque or scrimmed treatment. Check the blast wash and guard flash (they sit over tiles, not bare terrain — likely fine, but LOOK).
  - [x] Prefer the art's calm upper region + existing treatments; add a translucent scrim behind a text band only where the device pass says it's needed. Keep any scrim on the SAME `PALETTE` tokens (no new one-off colors).
- [x] Task 5: Docs, gate, device pass (AC: 1, 2, 3)
  - [x] `attribution.ts`: add the two processed backgrounds to the existing **'Lordly Midjourney art (Epic 5)'** entry's `assets` (do NOT create a new entry — same pack, same author/licence). The attribution test already globs `src/assets/*.jpg`.
  - [x] DESIGN.md: one line in the story-5.2 amendment block recording that Battle/Reveal ship terrain art with a seed-derived biome pick (the amendment block is where the as-shipped look now lives).
  - [x] Full gate: `pnpm typecheck && pnpm lint && pnpm coverage`, `pnpm --filter web build` (which now also runs `check:art`). Engine untouched — zero `packages/engine` diffs, no `logVersion`/`balanceVersion` movement.
  - [x] NFR1 capture (AC 3) — **PO-DEFERRED 2026-07-28** (Danilo chose option 2 after accepting the look; no blocking reason stated — momentum). Routed to story 5.10's closing capture; logged in deferred-work.md and flagged in performance-verdict.md so the doc never implies coverage it lacks. AC 3 is therefore **satisfied-with-recorded-deviation** (the 5.0 precedent), NOT satisfied. Original task text: `?perf=1` on the DEPLOYED build, three-mages wipeout at 1× and ×2, compared against the 5.0 baseline AND the 5.2 addendum. **The specific thing to watch:** 5.0 flagged and 5.2 confirmed a ~5-frame scene-ENTRY burst (bottoming 8–11 fps) when Battle loads its assets — two more full-screen textures land exactly there. If the entry burst grows materially, say so and treat it as a finding, not a footnote.
  - [x] Danilo's on-device acceptance of the look = the art gate (the standing art-story split: he owns picks + device pass). _(ACCEPTED 2026-07-28 after the enlarge-the-fight round: "it looks great. Let's move forward." — terrain, the seed rotation, the dim/scrim treatment and the enlarged boards all pass.)_

## Dev Notes

### Scope fences

- **Battle and Reveal ONLY.** The menu scenes keep 5.2's stone floor (`addSceneGround`); Home keeps the castle painting. Do not touch them.
- **Presentation only — the engine never learns about backgrounds.** No `MatchSetup` field, no `BattleLog` event, no `logVersion`/`balanceVersion` change. A background is derived from the seed at render time. This is what keeps replay honest for free.
- **Not unit sprites** (story 5.9), **not new mechanics** (the epic fence — content on existing systems only).

### The two picks (already selected, no art wait)

`docs/planning-artifacts/ux-designs/midjourney/selected/castle-battleground.png` (1.7 MB, the low-camera empty-courtyard prompt — the MJ guide §1 explicitly re-prompted it so the middle stays calm behind small text) and `selected/green-battlefield.png` (1.9 MB, promoted 2026-07-27). The guide's own quality bar for backgrounds is "imagine small gold text over the middle" — these two were chosen against it. **This story does not float on art** (unlike 5.2): both assets exist today.

### Recon-verified surfaces (2026-07-28, at story creation)

- `apps/web/src/config/board.ts:20` — `drawIsoBoard` creates one static Graphics per board at **depth −10**, drawn once in create (NFR1: no per-frame work). Both Battle and Reveal call it. THE depth constraint for this story.
- `apps/web/src/scenes/BattleScene.ts` — `create()` resets ~15 singleton fields (scenes are singletons; anything you add must be reset here), sets `cameras.main.setBackgroundColor(PALETTE.background)`, attaches `attachPerfSampler(this)` (`?perf=1`). Depth ladder in play: boards −10 · units = screen y · popups 1000 · move plate 1200 · log panel 1500 · leader banner 1600. Top HUD band: `passLabel` y=22, `enemyLabel` y=56 (the move-plate's `PLATE_MIN_Y=44` clamp exists to stay clear of it).
- `apps/web/src/scenes/RevealScene.ts` — same board component, plus title/hint/enemy label above and the tactic block (bar y=356, framed dropdown below) and the `Fight!` button at `BASE_HEIGHT − 44`. `attachPerfSampler` is NOT attached here (only Draft/Placement/Battle) — the AC-3 capture is a Battle capture.
- `apps/web/src/flow/MatchState.ts:36` — `seed: number` (uint32, AD-10, fresh per match incl. rematches). `packages/engine/src/types.ts:165` — `MatchSetup.seed`. Replay path: `MatchFlow.startReplay(entry.setup)` — confirm which of the two a replay populates before choosing the source.
- `apps/web/src/scenes/HomeScene.ts:57-58` — the cover-scale idiom to copy for a full-bleed background image.
- `apps/web/src/scenes/BootScene.ts` — the asset-load pattern (Vite import → `this.load.image(KEY, url)`), with a `loaderror` handler that shows the DOM fallback and stops the FSM rather than booting a textureless game.

### Carried lessons from story 5.2 (its review found 22 findings — do not repeat these)

1. **Verify art mechanically, never by eye.** `panel-frame.png` shipped its white matte TWICE because the crop was checked in a viewer that renders PNGs on a white page. `apps/web/scripts/check-frame-art.mjs` now guards 9-slice frames; these backgrounds are not 9-slice, but the lesson stands — if an edge/tone matters, measure it.
2. **Translucent washes disappear over art.** Card washes at ~15% alpha and the Result banner at 0.16 both vanished over the stone floor and had to be made opaque. Assume the same for anything low-alpha over terrain.
3. **Every token must be rendered.** A `stroke` token that nothing drew made a test pass while the screen was wrong. Don't add config the renderer ignores.
4. **The story record is part of the deliverable.** 5.2's review caught an AC miscount, unticked parent tasks, a stale PENDING note, File List omissions and an understated precache figure. Keep this file honest as you go.
5. **Precache accounting includes `public/`**, not just `src/assets` — the 5.2 delta was understated ~300 KB by forgetting the icons.

### Testing standards

Web tests live in `apps/web/test/*.test.ts` (vitest; pure seams only — there is **no Phaser mock harness** in this repo, and adding one is deferred work, not this story). Testable here: `backgroundKeyForSeed` (determinism, distribution across the manifest, stability for a replayed setup, per-match constancy), and the manifest ↔ asset-file existence (extend `attribution.test.ts`'s glob pattern or add an equivalent check). The engine's 90% line gate is unaffected (no engine change).

### Project Structure Notes

- MODIFIED: `apps/web/src/config/constants.ts` (manifest + keys + pure picker), `config/ui.ts` (the terrain helper), `scenes/BootScene.ts`, `scenes/BattleScene.ts`, `scenes/RevealScene.ts`, `src/assets/attribution.ts`, `test/` (new picker test), `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md`, `docs/performance-verdict.md` (AC-3 addendum).
- NEW: two processed background jpgs under `apps/web/src/assets/`.
- NOT modified: `packages/engine/**`, `config/board.ts` (unless the depth fix genuinely belongs there — prefer putting terrain below rather than moving the boards), the menu scenes, `sprites.ts`/`units.png`, `docs/rules.md`.

### References

- [Source: docs/planning-artifacts/epics.md#Story-5.3 (lines 1025–1043)] — the three AC blocks verbatim
- [Source: docs/implementation-artifacts/deferred-work.md#code-review-of-story-5-2 + the 2026-07-27 rotation entry] — the seed-derived rule agreed with Danilo, and the six items deferred out of 5.2
- [Source: docs/implementation-artifacts/5-2-the-medieval-look.md] — the immediately preceding story: its Review Findings section is the checklist of mistakes this story must not repeat
- [Source: docs/performance-verdict.md — story-5.0 capture record (THE epic-5 baseline) + the story-5.2 addendum] — the AC-3 comparison points, including the known scene-entry burst
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md — the story-5.2 amendment block] — where the as-shipped look is recorded; FR39f tokens at `{components.unit-card}`
- [Source: apps/web/src/config/board.ts:20 (depth −10); scenes/BattleScene.ts (depth ladder, HUD ys, singleton resets); scenes/HomeScene.ts:57 (cover-scale); flow/MatchState.ts:36 + packages/engine/src/types.ts:165 (seed)] — recon-verified
- [Source: docs/planning-artifacts/midjourney-asset-prompts-2026-07-23.md §1] — the background prompts + the "small gold text over the middle" quality bar both picks were judged against

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- 2026-07-28 — **STORY → REVIEW.** AC 1 + AC 2 closed on device. **AC 3 is satisfied-with-recorded-deviation, not satisfied**: Danilo PO-deferred the `?perf=1` capture (option 2, no blocking reason — momentum after the look was accepted). Recorded in three places so it cannot drift silently: deferred-work.md, a dated note in performance-verdict.md (so the perf record never implies 5.3 was measured), and story 5.10's sprint entry, which already owns the pre-PvP closing capture. Honest risk statement: this story added two full-screen textures AND grew the rendered board area ~55%, and the known Battle scene-entry burst (5.0 baseline, confirmed in the 5.2 addendum) sits exactly where those assets load — so 5.10's capture carries a real unknown, not a formality.

- 2026-07-28 — **AC 1 and AC 2 CLOSED by Danilo's device pass** ("it looks great"). Terrain in Battle + Reveal, the seed-derived biome rotation, the dim + HUD scrims, and the enlarged boards are all accepted on device. **AC 3 (the `?perf=1` capture) is the single remaining gate** — the story stays in-progress until it runs or is explicitly PO-deferred. It matters more here than usual: this story added two full-screen textures AND grew the rendered board area by ~55%, and both the 5.0 baseline and the 5.2 addendum recorded a scene-entry burst at exactly the moment Battle loads.

- 2026-07-28 (DEVICE PASS ROUND 1 — "i loved it… my only critique is that now we have a lot of space between the board/battle and the speed control bar; we could enlarge the fight"). Danilo accepted the terrain and asked for a bigger fight. This is a LAYOUT change beyond the story's three ACs, taken as a device-pass iteration (the 5.2 precedent) because the terrain is what exposed the dead space.
  - **Why it needed a refactor, not a constant tweak.** Battle and Reveal shared ONE global board frame (`ISO_BOARD`) through `battleView`'s projection. Battle can spread down the terrain; Reveal cannot — its lower third is the tactics block (ARMY TACTICS y=342, picker bar, enemy line, 4-row dropdown, all above Fight at y=568). One frame cannot serve both, so the projection is now layout-parameterised: `unitTileCenter`/`boardTiles`/`drawIsoBoard` take an `IsoBoardLayout` (defaulting to Battle's), and Reveal passes `ISO_BOARD_REVEAL`. Same component, same math, one implementation — only the frame differs.
  - **Battle (hero):** tiles 56×28 → **74×37** (+32%, 2:1 ratio kept), boards pushed apart — enemy y≈100–211, player y≈312–423, clash gap ≈101px. Vertical span 208px → **323px**; empty ground above the control bar ≈290px → ≈155px. Units 32→42px, HP bars 36→44px, the "YOUR ARMY ▼" label moved 322→444 (below the new board).
  - **Reveal (compact):** tiles → 70×35, boards nudged to y≈91–196 / 219–324 — bigger than before, still clearing the tactics block.
  - **New guards** (`battle-view.test.ts`, 5 tests): both frames keep the 2:1 diamond, every board stays inside the 360 canvas, the two boards never overlap (a clash gap always exists), Battle clears the HUD band and the control bar, Reveal's player board stays above y=342, and Battle is provably the larger stage. Hand-tuned geometry now fails loudly instead of drifting.
  - **KNOWN TRADE-OFF for the device pass:** the Log panel (y336–572, a toggle overlay at depth 1500) now covers most of the enlarged player board while OPEN. Alternatives if it bothers you: move the panel to the strip below the board (y430–576, but only ~6 lines fit vs 11 today), or shrink the spread. Left as-is because the log is transient and the alternative loses log history — your call on device.

- 2026-07-28 — Tasks 1–4 + the doc/gate half of Task 5 DONE. Red-green throughout: `battle-background.test.ts` written first (9 failing), then the implementation.
  - **The rule (AC 1).** `BATTLE_BACKGROUNDS` manifest + pure `backgroundKeyForSeed(seed)` in `constants.ts`. Verified the story's open question against source before choosing a seed source: `commit()` writes `seed: state.seed` and `startReplay()` sets `state.seed = setup.seed`, so `state.seed === committedSetup.seed` on BOTH paths — the scenes read `state.seed` (always defined, no optional handling) and a test pins the equivalence so the choice can't rot. Tests cover: ≥2 biomes, no duplicate keys, totality over the full uint32 seed space, every biome reachable, a replayed setup painting the ORIGINAL terrain, and terrain constancy across a multi-engagement wipeout.
  - **Typing note:** `noUncheckedIndexedAccess` made the modulo index `| undefined`. Resolved with a provably-unreachable `?? BATTLE_BACKGROUNDS[0]` rather than an `as` cast — a cast would have hidden a genuinely empty manifest; the fallback keeps the function total and the non-emptiness is test-pinned.
  - **Art (AC 1/3).** Both 816×1456 PNGs (1.7/1.9 MB) → 717×1280 jpg: `terrain-castle.jpg` 176 KB, `terrain-plains.jpg` 220 KB. **Precache delta ≈ 404 KB** (measured in `dist/`, not estimated — the 5.2 review's lesson). Loaded in Boot by ITERATING the manifest through a `Record<BattleBackgroundKey, string>`, so a manifest key with no load is a compile error rather than a missing texture at runtime.
  - **Render (AC 1).** `addBattleTerrain(scene, seed)` in `ui.ts` at **depth −20** — deliberately below `drawIsoBoard`'s −10 (the trap the story flagged). Cover-scaled with the HomeScene idiom. **Static by design**, so the reduced-motion rule is satisfied unconditionally with no branch and no per-frame cost.
  - **Legibility (AC 2) — a real finding, not a formality.** I looked at both processed images before judging: the castle is a dark evening courtyard, but the plains is a BRIGHT sky-and-meadow painting, and every Battle overlay (bone HUD labels, side-coloured combat numbers, status glyphs) is tuned for a dark ground. Shipping as-is would have washed out the HUD on one of the two biomes. Added a full-bleed `TERRAIN_DIM_ALPHA` (0.45) over the art plus an extra `addHudScrim` band behind each scene's top labels (`BATTLE_HUD_BAND_H` 72 / `REVEAL_HUD_BAND_H` 84, depth −11 so it can never cover a tile). One set of text treatments now stays valid on every biome, present and future. Both alphas are device-tunable constants with range-guard tests.
  - **Gate:** 603 tests (43 files, +12), typecheck + lint clean, `pnpm --filter web build` green (the 5.2 frame-art guard runs inside it), both terrain jpgs verified in the `dist/sw.js` precache. Engine untouched — zero `packages/engine` diffs, no version bumps.
  - **NOT done (Danilo's, and the story stays in-progress until then):** the `?perf=1` capture on the deployed build (AC 3 — watch the known Battle scene-entry burst; two more full-screen textures now load there) and the on-device look acceptance (AC 2's gate, including whether 0.45 dim / 0.5 scrim feel right).

### File List

- `apps/web/src/config/constants.ts` (modified — BATTLE_BACKGROUNDS manifest, backgroundKeyForSeed, TERRAIN_DIM_ALPHA, HUD_SCRIM_ALPHA, BATTLE_HUD_BAND_H, REVEAL_HUD_BAND_H)
- `apps/web/src/config/ui.ts` (modified — addBattleTerrain, addHudScrim)
- `apps/web/src/scenes/BootScene.ts` (modified — manifest-driven terrain loads)
- `apps/web/src/scenes/BattleScene.ts` (modified — terrain + HUD scrim)
- `apps/web/src/scenes/RevealScene.ts` (modified — terrain + HUD scrim)
- `apps/web/src/assets/terrain-castle.jpg`, `terrain-plains.jpg` (new — processed from selected/)
- `apps/web/src/assets/attribution.ts` (modified — both biomes added to the Epic-5 Midjourney entry)
- `apps/web/test/battle-background.test.ts` (new — 12 tests: rule, replay stability, legibility ranges)
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` (modified — terrain paragraph in the story-5.2 amendment block)
- `docs/implementation-artifacts/5-3-battle-backgrounds.md`, `sprint-status.yaml` (modified)

## Change Log

- 2026-07-28: Story created (recon: the depth −10 collision, the two seed sources, the known scene-entry perf burst).
- 2026-07-28: Dev — seed-derived terrain shipped in Battle + Reveal with both biomes, a manifest-driven Boot load, and a legibility treatment added after inspecting the actual art (the two biomes bracket the brightness range). 603 tests, full gate green, engine untouched. Awaiting Danilo's device pass + the AC-3 perf capture.
