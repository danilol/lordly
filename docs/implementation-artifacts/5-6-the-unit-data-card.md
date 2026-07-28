# Story 5.6: The unit-data card

Status: ready-for-dev

## Story

As a player,
I want to open a unit's data card while assembling my squad,
so that I can see exactly what each class does per row before I commit — the OB64 UNIT DATA read.

## Acceptance Criteria

1. **The card opens at Placement and reads live from BALANCE.** Given a unit in the Placement tray or on the board, when the player uses the card gesture (decided in-story — tap is taken by the crown; the epic-4 retro **gesture-audit team agreement** applies), a modal/bottom-sheet opens showing: per-row moves WITH counts (the 4.11 `rowActionCounts`/`moveDisplayName` seams), a damage-type glyph per move row, the stat block (STR/VIT/INT/MEN/AGI/DEX), HP, and the unit's element — all read live from `BALANCE`, so the 5.4/5.5 waves' 27 classes appear automatically — no card change per class beyond the one existing FR16 Cleric/Witch read (Task 1).
2. **The card never blocks on art.** Given Danilo's Midjourney portrait batch (prompt pack **§5** — the epics text says "section 2", which is the unit-sprites section; portraits live in §5 "Portraits (later — for the unit-data card)"), when portraits are available the card shows the class portrait; without the batch the card ships with the interim board sprite in the portrait slot and gains real portraits in 5.9. *(Deliberate, dated deviation from the epic text 2026-07-29: epics.md says "ships portrait-less" — the interim-sprite slot is chosen instead under the art-story split so the LAYOUT ships tested and the 5.9 swap is one lookup, not a re-lay; Danilo can veto to portrait-less at the device pass.)*
3. **The spine is amended and the gate holds.** Given the UX spine, when the card ships, DESIGN.md/EXPERIENCE.md gain the card's layout and gesture as a dated amendment (the 5.2 amendment precedent), Danilo's device pass accepts it, and there is **no engine change, no version bump** (`balanceVersion` 11 and `logVersion` 4 both untouched).

## Tasks / Subtasks

