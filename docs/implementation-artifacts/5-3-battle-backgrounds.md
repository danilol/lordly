---
baseline_commit: b14a3904255e8a3ba4f3b7723d01f42ec568f958
---

# Story 5.3: Battle backgrounds

Status: ready-for-dev

## Story

As a player,
I want the battle fought over real terrain instead of a flat dark backdrop,
so that every clash feels like a place in a medieval world.

## Acceptance Criteria

1. **Terrain under the boards, in both battle-facing scenes, with a recorded deterministic rule.** Given Danilo's Midjourney background batch, when backgrounds land in **Battle and Reveal**, the terrain renders under the floating formation grids on the 360×640 logical canvas, **at least two biomes ship** (both are already picked: `selected/castle-battleground.png`, `selected/green-battlefield.png`) with a **deterministic selection rule that is written down**, and reduced-motion preferences add no parallax or movement.
2. **Legibility survives the art (FR39f).** Given the FR39f legibility constraint, when labels, damage numbers, the move plate and the log render over the terrain, they stay readable on device — via the art's calm upper region and, if needed, a translucent scrim behind text — with **Danilo's device pass as the acceptance gate**.
3. **NFR1 holds.** Given NFR1, when the busiest case replays (three-mages wipeout per the perf doc), the capture against the 5.0 baseline shows **no 30fps-floor breach**, recorded as a perf-verdict addendum.

## Tasks / Subtasks

- [ ] Task 1: The deterministic selection rule (AC: 1)
  - [ ] Add a shell-side background manifest (`config/constants.ts`): an ordered `readonly` array of texture keys, one per biome. New art = one line. Keep it shell-side — a background is PRESENTATION and must never enter `MatchSetup` or the engine.
  - [ ] Pick by **match seed**, not `Math.random`: `BACKGROUNDS[seed % BACKGROUNDS.length]` as a PURE exported helper (e.g. `backgroundKeyForSeed(seed)`) in `constants.ts` or `flow/battleView.ts`, unit-tested. Rationale (already agreed and logged in deferred-work.md, 2026-07-27): a replay re-resolves from the stored setup + seed, so a seed-derived pick reproduces the ORIGINAL terrain; `Math.random` would silently swap scenery on replay.
  - [ ] **Read the seed from `committedSetup.seed`, not `MatchState.seed`** — verify against `MatchFlow.startReplay` which path a replay populates, and pin whichever you choose with a test asserting a replayed setup yields the same key. (`MatchState.seed` is the live match's seed; `committedSetup` is what history stores and replay restores — `packages/engine/src/types.ts:165`.)
  - [ ] The background is per-MATCH, not per-engagement: a Wipeout run's 2–5 engagements all play on the same terrain (the seed doesn't change mid-match — state the invariant in a test).
  - [ ] Record the rule in `docs/rules.md`? **No** — it is not a game rule. Record it in the story's Dev Agent Record + a one-line note in `DESIGN.md`'s story-5.2 amendment block (the chrome/ground paragraph), which is where the shipped look is now documented.
- [ ] Task 2: Process and load the art (AC: 1, 3)
  - [ ] Both picks are RAW 1.7–1.9 MB PNGs. Preprocess exactly like 5.2's Home castle: downscale to the display target and convert to jpg (5.2 precedent: 816×1456 png → 717×1280 jpg ≈ 213 KB, via `sips`). Two backgrounds ≈ 400–450 KB total — check the precache delta and state the real number (the 5.2 review caught an understated one).
  - [ ] Load in `BootScene.preload` beside the existing chrome (same `this.load.image` + `loaderror` failure path; Boot already fails loudly rather than booting a broken game).
  - [ ] Workbox glob already covers `jpg` (5.2). Verify the new files appear in `dist/sw.js` precache after `pnpm --filter web build`.
