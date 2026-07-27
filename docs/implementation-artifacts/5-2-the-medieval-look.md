---
baseline_commit: ebaa64e8d30bb3cb1e2f5f9f67711bed6ab1acb4
---

# Story 5.2: The medieval look

Status: ready-for-dev

## Story

As a player,
I want the app's chrome to look like a medieval tactical RPG instead of placeholder rectangles,
so that the game's identity reads from the first screen.

## Acceptance Criteria

1. **The restyle (art-dependent, floats on batch arrival).** Given Danilo's Midjourney UI batch (chrome textures, wordmark, app icon), when the restyle lands, buttons (enabled/disabled), panel frames, and ground treatments use the generated art across every scene, the "Lordly" wordmark replaces the text stand-in on Home (currently Arial Black `GAME_NAME` at `HomeScene.ts:49`), and the PWA icons (192/512/maskable) derive from the new master.
2. **One theme, recorded.** Given the PO's one-theme decision (epics.md line 955), when DESIGN.md is amended, the two-theme Heritage/Night specification is retired with a dated note, the single shipped theme's tokens are recorded (as-shipped hex values in the frontmatter block), and the FR39f contrast treatment (`codeTextPlayer`/`codeTextEnemy`/`CODE_STROKE_COLOR`) survives on the new surfaces — verified on device.
3. **Perf and licensing hold.** Given NFR1 and the licensing record, when this story closes, frame rate is spot-checked against 5.0's fresh baseline (docs/performance-verdict.md story-5.0 capture record) with no 30fps-floor breach, and `attribution.ts`/Credits reflect the generated assets (replaced CC entries retired; kept ones untouched).

## Tasks / Subtasks

