---
baseline_commit: 241a0ec3d128319f2cd94245acd9f7602c99a254
---

# Story 4.2: The era turnover — five-slot armies and named soldiers

Status: review

## Story

As a player,
I want to field a five-slot army of named soldiers,
so that my squad starts feeling like an OB64 squad, not a trio.

## Acceptance Criteria

1. **Slot vocabulary (AD-1).** Balance data carries `slotBudget: 5` + per-class `sizeClass` (cost derived: small=1, monster=2); the engine exports `slotTotal(army)`; the shipped `armySize` constant is **deleted**; no code anywhere uses `army.length` as a legality measure — validation already accepts that a future two-monster army is full at 3 units.
2. **MatchSetup extension (AD-9).** `tactics: {A, B}`, `leaders: {A, B}`, `Unit = {class, element, name}`; placements documented as ANCHOR cells (structurally unchanged for smalls); army mutation clears that side's leader; `commit()` requires an explicit tactic and a valid leader — until the pickers ship (4.4/4.5), `MatchFlow` explicitly commits `autonomous` + leader index 0 for both sides.
3. **Names (FR37, AD-10, dossier §7).** `names/A`/`names/B` join the closed stream set; an engine-exported roll function draws from per-sex name tables (engine data OUTSIDE the balance-hash surface); `MatchFlow` rolls names for both sides at army construction (the AI module never rolls names — AD-6); names display on placement/reveal cards and in the log-panel narration; the board keeps codes.
4. **THE BUMP (AD-15, dossier §5).** The COMPLETE union extension lands in types with `logVersion` 3 → 4 exactly once: `UnitAttacked.kind` + per-target `outcome` (+`redirectedFrom?`), `PassStarted.actionsRemaining`, `GuardRaised`, `GuardEnded`, `StatusCleared`, `LeaderFell`. `StatusCleared` and `actionsRemaining` and `kind`/`outcome:'hit'` are EMITTED now; Guard/LeaderFell members sit unemitted until 4.5/4.7. **No dodge/crit draws yet** — ADR 0003's new draws are story 4.6's; 4.2 emits `outcome: 'hit'` unconditionally.
5. **Wipeout cap 10 (FR19).** `engagementCap: 10`; Home's hint updates automatically (it reads balance data); `docs/rules.md` reworded (the drift guard forces it); `balanceVersion` bumps with hash re-pin and re-recorded goldens.
6. **The phone.** Draft and Placement handle 5 units in the portrait layout (FR1, FR30); the AI plays 5-slot archetypes (FR24/FR25); the full loop completes on device; **pre-era history entries still DISPLAY, marked non-replayable — confirmed on device in anger** (see the storage catch below); new entries store tactics and leaders (FR28).
7. **Tests.** Determinism, termination, judging-symmetry properties + goldens all hold over 5-slot armies; both-mode sweep stays inside the ≤65% band with the re-authored pool; ≥90% engine coverage gate green.

## Tasks / Subtasks

- [x] Task 1: Engine — the slot schema replaces armySize (AC: 1, 5)
  - [x] `balance.ts`: DELETE `armySize` (interface `:32` + value `:87`); add `slotBudget: 5` and per-class `sizeClass: 'small' | 'monster'` (all six shipped classes `small`); `engagementCap` 5 → 10 (`:88`); `version` 2 → 3.
  - [x] New engine export `slotTotal(army: Unit[])` (sum of per-class slot costs; cost = sizeClass-derived 1|2 — one source). Natural home: `balance.ts` or a small `slots.ts`.
  - [x] `validate.ts:76`: `army.length !== BALANCE.armySize` → `slotTotal(army) !== BALANCE.slotBudget`; violation `wrong-army-size` → `wrong-slot-total` (message names budget and total). Placement parallelism (`:98`) stays `length`-based (indices, not legality — correct as-is).
  - [x] `test/balance-hash.test.ts:12-15`: add the `3: '<new hash>'` entry (run once to learn the hash — the structural test enforces contiguity).
  - [x] `test/balance.test.ts:84-85`: armySize pin → slotBudget 5 pin; engagementCap pin → 10.
  - [x] `docs/rules.md`: "after 5 engagements" → 10 (rules-doc.test.ts:81 derives from balance and FAILS until the doc matches — the drift guard working as designed).
