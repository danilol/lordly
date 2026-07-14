---
baseline_commit: ac07680bda619fcdc8a48561ad5d77fdb16c5d4c
---

# Story 2.4: Help, rules, and credits screens

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new player,
I want the rules explained inside the game and the artists credited,
so that a first-timer can learn the game cold and licenses are honored.

The epic-2 closer. Two new Phaser scenes complete the AD-5 nine: **Help/Rules** (player-worded rules rendered from a new standalone `docs/rules.md` — NFR3's rules document becomes an explicit artifact) and **Credits** (rendered from 2.1's attribution manifest — the license-honoring surface). Home grows its Help/Credits spurs; Draft gets a Rules link and its cards' final consistency pass (FR2).

## Acceptance Criteria

**AC1 — `docs/rules.md`: the standalone rules artifact (NFR3).**
A new `docs/rules.md` explains, **player-worded** ("medieval-fantasy but plain" — EXPERIENCE.md#Voice; NOT a PRD copy-paste): the match loop; the **class table** (class, role, HP, actions front/mid/back, behavior) with the **RPS triangle** (Mage > Knight > Archer > Mage, ×1.5 / ×0.75); **per-row behaviors** (action counts by row); **targeting basics** (reach/column adjacency, melee hits the nearest occupied row, arrows snipe the rearmost, mage blasts the fullest row, cleric heals the most-hurt ally or bonks, witch curses the rearmost); **elements & Witch spells** (water→sleep, earth→poison 15 at engagement end, fire→weaken half damage, wind→confusion 50% misfire; no stacking); **the AGI timeline** (passes, fastest first, Witch→…→Knight); **judging** (wipe wins; else higher % of starting HP; tie = draw); **modes** (Standard single engagement; Wipeout until a side falls, statuses except poison clear between engagements, judged after the cap). Content aligned with **PRD Features 3–5 as the single source of truth**. [Source: epics.md#Story 2.4; prd.md Features 3–5]

**AC2 — The drift guard: rules.md numbers are test-pinned to BALANCE.**
A unit test cross-checks every number in `docs/rules.md` against the engine's balance data (per-class HP, per-row action counts, poison damage, engagement cap, RPS multipliers) — the FR31-license-gate pattern applied to rules content: a future balance change that forgets the rules doc **fails the build** instead of shipping a lying Help screen. (Parse the doc's table/numbers in the test; keep the doc format stable enough to parse.)

