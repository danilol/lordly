---
baseline_commit: 5824969
context:
  - docs/planning-artifacts/epic-4-dossier/DOSSIER.md
  - docs/planning-artifacts/epics.md
  - docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md
---

# Story 4.4: Tactics — the order you give your army

Status: done

## Story

As a player,
I want to set my army's target-selection tactic and see the enemy's at reveal,
so that a second strategic axis — how my army chooses whom to hit — joins picks and placement.

## Acceptance Criteria

1. **The targeting pipeline becomes the fixed two-step (FR34, amended FR7/FR9).** Target selection in the engine is rewritten from today's fused filter-and-pick (`targeting.ts` helpers each return a single index) into an explicit two-step: **① build the legal-target list**, **② apply the army-wide tactic over that list**.
   - **Step ① — legal list:** melee (all Vanguard/Skirmisher classes) filters the living enemy grid by FR7 reach (facing column `2−i` + adjacent), **with the Last Stand fallback: when the reachable list is empty, out-of-reach living enemies become legal** (this fallback does NOT exist today — `selectMeleeTarget` currently returns `undefined` → idle skip; 4.4 adds it). Ranged (archer) and magic (blast/staff/cast) take the whole living enemy grid (global range, FR9). **A tactic never expands melee reach** — Last Stand is the only reach relaxation, and only when nothing is reachable.
   - **Step ② — tactic over the list:** `autonomous` = today's priorities EXACTLY (melee: nearest row → facing → center → attacker-view-left; ranged/magic: rearmost-first); `weakest`/`strongest` = by **absolute current HP** with ties falling back to the `autonomous` priority (**no new randomness — FR20**, deterministic ordering only); `leader` = the enemy leader (`setup.leaders[enemySide]`) when it is a legal target, else behaves as `autonomous` until the path clears.
   - **Dossier tactic-interaction rules (§4, D-2c) — all four must hold:** Mage/Sorceress **blast under `leader` targets the leader's ROW**; under every other tactic the blast keeps its own rule (row with most living, tie rearmost). **Witch under a tactic:** the prefer-unafflicted filter runs BEFORE the tactic sort; under `leader` she casts on the leader if unafflicted by her spell, else falls back to `autonomous`. **Heals ignore tactics entirely.** Last Stand precedes tactic application.
   - **All four tactic branches are implemented and unit-tested this story**, even though the `leader` branch is not reachable via the player picker in the 4.4 window (see AC2) — tests pass `leaders` explicitly.

2. **The Placement tactic picker ships, hidden until reveal (FR4/FR5, UX-DR9/D-3b).** At Placement the player picks one army-wide tactic via a `{components.mode-toggle}`-style beveled picker: **Autonomous (default, pre-selected) · Attack Weakest · Attack Strongest · Attack Leader**. **Attack Leader renders DISABLED/greyed-out** (muted `{colors.ink-soft}` text, no gold fill, no tap handler) because leader designation ships in story 4.5 — **no invisible defaults** (D-3b). The chosen tactic is committed to `MatchSetup.tactics.A` and **stays hidden until reveal** (FR5 — the picker is player-only, side A; no enemy tactic is shown at Placement). ≥44px tap targets (UX-DR4), legible at 360px (UX-DR3).

3. **Reveal discloses both tactics; the AI commits its own (FR6, FR24).** At Reveal both sides' tactics display as labels (FR6 — the fence lifts here). The **AI commits its own tactic from its seeded `ai/B` stream with no knowledge of the player's** (FR24) — in the 4.4 window the AI draws from the three enabled tactics only (`autonomous`/`weakest`/`strongest`; `leader` joins for both sides in 4.5). Side B is therefore no longer hardcoded `autonomous`.

4. **Balance discipline: rules changed without data changing (AD-8).** `balanceVersion` bumps **4 → 5** with a hash re-pin, even though no stat data changes — a rules change (new target pipeline + Last Stand) must not let a stored setup silently replay differently. Goldens are re-recorded, **and the diff is confirmed to contain ONLY (a) Last-Stand conversions of former melee idles into attacks and (b) the `balanceVersion` field** — any change to an already-reachable target's selection is an `autonomous`-path regression and must be fixed, not recorded. **Every pipeline branch (each tactic × each move kind, Last Stand, leader-legal-vs-fallback) has unit tests.** **NO `logVersion` change** (AD-15 — 4.2 spent the era's single bump).

5. **The sweep sweeps tactics as a dimension and melee stays a viable strategy (NFR4, carried-in check).** The both-mode AI-vs-AI sweep adds tactics as a sweep dimension and **stays inside the ≤65% aggregate win-rate band in both modes**. **REVISED during device review:** the original hope was that tactics would LIFT the melee-heavy `wardens` above story 3.0's 33% single-mode floor (fewer wasted swings). Danilo's must-have melee blockade (a front unit always shields the back, even under a tactic) makes that only partly true — melee is now MORE constrained under a tactic, not less — so the assertion is **wardens stays viable and non-dominant** (`>25%`, `≤65%`), not a hard "improves" claim. `docs/rules.md` + Help absorb the tactics content (the 2.4 drift guard `rules-doc.test.ts` stays green).

## Tasks / Subtasks