- [ ] Task 0: Close the art-supply gap in the prompt guide (AC: 1)
  - [ ] The simplified `midjourney-asset-prompts-2026-07-23.md` has NO chrome/texture section (the epic AC's "prompt pack sections 4–6" references the OLD guide, rewritten away 2026-07-24 — the old version lives in git history). Add a "UI chrome" section: button frame (9-slice-friendly: uniform ornate border, plain center), panel frame (same, larger), wordmark ("LORDLY" — §3's logo prompt exists; note the guide's own fallback: MJ misspells, so emblem-only + real text is plan B), app icon (§3 prompt exists). Follow the guide's house rules (plain background, `--sref` after first winner, top-5-picks → `selected/` convention).
  - [ ] Hand the section to Danilo; batches land per the folder convention (`selected/button-frame.png`, `selected/panel-frame.png`, `selected/wordmark.png`, `selected/app-icon.png` — final names dev's call, recorded in the manifest below).
  - [ ] FLOAT RULE (epic line 955 + the established art-story split): this story NEVER blocks on art. Build all plumbing below against the current procedural look as the interim; swap in art as picks land; the story stays in-progress until Danilo's device pass on the real art.
- [ ] Task 1: Centralize the chrome builders (AC: 1, 2)
  - [ ] Today every scene draws its own button/panel rectangles from `PALETTE` (`config/constants.ts`). Extract shared builders into `config/ui.ts` (the established shared-treatment home — `crispText`/`addUnitSprite`/`addElementBadge` precedent): `addButton(...)` (default/enabled/disabled states, 44px min height — FR30) and `addFramedPanel(...)`. Route every scene's buttons/panels through them; grep each scene for `add.rectangle` chrome to catch all sites (Home, Draft, Placement, Reveal, Battle, Result, History, Help, Credits).
  - [ ] Swap the builders' internals to the generated art when it lands — Phaser NineSlice (`scene.add.nineslice`) for frames so one texture serves all sizes; keep the procedural path as the pre-art interim inside the SAME builder signature (call sites never change).
  - [ ] Retire the legacy green enabled-button accent (`buttonFillEnabled`/`buttonStrokeEnabled` — DESIGN.md: gold is the accent; the green was deliberately parked in 2.1). This resolves the gold-accents half of deferred-work.md line 102.
  - [ ] Scene GROUNDS (the AC's "ground textures … every scene"): the non-battle scenes' flat `PALETTE.background` ground gets the medieval treatment — either a subtle tiled texture (small, cheap — same asset budget rules) or a re-toned solid ground, dev + device call. The BATTLE scene's ground under the boards stays untouched (5.3's terrain); its chrome (log panel, HUD) restyles like everywhere else.
- [ ] Task 2: Home gets the look (AC: 1)
  - [ ] `selected/home-castle.png` becomes the Home background (the MJ guide §3 already designates it: "busy-and-beautiful is exactly right" for Home — no gameplay text there). Preprocess before shipping (see Dev Notes asset budget), load via BootScene's established load-with-failure-path pattern.
  - [ ] Wordmark: replace the `GAME_NAME` Arial Black text with the wordmark image (or MJ emblem + styled text per the guide's fallback). Keep `applyHiDpiCamera`/`Scale.FIT` behavior — images position on the 360×640 logical stage like everything else.
  - [ ] Legibility over art: Home's buttons/toggle must stay readable over the castle art — reuse the FR39f approach if needed (scrim/panel behind controls), device-verified.
- [ ] Task 3: PWA icons + web shell colors (AC: 1)
  - [ ] Regenerate `public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` from the new MJ master (maskable: respect the safe zone — content in the inner ~80%). Update `vite/config.base.mjs` manifest `theme_color`/`background_color` and `index.html` `theme-color`/splash (`public/style.css` body #0f0f0f) if the shipped theme's ground changes. Favicon (`public/favicon.png`) rides the same master.
  - [ ] The attribution test asserts icon files exist on disk (3.3 precedent) — keep it green through the swap.
- [ ] Task 4: DESIGN.md dated amendment — the one-theme record (AC: 2)
  - [ ] Amend `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` (dated note, the 4.0 amendment precedent — never rewrite history): (a) two-theme Heritage/Night RETIRED UNBUILT (PO 2026-07-23; the theme-toggle component + "design every screen in both" rule go with it); (b) record the SINGLE shipped theme's tokens as-shipped (actual hex values after the restyle — reconcile the frontmatter `colors:` block or add a dated "shipped theme" block); (c) note the zero-custom-art constraint's evolution: the Brand section's "zero custom-commissioned art" hard fence is superseded by Danilo's own Midjourney pipeline (his generated art ≠ commissioned art — the FR31 licensing bar still applies via the manifest); (d) FR39f tokens survive unchanged unless device says otherwise.
  - [ ] EXPERIENCE.md: the theme-toggle behavioral row + Settings `[ASSUMPTION]` (lines 48, 77, 186) reference the retired system — add the matching dated note (do NOT restructure the doc; Settings itself stays deferred).
- [ ] Task 5: Attribution and Credits (AC: 3)
  - [ ] New manifest entry for the MJ chrome/wordmark/icon assets under the 'Lordly original sprites' precedent (attribution.ts — Danilo's own generated art, own entry, CC-BY-4.0, `author: 'Danilo Lima'`). List every shipped derived file.
  - [ ] Retire ONLY what's replaced: the DCSS entry's `icon-192/512/maskable` asset lines move to the new entry when icons re-derive from the MJ master. **`units.png` STAYS DCSS-attributed — sprites are story 5.9's swap, not this one.**
  - [ ] Credits scene renders from the manifest (2.4) — verify the new entry appears; update `attribution.test.ts` expectations.
- [ ] Task 6: Gate + perf spot-check + device pass (AC: 1, 2, 3)
  - [ ] Full gate: `pnpm typecheck && pnpm lint && pnpm coverage`, web build succeeds; engine untouched (zero engine diffs; no version bumps — pure shell story).
  - [ ] NFR1 spot-check: `?perf=1` capture on device vs the 5.0 baseline (Battle 1× + ×2, the perf-doc procedure); textures must not breach the 30fps floor. Record a perf-verdict addendum line.
  - [ ] Workbox precache stays under control: every file ≤ 2MiB (workbox cap — `castle-battleground`-class PNGs are 1.7–1.9MB RAW, so preprocessing is mandatory), and note the total precache delta in the story record.
  - [ ] Danilo's on-device acceptance of the whole look = the story's art gate (art-story split: he owns picks + device pass).

## Dev Notes

### Scope fences — what 5.2 is NOT

- **NOT battle backgrounds** — terrain under the battle/reveal boards is story 5.3 (already has assets + a logged rotation wish in deferred-work.md line ~187). 5.2 may touch Battle scene CHROME (panels/buttons) but never its ground.
- **NOT unit sprites** — the MJ 12-class roster in `selected/` integrates in story 5.9. `units.png` (DCSS) keeps rendering units all through 5.2. Do not touch `sprites.ts`/`UNIT_FRAMES`.
- **NOT a Settings scene / theme toggle** — one theme ships; the toggle is retired WITH the two-theme spec. `storage.ts`'s "deferred theme toggle" comment can note the retirement.
- **Engine untouched.** Pure shell. No `balanceVersion`/`logVersion` movement. Goldens/sim unaffected.

### The current look, precisely (recon 2026-07-27, baseline ebaa64e)

- `config/constants.ts` `PALETTE`: dark ground `#1a1a2e` (+`backgroundFill`), gold-ish `title #e8d5a3`, grey-blue buttons, **legacy green enabled-button accent** (`buttonFillEnabled 0x4a6a4e` / `buttonStrokeEnabled 0x7ab07f` — deliberately parked in 2.1, DESIGN.md calls it superseded), FR39f code tokens (`codeTextPlayer #d6e8fa`, `codeTextEnemy #f8d9d2`, dark stroke). PALETTE is the single color source — the restyle edits THERE, not per-scene.
- Wordmark: `HomeScene.ts:49` — `crispText(GAME_NAME)` fontFamily 'Arial Black', `PALETTE.title`, at (BASE_WIDTH/2, BASE_HEIGHT×0.3). `GAME_NAME = 'Lord Battle Tactics'` (constants.ts) — the epic wants the **"Lordly"** wordmark; the `<title>`/manifest name can stay long-form.
- Buttons/panels: per-scene `add.rectangle` + `crispText`, no shared builder yet. `ui.ts` is the shared-treatment home (crispText/addUnitSprite/addElementBadge/addBackAffordance precedents).
- Asset loading: `BootScene` loads `units.png` (Vite-imported, inlined data-URI at current size) with a hard failure path (`showInitFallback` + FSM stop) and a frame-count validation. New textures follow this pattern: load in Boot BEFORE scenes that need them, failure path included. Boot's DELIBERATE EXCLUSION note: it skips `applyHiDpiCamera` — if you add a splash/loading visual to Boot, you MUST add the camera call (the comment says exactly this).
- PWA: `vite/config.base.mjs` — VitePWA manifest (`theme_color`/`background_color` `#1a1a2e`, 3 icons), workbox precache with the **2 MiB per-file cap** noted in a comment (Phaser chunk 1.31 MiB). `index.html` `theme-color #1a1a2e`; `public/style.css` splash body `#0f0f0f`; `flow/initFallback.ts` uses `PALETTE.bodyText/background` (keeps working after a palette change by construction).
- Attribution: `assets/attribution.ts` — DCSS CC0 entry (units.png + the 3 PWA icons derived from the knight frame) + 'Lordly original sprites' entry (Danilo Lima, Golem, the precedent for MJ assets). `REDISTRIBUTABLE_LICENSES = ['CC0-1.0','CC-BY-3.0','CC-BY-4.0']`; `attribution.test.ts` gates license + file existence.

### Asset budget (mandatory preprocessing — the workbox cap and NFR1 both bite)

Raw MJ output is 1.7–1.9 MB per PNG. Before shipping ANY of it: downscale to the display target (the logical canvas is 360×640; backing store ≤ ×3 — a 720–1080px-wide asset is plenty), compress (pngquant-class or WebP — Phaser 4 loads WebP fine; check `import` typing), and re-check the precache total. Chrome textures (button/panel 9-slice) should be SMALL (≤ 64–128px source, the frame is what matters). Danilo's Golem precedent: he supplies raw, the agent keys/downscales/wires (guide rule 4: "I do all the resizing, cutting, and wiring").

### FR39f survives — the load-bearing legibility rule (AC 2)

The 4.0 contrast treatment (light side tints over dark outline for board codes on solid tiles) was built PRECISELY for future textured grounds. New chrome must not undo it: keep the three tokens, and re-verify on device over the new surfaces. Blue=you/red=enemy stays load-bearing everywhere (DESIGN.md's one rule that outranks taste). Gold stays leader-only on the battle board (4.5/4.6 precedent: crit numbers are side-colored, crowns are gold).

### Coupling sites and singletons (standing lessons)

- **Phaser scenes are singletons** — any new state added to scenes (background images, nineslice refs) must be created/reset in `create()` (epic-2 lesson, memory-pinned).
- **BASE_WIDTH=360 coupling**: chrome touches every scene; when a panel/button size changes, check every comp-rendering scene (the 4.2 HistoryScene lesson) — Result and History rows sit close to their edges already.
- Per-texture NEAREST is for pixel-art sheets only — the MJ painterly art wants LINEAR (default); do NOT set a global `pixelArt` flag (device-confirmed lesson, story 2.1).
- `crispText` handles text sharpness; image assets need no equivalent, but fractional display scaling of painterly art is fine (unlike pixel art).

### Deferred-work bookkeeping

- **Resolves (as amended)**: deferred-work.md line 102 "Full Heritage/Night two-theme system" — the one-theme decision retired the toggle half; this story ships the gold-accents + display-face + grounds half as the single medieval theme. Mark the entry resolved-by-amendment with a pointer to the DESIGN.md dated note.
- **Does NOT resolve**: the battle-backgrounds rotation entry (5.3's), the unit-data-card wish (5.6's).

### Previous story intelligence (5.1, done 2026-07-27 — zero-code design pass)

Nothing technical carries into this shell story, but three context facts do: (1) the epic-5 dossier + ROSTER.md now exist — if any chrome copy mentions classes, names come from ROSTER.md; (2) the art shopping list for 5.9 was handed to the MJ pipeline — Danilo may interleave chrome batches with class batches, so the Task-0 guide section should slot into the existing guide structure cleanly; (3) 5.0's perf baseline (story-5.0 capture record in docs/performance-verdict.md) is THE comparison target for AC 3 — Battle 1× median 59.88, 4 isolated sub-30 single-frame hitches, ×2 clean.

### Testing standards

Web tests live in `apps/web/test/*.test.ts` (vitest, jsdom-free — pure functions + light Phaser mocks per existing patterns). New pure seams to test: the chrome builders' state logic (enabled/disabled/geometry math — not Phaser rendering), any asset-manifest list (background/chrome key → file mapping), attribution entries (extend `attribution.test.ts`: new entry's license in `REDISTRIBUTABLE_LICENSES`, every asset file exists on disk). The engine 90% line gate is unaffected (no engine change); `pnpm coverage` runs the whole suite — the 5.0 timeout hygiene means no flake excuses.

### Project Structure Notes

- MODIFIED: `apps/web/src/config/constants.ts` (PALETTE), `apps/web/src/config/ui.ts` (builders), every scene file (chrome call sites), `apps/web/src/scenes/BootScene.ts` (asset loads), `apps/web/src/scenes/HomeScene.ts` (background + wordmark), `apps/web/src/assets/attribution.ts`, `apps/web/test/attribution.test.ts` (+ new builder tests), `vite/config.base.mjs`, `apps/web/index.html`, `apps/web/public/style.css`, `apps/web/public/icon-*.png`, `favicon.png`.
- NEW: processed art under `apps/web/src/assets/` (the spine's declared asset home; public/ only for icon files referenced by the manifest), `docs/planning-artifacts/midjourney-asset-prompts-2026-07-23.md` chrome section (Task 0).
- DOCS: DESIGN.md + EXPERIENCE.md dated amendments (Task 4), deferred-work.md line-102 resolution, perf-verdict addendum line.
- NOT modified: `packages/engine/**`, `sprites.ts`/`units.png` frames (5.9), Battle/Reveal ground (5.3), PRD.

### References

- [Source: docs/planning-artifacts/epics.md#Story-5.2 (lines 1005–1023) + the Epic 5 breakdown decisions block (line 955: ONE theme, float rule, art-story split)]
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md — frontmatter tokens, Brand & Style (zero-custom-art constraint to supersede), FR39f unit-card tokens (lines 108–119), theme-toggle component, "both spines win" rule (line 174)]
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md lines 24, 48, 77, 186 — theme/Settings references needing the dated note]
- [Source: docs/planning-artifacts/midjourney-asset-prompts-2026-07-23.md — guide structure, §3 logo/icon prompts, house rules, folder convention, "Home castle already done" note]
- [Source: apps/web/src/config/constants.ts (PALETTE, GAME_NAME), config/ui.ts (shared-treatment precedents), scenes/HomeScene.ts:49 (wordmark stand-in), scenes/BootScene.ts (load pattern + camera exclusion note), assets/attribution.ts (DCSS + Danilo entries), vite/config.base.mjs (manifest + workbox cap), index.html, public/style.css]
- [Source: docs/implementation-artifacts/deferred-work.md line 102 (two-theme/gold/display-font deferral this story resolves-as-amended)]
- [Source: docs/performance-verdict.md story-5.0 capture record — the AC-3 baseline]
- [Source: docs/implementation-artifacts/5-1-the-roster-and-moves-dossier.md — the 4.1/5.1 design-pass artifacts; ROSTER.md for any class-facing copy]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
