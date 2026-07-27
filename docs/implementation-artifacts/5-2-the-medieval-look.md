---
baseline_commit: ebaa64e8d30bb3cb1e2f5f9f67711bed6ab1acb4
---

# Story 5.2: The medieval look

Status: done

## Story

As a player,
I want the app's chrome to look like a medieval tactical RPG instead of placeholder rectangles,
so that the game's identity reads from the first screen.

## Acceptance Criteria

1. **The restyle (art-dependent, floats on batch arrival).** Given Danilo's Midjourney UI batch (chrome textures, wordmark, app icon), when the restyle lands, buttons (enabled/disabled), panel frames, and ground treatments use the generated art across every scene, the "Lordly" wordmark replaces the text stand-in on Home (currently Arial Black `GAME_NAME` at `HomeScene.ts:49`), and the PWA icons (192/512/maskable) derive from the new master.
2. **One theme, recorded.** Given the PO's one-theme decision (epics.md line 955), when DESIGN.md is amended, the two-theme Heritage/Night specification is retired with a dated note, the single shipped theme's tokens are recorded (as-shipped hex values in the frontmatter block), and the FR39f contrast treatment (`codeTextPlayer`/`codeTextEnemy`/`CODE_STROKE_COLOR`) survives on the new surfaces — verified on device.
3. **Perf and licensing hold.** Given NFR1 and the licensing record, when this story closes, frame rate is spot-checked against 5.0's fresh baseline (docs/performance-verdict.md story-5.0 capture record) with no 30fps-floor breach, and `attribution.ts`/Credits reflect the generated assets (replaced CC entries retired; kept ones untouched).

## Tasks / Subtasks