- [x] **Task 1: Engine — split targeting into the fixed two-step + Last Stand (AC: 1)**
  - [x] Refactor `packages/engine/src/targeting.ts` from single-pass filter-and-pick into an explicit **`legalTargets(...)`** (step ①) + **`applyTactic(list, tactic, ...)`** (step ②) API. The helpers are package-private (not in `index.ts`) — the only caller is `resolve.ts`, so signatures are free to change. Preserve the existing lexicographic rank chains (`targeting.ts:62-67` melee, `:94-99` rearmost) as the `autonomous` ordering.
  - [x] **Add the FR7 Last Stand fallback** in the melee legal-list step: when reach-filtered living enemies is empty, the legal list becomes ALL living enemies (out-of-reach becomes legal). This is net-new — `selectMeleeTarget` currently returns `undefined` → `skip(unit)` (`resolve.ts:212-221`). Confirm the fallback fires ONLY when the reachable list is empty and there is at least one living enemy somewhere.
  - [x] Thread `setup.tactics[side]` (and, for `leader`, `setup.leaders[enemySide]`) into `act()` (`resolve.ts:204-268`). `act()` already has `enemies` in scope (`:205`); pass the acting side's tactic down to each targeting call.
  - [x] Implement `weakest`/`strongest` by **absolute current HP** over the legal list, ties → `autonomous` priority (reuse the lexicographic rank as the tiebreak comparator — mirror the deterministic style of `timelineComparator` at `resolve.ts:491-499`; **zero `battle`-stream draws**, FR20).
  - [x] Implement `leader`: target `setup.leaders[enemySide]`'s unit when it is in the legal list, else fall back to `autonomous`. `leaders[side]` is a validated integer index (`validate.ts:115-122`).
  - [x] **Dossier §4 interaction rules:** blast (`selectBlastRow`, `targeting.ts:114-126`) under `leader` → the leader's row; else unchanged. Witch (`resolve.ts:248-266`): prefer-unafflicted filter BEFORE tactic sort; under `leader`, cast on leader if unafflicted, else `autonomous`. Heals (`resolve.ts:235-247`): tactic-agnostic — do not touch. Last Stand precedes tactic application everywhere.
  - [x] **Guardrail — `autonomous` must stay bit-identical** (except where Last Stand newly converts an idle into an attack): same indices, same `battle`-stream consumption. This is the golden safety net (Task 5).

- [x] **Task 2: Engine — the AI commits its own tactic (AC: 3, FR24)**
  - [x] Extend `AiChoice` (`ai.ts:28-33`) with `tactic: Tactic`, drawn from the AI's own `stream` inside `chooseSetup` (`ai.ts:217-238`). **Append the draw AFTER the existing archetype pick + mirror flip** (the documented two-draw order, `ai.ts:205-226`) so existing seeds' archetype/board choices are preserved; nothing draws after, so appending is stream-safe.
  - [x] Restrict the AI's draw to the **three enabled tactics** (`autonomous`/`weakest`/`strongest`) in the 4.4 window — `leader` is excluded for both sides until 4.5. Document this window explicitly in the code comment.
  - [x] `test/ai.test.ts`: the AI's tactic is deterministic from the `ai/B` stream; the appended draw did not shift archetype/mirror selection for a pinned seed (regression-pin the pre-4.4 board for one seed).

- [x] **Task 3: Engine — balanceVersion bump + goldens + branch tests (AC: 4)**
  - [x] `balance.ts:107` `version` 4 → 5; `test/balance-hash.test.ts`: add `5: '<new hash>'` to `EXPECTED_HASHES` (`:12-17`) — run once to learn the hash (the contiguity/newest guard enforces it). Comment: "rules changed (target pipeline + Last Stand), no stat-data change — AD-8."
  - [x] Re-record goldens (`vitest -u`, `test/golden.test.ts`) AFTER Tasks 1–2 stable. **AUDIT the snapshot diff:** the ONLY legitimate changes are (a) former melee idles that now attack under Last Stand, and (b) the `balanceVersion` field flip. A changed target on an already-reachable enemy = an `autonomous` regression — STOP and fix. Consider adding one golden whose setup fields a non-`autonomous` tactic to lock the new pipeline.
  - [x] **Determinism re-check:** Last Stand turns some idles into attacks; if any newly-attacking unit is confused, it now draws a misfire roll it did not before (`resolve.ts:195`), shifting the `battle` stream downstream. Verify the determinism anchor + seed-identity property tests (`test/combat.test.ts`, `test/sim.test.ts`) and re-anchor if a documented shift occurs.
  - [x] NO `logVersion` change — `events.test.ts` LOG_VERSION pin stays 4.
  - [x] Branch coverage: for each move kind × each tactic (+ Last Stand fires, + leader-legal vs leader-not-legal fallback), a unit test in `test/combat.test.ts`/`test/roster.test.ts`. Engine coverage ≥90% (AD-7/NFR2).

