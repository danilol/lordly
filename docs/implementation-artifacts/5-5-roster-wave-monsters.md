---
baseline_commit: 052b6431810936e90d39b43db325af80249691c6
---

# Story 5.5: Roster wave — monsters

Status: done

## Story

As a player,
I want the dossier's new monsters looming on the board with their slayers ready,
so that monster armies become a real strategic axis before PvP.

## Acceptance Criteria

1. **Monsters land as data on the shipped model.** Given the 5.1 dossier, when the wave lands, each new monster reuses the single-cell + king-move reservation model with its dossier slot cost (the Whelp is a 1-slot SMALL with no ring — E5-P3), joins the loom rendering with a size-appropriate scale, and the dossier-paired slayer counterplay goes LIVE (the Dragon Hunter's dragonslayer→dragon ×1.5 relation gains its first defenders).
2. **Placement legality and the AI hold at monster scale.** Given placement and the AI, when monsters grow in number, the bannedCells/toAnchor legality path holds for every new monster with tests pinning the dossier's reservation examples, the humans-only leader rule (E5-D13) is enforced end-to-end (engine validation, draft gating, crown UI, AI leader draw), and the AI pool gains monster archetypes shaped by the 4.8 lesson (archetype SHAPE over stat tweaks).
3. **Balance discipline holds.** Given AD-8 discipline and NFR4, when the wave ships, `balanceVersion` ticks with hash re-pin, monster-free battles replay bit-identically (regression pin: every golden byte-identical this time — no shipped-class revision in this wave), and the both-mode sweep converges ≤65% with the wardens-style floors re-checked.

## Tasks / Subtasks

- [x] Task 1: Widen the unions + the `race` field, typecheck GREEN first (AC: 1)
  - [x] `ALL_CLASSES` + 10: `gryphon`, `wyrm`, `hellhound`, `whelp`, `emberdrake`, `frostfang`, `stormscale`, `cragmaw`, `nightwing`, `halowing` (flat single-word keys, the 5.4 convention). Roster goes 17 → **27**.
  - [x] `MoveKind` + `breath` (E5-D7). The 5.4 move-driven dispatch made this a COMPILE ERROR in `act()`'s inner switch (exhaustive over `RowMove`, no default) — by design; the error is your worklist.
  - [x] NEW `race` field on `ClassStats` (E5-D13): `'human' | 'golem' | 'beast' | 'dragon'` — per-class balance data like `sizeClass`, so it rides the content hash. All 17 existing classes get `human` except golem → `golem`.
  - [x] `NameSex` gains `'b'` (beast designations) and `'d'` (dragon names) — the Golem construct-list precedent (dossier §7 downstream note).
  - [x] Run `pnpm typecheck` NOW. Known sites: the 5.4 list again — `BALANCE.classes`, `CLASS_SEX`, `UNIT_FRAMES`, `CLASS_ABBREVIATIONS`, `CLASS_DISPLAY_NAME`, `CLASS_TEXT`, `TRACE_TRAVEL` (breath), `MOVE_PLATE_NAMES` (breath), roster.test's FROZEN_TABLE, plus every place `race` must be populated.
- [x] Task 2: Balance data + version (AC: 1, 3)
  - [x] Copy ROSTER.md's approved engine rows verbatim (E5-D15): Whelp 130/26/22/4/10/8/10 small·dragon; Gryphon 220 (AGI 26, back `arrow` — Wind Shot, E5-D14); Wyrm 240 (bites 2/2/1 — the mid-row monster); Hellhound 220 (front Bite **×3** — the game's first 3-action row); Emberdrake 270/STR 34; Frostfang 265/MEN 18; Stormscale 260; Cragmaw 290/VIT 30; Nightwing 265; Halowing 270. All `sizeClass: 'monster'` except the Whelp; roles: Gryphon/Wyrm/Hellhound `beast`, the rest `dragon`. Moves: bites/claws = `slash` (display verbs), dragons' back row = `breath` ×1.
  - [x] `balanceVersion` 10 → 11 + hash re-pin (the two-step).
  - [x] Verify the monster cap semantics: `MAX_MONSTERS_PER_ARMY` counts `sizeClass === 'monster'` — the Whelp (small) correctly does NOT count (E5-D13). Pin it.