- [ ] Task 1: The pure card model — `apps/web/src/flow/unitCard.ts` (AC: 1)
  - [ ] `unitCard(cls, element)` returns the full card data: display name (`CLASS_DISPLAY_NAME`), portrait key (interim: the class's own `UNIT_FRAMES` sprite), the stat block + HP from `BALANCE.classes[cls]`, the slot cost via `SLOT_COST[BALANCE.classes[cls].sizeClass]` (the cost table is its OWN export — `balance.ts:638`, on the barrel; never hardcode 1/2), the element, and one row entry per `ALL_ROWS`.
  - [ ] Each row entry: the move label via `moveDisplayName(kind, element, cls)` (class verbs — "Skewer", "Ember Breath" — for free), the count via `rowActionCounts(cls)` (flow/placement.ts:152), and the damage-type GLYPH.
  - [ ] The glyph derivation is EXHAUSTIVE over `RowMove` with no default (the 5.4 dispatch discipline — a future kind is a compile error here, never a silently wrong glyph): `slash`/`arrow`/`bash`/`staff`/`breath` → physical; `bolt`/`blast` → magic; `guard-full`/`guard-half` → a shield mark, no damage type. **The source is ROSTER.md's move-catalog Damage column — NOT the epic AC's "blast/spell = magic; slash/arrow/bash/staff = physical", which predates 5.4's `bolt` (magic) and 5.5's `breath` (PHYSICAL, E5-D7).** Pin the two newcomers explicitly.
  - [ ] The Cleric/Witch read (ROSTER's own table shape — dossier carry: "the table's shape IS the card's content", per-row per ROSTER.md:46-47): the Cleric reads "Heal / Staff" on front and mid and "Heal ×2" on back (no staff fallback shown there — the table's shape); the Witch reads her ACTUAL element-keyed spell by name on every row — `SPELL_DISPLAY_NAME[BALANCE.elementSpells[element]]` ("Sleep" for a water witch), which is why the card takes the UNIT's element, not just the class.
  - [ ] **Glyphs for the two FR16 rows — ROSTER's Damage column deliberately EXCLUDES them ("NOT move-table rows", ROSTER.md:28), so the RowMove derivation cannot supply these; state them here:** the Witch's Cast = MAGIC (the dossier rule's "spell = magic", DOSSIER.md:134 — and OB64's own staff-icon-over-Acid-Vapor evidence); the Cleric's Heal = a HEAL mark of its own, no damage type (restorative, the HEAL_TRACE_COLOR philosophy: a heal carries no aggression read). Pin both in the test list.
  - [ ] Tests exhaustive over `ALL_CLASSES` × `ALL_ROWS` (27 × 3 — every label/count/glyph resolves, no gaps), plus pins: breath-is-physical, bolt-is-magic, guard rows carry no damage type, the witch's card names the right spell for each of the four elements, monster slot cost 2 / Whelp 1.
- [ ] Task 2: The gesture — decide, audit, implement (AC: 1)
  - [ ] **Recommendation to confirm with Danilo at dev start (the 5.5 tabs precedent): LONG-PRESS (~450ms hold, still pointer) on any unit card — tray or board.** Every tap variant is taken (tray double-tap = auto-place; placed single-tap = deferred crown-toggle; placed double-tap = remove; movement ≥ 10px = drag), and a per-card ⓘ can't work: the cards are 64×64 (`PlacementScene.ts:267`) with the FULL 64px face as the drag/tap hit area, so a 44px-floor ⓘ inside it would swallow most of the drag surface. Long-press is also the genre's "hold to inspect".
  - [ ] **The gesture audit (epic-4 retro team agreement — MANDATORY before review).** The full PlacementScene interaction table the new gesture must not perturb: `dragDistanceThreshold = TAP_DISTANCE_PX` (10px) starts a drag; a still pointerup is a tap; tray double-tap within `DOUBLE_TAP_MS` (300) auto-places; a placed unit's single tap arms a `pendingCrownTimers` entry DEFERRED past the double-tap window; placed double-tap removes AND cancels that timer; `dragstart` clears tap state; row badges clear on `drop` AND `dragend` (the destroy-vs-dragend trap, 4.11). The long-press timer: starts on `pointerdown`, cancels on `dragstart`/movement > `TAP_DISTANCE_PX`/`pointerup`; when it FIRES, it must consume the gesture so the eventual pointerup neither taps nor arms the crown timer.
  - [ ] Reset all new gesture state in `create()` (singleton scenes) — including any pending long-press timer (the `pendingCrownTimers` cleanup precedent at line ~106).
- [ ] Task 3: The card overlay UI (AC: 1, 2)
  - [ ] A bottom-sheet/modal over Placement: `addFramedPanel` for the body, a full-screen input-BLOCKING scrim behind it (an interactive rectangle that swallows board taps — nothing underneath may receive input while the card is up), depth above the toast's 200.
  - [ ] Content: portrait slot (interim `addUnitSprite` at a large INTEGER multiple — per-texture NEAREST is already on the sheet, integer scales keep it crisp), name + element badge (`addElementBadge`), the three move rows (label · ×count · glyph), the stat block + HP + slot cost.
  - [ ] Close affordances: tap-the-scrim AND an explicit ✕ at ≥44px (FR30). Closing DEFERS the overlay destroy one tick (`this.time.delayedCall(0, …)`) — the 5.5 review lesson: never destroy the dispatching object mid-event.
  - [ ] Respect reduced motion (UX-DR6): if the sheet animates in, damp or skip under the existing reduced-motion flag; a static appear is acceptable.
- [ ] Task 4: Geometry as arithmetic, not device passes (AC: 1)
  - [ ] Card geometry constants in `constants.ts` (the DRAFT_GRID/DRAFT_TABS pattern) + a pure geometry test: the card fits 360×640 with the WORST content — "Dragon Hunter" (the roster's only two-word name), three move rows with verbs like "Radiant Breath ×1", six stats + HP + element; text budgets MEASURED (~6.2px/char at 8px, ~4.8 at 10px — the 5.4/5.5 method), the ✕ floor pinned.
- [ ] Task 5: The UX spine amendment (AC: 3)
  - [ ] `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md`: the card's component tokens (sheet ground, row layout, glyph treatment — gold stays the metal, never a side colour) as a DATED amendment; `…/EXPERIENCE.md`: the gesture + open/close flow, dated (the 5.2 precedent: amendments carry their date and reason).
- [ ] Task 6: Docs + gate (AC: 3)
  - [ ] No engine file changes; `balanceVersion` stays 11, `logVersion` stays 4 (assert nothing in the diff touches packages/engine).
  - [ ] No rules.md change required (the card surfaces data rules.md already documents) — but VERIFY no drift guard trips.
  - [ ] Full gate: typecheck, lint, knip, coverage (engine ≥90%), web build.
  - [ ] Device pass with Danilo: the long-press feel (does 450ms read as deliberate or laggy?), the card read on a dragon and on a witch, and that drag/crown/double-tap all still feel untouched.

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

NOT in this story: engine changes of any kind, Draft-scene card (Draft has its detail panel), the Placement density rework, derived def summaries, real portraits (5.9 — the art-story split: plumbing lands now on the interim sprite, Danilo owns picks + device pass, the manifest/frame tests move with the real art).

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

### Debug Log References

### Completion Notes List

### File List