- [x] **Task 4: Engine — the sweep sweeps tactics + the wardens floor (AC: 5)**
  - [x] `sim/sweep.ts:172` currently hardcodes `tactics: { A: 'autonomous', B: 'autonomous' }`. Add tactics as a sweep dimension (the three enabled tactics) so the band is policed across tactic variety. Keep the harness a dev CLI in `packages/engine` (do not relocate it).
  - [x] `test/sim.test.ts`: the both-mode ≤65% band MUST hold over the tactic dimension. **Add/adjust the wardens-melee-floor assertion** to show the 3.0 wardens-33%-single-mode wasted-swing floor IMPROVING under tactics (the carried-in check — dossier + epics.md:765). Re-tune the POOL (placements/comps), NOT class stats, if a comp dominates. Budget real sweep time — the tactic dimension multiplies runs; mind the story-4.3 test-timeout lesson (heavier sweeps brush Vitest's default — the sim tests already carry explicit 15s/30s timeouts).

- [x] **Task 5: Shell — the Placement tactic picker (AC: 2)**
  - [x] `MatchState` (`apps/web/src/flow/MatchState.ts`): add `playerTactic: Tactic` (import from `@lordly/engine`), mirroring `playerLeader` (`:59-66`). A tactic is NOT army-dependent → do NOT clear it on draft/remove (unlike the `playerLeader` clear-on-mutation at `MatchFlow.ts:148,160`).
  - [x] `MatchFlow` (`apps/web/src/flow/MatchFlow.ts`): init `playerTactic: 'autonomous'` in `emptyState()` (`:63-75`); add a guarded `setTactic(t: Tactic)` setter (guard `phase !== 'committed'`, like `draftUnit`/`placeUnit`); at the setup literal (`:224`) read `A: this.state.playerTactic` and `B: ai.tactic` (the AI's committed tactic from Task 2); hydrate `playerTactic: setup.tactics.A` in `startReplay()` (`:114`, beside the `playerLeader` hydrate). Scenes never mutate state directly (AD-13).
  - [x] `PlacementScene` (`apps/web/src/scenes/PlacementScene.ts`): add the picker UI. Four beveled buttons, Autonomous pre-selected, **Attack Leader disabled** (follow the Draft "Add to army" gate precedent `DraftScene.ts:200-218`: `PALETTE.buttonFill` + `buttonTextDisabled`, and **attach NO `pointerup` handler** to the disabled tile). Feed selection through `flow.setTactic()`. Layout note below — the band between the tray (`TRAY_Y=486`, bottom ≈y518) and the Ready button (`btnY=596`) is tight (~50px); **dev's documented call on exact layout, confirm on device** (the 4.3 picker precedent: light spine note, no blocking amendment session). The commit button is **"Ready"** (not "Continue" — that's Draft).
  - [x] `constants.ts`: add `TACTIC_DISPLAY_NAME: Record<Tactic, string>` = `{ autonomous:'Autonomous', weakest:'Attack Weakest', strongest:'Attack Strongest', leader:'Attack Leader' }` (keying off the `Tactic` union makes a missing label a compile error — the `CLASS_DISPLAY_NAME` precedent at `:101-113`); add any picker heading/one-line descriptions here too.

- [x] **Task 6: Shell — Reveal shows both tactics (AC: 3)**
  - [x] `RevealScene` (`apps/web/src/scenes/RevealScene.ts`): read `this.flow.getState().committedSetup.tactics.A`/`.B` (guarded present at `:49`) and render both as labels (FR6). `{typography.label}` (15px semibold) is the natural inheritance; pick a spot in the tight vertical budget (dev call, confirm on device). Enemy tactic B now reads a real AI choice (was always `Autonomous`).

- [x] **Task 7: Docs — rules.md + Help absorb tactics (AC: 5)**
  - [x] `docs/rules.md`: add the tactics section (the four tactics, the two-step pipeline in plain language, Last Stand, the blast/witch/heal interaction rules). `rules-doc.test.ts` derives from balance and the 2.4 drift guard keeps CI honest.
  - [x] `HelpScene.ts`: verify it absorbs the new `rules.md` content at 360px (it renders `docs/rules.md?raw` generically — likely zero code change, as in 4.3; confirm).

- [x] **Task 8: Gate + device sign-off (all ACs)**
  - [x] Full gate: typecheck, lint, prettier, all tests incl. re-recorded goldens + both-mode sweep, engine coverage ≥90%.
  - [x] Danilo's device session (2026-07-18): tactic picker, disabled Attack Leader, hidden-until-reveal, both tactics at reveal, and the melee blockade all confirmed on device — plus the device-review iterations (compact tactic dropdown, tiny enemy label, double-tap place/remove, melee front-block). **Sign-off: "it works great now. Thanks. We can proceed."**

### Review Findings

- [x] [Review][Patch] Tactic dropdown's tap targets are 24px, below the UX-DR4 44px floor — `apps/web/src/scenes/PlacementScene.ts:258,261,280-284` (`bh = 24` for both the collapsed bar and every expanded option row). This is a KNOWN, device-confirmed deviation (Danilo asked twice to shrink the picker, then signed off with it this size on his own phone) — do not resize it back to 44px. Add back an explicit code comment recording the deviation (a prior version of this comment had one; the dropdown rewrite dropped it), so a future contributor doesn't "fix" it against the PO's tested preference.
- [x] [Review][Patch] Story doc is stale in several places relative to what actually shipped after two device-review iterations: (a) the AC2 Completion Note still says "4 beveled buttons ... ≥44px" (shipped as the 24px dropdown); (b) the AC5 bullet (line 35) and its Completion Note still say the wardens floor "improves" to "34.6% > 33%" — the shipped assertion is `expect(wardens.winRate).toBeGreaterThan(0.25)` (`packages/engine/test/sim.test.ts:219`), explicitly NOT an "improves" claim per the test's own comment; (c) the "Device sign-off PENDING" bullet and the final Change Log's "device sign-off pending" line are stale — Danilo already signed off. Rewrite the Completion Notes List + AC5 wording + sign-off line to match reality.
- [x] [Review][Patch] Double-tap-to-place has a dead zone: the drag-start threshold is 10px (`PlacementScene.ts:85`) but the tap-vs-drag classifier rejects anything over 8px (`PlacementScene.ts:194`) — a pointer move of 8–10px (plausible finger jitter) starts no drag AND is rejected as a tap, so the gesture silently does nothing. Align the two thresholds.
- [x] [Review][Patch] A completed drag never resets the double-tap timer (`this.lastTapIndex`/`this.lastTapAt`) — `wireDragAndDrop()` (`PlacementScene.ts:124-138`) never touches these fields, and the container's own `pointerup` bails early on `distance > 8` before reaching the double-tap bookkeeping (`:194`). A tap on a unit followed shortly by a drag of that SAME unit, followed by another quick tap, can misfire as a stale double-tap (unintended place/unplace). Reset `lastTapIndex = -1` on drag start (or on drop/dragend).
- [x] [Review][Patch] Untested branch combinations: Last Stand × non-autonomous tactics (weakest/strongest/leader), `leader` specifically under Last Stand, and the Witch's cast × non-autonomous tactics — zero tests combine these (`packages/engine/test/targeting.test.ts`, `roster.test.ts`), despite Task 3 claiming this exact coverage ("Last Stand, leader-legal-vs-fallback" branch coverage). Code-traced as very likely correct (`applyTactic` is uniform regardless of how `legal` was built; the Witch correctly threads `tactic`/`enemyLeaderId` through `selectRangedTarget`, `resolve.ts:279`) — this is a thoroughness gap, not a suspected live bug. Add the missing cases.
- [x] [Review][Patch] `MatchFlow.unplaceUnit`'s guard clauses (already-committed throw, out-of-range throw — `MatchFlow.ts:176-182`) have zero test coverage, unlike the equivalent `placeUnit` guards (`match-flow.test.ts:289,296-297,306-307`). Add matching tests.
- [x] [Review][Patch] Three dead exports left over from the pre-dropdown button-row design: `TACTIC_SHORT_LABEL`, `TACTIC_BLURB`, `TACTIC_PICKER_HEADING` (`apps/web/src/config/constants.ts:128-142`) — defined, never imported anywhere else. Delete them.
- [x] [Review][Defer] Reveal/Placement tactic-label pixel positions (`RevealScene.ts` y=344/366/388, `PlacementScene.ts` y=416 band) are hand-placed with no regression test pinning them — deferred, pre-existing pattern in this codebase (layout here is verified by device confirmation rather than golden-pixel tests, consistent with every other scene; Danilo confirmed these positions across two review rounds)

## Dev Notes

### The type vocabulary already exists — 4.4 makes it FUNCTIONAL, does not add it
`Tactic`, `ALL_TACTICS` (`['autonomous','weakest','strongest','leader']`, declared in picker order), and `MatchSetup.tactics: {A,B}` / `leaders: {A,B}` all landed in **story 4.2** as vocabulary (`types.ts:82,85,146-147`; barrel-exported `index.ts:10-11`). `validate.ts:79-84` already throws `invalid-tactic` for anything off the closed set, and `:115-122` validates `leaders` as integer indices. So the story-title phrasing "adds tactics to MatchSetup" is a trap — the field is there; 4.4 wires the **resolution pipeline** (`resolveBattle` currently never reads `setup.tactics` — grep-confirmed) and the **UI**. [Source: engine research report; types.ts, validate.ts]

### This is NOT a shell-only story — the engine pipeline rewrite is the heart
The epic AC leads with "the targeting pipeline is rewritten" and "the AI commits its own tactic (FR24)." The engine work (Tasks 1–4) is the bulk; the picker (Tasks 5–6) is the second half. Do not mistake "the types already exist" for "the engine is done" — `act()`/`targeting.ts` must be restructured and threaded, and the AI must draw a tactic. [Source: epics.md:747-765]

### The two traps that cause review cycles here
1. **Last Stand does not exist yet.** `selectMeleeTarget` returns `undefined` → idle when nothing is reachable (`targeting.ts:53-74`, `resolve.ts:212-221`). AC1 requires the FR7 fallback. Adding it WILL change goldens for any battle where a melee unit currently idles with out-of-reach living enemies — that re-record is sanctioned (epic: "goldens are re-recorded"), but the diff must be **audited** to contain only Last-Stand conversions + the version field. [Source: engine research report]
2. **`autonomous` must stay bit-identical.** Every non-Last-Stand `autonomous` target and every `battle`-stream draw must be unchanged. The 8 goldens + the seed-identity property tests are the safety net — if they change for a reachable target, the refactor broke the autonomous path. [Source: golden.test.ts:18-27; combat.test.ts]

### The targeting pipeline today (what you're refactoring)
`resolve.ts` `act()` (`:204-268`) dispatches by class and calls `targeting.ts` helpers that **fuse filter + pick in one pass**, each returning a positional index: `selectMeleeTarget` (`:53-74`), `selectRearmostTarget` (`:86-106`, used by archer + cleric-staff + witch), `selectBlastRow` (`:114-126`, ignores reach, returns a ROW). The blast is the one place a target *set* is materialized (`resolve.ts:228-234`). Cleric heal ignores enemies (`:235-247`, `lowestHpFraction` at `:378-386`); Witch's prefer-unafflicted projects a candidate array then re-runs rearmost (`:248-266`). Split these into `legalTargets()` + `applyTactic()`; the blast selects a row, so its tactic contract is "row choice" — dossier D-2c settles it (leader → leader's row; else unchanged). [Source: engine research report; targeting.ts, resolve.ts]

