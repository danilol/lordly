---
baseline_commit: 4cec830
context:
  - docs/planning-artifacts/epic-4-dossier/DOSSIER.md
  - docs/planning-artifacts/epics.md
  - docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md
---

# Story 4.3: Roster wave 1 — twelve classes on role relations

Status: review

## Story

As a player,
I want new classes to draft, held together by readable role matchups,
so that drafting gets deeper without an N-squared rules explosion.

## Acceptance Criteria

1. **Roles replace the RPS tables (AD-4 amendment, FR14).** A 7-role vocabulary (Vanguard, Skirmisher, Sniper, Artillery, Support, Control, Brute) + a role-relation table land in versioned balance data and become the SINGLE matchup source. `rpsBeats`/`rpsHunts` are **deleted** — no dual matchup tables survive. The damage pipeline's advantage/disadvantage lookup and the draft card's `beats`/`beatenBy` both derive from role relations. **Continuity (FR14 degenerate case):** mapping the six shipped classes to their roles reproduces today's effective matchups EXACTLY (mage→knight, knight→archer, archer→mage symmetric; archer→cleric, archer→witch one-way hunts) — proven by test.
2. **The wave-1 small roster ships (dossier §1).** The **5 new small classes** — Berserker, Phalanx, Ninja, Valkyrie, Sorceress — ship as role/stat variants ("start generic, iterate to unique"): each with a `role`, a full FR15 stat row, `sizeClass: 'small'`, and a 3-letter code, all in balance data. First-level classes only (D-0a: no promotion this era). The six shipped rows are UNCHANGED (continuity). **Golem is NOT in this story** — it ships in 4.8 with its two-cell footprint semantics (dossier §1 sweep note; §2). Mage keeps engine key `mage` but displays as **Wizard / WIZ** (D-1d, display-only shell rename).
3. **Every class renders the FR2 improved spec card (UX-DR3).** Role, matchups (beats / weak-vs, derived from role relations), per-row behavior, and action counts — readable at 360px. The Draft class picker accommodates all 11 classes (see the layout note — this is a real rework, not a constant bump).
4. **Balance discipline (AD-8).** `balanceVersion` bumps once with hash re-pin and re-recorded goldens; the AI `STRATEGY_POOL` covers the newcomers; the NFR4 sweep runs BOTH modes with no archetype over the ≤65% band; `docs/rules.md` and Help absorb the 11-class table (the 2.4 drift guard `rules-doc.test.ts` stays green). NO `logVersion` change (4.2 spent the era's single bump — AD-15).

## Tasks / Subtasks

- [x] **Task 1: Engine — the role vocabulary + relation model replaces RPS (AC: 1)**
  - [x] `balance.ts`: add `ALL_ROLES = ['vanguard','skirmisher','sniper','artillery','support','control','brute'] as const` → `Role` (house const-array pattern, mirror `ALL_TACTICS`). Home: `balance.ts` or `types.ts` — match where `SpellKind`/closed sets live.
  - [x] `ClassStats` gains `role: Role`. Populate all six shipped classes per dossier §1 table (knight=vanguard, mercenary=skirmisher, archer=sniper, mage=artillery, cleric=support, witch=control).
  - [x] Add a `roleRelations` structure to `BalanceData` that expresses the dossier §1 table: Artillery→Vanguard **symmetric** (×3/2 attacker, ×3/4 the reverse), Vanguard→Sniper symmetric, Sniper→Artillery symmetric, Sniper→Support **one-way** ×3/2 (no reverse penalty), Sniper→Control one-way ×3/2. Skirmisher and Brute carry NO relations. Design the shape so a symmetric edge and a one-way hunt are both expressible without a second table (that duality is exactly what `rpsBeats`+`rpsHunts` did — collapse it into one).
  - [x] **DELETE `rpsBeats` and `rpsHunts`** (interface `balance.ts:55,62` + values `:110-111`).
  - [x] `resolve.ts:416-424` `damagePipeline`: replace the `rpsBeats[attacker]===defender || rpsHunts...` advantage test and the `rpsBeats[defender]===attacker` disadvantage test with role-relation lookups reading `BALANCE.classes[attacker].role` / `[defender].role`. Preserve the FR14-amendment asymmetry EXACTLY: advantage from a symmetric edge OR a one-way hunt; disadvantage from the SYMMETRIC edge ALONE (a hunted Support/Control gets NO reverse penalty). Keep the fixed pipeline order (base → preRps → RPS → weaken → clamp) and integer `Ratio` math.
  - [x] `test/combat.test.ts` + `test/roster.test.ts`: continuity assertions — for every ordered pair of the six shipped classes, the role-derived multiplier equals the pre-4.3 `rpsBeats`/`rpsHunts` result (pin the degenerate case). Add coverage for at least one NEW relation pair (e.g. berserker=Vanguard beats archer=Sniper; sorceress=Artillery beats knight=Vanguard).
- [x] **Task 2: Engine — the 5 new small classes (AC: 2)**
  - [x] `types.ts:16` `ALL_CLASSES`: append `'berserker','phalanx','ninja','valkyrie','sorceress'` (closed-set edit — the sanctioned API-change process; the `UnitClass` union derives). Order after the shipped six.
  - [x] `balance.ts` `BALANCE.classes`: add the 5 rows EXACTLY per dossier §1 table (HP/STR/VIT/INT/MEN/AGI/DEX/actions/role/`sizeClass:'small'`). Berserker & Phalanx = Vanguard; Ninja & Valkyrie = Skirmisher; Sorceress = Artillery.
  - [x] **Behavior dispatch:** the engine selects a unit's action by class today (knight/mercenary melee, archer ranged, mage blast, cleric heal, witch cast — see `resolve.ts` `act()`/`strike`/blast/cast and the `CLASS_MOVE_KIND` map at `resolve.ts:~314`). Route the newcomers to their role's GENERIC behavior ("start generic", dossier §1 — the unique moves/Guard are story 4.7): Berserker/Phalanx → melee (like knight); Ninja/Valkyrie → melee (like mercenary, neutral); Sorceress → row-blast (like mage). `CLASS_MOVE_KIND` gains BER/PHA/NIN/VAL = `slash`, SOR = `blast`.
  - [x] `names.ts` `CLASS_SEX`: add the 5 (D-1f — berserker/phalanx/ninja = m; valkyrie/sorceress = f). TS forces this once `ALL_CLASSES` grows.
  - [x] `test/roster.test.ts` + `test/balance.test.ts`: stat-row pins for the newcomers; behavior tests proving each new class acts per its role (a Sorceress blasts a row; a Berserker melees the nearest reachable row).
- [x] **Task 3: Balance version + goldens (AC: 4)**
  - [x] `balance.ts` `version` 3 → 4; `test/balance-hash.test.ts`: add the `4: '<new hash>'` entry (run once to learn the hash — the structural contiguity test enforces it).
  - [x] Re-record goldens ONCE (`vitest -u`) AFTER Tasks 1–2 stable. Existing golden armies are shipped-six only, so verdicts should be IDENTICAL except the balanceVersion field — CONFIRM the diff is version-only (a combat-number change means the continuity refactor broke something). Consider adding one golden that fields a newcomer to lock its behavior.
  - [x] NO `logVersion` change (AD-15 — 4.2 was the era's only bump). `events.test.ts` LOG_VERSION pin stays 4.
- [x] **Task 4: Engine — the AI drafts the newcomers (AC: 4)**
  - [x] `ai.ts` `STRATEGY_POOL`: extend/re-author archetypes so the newcomers appear in the pool (FR25 coverage). Keep each archetype's identity; the tuples are already length-5 (4.2).
  - [x] `test/sim.test.ts`: the both-mode ≤65% band MUST hold over the 11-class meta. Budget real sweep time — new classes change matchups. Re-tune the POOL (placements/comps), NOT class stats, if a comp dominates. Record the wardens-melee-floor watch (3.0) and the **Ninja AGI 28 > Witch 26** tuning question (dossier §1 note) — AGI's pre-4.6 effect is turn-order tie-break only (crit/dodge is 4.6), so note it for the sweep rather than acting on it.
- [x] **Task 5: Shell — display rename + the FR2 card + the 11-class picker (AC: 2, 3)**
  - [x] **Sprites — the units sheet must grow from 6 to 11 frames (asset work, FR31).** `sprites.ts` `UNIT_FRAMES` is `Record<UnitClass,number>` → adding classes is a compile error until the 5 new frames exist. The sheet is ONE 192×32 texture (six 32×32 CC0 Dungeon Crawl Stone Soup tiles in ALL_CLASSES order). Source 5 more CC0 DCSS tiles for Berserker/Phalanx/Ninja/Valkyrie/Sorceress, extend the sheet to 352×32 (11 frames), update `UNIT_FRAMES` (6–10), the `BootScene` load frame config, and `src/assets/attribution.ts` provenance. **Blocker if suitable CC0 tiles aren't picked — see open question 3.**
  - [x] `constants.ts` `CLASS_ABBREVIATIONS`: `mage: 'MAG'` → `'WIZ'` (D-1d); add `berserker:'BER', phalanx:'PHA', ninja:'NIN', valkyrie:'VAL', sorceress:'SOR'`. `Record<UnitClass,...>` forces the 5 new entries.
  - [x] Display name: `mage` must read "Wizard" on cards/narration (engine key unchanged). Add a shell-side `CLASS_DISPLAY_NAME` lookup (or extend `CLASS_TEXT`) — do NOT rename the engine key (would orphan pre-era history rendering, D-1d). The draft card uses `card.name.toUpperCase()`; route it through the display name.
  - [x] `draftModel.ts` `CLASS_TEXT`: add role/behavior prose for the 5 newcomers; update `classRulesCard` `beats`/`beatenBy` derivation (`:49,54`) to read ROLE RELATIONS, not `BALANCE.rpsBeats` (which is gone). `beats`/`beatenBy` become role-derived class lists (a Vanguard may beat multiple Snipers now — the card copy must handle a set, not a single class).
  - [x] **DraftScene picker layout — scrollable, built to SCALE (PO decision 2026-07-18).** `buildClassCards` (`:71-84`) is a 2-col × N-row grid of 168×74 cards; 6 classes end at y≈312, but 11 reach y≈484, colliding with the tray (y=360) and Continue (y=470). Rework it with the house scroll helper (`enableDragScroll`, used by HistoryScene/Help) — a SCROLLABLE picker, because the roster keeps growing (Golem in 4.8, then dragons/beasts + slayer classes in a later wave; Danilo: "we are going to have monsters, so we should think about this"). Build for a growing list, not just 11. Keep FR2 readability at 360px (UX-DR3) and ≥44px tap targets (UX-DR4). Dev's call on the exact scroll layout — NO blocking DESIGN/EXPERIENCE amendment session now (lower priority per PO); a light spine note documenting the scrollable picker is enough. Confirm on device.
- [x] **Task 6: Docs — rules.md + Help absorb the roster (AC: 4)**
  - [x] `docs/rules.md`: extend the class table to 11 classes and rewrite the matchup prose from the triangle to the role vocabulary. `rules-doc.test.ts` derives from balance and will FAIL until the doc matches (the 2.4 drift guard working as designed).
  - [x] `HelpScene.ts`: absorb the 11-class content; verify it renders at 360px (it may share the picker's scroll rework).
- [x] **Task 7: Gate + device sign-off (all ACs)**
  - [x] Full gate: typecheck, lint, prettier, all tests incl. re-recorded goldens + both-mode sweep, engine coverage ≥90%.
  - [x] Deploy; Danilo's device session: draft the newcomers, read the FR2 cards, confirm the picker scrolls/reads at 360px, WIZ shows for Mage, a full 5-slot loop with mixed new/old classes completes. Quote his sign-off verbatim.

## Dev Notes

### The dossier is the spec — this story implements §1 (roles, relations, roster) verbatim

`docs/planning-artifacts/epic-4-dossier/DOSSIER.md §1` — signed off 2026-07-17 (D-1a…D-1f). Do not re-litigate. The §1 table's stat rows are TUNING DRAFTS, sweep-policed here (AC4). If implementation reveals a design hole, STOP and surface it.

### ⚠️ SCOPE CONFLICT to resolve (epics vs dossier) — flagged, see open questions

The **epics.md AC (line 741) says "4 new small classes"** but the **dossier §1 table + gender split (D-1f) define 5**: Berserker, Phalanx, Ninja, Valkyrie, Sorceress. The dossier is authoritative (the "dossier is the spec" precedent from 4.2), and its sweep note (§1, line 78) says "4.3 for the 11 smalls" — 6 shipped + 5 new = 11. **This story is scoped to 5 new smalls.** The epics text is an undercount to correct on the next PM touch.

### Golem is DEFERRED to 4.8 — do NOT add it here

The roster is 12 (11 smalls + Golem) but wave-1 sequencing splits it: the dossier §1 sweep note is explicit — "4.3 for the 11 smalls, 4.8 for Golem comps." Golem is a 2-slot monster whose two-cell footprint/targeting semantics (§2) don't exist until 4.8; adding its balance row now would make it draftable with undefined targeting = broken battles. Leave `golem` out of `ALL_CLASSES` and `BALANCE.classes` this story.

### The refactor's heart: one matchup source, exact continuity

The single biggest risk is breaking the shipped six's matchups during the RPS→role migration. Current state (READ before editing):
- **`resolve.ts:416-424` `damagePipeline`** — the ONLY combat consumer. `advantage = rpsBeats[att]===def || rpsHunts[att]?.includes(def)`; `disadvantage = rpsBeats[def]===att` (symmetric triangle only — the hunts deliberately grant NO reverse penalty, `resolve.ts:411-414`). Your role lookup must reproduce this asymmetry: symmetric edges give both ×3/2 and the ×3/4 reverse; one-way hunt edges give ×3/2 with NO reverse.
- **`draftModel.ts:49,54` `classRulesCard`** — the only card consumer. `beats: rpsBeats[cls]`, `beatenBy = find(att => rpsBeats[att]===cls)`. After the refactor both derive from role relations. A Vanguard now beats every Sniper, so `beats`/`beatenBy` are LISTS, not single classes — the card copy at `DraftScene.ts:94` (`beats ${card.beats}`) must render a set.
- **Continuity map (dossier §1):** knight=Vanguard, mercenary=Skirmisher, archer=Sniper, mage=Artillery, cleric=Support, witch=Control. Under this map the role table reproduces the exact `{mage→knight, knight→archer, archer→mage}` triangle + `{archer→[cleric,witch]}` hunts. Pin it with a test over all 36 ordered shipped-six pairs.

### New-class behavior is role-generic this story (moves/Guard are 4.7)

The engine dispatches action by class (`resolve.ts` `act()` + `CLASS_MOVE_KIND` at `~314`). "Start generic" (dossier §1/§4, D-2b): Berserker/Phalanx melee like Knight (Vanguard), Ninja/Valkyrie melee like Mercenary (Skirmisher, neutral), Sorceress row-blasts like Mage (Artillery). Phalanx's Guard and Wizard/Sorceress Staff-Attack are the story-4.7 move table — NOT here. `CLASS_MOVE_KIND`: BER/PHA/NIN/VAL=`slash`, SOR=`blast`.

### Display rename: Mage → Wizard is SHELL-ONLY (D-1d)

Engine key stays `mage` (renaming orphans pre-era history rendering). Shell changes: `CLASS_ABBREVIATIONS.mage` MAG→WIZ, and a display-name lookup so cards/narration read "Wizard". Board keeps codes (now WIZ). Cite `// D-1d: display rename only` at the code site.

### THE COUPLING FLAG (the story-4.2 lesson, applied): every roster-sized surface

Growing `ALL_CLASSES` 6→11 ripples to every `Record<UnitClass,...>` (TS finds these — `CLASS_ABBREVIATIONS`, `CLASS_SEX`, `CLASS_TEXT`, sprite atlas keys) AND every scene that lays out per-class UI. The known layout hazard: **DraftScene's picker grid overflows at 11 classes** (2-col × 168×74 → y≈484 vs the 360 base; Task 5). Also verify: sprite assets exist for the 5 new classes (`addUnitSprite(cls)` — check the atlas; missing art is a blocker, and DESIGN's zero-custom-art constraint (FR31) means CC0/free packs only). See memory: army-row scenes are coupling sites — grep every comp/roster-rendering surface, don't trust a task list.

### Previous-story intelligence (4.2, just shipped 4cec830)

- The 4.2 senior review caught HistoryScene's 5-unit overflow the recon map missed — apply that vigilance to the picker/Help here.
- House flow: deploy → Danilo device-checks → quote verbatim (device sign-off gates `done`).
- Balance-hash test is the contiguity guard; goldens re-record ONCE at the end; `?perf=1` sampler if the scene feels heavy.
- Sweep re-tuning is whack-a-mole by hand — 4.2 used a deterministic hill-climb over identity-preserving pool variants (scratchpad scripts, uncommitted). Budget real time (AC4).

### Project Structure Notes

- MODIFIED (engine): `types.ts` (ALL_CLASSES, maybe ALL_ROLES), `balance.ts` (roles, roleRelations, 5 rows, delete rps, version 4), `resolve.ts` (damagePipeline + behavior dispatch + CLASS_MOVE_KIND), `names.ts` (CLASS_SEX), `index.ts` (export Role/roleRelations if public) + tests: `balance`, `balance-hash`, `combat`, `roster`, `sim`, `golden` (+ snapshot), possibly `events`/`arbitraries`.
- MODIFIED (web): `config/constants.ts` (codes + display name), `flow/draftModel.ts` (CLASS_TEXT + role-derived card), `scenes/DraftScene.ts` (picker rework), `scenes/HelpScene.ts` (roster content).
- MODIFIED (docs): `docs/rules.md` (11-class table + role prose).
- Sprite atlas: confirm assets for berserker/phalanx/ninja/valkyrie/sorceress (FR31 zero-custom-art).

### References

- [Source: docs/planning-artifacts/epics.md#Story-4.3] — the 3 AC blocks (note the "4 new" undercount)
- [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md §1 + D-1a…D-1f, sweep note] — the signed-off roster, roles, relations, the 11-smalls-here / Golem-in-4.8 split
- [Source: docs/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md#AD-4,AD-8,AD-15] — matchup-data amendment, balanceVersion discipline, no second logVersion bump
- [Source: packages/engine/src/balance.ts:51-70,110-115 (rps to delete); resolve.ts:407-425 (damagePipeline); types.ts:16-19 (ALL_CLASSES)]
- [Source: apps/web/src/flow/draftModel.ts:42-59 (classRulesCard); scenes/DraftScene.ts:70-111 (picker + FR2 card); config/constants.ts:80-88 (codes)]
- [Source: docs/rules.md; apps/web/test/rules-doc.test.ts (drift guard)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8[1m]) — main agent, inline. The parallel subagent fleet (4.2's approach for the sweep search) was unavailable this session (org monthly spend limit), so the sweep re-tune ran via inline `tsx` hill-climb scripts (scratchpad, uncommitted — the 4.2 precedent).

### Debug Log References

- **The RPS→role refactor is byte-identical for the shipped six:** the 8 goldens pass UNCHANGED after the refactor, and combat.test's pinned damage numbers hold — the continuity proof (AC1) at both the unit and battle level. `balanceVersion` 3→4, hash re-pinned `6d243f05`; no `logVersion` change (AD-15).
- **Judging-symmetry test generalised (chirality):** arbitraries now generate the newcomers, which surfaced a cross-class AGI tie (Berserker & Wizard both AGI 12) that the symmetry filter — written when every AGI was distinct, so it keyed on same-CLASS — did not exclude. The per-engagement coin flip (`resolve.ts` `tieWinner`) is not side-symmetric, so the filter now excludes same-AGI mirror pairs. Test fix, not an engine bug.
- **The sweep was the hard part (AC4, both-mode ≤65%).** Hand-tuning is whack-a-mole: newcomer-heavy comps are single-mode doormats (melee can't win the ranged race) OR the melee newcomers are wipeout-fragile (Berserker/Ninja HP < Knight/Merc) → either way a doormat inflates the ceiling comps past 65%. Adding 2 new archetypes couldn't get under 65% (best random ~66.5%). The winning approach: **single-unit substitutions** — one newcomer swapped into each of five existing archetypes (bulwark←berserker, wardens←phalanx, cabal←ninja, talons←valkyrie, gale←sorceress), pool size unchanged at 10, no doormats introduced. A `tsx` hill-climb over substitution positions converged to **max 63.3%** (both modes, 15 runs/pairing) — verified in `sim.test`.
- **Sprites are INTERIM (flagged for device veto):** the units sheet still has six CC0 DCSS frames; the 5 newcomers reuse the closest existing frame (Berserker/Phalanx→Knight, Ninja/Valkyrie→Mercenary, Sorceress→Wizard). Dedicated CC0 tiles + sheet extension + attribution are pending Danilo's device review (open question 3). The `sprites`/`attribution` guards were updated to encode this interim state explicitly.

### Completion Notes List

- **AC1 (roles replace RPS):** `ALL_ROLES`/`Role` + `ClassStats.role` + `BalanceData.roleRelations` (5 directed edges, symmetric|hunt) landed; `rpsBeats`/`rpsHunts` DELETED. `resolve.ts` `damagePipeline` derives the multiplier via the new `rpsRatio(attacker, defender)` (single source); the draft card derives `beats`/`beatenBy` via `dealsAdvantage`. Continuity proven: a 36-pair matrix test + the unchanged goldens + unchanged combat numbers.
- **AC2 (5 new smalls):** berserker/phalanx/ninja/valkyrie/sorceress added to `ALL_CLASSES` + `BALANCE.classes` (exact dossier §1 stats, `sizeClass:'small'`, roles). Behavior routed by role in `act`/`misfire` + `CLASS_MOVE_KIND` (Vanguard/Skirmisher melee, Artillery blast). `CLASS_SEX` extended (D-1f). Golem deferred to 4.8. Mage→**Wizard** display-only (`CLASS_ABBREVIATIONS` MAG→WIZ + `CLASS_DISPLAY_NAME`).
- **AC3 (FR2 card + picker):** the Draft picker is now a SCROLLABLE bounded viewport (the Help/History drag pattern, built to scale) with interactive top/bottom masks that also block taps to off-view cards; the army tray + Continue stay fixed below. The card renders role + role-derived matchups (code lists) + behavior + action counts.
- **AC4 (balance discipline):** `balanceVersion` 3→4 + hash re-pin + goldens (unchanged — continuity); the 10-archetype pool covers all 5 newcomers via single-unit subs; both-mode sweep ≤65% (max 63.3%); `docs/rules.md` rewritten (11-class table, role matchups, 11-class speed order) + the drift guard (`rules-doc.test`) re-authored role-based; Help renders it automatically.
- **Full gate green:** typecheck (both packages), eslint + prettier, engine 215 + web 183 tests, engine coverage ≥90%. Device sign-off (open questions 2/3 — picker feel + newcomer sprite-tile veto) is Danilo's next step.

### File List

MODIFIED (engine): `packages/engine/src/types.ts`, `balance.ts`, `resolve.ts`, `names.ts`, `index.ts`, `ai.ts`; tests `test/balance.test.ts`, `balance-hash.test.ts`, `combat.test.ts`, `roster.test.ts`, `events.test.ts`, `types.test.ts`.
MODIFIED (web): `apps/web/src/config/constants.ts`, `config/sprites.ts`, `flow/draftModel.ts`, `scenes/DraftScene.ts`, `assets/attribution.ts`; tests `test/draft-model.test.ts`, `sprites.test.ts`, `rules-doc.test.ts`.
MODIFIED (docs): `docs/rules.md`.

## Context-analysis questions — RESOLVED by Danilo 2026-07-18

1. **5 new classes, not 4 — CONFIRMED.** Scope is the 5 dossier §1 smalls (Berserker, Phalanx, Ninja, Valkyrie, Sorceress); the epics.md "4 new small classes" text is an undercount, flagged for the next PM touch. Golem stays deferred to 4.8.
2. **Scrollable picker, built to scale — DECIDED.** Rework the Draft picker with the `enableDragScroll` house pattern (not a one-off grid tweak) because the roster keeps growing (monsters in 4.8 + a later dragon/beast wave). Dev's call on the exact scroll layout; no blocking UX-amendment session now (lower PO priority) — a light spine note suffices. See Task 5.
3. **Sprite tiles — dev picks, Danilo vetoes on device (names precedent).** Dev sources sensible CC0 DCSS tiles for the 5 archetypes, extends the units sheet to 11 frames + attribution, and shows them at the device review for Danilo's flavor veto (Task 5 sprite subtask).

## Change Log

- 2026-07-18 — Story 4.3 implemented. Role vocabulary (7 roles) + `roleRelations` REPLACE `rpsBeats`/`rpsHunts` as the single FR14 matchup source (AD-4); `rpsRatio`/`dealsAdvantage` engine exports drive combat + the draft card. 5 new small classes (Berserker, Phalanx, Ninja, Valkyrie, Sorceress) on role-generic behavior; Golem deferred to 4.8. Mage→Wizard display rename (D-1d, shell-only). `balanceVersion` 3→4 (hash `6d243f05`), goldens unchanged (shipped-six continuity), NO logVersion change (AD-15). AI pool covers the newcomers via single-unit substitutions into 5 archetypes; both-mode sweep ≤65% (max 63.3%). Draft picker reworked to a scrollable viewport (built to scale). `docs/rules.md` + drift guard rewritten for the 11-class role model. Full gate: 398 tests, engine coverage 99.47%. **Deviations flagged:** (1) INTERIM sprites — the 5 newcomers reuse existing CC0 tiles until dedicated tiles are sourced + veto'd on device (open q3); (2) the sweep re-tune used inline `tsx` hill-climb scripts (uncommitted) as the parallel subagent fleet was unavailable (org spend limit).
- 2026-07-18 — Judging-symmetry property test generalised from same-CLASS to same-AGI mirror-pair exclusion (the wave-1 roster introduced cross-class AGI ties; the coin-flip tie-break is not side-symmetric). Test fix, not an engine change.
- 2026-07-18 — **Draft picker REDESIGNED (supersedes the scrollable-picker plan; Danilo's on-device call).** The scroll felt unintuitive with more units. New design (his mock): a compact ICON GRID — one small tile (sprite + name) per class, all 11 on one screen, no scroll — with tap-to-SELECT (blue highlight) filling a detail panel (sprite, name, role + action counts, behavior, matchup pills) and an explicit **Add to army** button. Scales far better than scroll as the roster grows. Device sign-off: **"it looks great! we can proceed!"**
- 2026-07-18 — Matchups shown by DAMAGE TYPE, not class lists (Danilo): `strong vs` / `weak to` **physical · projectiles · magic** (role→type: Vanguard/Skirmisher=physical, Sniper=projectiles, Artillery=magic; Support/Control untyped), derived from the role relations. Fixes the "long list" problem and reads naturally ("Witch: weak to projectiles").
- 2026-07-18 — Boot fix (caught by the demo, not tests — BootScene is 0%-covered): the sheet-frame guard demanded exactly `ALL_CLASSES.length` (11) frames; it now derives the requirement from `UNIT_FRAMES` (max index + 1 = 6 with interim reuse; auto-tightens to 11 when dedicated tiles land). `sprites.test`'s `< SHEET_FRAMES` assertion now guards this class of bug at the unit level.