- [x] Task 0: Close the art-supply gap in the prompt guide (AC: 1)
  - [x] The simplified `midjourney-asset-prompts-2026-07-23.md` has NO chrome/texture section (the epic AC's "prompt pack sections 4–6" references the OLD guide, rewritten away 2026-07-24 — the old version lives in git history). Add a "UI chrome" section: button frame (9-slice-friendly: uniform ornate border, plain center), panel frame (same, larger), wordmark ("LORDLY" — §3's logo prompt exists; note the guide's own fallback: MJ misspells, so emblem-only + real text is plan B), app icon (§3 prompt exists). Follow the guide's house rules (plain background, `--sref` after first winner, top-5-picks → `selected/` convention).
  - [x] Hand the section to Danilo; batches land per the folder convention (`selected/button-frame.png`, `selected/panel-frame.png`, `selected/wordmark.png`, `selected/app-icon.png` — final names dev's call, recorded in the manifest below).
  - [x] FLOAT RULE (epic line 955 + the established art-story split): this story NEVER blocks on art. Build all plumbing below against the current procedural look as the interim; swap in art as picks land; the story stays in-progress until Danilo's device pass on the real art.
- [x] Task 1: Centralize the chrome builders (AC: 1, 2)
  - [x] Today every scene draws its own button/panel rectangles from `PALETTE` (`config/constants.ts`). Extract shared builders into `config/ui.ts` (the established shared-treatment home — `crispText`/`addUnitSprite`/`addElementBadge` precedent): `addButton(...)` (default/enabled/disabled states, 44px min height — FR30) and `addFramedPanel(...)`. Route every scene's buttons/panels through them; grep each scene for `add.rectangle` chrome to catch all sites (Home, Draft, Placement, Reveal, Battle, Result, History, Help, Credits).
  - [x] Swap the builders' internals to the generated art when it lands — Phaser NineSlice (`scene.add.nineslice`) for frames so one texture serves all sizes; keep the procedural path as the pre-art interim inside the SAME builder signature (call sites never change). _(Done 2026-07-27, art drop: button/panel 9-slices at CHROME_SLICE_SCALE×3 for DPR crispness; primary = gold inset fill over the frame's dark center; disabled = dimmed frame; stone ground tile via addSceneGround in the 6 menu scenes; ButtonHandle grew `parts` for dynamic-redraw/scroll collections.)_
  - [x] Retire the legacy green enabled-button accent (`buttonFillEnabled`/`buttonStrokeEnabled` — DESIGN.md: gold is the accent; the green was deliberately parked in 2.1). This resolves the gold-accents half of deferred-work.md line 102.
  - [x] Scene GROUNDS (the AC's "ground textures … every scene"): the non-battle scenes' flat `PALETTE.background` ground gets the medieval treatment — either a subtle tiled texture (small, cheap — same asset budget rules) or a re-toned solid ground, dev + device call. The BATTLE scene's ground under the boards stays untouched (5.3's terrain); its chrome (log panel, HUD) restyles like everywhere else. _(Dev call: re-toned night-slate solid shipped as the interim; the §6 tile texture remains an option when the chrome batch lands — rides the art-swap subtask.)_
- [x] Task 2: Home gets the look (AC: 1)
  - [x] `selected/home-castle.png` becomes the Home background (the MJ guide §3 already designates it: "busy-and-beautiful is exactly right" for Home — no gameplay text there). Preprocess before shipping (see Dev Notes asset budget), load via BootScene's established load-with-failure-path pattern.
  - [x] Wordmark: replace the `GAME_NAME` Arial Black text with the wordmark image (or MJ emblem + styled text per the guide's fallback). Keep `applyHiDpiCamera`/`Scale.FIT` behavior — images position on the 360×640 logical stage like everything else. _(Done: Danilo's gold blackletter LORDLY mounted on a panel-frame plaque — no background extraction needed; the epithet subtitle stays crisp text below.)_
  - [x] Legibility over art: Home's buttons/toggle must stay readable over the castle art — reuse the FR39f approach if needed (scrim/panel behind controls), device-verified. _(Device pass 2026-07-27: Danilo accepted after two fix rounds — see Change Log.)_
- [x] Task 3: PWA icons + web shell colors (AC: 1)
  - [x] Regenerate `public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` from the new MJ master (maskable: respect the safe zone — content in the inner ~80%). Update `vite/config.base.mjs` manifest `theme_color`/`background_color` and `index.html` `theme-color`/splash (`public/style.css` body #0f0f0f) if the shipped theme's ground changes. Favicon (`public/favicon.png`) rides the same master. _(Done 2026-07-27: Danilo's crown-over-shield pick `_3`; maskable padded onto the art's own sampled bg #122539 — seamless, content in the safe zone; favicon 64px.)_
  - [x] The attribution test asserts icon files exist on disk (3.3 precedent) — keep it green through the swap.
- [x] Task 4: DESIGN.md dated amendment — the one-theme record (AC: 2)
  - [x] Amend `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` (dated note, the 4.0 amendment precedent — never rewrite history): (a) two-theme Heritage/Night RETIRED UNBUILT (PO 2026-07-23; the theme-toggle component + "design every screen in both" rule go with it); (b) record the SINGLE shipped theme's tokens as-shipped (actual hex values after the restyle — reconcile the frontmatter `colors:` block or add a dated "shipped theme" block); (c) note the zero-custom-art constraint's evolution: the Brand section's "zero custom-commissioned art" hard fence is superseded by Danilo's own Midjourney pipeline (his generated art ≠ commissioned art — the FR31 licensing bar still applies via the manifest); (d) FR39f tokens survive unchanged unless device says otherwise.
  - [x] EXPERIENCE.md: the theme-toggle behavioral row + Settings `[ASSUMPTION]` (lines 48, 77, 186) reference the retired system — add the matching dated note (do NOT restructure the doc; Settings itself stays deferred).
- [x] Task 5: Attribution and Credits (AC: 3)
  - [x] New manifest entry for the MJ chrome/wordmark/icon assets under the 'Lordly original sprites' precedent (attribution.ts — Danilo's own generated art, own entry, CC-BY-4.0, `author: 'Danilo Lima'`). List every shipped derived file.
  - [x] Retire ONLY what's replaced: the DCSS entry's `icon-192/512/maskable` asset lines move to the new entry when icons re-derive from the MJ master. **`units.png` STAYS DCSS-attributed — sprites are story 5.9's swap, not this one.** _(Done 2026-07-27 with the icon regeneration.)_
  - [x] Credits scene renders from the manifest (2.4) — verify the new entry appears; update `attribution.test.ts` expectations. _(Verified: `flow/credits.ts` renders generically and skips the Supplies line for an empty `classSources`; the existence-glob in the test now covers jpg.)_
- [x] Task 6: Gate + perf spot-check + device pass (AC: 1, 2, 3)
  - [x] Full gate: `pnpm typecheck && pnpm lint && pnpm coverage`, web build succeeds; engine untouched (zero engine diffs; no version bumps — pure shell story). _(Coverage run green 2026-07-27; typecheck/lint/test/build re-run green after every fix round — 579 tests.)_
  - [x] NFR1 spot-check: `?perf=1` capture on device vs the 5.0 baseline (Battle 1× + ×2, the perf-doc procedure); textures must not breach the 30fps floor. Record a perf-verdict addendum line. _(Danilo's capture 2026-07-27: PASS — median 59.88/60.24, zero sub-30 inside the battle stretch, one scene-entry burst matching the baseline's known/exempt class. Addendum written in docs/performance-verdict.md.)_
  - [x] Workbox precache stays under control: every file ≤ 2MiB (workbox cap — `castle-battleground`-class PNGs are 1.7–1.9MB RAW, so preprocessing is mandatory), and note the total precache delta in the story record. _(All art preprocessed; every file verified in dist/sw.js precache, all far under the 2 MiB cap. Precache delta ≈ **1.0 MB**: ~668KB of new dist art (largest 213KB) PLUS the regenerated public/ icons, which grew ~19KB → ~371KB and are precached by the same glob — an earlier note said "≈700KB across 6 files", which omitted the icons.)_
  - [x] Danilo's on-device acceptance of the whole look = the story's art gate (art-story split: he owns picks + device pass). _(Accepted 2026-07-27 after two fix rounds: "it's better now… all is good.")_

### Review Findings (senior code review, Opus 5, 2026-07-27 — 3 adversarial layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor)

- [x] [Review][Patch] Reveal's tactic dropdown is unmigrated chrome with a gold-on-gold selected row [apps/web/src/scenes/RevealScene.ts:148,177-181] — **DECIDED by Danilo 2026-07-28: option (b)** — wrap the open dropdown in `addFramedPanel` so the menu reads as ONE gold-framed surface, keep the rows flat inside it (a menu row is not a button — the HistoryScene marker precedent), and fix the selected row's contrast to ink-on-gold. The 24px rows staying under the FR30 44px tap floor is pre-existing (story 4.13) and logged separately in deferred-work.md.
- [x] [Review][Patch] HIGH: `panel-frame.png` still ships an uncropped white matte — 19 pure-white rows across the top, 11 down the right edge, TL/TR/BR corners `#ffffff`; NineSlice paints them as a ~6px white band on EVERY framed panel (Home plaque, Draft detail, Battle log) [apps/web/src/assets/panel-frame.png] — pixel-verified; the `ed62df8` slice 45→30 change only shrank the band, it never removed the cause. `button-frame.png` is clean (0%)
- [x] [Review][Patch] `ButtonStyleTokens.stroke` is dead — `applyStyle` never reads it, so `buttonStrokeDisabled` never renders and `ui-chrome.test.ts`'s `dflt.stroke !== disabled.stroke` assertion guards nothing observable [apps/web/src/config/ui.ts:222-229, apps/web/test/ui-chrome.test.ts]
- [x] [Review][Patch] Result's verdict banner is still a 0.16-alpha wash over the new stone floor — the primary outcome signal dissolves into rock while the comp chips beside it were made opaque [apps/web/src/scenes/ResultScene.ts:64-66]
- [x] [Review][Patch] Help and Credits put all long-form text directly on the stone tile with no backing and no stroke — the only two fully-unbacked reading surfaces in the app [apps/web/src/scenes/HelpScene.ts:46, apps/web/src/scenes/CreditsScene.ts:25]
- [x] [Review][Patch] Help/Credits/History keep the flat `backgroundFill` scroll-mask strip (y 0–44) over the stone ground — reads as an unexplained mismatched panel [apps/web/src/scenes/HelpScene.ts:52, CreditsScene.ts:66, HistoryScene.ts:106]
- [x] [Review][Patch] The rename is player-visibly incomplete: `docs/rules.md:3` (rendered verbatim in Help) and `README.md:1` still say "Lord Battle Tactics"; add a drift guard so the three name surfaces can't diverge again
- [x] [Review][Patch] DESIGN.md's own story-5.2 amendment misdescribes shipped reality — says "interim procedural bevel today" after the 9-slice shipped; the as-shipped token block omits `cardFillYou`/`cardFillEnemy`/`gridCellFill`/`hpBarBack`; the opaque card backings contradict `{components.unit-card}`'s "~14–16% alpha" with no recorded deviation; the FR39f scope rule's stated premise ("low-alpha ~15% side-washed tray/panel cards") is now false in code [DESIGN.md:181-184, 105-116]
- [x] [Review][Patch] Story record over-claims: "all four ACs" (there are 3), Tasks 1/2/5 parent checkboxes unchecked while the Change Log says "All tasks complete", the Completion Notes still carry a stale "PENDING (art-dependent + device)" list describing the shipped wordmark as "interim serif-gold", File List omits the 4 PWA icons + `performance-verdict.md` + `initFallback.ts` + 2 test files, and the precache delta is ~1.0MB not "≈700KB" (the regenerated icons grew ~19KB→~371KB and are precached)
- [x] [Review][Patch] `.gitignore` ignores only `ux-designs/ui/ob64/`, leaving the parent `ux-designs/ui/` — 1.1 GB of raw Midjourney output — untracked AND unignored in a public repo; a `git add -A` stages the whole tree (this already nearly happened this story)
- [x] [Review][Patch] History's tap-time demotion draws the "not replayable" caption (+30..+43) on top of the 9-slice frame's bottom gold border (+32..+44) — illegible on the rare replay-invalid path [apps/web/src/scenes/HistoryScene.ts:228-232, 254-259]
- [x] [Review][Patch] Home's 13px Georgia subtitle carries a 4px stroke (Phaser strokes then fills, so it encroaches ~2px inward per stem) and is the only Home text with no scrim under it — letterforms close up [apps/web/src/scenes/HomeScene.ts:70-76]
- [x] [Review][Patch] `renderUnitCard` picks the side backing by comparing a colour NUMBER (`sideColor === PALETTE.playerLine`) — the chirality/mirror bug class this repo has already been bitten by; pass the side instead [apps/web/src/scenes/HistoryScene.ts:260]
- [x] [Review][Patch] `addButton`'s gold-plate inset is a fixed 14px with no clamp — any button under 29px in either dimension yields a zero/negative-size Rectangle (exactly what a naive Reveal-dropdown migration would hit); extract the geometry math into a pure helper and test it [apps/web/src/config/ui.ts:211-212]
- [x] [Review][Patch] The attribution entry's comment contradicts the entry it sits on ("the UI-chrome batch joins this entry's assets as picks land" — they already did, in the same commit) [apps/web/src/assets/attribution.ts:78-83]
- [x] [Review][Defer] Battle log caps 11 LOGICAL lines but never visual ones; wrapped narration can render ~14 lines (~250px) past the panel's 212px interior [apps/web/src/scenes/BattleScene.ts:1048-1052] — deferred, pre-existing (the interior shrank 228→212px, so this change worsens an existing overflow rather than creating it)
- [x] [Review][Defer] `wordmark.jpg`'s own ground `(19,18,0)` differs from the panel body `(28,28,26)`, leaving a visible inner rectangle; JPEG is also the wrong container for a hard-edged gold-on-black mark [apps/web/src/scenes/HomeScene.ts:68-69] — deferred, may resolve with the panel-frame re-crop; re-judge on device after
- [x] [Review][Defer] Home's scrim is a hard-edged rectangle stepping across the painting at y≈333 — no alpha value removes the edge; needs a gradient (texture or stacked bands) [apps/web/src/scenes/HomeScene.ts:59] — deferred, needs a design call
- [x] [Review][Defer] PWA icon ground `#142637` doesn't match the manifest `background_color` `#161a2e`, so Android's splash shows a square around the icon [apps/web/public/icon-*.png vs vite/config.base.mjs:57-58] — deferred, cosmetic
- [x] [Review][Defer] Credits lists a CC-BY-4.0 pack with no statement of what it supplies (`classSources: {}` makes `formatCredits` omit the line) [apps/web/src/assets/attribution.ts:104, flow/credits.ts:27] — deferred, licence terms are already met by author/licence/URL
- [x] [Review][Defer] `addButton`'s Phaser-object behaviour (disabled blocks `onTap`, `setStyle` re-enables interactivity, `parts` completeness) has no test coverage; the repo has no Phaser-mock precedent (`vi.mock` appears nowhere in `apps/web/test`) — deferred, needs a mock harness = its own tooling story; the geometry half is patched above

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

Fable 5 (claude-fable-5)

### Debug Log References

### Completion Notes List

- 2026-07-27 (interim restyle COMPLETE — the buildable half; art floats): red-green on the new style seam (`test/ui-chrome.test.ts` written first, 4 failing → green). `buttonStyleTokens` + `ButtonStyle` in constants.ts; `addButton`/`addFramedPanel` in ui.ts (interim procedural bevel; the MJ 9-slice swap point is INSIDE the builders). All 13 button sites migrated (Home Play/spurs/mode-toggle, Draft Add/Continue, Placement Ready, Reveal Fight, Battle speed×2/Skip/Log, Result Rematch/Home, History Replay incl. the demote path via `setStyle('disabled')`); Battle log panel + Draft DETAIL panel on `addFramedPanel`. PALETTE re-toned to DESIGN's Night tokens (ground `#161a2e`, gold `#e3b64b`, bone text, ink-on-gold primary labels; legacy green retired — deferred-work line 102 resolved-as-amended). Contrast fixes where gold-fill labels appeared (Reveal dropdown selected row, Draft strong-chip). Side colors deliberately untouched (recorded deviation in the DESIGN amendment: shipped enemy red family stays). Home: `home-castle.jpg` (processed 816×1456 png → 717×1280 jpg, 213KB — sips, the Golem workflow), Boot-loaded with the existing failure path, cover-scaled + control-band scrim; interim serif-gold "Lordly" wordmark (stroke+shadow) with the long name as subtitle. Web shell: manifest/`index.html`/`style.css` grounds → `#161a2e`; workbox glob +jpg (verified precached in dist/sw.js). Attribution: new 'Lordly Midjourney art (Epic 5)' entry (Danilo, CC-BY-4.0); test glob covers jpg. DESIGN.md + EXPERIENCE.md dated one-theme amendments written. Gate: 577 tests green, typecheck+lint clean, web build succeeds. PENDING AT THE TIME (all closed later the same day — see the entries above): MJ chrome batch, 9-slice swap, wordmark image, PWA icons off the new master, FR39f device verify, NFR1 `?perf=1` spot-check, Danilo's device pass. NOTE: this entry describes the INTERIM state (serif-gold text wordmark, procedural bevel); the art drop superseded it.

### File List

- `apps/web/src/config/constants.ts` (modified — PALETTE re-tone, ButtonStyle/buttonStyleTokens, HOME_WORDMARK, HOME_BG_KEY)
- `apps/web/src/config/ui.ts` (modified — addButton, addFramedPanel)
- `apps/web/src/scenes/HomeScene.ts` (modified — background, scrim, wordmark, buttons via builder)
- `apps/web/src/scenes/BootScene.ts` (modified — home-castle load)
- `apps/web/src/scenes/DraftScene.ts` (modified — framed detail panel, chips contrast, Add/Continue via builder)
- `apps/web/src/scenes/PlacementScene.ts` (modified — Ready via builder)
- `apps/web/src/scenes/RevealScene.ts` (modified — Fight via builder, dropdown contrast)
- `apps/web/src/scenes/BattleScene.ts` (modified — speed/Skip/Log via builder + handles, framed log panel)
- `apps/web/src/scenes/ResultScene.ts` (modified — button helper over the builder)
- `apps/web/src/scenes/HistoryScene.ts` (modified — Replay via builder, demote via setStyle, marker stroke)
- `apps/web/src/assets/home-castle.jpg` (new — processed from selected/home-castle.png)
- `apps/web/src/assets/button-frame.png`, `panel-frame.png`, `ground-tile.jpg`, `wordmark.jpg` (new — processed chrome, art drop 2026-07-27)
- `docs/planning-artifacts/ux-designs/midjourney/selected/button-frame.png`, `panel-frame.png`, `ground-tile.png`, `wordmark.png`, `logo-full.png` (new — Danilo's confirmed picks)
- `apps/web/src/scenes/HelpScene.ts`, `CreditsScene.ts` (modified — stone ground)
- `.gitignore` (modified — ui/ob64/ reference archive stays local)
- `apps/web/src/assets/attribution.ts` (modified — Lordly Midjourney art entry)
- `apps/web/test/ui-chrome.test.ts` (new — style-seam pins)
- `apps/web/test/attribution.test.ts` (modified — jpg existence glob)
- `apps/web/vite/config.base.mjs` (modified — glob +jpg, manifest colors)
- `apps/web/index.html` (modified — theme-color)
- `apps/web/public/style.css` (modified — splash ground)
- `docs/planning-artifacts/midjourney-asset-prompts-2026-07-23.md` (modified — §6 UI chrome prompts)
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` (modified — dated one-theme amendment)
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md` (modified — dated note)
- `docs/implementation-artifacts/deferred-work.md` (modified — line-102 resolution)
- `docs/implementation-artifacts/sprint-status.yaml` (modified)
- `apps/web/public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `favicon.png` (modified — regenerated from the app-icon master)
- `apps/web/src/flow/initFallback.ts` (modified — short name in the boot-failure line)
- `apps/web/test/constants.test.ts`, `apps/web/test/init-fallback.test.ts` (modified — name pins)
- `docs/performance-verdict.md` (modified — the story-5.2 capture addendum)
- `docs/planning-artifacts/ux-designs/midjourney/selected/app-icon.png` (new — the confirmed icon pick)
- CODE REVIEW (2026-07-28): `apps/web/scripts/check-frame-art.mjs` (new — frame-art guard), `apps/web/package.json` (new `check:art` script, wired into `build`), `apps/web/test/game-name.test.ts` (new — name-drift guard), `apps/web/test/ui-chrome.test.ts` (rewritten around rendered properties + pure geometry), `apps/web/src/config/constants.ts` + `config/ui.ts` (token/geometry seams, `addHeaderStrip`, `addReadingBackdrop`), `scenes/{Result,Help,Credits,History,Home,Reveal}Scene.ts`, `docs/rules.md`, `README.md`, `.gitignore`, `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md`
- `docs/implementation-artifacts/5-2-the-medieval-look.md` (modified — this file)

## Change Log

- 2026-07-28 (SENIOR CODE REVIEW — Opus 5, 3 adversarial layers): 22 findings triaged (1 decision, 15 patch, 6 defer, 2 dismissed). **ALL 15 PATCHES APPLIED.** The HIGH: `panel-frame.png` still carried its source white matte (19 pure-white rows top, 11 right, corners `#ffffff`) — pixel-verified, and the 2026-07-27 slice 45→30 "fix" had only thinned the band; re-cropped against a MEASURED content bbox and backed by a new mechanical guard (`apps/web/scripts/check-frame-art.mjs`, wired into `pnpm --filter web build`) that was proven to fail on the old art and pass on the new. Other real defects fixed: `ButtonStyleTokens.stroke` was dead (removed; replaced with a rendered `frameAlpha`, and the vacuous test rewritten around what actually draws), Result's verdict banner and Help/Credits' long-form text were still washes/unbacked over the stone floor, the flat header strips became tiled bands, the rename was player-visibly incomplete in `docs/rules.md` (rendered verbatim in Help) and `README.md` — now fixed and guarded by `test/game-name.test.ts`, History's demote path now uses ONE treatment (the caption used to land on the 9-slice border), `renderUnitCard` takes a side instead of reverse-matching a colour number, the gold-plate inset is clamped (pure `buttonPlateInset`, tested), Home's subtitle stroke 4→2, Reveal's dropdown became one framed surface (Danilo's option b), the attribution comment matches its entry, and `.gitignore` now covers the whole 1.1 GB raw-art tree instead of just its OB64 sub-folder. Documentation truth restored: DESIGN.md's amendment re-dated with the four missing tokens + the opaque-card deviation + the FR39f premise correction, and this story's own over-claims corrected ("four ACs" → three, unticked parent tasks, the stale PENDING note, the File List omissions, the precache delta ~700KB → ~1.0MB). Gate: 591 tests (42 files, +12), typecheck/lint/coverage/build green.

- 2026-07-27 (STORY → REVIEW): AC 3 closed — Danilo ran the `?perf=1` capture (~2,000 samples); verdict PASS (median 59.88/60.24, zero in-battle sub-30, one scene-entry burst in the baseline's known/exempt class, ~0.9% isolated sub-30 singles). Perf-verdict addendum written. All tasks complete; all THREE ACs satisfied (an earlier note in this record said "four" — the story has 3); 579 tests, full gate green. Next: senior code review (different LLM recommended).
- 2026-07-27 (device pass, VISUALS ACCEPTED): Danilo walked the deployed build on his phone. Round 1 findings (all fixed, `ed62df8`): detail-panel white band (texture top-edge crop), 15px panel border swallowing content laid out against the 1px-stroke era (PANEL_FRAME_SLICE 45→30), "Add to army" overflowing its 66×46 frame (label → single-line "Add"), matchup-chip pill sunk below the panel (the depth(−1) trap — exposed by the ink label). Round 2 (fixed, `ca9616e`): ~15%-alpha unit-card side washes vanished over the stone floor — new opaque pre-blended `cardFillYou`/`cardFillEnemy` backings in History/Result/Draft-tray/Placement. Danilo: "it's better now. we can continue." FR39f verified in the same pass (board codes untouched — Battle ground unchanged; card codes now on opaque backings). REMAINING: the `?perf=1` capture (AC 3).

- 2026-07-27: Story created (recon: missing chrome prompts, asset budget, scope fences).
- 2026-07-27: Dev — interim procedural restyle shipped end-to-end (style seam + builders + 13 site migrations + Home castle background + one-theme doc amendments + attribution). Art-dependent half floats on Danilo's MJ chrome batch (guide §6). Gate green: 577 tests, typecheck/lint/build.
- 2026-07-27 (ART DROP — the real medieval look shipped): Danilo generated the §6 chrome batch (credits ran out before the app-icon master — Task 3 still floats). Picks confirmed by Danilo after the agent's glitch-check review (button frame `_0` thin aged-gold; panel frame `_2` classical uniform; ground tile `_0` subtle; wordmark `elegant_0` gold blackletter for Home; `strong_0b0395fa_1` kept as `selected/logo-full.png` for marketing, not shipped in-app). Processing: crops via sips (panel needed an asymmetric crop — the source has slight perspective skew; final version verified visually), button 400×200 / panel 300×400 / tile 512 jpg (102KB) / wordmark 960×323 jpg (61KB) — all under budget, all precached (verified in dist/sw.js). Builders swapped internally: NineSlice at ×3 scale-down (corners render at texture scale — the DPR-crispness trick, pinned by a new geometry test), primary=gold inset fill, disabled=dimmed frame; addSceneGround (depth −10, tileScale 0.35) in Draft/Placement/Result/History/Help/Credits (NOT Home=castle, NOT Battle/Reveal=5.3's terrain); Home wordmark plaque replaces the interim serif text. ButtonHandle.parts added — collected in Home modeUi, Draft dynamic, Placement dynamic, History scroll container (the layer-leak trap). Gate: 579 tests (2 new slice-geometry pins), typecheck/lint/build green. Logo files live in gitignored `ui/ob64/` — winners COPIED to tracked `selected/`. STILL OPEN: PWA icons (need the app-icon master — next credit batch), FR39f device verify, `?perf=1` spot-check, Danilo's device pass, DESIGN token re-date if the pass tunes values.
- 2026-07-27: NAMING (Danilo, during the wordmark session): the game's full name is now **"Lordly: Ruler of the Board, Master of Tactics"** (the royal epithet answers "who is Lordly?"). `GAME_NAME` renamed (page title, PWA manifest name), new `GAME_SUBTITLE` carries the epithet on Home under the wordmark, `initFallback` uses the short `HOME_WORDMARK` (the epithet reads absurd in an error line). Parked idea (Danilo's full legend — "Sweeper of Armies, Tamer of Magic, feared by enemies, loved by his people"): a lore paragraph for Help/store description, a later touch. Tests updated (constants pin, init-fallback).