### Determinism guardrails (FR20 — zero new randomness)
The `battle` stream is the only stream consumed in resolution; its draw order is a hard invariant (`resolve.ts:92-99`: engagement tie-flip first, then per-confused-action misfire draws). **Tactics add NO draws** — `weakest`/`strongest`/`leader` tie-breaks are deterministic ordering (fall back to the `autonomous` lexicographic rank, the same style as `timelineComparator` `:491-499` and `lowestHpFraction` `:381`). The one determinism subtlety: Last Stand can make a *confused* unit that used to idle now act, adding a misfire draw and shifting the stream downstream — re-verify the anchor and re-document if it moves. [Source: engine research report; rng.ts, resolve.ts]

### The Attack-Leader window (D-3b — the create-story pin, RESOLVED by the dossier)
The sprint-status pin ("Attack-Leader picker behavior in the pre-4.5 window — grey out vs interim default") is **already decided**: dossier **D-3b** — "Attack Leader is GREYED OUT in the tactic picker until leader designation ships (4.5). No invisible defaults (readiness minor #3)." So: the player picker shows Attack Leader **disabled**; the AI restricts its draw to the three enabled tactics in the 4.4 window; the engine's `leader` branch is still fully implemented + unit-tested (tests pass `leaders` explicitly). Leaders default to index 0 at commit (`MatchFlow.ts:225`), but exposing "attack the leader" while nobody has *designated* a leader would be exactly the invisible default D-3b forbids. `leader` comes online for both sides in **4.5**. [Source: DOSSIER.md:32,149; epics.md:747-765]

