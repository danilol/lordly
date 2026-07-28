---
baseline_commit: 052b6431810936e90d39b43db325af80249691c6
---

# Story 5.5: Roster wave — monsters

Status: ready-for-dev

## Story

As a player,
I want the dossier's new monsters looming on the board with their slayers ready,
so that monster armies become a real strategic axis before PvP.

## Acceptance Criteria

1. **Monsters land as data on the shipped model.** Given the 5.1 dossier, when the wave lands, each new monster reuses the single-cell + king-move reservation model with its dossier slot cost (the Whelp is a 1-slot SMALL with no ring — E5-P3), joins the loom rendering with a size-appropriate scale, and the dossier-paired slayer counterplay goes LIVE (the Dragon Hunter's dragonslayer→dragon ×1.5 relation gains its first defenders).
2. **Placement legality and the AI hold at monster scale.** Given placement and the AI, when monsters grow in number, the bannedCells/toAnchor legality path holds for every new monster with tests pinning the dossier's reservation examples, the humans-only leader rule (E5-D13) is enforced end-to-end (engine validation, draft gating, crown UI, AI leader draw), and the AI pool gains monster archetypes shaped by the 4.8 lesson (archetype SHAPE over stat tweaks).
3. **Balance discipline holds.** Given AD-8 discipline and NFR4, when the wave ships, `balanceVersion` ticks with hash re-pin, monster-free battles replay bit-identically (regression pin: every golden byte-identical this time — no shipped-class revision in this wave), and the both-mode sweep converges ≤65% with the wardens-style floors re-checked.

## Tasks / Subtasks

- [ ] Task 1: Widen the unions + the `race` field, typecheck GREEN first (AC: 1)
  - [ ] `ALL_CLASSES` + 10: `gryphon`, `wyrm`, `hellhound`, `whelp`, `emberdrake`, `frostfang`, `stormscale`, `cragmaw`, `nightwing`, `halowing` (flat single-word keys, the 5.4 convention). Roster goes 17 → **27**.
  - [ ] `MoveKind` + `breath` (E5-D7). The 5.4 move-driven dispatch made this a COMPILE ERROR in `act()`'s inner switch (exhaustive over `RowMove`, no default) — by design; the error is your worklist.
  - [ ] NEW `race` field on `ClassStats` (E5-D13): `'human' | 'golem' | 'beast' | 'dragon'` — per-class balance data like `sizeClass`, so it rides the content hash. All 17 existing classes get `human` except golem → `golem`.
  - [ ] `NameSex` gains `'b'` (beast designations) and `'d'` (dragon names) — the Golem construct-list precedent (dossier §7 downstream note).
  - [ ] Run `pnpm typecheck` NOW. Known sites: the 5.4 list again — `BALANCE.classes`, `CLASS_SEX`, `UNIT_FRAMES`, `CLASS_ABBREVIATIONS`, `CLASS_DISPLAY_NAME`, `CLASS_TEXT`, `TRACE_TRAVEL` (breath), `MOVE_PLATE_NAMES` (breath), roster.test's FROZEN_TABLE, plus every place `race` must be populated.
- [ ] Task 2: Balance data + version (AC: 1, 3)
  - [ ] Copy ROSTER.md's approved engine rows verbatim (E5-D15): Whelp 130/26/22/4/10/8/10 small·dragon; Gryphon 220 (AGI 26, back `arrow` — Wind Shot, E5-D14); Wyrm 240 (bites 2/2/1 — the mid-row monster); Hellhound 220 (front Bite **×3** — the game's first 3-action row); Emberdrake 270/STR 34; Frostfang 265/MEN 18; Stormscale 260; Cragmaw 290/VIT 30; Nightwing 265; Halowing 270. All `sizeClass: 'monster'` except the Whelp; roles: Gryphon/Wyrm/Hellhound `beast`, the rest `dragon`. Moves: bites/claws = `slash` (display verbs), dragons' back row = `breath` ×1.
  - [ ] `balanceVersion` 10 → 11 + hash re-pin (the two-step).
  - [ ] Verify the monster cap semantics: `MAX_MONSTERS_PER_ARMY` counts `sizeClass === 'monster'` — the Whelp (small) correctly does NOT count (E5-D13). Pin it.
- [ ] Task 3: `breath` — PHYSICAL row-AoE, ZERO draws (AC: 1, 3)
  - [ ] Shape: the blast branch's targeting (fullest row, tie rearmost, D-2c leader-row interaction) with PHYSICAL arithmetic — `str` vs `vit` — and NO roll (ADR 0003: draws exist only on single-target physical hits; pin with the 5.4 all-bolt-style discriminator). New `breathDamage` beside `blastDamage`.
  - [ ] The wipeout cross-engagement attenuation MUST apply to breath too (ROSTER.md kill-audit carry: "the blast rule applies to `breath`").
  - [ ] DECIDE + record: does the leader-fall sober package cut breath damage? Recommendation: YES — the penalty's rule is "physical only" and breath is physical; Guard/crit/dodge stay out (they gate on the single-target roll, which breath never has). State the composed order in the code comment.
  - [ ] Misfire (confused dragon, back row): row-consistent principle → breathes on its OWN fullest row (the self-blast branch shape, physical damage, A1-only draw). Record the decision; re-probe confusion pins if touched.
