---
baseline_commit: 71f64b772fc239a2db160d4a2f2dacc2b2679b30
---

# Story 5.4: Roster wave — humans

Status: ready-for-dev

## Story

As a player,
I want the dossier's new human classes draftable, placeable, and fighting correctly,
so that my squads draw from the roster the game was always meant to have.

## Acceptance Criteria

1. **The classes exist as data, exhaustively.** Given the 5.1 dossier, when the wave lands, every new human class exists as balance data (stats, role relations, per-row moves per the dossier — **including the dossier's revision of the shipped 12**), every `Record<UnitClass, …>` table is exhaustively extended (**run typecheck early — the 4.8 lesson**), the name tables grow so `rollName`'s exhaustion fallback stays unreachable (the 4.2 forward-note), and newcomers ship on interim sprites until 5.9.
2. **The UI holds 17 classes.** Given the Draft picker and comp-rendering scenes, when the roster grows, the icon grid scales to the full class count, the matchup-chip layout gains the bounds check the 4.3 review deferred, and every army-row scene is checked against `BASE_WIDTH = 360` (the standing coupling-site rule).
3. **Balance discipline holds.** Given AD-8 discipline and NFR4, when the wave ships, `balanceVersion` ticks with hash re-pin, goldens are re-recorded **ONLY** where the dossier's move-table revision changes existing battles (audited event-by-event), the AI pool gains newcomer representation (single-unit substitutions first — the 4.3 method), and the both-mode sweep converges ≤65%.

## Tasks / Subtasks

- [ ] Task 1: Widen the unions and get typecheck GREEN before any behaviour work (AC: 1)
  - [ ] Add the five classes to `ALL_CLASSES` (`packages/engine/src/types.ts:24`) — `UnitClass` derives from it (`:40`). **Key naming:** existing keys are single lowercase words (`knight`, `mercenary`, `sorceress`). Use `fencer`, `hawkman`, `vultan`, `raven`, and for the Dragon Hunter pick a single-word key — recommend **`dragoonhunter` → NO**; prefer `dragonhunter` (no separator, matching the flat style) with display name "Dragon Hunter". Record the choice in the Dev Agent Record.
  - [ ] Add the three roles to `ALL_ROLES` (`types.ts:51` derives `Role`): `dragon`, `beast`, `dragonslayer`.
  - [ ] Add `bolt` to `MoveKind` (`types.ts:191`); `RowMove` (`:200`) picks it up for free.
  - [ ] **Run `pnpm typecheck` NOW** and fix every resulting error before writing behaviour. Known compile sites — engine: `BALANCE.classes` (`balance.ts:69`), `CLASS_SEX` (`names.ts:24`). Shell: `UNIT_FRAMES` (`apps/web/src/config/sprites.ts:15`), `CLASS_ABBREVIATIONS` (`constants.ts:278`), `CLASS_DISPLAY_NAME` (`constants.ts:300`), `CLASS_TEXT` (`flow/draftModel.ts:35`), and `TRACE_TRAVEL: Record<TraceKind,…>` (`scenes/BattleScene.ts:120`) for `bolt`. `attribution.ts:22` is `Partial<…>` so it will NOT error — extend it deliberately anyway.
  - [ ] Codes (`CLASS_ABBREVIATIONS`), taken today: KNI MER ARC WIZ CLE WIT BER PHA NIN VAL SOR GOL. The dossier assigns **FEN DRH HAW VUL RAV**.
- [ ] Task 2: Balance data — the newcomers AND the dossier's revision of the shipped 12 (AC: 1, 3)
  - [ ] New class rows in `balance.ts` per `ROSTER.md`'s approved engine-scale table (HP/STR/VIT/INT/MEN/AGI/DEX, role, sizeClass `small`, actions f/m/b, moves f/m/b). Values are approved (E5-D15) — do not re-invent them; copy the table.
  - [ ] Add the `roleRelations` entry: `dragonslayer → dragon`, one-way ×1.5 (the `sniper → support` shape at `balance.ts:336`). **Flag and verify:** no class has the `dragon` role until story 5.5, so this relation is inert this story. Confirm nothing (a test, a UI derivation like Draft's matchup chips) breaks on a relation whose defender role is unrepresented.
  - [ ] **The shipped-12 revision** (`ROSTER.md` §fine-tune, all approved): mage + sorceress mid/back `blast` → `bolt`; phalanx guard rows 2 actions → **1** (front/mid); valkyrie back row → `bolt` **and INT 12 → 18**; display-only renames (Cleave/Rend/Smash/Pierce/Cut Throat) are SHELL work, not balance data.
  - [ ] `balanceVersion` 9 → 10 and re-pin the hash: `balance.ts:59` holds the version; `packages/engine/test/balance-hash.test.ts` pins hash-per-version and the test message spells out the two-step ("bump `version` AND pin the new hash").
- [ ] Task 3: `bolt` — a ranged single-target MAGIC attack with ZERO draws (AC: 1, 3)
  - [ ] Recon already done, use it: `act()` (`resolve.ts` ~line 270+) dispatches on `unit.class` in case-groups — melee classes share one block using `selectMeleeTarget` + `physical` + `rollHit(...)`; `archer` uses `selectRangedTarget` + `physical` + `rollHit`; `mage`/`sorceress` are the Artillery block. `strike()` (`resolve.ts:549`) takes the damage function and an OPTIONAL roll — **passing no roll is exactly what makes an attack take zero ADR-0003 draws** and never crit/dodge/Guard (`resolve.ts:539-540` states this contract).
  - [ ] So `bolt` = `selectRangedTarget` + `magicDamage` (`resolve.ts:680`) + `strike(..., undefined /* no roll */)`. Do NOT call `rollHit` on it. Confirm against ADR 0003 that adding a zero-draw move leaves the frozen draw table untouched, and add a test asserting a bolt-only battle consumes the SAME number of battle-stream draws as a blast-only battle.
  - [ ] Route the newcomers into the right blocks: Fencer / Hawkman / Dragon Hunter are melee-only (join the melee case-group). **Vultan and Raven have a back-row `arrow`** — physical Skills riding the existing `arrow` kind (dossier **E5-D14**), so they need the archer-style ranged branch for the back row and melee otherwise; the cleanest shape is a row-move-driven branch rather than a new per-class case — decide, and write down why.
  - [ ] Valkyrie now needs the same mixed treatment (melee front/mid, `bolt` back).
- [ ] Task 4: Names (AC: 1)
  - [ ] `CLASS_SEX` (`names.ts:24`) gains the five: Fencer M, Hawkman M, Vultan M, Raven M, Dragon Hunter **F** (per the dossier). Tables are `MALE_NAMES` (`:42`), `FEMALE_NAMES` (`:94`), `CONSTRUCT_NAMES` (`:146`), indexed via `NAME_TABLES` (`:162`) by `rollName` (`:175`).
  - [ ] Grow the lists so the exhaustion fallback stays unreachable: 4 more male classes means more male draws per army. Compute the worst case (a 5-slot army of one sex) against list length and state the margin in the Dev Agent Record.
- [ ] Task 5: THE DRAFT GRID — it does not fit, and this is the story's real UI work (AC: 2)
  - [ ] **Measured collision (recon 2026-07-28):** `GRID = { cols: 4, tileW: 80, tileH: 62, gapX: 8, gapY: 6, startX: 8, startY: 88 }` (`DraftScene.ts:23`) and `DETAIL = { x: 8, y: 300, … }` (`:25`). 12 classes = 3 rows ending y=286 (fits under DETAIL at 300 with 14px to spare). **17 classes = 5 rows ending y=422 — a 122px collision with the detail panel.** Right edge is fine (352 ≤ 360).
  - [ ] Re-lay the grid. Options to weigh (pick one, record why): **5 columns** at ~66px tiles (5×66+4×8 = 362 — 2px over, so ~65px tiles) giving 4 rows ≈ 360px tall — still collides; **smaller tiles + 5 cols** (e.g. 65×50, 4 rows = 224px, ends y=312 — still collides by 12); **shrink tiles AND lift/shrink DETAIL**; or **scroll the grid** (the `enableDragScroll` helper already exists in `config/ui.ts` and is used by Help/Credits/History). Note the 4.3 history: a scrollable picker was DESIGNED and then rejected on device in favour of the icon grid ("it looks great! we can proceed!") — so scrolling reverses a device decision and needs Danilo's nod.
  - [ ] Do the arithmetic explicitly in the Dev Agent Record for whatever you choose, and keep every tile ≥44px tall (FR30 tap floor).
  - [ ] Close the 4.3 deferral: the matchup-chip `chip()` helper (`DraftScene.ts` ~175) has **no bounds check** — chips can run off the panel's right edge. Add it (the deferral is recorded in deferred-work.md from the 4.3 review).
- [ ] Task 6: The rest of the shell (AC: 1, 2)
  - [ ] Display names + codes + `CLASS_TEXT` role/behaviour prose for the five (`ROSTER.md` has approved one-line descriptions — use them, don't invent new ones).
  - [ ] The dossier's display-only move renames (E5-D10): Berserker "Cleave", Ninja "Rend", Golem "Smash", Phalanx back "Pierce", Mercenary "Cut Throat", Valkyrie melee "Pierce", plus the newcomers' verbs (Lunge / Skewer / Talon Strike / Wind Shot / Thunder Arrow). These need a per-(class, kind) display map — today `MOVE_PLATE_NAMES` is keyed by `MoveKind` ALONE (`constants.ts`), so it cannot express "Berserker's slash is called Cleave". Extend the seam; keep it union-keyed so a new kind is a compile error.
  - [ ] `bolt` needs: a `MOVE_PLATE_NAMES`-side entry ("Magic Bolt" / "Lightning" for Valkyrie), a `TRACE_TRAVEL` entry (`projectile`), and a damage-type classification for the 5.6 card glyph rule (blast/bolt/spell = magic).
  - [ ] Sprites: newcomers ride **INTERIM shared frames** until 5.9 — follow the 4.3 convention exactly, including the attribution note format (`attribution.ts` `classSources`, e.g. `'dc-mon/…png (INTERIM: shares the Knight tile)'`). Do NOT touch `units.png`.
  - [ ] Coupling-site sweep (the standing rule): re-check Placement tray, Result comps, History rows, Reveal and Battle against 360. **Growing the CLASS count does not change army size (still 5 slots)** — so most army rows are unaffected; say so explicitly after checking rather than assuming.
- [ ] Task 7: AI pool, goldens, sweep (AC: 3)
  - [ ] `STRATEGY_POOL` (`ai.ts:65`, "8–12 archetypes"): add newcomer representation by **single-unit substitution first** (the 4.3 method — swap one unit into an existing archetype rather than authoring exotic new comps).
  - [ ] The **class-coverage guard** from 4.12 asserts every class appears in the pool — find it (`packages/engine/test/` — check `sim.test.ts`/`ai.test.ts`) and confirm it now covers 17, so a forgotten newcomer fails the build.
  - [ ] Goldens (`packages/engine/test/golden.test.ts`): re-record **only** the battles the revision actually changes, and AUDIT event-by-event. Per `ROSTER.md`'s re-record column the changed inputs are mage, sorceress, phalanx and valkyrie — so any golden containing them changes; a golden with none of them **must be byte-identical** (assert that as the regression pin, the 4.4 method).
  - [ ] Sweep: `pnpm --filter @lordly/engine sim` and the CI band test (`sim.test.ts`) must converge **≤65% in BOTH modes**. Casters losing splash is a real nerf to the three-mages family — expect a re-tune and budget for it. Remember the 5.1 lesson: `runs=200` can disagree with `runs=500` near the band edge — run the heavy confirmation before certifying.
  - [ ] Property-test arbitraries (`packages/engine/test/arbitraries.ts:17-29`) derive small/monster class lists from `ALL_CLASSES`, so they pick up newcomers automatically — but the 4.8 lesson says a widened arbitrary can starve other properties' rare branches. Watch for flaky/starved property tests and reweight rather than lowering `numRuns`.
- [ ] Task 8: Docs + gate (AC: 1, 2, 3)
  - [ ] `docs/rules.md` gains the newcomers where the roster is described (the `rules-doc.test.ts` drift guard pins slot cost/role to BALANCE — check what it asserts and keep it green).
  - [ ] Full gate: `pnpm typecheck && pnpm lint && pnpm coverage` (engine ≥90% lines), `pnpm --filter web build` (runs the 5.2 frame-art guard too).
  - [ ] NO `logVersion` change — confirm and state it (dossier §4: new classes are new `UnitClass` values in setup/balance data, new `MoveKind` values ride the hash; the 4.7/4.8 precedents).
  - [ ] Device pass with Danilo (the new Draft grid is the thing to look at).

## Dev Notes

### The dossier IS the spec — do not re-decide

`docs/planning-artifacts/epic-5-dossier/ROSTER.md` (normative table) and `DOSSIER.md` (15 dated decisions, E5-D1…D15, signed off 2026-07-27) already settle: which classes, their stats at engine scale, roles, codes, sex, per-row moves and counts, the display verbs, and the two engine rulings. **Copy the table; don't re-derive it.** Anything the dossier didn't decide is a genuine question — write it in the Dev Agent Record and ask, rather than inventing.

Decisions with teeth for this story:
- **E5-D4** — Wizard and Sorceress LOSE splash: single-target `bolt`. Row-AoE magic is reserved for a future Archmage. This is the era's biggest gameplay change and the main sweep risk.
- **E5-D14** — Wind Shot / Thunder Arrow are physical *Skills*: they ride the existing `arrow` kind, NOT `bolt`. Only Wizard, Sorceress and Valkyrie use `bolt`.
- **E5-P2** — Phalanx keeps the front+mid Guard wall but guard rows carry **1** action (a second same-turn raise re-arms nothing; actions 2/1/1 → 1/1/1). Re-records goldens.
- **E5-D12** — the two 4.7 rulings: **back-row Guard is FORBIDDEN as a data rule** (so no table row may set it; a cheap balance-data invariant test is worth adding), and overlapping guards KEEP shipped behaviour (no code change).
- **E5-D11** — browser history is expendable; **golden tests are not**. Re-record them properly.
- **E5-P1** — the Dragonslayer→Dragon relation ships now but is inert until 5.5.

### The engine surfaces, recon-verified 2026-07-28

- `packages/engine/src/types.ts:24` `ALL_CLASSES` → `:40` `UnitClass`; `:51` `ALL_ROLES`/`Role`; `:191` `MoveKind`; `:200` `RowMove`.
- `balance.ts:69` `classes: Record<UnitClass, ClassStats>`; `:54` `RoleRelation`; `:78`/`:336` `roleRelations`; `:400`/`:414` the matchup readers; `:59` `version`.
- `resolve.ts`: `act()` case-groups from ~`:270` (melee block `:271-284`, `archer` `:285-293`, Artillery `:299+`); `strike()` `:549` (optional roll = zero draws); `rollHit()` `:516`; `magicDamage()` `:680`; the magic-never-crits contract stated at `:539-540`; `attackMoveOf` `:451-455` (the forbidden back-row-Guard path — E5-D12a keeps it unreachable).
- `targeting.ts`: `selectMeleeTarget` `:183`, `selectRangedTarget` `:193`, `selectBlastRow` `:210`, `legalTargets` `:80`, `applyTactic` `:114`.
- `names.ts`: `NameSex` `:16`, `CLASS_SEX` `:24`, lists `:42`/`:94`/`:146`, `NAME_TABLES` `:162`, `rollName` `:175`.
- `ai.ts:65` `STRATEGY_POOL`; `:42` the `archetypeId` contract (threaded for FR25 no-repeat).
- Tests: `balance-hash.test.ts` (version↔hash), `balance.test.ts:14` (asserts `Object.keys(BALANCE.classes)` equals `ALL_CLASSES`), `golden.test.ts`, `sim.test.ts` (band + determinism, explicit timeouts), `arbitraries.ts:17-29`, `ai.test.ts`, `rules-doc.test.ts`.

### The shell surfaces

`sprites.ts:15` `UNIT_FRAMES`; `constants.ts:278` `CLASS_ABBREVIATIONS`, `:300` `CLASS_DISPLAY_NAME`, plus `MOVE_PLATE_NAMES`/`BLAST_ELEMENT_WORD`/`moveDisplayName`; `flow/draftModel.ts:35` `CLASS_TEXT` (+ `classRulesCard`, `moveLabel`, `movesVaryByRow`); `scenes/BattleScene.ts:120` `TRACE_TRAVEL: Record<TraceKind,…>`; `assets/attribution.ts:22` `classSources`.

### Previous story intelligence

- **5.3 (review):** per-scene board frames now exist (`ISO_BOARD` for Battle, `ISO_BOARD_REVEAL` for Reveal) and the projection takes a layout — if you touch board geometry, both frames have guard tests. Terrain art means **low-alpha washes over art are a known trap**. The `?perf=1` capture is deferred to 5.10, so don't assume perf coverage exists for anything you add.
- **5.2's review (15 patches)** produced four standing rules worth re-reading in that story's Review Findings section: measure art mechanically rather than by eye; every config token must actually be rendered; a test that asserts something nothing draws is worse than no test; and the story record is part of the deliverable (an AC miscount, unticked parent tasks and File List omissions were all findings).
- **4.8's lesson, restated in AC 1:** widening a union is a compile-error cascade — run typecheck FIRST, before behaviour work, so you fix mechanical breakage in one pass.

### Testing standards

Engine tests are the substance here: `pnpm coverage` enforces ≥90% engine lines. Add unit tests for the `bolt` branch (targeting, magic damage, zero draws), a draw-count-invariance test vs blast, the back-row-Guard data invariant, name-table margin, and the golden byte-identical pin for revision-free battles. Web tests are pure seams only (no Phaser mock harness exists — that's deferred work); the new Draft grid's arithmetic should be extracted into a pure helper so it CAN be tested rather than eyeballed.

### Project Structure Notes

- MODIFIED (engine): `types.ts`, `balance.ts`, `resolve.ts`, `names.ts`, `ai.ts`, and their tests + `arbitraries.ts` + `golden.test.ts` fixtures.
- MODIFIED (shell): `config/constants.ts`, `config/sprites.ts`, `flow/draftModel.ts`, `scenes/DraftScene.ts`, `scenes/BattleScene.ts`, `assets/attribution.ts`.
- MODIFIED (docs): `docs/rules.md`, this story, `sprint-status.yaml`.
- NOT modified: `units.png` / the sprite sheet (5.9), monsters (5.5), the unit-data card (5.6), `logVersion`, the UX spines (unless the Draft re-lay warrants a dated amendment — judge and say).

### References

- [Source: docs/planning-artifacts/epics.md#Story-5.4 (lines 1045–1063)] — the three AC blocks verbatim
- [Source: docs/planning-artifacts/epic-5-dossier/ROSTER.md] — THE normative class/move/stat table (approved E5-D15)
- [Source: docs/planning-artifacts/epic-5-dossier/DOSSIER.md] — decisions E5-D1…D15 incl. D4 (no splash), D14 (skills are physical), P2 (guard fine-tune), D12 (the two engine rulings), D11 (goldens matter, browser history doesn't)
- [Source: docs/adr/0003-battle-stream-draw-order.md] — the frozen draw table `bolt` must not disturb
- [Source: docs/implementation-artifacts/5-2-the-medieval-look.md#Review-Findings] — the four standing rules from that review
- [Source: docs/implementation-artifacts/deferred-work.md] — the 4.3 chip bounds-check deferral this story closes; the 5.3 perf deferral (so don't assume perf coverage)
- [Source: recon 2026-07-28 — DraftScene.ts:23/25 grid+detail geometry (122px collision at 17 classes), resolve.ts act()/strike()/rollHit/magicDamage, names.ts tables, ai.ts pool, balance-hash test]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
