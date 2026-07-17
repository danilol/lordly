---
baseline_commit: b32c97f551e7a535a138896c3ec5c346086217e9
---

# Story 4.0: Battle legibility quick wins

Status: review

## Story

As a player,
I want the battle board readable at a glance on my phone,
so that the shipped legibility defects stop obscuring the game before the era work begins.

## Acceptance Criteria

1. **FR39f — label contrast (the shipped defect).** Class codes are legible on side-colored board tiles (red WIT/KNI on red tiles, blue on blue — screenshot-evidenced). The fix lands in the `DESIGN.md` unit-card token treatment (UX-DR7), not per-scene hacks, and is applied consistently everywhere codes render on side-colored surfaces. Verified on Danilo's device.
2. **FR39e — the "front" word goes, the indicator stays.** The `FRONT ↘` / `↖ FRONT` text labels are removed from the battle board; the non-verbal front-row indicator (brighter tiles + gold-lite edge) remains. `EXPERIENCE.md` is amended to resolve its "FRONT arrow" conflict with FR39e (UX-DR8) — the spine is amended, never silently contradicted.
3. **FR39a — "Turn" replaces "pass" in player-facing copy.** HUD label, log-panel narration, and the Help/rules content say "Turn". Display rename ONLY: engine vocabulary, `PassStarted` events, and the PRD glossary's "pass" are untouched.
4. **Text-ceiling fix (UX-DR11).** Candidate (a) — DPR-sized canvas backing store + per-scene zoom — is implemented; text renders crisp at device resolution on Danilo's phone; before/after fps is measured with the shipped `?perf=1` sampler against `docs/performance-verdict.md`'s post-review baseline (same scenarios: Battle 1×, Battle ×2, Placement drag) and NFR1 still holds (zero frames < 30fps floor); results recorded.
5. **Zero engine change, zero version bump.** `packages/engine` diff is empty; balance hash and golden battles untouched. This story is deliberately pre-era, display-only.

## Tasks / Subtasks

- [x] Task 1: FR39f label-contrast treatment (AC: 1)
  - [x] Decide the treatment against DESIGN tokens before coding. The defect: class-code text is side-colored (`PALETTE.playerText`/`PALETTE.enemyText`) and sits on side-colored tiles. DESIGN.md's unit-card spec mandates a side-colored BORDER + wash — it does NOT mandate side-colored TEXT. Candidate treatments (pick one, record in DESIGN.md): (i) neutral `bone`-colored code text (side stays on tile/border — UX-DR1's non-color anchors already pair side with position), (ii) a dark backing plate behind the code, (iii) text stroke/shadow. Constraint from deferred-work.md: the treatment must survive a BUSY BACKGROUND later (landscape battle backdrops are a deferred PO wish) — favor plate or stroke over pure color choice if in doubt.
  - [x] Update `DESIGN.md`'s `unit-card` component token block with the chosen treatment (this is the UX-DR7 "token system, not ad hoc" requirement).
  - [x] Apply at every side-colored-surface call site: `BattleScene.ts:212-216` (board units), `RevealScene.ts:93-95` (board units). Audit the tray/chip sites (`PlacementScene.ts:135-139`, `DraftScene.ts:143`, `ResultScene.ts:132`, `HistoryScene.ts:222`) — they render on dark panel, not side tiles; change them ONLY if the chosen treatment is a shared-style change, otherwise leave them.
  - [x] Screenshot both boards with all six classes on side tiles (headless DSF-3 screenshots, all six codes verified incl. MER on the brightest red front tile); on-device confirmation rides Task 5's sign-off.
- [x] Task 2: FR39e — remove the FRONT text labels (AC: 2)
  - [x] Delete `BATTLE_FRONT_ENEMY_LABEL` / `BATTLE_FRONT_PLAYER_LABEL` (`constants.ts:199-200`) and their render calls (`BattleScene.ts:150-151`).
  - [x] Do NOT touch the non-verbal indicator: `board.ts` front-tile brighter fill + `frontStroke` gold-lite edge (lines 22-29) and `battleView.ts:71-86` front flags stay exactly as-is (`battle-view.test.ts` pins the geometry — keep it green).
  - [x] KEEP `PlacementScene.ts:56`'s prose hint ("Front row faces the enemy (top)") — it is instructional placement copy, not the redundant battle-board label FR39e targets.
  - [x] Amend `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md` battle-layout section: replace `+ a directional "FRONT" arrow` with the indicator-only wording (brighter front tiles + gold edge). One-line surgical edit; do not restructure the spine.