- [ ] Task 4: The humans-only leader rule, end-to-end (AC: 2 — E5-D13)
  - [ ] `validate.ts`: generalize `monster-cannot-lead` → race-based (only `race: 'human'` may be crowned — the Whelp is small but a dragon, and must be rejected). An all-monster army has NO legal leader index → always invalid; consider a distinct `no-human-leader` code if the error message earns it.
  - [ ] Draft gating: `canContinue` additionally requires ≥1 human (Danilo's examples pinned: Golem+Emberdrake+Whelp INVALID; Golem+Emberdrake+Knight ✓; Golem+Whelp+Knight+Cleric ✓). Surface the reason in the Draft UI (the hint line) so the player isn't silently stuck.
  - [ ] PlacementScene crown UI: gate crowning on race (today it gates on sizeClass — the Whelp would wrongly be crownable).
  - [ ] `ai.ts` `chooseSetup`: `eligibleLeaderIndices` becomes race-based; every pool archetype must contain ≥1 human (add the ai.test guard).
- [ ] Task 5: Names (AC: 1)
  - [ ] `CLASS_SEX`: beasts → `'b'`, dragons (incl. Whelp) → `'d'`. New `BEAST_NAMES` + `DRAGON_NAMES` lists (~16+ each, original register — the dossier descriptions set the tone); wire into `NAME_TABLES`. Margin math in the record (worst case: 2 monsters + …).
- [ ] Task 6: THE DRAFT PICKER — 27 classes do NOT fit one grid (AC: 2)
  - [ ] **Measured (recon 2026-07-28):** the 5.4 grid (5×62×50, bottom 306 at 17) needs 6 rows for 27 → bottom **418**, deep into DRAFT_DETAIL at 310. Even 7 columns of 44px-floor tiles can't carry readable names. One grid is ARITHMETICALLY out.
  - [ ] **Danilo's decision (asked at story creation): TABS — approved option pending his confirmation at dev start.** Recommended shape: a two-tab strip (Humans 17 / Monsters 10) above the grid — each tab reuses the EXACT 5.4 grid geometry (humans fill it; monsters take 2 rows), preserving the 4.3 icon-grid device decision. Tab state resets in `create()` (singleton scenes).
  - [ ] Keep `draft-grid.test.ts` honest: the bound becomes per-tab (max tab count ≤ 20 fits the geometry), plus a test that every class is reachable through exactly one tab.
- [ ] Task 7: The rest of the shell (AC: 1, 2)
  - [ ] Codes (GRY WYR HEL WHP EMB FRF STM CRG NGT HAL), display names, CLASS_TEXT prose (dossier showcase column), `CLASS_MOVE_NAMES` verbs: Bite (wyrm/hellhound/whelp/dragons' melee), Claw (gryphon), Wind Shot (gryphon arrow), Ember/Frost/Storm/Acid/Dread/Radiant Breath per dragon; `MOVE_PLATE_NAMES.breath` generic fallback ("Breath").
  - [ ] `TRACE_TRAVEL.breath = 'projectile'` + the BattleScene color switch (actor fill, like blast/bolt) + the blast-style row wash? Check `blastWash` — decide whether breath reuses it (recommended: yes, it is the row-AoE read).
  - [ ] Interim sprites: all 10 share the Golem tile (frame 6) with INTERIM attribution notes; the Whelp renders small (no loom — `unitDisplaySize` keys on sizeClass, automatic).
  - [ ] Coupling-site sweep: army SIZE still 5 slots — but monster comps are SHORTER armies (3–4 units); that was true since 4.8, so comp-rendering scenes are already exercised. State it after checking.
  - [ ] rules.md: 27-row table, monster section grows (Whelp exception, humans-only crown, breath), roles list + speed order re-cut. The drift guards will hold your hand.
- [ ] Task 8: Placement + AI pool + sweep (AC: 2, 3)
  - [ ] Placement legality is DATA-driven (sizeClass) — pin the dossier's reservation examples for a non-Golem monster (a dragon dead-center blocks the board; corner blocks 3) + the Whelp placing freely beside anyone.
  - [ ] AI pool: monster archetypes by SHAPE (the 4.8 lesson) — e.g. a dragon-wall comp, a beast-rush comp, a whelp-swarm; every comp keeps ≥1 human (E5-D13); all 27 classes covered (the 4.12 guard). Expect the pool to grow past 12 entries — watch the sim CI runtime (n² pairings) and re-pin the proxy baseSeed if the sample moves (the 5.4 precedent).
  - [ ] Sweep both modes, converge ≤65% at runs=500 before certifying (the 5.1 lesson). Watch: longbows entered this story at 64.9% wipeout (the 5.4 edge flag); the Dragon Hunter's live hunt and 7 dragon-role classes reshape everything.
  - [ ] Regression pin: ALL existing goldens byte-identical (checksum method from 5.4) — this wave revises NO shipped class.
- [ ] Task 9: Docs + gate (AC: 1, 2, 3)
  - [ ] NO `logVersion` change (dossier §4 confirmed: `breath` rides `UnitAttacked.kind`; `race` is balance data).
  - [ ] Full gate: typecheck, lint, coverage (engine ≥90%), web build.
  - [ ] Device pass with Danilo (the tabbed Draft picker + a dragon looming + a breath beat are the things to look at).

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

### Debug Log References

### Completion Notes List

### File List