- [ ] Task 3: Render the terrain (AC: 1, 2)
  - [ ] **DEPTH TRAP — read this before writing a line:** `drawIsoBoard` (`config/board.ts:20`) already draws each board's Graphics at **depth −10**, and `addSceneGround` (`config/ui.ts`) also uses −10. The terrain must sit BELOW both (e.g. −20) or it will fight the boards for z-order. Do not reuse `addSceneGround` here — that helper is the menu-scene stone floor; battle terrain is its own thing.
  - [ ] Add a shared helper (`config/ui.ts`, beside `addSceneGround`) so Battle and Reveal cannot drift: cover-scale the image onto the 360×640 stage (the `HomeScene.ts` pattern: `setScale(Math.max(BASE_WIDTH / img.width, BASE_HEIGHT / img.height))`), depth below the boards, no tween.
  - [ ] Wire into `BattleScene.create()` and `RevealScene.create()` right after `applyHiDpiCamera`. Both scenes keep `cameras.main.setBackgroundColor(PALETTE.background)` as the letterbox/underlay.
  - [ ] **Reduced motion:** the AC says no parallax or movement. The simplest compliant implementation is a STATIC image — then `prefersReducedMotion()` needs no branch at all. If you add any drift/parallax, it must be gated on `prefersReducedMotion()` (`config/ui.ts`) — but static is the recommended ship (it also costs nothing at NFR1).
- [ ] Task 4: Legibility over the terrain (AC: 2)
  - [ ] Audit what now sits over art in Battle: `passLabel` (y=22), `enemyLabel` (y=56), `BATTLE_PLAYER_LABEL`, board-tile unit codes (already carry the FR39f light-tint + dark-outline treatment built precisely for "future landscape backdrops" — `PALETTE.codeTextPlayer/codeTextEnemy` + `CODE_STROKE_COLOR`), floating combat numbers, the crit/dodge caption, the move plate (its own gold plate — fine), status glyphs, and the leader-fall banner. In Reveal: title, hint, `ARMY TACTICS`, the tactic bar/dropdown (now a framed panel — fine).
  - [ ] The 5.2 review's repeated lesson applies here in full: **translucent washes vanish over photographic art.** Any element still using low alpha over the new terrain needs an opaque or scrimmed treatment. Check the blast wash and guard flash (they sit over tiles, not bare terrain — likely fine, but LOOK).
  - [ ] Prefer the art's calm upper region + existing treatments; add a translucent scrim behind a text band only where the device pass says it's needed. Keep any scrim on the SAME `PALETTE` tokens (no new one-off colors).
- [ ] Task 5: Docs, gate, device pass (AC: 1, 2, 3)
  - [ ] `attribution.ts`: add the two processed backgrounds to the existing **'Lordly Midjourney art (Epic 5)'** entry's `assets` (do NOT create a new entry — same pack, same author/licence). The attribution test already globs `src/assets/*.jpg`.
  - [ ] DESIGN.md: one line in the story-5.2 amendment block recording that Battle/Reveal ship terrain art with a seed-derived biome pick (the amendment block is where the as-shipped look now lives).
  - [ ] Full gate: `pnpm typecheck && pnpm lint && pnpm coverage`, `pnpm --filter web build` (which now also runs `check:art`). Engine untouched — zero `packages/engine` diffs, no `logVersion`/`balanceVersion` movement.
  - [ ] NFR1 capture (AC 3): `?perf=1` on the DEPLOYED build, three-mages wipeout at 1× and ×2, compared against the 5.0 baseline AND the 5.2 addendum. **The specific thing to watch:** 5.0 flagged and 5.2 confirmed a ~5-frame scene-ENTRY burst (bottoming 8–11 fps) when Battle loads its assets — two more full-screen textures land exactly there. If the entry burst grows materially, say so and treat it as a finding, not a footnote.
  - [ ] Danilo's on-device acceptance of the look = the art gate (the standing art-story split: he owns picks + device pass).

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

### File List