**AC3 — Help scene renders FROM rules.md (FR27, NFR3, AD-5).**
A new `HelpScene` joins the FSM and renders the rules content **from `docs/rules.md`** (single source — Vite `?raw` import; see Dev Notes §"Importing rules.md" incl. the sanctioned fallback if Vite refuses the out-of-root import). Phone-readable per the floors (body ≥ 15px target, nothing under `MIN_FONT_PX`), **scrollable** (touch-drag with clamped bounds — the codebase's first scrolling surface), rendered through `crispText`. A tiny **pure markdown-lite renderer** (headings/paragraphs/table rows → typed line specs) does the parsing and is unit-tested; the scene stays a thin mapper of line specs to text objects.

**AC4 — Help is reachable from Home AND Draft, dismissible back to its origin (FR27).**
`Home → Help` and `Draft → Help` (a small Rules affordance on the Draft screen, ≥44px). Help carries an **origin** so dismissing returns where you came from — mid-draft state survives the round-trip (the `MatchFlow` is passed through and back; `DraftScene.create()` re-renders from flow state). Singleton-scene rule: origin/flow set in `init()` every entry.

**AC5 — Credits scene renders from the attribution manifest (FR31, AD-5).**
A new `CreditsScene` (Home → Credits) renders **every pack in `ART_ATTRIBUTIONS`** with **author, pack name, and license** (name + SPDX id; URL shown as text — read-only surface), plus what the pack supplies. NO hand-written credit lines — the manifest is the single source (a new pack added to the manifest appears with zero Credits-scene changes; a pure formatter `manifest → lines` is unit-tested). Dismissible by touch (`addHomeBack`).

**AC6 — Draft rules cards: final compact form, consistent with Help (FR2).**
The six Draft class cards get their consistency pass: wording on the cards (role/behavior from `CLASS_TEXT` via `classRulesCard`) and in `rules.md` must agree — the class **roles** in rules.md are test-pinned to `CLASS_TEXT` (same drift-guard test), and any card layout tidy-up keeps the 2.1 sprite + code + dot treatment. This is a polish-and-pin pass, not a redesign.

**AC7 — Scope fences.**
NO Settings scene/modal (its realization is an explicitly open UX call — stays deferred with the theme toggle), NO History (Epic 3), NO engine changes, NO new art (text-only screens), no PRD edits. Home adds exactly two spurs: Help, Credits.

**AC8 — Quality gate + on-device sign-off.**
Full gate green (`typecheck`, `lint`, `coverage`, `build`); new pure logic (markdown-lite renderer, credits formatter, drift guard) tested in `apps/web/test/`; scenes smoke-free. Headless drive: Home→Help→scroll→back, Home→Credits→back, Draft→Help→back-to-Draft with drafted units intact. **Final acceptance: Danilo reads the rules on his phone** — a first-timer could learn the game cold; credits honor the pack.

## Tasks / Subtasks

- [x] **Task 1 — Author `docs/rules.md` (AC1)**
  - [x] Player-worded doc written from PRD Features 3–5: loop, class table (parsable), triangle ×1.5/×0.75, rows-matter, six targeting rules, elements/spells (poison 15, weaken half, confusion 50%, no stacking), AGI timeline order, judging, both modes (cap 5). Voice: plain medieval-fantasy ("honor demands a rematch").
- [x] **Task 2 — The drift guard (AC2, AC6)**
  - [x] `rules-doc.test.ts` — 5 tests pinning per-class HP + f/m/b actions to `BALANCE.classes`, roles AND behaviors to the Draft cards (`classRulesCard` — AC6 consistency is executable), RPS pairs + exact multipliers from `BALANCE.formulas`, poison damage, engagement cap, and every element→spell pairing. Green against the authored doc on first run (numbers were law from the start).
- [x] **Task 3 — Markdown-lite renderer (AC3)**
  - [x] `flow/rulesDoc.ts` — pure `parseRulesDoc` (3 heading levels, body, bullets, table rows, separator skipping, emphasis stripping, spacer collapsing). 5 tests incl. a no-lost-content check against the REAL rules.md. (Fun: the doc comment's `**bold**/*italic*` literally closed the block comment — reworded.)
- [x] **Task 4 — HelpScene (AC3, AC4)**
  - [x] `?raw` import of `../../../../docs/rules.md` works in dev, build, typecheck AND tests (the test files import the doc the same way — no `@types/node` needed, and the mechanism is exercised four ways). No fallback twin required.
  - [x] Scrollable container (touch-drag, clamped both ends); class-table rows render STACKED (name+role / HP·Actions mono / behavior — the sanctioned 360px fallback); body 15px, floors held. _Empirical finding: Phaser 4 GeometryMask silently failed to clip (quirk sibling of polygon-triangles) — replaced with an opaque header strip + depth-lifted back affordance, render-API-proof._
  - [x] Origin-aware dismissal via the new shared `addBackAffordance` (generalizing `addHomeBack`, which now delegates to it); `init({from, flow})` per entry (singleton rule). Registered in the FSM.
- [x] **Task 5 — CreditsScene (AC5)**
  - [x] Pure `flow/credits.ts` `formatCredits` (2 tests: one block per pack, all fields present, supplies listed). Scene renders blocks generically; long URLs wrap via `useAdvancedWrap`; `addHomeBack`; registered in the FSM.
- [x] **Task 6 — Home spurs + Draft link (AC4, AC6, AC7)**
  - [x] Home: Help + Credits buttons (mode-toggle metrics, 128×44, y 0.9) — exactly two spurs.
  - [x] Draft: `? Rules` top-right (72×36 hit, mirroring `‹ Home`) → Help with `{from:'Draft', flow}`; round-trip drive proved 2 drafted units survive.
  - [x] Card consistency: pinned executable (roles + behaviors byte-equal between cards and rules.md via the drift guard); no layout change needed.
- [x] **Task 7 — Gate + drives + acceptance (AC8)**
  - [x] Headless drives: Home→Help→scroll→Back; Home→Credits→Home; Draft(2 units)→Rules→Back→units intact. Zero pageerrors. Full gate green: typecheck, lint, **284 tests** (33 files; +12 new), build.
  - [x] On-device sign-off with Danilo (read the rules cold; check credits). _Danilo 2026-07-14: "Everything is great, besides the font" — accepted; font = the tracked 2.1-diagnosed backing-store ceiling ("I'll survive for now"), not a 2.4 finding._
  - [x] Epic note recorded: 2.4 done ⇒ epic-2 → done + retrospective next (balance/tactics wish-cluster planning pass).
### Review Findings (code review 2026-07-14)

_3 layers, full mode vs ac07680. Architecture verified sound (singleton reset, scroll clamp, ?raw failure-is-loud, spacer logic, round-trip). 11 patch (ALL APPLIED per Danilo's wrap-up directive), 6 dismissed._

- [x] [Review][Patch] Drift guard leaves stated numbers unpinned — AGI speed order, confusion 50%, row-count staleness [apps/web/test/rules-doc.test.ts] — the guard's own docstring promises "every number"; pinned: speed-order sentence derived from BALANCE AGI sort, misfire % from `confusionMisfire`, exactly 6 data rows. (Weaken's "halved" is a resolve.ts hardcode, not balance data — noted, unpinnable.) (blind+auditor)
- [x] [Review][Patch] Scroll drag ending over the back affordance navigates away mid-read [HelpScene] — drag/tap disambiguation added (movement threshold guards the back tap). (blind+edge)
- [x] [Review][Patch] Credits can't scroll — pack 3+ would render off-canvas, silently violating attribution [CreditsScene] — the Help drag-scroll extracted to a shared `enableDragScroll` helper (wheel support included), applied to both scenes. (blind+edge)
- [x] [Review][Patch] Empty table cells silently shift columns in parser AND test helper (correlated bug) [rulesDoc.ts + rules-doc.test.ts] — split now preserves interior empties (outer pipes sliced), both sides; parser test added. (blind+edge)
- [x] [Review][Patch] Rules/back tap targets 36px < AC4's explicit ≥44px [DraftScene, ui.ts addBackAffordance] — hit rects bumped to 44px tall. (auditor)
- [x] [Review][Patch] No mouse-wheel scroll on the first scrolling surface [HelpScene] — wheel handler in the shared scroll helper. (blind+edge)
- [x] [Review][Patch] Header row detected by literal 'Class'; separator regex re-implemented divergently in a test [rulesDoc.ts, rules-render.test.ts] — parser now retags the row preceding a separator as `tableHeader` (structure, not content); the test uses the parser's exported separator predicate. (blind+edge)
- [x] [Review][Patch] Credits omits the license URL the manifest carries [flow/credits.ts] — added (AC5's "URL as text" now satisfied under both readings). (auditor)
- [x] [Review][Patch] Bulk reading content (bullets: all targeting rules, spells, modes) at 14px vs AC3's body ≥15px target [HelpScene] — bullets bumped to 15px. (auditor)
- [x] [Review][Patch] Archer/Witch bullets drop the reach qualifier; no same-row tie-break hint [docs/rules.md] — reworded to "rearmost row it can reach" / witch "rearmost enemy she can reach"; one tie-break sentence added. Table behaviors untouched (pinned to cards). (auditor)
- [x] [Review][Patch] `HelpEntry` permits from:'Draft' without flow (would crash Draft on return); `backgroundFill` duplicates the background hex unguarded [HelpScene.ts, constants] — discriminated union ties them; a constants test pins hex↔number equality. (blind+edge)

Dismissed (6): `plain()` corrupting `2 * 3` prose (hypothetical in a controlled doc; drift guard + review cover); no markdown-subset lint (docstring documents the subset; content-count test + review suffice); repeating-decimal multiplier formatting (fails guard-style, acceptable); multitouch drag (Phaser default tracks one pointer — verified); `cap()`/path/geometry duplication nits (noted, below the value bar); scene-listener stacking (verified clean in Phaser source by the reviewer).

## Dev Notes

### Importing rules.md into the Help scene (the one technical riddle)
`docs/rules.md` lives OUTSIDE `apps/web` — the import is `import rulesRaw from '../../../../docs/rules.md?raw'` (adjust depth; `?raw` types ship with `vite/client`, already referenced). Vite dev-serves files outside root when a workspace root is detected (pnpm workspace at repo root — expected to work) and inlines the string at build. **Verify empirically first** (house rule): if dev or build refuses the out-of-root import, the sanctioned fallback is a checked-in copy at `apps/web/src/content/rules.md` with a **byte-equality test** against `docs/rules.md` (drift-proof twin — same executable-guard pattern as AC2). Do NOT reach for a build plugin.

### The content source map (player-worded, but numbers are law)
- PRD **Feature 3** (FR7–FR13): reach, melee-nearest-no-bypass + column priority, archer-rearmost, mage fullest-row (tie → rearmost), cleric lowest-HP%-ally-else-staff-bonk, witch rearmost-preferring-unafflicted, AGI passes + multihit split + tie rules. [prd.md:53–65]
- PRD **Feature 4** (FR14–FR16): RPS ×1.5/×0.75; the class table (HP 140/110/90/80/90/85; actions 2-1-1, 2-1-1, 1-2-2, 1-1-2, 1-1-2, 1-1-2); witch spells incl. poison **15** at engagement end, weaken **halves** damage, confusion **50%** misfire semantics. [prd.md:67–96]
- PRD **Feature 5** (FR17–FR19): single engagement; judging (wipe → else HP% → tie draw); wipeout (statuses-except-poison clear; cap **5** engagements — read `BALANCE.engagementCap` in the test, never hardcode). [prd.md:98–103]
- Player wording examples already exist: `CLASS_TEXT` roles/behaviors in `apps/web/src/flow/draftModel.ts` (rendered on Draft cards via `classRulesCard` — keep rules.md consistent with these, AC6) and `MODE_STANDARD_HINT`/`modeWipeoutHint` in constants.
- Voice: "Medieval-fantasy but plain" [EXPERIENCE.md#Voice and Tone]; scrollable; no tutorial gate (FR27's five-minute loop stays untouched — Help is a spur, never a gate).

### Scene wiring (verified current state)
- `main.ts:32`-ish `scene:` array — add `HelpScene`, `CreditsScene` (order after ResultScene is fine; Boot stays first). AD-5's nine-scene list includes Help and Credits — this story completes it (History is Epic 3's).
- **HomeScene**: title 0.3, Play 0.58, mode heading 0.7, toggle row 0.76 — the Help/Credits row fits ~0.88–0.9 (two ~150×44 buttons, `BUTTON`-style constants in `config/constants.ts`, labels as exported constants for tests).
- **DraftScene**: static header area has room near the title/hint (y≤60) or bottom-left; keep clear of the 6-card grid (top 74 → ~320) and tray (360+). The affordance must not shrink existing tap targets.
- **Dismissal to origin**: `HelpScene.init(data: { from: 'Home' | 'Draft'; flow?: MatchFlow })` — back button does `scene.start(data.from, from === 'Draft' ? { flow } : undefined)`. `DraftScene` re-renders from `flow.getState()` (1.8 thin-renderer pattern) so drafted units/elements survive. **Singleton rule**: set `from`/`flow` in `init` every entry; no other transient state should exist in these two scenes (they're static renderers).
- `addHomeBack` hardcodes `scene.start('Home')` — Help needs its own origin-aware back (reuse the padded-hit-area pattern from `config/ui.ts:addHomeBack`, don't fork the styling).

### Scrolling (first scrolling surface in the codebase)
Cheap and sufficient: render all lines into a `Container`, `setInteractive` on a full-screen zone with drag → move container.y, clamped to `[min(0, viewH − contentH), 0]`; a `Geometry` mask (or just headroom margins) keeps lines out of the HUD. No physics, no momentum needed (nice-to-have only if trivial). Reduced motion: irrelevant (user-driven). Keep the scroll math as a pure helper if it grows beyond three lines — testable clamp.

### Credits data (verified in-session)
`ART_ATTRIBUTIONS: readonly ArtPackAttribution[]` in `apps/web/src/assets/attribution.ts` — fields: `pack, author, url, license (SPDX), licenseName, licenseUrl, assets[], classSources (Partial<Record<UnitClass, string>>)`. One entry today (Dungeon Crawl Stone Soup 32×32, CC0-1.0). The Credits scene renders ALL entries generically — the manifest's license-gate test already guarantees field completeness; the formatter test guards the mapping.

### Hard-won lessons (memories — do not re-trip)
- **Singleton scenes**: reset/`init`-set all per-entry state (`from`, `flow`).
- **Text ceiling**: rules text will read as soft as everything else (known 360-backing ceiling, deferred) — body at 15px+ mitigates; not a 2.4 bug.
- **Phaser 4 `add.polygon` breaks quads** — irrelevant here (text-only); Graphics paths if any decoration appears.
- **Everything through `crispText`**; metrics/labels in `config/constants.ts`, not inline.
- **Empirical over reasoned**: try the `?raw` import first; drive the scenes and read them.

### Testing standards
- Pure/tested: `parseRulesDoc`, credits formatter, the AC2 drift guard (node `fs.readFileSync` of `docs/rules.md` — tests run from repo root via the vitest projects config; resolve the path robustly, e.g. `new URL('../../../docs/rules.md', import.meta.url)`).
- Scenes smoke-free (house convention). Engine untouched — coverage gate unaffected.

### Project Structure Notes
- New: `docs/rules.md`, `apps/web/src/scenes/HelpScene.ts`, `apps/web/src/scenes/CreditsScene.ts`, `apps/web/src/flow/rulesDoc.ts` (+ tests: `rules-doc.test.ts`, `rulesDoc/credits` formatter tests).
- Modified: `main.ts` (FSM), `HomeScene.ts` (spurs), `DraftScene.ts` (link), `constants.ts` (labels/metrics), possibly `ui.ts` (origin-aware back helper).
- Baseline `ac07680` is clean and deployed.

### References
- [Source: docs/planning-artifacts/epics.md#Story 2.4 (lines 452–469)] — the three BDD ACs (Help content + rules.md artifact + card polish; Credits from manifest; both scenes in the AD-5 FSM).
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#Features 3–5 (lines 53–103)] — the definitive rules content; #NFR3 (rules doc artifact); FR27 (loop + help), FR31 (credits).
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md#Information Architecture, #Help / Rules, #Credits, #Voice and Tone] — spurs, origin-dismissal, read-only credits, voice; Settings explicitly undecided → fenced out.
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-5] — the closed nine-scene FSM; NFR3 documentation conventions.
- Code: `apps/web/src/flow/draftModel.ts:47` (classRulesCard/CLASS_TEXT), `apps/web/src/assets/attribution.ts` (manifest), `apps/web/src/scenes/HomeScene.ts` (layout), `apps/web/src/config/ui.ts` (addHomeBack pattern, crispText), `packages/engine` BALANCE (drift-guard source).
- Prior stories: 2.1 (manifest + license-gate test pattern → AC2's drift guard), 2.3 (singleton/init discipline, headless drive pattern), `deferred-work.md` (Settings/theme fence; balance wish-cluster waiting on the retro).

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) via Claude Code

### Debug Log References

- RED→GREEN: drift guard green on first run (5/5 — doc authored from BALANCE); parser/formatter RED on missing modules → 7/7 GREEN.
- `rulesDoc.ts` transform error: the doc comment's literal `**bold**/*italic*` contained `*/` and closed the block comment — reworded.
- `node:fs` in tests failed typecheck (browser-pure web package, no `@types/node` by design) → tests import rules.md via the same `?raw` mechanism as the scene: cleaner AND proves the import path under vitest + tsc + vite build simultaneously.
- **Phaser 4 GeometryMask silently failed to clip the scroll container** (content rode over the back affordance — screenshot-verified). Same quirk family as `add.polygon`. Fix: opaque header strip + depth-lifted affordance. Candidate for the quirks memory.
- Credits URL overflowed as one long token → `useAdvancedWrap`.

### Completion Notes List

- **AC1 ✅** `docs/rules.md` — NFR3's rules artifact, player-worded from PRD Features 3–5.
- **AC2 ✅** Drift guard: HP/actions/roles/behaviors/RPS+multipliers/poison/cap/element-spells all pinned to BALANCE + the Draft cards. A forgotten rules-doc update now fails CI.
- **AC3 ✅** HelpScene renders FROM rules.md (`?raw`, single source — no fallback twin needed); pure tested parser; scrollable, clamped; floors held (body 15px, min 10+).
- **AC4 ✅** Home→Help and Draft→Help; origin-aware dismissal; mid-draft army survives the round-trip (drive-proven).
- **AC5 ✅** CreditsScene from `formatCredits(ART_ATTRIBUTIONS)` — author, pack, license (name+SPDX), URL, supplies; zero hand-written credit lines.
- **AC6 ✅** Card↔rules consistency is executable (drift guard covers roles AND behaviors); cards keep their 2.1 treatment.
- **AC7 ✅** No Settings, no History, no engine changes, no new art; exactly two Home spurs.
- **AC8 ✅** Gate green (284 tests), drives clean; on-device accepted (font remark = known deferred ceiling).

### File List

- `docs/rules.md` — NEW: the standalone player rules artifact (NFR3)
- `apps/web/src/flow/rulesDoc.ts` — NEW: pure markdown-lite parser
- `apps/web/src/flow/credits.ts` — NEW: pure credits formatter
- `apps/web/src/scenes/HelpScene.ts` — NEW: scrollable rules scene, origin-aware dismissal
- `apps/web/src/scenes/CreditsScene.ts` — NEW: manifest-driven credits scene
- `apps/web/test/rules-doc.test.ts` — NEW: the AC2 drift guard (5 tests)
- `apps/web/test/rules-render.test.ts` — NEW: parser + formatter tests (7 tests)
- `apps/web/src/main.ts` — MODIFIED: FSM registration (9 scenes + Boot)
- `apps/web/src/scenes/HomeScene.ts` — MODIFIED: Help/Credits spurs
- `apps/web/src/scenes/DraftScene.ts` — MODIFIED: `? Rules` link
- `apps/web/src/config/constants.ts` — MODIFIED: labels + `PALETTE.backgroundFill`
- `apps/web/src/config/ui.ts` — MODIFIED: `addBackAffordance` (addHomeBack delegates)
- `docs/implementation-artifacts/sprint-status.yaml`, this story file — MODIFIED: tracking

### Change Log

- 2026-07-14: Story 2.4 implemented — docs/rules.md (player-worded, BALANCE-drift-guarded), HelpScene rendering FROM the doc (`?raw` single source; first scrolling surface; Phaser 4 mask quirk worked around), CreditsScene from the attribution manifest, Home spurs + Draft Rules link with flow-preserving round-trip. 284 tests green; all flows headless-verified. Pending: on-device sign-off.

### Debug Log References

### Completion Notes List

### File List
- 2026-07-14 (code review): 3-layer adversarial review — 11 patches applied (drift guard now pins AGI order/misfire %/row count; drag-vs-tap disambiguation; Credits scroll via shared enableDragScroll + wheel; positional table cells both sides; 44px targets; tableHeader by structure; license URL; 15px bullets; reach-qualified wording; HelpEntry union; backgroundFill pinned), 6 dismissed. Gate green (289 tests); flows re-driven clean. Status → done. EPIC 2 COMPLETE.