### What belongs to 4.5, NOT 4.4 (do not pull in)
Leader **designation** (tap-to-crown, `{components.leader-crown}` ♛), the clear-on-mutation crown notice, leader crowns at Reveal, **leader-fall penalty** (LeaderFell event, tactic reverts to plain-Autonomous, ×3/4 dealt / ×5/4 taken — dossier §4/D-2d), and **History cards showing tactic + leader** (both choices must exist first — lands in 4.5) are all story 4.5. 4.4 ships the tactic picker (Attack Leader greyed), the pipeline (all four branches), the AI tactic draw, and the Reveal tactic labels. [Source: DOSSIER.md:118-120,133; EXPERIENCE.md:195-196,202]

### UX spine is THIN for the picker — expect a documented dev call (a real flag)
The binding tactic-picker design is one sub-clause of one bullet (`EXPERIENCE.md:195`): four `{components.mode-toggle}`-style beveled buttons, Autonomous default, Attack-Leader-disabled. **DESIGN.md adds no `tactic-picker` token** (the Epic-4 tokens are move-plate/leader-crown/guard-marker/golem-body/history-row — none for the picker). Silent on: layout, position vs the grid and Ready button, single-row-vs-wrapped at 360px, picker/label copy, Reveal label placement. Follow the **4.3 precedent** (`4-3-...md:55`): the dev makes a documented layout call + a light spine note, no blocking DESIGN/EXPERIENCE amendment session; confirm on device. Inherit `{components.button}`: 44px min height, gold-fill = selected, `{colors.ink-soft}` = disabled. [Source: UX research report; EXPERIENCE.md:195-196, DESIGN.md:88-98,146-163]

### Shell plumbing (mirror the existing playerLeader/mode pattern)
`MatchState.playerTactic: Tactic` (new field, default `autonomous`, NOT cleared on army mutation) → `MatchFlow.setTactic()` guarded setter → read at the setup literal `MatchFlow.ts:224` (`A: playerTactic`, `B: ai.tactic`) → hydrate in `startReplay()` `:114`. `ALL_TACTICS` has zero current usages in `apps/web/src` — the picker is the first consumer. There is no shared button factory in `ui.ts`; every scene draws its own rect+label+`setInteractive` inline — follow suit. All text through `crispText` (`ui.ts:85-87`). [Source: shell research report]