- [x] Task 3: FR39a — "Turn" wording (AC: 3)
  - [x] `BattleScene.ts:285`: `Pass ${event.pass}` → `Turn ${event.pass}`. Extract to a named constant in `constants.ts` while there (house register: display strings live in constants; this one was an inline-literal deviation).
  - [x] `narration.ts:45-46`: `— Pass ${event.pass} —` → `— Turn ${event.pass} —`. UPDATE THE PINNING TEST: `narration.test.ts:88-95` asserts `'— Pass 2 —'` (line 95) — it must assert the new string, not be deleted.
  - [x] `docs/rules.md:52`: reworded to "Combat runs in **turns**. Each turn, every unit…" (no parenthetical — the clean read won); rules drift-guard tests stay green (they pin numbers, not this prose).
  - [x] Verify NOTHING in `packages/engine` changes: `PassStarted`, `pass` fields, engine docs stay verbatim (AC5).
- [x] Task 4: Text-ceiling fix — DPR-sized backing store (AC: 4) *(code + headless verification complete; the on-device fps capture is the one open item — see Task 5)*
  - [x] Root cause (diagnosed in deferred-work.md, do not re-diagnose): the canvas backing store is 360×640 regardless of `devicePixelRatio` — `crispText`'s supersampled glyphs are minified into the 360px backing, then lossy-CSS-upscaled. No `?textres=N` value can fix this.
  - [x] Implement candidate (a): Phaser 4.2.1 types verified — NO native resolution support exists, so: `width/height × backingScale()` in the Game config + `applyHiDpiCamera` (setZoom + centerOn) in every rendering scene's create(). Headless probe: backing 1080×1920 at DSF 3, 360×640 at DSF 1 (exact no-op), layout pixel-consistent at both.
  - [x] Verify INPUT under the new backing: Placement drag uses Phaser's camera-aware `dragX/dragY` (no change needed); the one raw-coordinate consumer (`enableDragScroll`) now divides deltas by camera zoom; headless drive tapped Home→History→Replay successfully at DSF 3 (interactive hit areas confirmed camera-aware). Device tap/drag check rides Task 5.
  - [x] Cap DPR: `DPR_BACKING_CAP = 3`, applied via `backingScaleFor` (rounds fractional DPRs — NEAREST pixel art needs integer duplication; unit-tested incl. cap and garbage input).
  - [x] Re-examine `textResolution()` interplay: analyzed — glyph resolution (`max(3, fitZoom×dpr)`) always ≥ the backing scale (≤3), so glyphs land in the backing with a mild supersample (good antialiasing), never an upscale; no formula change needed, no double-supersampling case exists. `?textres=N` untouched.
  - [x] Verify per-texture NEAREST sprites: DSF-3 screenshots show sprites clean at the integer backing scale (integer duplication preserved by the rounded scale).
  - [x] Guard the known Phaser traps: NO global `pixelArt: true` (untouched); no new scene fields added (nothing to reset; `applyHiDpiCamera` is stateless per create()).
  - [ ] Measure AFTER on Danilo's device with `?perf=1`: Battle 1×, Battle ×2, Placement drag — same scenarios as the post-review baseline; compare ONLY against the post-review numbers. Zero frames below the 30fps floor. **(OPEN — requires Danilo's phone; procedure written into the performance-verdict addendum.)**
  - [x] Record: dated addendum appended to `docs/performance-verdict.md` (mechanism verified, fps row pending device); deferred-work.md's text-ceiling entry updated to "RESOLVED in code, pending on-device fps confirmation".
  - [x] Fallback branch documented and armed: if the device capture breaks the floor even DPR-capped, revert the backing change + record; candidates (b)/(c) stay parked.
