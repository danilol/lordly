---
baseline_commit: 04ecd12c48c9b23b1f7ba3e735b9ac092ec797ae
---

# Story 5.6: The unit-data card

Status: done

## Story

As a player,
I want to open a unit's data card while assembling my squad,
so that I can see exactly what each class does per row before I commit — the OB64 UNIT DATA read.

## Acceptance Criteria

1. **The card opens at Placement and reads live from BALANCE.** Given a unit in the Placement tray or on the board, when the player uses the card gesture (decided in-story — tap is taken by the crown; the epic-4 retro **gesture-audit team agreement** applies), a modal/bottom-sheet opens showing: per-row moves WITH counts (the 4.11 `rowActionCounts`/`moveDisplayName` seams), a damage-type glyph per move row, the stat block (STR/VIT/INT/MEN/AGI/DEX), HP, and the unit's element — all read live from `BALANCE`, so the 5.4/5.5 waves' 27 classes appear automatically — no card change per class beyond the one existing FR16 Cleric/Witch read (Task 1). *(Deliberate, dated deviation 2026-07-29, PO-directed at device round 2: the NUMERIC stat block was replaced by the stat SPIDER CHART — per-axis roster-max scaling, name-only labels; "a spider chart for the stats, instead of displaying the raw numbers" — so the AC's "stat block (STR/VIT/INT/MEN/AGI/DEX)" ships as the six-axis radar, not numbers.)*
2. **The card never blocks on art.** Given Danilo's Midjourney portrait batch (prompt pack **§5** — the epics text says "section 2", which is the unit-sprites section; portraits live in §5 "Portraits (later — for the unit-data card)"), when portraits are available the card shows the class portrait; without the batch the card ships with the interim board sprite in the portrait slot and gains real portraits in 5.9. *(Deliberate, dated deviation from the epic text 2026-07-29: epics.md says "ships portrait-less" — the interim-sprite slot is chosen instead under the art-story split so the LAYOUT ships tested and the 5.9 swap is one lookup, not a re-lay; Danilo can veto to portrait-less at the device pass.)*
3. **The spine is amended and the gate holds.** Given the UX spine, when the card ships, DESIGN.md/EXPERIENCE.md gain the card's layout and gesture as a dated amendment (the 5.2 amendment precedent), Danilo's device pass accepts it, and there is **no engine change, no version bump** (`balanceVersion` 11 and `logVersion` 4 both untouched).

## Tasks / Subtasks

- [x] Task 1: The pure card model — `apps/web/src/flow/unitCard.ts` (AC: 1)
  - [x] `unitCard(cls, element)` returns the full card data: display name (`CLASS_DISPLAY_NAME`), portrait key (interim: the class's own `UNIT_FRAMES` sprite), the stat block + HP from `BALANCE.classes[cls]`, the slot cost via `SLOT_COST[BALANCE.classes[cls].sizeClass]` (the cost table is its OWN export — `balance.ts:638`, on the barrel; never hardcode 1/2), the element, and one row entry per `ALL_ROWS`.
  - [x] Each row entry: the move label via `moveDisplayName(kind, element, cls)` (class verbs — "Skewer", "Ember Breath" — for free), the count via `rowActionCounts(cls)` (flow/placement.ts:152), and the damage-type GLYPH.
  - [x] The glyph derivation is EXHAUSTIVE over `RowMove` with no default (the 5.4 dispatch discipline — a future kind is a compile error here, never a silently wrong glyph): `slash`/`arrow`/`bash`/`staff`/`breath` → physical; `bolt`/`blast` → magic; `guard-full`/`guard-half` → a shield mark, no damage type. **The source is ROSTER.md's move-catalog Damage column — NOT the epic AC's "blast/spell = magic; slash/arrow/bash/staff = physical", which predates 5.4's `bolt` (magic) and 5.5's `breath` (PHYSICAL, E5-D7).** Pin the two newcomers explicitly.
  - [x] The Cleric/Witch read (ROSTER's own table shape — dossier carry: "the table's shape IS the card's content", per-row per ROSTER.md:46-47): the Cleric reads "Heal / Staff" on front and mid and "Heal ×2" on back (no staff fallback shown there — the table's shape); the Witch reads her ACTUAL element-keyed spell by name on every row — `SPELL_DISPLAY_NAME[BALANCE.elementSpells[element]]` ("Sleep" for a water witch), which is why the card takes the UNIT's element, not just the class.
  - [x] **Glyphs for the two FR16 rows — ROSTER's Damage column deliberately EXCLUDES them ("NOT move-table rows", ROSTER.md:28), so the RowMove derivation cannot supply these; state them here:** the Witch's Cast = MAGIC (the dossier rule's "spell = magic", DOSSIER.md:134 — and OB64's own staff-icon-over-Acid-Vapor evidence); the Cleric's Heal = a HEAL mark of its own, no damage type (restorative, the HEAL_TRACE_COLOR philosophy: a heal carries no aggression read). Pin both in the test list.
  - [x] Tests exhaustive over `ALL_CLASSES` × `ALL_ROWS` (27 × 3 — every label/count/glyph resolves, no gaps), plus pins: breath-is-physical, bolt-is-magic, guard rows carry no damage type, the witch's card names the right spell for each of the four elements, monster slot cost 2 / Whelp 1.
- [x] Task 2: The gesture — decide, audit, implement (AC: 1)
  - [x] **Recommendation to confirm with Danilo at dev start (the 5.5 tabs precedent): LONG-PRESS (~450ms hold, still pointer) on any unit card — tray or board.** *(Recorded honestly: the go-ahead was INFERRED from Danilo launching dev-story right after the recommendation was presented at story creation; the gesture was then explicitly accepted across five device rounds, which settles it.)* Every tap variant is taken (tray double-tap = auto-place; placed single-tap = deferred crown-toggle; placed double-tap = remove; movement ≥ 10px = drag), and a per-card ⓘ can't work: the cards are 64×64 (`PlacementScene.ts:267`) with the FULL 64px face as the drag/tap hit area, so a 44px-floor ⓘ inside it would swallow most of the drag surface. Long-press is also the genre's "hold to inspect".
  - [x] **The gesture audit (epic-4 retro team agreement — MANDATORY before review).** The full PlacementScene interaction table the new gesture must not perturb: `dragDistanceThreshold = TAP_DISTANCE_PX` (10px) starts a drag; a still pointerup is a tap; tray double-tap within `DOUBLE_TAP_MS` (300) auto-places; a placed unit's single tap arms a `pendingCrownTimers` entry DEFERRED past the double-tap window; placed double-tap removes AND cancels that timer; `dragstart` clears tap state; row badges clear on `drop` AND `dragend` (the destroy-vs-dragend trap, 4.11). The long-press timer: starts on `pointerdown`, cancels on `dragstart`/movement > `TAP_DISTANCE_PX`/`pointerup`; when it FIRES, it must consume the gesture so the eventual pointerup neither taps nor arms the crown timer.
  - [x] Reset all new gesture state in `create()` (singleton scenes) — including any pending long-press timer (the `pendingCrownTimers` cleanup precedent at line ~106).
- [x] Task 3: The card overlay UI (AC: 1, 2)
  - [x] A bottom-sheet/modal over Placement: `addFramedPanel` for the body, a full-screen input-BLOCKING scrim behind it (an interactive rectangle that swallows board taps — nothing underneath may receive input while the card is up), depth above the toast's 200.
  - [x] Content: portrait slot (interim `addUnitSprite` at a large INTEGER multiple — per-texture NEAREST is already on the sheet, integer scales keep it crisp), name + element badge (`addElementBadge`), the three move rows (label · ×count · glyph), the stat block + HP + slot cost. *(As-shipped deviations, dated 2026-07-29: the portrait deliberately does NOT use `addUnitSprite` — its monster loom would burst the shrunk header, so it renders the raw frame at a fixed 64 (round 2); and the stat block became the radar (round 2, see AC1's note).)*
  - [x] Close affordances: tap-the-scrim AND an explicit ✕ at ≥44px (FR30). Closing DEFERS the overlay destroy one tick (`this.time.delayedCall(0, …)`) — the 5.5 review lesson: never destroy the dispatching object mid-event.
  - [x] Respect reduced motion (UX-DR6): if the sheet animates in, damp or skip under the existing reduced-motion flag; a static appear is acceptable.
- [x] Task 4: Geometry as arithmetic, not device passes (AC: 1)
  - [x] Card geometry constants in `constants.ts` (the DRAFT_GRID/DRAFT_TABS pattern) + a pure geometry test: the card fits 360×640 with the WORST content — "Dragon Hunter" (the roster's only two-word name), three move rows with verbs like "Radiant Breath ×1", six stats + HP + element; text budgets MEASURED (~6.2px/char at 8px, ~4.8 at 10px — the 5.4/5.5 method), the ✕ floor pinned.
- [x] Task 5: The UX spine amendment (AC: 3)
  - [x] `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md`: the card's component tokens (sheet ground, row layout, glyph treatment — gold stays the metal, never a side colour) as a DATED amendment; `…/EXPERIENCE.md`: the gesture + open/close flow, dated (the 5.2 precedent: amendments carry their date and reason).
- [x] Task 6: Docs + gate (AC: 3)
  - [x] No engine file changes; `balanceVersion` stays 11, `logVersion` stays 4 (assert nothing in the diff touches packages/engine).
  - [x] No rules.md change required (the card surfaces data rules.md already documents) — but VERIFY no drift guard trips.
  - [x] Full gate: typecheck, lint, knip, coverage (engine ≥90%), web build.
  - [x] Device pass with Danilo — **ACCEPTED 2026-07-29 after five rounds ("I am very happy with the result")**: opaque card, staggered radar, ■□ size read, inline glyphs, OB64 row icons, and the round-5 extension to Draft (tile previews + tray full cards).

### Review Findings (senior code review 2026-07-29 — Fable 5, 3 adversarial layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor)

- [x] [Review][Patch] HIGH (compound, fix as ONE mechanism): the `longPressFired` consume flag goes STALE — the opening press's release lands on the topmost scrim (topOnly), never on the unit, so the flag survives every card session and silently eats one later tap (a crown, a tile select, a tray REMOVE) [unitCardOverlay.ts + both scenes]
- [x] [Review][Patch] HIGH (the other half): pointerdown-close + one-tick destroy lets the dismiss-tap's RELEASE fall through onto live controls — Draft's ✕ zone sits atop army tray slot 5 (tap = removeUnit); today the stale flag absorbs it by accident, so the two defects mask each other [unitCardOverlay.ts:close paths]
- [x] [Review][Patch] MEDIUM: the consume branch early-returns WITHOUT cancelling the eaten tap's own freshly-armed timer — a spurious card opens 450ms after the eaten release [both scenes' pointerup]
- [x] [Review][Patch] MEDIUM: a rebuild mid-hold (pending crown timer's redraw at Placement; tab-switch buildGrid/redraw at Draft) destroys the pressed container — every cancel signal dies with it and the armed card timer force-fires [PlacementScene.redraw, DraftScene.buildGrid/redraw]
- [x] [Review][Patch] MEDIUM: Draft does not implement LONG_PRESS_MS's documented movement-cancel contract (no drag there to do it for free) — a ~90px wander inside an 80×48 tile still fires; Draft's tile/tray pointerups also lack Placement's getDistance tap guard [DraftScene.armCardPress + constants comment]
- [x] [Review][Patch] MEDIUM: AC1 still requires the numeric "stat block" with no deviation note — round 2 replaced it with the radar (PO-directed); AC2's own dated-note precedent applies [story AC1]
- [x] [Review][Patch] MEDIUM: DESIGN.md's amendment is stale from before round 5 — "at Placement" only, always-dotted subline, and a `{components.stat-radar}` token registered nowhere [DESIGN.md]
- [x] [Review][Patch] MEDIUM: EXPERIENCE.md misstates Draft tap semantics while claiming to cover both scenes ("nothing on a tray unit" — a Draft tray tap REMOVES; "10px threshold is still a drag" — Draft has no drag) [EXPERIENCE.md]
- [x] [Review][Patch] LOW: the ✕-clearance pin passes at exactly 0px margin on an estimated text metric (+6 for a 10px label; Phaser renders ~13-14px) — raise radarCYOffset and the label budget so the pin holds with real margin [constants + test]
- [x] [Review][Patch] LOW: the "worst content" geometry tests assert the extremes BY FIAT ("Radiant Breath ×1", "DRAGON HUNTER") — derive the maxima over ALL_CLASSES × elements from the model so a 28th class can't overflow with green tests [unit-card.test.ts]
- [x] [Review][Patch] LOW: CARD_GLYPHS/CARD_GLYPH_COLORS claim CardGlyph keying but use a hand-duplicated literal union — single-source the type [constants.ts + unitCard.ts]
- [x] [Review][Patch] LOW: the "no shipped class carries blast" assumption in cardRow is load-bearing and unpinned — one assertion over the move tables makes the comment enforceable [unit-card.test.ts]
- [x] [Review][Patch] LOW: 0xe8e4d8 hardcoded twice as "buttonText's numeric twin" (a silent-drift pair) and the geometry test re-derives nameX from the same inline 64+10 it claims to pin — tokenize boneFill + portraitW/nameGap [PALETTE/UNIT_CARD + overlay + test]
- [x] [Review][Patch] LOW: the Draft tile pointerup rewrite left a vestigial bare `{ }` block [DraftScene.ts]
- [x] [Review][Patch] LOW: stale future tense survives the accepted pass ("Danilo tunes the feel at the device pass") in LONG_PRESS_MS's comment and EXPERIENCE.md [constants + EXPERIENCE.md]
- [x] [Review][Patch] LOW: record accuracy — File List says "13 tests" (file has 21); change-log +arithmetic skips round 4's two pins; Task 3's checked text vouches for addUnitSprite (superseded round 2); Task 2's dev-start confirmation is checked on an inference the notes admit; the Dev Notes scope fence still forbids the Draft card round 5 shipped; the round-5 "same audit discipline" parity claim overstates (no movement cancel at Draft — true after this review's fix) [story file]
- [x] [Review][Patch] LOW: knip.jsonc's terser-ignore retirement rides in a UI story on a rationale entangled with the same reinstall that produced it — commit it separately and watch CI's clean-install knip run; restore the ignore (with its mechanism comment) if it re-flags [knip.jsonc]
- [x] [Review][Defer] Multi-touch around the new gesture (second finger re-arms the shared timer; a card during a drag freezes the unit mid-air; close-during-drag resumes swallowed drag events) [both scenes] — deferred, pre-existing: the entire scene gesture system is single-pointer by design since 1.8 (crown/double-tap timers are equally multi-touch-naive); logged as its own audit item

**Dismissed as noise: 0.** All three layers converged on the same core defect from different directions — the strongest possible signal it is real.

**Independently re-verified by the Acceptance Auditor:** engine diff 0 lines, versions untouched, glyph truth table vs ROSTER, all geometry arithmetic re-derived by hand (including the offset-100-fails-by-2px claim), MAX_SLOT_COST/radar-scaling/portrait claims, and the deferred-work separation all check out.

## Dev Notes

### The dossier and the wish are the spec

- `DOSSIER.md` (signed off 2026-07-27) line ~134: every `MoveKind` "stat[es] its damage type for the 5.6 card glyph rule"; §Downstream carries: "The 5.6 card reads everything live from `BALANCE` — the table's shape IS the card's content."
- `ROSTER.md` §move catalog is the glyph truth table (Damage column): `bolt` is MAGIC, `breath` is PHYSICAL — the epic AC's glyph sentence predates both.
- Danilo's wish, verbatim source: `deferred-work.md` §"Logged from: story 4.11" — the "Pierce ×2 front / Banish ×1 mid" read; the glyph "small, and placed where it makes sense"; **explicitly NOT in scope: derived physical/magical defense summaries ("LATER, explicitly not needed now") and the OB64 information-density rework of Placement ("that would mean a total rework")**.
- OB64 evidence on disk: `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/imports/OB64 references/images/` (incl. the Organize Screen capture). Danilo showed three UNIT DATA screenshots in conversation 2026-07-20; if pixel-level fidelity questions come up mid-story, ASK for them again rather than inferring (the source-evidence team agreement).

### What already exists — reuse, don't rebuild

- `rowActionCounts` (`flow/placement.ts:152`), `moveDisplayName`/`MOVE_PLATE_NAMES`/`CLASS_MOVE_NAMES`/`SPELL_DISPLAY_NAME` (`config/constants.ts`), `BALANCE.elementSpells` (`balance.ts:609` — water→sleep, earth→poison, fire→weaken, wind→confusion).
- `classRulesCard` (`flow/draftModel.ts`) is the Draft panel's SIBLING, not this card — the card is richer (counts + glyphs + full stats) and lives at Placement; don't fold them, but keep vocabulary identical (both go through `moveDisplayName`/`moveLabel`'s sources).
- `ui.ts` builders: `addFramedPanel` (the sheet body), `addUnitSprite` (interim portrait), `addElementBadge`, `addButton` (the ✕ if styled as a button).
- PlacementScene's interaction machinery is fully mapped in Task 2's audit table — read `PlacementScene.ts` lines ~50–140 and ~270–340 before touching anything; the tap classifier and `pendingCrownTimers` comments explain WHY each deferral exists.

### Lessons carried from 5.5 (fresh, same surfaces)

- FR30's 44px floor applies to any PRIMARY affordance (the tab strip paid a 10px layout tax for it — budget the ✕ early).
- Text budgets are measured, never eyeballed: a word Phaser can't wrap HANGS outside its container.
- Never destroy the object dispatching the current event — defer one tick.
- Singleton scenes: every new field reset in `create()`.
- Keep geometry in constants + pure tests (`draft-grid.test.ts` is the template).
- The scene-level gesture path itself is NOT unit-testable today (no Phaser harness — the recorded 5.2/5.5 tooling gap). Compensate: extract any long-press decision logic that CAN be pure (e.g. a `classifyHold(elapsedMs, movedPx)` helper) and lean on the audit table + device pass for the rest.

### Scope fences

NOT in this story: engine changes of any kind, ~~Draft-scene card (Draft has its detail panel)~~ *(fence SUPERSEDED 2026-07-29 at device round 5 — Danilo: "Could we also have that in the char selection?"; the overlay shipped at Draft too)*, the Placement density rework, derived def summaries, real portraits (5.9 — the art-story split: plumbing lands now on the interim sprite, Danilo owns picks + device pass, the manifest/frame tests move with the real art).

### Project Structure Notes

NEW: `apps/web/src/flow/unitCard.ts`, `apps/web/test/unit-card.test.ts`. MODIFIED: `apps/web/src/scenes/PlacementScene.ts` (gesture + overlay), `apps/web/src/config/constants.ts` (card geometry/glyph tokens), `apps/web/src/config/ui.ts` (only if a sheet builder is extracted), `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` + `EXPERIENCE.md` (dated amendments — full paths; do NOT create root-level files), this story, `sprint-status.yaml`. NOT modified: `packages/engine/**`, `units.png`, attribution (interim sprite is already attributed), `rules.md`.

### References

- [Source: docs/planning-artifacts/epics.md#Story-5.6] — the three AC blocks (with the §2→§5 prompt-pack correction noted in AC 2)
- [Source: docs/planning-artifacts/epic-5-dossier/DOSSIER.md — glyph rule + §Downstream carries; ROSTER.md §move catalog Damage column]
- [Source: docs/implementation-artifacts/deferred-work.md §story-4.11 — Danilo's card wish, scope-in and scope-out, verbatim]
- [Source: docs/implementation-artifacts/epic-4-retro-2026-07-22.md — the gesture-audit team agreement]
- [Source: docs/implementation-artifacts/5-5-roster-wave-monsters.md#Dev-Agent-Record — the review lessons carried above]
- [Source: docs/planning-artifacts/midjourney-asset-prompts-2026-07-23.md §5 — the portrait prompt recipe]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 — via the BMad `dev-story` workflow.

### Debug Log References

No probe scripts needed — the story's recon (grid gestures, seams, geometry) held as written.
One environment incident mid-story: `pnpm typecheck` suddenly failed on every asset import
(`Cannot find module '../assets/units.png'`) — a stale `apps/web/node_modules/vite` workspace
symlink left behind by the earlier `pnpm add -D -w knip`, not a code problem; a plain
`pnpm install` fixed resolution. Same root cause had made knip mis-flag `terser`/`vite`, so
those two knip.jsonc ignores are retired (knip's own hints called them redundant post-fix).

### Completion Notes List

**AC1 — the card, live from BALANCE.** NEW pure model `flow/unitCard.ts`: `unitCard(cls,
element)` derives everything from `BALANCE` + the existing seams (`rowActionCounts`,
`moveDisplayName`, `SPELL_DISPLAY_NAME`, `UNIT_FRAMES`, `SLOT_COST`) — a 28th class appears on
the card by existing. The damage-type glyph is a `Record<RowMove, CardGlyph>` (AD-4: a future
kind is a compile error), sourced from ROSTER's Damage column: **breath = PHYSICAL, bolt =
MAGIC** — both pinned, since the epic AC's glyph sentence predates them. The FR16 rows are
stated, not derived (ROSTER excludes them): Cleric "Heal / Staff" front+mid and plain "Heal"
back with a HEAL mark; the Witch names her ACTUAL element-keyed spell on every row (a water
witch's card literally reads "Sleep") with the MAGIC mark. 13-test suite exhaustive over
27 classes × 4 elements × 3 rows plus the discriminator pins.

**The gesture — LONG-PRESS, shipped per the recommendation (Danilo's go-ahead: he launched
dev-story after the recommendation was presented at story creation; the FEEL is still his
device-pass call).** ~450ms still hold (`LONG_PRESS_MS`) on any unit, tray or board. The
audited interaction table, implemented: armed on `pointerdown`; cancelled by `dragstart`
(movement past the shared 10px threshold), by release-before-maturity (that's a tap), and by
`pointerout`; on FIRE it sets `longPressFired`, and the pointerup handler consumes that
release FIRST — before the tap classifier — so opening the card never arms a crown toggle.
One timer at a time; reset in `create()` alongside `pendingCrownTimers` (the singleton
lesson). **The audit found a real hazard the story predicted abstractly:** the pointer that
opens the card is still DOWN on a draggable unit, and Phaser armed that drag at pointerdown —
before the scrim existed — so moving the finger after the card opens would drag a unit under
the modal. All four drag handlers (`dragstart`/`drag`/`drop`/`dragend`) now early-return
while the card is up.

**The overlay.** Framed bottom-sheet (`addFramedPanel`, the 5.2 chrome) over a 60%-black
full-screen interactive scrim at depth 300+ (toast is 200); a second invisible blocker over
the sheet body so a tap ON the card is a no-op instead of falling through to the scrim's
close. **Both close paths (scrim, ✕) act on pointerDOWN, not pointerup** — the opening
press's own release lands while the sheet is already up, and a pointerup close would eat it
as an instant dismiss. The ✕ keeps the FR30 44px floor as an invisible zone over an 18px
glyph. Close defers the destroy one tick (the 5.5 lesson). The sheet appears statically —
UX-DR6 satisfied by construction, nothing to damp.

**AC2 — the art float.** The portrait slot renders the class's own board sprite at an exact
2× integer scale (per-texture NEAREST stays crisp); 5.9 swaps the `portraitFrame` lookup for
real portraits (MJ prompt pack §5). No new assets, attribution untouched.

**AC3 — spine + gate.** DESIGN.md gains `{components.unit-data-card}` (sheet, content order,
the four glyph marks with their colours — none gold, none side-coloured) and EXPERIENCE.md
the press-and-hold read flow, both dated 2026-07-29. Geometry is the exported `UNIT_CARD`
constant with the vertical budget stated as arithmetic in its comment and pinned in tests
(worst row line "Radiant Breath ×1", worst name "DRAGON HUNTER"). **Engine untouched — the
diff under packages/engine is zero lines**; balanceVersion 11, logVersion 4. Gate: 702 tests
(+13), engine 99.06% lines, typecheck/lint/knip/coverage/build all green.

**Device pass ROUND 1 (2026-07-29) — three findings from Danilo, triaged:**
1. *"It's transparent, and not like a card"* — REAL DEFECT, fixed: the frame art's dark centre
   was never load-bearing (every other framed panel sits on the uniform stone ground; Battle's
   log even sets its own alpha) — over the busy board it read as a wash. An opaque
   `panel-body-night` plate now sits under the 9-slice frame.
2. *Spider chart instead of raw stat numbers ("if it's too difficult we can implement in the
   future")* — NOT difficult, built in the same round: pure `statAxisRatios`/`radarPoints` in
   unitCard.ts (per-axis scale = the roster's best, derived live from BALANCE — the web's edge
   means "best in the game at this"; Emberdrake's STR 34 rates exactly 1, pinned), drawn with
   Graphics path calls (the board.ts precedent — add.polygon mangles shapes), value shape in
   side-blue, raw numbers kept small on the vertex labels. +5 tests.
3. *"My true wish… visible on the main screen, not as an overlay"* (the Draft detail panel,
   icon-forward, discreet) — accepted-for-now by Danilo in the same message; logged VERBATIM to
   deferred-work.md as a PO wish (it is a Draft-panel redesign, not a 5.6 correction; the pure
   model + radar + glyphs built here are surface-agnostic and carry over). Also folded his
   "more icons than text" into THIS card: the move rows are icon-first now (glyph · F/M/B ·
   verb ×count).

**Device pass ROUND 2 (2026-07-29) — Danilo: "great, it's better", plus four refinements, all
applied:**
1. *Radar numbers removed* — axis labels are name-only. (His described scaling — "relative to
   the max strength possible" — is exactly what round 1 already shipped, so nothing changed
   underneath; the shape IS the read.)
2. *Chart moved RIGHT beside the move rows* — the two-column band let the sheet shrink 316 →
   232 high (moving toward his "smaller and more discreet" instinct ahead of the inline wish).
3. *"1 slot" → visual*: the subline now shows one board-cell square per slot (a monster shows
   two) instead of the words.
4. *Element word → the shared colored dot* (the same `ELEMENT_COLORS` dot every scene uses).
5. *OB64 row-icons*: each move row leads with a procedural mini-grid — three stacked bars,
   the firing row lit, front on top like the board — replacing the F/M/B letter.
Also fixed en route: the portrait now uses the RAW frame at a fixed 64 (round 1 went through
`addUnitSprite`, which looms monsters to 96px — it would have burst the shrunk header).

**Device pass ROUND 3 (2026-07-29) — two refinements ("The row indication and the move name is
much better"):**
1. *The size squares didn't read* — now a FIXED "1 out of 2" frame: the card always draws
   `MAX_SLOT_COST` squares (derived from SLOT_COST, pinned = 2) and FILLS this unit's cost —
   a small reads ■□, a monster ■■. The frame of reference is on screen, so the read is instant.
2. *"An extra X left of the spider chart"* — the damage-type glyph, orphaned in its own far
   column at 13px (Danilo's own follow-up: the icon was just too small). It now rides INLINE
   right after the verb at 15px — "Cut Throat ×2 ⚔" — attached marks read as annotation.

**Device pass ROUND 4 (2026-07-29) — "much better now", one refinement:** raise the chart so
the card gets shorter. Done by STAGGERING the columns instead of stacking bands: the radar now
anchors to the card top (`radarCYOffset` 102) and climbs into the header's empty right half —
sheet height 232 → 184 (the card has now shrunk 316 → 184 across the rounds, 42% less board
covered). Two new clearance pins came with it — the name budget vs the raised STR label
(nameW tightened 198 → 140; "DRAGON HUNTER" needs 130) and the radar's labels vs the ✕ tap
zone — and the second one EARNED ITS KEEP immediately: the first anchor attempt (100) failed
it by 2px; 102 shipped.

**Device pass ROUND 5 (2026-07-29) — round 4 ACCEPTED ("yep, it looks great"), then a
PO-directed surface extension: "Could we also have that in the char selection?"** Done — the
overlay was extracted to a shared builder (`config/unitCardOverlay.ts`; the AC named
Placement only, so this is recorded as a Danilo-directed round-5 addition, not scope drift)
and DraftScene wires the same long-press with the same audit discipline:
- GRID TILES show a CLASS-PREVIEW card — elements are rolled at draft, so a tile's card has
  no element dot and a Witch reads a generic "Cast" (the model's element went optional;
  pinned: every non-witch preview is row-identical to its unit card);
- ARMY TRAY units have elements → the full card;
- the consume rule extends to Draft's own taps: a matured hold must not SELECT, double-tap-
  DRAFT, or — the dangerous one — REMOVE the tray unit it was inspecting.
NOTE this is the overlay at Draft, NOT the deferred inline-panel wish — that stays logged in
deferred-work.md as its own design pass.

**Device pass ACCEPTED (2026-07-29, after round 5): "I am very happy with the result."** All
five rounds closed; the story moves to code review.

### File List

- `apps/web/src/flow/unitCard.ts` — NEW: the pure card model (CardGlyph, CardRow, UnitCardData, unitCard)
- `apps/web/test/unit-card.test.ts` — NEW: 25 tests at close (model exhaustive + geometry + review pins; the record briefly said 13 — a stale count the review caught)
- `apps/web/src/config/constants.ts` — UNIT_CARD geometry, LONG_PRESS_MS, CARD_GLYPHS + CARD_GLYPH_COLORS
- `apps/web/src/config/unitCardOverlay.ts` — NEW (round 5): the shared card-overlay builder both scenes render
- `apps/web/src/scenes/PlacementScene.ts` — the long-press gesture, lifecycle + drag guards (overlay body extracted round 5)
- `apps/web/src/scenes/DraftScene.ts` — round 5: the same gesture on grid tiles (class preview) and tray units (full card)
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` — dated `{components.unit-data-card}` amendment
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md` — dated press-and-hold flow amendment
- `knip.jsonc` — retired the two ignores the stale-symlink incident had motivated
- `docs/implementation-artifacts/deferred-work.md` — the inline-on-Draft PO wish (device round 1)
- `docs/implementation-artifacts/5-6-the-unit-data-card.md`, `docs/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-29: Story implemented end-to-end — pure unitCard model (glyphs from ROSTER's Damage
  column, FR16 rows stated, witch names her real spell), long-press gesture with the full
  audit implemented (incl. the armed-pre-scrim drag hazard), framed modal bottom-sheet with
  pointerdown-close discipline, UX spine amended (dated). Engine untouched; gate green
  (702 tests, engine 99.06% lines). Status -> review. REMAINING: Danilo's device pass.
- 2026-07-29: Device round 1 — transparency defect fixed (opaque plate under the frame), the
  stat SPIDER CHART built per Danilo's ask (pure radar math + Graphics, +5 tests), move rows
  made icon-first, DESIGN.md amendment updated, and the inline-on-Draft true wish logged to
  deferred-work.md as the next step. Gate re-green (707 tests). Awaiting the device re-pass.
- 2026-07-29: Device round 2 ("great, it's better") — radar numbers off, chart moved beside
  the rows (sheet 316 → 232), slot cost as board-cell squares, element as the shared dot,
  OB64-style row-position mini-grids, portrait de-loomed to a fixed 64. DESIGN.md amendment
  re-cut. Awaiting the round-2 re-pass.
- 2026-07-29: Device round 3 — size squares became a fixed ■□ "1 of 2" frame (MAX_SLOT_COST
  derived + pinned); the damage glyph moved inline after the verb at 15px (it had read as a
  stray X in its far column). Awaiting the round-3 re-pass.
- 2026-07-29: Device round 4 ("much better now") — the radar raised into the header's empty
  right half (staggered columns), sheet 232 → 184; two new clearance pins, one of which
  caught the first anchor value 2px short of the ✕ zone. Awaiting the round-4 re-pass.
- 2026-07-29: Device round 5 — round 4 accepted; Danilo asked for the card at CHAR SELECTION:
  overlay extracted to config/unitCardOverlay.ts (one implementation, two scenes), DraftScene
  wired (grid tiles = element-less class previews, tray = full cards, consume rule extended
  to select/add/remove). Model's element now optional, +1 test (710 total). Distinct from the
  deferred inline-panel wish, which stays deferred. Awaiting the round-5 re-pass.
- 2026-07-29: Device pass ACCEPTED ("I am very happy with the result") — all tasks closed;
  story stays in review awaiting the code-review pass.
- 2026-07-29: SENIOR CODE REVIEW DONE (Fable 5, 3 adversarial layers) — 29 raw findings → 18
  merged: 17 patches ALL APPLIED, 1 deferred (multi-touch audit — the whole gesture system is
  single-pointer by design since 1.8), 0 dismissed. The compound HIGH was real and all three
  layers found it independently: the long-press consume flag went STALE (the opening release
  lands on the scrim, never the unit) and was accidentally masking a pointerdown-close
  fall-through whose worst case — Draft's ✕ sits atop tray slot 5 — would REMOVE a unit on
  dismiss. Fixed as one mechanism: the overlay now closes on an ARMED down→up pair, both
  releases consumed by the live scrim; the flag is deleted from both scenes. Also fixed: the
  eaten-tap timer leak, rebuild-mid-hold orphaning armed timers (cancel in every redraw/
  buildGrid), Draft's missing movement cancel + tap-distance parity (TAP_DISTANCE_PX now a
  shared constant), radarCYOffset 102→106 with a realistic 8px label metric (the old pin
  passed at literally 0px), worst-content tests now DERIVED over the live roster, the
  no-blast assumption pinned, CardGlyph single-sourced in constants, PALETTE.boneFill +
  portraitW/nameGapX tokens replacing hand-duplicated numbers, ONES derived from STAT_AXES,
  the vestigial brace block, stale future tense, AC1's radar deviation note, DESIGN.md re-cut
  for round 5 + the armed-close contract, EXPERIENCE.md's per-scene tap semantics corrected,
  the scope fence superseded-note, and record count fixes. Gate: 712 tests, all green.
  Story → done.