### Previous-story intelligence (4.3, just shipped 5824969)
4.3 replaced `rpsBeats`/`rpsHunts` with the role-relation model (single matchup source) and added 5 classes (11 total) — so the roster the sweep now spans is 11 classes, and the targeting pipeline you're refactoring already routes all 11 by role (melee/blast/etc.). 4.3's Draft picker is the **icon-grid + detail-panel** redesign (Danilo's on-device call: "it looks great! we can proceed!") — its `selected`+`redraw()`+`dynamic[]` idiom and the gated-button disabled pattern are the templates for the tactic picker. 4.3's senior review lesson: **army-row/roster-sized scenes are coupling sites** — a tactic is army-wide, not per-unit, so it's simpler, but still verify the picker doesn't break Placement's existing drag-and-drop/Ready gating. 4.3 also taught the **test-timeout** lesson (heavier sweeps brush Vitest's default) — the sim tests already carry explicit timeouts; keep them as the tactic dimension multiplies runs. [Source: 4-3 story + review commit 5824969]

### Project Structure Notes
- Engine changes: `packages/engine/src/{targeting.ts, resolve.ts, ai.ts, balance.ts}`; tests `test/{combat,roster,ai,sim,balance-hash,golden}.test.ts`; `sim/sweep.ts`. No new engine files needed.
- Shell changes: `apps/web/src/flow/{MatchState.ts, MatchFlow.ts}`, `apps/web/src/scenes/{PlacementScene.ts, RevealScene.ts}`, `apps/web/src/config/constants.ts`.
- Docs: `docs/rules.md` (+ `HelpScene.ts` verify-only).
- No `logVersion` change; single `balanceVersion` bump 4→5; no new dependencies.