- [x] Task 2: Engine — MatchSetup/Unit extension, names, streams (AC: 2, 3)
  - [x] `types.ts`: `Unit` gains `name: string`; `MatchSetup` gains `tactics: { A: Tactic; B: Tactic }` and `leaders: { A: number; B: number }`; new `ALL_TACTICS = ['autonomous', 'weakest', 'strongest', 'leader'] as const` → `Tactic` (house pattern: const array + derived union); `UnitSnapshot` gains `name` (BattleStarted already carries render statics — narration reads it there); `Placement` doc-comment gains the anchor semantics note (AD-9/AD-14 — structure unchanged, monsters derive their second cell in 4.8).
  - [x] New `names.ts` (engine src): per-sex name tables (~48 male, ~48 female, OB64-adjacent register — AUTHOR THE LISTS; Danilo's flavor veto happens at device review) + a `CLASS_SEX: Record<UnitClass, 'm' | 'f'>` map (D-1f: knight/mercenary/mage m; archer/cleric/witch f) + `rollName(stream, cls, taken: string[])`: ONE `nextInt` draw for the list index, then deterministic forward-advance past names already in `taken` (dossier §7 — no extra draws). **Separate module = automatically outside `contentHash(BALANCE)` — name edits never invalidate history (AD-4).** Export from `index.ts` with doc comments.
  - [x] `rng.ts:13`: `STREAM_LABELS` gains `'names/A', 'names/B'`; `test/rng.test.ts:27` literal array updated (the closed-set pin — this edit IS the sanctioned API-change process).
  - [x] `validate.ts`: new checks + violations — `invalid-tactic` (both sides in `ALL_TACTICS`), `invalid-leader` (integer index into that side's army), per-unit `name` is a non-empty string (`invalid-name`). Each unit-tested like the existing cases.
- [x] Task 3: Engine — the v4 union and its 4.2 emissions (AC: 4)
  - [x] `types.ts`: `LOG_VERSION` 3 → 4 (+ doc-comment history line); `AttackTarget` gains `outcome: 'hit' | 'crit' | 'dodged' | 'missed'`; `UnitAttacked` gains `kind: MoveKind` (`'slash' | 'arrow' | 'blast' | 'staff'` — `'bash'` arrives with Phalanx in 4.3/4.7) and `redirectedFrom?: UnitId`; `PassStarted` gains `actionsRemaining: Record<UnitId, number>`; new members `GuardRaised {unit}`, `GuardEnded {unit}`, `StatusCleared {unit, spell}`, `LeaderFell {side, unit}` join the union with doc comments naming their emitting stories.
  - [x] `resolve.ts` emissions: `:98` PassStarted carries the per-unit remaining-actions snapshot (resolve already tracks it); `:315` UnitAttacked carries `kind` (derived from the acting class's behavior — knight/mercenary `slash`, archer `arrow`, mage `blast`, cleric-fallback `staff`; semantically true today, row-varied in 4.7) and per-target `outcome: 'hit'`; the `:76-81` between-engagement reset emits one `StatusCleared {unit, spell}` per actually-cleared status (poison excluded — it persists) BEFORE the clear.
  - [x] `test/events.test.ts:6-7`: LOG_VERSION pin → 4; extend the union-shape assertions for the new members/fields.
  - [x] Exhaustiveness ripple: `narration.ts` and `BattleScene.render` switch on the union — add arms for the four new members (StatusCleared: BattleScene removes the icon [see Task 7]; narration lines for StatusCleared e.g. "the sleep lifts from Kain"; GuardRaised/GuardEnded/LeaderFell get arms now [narration text per dossier §6] even though unemitted — TS forces it, and 4.5/4.7 then only touch the engine).
- [x] Task 4: Engine — the AI drafts five slots (AC: 6, 7)
  - [x] `ai.ts:18-27`: the `readonly [X, X, X]` tuples become length-5 (or `readonly UnitClass[]` + runtime slot assertion — dev's call; tuples keep compile-time safety); ALL 10 `STRATEGY_POOL` archetypes (`:59-160`) re-authored as 5-slot compositions + placements (keep each archetype's IDENTITY — bulwark stays a wall, longbows stays an archer line; extend, don't redesign).
  - [x] `test/ai.test.ts:26-35`: derives from the budget — update to slot arithmetic.
  - [x] `test/sim.test.ts`: the both-mode ≤65% band (`:144` single, `:171-177` wipeout) MUST pass with the re-authored pool over 5-unit battles — if a comp dominates, re-tune the POOL (not the class stats — those are 4.3's); note the wardens-melee-floor input from 3.0 while at it. Budget real time here: 5-unit battles change the meta. (Re-tuned via a ~40-variant identity-preserving search; converged runs=200: single 30.9–62.3%, wipeout 24.8–62.8%. Wardens note for 4.12: 30.9% single / 62.8% wipeout — melee is wipeout-viable, single-mode is a ranged damage race.)
- [x] Task 5: Engine — goldens and properties over five slots (AC: 7)
  - [x] `test/arbitraries.ts:14-17`: army/placement arbitraries generate slot-legal armies (`slotTotal === slotBudget`; all-smalls this era = exactly 5 units) with names + tactics + leaders in setup arbitraries.
  - [x] `test/golden.test.ts`: all 8 golden armies re-authored as 5-unit setups (keep each golden's SCENARIO intent — #7 stays the wipeout-cap prober, now asserting 10 via the derived `BALANCE.engagementCap`); re-record snapshots (`vitest -u`) once, deliberately, AFTER Tasks 1–4 are stable. (Goldens #1/#6/#7 reuse wipeout.test.ts's hand-derived fixtures; verdicts match those derivations exactly.)
  - [x] Property tests (termination, judging symmetry, seed identity) green over the new arbitraries; coverage gate ≥90% holds. (Full suite 395/395; engine src 99.46% lines.)
- [x] Task 6: Flow — MatchFlow rolls names, commits defaults, history survives (AC: 2, 3, 6)
  - [x] `MatchFlow.draftUnit` (`:132-141`): roll the unit's name on `names/A` at the same moment as its element — a private `rollNextName()` mirroring `rollNextElement` (`:262-268`): reconstruct stream, fast-forward `namesRolled`, draw, bump. `removeUnit` keeps the stream FORWARD-ONLY (the element precedent: discarded rolls never rewind — AD-10). (Deviation, recorded: the counter is `nameRolls: UnitClass[]` — the CLASS of each past draw, not a bare count — because a name draw's bounds come from the class's sex-keyed table; a bare count silently breaks bit-identical fast-forward the day 4.8's construct table has a different length.)
  - [x] `MatchFlow.commit` (`:175-213`): AI units get names rolled on `names/B` (loop mirroring the `elements/B` rolls at `:200` — MatchFlow rolls, NOT chooseSetup — AD-6); the assembled `MatchSetup` gains `tactics: {A: 'autonomous', B: 'autonomous'}`, `leaders: {A: 0, B: 0}` (the explicit interim defaults — pickers arrive 4.4/4.5); leader-clearing invariant: any `draftUnit`/`removeUnit` resets the (future) leader field — land the state hook now with the default. (`MatchState.playerLeader: number | null`, cleared on both mutations; commit maps null → 0.)
  - [x] `startReplay` (`:100-121`): fast-forward counters account for names (`nameRolls = setup.armies.A.map(u => u.class)`).
  - [x] **THE STORAGE CATCH (recon-verified — this breaks AC 6 if missed):** `storage.ts:51` `isRenderableArmy` requires `value.length === BALANCE.armySize` — after the bump, every pre-era 3-unit entry would be SILENTLY DROPPED from History (filtered at `loadHistory:145`), not displayed-non-replayable. Fix: renderability is `length >= 1 && length <= BALANCE.slotBudget && every(isRenderableUnit)` — display tolerance, never a legality gate (legality lives in validate.ts). Old entries then display and `historyModel.ts:52`'s balanceVersion check marks them non-replayable exactly as designed. Unit-test with a stored 3-unit v2 entry.
  - [x] `isRenderableUnit` (`storage.ts:43-47`) already ignores extra keys — old nameless units render (display falls back to code-only), new named units pass. Add the fallback path test.
  - [x] `test/match-flow.test.ts`: the hard 3-pins (`:66` regex, `:67` length) become budget-derived; new tests: names rolled forward-only, same-army name dedup, tactics/leaders present in committed setup + HistoryEntry.
- [x] Task 7: Shell — five on the phone, names on cards, icons log-driven (AC: 3, 5, 6)
  - [x] `DraftScene`: tray math (`:130-132`) already derives from `BALANCE.armySize` — switch to `slotBudget`; 5 slots × 96px + gaps = 528px OVERFLOWS the 360 base → shrink slots (5×64 + 4×8 = 352 ✓) or two rows — dev's call against the 44px tap floor (UX-DR4); count copy `:121` derives; `DRAFT_HINT` (`constants.ts:147`, literal "3 units") becomes a `draftHint(budget)` function. (Chose shrunk 64px slots — ≥44px tap targets; compact card stacks sprite over code, the per-card "tap to remove" copy became one shared hint under the tray.)
  - [x] `PlacementScene.trayCenter` (`:114-118`): **hardcoded 3** → budget-derived, same overflow rework; `PLACEMENT_SUBMIT_HINT` (`constants.ts:150`, literal "place all 3 units") becomes derived (`MatchFlow.ts:183` already interpolates the count — align the constant).
  - [x] Names on cards: placement tray + reveal boards show the unit's name (dossier §7/§6 — under the code, `{typography.data}`-scale; the 4.0 contrast tokens govern board codes, names sit on cards/spines per DESIGN Epic 4 tokens). (Placement card: name under the code at the 10px floor; Reveal: name under the tile code with the FR39f stroke treatment.)
  - [x] `BattleScene`: handle `StatusCleared` (remove that unit's icon) and DELETE `clearStatusIconsExceptPoison()` — the sanctioned AD-2 exception dies (deferred-work.md's 2.2 item closes); keep `PassStarted` handler (label already Turn); narration gains the new-member lines (Task 3 ripple).
  - [x] Narration name display: `unitName()` (narration.ts) upgrades to "Kain (KNI)" using `UnitSnapshot.name` from BattleStarted.
  - [x] Home wipeout hint: NO code change (reads `BALANCE.engagementCap` — recon-verified); visually confirm "max 10" on device. (Confirmed in Danilo's 2026-07-17 device session.)
- [x] Task 8: Gate + device sign-off (all ACs)
  - [x] Full gate: typecheck, lint, prettier, all tests incl. re-recorded goldens + both-mode sweep, engine coverage ≥90%. (typecheck ✓ both packages; eslint + prettier ✓; 395/395 tests; engine 99.46% lines; prod build ✓.)
  - [x] Deploy; Danilo's device session: full 5-unit loop (draft → battle → result), names visible and flavorful (his §7 veto moment), Home says max 10, **History shows pre-era entries non-replayable and the new entry replayable** — the AC-6 in-anger check. (Deployed fcd5477; round 1 caught the Result-screen 3-unit chip overflow — fixed + redeployed 11c0b6c same session; names approved: "i liked that we displayed the names, and on the battle we hide it".)
  - [x] Danilo's sign-off quoted into this file: **"it works great, lets proceed"** (2026-07-17, after the Result fix; round-1 reaction: "I am excited by having 5 characters in my party").

## Dev Notes

### The dossier is the spec — this story implements §1 (schema), §5 (the bump), §7 (names) verbatim

`docs/planning-artifacts/epic-4-dossier/DOSSIER.md` — signed off 2026-07-17. Do not re-litigate decisions there; if implementation reveals a design hole, STOP and surface it (AD-15 makes union mistakes near-permanent).

### The one thing this story must NOT do

**No dodge/crit draws.** ADR 0003's A3/A4 draws are story 4.6's. 4.2 emits `outcome: 'hit'` unconditionally and consumes ZERO new battle-stream draws — the only stream changes are the two new `names/*` labels (which don't touch `battle`). Adding the draws early would ship half of a frozen table.

### Version choreography (AD-8/AD-15, exact)

ONE `logVersion` bump (3→4, Task 3) and ONE `balanceVersion` bump (2→3, Task 1) — land them in the same commit train. Every pre-era history entry then displays as non-replayable via the EXISTING `historyModel.ts:52` check. Goldens re-record ONCE at the end (Task 5), not per-task.

### Recon-verified coupling map (2026-07-17 — every site the budget touches)

- Engine: `balance.ts:32,87` (armySize — DELETE), `validate.ts:76,79` (size check), `ai.ts:18-27` (3-TUPLES — the biggest engine coupling) + all 10 archetypes `:59-160`.
- Engine tests: `arbitraries.ts:14,17`, `balance.test.ts:84` (armySize=3 hard pin), `:85` (cap=5 hard pin), `ai.test.ts:26-35`, `golden.test.ts` (8 inline 3-unit armies; #7 probes the cap), `events.test.ts:6-7` (LOG_VERSION=3 hard pin), `rng.test.ts:27` (closed-set literal), `balance-hash.test.ts:12-15` (hash map), `sim.test.ts:144,171-177` (both-mode bands).
- Web: `draftModel.ts:34,39`, `MatchFlow.ts:134,182` (all BALANCE-derived ✓), `storage.ts:51` (**THE CATCH**), `DraftScene.ts:121,130-132`, `PlacementScene.ts:114-118` (**hardcoded 3 + overflow**), `constants.ts:147,150` (literal "3" copy), `match-flow.test.ts:66-67` (3-pins).
- Emission sites: `resolve.ts:76-81` (StatusCleared), `:98` (PassStarted), `:315` (UnitAttacked — single site, called from act/misfire).
- Copy that self-updates: `HomeScene.ts:143` (cap hint), `MatchFlow.ts:183` (commit error). Copy that does NOT: the two constants above, `docs/rules.md` ("after 5 engagements" — the drift guard test will fail until fixed, by design).

### MatchFlow patterns to mirror, not reinvent

`rollNextElement` (`MatchFlow.ts:262-268`) is the exact template for `rollNextName`: reconstruct the stream from seed, fast-forward by counter, draw once, bump. Forward-only on removal is the 1.8 determinism decision — same for names. `startReplay` hydration (`:100-121`) shows every counter that needs a names twin.

### Name-table authoring guidance (dossier §7)

OB64-adjacent fantasy register, gender-matched (D-1f): male table serves knight/mercenary/mage(Wizard), female serves archer/cleric/witch. ~48 per list keeps repeats rare in a 5-unit army with dedup. Golem/construct names arrive with 4.8 — but shape `CLASS_SEX`/tables so a third list slots in. Names are FLAVOR: no gameplay effect, not in the balance hash, and Danilo vetoes register on device — make them easy to edit (plain arrays, doc comment saying edits are free).

### Architecture compliance checklist

- AD-1: `slotTotal` is the ONLY legality arithmetic; grep `army.length` after Task 6 and justify every survivor (parallelism/iteration = fine; legality = bug).
- AD-6: chooseSetup's signature is UNTOUCHED this story (no tactic/leader/name params — 4.4/4.5 extend it); MatchFlow rolls all names.
- AD-9: rolled-once names stored in setup; leader-clearing hook lands with the interim default.
- AD-15: the union lands COMPLETE (all four new members + three field extensions) even though two members stay unemitted — that is the point.
- The engine stays pure: names.ts is data + pure function, no I/O.

### Previous-story intelligence

- 4.0: the house device-session flow (deploy → Danilo checks → quote verbatim); spine tokens govern new card text; verify-before-fixing (the wheel-scroll false positive).
- 4.1: the dossier decisions carry PO authority — cite D-numbers in code comments where a choice looks arbitrary (e.g. `// D-1d: display rename only`).
- 3.x: `?perf=1` sampler available if the 5-unit battle scene feels heavier; the puppeteer drive recipe for screenshot checks (rebuild per session, never commit).

### Project Structure Notes

- NEW: `packages/engine/src/names.ts` (+ its test file), possibly `slots.ts`.
- MODIFIED (engine): `types.ts`, `balance.ts`, `validate.ts`, `resolve.ts`, `rng.ts`, `ai.ts`, `index.ts` + tests: `balance`, `balance-hash`, `validate`, `events`, `resolve`, `rng`, `ai`, `sim`, `golden`, `arbitraries`, `wipeout`.
- MODIFIED (web): `flow/MatchFlow.ts`, `flow/storage.ts`, `flow/narration.ts`, `scenes/DraftScene.ts`, `scenes/PlacementScene.ts`, `scenes/RevealScene.ts`, `scenes/BattleScene.ts`, `config/constants.ts` + tests: `match-flow`, `storage`, `narration`, `draft-model`, `constants`.
- MODIFIED (docs): `docs/rules.md`, `deferred-work.md` (close the 2.2 StatusCleared item), sprint tracking.

### References

- [Source: docs/planning-artifacts/epics.md#Story-4.2] — the seven AC blocks
- [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md §1, §5, §7 + decision log] — the signed-off design this story implements
- [Source: docs/adr/0003-battle-stream-draw-order.md] — what NOT to implement yet (A3/A4 are 4.6's)
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-1,AD-6,AD-8,AD-9,AD-10,AD-15]
- [Source: packages/engine/src/types.ts (fully mapped); balance.ts; validate.ts:52-119; resolve.ts:76-81,98,315; rng.ts:13,56-68; ai.ts:18-27,59-160]
- [Source: apps/web/src/flow/MatchFlow.ts:82-268; storage.ts:43-80,145; historyModel.ts:52]
- [Source: docs/implementation-artifacts/4-0/4-1 story files] — device-session and dossier-authority precedents

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — main agent + four parallel subagents for the hand-crafted engine-test migrations (combat, roster, confusion, wipeout).

### Implementation Plan

Tasks executed in story order. Engine schema first (Tasks 1–3: slot schema → MatchSetup/names/streams → the v4 union, red-green per task), then the AI pool re-tuning (Task 4), then the test-fixture re-authoring fan-out (Task 5, four files delegated to parallel subagents with engine-semantics briefs while resolve/types/golden were re-derived in the main line), then flow + shell (Tasks 6–7), then the gate (Task 8).

### Debug Log References

- Pool re-tuning (Task 4): the 5-unit meta broke the band hard on the naive extension (three-mages 86.5% single, gale 70.6% wipeout, wardens 13% doormat). Matchup-matrix probing exposed the mechanics — a 140hp front knight absorbs an entire engagement of melee (single mode is a ranged damage race), back-row casters double their actions, spread formations starve the blast. Hand-tuning was whack-a-mole, so a deterministic hill-climb + local exhaustive refinement over ~40 identity-preserving variants found a zero-violation pool: converged (runs=200) single 30.9–62.3% (top cabal), wipeout 24.8–62.8% (top wardens). Scratchpad scripts: pool-probe/pool-search/pool-refine (not committed).
- Golden re-derivation: all eight probed via a scratch trace script; #1/#6/#7 verdicts matched wipeout.test.ts's independent hand-derivations exactly (99/77 · 64/0@4 engagements · 98/77@cap 10) — the cross-check that pins them.

### Completion Notes List

- **AC1 (slot vocabulary):** `armySize` deleted; `slotBudget: 5` + per-class `sizeClass` + `SLOT_COST` + `slotTotal()` shipped; `validate.ts` legality is `wrong-slot-total`; every legality site (validate, MatchFlow.draftUnit/commit, draftModel.canAddUnit/canContinue, ai.test pool check) uses slot arithmetic. `army.length` survivors audited: parallelism/iteration only.
- **AC2 (MatchSetup extension):** `tactics`/`leaders`/`Unit.name` landed with `ALL_TACTICS` (house const-array pattern); anchor-cell semantics documented on `Placement`; leader-clearing hook shipped as `MatchState.playerLeader` (null until 4.5's picker, cleared on every army mutation, commit maps null → 0); `MatchFlow` commits explicit `autonomous` + leader 0 for both sides.
- **AC3 (names):** `names/A`/`names/B` joined the closed stream set (rng.test pin updated — the sanctioned process); `names.ts` ships ~48 male + ~48 female OB64-adjacent names OUTSIDE the balance hash, `CLASS_SEX` per D-1f, and `rollName` (ONE draw + deterministic forward-advance dedup, property-tested). MatchFlow rolls names for BOTH sides (AI included — never chooseSetup, AD-6). Narration upgraded to "Kain (KNI)"; placement cards + reveal boards show the name under the code; the board keeps codes. **Deviation (recorded):** the flow's fast-forward counter is `nameRolls: UnitClass[]` (the class of each past draw) rather than the story's bare `namesRolled` count — a name draw's bounds come from the class's sex-keyed table, so a bare count breaks bit-identical replay the day 4.8's construct table has a different length. Dedup replay is exact because dedup never consumes draws.
- **AC4 (THE BUMP):** `LOG_VERSION` 3→4 exactly once, COMPLETE per dossier §5: `UnitAttacked.kind` + per-target `outcome` (+`redirectedFrom?`), `PassStarted.actionsRemaining`, `GuardRaised`, `GuardEnded`, `StatusCleared`, `LeaderFell`. Emitted now: `kind`, unconditional `outcome:'hit'`, `actionsRemaining`, `StatusCleared` (at seams, living units, never poison). Guard/LeaderFell sit unemitted for 4.7/4.5; narration + BattleScene carry their arms already (TS exhaustiveness), so those stories only touch the engine. **No dodge/crit draws** — verified: zero new battle-stream draws (engagement-1 logs bit-identical to single mode still holds in wipeout.test).
- **AC5 (cap 10):** `engagementCap` 10, `balanceVersion` 2→3 with hash re-pin (`b67d0f84`), Home hint auto-derives, `docs/rules.md` re-worded (drift guard green), goldens re-recorded once at the end.
- **AC6 (the phone):** Draft/Placement re-worked to five 64px slots (352px in the 360 base, ≥44px tap targets); the per-card removal hint became one shared line; AI plays the re-authored 5-slot pool; **THE STORAGE CATCH fixed** — `isRenderableArmy` is now display tolerance (1..slotBudget), regression-tested with a stored pre-era 3-unit nameless v2 entry that must load (and did silently vanish before the fix). Device confirmation of the full loop + non-replayable display is Task 8's session.
- **AC7 (tests):** all engine suites re-authored for 5-slot armies — determinism/termination/judging-symmetry properties over new arbitraries (names/tactics/leaders included), 8 goldens re-recorded ONCE with scenario intent preserved, both-mode sweep inside the ≤65% band with the re-tuned pool. Wardens note for 4.12 (the 3.0 melee-floor input): 30.9% single / 62.8% wipeout — melee is wipeout-viable; single mode is structurally a ranged damage race.
- Pool doc comment records the 4.2 meta lessons; `sim/sweep.ts` builds armies exactly as MatchFlow does (elements + names per unit).
- deferred-work.md: the 2.2 StatusCleared item CLOSED (the sanctioned AD-2 exception is dead — `clearStatusIconsExceptPoison()` deleted).
- **Device session round 1 (Danilo, 2026-07-17):** names on cards approved ("i liked that we displayed the names, and on the battle we hide it"); "I am excited by having 5 characters in my party". One DEFECT caught: the Result screen's composition chips were still 3-unit-era 104px cards (5 × 104 + gaps = 560px — off the 360 base; the recon missed this coupling site) — FIXED same session: compact 64px chips matching the tray card language, soldier name included, element word dropped for the dot. Two PO wishes logged to deferred-work.md, NOT self-scoped: (1) hide board class codes and identify by sprite — flagged as a UX-spine conflict (dossier §7 / FR39f board-code treatment) needing an amendment decision; (2) a Result battle-stats summary (damage/blocks/status/heals, total + per char) — future, log-derivable shell work.

### File List

NEW:
- packages/engine/src/names.ts
- packages/engine/test/names.test.ts
- docs/implementation-artifacts/4-2-the-era-turnover-five-slot-armies-and-named-soldiers.md (this story file)

MODIFIED (engine):
- packages/engine/src/types.ts
- packages/engine/src/balance.ts
- packages/engine/src/validate.ts
- packages/engine/src/resolve.ts
- packages/engine/src/rng.ts
- packages/engine/src/ai.ts
- packages/engine/src/index.ts
- packages/engine/sim/sweep.ts
- packages/engine/test/arbitraries.ts
- packages/engine/test/balance.test.ts
- packages/engine/test/balance-hash.test.ts
- packages/engine/test/validate.test.ts
- packages/engine/test/events.test.ts
- packages/engine/test/resolve.test.ts
- packages/engine/test/rng.test.ts
- packages/engine/test/ai.test.ts
- packages/engine/test/sim.test.ts
- packages/engine/test/golden.test.ts
- packages/engine/test/__snapshots__/golden.test.ts.snap (re-recorded once)
- packages/engine/test/combat.test.ts
- packages/engine/test/confusion.test.ts
- packages/engine/test/roster.test.ts
- packages/engine/test/wipeout.test.ts
- packages/engine/test/types.test.ts
- packages/engine/test/purity.test.ts

MODIFIED (web):
- apps/web/src/scenes/ResultScene.ts (device-session fix: compact 5-unit chips + names)
- apps/web/src/flow/MatchFlow.ts
- apps/web/src/flow/MatchState.ts
- apps/web/src/flow/storage.ts
- apps/web/src/flow/narration.ts
- apps/web/src/flow/draftModel.ts
- apps/web/src/scenes/DraftScene.ts
- apps/web/src/scenes/PlacementScene.ts
- apps/web/src/scenes/RevealScene.ts
- apps/web/src/scenes/BattleScene.ts
- apps/web/src/config/constants.ts
- apps/web/test/match-flow.test.ts
- apps/web/test/storage.test.ts
- apps/web/test/narration.test.ts
- apps/web/test/history-model.test.ts
- apps/web/test/draft-model.test.ts
- apps/web/test/battle-view.test.ts

MODIFIED (docs):
- docs/rules.md
- README.md
- docs/implementation-artifacts/deferred-work.md (closed the 2.2 StatusCleared item)
- docs/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-07-17 — Device-session fix: ResultScene composition chips re-worked from 104px 3-unit-era cards (560px overflow at five units) to the compact 64px tray-card language, with the soldier name on the chip. Two PO wishes from the same session logged to deferred-work.md (board-code removal — UX-spine conflict flagged; Result battle-stats summary).
- 2026-07-17 — Story 4.2 implementation: the era turnover. ONE logVersion bump (3→4, complete union per dossier §5) + ONE balanceVersion bump (2→3: slotBudget 5, sizeClass, engagementCap 10). Names (FR37) via new `names/A|B` streams + engine `names.ts` (outside the balance hash). STRATEGY_POOL re-authored + re-tuned for the 5-unit meta (both-mode ≤65% band re-verified). Pre-era history display-tolerance fix (the storage catch). Shell reworked for five slots; names on placement/reveal cards and in narration; status-icon clears are log-driven.