- [x] Task 3: `breath` — PHYSICAL row-AoE, ZERO draws (AC: 1, 3)
  - [x] Shape: the blast branch's targeting (fullest row, tie rearmost, D-2c leader-row interaction) with PHYSICAL arithmetic — `str` vs `vit` — and NO roll (ADR 0003: draws exist only on single-target physical hits; pin with the 5.4 all-bolt-style discriminator). New `breathDamage` beside `blastDamage`.
  - [x] The wipeout cross-engagement attenuation MUST apply to breath too (ROSTER.md kill-audit carry: "the blast rule applies to `breath`").
  - [x] DECIDE + record: does the leader-fall sober package cut breath damage? Recommendation: YES — the penalty's rule is "physical only" and breath is physical; Guard/crit/dodge stay out (they gate on the single-target roll, which breath never has). State the composed order in the code comment.
  - [x] Misfire (confused dragon, back row): row-consistent principle → breathes on its OWN fullest row (the self-blast branch shape, physical damage, A1-only draw). Record the decision; re-probe confusion pins if touched.
- [x] Task 4: The humans-only leader rule, end-to-end (AC: 2 — E5-D13)
  - [x] `validate.ts`: generalize `monster-cannot-lead` → race-based (only `race: 'human'` may be crowned — the Whelp is small but a dragon, and must be rejected). An all-monster army has NO legal leader index → always invalid; consider a distinct `no-human-leader` code if the error message earns it.
  - [x] Draft gating: `canContinue` additionally requires ≥1 human (Danilo's examples pinned: Golem+Emberdrake+Whelp INVALID; Golem+Emberdrake+Knight ✓; Golem+Whelp+Knight+Cleric ✓). Surface the reason in the Draft UI (the hint line) so the player isn't silently stuck.
  - [x] PlacementScene crown UI: gate crowning on race (today it gates on sizeClass — the Whelp would wrongly be crownable).
  - [x] `ai.ts` `chooseSetup`: `eligibleLeaderIndices` becomes race-based; every pool archetype must contain ≥1 human (add the ai.test guard).
- [x] Task 5: Names (AC: 1)
  - [x] `CLASS_SEX`: beasts → `'b'`, dragons (incl. Whelp) → `'d'`. New `BEAST_NAMES` + `DRAGON_NAMES` lists (~16+ each, original register — the dossier descriptions set the tone); wire into `NAME_TABLES`. Margin math in the record (worst case: 2 monsters + …).
- [x] Task 6: THE DRAFT PICKER — 27 classes do NOT fit one grid (AC: 2)
  - [x] **Measured (recon 2026-07-28):** the 5.4 grid (5×62×50, bottom 306 at 17) needs 6 rows for 27 → bottom **418**, deep into DRAFT_DETAIL at 310. Even 7 columns of 44px-floor tiles can't carry readable names. One grid is ARITHMETICALLY out.
  - [x] **Danilo's decision: TABS — APPROVED 2026-07-28 (dev-story go-ahead after the tabs recommendation; Nightwing rename confirmed final).** Recommended shape: a two-tab strip (Humans 17 / Monsters 10) above the grid — each tab reuses the EXACT 5.4 grid geometry (humans fill it; monsters take 2 rows), preserving the 4.3 icon-grid device decision. Tab state resets in `create()` (singleton scenes).
  - [x] Keep `draft-grid.test.ts` honest: the bound becomes per-tab (max tab count ≤ 20 fits the geometry), plus a test that every class is reachable through exactly one tab.
- [x] Task 7: The rest of the shell (AC: 1, 2)
  - [x] Codes (GRY WYR HEL WHP EMB FRF STM CRG NGT HAL), display names, CLASS_TEXT prose (dossier showcase column), `CLASS_MOVE_NAMES` verbs: Bite (wyrm/hellhound/whelp/dragons' melee), Claw (gryphon), Wind Shot (gryphon arrow), Ember/Frost/Storm/Acid/Dread/Radiant Breath per dragon; `MOVE_PLATE_NAMES.breath` generic fallback ("Breath").
  - [x] `TRACE_TRAVEL.breath = 'projectile'` + the BattleScene color switch (actor fill, like blast/bolt) + the blast-style row wash? Check `blastWash` — decide whether breath reuses it (recommended: yes, it is the row-AoE read).
  - [x] Interim sprites: all 10 share the Golem tile (frame 6) with INTERIM attribution notes; the Whelp renders small (no loom — `unitDisplaySize` keys on sizeClass, automatic).
  - [x] Coupling-site sweep: army SIZE still 5 slots — but monster comps are SHORTER armies (3–4 units); that was true since 4.8, so comp-rendering scenes are already exercised. State it after checking.
  - [x] rules.md: 27-row table, monster section grows (Whelp exception, humans-only crown, breath), roles list + speed order re-cut. The drift guards will hold your hand.
- [x] Task 8: Placement + AI pool + sweep (AC: 2, 3)
  - [x] Placement legality is DATA-driven (sizeClass) — pin the dossier's reservation examples for a non-Golem monster (a dragon dead-center blocks the board; corner blocks 3) + the Whelp placing freely beside anyone.
  - [x] AI pool: monster archetypes by SHAPE (the 4.8 lesson) — e.g. a dragon-wall comp, a beast-rush comp, a whelp-swarm; every comp keeps ≥1 human (E5-D13); all 27 classes covered (the 4.12 guard). Expect the pool to grow past 12 entries — watch the sim CI runtime (n² pairings) and re-pin the proxy baseSeed if the sample moves (the 5.4 precedent).
  - [x] Sweep both modes, converge ≤65% at runs=500 before certifying (the 5.1 lesson). Watch: longbows entered this story at 64.9% wipeout (the 5.4 edge flag); the Dragon Hunter's live hunt and 7 dragon-role classes reshape everything.
  - [x] Regression pin: ALL existing goldens byte-identical (checksum method from 5.4) — this wave revises NO shipped class.
- [x] Task 9: Docs + gate (AC: 1, 2, 3)
  - [x] NO `logVersion` change (dossier §4 confirmed: `breath` rides `UnitAttacked.kind`; `race` is balance data).
  - [x] Full gate: typecheck, lint, coverage (engine ≥90%), web build.
  - [x] Device pass with Danilo — **ACCEPTED 2026-07-28 ("I liked what i see")**, including the picker re-lay (4 columns of 80px tiles instead of 5 of 62px).

### Review Findings (senior code review 2026-07-28 — Fable 5, 3 adversarial layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor)

- [x] [Review][Patch] MEDIUM: rules.md Melee/Ranged bullets enumerate classes and omit the whole wave — no monster biter in the Melee list, no Gryphon Wind Shot in the Ranged list [docs/rules.md:76-77]
- [x] [Review][Patch] MEDIUM: the draft gate (`hasHuman`, `draftBlockReason`, `canContinue`'s human clause) has ZERO tests at its own layer — deleting the clause fails nothing [apps/web/test/draft-model.test.ts]
- [x] [Review][Patch] MEDIUM: DOSSIER.md still asserts the falsified "never same column" rule TWICE (E5-D13 row + §3) — the decision record now contradicts both the code and the corrected ROSTER.md [docs/planning-artifacts/epic-5-dossier/DOSSIER.md]
- [x] [Review][Patch] MEDIUM: Nightwing's prose "Hits hardest of the dragons" is false — Emberdrake ships STR 34 vs 32; wrong in two player surfaces [apps/web/src/flow/draftModel.ts:75, docs/rules.md:38]
- [x] [Review][Patch] MEDIUM: Dev Agent Record claim "every monster comp that ships carries a witch or no support at all" is false — 4 of 6 ship clerics; the ai.ts "healer = red flag" comment overstates the same finding [story record + packages/engine/src/ai.ts]
- [x] [Review][Patch] MEDIUM: `chooseSetup` throws an opaque `nextInt` RangeError for a human-less pool archetype — only STRATEGY_POOL is test-guarded, not the parameter (the empty-pool/invalid-col guards set the house precedent) [packages/engine/src/ai.ts:~518]
- [x] [Review][Patch] MEDIUM: ai.test's FR25 bound was widened to ≤20, pre-authorizing growth past the unratified 18 — pin exactly 18 so the next comp goes through the same ratification conversation [packages/engine/test/ai.test.ts:19]
- [x] [Review][Patch] LOW: ai.ts pool banner says "the monster wave's five comps"; six follow [packages/engine/src/ai.ts:~346]
- [x] [Review][Patch] LOW: `DraftTabId` docstring still claims "EXACT 5.4 grid geometry" and cites y=418 — stale against the shipped 4×80×48 re-lay; Task 6's checked text (Humans 17 / Monsters 10) also needs a shipped-deviation note (16/11 on race — the Golem is a monster-tab creature) [apps/web/src/flow/draftModel.ts:80 + story Task 6]
- [x] [Review][Patch] LOW: tab tap width is label-dependent (`Math.max(label.width + 24, tapW)` — "MONSTERS" ≈107px) while the overlap test pins tapW=88 only; the "88px targets never touch" comment is already wrong [apps/web/src/scenes/DraftScene.ts:167 + draft-grid.test.ts]
- [x] [Review][Patch] LOW: tab hit zone top (y=54) grazes the hint line's bottom (~55.5) by ~1.5px and nothing pins the clearance (verified: the hint is single-line, not the wrapped band the reviewers assumed) [DraftScene.ts + constants.ts]
- [x] [Review][Patch] LOW: `draftBlockReason`'s string fit is unpinned — single-line today (~293px < 336), but two lines would touch the Continue button top at y=516 [apps/web/src/flow/draftModel.ts + test]
- [x] [Review][Patch] LOW: validate.test "a THIRD sizeClass-monster is still capped…" proves neither claim — the body only asserts two slotTotal values; retitle to what it pins [packages/engine/test/validate.test.ts]
- [x] [Review][Patch] LOW: story File List omits ROSTER.md, which this diff modifies [story record]
- [x] [Review][Patch] LOW: resolve.ts copy-paste: breath act/misfire branches duplicate the blast targeting blocks; `leaderPenaltyBreath` duplicates `leaderPenaltyPhysical`'s body — extract before the anticipated Archmage AoE copies all three again [packages/engine/src/resolve.ts]
- [x] [Review][Patch] LOW: roster.test FR35 wired-proof windows are seed-fragile — a breath landing between the two leader falls (dealt-unpenalized, taken ×5/4 = 22) lands in the "before" set; anchor the before-window to the FIRST fall [packages/engine/test/roster.test.ts]
- [x] [Review][Patch] LOW: tab pointerup synchronously destroys its own dispatching interactive rect via buildGrid() — a known Phaser hazard; defer the rebuild one tick [apps/web/src/scenes/DraftScene.ts:169]
- [x] [Review][Patch] LOW: Gryphon CLASS_TEXT says "fires Wind Shot" with no target rule while Vultan/Raven state "at the rearmost enemy" — same mechanic, inconsistent prose (rules.md row synced by drift guard) [apps/web/src/flow/draftModel.ts:64]
- [x] [Review][Patch] LOW: deferred-work files the RESOLVED ROSTER correction under the "PRD deviation for the PO to ratify" heading, muddying what the PO still owes; ai.test comment writes the draw range as "[0,17)" once and "[0,17]" once [deferred-work.md + ai.test.ts]
- [x] [Review][Patch] LOW: the engine barrel omits BEAST_NAMES/DRAGON_NAMES while every sibling name table is exported (AD-4) [packages/engine/src/index.ts:44]
- [x] [Review][Patch] LOW: draftModel comment counts "the 8 row-varying monsters (Gryphon + the six breath dragons)" — that is 7 [apps/web/src/flow/draftModel.ts:61]
- [x] [Review][Patch] LOW: Dev Agent Record says "682 tests" twice; the reviewed tree runs 684 (recount after patches) [story record]
- [x] [Review][Patch] LOW: ROSTER.md's Nightwing row still carries 🟡 "(was Duskwing)" though the story records the rename as confirmed final [docs/planning-artifacts/epic-5-dossier/ROSTER.md:86]
- [x] [Review][Defer] Scene-level coverage for the tab strip (rebuild path, double-tap reset, selection migration on switch) [apps/web/src/scenes/DraftScene.ts] — deferred, pre-existing: needs the Phaser mock harness the 5.2 review already recorded as its own tooling story (addButton has the same gap)

**Dismissed as noise (2):** names.test's "worst case over single classes" undercount is unreachable — the monster cap keys on `sizeClass === 'monster'`, which is exactly the 2-slot class, so no mix can out-draw the best single class; DraftScene's empty-tab `classes[0]` cast is pinned unreachable by draft-grid.test's "no tab is empty" model-level assertion.

**Independently re-verified by the Acceptance Auditor (worth recording):** all ten stat rows match ROSTER.md verbatim; hash `7a76b29f` pins; golden snapshot md5 byte-identical to baseline `052b643`; the runs=500 seed-1 sweeps reproduce exactly (single max 64.3% twin-golems, wipeout max 63.8% longbows); E5-D6/D7/D13/D14/P3/P4 and no-logVersion all honored.

## Dev Notes

### The dossier IS the spec

`ROSTER.md` §Monsters (normative table + engine rows, all ✅ except Nightwing's row marked 🟡 — CONFIRM the rename stands, then treat as approved) and `DOSSIER.md` E5-D6 (elements are FLAVOR only — a dragon's "ice/storm/dark/light" is breath naming, never engine data; units still roll the four engine elements), E5-D7 (breath physical, zero draws), E5-D13 (humans-only crown, Whelp exempt from the monster cap but NOT crownable), E5-D14 (Gryphon's Wind Shot rides `arrow`), E5-P3 (Whelp 1-slot small, no ring), E5-P4 (ONE Golem this era — no tiers).

### What 5.4 already built for you

- The move-driven `act()`/`misfire()` dispatch: `breath` is a compile error until you add its branch — add it beside `blast` (same targeting, physical damage function, no roll). The misfire dispatch has the self-row branch shape ready to generalize.
- `CLASS_MOVE_NAMES` + class-aware `moveLabel`/`moveDisplayName`: the per-dragon breath names are entries, not new seams.
- `DRAFT_GRID`/`DRAFT_DETAIL` as pure tested geometry: the tab work changes the SCENE, not the arithmetic.
- The golden byte-identity checksum method (5.4 Dev Agent Record) — this story's regression pin is that, applied to ALL goldens.
- The sweep discipline: converged runs=500 both modes is the certification; the CI config is a re-pinnable deterministic proxy (baseSeed 21 today).

### Engine surfaces (5.4-current)

`types.ts` ALL_CLASSES/ALL_ROLES/MoveKind; `balance.ts` classes/roleRelations/version 10 (hash 7d0a6a4e); `resolve.ts` act() inner switch (exhaustive over RowMove), misfire() default branch, strike()'s optional-roll contract, blastDamage/magicDamage; `validate.ts` 'monster-cannot-lead' + king-move 'adjacent-to-monster'; `ai.ts` chooseSetup eligibleLeaderIndices (sizeClass-based today — becomes race) + STRATEGY_POOL (12 entries); `names.ts` NAME_TABLES/CLASS_SEX; arbitraries.ts SMALL/MONSTER_CLASSES derive from data (the Whelp lands in SMALL_CLASSES automatically — check property-test weights, the 4.8 flake lesson).

### Testing standards

Engine ≥90% lines. New: breath suite (targeting, physical arithmetic incl. wipeout attenuation + leader-fall composition, zero-draw discriminator, misfire), race/leader validation suite (Danilo's three examples verbatim), placement reservation pins for a dragon, name-table margins, the all-goldens checksum pin. Web: tab-aware grid tests, crown-gating seam test if extractable.

### Project Structure Notes

MODIFIED (engine): types/balance/resolve/names/ai/validate + tests. MODIFIED (shell): constants, sprites, draftModel, DraftScene (tabs), PlacementScene (crown gate), BattleScene (breath trace), attribution. MODIFIED (docs): rules.md, this story, sprint-status. NOT modified: `units.png` (5.9), logVersion, the unit-data card (5.6).

### References

- [Source: docs/planning-artifacts/epics.md#Story-5.5] — the three AC blocks
- [Source: docs/planning-artifacts/epic-5-dossier/ROSTER.md §Monsters — wave 5.5 + §New monsters (5.5)] — THE normative tables
- [Source: docs/planning-artifacts/epic-5-dossier/DOSSIER.md E5-D6/D7/D13/D14/P3/P4 + §4 no-logVersion confirmation]
- [Source: docs/implementation-artifacts/5-4-roster-wave-humans.md#Dev-Agent-Record] — the seams, methods, and the longbows 64.9% wipeout edge flag
- [Source: recon 2026-07-28 — draft grid arithmetic (27 ∉ one grid), validate.ts leader path, arbitraries auto-derivation]

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M context) — `claude-opus-5[1m]`, via the BMad `dev-story` workflow.

### Debug Log References

Balance work ran through throwaway probe scripts under the job tmp dir (not committed): a
pool-legality/coverage checker, a per-comp candidate search, a joint farshot x twin-golems
search, and a CI-proxy seed scan over seeds 1-40. Every number quoted below is reproducible
from `pnpm --filter @lordly/engine exec tsx sim/run.ts --runs=500 --seed=<n> --mode=<mode>`.

### Completion Notes List

**AC1 - monsters as data.** All 10 land on the shipped model: `ALL_CLASSES` 17 -> 27, the nine
2-slot monsters reuse the Golem's single-cell + king-move-ring reservation, and the Whelp is a
1-slot `small` (E5-P3) that reserves nothing. Engine rows copied verbatim from ROSTER.md's
approved table (E5-D15) - no stat was invented or retuned. `breath` (E5-D7) is the blast's
targeting with physical STR-vs-VIT arithmetic, zero battle-stream draws, and the wipeout
attenuation applied (ROSTER.md's 5.5 carry). `balanceVersion` 10 -> 11, hash re-pinned
`7d0a6a4e` -> `7a76b29f`. The dragonslayer hunt is LIVE: it lands on all seven dragon-role
classes, Whelp included, and it reads through `breath` too (pinned).

**Breath decisions recorded (both were open questions in the story):**
- *Leader-fall cuts breath: YES.* Breath is physical, so the FR35 sober package applies via
  `leaderPenaltyBreath` (dealt x3/4 then taken x5/4, each floored, re-clamped last).
  Crit/dodge/Guard stay OUT - they gate on the single-target roll breath never makes. Composed
  order stated in the resolve.ts comment: base -> attenuation (wipeout) -> RPS -> Weaken ->
  clamp -> leader-fall dealt/taken -> re-clamp. Pinned both at the function level
  (damage.test.ts) and as wired behaviour in a real battle (roster.test.ts: 18 before the
  falls, 16 after).
- *Misfire: own fullest row, itself included.* Row-consistent with the self-blast shape;
  unlike the 5.4 bolt misfire (single-target, cannot hit the caster) a row-AoE misfire CAN.
  Probed pin at seed 1.

**Honest note on the Guard-vs-breath test.** A positive "a raised Guard does not halve a
breath" fixture is NOT constructible with shipped data: Guard is raised when its owner acts,
turn order is AGI-descending, every guard row belongs to a slow class (Phalanx 6, Knight 8)
and every breath dragon is faster (10-18), and guards clear at each engagement's end. So the
rule is pinned as an invariant instead - across 30 seeds x both modes, with guardians,
crit-heavy and dodge-heavy defenders present, every breath target outcome is a plain `hit`.
The reasoning is written into the test so a future reviewer doesn't mistake it for laziness.

**AC2 - legality, the crown, and the AI.** `monster-cannot-lead` became `leader-not-human`,
keyed on the new `race` field, and the rule is enforced end-to-end: engine validation, draft
gating (`canContinue` + a `draftBlockReason` hint line so a no-human army is never a silent
dead end), the Placement crown gesture, and the AI's leader draw. Danilo's three examples are
pinned verbatim. Placement reservations are proven per-`sizeClass`, not per-class: every one of
the ten monsters reserves the identical ring at every anchor, and the Whelp's anchors are
byte-identical to a Knight's.

**The Draft picker changed more than the story anticipated - flag for the device pass.** Tabs
were approved and shipped (Humans 16 / Monsters 11, split on race, state reset in `create()`).
But the tab strip is primary navigation, so its tap target has to clear FR30's 44px floor,
which pushed the grid's top from y=88 to y=98; and "Emberdrake"/"Stormscale" are 10 characters,
which the 5.4 62px tile could not hold (Phaser's word wrap never breaks inside a word, so the
11th character would simply hang outside the tile). Tabs cap the tallest grid at 16, which
bought back the vertical budget, so the grid went to **4 columns of 80px tiles** (tileH 50 ->
48) - roomier than 5.4's, and the row now centres exactly. Four rows end at y=308, 2px above
the detail panel. All of it is pinned per-tab in `draft-grid.test.ts`, including the tab
targets' size and separation. The active tab's underline is GOLD, not blue: blue/red are
side colours and a picker tab belongs to neither.

**AC3 - balance, and it was the heavy re-tune the story predicted.** First sweep of the naive
comps: `breath-battery` at 87.9% single. Three findings, all now written into ai.ts:
1. A monster in the BACK row, screened AND healed, is the most overtuned shape in the game - a
   breath dragon behind a knight with a cleric probed at 83.6% single / 76.6% wipeout. This is
   4.8's "sustain behind a wall" finding for the third time (Golem, beast-rush, breath-battery).
   *(Corrected at review 2026-07-28 — this note originally claimed "every monster comp that ships
   carries a witch or no support at all where a healer was tried," which misdescribes the pool:
   four of the six ship clerics in shapes the sweep certifies in-band. The precise finding is the
   COMBINATION — screened + back-row + healed; the two comps where a healer probe overtuned,
   breath-battery and beast-rush, took witches instead.)*
2. A monster in the MID row is a trap: one action a turn and a ring that swallows five cells
   (a mid-row dragon probed at 20.2%).
3. Beasts don't work in pairs (11.9-26.5%) - they work leading a human line.
Final pool: 18 archetypes (12 shipped + 6 monster comps: `breath-battery`, `dragon-wall`,
`wyrmhold`, `stormflight`, `beast-rush`, `skyclaw`), all 27 classes covered, every comp with
>=1 human. **Converged at runs=500, seeds 1/2/3, BOTH modes: single max twin-golems 64.3%,
wipeout max longbows 63.8%, pool floors 29.6% / 30.3%.** Two shipped comps were re-tuned:
`longbows`' cleric steps from the sheltered mid/center to the exposed front-left (66.2% ->
63.8% wipeout, single barely moves), and `farshot`'s second archer slides one column
mid/right -> mid/left (66.0% -> 62.5% wipeout, and single mode IMPROVES 37.5% -> 39.3%).
**That second change RETIRES story 4.12's accepted band widening** - farshot's 65.3% converged
wipeout rate was a live recorded deviation, and there is no accepted deviation left to carry.
`twin-golems` was NOT touched.

**CI proxy seed: baseSeed 21 STAYS.** The landscape moved (pool 12 -> 18 plus two re-tunes) but
21 re-verified clean and still sits mid-run: seeds 14-28 all sample in-band for both modes at
runs=15; 21 reads single max 60.9% / wipeout max 61.8%. Outside that window the proxy trips on
exactly the two comps that are the band's real ceiling, which is the proxy behaving correctly.

**Regression pin: every golden is byte-identical.** No shipped class was revised this wave, so
`golden.test.ts` passes with no `-u` and the snapshot file's md5 (`154f2428...`) matches HEAD
exactly. `LOG_VERSION` stays 4 (dossier section 4: `breath` rides `UnitAttacked.kind`, `race`
is balance data).

**Property-test arbitraries needed a fix (the 4.8 flake lesson, again).** Story 5.5 put the
first NON-human into `SMALL_CLASSES` - the Whelp - so "small" and "crownable" stopped being
the same set and generated setups started throwing `leader-not-human`. `arbitraries.ts` now
draws the first small from the humans only (guaranteeing a crownable unit by construction,
which costs no reachability since `smallCount` is always >=1) and draws the leader from the
human indices.

**Two things found that need Danilo, both logged to deferred-work.md rather than decided here:**
1. **The pool is 18; FR25 says "~8-12".** The growth is arithmetic (the 4.12 reverse-coverage
   guard + 2-slot monsters), FR25's intent is exceeded rather than weakened, and the sweep
   still runs well inside budget - but it IS a PRD bound crossed, so it is flagged for
   ratification with the two alternatives spelled out. The `ai.test.ts` bound was widened
   12 -> 20 with the reasoning attached, not deleted.
2. **ROSTER.md states a consequence that cannot occur.** "A 2-monster + Whelp army is legal, if
   a human leader is aboard" is 2+2+1 = 5 slots with no room for the human, so it can never
   validate. The RULE it illustrates is implemented exactly as decided (the Whelp does not
   consume a monster-cap slot); only the illustration is unreachable. Pinned in
   `validate.test.ts` so the distinction stays deliberate; worth a one-line ROSTER.md fix.

**Interim art (the Lordly art-story split).** All ten monsters share the Golem tile (frame 6)
with INTERIM attribution notes - it is the only frame on the sheet that reads as a creature.
The Whelp shares it too but renders SMALL automatically (`unitDisplaySize` keys on sizeClass),
so it gets no loom. Dedicated tiles are story 5.9's.

**Coupling-site sweep (the army-row lesson).** Checked, and the blast radius was smaller than
feared: `DRAFT_GRID` is read by DraftScene ALONE, so the re-lay is contained. Army SIZE is
still 5 slots and monster comps have been 3-4-unit armies since 4.8, so the comp-rendering
scenes (Battle/Reveal/Result/History/Placement) were already exercised on short armies and
needed no change. What DID need per-scene attention was the new `breath` kind: BattleScene's
`TRACE_TRAVEL` (projectile), its actor-colour switch, and the blast-style row wash all had to
learn it, and each is an exhaustive switch that failed to compile until they did.

**Gate (post-review figures — the dev-pass note said 682/97.62%):** typecheck, lint (+ prettier),
coverage (689 tests, engine 99.06% lines vs the 90% gate), and the web production build - all green. **REMAINING: Danilo's device pass**, and the
picker re-lay above is the thing to look at hardest.

### Change Log

- 2026-07-28: Story implemented end-to-end — 10 monster classes (17 -> 27), `breath`, the `race`
  field + humans-only crown, the tabbed Draft picker (with a 4x80 grid re-lay), `balanceVersion` 11,
  and a heavy pool re-tune (12 -> 18 archetypes, converged <=65% both modes at runs=500). Gate green
  (682 tests at dev close; 689 after the review patches — engine 99.06% lines, build). Status -> review.
  REMAINING: Danilo's device pass.
- 2026-07-28: Two items raised for Danilo rather than decided in-story, logged to deferred-work.md —
  the pool crossing FR25's "~8-12" bound, and ROSTER.md's unreachable 2-monster+Whelp illustration.
- 2026-07-28: Device pass ACCEPTED by Danilo ("I liked what i see") — all tasks closed. ROSTER.md's
  §Monster rules bullet corrected in the same pass: it carried TWO stale claims, and reviewing it
  turned up a second one the story had not caught — "monsters never share a column" is not a rule
  (front-left + back-left is legal; only king-adjacency is banned). Both corrections are now pinned
  in validate.test.ts. Story stays in review awaiting the code-review pass.

- 2026-07-28: SENIOR CODE REVIEW DONE (Fable 5 — a different model than the implementing Opus 5, per
  the workflow's own advice; 3 adversarial layers: Blind Hunter + Edge Case Hunter + Acceptance
  Auditor). 31 raw findings → 25 after cross-layer merge: 0 decision-needed, 23 patches ALL APPLIED,
  1 deferred (Draft-tab scene coverage — rides the 5.2 Phaser-harness tooling story), 2 dismissed.
  No shipping defect in the engine; the auditor independently re-verified stat rows, goldens, and
  the converged sweeps. Notable patches: `chooseSetup` now throws a clear error for a human-less
  pool archetype; the FR25 test bound is pinned at exactly 18 (no pre-authorized growth); the draft
  gate got its own web-layer suite (Danilo's three examples at the model level + the one-line
  block-reason budget); the tab tap zones got a width ceiling + hint-line clearance, both pinned;
  the tab rebuild is deferred one tick (Phaser destroy-mid-dispatch hazard); resolve.ts's three
  breath/blast duplications collapsed into shared case + one `leaderPenalty` factory — proven pure
  by the unchanged golden md5; rules.md's Melee/Ranged bullets now name the wave; DOSSIER.md's
  never-same-column claim struck in both spots; Nightwing's false "hits hardest" prose fixed in two
  surfaces and its ROSTER row 🟡 → ✅. Gate after patches: 689 tests, engine 99.06% lines,
  typecheck/lint/coverage/build green, goldens byte-identical. Story → done.

### File List

**Engine source**
- `packages/engine/src/types.ts` - `ALL_CLASSES` +10, `MoveKind` +`breath`, new `ALL_RACES`/`Race`
- `packages/engine/src/balance.ts` - the 10 monster rows, `race` on every class, version 11
- `packages/engine/src/resolve.ts` - the `breath` act/misfire branches, `breathDamage`, `leaderPenaltyBreath`
- `packages/engine/src/validate.ts` - `monster-cannot-lead` -> `leader-not-human` (race-keyed)
- `packages/engine/src/ai.ts` - race-based leader draw, 6 monster archetypes, longbows + farshot re-tunes
- `packages/engine/src/names.ts` - `NameSex` +`b`/`d`, `BEAST_NAMES`, `DRAGON_NAMES`, CLASS_SEX rows
- `packages/engine/src/index.ts` - export `ALL_RACES` + `Race` through the barrel (AD-4)

**Engine tests**
- `packages/engine/test/arbitraries.ts` - guarantee a human per generated side; race-based leader draw
- `packages/engine/test/balance-hash.test.ts` - version 11 hash pin
- `packages/engine/test/balance.test.ts` - monster-membership + race invariants
- `packages/engine/test/types.test.ts` - `ALL_CLASSES` order, `ALL_RACES`
- `packages/engine/test/validate.test.ts` - the E5-D13 suite, reservation pins per sizeClass
- `packages/engine/test/damage.test.ts` - `breathDamage` + `leaderPenaltyBreath` tables
- `packages/engine/test/roster.test.ts` - the breath integration suite, move-table rows
- `packages/engine/test/names.test.ts` - creature tables, derived dedup-margin rule
- `packages/engine/test/ai.test.ts` - pool bound, human-per-comp + human-leader guards, re-probed anchor
- `packages/engine/test/sim.test.ts` - re-verified seed note, retired 4.12 deviation note

**Web source**
- `apps/web/src/config/constants.ts` - codes, display names, `MOVE_PLATE_NAMES.breath`, `CLASS_MOVE_NAMES`, `DRAFT_GRID` re-lay, `DRAFT_TABS`
- `apps/web/src/config/sprites.ts` - the 10 interim frames
- `apps/web/src/flow/draftModel.ts` - tab model, `hasHuman`, `canContinue`, `draftBlockReason`, CLASS_TEXT rows
- `apps/web/src/flow/MatchFlow.ts` - race-based `setLeader` guard
- `apps/web/src/scenes/DraftScene.ts` - the tab strip + per-tab grid rebuild
- `apps/web/src/scenes/PlacementScene.ts` - crown-refusal message
- `apps/web/src/scenes/BattleScene.ts` - `breath` trace travel, colour, row wash
- `apps/web/src/assets/attribution.ts` - 10 INTERIM class-source notes

**Web tests**
- `apps/web/test/draft-grid.test.ts` - rewritten per-tab, plus tab-target geometry
- `apps/web/test/draft-model.test.ts`, `apps/web/test/constants.test.ts`, `apps/web/test/match-flow.test.ts`, `apps/web/test/rules-doc.test.ts`

**Docs**
- `docs/rules.md` - 27-row table, breath, rewritten Monsters section, roles list, speed order
- `docs/implementation-artifacts/deferred-work.md` - the FR25 deviation + the ROSTER.md note
- `docs/planning-artifacts/epic-5-dossier/ROSTER.md` - §Monster rules corrected (unreachable example + the no-column-rule claim) + Nightwing 🟡 → ✅ (review)
- `docs/planning-artifacts/epic-5-dossier/DOSSIER.md` - the same never-same-column claim struck in E5-D13 + §3 (review)
- `docs/implementation-artifacts/5-5-roster-wave-monsters.md`, `docs/implementation-artifacts/sprint-status.yaml`