### References
- [Source: docs/planning-artifacts/epics.md#Story-4.4] — the BDD ACs (lines 747-765).
- [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md#§4] — targeting pipeline + tactic interactions (lines 96-120); D-2c/D-2d/D-3b decisions (lines 27-32); §6 UX spine (lines 144-153).
- [Source: docs/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md#AD-9] — `MatchSetup` extension, tactics/leaders as battle inputs (FR20/NFR6).
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md#Epic-4-extension] — picker (line 195), reveal disclosure (line 196).
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md#Components] — button/mode-toggle tokens (lines 88-98, 235-236).

## Open questions for Danilo (raised at story creation — not blockers)

1. **AI tactic in the 4.4 window (recommended default already chosen):** the AI draws from the three enabled tactics (`autonomous`/`weakest`/`strongest`), `leader` excluded until 4.5 — consistent with the player picker and with keeping the sweep honest. Flagging in case you want the AI to stay pure-`autonomous` until 4.5 (simpler, but then FR24's "the AI commits its own tactic" is only cosmetically satisfied this story).
2. **Picker layout at 360px:** the band between the tray and the Ready button is ~50px — the dev will make a documented layout call (per the 4.3 precedent) and bring it to your device session rather than blocking on a spine amendment. Confirm that's the right call, or ask for a small EXPERIENCE/DESIGN amendment first.
3. **Reveal tactic-label placement:** vertical budget at Reveal is tight; dev's call + your device eyes, same as #2.

## Dev Agent Record

### Agent Model Used

Fable 5 (dev-story), 2026-07-18.

### Debug Log References

- **The `Tactic` type + `MatchSetup.tactics`/`leaders` already existed** (4.2 vocabulary) — 4.4 made them functional, as the story flagged.
- **Two sanctioned behavior changes drove the golden re-record**, both from the amended FRs (epics.md:29,31), not just the one the story anticipated: FR7 melee-only reach **+ Last Stand** (net-new: melee that used to idle now strikes an out-of-reach enemy) AND **FR9 global range** for ranged/magic (archer, cleric-staff, witch dropped the reach filter). Only goldens #6 and #8 changed (the melee-grind + the archer/witch poison duel); the five all-melee/cleric goldens stayed byte-identical, confirming `autonomous` melee is bit-identical.
- **Four flow-dependent tests were legitimately shifted by FR7/FR9 and updated to preserve intent** (not the engine being wrong — the targeting unit tests verify the logic): the judging-symmetry property now swaps `tactics`/`leaders` too (they're side-indexed battle inputs); the witch-fizzle test became 5-witches-vs-5-knights (global range means the fizzle needs ALL living enemies afflicted); the turn-budget test became all-clerics (the old archer setup relied on reach to prevent deaths); the weaken-reset test now asserts the `StatusCleared` boundary event (the witch re-weakens the rearmost every engagement under global range, so "full damage in eng 2" was unprovable).
- **Golden #8 re-derived**: the poison duel now wipes B at engagement 6 (global-range arrows + poison), 14 ticks, A 16%/0% — poison still persists/compounds (FR19 intent holds), it just resolves faster.
- **Balance re-tune (AC5), round 1 — pre-blockade**: FR9 global range buffed the ranged/caster archetypes; `three-mages` hit 70%+ and `gale`/`farshot` clipped the wipeout band. Re-tuned two placements (NOT stats): three-mages' knights pulled to the back (exposing the mid mages), gale's two archers pushed to the front. Converged rates (runs≥150) topped ~62.8% single / ~60% wipeout — genuinely in band. The tactic dimension (per-side committed tactics, FR24) adds variance, so the CI proxy stays at the pinned baseSeed=1/runs=15 (deterministic; a bigger sweep starves the parallel property tests' timeouts).
- **Balance re-tune, round 2 — post-blockade (device review)**: Danilo's must-have melee blockade (see AC1/Dossier §4 amendment) constrains melee under a tactic more than round 1 assumed, dropping `wardens` below the 3.0 floor and pushing `ambushers` over the band. Re-tuned `ambushers`' placement (one mercenary forward, the mage exposed mid) — this also incidentally recovered `wardens` to ~34.5% single, above the 3.0 mark, though that recovery is no longer the guarantee the test asserts (see the revised AC5 wording above).
- **Hot-path perf**: the two-step refactor briefly re-introduced per-action array allocation (the story-2.0 concern); the rank functions became allocation-free comparators (`meleeCmp`/`rangedCmp` + a single-pass `bestOf`), and goldens stayed byte-identical, confirming the optimization is behavior-preserving.

### Completion Notes List

- AC1 ✅ — targeting rewritten into the fixed two-step (`legalTargets` → `applyTactic`) with FR7 Last Stand, FR9 global range, all four tactic branches, and the dossier §4 interactions (blast-under-leader → leader's row; witch prefer-unafflicted before the tactic sort; heals tactic-agnostic). `autonomous` melee bit-identical.
- AC2 ✅ — Placement tactic picker, redesigned during device review as a COMPACT DROPDOWN (Autonomous default, **Attack Leader disabled** per D-3b) instead of the originally-planned 4-button row, committed to `MatchSetup.tactics.A` via `MatchFlow.setTactic`; hidden until reveal. `playerTactic` survives army mutation (unlike the leader). **Recorded deviation:** the dropdown's tap targets are 24px, under the UX-DR4 44px floor — deliberate, Danilo asked twice to shrink it and confirmed the final size on his own device.
- AC3 ✅ — Reveal shows both tactics as labels; the AI commits its own from `ai/B` (FR24), restricted to the three enabled tactics in the 4.4 window (`leader` waits for 4.5).
- AC4 ✅ — `balanceVersion` 4→5, hash `69280a50` re-pinned (rules-changed/no-data, AD-8), goldens re-recorded + audited, determinism anchors green, NO `logVersion` change, per-branch unit tests added.
- AC5 ✅ — sweep sweeps tactics as a dimension; both-mode ≤65% band holds at the CI config. **Revised during device review** (see AC5 above): the melee blockade means "improves vs 33%" no longer holds as a hard rule, so the test asserts wardens **stays viable and non-dominant** (`>25%`, `≤65% band` — `packages/engine/test/sim.test.ts:219-220`); it lands ~34.5% at the current pool, comfortably clear of both bounds. rules.md + Help absorb tactics (drift guard green).
- **Gate green (dev-story)**: typecheck (both packages) clean, eslint + prettier clean, engine coverage 99.49% lines (94.67% branch) — well above the AD-7 90% gate.
- **Post-review patches (2026-07-19, senior code review):** 7 patches applied — a recorded-deviation comment on the tap-target size (NOT resized — a tested product decision), the drag/tap threshold alignment (both now 10px, was 8px vs 10px), a drag-start reset of the double-tap timer (fixed a stale-double-tap misfire after dragging the same unit), new tests closing coverage gaps (Last Stand × weakest/strongest/leader, the Witch's cast × weakest/leader, `MatchFlow.unplaceUnit`'s guards), 3 dead exports removed, and the Completion Notes/AC5 wording corrected to match what actually shipped. **Final gate: 428 tests** (237 engine + 191 web) — typecheck + lint clean, engine coverage 99.5% lines.
- **Device sign-off RECEIVED** (Danilo, 2026-07-18): the picker feel, the disabled Attack Leader, the reveal labels, and the full loop where the tactic visibly changes targeting were all confirmed on device, across two review iterations (melee blockade + UI polish). **Sign-off: "it works great now. Thanks. We can proceed."** 3 non-blocking open questions logged (AI-tactic window, picker layout, reveal-label placement) — none blocked sign-off.

### File List

**Engine (`packages/engine`)**
- `src/targeting.ts` — rewritten as the fixed two-step (`legalTargets` + `applyTactic`) with Last Stand, global range, allocation-free comparators (`meleeCmp`/`rangedCmp`), and the tactic-aware `selectMeleeTarget`/`selectRangedTarget`.
- `src/resolve.ts` — `act()`/`takeTurn()` thread `setup.tactics`/`leaders`; blast-under-leader row rule; witch prefer-unafflicted via the two-step; cleric staff global.
- `src/ai.ts` — `AiChoice.tactic` drawn from the ai stream (appended last); `AI_TACTICS` (3-tactic 4.4 window); three-mages + gale placements re-tuned.
- `src/balance.ts` — `version` 4 → 5.
- `sim/sweep.ts` — each side commits its own tactic (tactics-as-dimension).
- `test/targeting.test.ts`, `test/roster.test.ts`, `test/ai.test.ts`, `test/balance-hash.test.ts`, `test/golden.test.ts` (+ `__snapshots__/golden.test.ts.snap`), `test/sim.test.ts`, `test/combat.test.ts`, `test/resolve.test.ts`, `test/wipeout.test.ts` — new tactic/branch tests, flow-test updates, golden re-record, hash pin, sweep re-tune + wardens-floor assertion.

**Shell (`apps/web`)**
- `src/flow/MatchState.ts` — `playerTactic: Tactic` field.
- `src/flow/MatchFlow.ts` — `setTactic()`/`unplaceUnit()`; `emptyState`/`startReplay` init; commit threads `playerTactic` (A) + `ai.tactic` (B).
- `src/flow/placement.ts` — `unplaceUnit()` (returns a placed unit to the tray).
- `src/scenes/PlacementScene.ts` — tactic picker (compact dropdown, review-fixed drag/tap thresholds + drag-start double-tap reset); double-tap to place/remove units; tiny enemy label.
- `src/scenes/RevealScene.ts` — both-tactic disclosure labels.
- `src/config/constants.ts` — `TACTIC_DISPLAY_NAME` (the button-row-era `TACTIC_SHORT_LABEL`/`TACTIC_BLURB`/`TACTIC_PICKER_HEADING` were added, then removed in senior review as dead code once the dropdown shipped).
- `src/flow/draftModel.ts` — archer card behavior updated (global range, drops "reachable").
- `src/scenes/DraftScene.ts` — double-tap a class tile to draft it (shares `addToArmy` with the button).
- `test/match-flow.test.ts` — tactic commit/setter/persistence tests + `unplaceUnit` guard tests (senior review).
- `test/placement.test.ts` — `unplaceUnit` pure-model tests.

**Docs**
- `docs/rules.md` — melee-only reach + Last Stand, global ranged/magic, and a new "Your Army's Tactic" section (Help renders it via `parseRulesDoc`).
- `docs/planning-artifacts/epic-4-dossier/DOSSIER.md` — §4 amended: melee is ALWAYS front-blocked, even under a tactic (only ranged/magic dissolve rows).

## Change Log

- 2026-07-18 — **Story 4.4 implemented (dev-story).** The fixed two-step target pipeline (FR34 tactics + FR7 Last Stand + FR9 global range), the AI's own tactic commit (FR24), the Placement tactic picker (Attack Leader disabled until 4.5, D-3b), the Reveal two-tactic disclosure, `balanceVersion` 4→5 with re-recorded goldens, the tactics-as-a-dimension sweep with a re-tuned pool + wardens-floor check, and the rules.md/Help tactics content. Full gate green.
- 2026-07-18 — **Device-review UI polish (Danilo, iterated).** Tactic picker is now a compact centered DROPDOWN in the board→tray band (defaults to Autonomous; the button row was too big/overlapping); the Placement "ENEMY ARMY" label is a tiny muted-grey hint (not a red highlight); **double-tap-to-place/remove** on Placement — double-tap a tray unit to drop it in the first free cell (front row first), double-tap a placed unit to send it back to the tray (`unplaceUnit` added to the placement model + `MatchFlow`); fixed the double-tap not firing (raised the drag-distance threshold so a still tap isn't eaten by the drag system). `PlacementScene.ts`, `MatchFlow.ts`, `placement.ts`.
- 2026-07-18 — **Device-review follow-ups (Danilo).** (1) **Melee blockade fix (must-have mechanic):** a melee unit can no longer strike the back row through a front unit, even under a target tactic — the FR8 blockade now restricts the melee legal list to the nearest occupied row; only ranged/magic dissolve rows. Dossier §4 amended. Goldens byte-identical (autonomous unaffected). (2) **Double-tap-to-add** on the Draft grid. (3) Re-tuned the `ambushers` placement (the blockade reshuffled the meta) so the band holds (converged top ~60% both modes); wardens recovered to ~34.5% single. (4) The AC5 wardens check revised from "improves vs 33%" to "stays viable + in-band" — the blockade constrains melee under tactics, so the old premise no longer holds as a hard rule. **Mid-battle tactic switching DEFERRED** to a design pass (revises AD-2 — logged to deferred-work.md). Full gate green: **417 tests** (231 engine + 186 web), typecheck + lint clean, engine cov ≥90%. Danilo's device sign-off: **"it works great now. Thanks. We can proceed."** Status: review, awaiting senior code review.
- 2026-07-19 — **Senior code review (Sonnet 5) — DONE.** 3-layer adversarial review (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 0 decisions, 7 patches applied, 1 deferred, 3 dismissed as noise (verified against the code: a Phaser input-depth false alarm, a harmless redundant loop, and an AD-2 doc-sync concern that was already resolved before this story started). Patches: recorded the 24px tap-target deviation as an intentional, device-confirmed decision (not resized); aligned the drag/tap distance thresholds (8px→10px) that left a dead zone; fixed a drag-then-tap race that could misfire a stale double-tap; added test coverage for Last Stand × weakest/strongest/leader, the Witch's cast × weakest/leader, and `MatchFlow.unplaceUnit`'s guards; removed 3 dead exports; corrected the Completion Notes/AC5 wording (the "wardens improves" claim, the "4 buttons" description, the stale sign-off line) to match what actually shipped. Gate: **428 tests** (237 engine + 191 web), typecheck + lint clean, engine coverage 99.5% lines. Status → done.
