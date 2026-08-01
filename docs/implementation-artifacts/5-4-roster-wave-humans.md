---
baseline_commit: 71f64b772fc239a2db160d4a2f2dacc2b2679b30
---

# Story 5.4: Roster wave — humans

Status: done

## Story

As a player,
I want the dossier's new human classes draftable, placeable, and fighting correctly,
so that my squads draw from the roster the game was always meant to have.

## Acceptance Criteria

1. **The classes exist as data, exhaustively.** Given the 5.1 dossier, when the wave lands, every new human class exists as balance data (stats, role relations, per-row moves per the dossier — **including the dossier's revision of the shipped 12**), every `Record<UnitClass, …>` table is exhaustively extended (**run typecheck early — the 4.8 lesson**), the name tables grow so `rollName`'s exhaustion fallback stays unreachable (the 4.2 forward-note), and newcomers ship on interim sprites until 5.9.
2. **The UI holds 17 classes.** Given the Draft picker and comp-rendering scenes, when the roster grows, the icon grid scales to the full class count, the matchup-chip layout gains the bounds check the 4.3 review deferred, and every army-row scene is checked against `BASE_WIDTH = 360` (the standing coupling-site rule).
3. **Balance discipline holds.** Given AD-8 discipline and NFR4, when the wave ships, `balanceVersion` ticks with hash re-pin, goldens are re-recorded **ONLY** where the dossier's move-table revision changes existing battles (audited event-by-event), the AI pool gains newcomer representation (single-unit substitutions first — the 4.3 method), and the both-mode sweep converges ≤65%.

## Tasks / Subtasks

- [x] Task 1: Widen the unions and get typecheck GREEN before any behaviour work (AC: 1)
  - [x] Add the five classes to `ALL_CLASSES` (`packages/engine/src/types.ts:24`) — `UnitClass` derives from it (`:40`). **Key naming:** existing keys are single lowercase words (`knight`, `mercenary`, `sorceress`). Use `fencer`, `hawkman`, `vultan`, `raven`, and for the Dragon Hunter pick a single-word key — recommend **`dragoonhunter` → NO**; prefer `dragonhunter` (no separator, matching the flat style) with display name "Dragon Hunter". Record the choice in the Dev Agent Record.
  - [x] Add the three roles to `ALL_ROLES` (`types.ts:51` derives `Role`): `dragon`, `beast`, `dragonslayer`.
  - [x] Add `bolt` to `MoveKind` (`types.ts:191`); `RowMove` (`:200`) picks it up for free.
  - [x] **Run `pnpm typecheck` NOW** and fix every resulting error before writing behaviour. Known compile sites — engine: `BALANCE.classes` (`balance.ts:69`), `CLASS_SEX` (`names.ts:24`). Shell: `UNIT_FRAMES` (`apps/web/src/config/sprites.ts:15`), `CLASS_ABBREVIATIONS` (`constants.ts:278`), `CLASS_DISPLAY_NAME` (`constants.ts:300`), `CLASS_TEXT` (`flow/draftModel.ts:35`), and `TRACE_TRAVEL: Record<TraceKind,…>` (`scenes/BattleScene.ts:120`) for `bolt`. `attribution.ts:22` is `Partial<…>` so it will NOT error — extend it deliberately anyway.
  - [x] Codes (`CLASS_ABBREVIATIONS`), taken today: KNI MER ARC WIZ CLE WIT BER PHA NIN VAL SOR GOL. The dossier assigns **FEN DRH HAW VUL RAV**.
- [x] Task 2: Balance data — the newcomers AND the dossier's revision of the shipped 12 (AC: 1, 3)
  - [x] New class rows in `balance.ts` per `ROSTER.md`'s approved engine-scale table (HP/STR/VIT/INT/MEN/AGI/DEX, role, sizeClass `small`, actions f/m/b, moves f/m/b). Values are approved (E5-D15) — do not re-invent them; copy the table.
  - [x] Add the `roleRelations` entry: `dragonslayer → dragon`, one-way ×1.5 (the `sniper → support` shape at `balance.ts:336`). **Flag and verify:** no class has the `dragon` role until story 5.5, so this relation is inert this story. Confirm nothing (a test, a UI derivation like Draft's matchup chips) breaks on a relation whose defender role is unrepresented.
  - [x] **The shipped-12 revision** (`ROSTER.md` §fine-tune, all approved): mage + sorceress mid/back `blast` → `bolt`; phalanx guard rows 2 actions → **1** (front/mid); valkyrie back row → `bolt` **and INT 12 → 18**; display-only renames (Cleave/Rend/Smash/Pierce/Cut Throat) are SHELL work, not balance data.
  - [x] `balanceVersion` 9 → 10 and re-pin the hash: `balance.ts:59` holds the version; `packages/engine/test/balance-hash.test.ts` pins hash-per-version and the test message spells out the two-step ("bump `version` AND pin the new hash").
- [x] Task 3: `bolt` — a ranged single-target MAGIC attack with ZERO draws (AC: 1, 3)
  - [x] Recon already done, use it: `act()` (`resolve.ts` ~line 270+) dispatches on `unit.class` in case-groups — melee classes share one block using `selectMeleeTarget` + `physical` + `rollHit(...)`; `archer` uses `selectRangedTarget` + `physical` + `rollHit`; `mage`/`sorceress` are the Artillery block. `strike()` (`resolve.ts:549`) takes the damage function and an OPTIONAL roll — **passing no roll is exactly what makes an attack take zero ADR-0003 draws** and never crit/dodge/Guard (`resolve.ts:539-540` states this contract).
  - [x] So `bolt` = `selectRangedTarget` + `magicDamage` (`resolve.ts:680`) + `strike(..., undefined /* no roll */)`. Do NOT call `rollHit` on it. Confirm against ADR 0003 that adding a zero-draw move leaves the frozen draw table untouched, and add a test asserting a bolt-only battle consumes the SAME number of battle-stream draws as a blast-only battle. *(Substitution recorded at the 2026-08-01 review: this prescription became
        unconstructible — the story's own E5-D4 left NO class carrying a `blast` row, so there is no
        blast-only battle to compare against. What shipped instead is a stronger discriminator: an
        all-bolt seed-pair identity test proving a bolt battle consumes ZERO battle-stream draws
        beyond the engagement tie flip. The Completion Notes always described the real test; only
        this ticked line still promised the original.)*
  - [x] Route the newcomers into the right blocks: Fencer / Hawkman / Dragon Hunter are melee-only (join the melee case-group). **Vultan and Raven have a back-row `arrow`** — physical Skills riding the existing `arrow` kind (dossier **E5-D14**), so they need the archer-style ranged branch for the back row and melee otherwise; the cleanest shape is a row-move-driven branch rather than a new per-class case — decide, and write down why.
  - [x] Valkyrie now needs the same mixed treatment (melee front/mid, `bolt` back).
- [x] Task 4: Names (AC: 1)
  - [x] `CLASS_SEX` (`names.ts:24`) gains the five: Fencer M, Hawkman M, Vultan M, Raven M, Dragon Hunter **F** (per the dossier). Tables are `MALE_NAMES` (`:42`), `FEMALE_NAMES` (`:94`), `CONSTRUCT_NAMES` (`:146`), indexed via `NAME_TABLES` (`:162`) by `rollName` (`:175`).
  - [x] Grow the lists so the exhaustion fallback stays unreachable: 4 more male classes means more male draws per army. Compute the worst case (a 5-slot army of one sex) against list length and state the margin in the Dev Agent Record.
- [x] Task 5: THE DRAFT GRID — it does not fit, and this is the story's real UI work (AC: 2)
  - [x] **Measured collision (recon 2026-07-28):** `GRID = { cols: 4, tileW: 80, tileH: 62, gapX: 8, gapY: 6, startX: 8, startY: 88 }` (`DraftScene.ts:23`) and `DETAIL = { x: 8, y: 300, … }` (`:25`). 12 classes = 3 rows ending y=286 (fits under DETAIL at 300 with 14px to spare). **17 classes = 5 rows ending y=422 — a 122px collision with the detail panel.** Right edge is fine (352 ≤ 360).
  - [x] Re-lay the grid. Options to weigh (pick one, record why): **5 columns** at ~66px tiles (5×66+4×8 = 362 — 2px over, so ~65px tiles) giving 4 rows ≈ 360px tall — still collides; **smaller tiles + 5 cols** (e.g. 65×50, 4 rows = 224px, ends y=312 — still collides by 12); **shrink tiles AND lift/shrink DETAIL**; or **scroll the grid** (the `enableDragScroll` helper already exists in `config/ui.ts` and is used by Help/Credits/History). Note the 4.3 history: a scrollable picker was DESIGNED and then rejected on device in favour of the icon grid ("it looks great! we can proceed!") — so scrolling reverses a device decision and needs Danilo's nod.
  - [x] Do the arithmetic explicitly in the Dev Agent Record for whatever you choose, and keep every tile ≥44px tall (FR30 tap floor).
  - [x] Close the 4.3 deferral: the matchup-chip `chip()` helper (`DraftScene.ts` ~175) has **no bounds check** — chips can run off the panel's right edge. Add it (the deferral is recorded in deferred-work.md from the 4.3 review).
- [x] Task 6: The rest of the shell (AC: 1, 2)
  - [x] Display names + codes + `CLASS_TEXT` role/behaviour prose for the five (`ROSTER.md` has approved one-line descriptions — use them, don't invent new ones).
  - [x] The dossier's display-only move renames (E5-D10): Berserker "Cleave", Ninja "Rend", Golem "Smash", Phalanx back "Pierce", Mercenary "Cut Throat", Valkyrie melee "Pierce", plus the newcomers' verbs (Lunge / Skewer / Talon Strike / Wind Shot / Thunder Arrow). These need a per-(class, kind) display map — today `MOVE_PLATE_NAMES` is keyed by `MoveKind` ALONE (`constants.ts`), so it cannot express "Berserker's slash is called Cleave". Extend the seam; keep it union-keyed so a new kind is a compile error.
  - [x] `bolt` needs: a `MOVE_PLATE_NAMES`-side entry ("Magic Bolt" / "Lightning" for Valkyrie), a `TRACE_TRAVEL` entry (`projectile`), and a damage-type classification for the 5.6 card glyph rule (blast/bolt/spell = magic).
        *(Scope correction at the 2026-08-01 review: the first two clauses shipped here; the DAMAGE-TYPE
        classification did not — there was no seam for it in this story, as the Completion Notes state,
        and it landed in 5.6 (`flow/unitCard.ts` maps `bolt: 'magic'`). The tick ran one clause ahead of
        the work. Nothing was lost; the record now says which part waited.)*
  - [x] Sprites: newcomers ride **INTERIM shared frames** until 5.9 — follow the 4.3 convention exactly, including the attribution note format (`attribution.ts` `classSources`, e.g. `'dc-mon/…png (INTERIM: shares the Knight tile)'`). Do NOT touch `units.png`.
  - [x] Coupling-site sweep (the standing rule): re-check Placement tray, Result comps, History rows, Reveal and Battle against 360. **Growing the CLASS count does not change army size (still 5 slots)** — so most army rows are unaffected; say so explicitly after checking rather than assuming.
- [x] Task 7: AI pool, goldens, sweep (AC: 3)
  - [x] `STRATEGY_POOL` (`ai.ts:65`, "8–12 archetypes"): add newcomer representation by **single-unit substitution first** (the 4.3 method — swap one unit into an existing archetype rather than authoring exotic new comps).
  - [x] The **class-coverage guard** from 4.12 asserts every class appears in the pool — find it (`packages/engine/test/` — check `sim.test.ts`/`ai.test.ts`) and confirm it now covers 17, so a forgotten newcomer fails the build.
  - [x] Goldens (`packages/engine/test/golden.test.ts`): re-record **only** the battles the revision actually changes, and AUDIT event-by-event. Per `ROSTER.md`'s re-record column the changed inputs are mage, sorceress, phalanx and valkyrie — so any golden containing them changes; a golden with none of them **must be byte-identical** (assert that as the regression pin, the 4.4 method).
  - [x] Sweep: `pnpm --filter @lordly/engine sim` and the CI band test (`sim.test.ts`) must converge **≤65% in BOTH modes**. Casters losing splash is a real nerf to the three-mages family — expect a re-tune and budget for it. Remember the 5.1 lesson: `runs=200` can disagree with `runs=500` near the band edge — run the heavy confirmation before certifying.
  - [x] Property-test arbitraries (`packages/engine/test/arbitraries.ts:17-29`) derive small/monster class lists from `ALL_CLASSES`, so they pick up newcomers automatically — but the 4.8 lesson says a widened arbitrary can starve other properties' rare branches. Watch for flaky/starved property tests and reweight rather than lowering `numRuns`.
- [x] Task 8: Docs + gate (AC: 1, 2, 3)
  - [x] `docs/rules.md` gains the newcomers where the roster is described (the `rules-doc.test.ts` drift guard pins slot cost/role to BALANCE — check what it asserts and keep it green).
  - [x] Full gate: `pnpm typecheck && pnpm lint && pnpm coverage` (engine ≥90% lines), `pnpm --filter web build` (runs the 5.2 frame-art guard too).
  - [x] NO `logVersion` change — confirm and state it (dossier §4: new classes are new `UnitClass` values in setup/balance data, new `MoveKind` values ride the hash; the 4.7/4.8 precedents).
  - [x] Device pass with Danilo (the new Draft grid is the thing to look at). ACCEPTED 2026-07-28 — "it works great on my device."


### Review Findings (senior code review 2026-08-01 — ALL THREE LAYERS COMPLETE; the Blind Hunter's scoped engine re-run closed the gap)

Reviewed LATE: stories 5.5–5.8 landed on top (5.5 re-laid the same Draft grid into tabs, re-tuned the
same balance rows, bumped balanceVersion to 11), so every finding was re-verified against the CURRENT
tree; superseded candidates were dropped — notably ALL Draft-grid geometry, which 5.5 rebuilt.

- [x] [Review][Patch] LOW: `draftGridBottom(0)` returns `startY − gapY` — the `(rows − 1)` term goes negative on an empty tab, so the fit gate would pass VACUOUSLY rather than fail; unreachable today (both tabs are non-empty and the test iterates real tabs) but it is a guard whose whole job is to catch a grid that does not fit, and a future race wave or tab-filter change is exactly when an empty tab appears [config/constants.ts:329-331]
- [x] [Review][Patch] LOW: Task 3's prescribed test was SUBSTITUTED without the substitution being recorded — the ticked subtask says "a test asserting a bolt-only battle consumes the SAME number of battle-stream draws as a blast-only battle", but what shipped is a different (stronger) all-bolt seed-pair identity discriminator. The substitution was forced and correct (the story's own E5-D4 left no class carrying a `blast` row, making a blast-only battle unconstructible), and the Completion Notes describe what shipped accurately — but the repo's standing rule is that a ticked task whose prescription changed says so [story record, Task 3]
- [x] [Review][Patch] LOW: a ticked Task 6 subtask overstates by one clause — "`bolt` needs … a damage-type classification for the 5.6 card glyph rule" is marked done while the same record admits the classification "has no seam yet — it is 5.6's scoped work, nothing recorded"; 5.6 did deliver it (`flow/unitCard.ts` maps `bolt: 'magic'`), so nothing was lost, but the tick was ahead of the work [story record, Task 6]
- [x] [Review][Patch] LOW: File List path mangled by markdown — `packages/engine/test/`__snapshots__`/golden.test.ts.snap` ate the `__snapshots__` directory name to bold rendering; escape it [story record]

**The scoped ENGINE re-run (2026-08-01) — the gap is closed.** Four findings, all four patched. NO
functional defect in the engine core: the move-driven dispatch, the `bolt` semantics, the balance rows
and the goldens are sound. Every finding below is a GUARD or a CONTRACT RECORD that the roster moved
out from under — the same failure mode three times, which is the story's real lesson.

- [x] [Review][Patch] MED: the magic-exemption tests went VACUOUS when E5-D4 retired the blast — both sites classify magic as `kind === 'blast'`, and no class carries a blast row any more. `crit-dodge.test.ts:196` filters a five-**mage** fixture on `'blast'`, so the loop body never executes (probed: that battle emits `{slash: 5, bolt: 8}`, zero blasts); `:227`'s arbitrary property classifies every `bolt` as PHYSICAL and checks it against the `hit|crit|dodged` set, which a bolt satisfies by accident. PROVEN by mutation: routing `act()`'s bolt through `rollHit` left **all 16 crit-dodge tests green**. The contract itself was never unguarded — `roster.test.ts`'s all-bolt zero-draw discriminator and the bolt-vs-Guard test both fail under that mutation — but the file that names itself the magic-exemption guard asserted nothing about the only magic attack in the game. FIXED: a `ZERO_DRAW_KINDS` set (`blast`/`bolt`/`breath`, keyed on roll-free, NOT on magic-vs-physical — `breath` is physical arithmetic and still takes no roll), plus non-vacuity guards at both sites (a `checked > 0` count and a `sawZeroDraw` reachability flag beside the existing `sawCrit`/`sawDodge`). Re-verified: both patched assertions now FAIL under the same mutation [crit-dodge.test.ts]
- [x] [Review][Patch] LOW: ADR 0003 — the FROZEN draw contract — never recorded `bolt`. Its "Zero draws, by design" list still named only the Wizard/Sorceress row blast, so the era's new magic attack had its zero-draw classification asserted in code comments and tests but nowhere in the document replay correctness rests on. The 4.7 Guard change set the precedent (a dated amendment, not a silent edit). FIXED: an amendment covering `bolt` AND 5.5's `breath` under the existing single-target rule, stating explicitly that the zero-draw property keys on **single-target vs row-AoE**, never magic-vs-physical — and recording the one real behavioural consequence: a confused mid/back caster used to self-blast (**A1 only**) and now bolts a random ally (**A1 + A2**), which A2's own condition always covered, and which is replay-safe because it rode balanceVersion 9 → 10 [docs/adr/0003-battle-stream-draw-order.md]
- [x] [Review][Patch] LOW: FR25's "anti-front-stack archetype" acceptance (epics.md:357) was enforced as "≥2 mages — row blasts punish stacked rows", whose entire premise died with E5-D4. The check had decayed into "≥2 mages exist in the pool", which the 4.12 reverse-coverage guard already forces — so an FR25 acceptance property was silently untested. FIXED (Danilo's call: re-point, don't record a deviation): the guard now asserts some archetype PLACES a unit on a row-AoE row, derived from `BALANCE.classes[cls].moves[placedRow]` rather than from class names, so the next roster move re-points it automatically instead of decaying again. Three archetypes qualify today (Breath Battery / Wyrmhold / Stormflight, all back-row dragons) [ai.test.ts:123]
- [x] [Review][Patch] LOW: FR10 (epics.md:38) still described the Mage row blast as a live mechanic. It carries dated amendment notes for every prior change (the 2026-07-14 attenuation, the Archmage gating) but nothing for 5.4 retiring it from the roster — the decision lived only in the dossier as E5-D4, with no requirement-side trace. FIXED (Danilo ratified 2026-08-01): a dated amendment in the FR25 style, saying the rule is NOT repealed — kind, targeting and `blastAttenuation` stay live reserved data for the future Archmage — and pointing at the two consequences (the 4.12 attenuation pin's successor, and `breath` as the FR25 row-AoE) [epics.md:38]
- Also patched, non-finding: `magesVsClerics`'s docstring in `wipeout.test.ts` still described the mages as blasting the fullest enemy row and called itself the 4.12 blast-attenuation fixture. 5.4 repurposed it into the bolt no-attenuation pin without rewriting the doc.

**Engine surfaces adversarially walked and CLEARED (Blind Hunter, engine scope):** the merged
move-driven dispatch preserves every pre-5.4 routing exactly (Cleric staff = ranged/global, caster
FRONT staff = melee, Archer = ranged, Guard rows = raise); the "a new kind is a compile error"
claim is REAL, not aspirational (an exhaustive switch with no default under `strictNullChecks` makes
the function end reachable → TS2366; 5.5 having to add `case 'breath'` is the proof); `bolt` is
genuinely zero-draw and Guard-immune, both test-pinned and both confirmed to FAIL under mutation;
`attackMoveOf`'s unchecked `moves.back as MoveKind` cast is protected by the E5-D12a back-row-Guard
invariant (`roster.test.ts:869`); the misfire branches are row-consistent with `act()` and the
retired self-blast's replacement is deliberate; the name tables carry an enormous margin (59 male /
52 female against a 5-unit worst case); and the 4.12 cross-engagement attenuation pin was properly
SUCCEEDED, not dropped, by the bolt's both-mode no-attenuation pin (`wipeout.test.ts:316`). What the
Auditor and Edge Hunter covered is listed below and stands.

**Independently re-verified (Acceptance Auditor + Edge Case Hunter):** `LOG_VERSION` stayed 4 at the
review commit and today, with the record's rationale (bolt rides `UnitAttacked.kind`'s existing string
field — the 4.7 `bash` precedent) matching the diff. balanceVersion 10 + hash `7d0a6a4e` re-pinned, and
the current tree's 11 supersedes it correctly with 10 intact in the contiguous history. **The zero-draw
claim is TRUE and its test asserts exactly what the record says** — `bolt` is MAGIC ranged
single-target (`magicDamage` = INT − floor(MEN/2), min-1), routed through `strike()` with no roll: no
crit, no dodge, no Guard interaction, exempt from the physical leader-fall penalty; the discriminator
pins two seeds sharing an E1 flip to deep-equal event streams, with a fixture guard that every attack
is `kind: 'bolt'` — it passes. Goldens: exactly #4/#10 touched, and structurally forced (a fixture scan
shows mage appears only in #4 and phalanx only in #10 across all 11), with hand-derived event-audit
numbers present. Sweep claims recorded identically in three places. Every other ticked subtask has
matching diff evidence (unions +5/+3/+1 with exhaustive-Record extensions, dossier-shaped balance rows,
the inert dragonslayer→dragon relation with its pin, the E5-D12a back-row-Guard invariant, names-margin
arithmetic, the 4.12 coverage guard auto-deriving from `ALL_CLASSES`). Interim-sprite attribution
follows the 4.3 convention exactly, `units.png` untouched. Edge walk found every diff-born branch
guarded in the current tree (compile-exhaustive move dispatch now covering 5.5's `breath`, dead-unit
filtering in `selectBlastRow`, empty-board bolt targeting, terminating chip ellipsis, tab-rebuild array
reset, balanceVersion-marked history); 58/58 in the roster/names/draft-grid suites.

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

Claude Fable 5 (claude-fable-5) via Claude Code.

### Decisions Made In-Story (recorded for review)

1. **Engine key `dragonhunter`** (single flat lowercase word, matching `sorceress`-style keys); display name "Dragon Hunter", code DRH.
2. **`act()`/`misfire()` became fully MOVE-DRIVEN** — one attacker case-group switching on the looked-up `(class, row)` move (exhaustive over `RowMove`, no default, so 5.5's `breath` is a compile error), with only Cleric (heal) and Witch (cast) keeping class cases. Behavior-identical for every unrevised class (the old per-class groups all reduced to the same move branches); it is what lets the three mixed kits (Valkyrie back-`bolt`, Vultan/Raven back-`arrow`) route with zero special-casing. The Archer and the casters' staff-front merged into the same dispatch unchanged.
3. **Caster misfire follows the kit (dossier-silent, decided here, flagged for review):** the 4.7 review principle is "a misfire is the unit's normal attack shape, misdirected." The casters' mid/back move IS the single-target bolt now (E5-D4), so a confused caster bolts a RANDOM ALLY (an A2 redirect draw, no A3/A4 — magic) instead of the retired self-blast. The self-blast branch survives, data-reachable, for any future `blast` row. Confusion pins re-probed (seed 1).
4. **`blast` stays a live, data-driven rule with NO roster user** (E5-D4: reserved for a future Archmage): `act()`/`misfire()` keep the branches, `blastDamage` keeps its arithmetic pins in damage.test/wipeout.test; only battle-level blast coverage retired. Engine line coverage 97.5% (gate 90%).
5. **Draft grid re-lay: 5 columns of 62×50 tiles** (no scroll — scrolling would have reversed Danilo's 4.3 device decision). Arithmetic: 17 classes → 4 rows; grid bottom 88 + 4×50 + 3×6 = **306**; row width 9 + 5×62 + 4×8 = **351 ≤ 360**; tiles 62×50 ≥ the FR30 44px floor. DETAIL moves 300→**310** and shrinks 116→**108** (ends 418, clearing the tray label at 426); panel content offsets compressed (title +10, role +34, moves +50, chips +90, sprite center +48). Tile names render at 8px with word-wrap ("Dragon Hunter" is the only two-liner); geometry exported as pure data (`DRAFT_GRID`/`DRAFT_DETAIL`/`draftGridTile`/`draftGridBottom`) so it is vitest-testable without Phaser (draft-grid.test.ts).
6. **Per-(class,kind) move names:** new `CLASS_MOVE_NAMES` sparse map consulted first by `moveDisplayName` (which now takes the actor class — battleView passes `actor.class`) and by `draftModel.moveLabel` — one vocabulary for the battle plate and the Draft card.
7. **Interim sprites:** Fencer/Hawkman/Vultan/Raven share the Mercenary tile; Dragon Hunter shares the Archer tile (attribution.ts carries the INTERIM notes). Dedicated art is story 5.9.
8. **CI sweep proxy re-pinned** baseSeed 1 → 21: the pool re-tune moved the 15-run sample; seeds 16–25 all sample in-band in both modes and 21 sits mid-run (robust to small future pool edits). The converged truth is the certification (below), the proxy is CI's deterministic stand-in — exactly the test's documented philosophy.

### Balance Re-Tune Record (AC3)

E5-D4 (casters lose splash) collapsed the caster comps and let the melee/sniper walls dominate — first sweep after the data landed: bulwark 80.2%, longbows 75.8%, golem-wall 69.4%, wardens 68.2%; three-mages/gale at 17%. Re-tune (pool data only, identities kept; probes recorded in ai.ts comments):

- three-mages/gale/farshot: the 4.4/4.7 EXPOSURE moves reversed/adjusted — bolt-era casters no longer need policing, they need screens (farshot's one-archer exposure KEPT: full retraction sent its wipeout rate to 68.5% — the cleric-sustain compounding 4.7 policed).
- cabal: ninja steps up as front screen + cleric → knight (a caster battery's predator is the sniper; only a vanguard punishes snipers).
- ambushers/hex-coven: casters retreat to fully-screened back lines.
- bulwark: one front knight → Phalanx (guard-full, 1 action — two slash actions traded for a shield; deliberately NOT a skirmisher swap, which would have shielded the wall from its own predator, bolts ×3/2 on vanguards).
- golem-wall: golem moves to the front-left CORNER — its king-move ban frees the right lane so melee can walk past the wall (a vultan-for-archer probe BUFFED it to 69.5%, reverted).
- Newcomer representation (single-unit substitutions, the 4.3 method): longbows archer→Vultan, talons mercenary→Hawkman, wardens mercenary→Fencer, hex-coven knight→Dragon Hunter, ambushers mercenary→Raven. The 4.12 coverage guard now enforces all 17.

**Certified converged (runs=500, seed 1, both modes — the 5.1 heavy-confirmation lesson):** single max **wardens 61.3%**, wipeout max **longbows 64.9%**; floors gale 29.6% single / talons 31.7% wipeout (no lower-bound AC; wardens' own viability floor asserts >25% and it sits at 61/53). Longbows' 64.9% is edge-close — flagged as the first thing a 5.5 sweep should watch.

### Completion Notes List

- **Goldens (E5-D11 discipline):** exactly #4 and #10 re-recorded — the two whose inputs the dossier revised — each audited event-by-event with hand-derived damage/targeting numbers in the test comments. The other NINE proven byte-identical by checksumming each snapshot block old vs new (md5 per export block). Golden #4's two-mage blast kill is impossible by design now; it pins the guarded-arrow beat + single bolt kill instead, and B's leader SURVIVES (no LeaderFell).
- **ADR-0003 hold:** bolt = `strike()` with NO roll (zero draws), pinned by a new discriminator — an all-bolt battle's log is byte-identical across seeds with the same E1 tie flip (roster.test). The frozen draw table is untouched; the caster misfire's A2 draw is the table's existing misfire-redirect category.
- **Anchors re-derived by hand:** resolve.test's determinism anchor (every non-draw number derived: bolts 34 into the mid knights, slashes 19 back, verdict 458/700=65 vs 324/400=81) and sim.test's wall-vs-battery anchor (65/76 — A's side is draw-free arithmetic). The old 10%/100% blowout → 65/76 is the E5-D4 meta shift in one line.
- **leader.test re-curated:** the reversion fixture's pre-fall coincidence is now STRUCTURAL (singleton melee legal lists + an archer whose autonomous and strongest picks provably coincide until B's back line dies) instead of a lucky seed; probe found seeds 12/13/14 all satisfy every condition (12 pinned).
- **guard.test per E5-P2:** one raise per engagement pinned; re-arm proven at the engagement SEAM (wipeout); natural-end expiry proven with an all-caster enemy (and the fixture note records the trap: a rearmost phalanx gets bolted to death and a dead unit's charge expires silently).
- **Names margin (Task 4):** male classes 8→12, MALE_NAMES 48→56, FEMALE_NAMES 48→52. Worst case stays 10 same-sex draws per match (5+5); dedup margin ≥42 free entries — `rollName`'s exhaustion fallback is unreachable by a wide factor.
- **Coupling-site sweep (the 4.2 rule):** checked, and stated rather than assumed — army SIZE is untouched (5 slots), so Placement tray, Result comps, History rows, Reveal/Battle boards are unaffected; the only class-COUNT-coupled layouts were the Draft grid (re-laid) and the Credits attribution list (a drag-scroll scene, auto-grows). `storage.ts`/`placement.ts` iterate ALL_CLASSES as validation sets — auto-correct.
- **rules.md** fully re-cut for 17 classes (table, roles incl. the inert Dragonslayer hunt with its "no dragon flies these skies yet" note, seven row-varied classes, Magic Bolt section replacing Blast, 17-class speed order); the drift guard's own stale pins (blast rows, the four-class exception list, the retired attenuation sentence) updated with it.
- **NO logVersion change** (confirmed: new classes are new `UnitClass` values in setup/balance data; `bolt` rides `UnitAttacked.kind`'s existing string field — the 4.7 `bash` precedent). balanceVersion 9→10, hash re-pinned (7d0a6a4e).
- **Deferred/known-limitation notes:** the 5.6 unit-data card's damage-type glyph classification (bolt = magic) has no seam yet — it is 5.6's scoped work, nothing recorded. The 4.3 chip bounds-check deferral is CLOSED (deferred-work.md updated).
- Full gate green: typecheck, lint, coverage (621 tests, engine 97.5% lines vs 90% gate), web build (frame-art guard included).
- **Device pass ACCEPTED (Danilo, 2026-07-28):** the re-laid 17-class Draft grid confirmed on device — "it works great on my device." All tasks closed.

### Change Log

- 2026-07-28: Story implemented end-to-end (engine wave + shell + re-tune + docs); status → review.
- 2026-07-28: Device pass accepted by Danilo — all tasks closed; story stays in review awaiting the code-review pass.

### File List

- packages/engine/src/types.ts — +5 classes, +3 roles, +`bolt` MoveKind
- packages/engine/src/balance.ts — version 10; 5 new class rows; mage/sorceress/valkyrie/phalanx revision; dragonslayer→dragon hunt
- packages/engine/src/resolve.ts — move-driven act()/misfire() dispatch; bolt branch (zero draws); attackMoveOf doc
- packages/engine/src/names.ts — CLASS_SEX +5; MALE_NAMES +8; FEMALE_NAMES +4
- packages/engine/src/ai.ts — newcomer substitutions + the E5-D4 pool re-tune (7 archetypes touched)
- packages/engine/test/balance-hash.test.ts — v10 hash pin
- packages/engine/test/types.test.ts, balance.test.ts — enumeration/relation pins
- packages/engine/test/roster.test.ts — bolt suite (targeting, zero-draw discriminator, Guard immunity), mixed-kit suite, move-table pin + back-row-Guard-forbidden invariant (E5-D12a), sorceress/leader-tactic rewrites
- packages/engine/test/confusion.test.ts — caster misfire → ally-bolt (seed re-probed)
- packages/engine/test/guard.test.ts — E5-P2 rewrites (once-per-engagement, seam re-arm, expiry fixture)
- packages/engine/test/wipeout.test.ts — bolt mode-invariance (blastDamage arithmetic contrast kept)
- packages/engine/test/leader.test.ts — combat-kill leader → A:4; reversion fixture re-curated (structural coincidence, seed 12)
- packages/engine/test/resolve.test.ts, sim.test.ts, ai.test.ts — anchors re-derived/re-pinned; CI proxy baseSeed 21
- packages/engine/test/`__snapshots__`/golden.test.ts.snap — goldens #4/#10 only (others byte-identical, checksum-verified)
- packages/engine/test/golden.test.ts — #4 rewritten (audited), #10 re-record note
- apps/web/src/config/constants.ts — codes/display names +5; CLASS_MOVE_NAMES; moveDisplayName(kind, element, cls); DRAFT_GRID/DRAFT_DETAIL + helpers
- apps/web/src/config/sprites.ts — interim frames +5
- apps/web/src/flow/draftModel.ts — CLASS_TEXT +5 & caster/valkyrie prose; class-aware moveLabel
- apps/web/src/flow/battleView.ts — movePlate passes actor.class
- apps/web/src/scenes/BattleScene.ts — TRACE_TRAVEL bolt; bolt trace color/nudge
- apps/web/src/scenes/DraftScene.ts — re-laid grid (constants-driven), compressed detail panel, chip bounds clamp
- apps/web/src/assets/attribution.ts — INTERIM notes +5
- apps/web/test/draft-grid.test.ts — NEW: the grid-geometry suite
- apps/web/test/constants.test.ts, battle-view.test.ts, draft-model.test.ts, rules-doc.test.ts — vocabulary/varies/doc-guard updates
- docs/rules.md — the 17-class re-cut
- docs/implementation-artifacts/deferred-work.md — 4.3 chip deferral resolved
- docs/implementation-artifacts/sprint-status.yaml — 5-4 status
- 2026-08-01: SENIOR CODE REVIEW (run LATE — 5.5–5.8 had landed; findings re-verified against the
  current tree, and all Draft-grid candidates dropped as superseded by 5.5's tabbed re-lay). 4 patches
  applied, all LOW: the `draftGridBottom(0)` negative-row term (a fit gate that would pass vacuously on
  an empty tab — unreachable today, but that function exists to fail when a grid does not fit) now
  returns the grid top and is pinned; the Task 3 test SUBSTITUTION is recorded (the prescribed
  bolt-vs-blast draw comparison became unconstructible once E5-D4 left no class carrying a `blast` row —
  the stronger all-bolt seed-pair discriminator shipped instead, and only the ticked line still promised
  the original); the Task 6 tick that ran one clause ahead (the damage-type classification had no seam
  here and landed in 5.6); and a markdown-mangled `__snapshots__` path. Status stayed `review`: the
  Blind Hunter's first run died on an API spend limit having cleared only the superseded UI portion, so
  the ENGINE had no adversarial pass yet. What the Auditor and Edge Hunter did verify is substantial and
  clean: logVersion 4 held, balanceVersion 10 + hash correctly superseded by 5.5's 11, the ZERO-DRAW bolt
  claim true with a discriminator that asserts exactly what the record says, goldens #4/#10 structurally
  forced to be the only two touched, sweep claims consistent across three records, and every other ticked
  subtask evidenced. Gate: 752 tests green.
- 2026-08-01: THE SCOPED ENGINE RE-RUN — the gap is closed and the story moves to `done`. NO functional
  defect in the engine core (dispatch, `bolt` semantics, balance rows, goldens all sound). 4 findings,
  4 patched, 0 deferred: 1 MED (the crit-dodge magic-exemption tests went vacuous when E5-D4 retired the
  blast — proven by mutation, since routing `bolt` through `rollHit` left all 16 of them green; now keyed
  on roll-free kinds with non-vacuity guards, and re-verified to fail under the same mutation) and 3 LOW,
  all the same shape: a guard or a contract the roster moved out from under. ADR 0003 never classified
  `bolt`; FR25's anti-front-stack guard had decayed to a class-presence check; FR10 still described the
  blast as live. **The story's real lesson, for the retro: `blast` did not break anything when it was
  retired — it quietly emptied three separate guards that all kept passing.** Two PO decisions taken by
  Danilo (re-point the FR25 guard at a `breath` archetype; amend FR10 now). Gate re-run green: typecheck,
  lint, 365 engine tests.