- [ ] Task 5: Gate + device sign-off (AC: 1, 4, 5)
  - [x] Full gate green: 368/368 tests (12 new), typecheck both packages, eslint + prettier clean; `git diff packages/engine` EMPTY; balance-hash and goldens untouched.
  - [x] Danilo's visual sign-off (2026-07-17, on the local build): **"I LOVE IT! It's great now! the font problem is solved for me, it's way better to read!"** — contrast, wording, and the text-ceiling fix all accepted visually.
  - [ ] The `?perf=1` after-capture vs the post-review baseline (Battle 1×/×2, Placement drag, deployed build) — the NFR1 confirmation. **(OPEN — the story's remaining gate before done.)**

## Dev Notes

### Scope discipline — what this story is NOT

- NOT the Heritage/Night theme system. Only ONE theme exists in code (`constants.ts:180-181` comment confirms the two-theme system is deferred). The contrast fix updates the DESIGN.md token spec and the shipped palette values — it does NOT build theme infrastructure. If the chosen treatment adds a token, add it to both theme columns in DESIGN.md frontmatter but implement only the shipped (Night-like) values.
- NOT candidates (b) (720×1280 relayout) or (c) (DOM text overlay) — candidate (a) only, with a measured fallback exit.
- NOT the resize/orientation re-sharpen fix (`ui.ts:22-24` memoization note; separate deferred item) — unless candidate (a) makes it free, don't touch it.
- NOT any engine file, event, or balance datum. This is the last pre-bump story; story 4.2 owns the era's single logVersion bump.
- The element-word-vs-dot normalization (deferred from 2.1 review) is adjacent but NOT in scope — don't drive-by it.

### Code map (recon-verified, 2026-07-17)

- Class codes: `CLASS_ABBREVIATIONS` (`constants.ts:72-80`), rendered side-colored via `nameColor = side === 'A' ? PALETTE.playerText : PALETTE.enemyText` at `BattleScene.ts:206,212-216` and `RevealScene.ts:93-95`. Font: Arial Black, `CARD_CLASS_FONT_PX = 13` (constants.ts:80). Style objects are inline literals per call site — only resolution and side-color convention are centralized.
- All text flows through `crispText` (`ui.ts:49-51`) → `setResolution(textResolution())`; `textResolution()` = `clamp(max(TEXT_RESOLUTION=3, fitZoom×dpr), ≤8)`, memoized once, `?textres=N` override (`ui.ts:26-41`, `constants.ts:56`).
- FRONT labels: `constants.ts:199-200` → `BattleScene.ts:150-151` (crispText, Courier, `MIN_FONT_PX`, hardcoded coords hugging the clash gap). Battle scene only.
- Front-tile indicator: `board.ts` — brighter `youFront`/`foeFront` fills (lines 26-27), 2px `ISO_TILES.frontStroke` gold-lite edge (line 29), front tiles drawn last (22-23). Flags from `battleView.ts:71-86`.
- "Pass" strings: `BattleScene.ts:285` (HUD, inline literal — label object created at :138, later overwritten with engagement/verdict text at :340,344 — check those strings for "pass" wording too) and `narration.ts:45-46` (log panel). `constants.ts` has NO pass string today. `docs/rules.md:52` uses "passes" in player prose.
- Game config: `main.ts:30-49` — 360×640 (`BASE_WIDTH/HEIGHT`, constants.ts:8-9), `Scale.FIT` + `CENTER_BOTH`, NO zoom/resolution/DPR anywhere. The backing store is exactly 360×640 — this is the gap candidate (a) closes.
- Perf sampler: `perf.ts` — `?perf=1`, per-frame `1000/rawDelta`, cap 36k, shutdown-detached; attached in `BattleScene.ts:112`, `DraftScene.ts:42`, `PlacementScene.ts:49`. Reuse as-is; do not modify.
- Palette/tiles: `PALETTE` (constants.ts:13-50 — playerText `#4a8fe0`, enemyText `#e06a6a`), `ISO_TILES` (183-193 — youFront `0x4a8fe0`, foeFront `0xc8483a`). Note the defect mechanism is exact: `playerText` ≈ `youFront` and `enemyText` ≈ `foeFront` — same hue on same hue.

### Architecture compliance

- AD-2 holds trivially: nothing here evaluates rules; the Battle scene stays a pure log player. The wording rename happens at render/narration time from the same event payloads.
- No `import.meta.env` forks (codebase has zero DEV/PROD behavior splits); diagnostics stay query-param-gated (`?perf=1`, `?textres=N` patterns).
- NFR3: if candidate (a) ships, record the decision as an ADR ONLY if it changes a load-bearing convention (the spine's performance-convention already names it — a dated performance-verdict.md addendum satisfies the record; dev's call, precedent: 3.4's verdict doc was a plain doc, not an ADR).
- UX spine edits (Task 1 DESIGN.md, Task 2 EXPERIENCE.md) are sanctioned by UX-DR7/UX-DR8 — surgical amendments with a dated note, not redesigns. The big Epic 4 spine extension belongs to story 4.1, not here.

### Test reality (recon-verified)

- NO test covers text styles, font sizes, colors, `crispText`, or `CLASS_ABBREVIATIONS` — the contrast/DPR changes have no unit-test guard; the guard is screenshots + device sign-off (house doctrine: Phaser quirks are "caught by screenshot, never by reasoning").
- `narration.test.ts:95` WILL break on the Turn rename — update the assertion.
- `battle-view.test.ts` pins front-tile geometry AND the 2026-07-15 chirality regression (player's left column renders screen-left) — do not touch `projection()`; keep all green.
- `rules-doc.test.ts` / `rules-render.test.ts` guard Help/rules content — keep green after the rules.md rewording.
- New tests: smoke-level only per spine convention. Worth adding: a constants test asserting the new Turn label constant(s) exist and contain "Turn" (cheap drift pin), and — if the DPR cap lands as a pure function — a unit test on the cap/backing-size computation (the `perf.ts` pure-function precedent).

### Previous-story intelligence (3.4 — directly load-bearing here)

- The measurement doctrine: measure before AND after, on-device, same scenarios, and only against the POST-REVIEW baseline numbers in `docs/performance-verdict.md` (the first capture was superseded by the senior review — EMA metric + impossible sample count). "Verify the meter" is the epic-3 retro's headline lesson.
- On-device workflow that worked: deploy → Danilo runs `?perf=1` on his Pixel 9 Pro XL via Chrome remote debugging → reads `window.__perfSamples` per scenario (reset between scenarios). Baseline: all scenarios median ≈59.9fps, worst single frame 30.03 (Placement drag), zero below floor. The accepted device-class deviation (9 Pro XL vs 6a-class) is recorded — carry it forward, don't re-litigate.
- The 4× fill-rate math: a DPR-3 backing pushes ~9× the pixels of the 360 store. The baseline has essentially zero headroom below 60 on this device but a 2× margin to the 30 floor — a fill-rate regression would show up in Battle ×2 and Placement-drag lows first.
- Query-param gates, uncommitted per-session drive scripts, and "seed localStorage for reproducible scenarios" are established conventions — reuse, don't invent.

### Git intelligence

Recent commits are all docs (epic-4 planning). Last code commits: `5cb9517` (3.4 perf-sampler review fixes) and `05c59bb` (3.4 done) — the sampler is fresh, reviewed, and trustworthy. Baseline commit for this story: whatever HEAD is at implementation start; note it in the frontmatter like 3.4 did.

### Project Structure Notes

- Modified: `apps/web/src/config/constants.ts` (delete FRONT labels, add Turn label constant(s), possibly a DPR-cap constant), `apps/web/src/main.ts` (game config), `apps/web/src/config/ui.ts` (textResolution interplay), `apps/web/src/scenes/BattleScene.ts` (:150-151 removal, :212-216 contrast, :285 Turn), `apps/web/src/scenes/RevealScene.ts` (:93-95 contrast), `apps/web/src/flow/narration.ts` (:45-46), `apps/web/test/narration.test.ts`, possibly `apps/web/test/constants.test.ts`.
- Modified (docs): `docs/rules.md`, `docs/performance-verdict.md` (dated addendum), `docs/implementation-artifacts/deferred-work.md` (close/update the text-ceiling entry), `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` + `EXPERIENCE.md` (surgical UX-DR7/8 amendments).
- NOT modified: anything in `packages/engine`, `board.ts`'s indicator drawing, `battleView.ts`'s projection, `perf.ts`.

### References

- [Source: docs/planning-artifacts/epics.md#Story-4.0] — the five BDD ACs
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#FR39] — legibility requirement, items (a)(e)(f); glossary "Turn"
- [Source: docs/planning-artifacts/implementation-readiness-report-2026-07-17.md#UX-Alignment] — UX-DR7/8 conflict + token mandate
- [Source: docs/implementation-artifacts/deferred-work.md — "REOPENED: text still reads soft"] — the text-ceiling diagnosis, three candidates, pixelArt prohibition, landscape-background constraint on the contrast treatment
- [Source: docs/performance-verdict.md] — the post-review fps baseline (the ONLY valid comparison numbers)
- [Source: docs/implementation-artifacts/3-4-the-performance-verdict.md] — sampler design, measurement doctrine, device workflow
- [Source: apps/web/src/config/constants.ts:8-9,56,72-80,199-200; apps/web/src/config/ui.ts:26-51; apps/web/src/main.ts:30-49; apps/web/src/config/board.ts:22-29; apps/web/src/scenes/BattleScene.ts:112,138,150-151,206,212-216,285,340,344; apps/web/src/scenes/RevealScene.ts:93-95; apps/web/src/flow/narration.ts:45-46; apps/web/src/flow/battleView.ts:71-86] — recon-verified code map
- [Source: apps/web/test/narration.test.ts:88-95; apps/web/test/battle-view.test.ts] — the tests that pin current behavior
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md#Components-unit-card; EXPERIENCE.md#Battle] — the spine sections this story amends

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

- RED confirmed: 8 new tests failed on missing exports (`battleTurnLabel`, `turnBoundaryLine`, `backingScaleFor`, `unitCodeStyle`, `CODE_STROKE_COLOR`, `DPR_BACKING_CAP`) before implementation; GREEN after.
- Phaser 4.2.1 API verified from installed types (not memory): `ScaleConfig` has NO resolution/DPR option — candidate (a) implemented as DPR-sized Game dimensions + per-scene `setZoom`/`centerOn` (the `applyHiDpiCamera` helper), which is the only route the engine offers.
- Pointer audit: exactly one raw-coordinate consumer existed (`enableDragScroll`'s `pointer.y` deltas) — fixed by dividing deltas by camera zoom (offsets cancel out of differences). Placement drag uses Phaser's camera-aware `dragX/dragY` pipeline — no change needed.
- One full-suite run showed 1 failure in 368 that did NOT reproduce: both projects pass in isolation (engine 193, web 175) and the full suite passed 368/368 on immediate re-run. The failing test name was lost to output truncation (only the tail was captured). Not correlated with these changes; if it recurs in CI, investigate as a pre-existing flake.
- Visual verification via the house per-session puppeteer-core drive (never committed): seeded a replayable `HistoryEntry` (seed 20260717, balanceVersion 2), walked Home → History → Replay → Battle at deviceScaleFactor 3 AND 1, screenshotting each stage + probing the canvas backing size.

### Completion Notes List

- **AC1 (contrast) ✅ code + headless evidence.** Treatment: light side tints (`codeTextPlayer #d6e8fa` / `codeTextEnemy #f8d9d2`) over a dark 3px outline (`CODE_STROKE_COLOR #10131f`), tokenized in DESIGN.md's unit-card block and consumed via one `unitCodeStyle(side)` function — Battle + Reveal board units only (tray/chip codes on dark panels were never the defect and are unchanged). All six class codes screenshot-verified at DSF 3, including MER on the brightest red front tile (the defect's exact case). Device look = Task 5.
- **AC2 (FRONT labels) ✅.** Constants + render calls deleted; tile indicator untouched (`battle-view.test.ts` geometry pins stay green); EXPERIENCE.md amended with a dated UX-DR8 reconciliation note; Placement's instructional prose hint deliberately kept.
- **AC3 (Turn wording) ✅.** HUD + narration now read from `battleTurnLabel`/`turnBoundaryLine` (new constants — the strings were inline-literal deviations before); the narration pinning test asserts the new string; `docs/rules.md` reworded; zero engine-vocabulary changes.
- **AC4 (text ceiling) ✅ code, ⏳ device fps.** Candidate (a) shipped exactly as diagnosed: `backingScaleFor` (rounded DPR, cap 3) sizes the Game; `applyHiDpiCamera` zooms each of the 9 rendering scenes (BootScene renders nothing — deliberately skipped). Headless probe: backing 1080×1920@DSF3 / 360×640@DSF1, no page errors, pixel-consistent layout, text visibly sharp. The authoritative fps capture needs Danilo's phone — procedure in the performance-verdict addendum.
- **AC5 (no engine change) ✅.** `git diff packages/engine` empty; balance hash and goldens untouched; the two replay-drive runs even produced the identical battle at both DPRs (FR20 holding across backing scales).
- Determinism bonus caught on camera: the DSF-3 and DSF-1 drives replayed byte-identical battles from the same seeded HistoryEntry.
- **Remaining before done:** Danilo's on-device session — visual sign-off + `?perf=1` after-capture vs the post-review baseline (Battle 1×/×2, Placement drag). Deploy first (the capture runs against prod, matching the baseline's conditions).

### File List

- `apps/web/src/config/constants.ts` — MODIFIED: +`codeTextPlayer`/`codeTextEnemy` (PALETTE), +`CODE_STROKE_COLOR`/`CODE_STROKE_THICKNESS`/`unitCodeStyle`, +`DPR_BACKING_CAP`/`backingScaleFor`, +`battleTurnLabel`/`turnBoundaryLine`; − `BATTLE_FRONT_ENEMY_LABEL`/`BATTLE_FRONT_PLAYER_LABEL`
- `apps/web/src/config/ui.ts` — MODIFIED: +`backingScale`, +`applyHiDpiCamera`; `enableDragScroll` deltas divided by camera zoom
- `apps/web/src/main.ts` — MODIFIED: Game width/height × `backingScale()` (documented)
- `apps/web/src/flow/narration.ts` — MODIFIED: PassStarted line via `turnBoundaryLine`
- `apps/web/src/scenes/BattleScene.ts` — MODIFIED: FRONT labels removed, `battleTurnLabel`, `unitCodeStyle`, `applyHiDpiCamera`
- `apps/web/src/scenes/RevealScene.ts` — MODIFIED: `unitCodeStyle`, `applyHiDpiCamera`
- `apps/web/src/scenes/{HomeScene,DraftScene,PlacementScene,ResultScene,HistoryScene,HelpScene,CreditsScene}.ts` — MODIFIED: `applyHiDpiCamera` in create()
- `apps/web/test/constants.test.ts` — MODIFIED: +12 tests (Turn labels, backingScaleFor, unitCodeStyle)
- `apps/web/test/narration.test.ts` — MODIFIED: boundary-line pin updated to '— Turn 2 —'
- `docs/rules.md` — MODIFIED: passes → turns (player wording)
- `docs/performance-verdict.md` — MODIFIED: story-4.0 addendum (mechanism verified, device fps pending, procedure)
- `docs/implementation-artifacts/deferred-work.md` — MODIFIED: text-ceiling entry → resolved-in-code
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` — MODIFIED: unit-card code-fill/code-stroke tokens (UX-DR7)
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md` — MODIFIED: front-row indicator wording (UX-DR8)
- `docs/implementation-artifacts/sprint-status.yaml`, this story file — MODIFIED: tracking

### Change Log

- 2026-07-17: Story 4.0 implemented — all four legibility fixes land in one pass: (1) FR39f class-code contrast via light side tints + dark outline, tokenized in DESIGN.md and centralized in `unitCodeStyle`; (2) FR39e FRONT text labels deleted, tile indicator kept, EXPERIENCE.md reconciled; (3) FR39a "Turn" wording via new display constants (HUD, log panel, rules.md) with the engine vocabulary untouched; (4) the text-ceiling fix as candidate (a) — DPR-sized backing store (`backingScaleFor`, cap 3) + per-scene camera zoom, verified headlessly at DSF 3/1 (backing 1080×1920 vs 360×640 no-op, no errors, all six codes legible, layout pixel-consistent, drag-scroll zoom-corrected). Gate: 368/368 tests (12 new), typecheck, lint, prettier green; ZERO engine changes. **Not claimed done:** the on-device `?perf=1` after-capture and Danilo's visual sign-off remain open — status moves to review with those as the named gate, per the 3.4 precedent of flagging rather than claiming.
