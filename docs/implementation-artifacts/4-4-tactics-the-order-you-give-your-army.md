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

Status: ready-for-dev

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

5. **The sweep sweeps tactics as a dimension and the wardens floor improves (NFR4, carried-in check).** The both-mode AI-vs-AI sweep adds tactics as a sweep dimension and **stays inside the ≤65% aggregate win-rate band in both modes**. It **shows the melee-witch wasted-swing floor improving** against story 3.0's wardens baseline (wardens 33% single-mode) — tactics should reduce wasted swings; the sweep acceptance should evidence it. `docs/rules.md` + Help absorb the tactics content (the 2.4 drift guard `rules-doc.test.ts` stays green).

## Tasks / Subtasks

- [ ] **Task 1: Engine — split targeting into the fixed two-step + Last Stand (AC: 1)**
  - [ ] Refactor `packages/engine/src/targeting.ts` from single-pass filter-and-pick into an explicit **`legalTargets(...)`** (step ①) + **`applyTactic(list, tactic, ...)`** (step ②) API. The helpers are package-private (not in `index.ts`) — the only caller is `resolve.ts`, so signatures are free to change. Preserve the existing lexicographic rank chains (`targeting.ts:62-67` melee, `:94-99` rearmost) as the `autonomous` ordering.
  - [ ] **Add the FR7 Last Stand fallback** in the melee legal-list step: when reach-filtered living enemies is empty, the legal list becomes ALL living enemies (out-of-reach becomes legal). This is net-new — `selectMeleeTarget` currently returns `undefined` → `skip(unit)` (`resolve.ts:212-221`). Confirm the fallback fires ONLY when the reachable list is empty and there is at least one living enemy somewhere.
  - [ ] Thread `setup.tactics[side]` (and, for `leader`, `setup.leaders[enemySide]`) into `act()` (`resolve.ts:204-268`). `act()` already has `enemies` in scope (`:205`); pass the acting side's tactic down to each targeting call.
  - [ ] Implement `weakest`/`strongest` by **absolute current HP** over the legal list, ties → `autonomous` priority (reuse the lexicographic rank as the tiebreak comparator — mirror the deterministic style of `timelineComparator` at `resolve.ts:491-499`; **zero `battle`-stream draws**, FR20).
  - [ ] Implement `leader`: target `setup.leaders[enemySide]`'s unit when it is in the legal list, else fall back to `autonomous`. `leaders[side]` is a validated integer index (`validate.ts:115-122`).
  - [ ] **Dossier §4 interaction rules:** blast (`selectBlastRow`, `targeting.ts:114-126`) under `leader` → the leader's row; else unchanged. Witch (`resolve.ts:248-266`): prefer-unafflicted filter BEFORE tactic sort; under `leader`, cast on leader if unafflicted, else `autonomous`. Heals (`resolve.ts:235-247`): tactic-agnostic — do not touch. Last Stand precedes tactic application everywhere.
  - [ ] **Guardrail — `autonomous` must stay bit-identical** (except where Last Stand newly converts an idle into an attack): same indices, same `battle`-stream consumption. This is the golden safety net (Task 5).

- [ ] **Task 2: Engine — the AI commits its own tactic (AC: 3, FR24)**
  - [ ] Extend `AiChoice` (`ai.ts:28-33`) with `tactic: Tactic`, drawn from the AI's own `stream` inside `chooseSetup` (`ai.ts:217-238`). **Append the draw AFTER the existing archetype pick + mirror flip** (the documented two-draw order, `ai.ts:205-226`) so existing seeds' archetype/board choices are preserved; nothing draws after, so appending is stream-safe.
  - [ ] Restrict the AI's draw to the **three enabled tactics** (`autonomous`/`weakest`/`strongest`) in the 4.4 window — `leader` is excluded for both sides until 4.5. Document this window explicitly in the code comment.
  - [ ] `test/ai.test.ts`: the AI's tactic is deterministic from the `ai/B` stream; the appended draw did not shift archetype/mirror selection for a pinned seed (regression-pin the pre-4.4 board for one seed).

- [ ] **Task 3: Engine — balanceVersion bump + goldens + branch tests (AC: 4)**
  - [ ] `balance.ts:107` `version` 4 → 5; `test/balance-hash.test.ts`: add `5: '<new hash>'` to `EXPECTED_HASHES` (`:12-17`) — run once to learn the hash (the contiguity/newest guard enforces it). Comment: "rules changed (target pipeline + Last Stand), no stat-data change — AD-8."
  - [ ] Re-record goldens (`vitest -u`, `test/golden.test.ts`) AFTER Tasks 1–2 stable. **AUDIT the snapshot diff:** the ONLY legitimate changes are (a) former melee idles that now attack under Last Stand, and (b) the `balanceVersion` field flip. A changed target on an already-reachable enemy = an `autonomous` regression — STOP and fix. Consider adding one golden whose setup fields a non-`autonomous` tactic to lock the new pipeline.
  - [ ] **Determinism re-check:** Last Stand turns some idles into attacks; if any newly-attacking unit is confused, it now draws a misfire roll it did not before (`resolve.ts:195`), shifting the `battle` stream downstream. Verify the determinism anchor + seed-identity property tests (`test/combat.test.ts`, `test/sim.test.ts`) and re-anchor if a documented shift occurs.
  - [ ] NO `logVersion` change — `events.test.ts` LOG_VERSION pin stays 4.
  - [ ] Branch coverage: for each move kind × each tactic (+ Last Stand fires, + leader-legal vs leader-not-legal fallback), a unit test in `test/combat.test.ts`/`test/roster.test.ts`. Engine coverage ≥90% (AD-7/NFR2).

- [ ] **Task 4: Engine — the sweep sweeps tactics + the wardens floor (AC: 5)**
  - [ ] `sim/sweep.ts:172` currently hardcodes `tactics: { A: 'autonomous', B: 'autonomous' }`. Add tactics as a sweep dimension (the three enabled tactics) so the band is policed across tactic variety. Keep the harness a dev CLI in `packages/engine` (do not relocate it).
  - [ ] `test/sim.test.ts`: the both-mode ≤65% band MUST hold over the tactic dimension. **Add/adjust the wardens-melee-floor assertion** to show the 3.0 wardens-33%-single-mode wasted-swing floor IMPROVING under tactics (the carried-in check — dossier + epics.md:765). Re-tune the POOL (placements/comps), NOT class stats, if a comp dominates. Budget real sweep time — the tactic dimension multiplies runs; mind the story-4.3 test-timeout lesson (heavier sweeps brush Vitest's default — the sim tests already carry explicit 15s/30s timeouts).

- [ ] **Task 5: Shell — the Placement tactic picker (AC: 2)**
  - [ ] `MatchState` (`apps/web/src/flow/MatchState.ts`): add `playerTactic: Tactic` (import from `@lordly/engine`), mirroring `playerLeader` (`:59-66`). A tactic is NOT army-dependent → do NOT clear it on draft/remove (unlike the `playerLeader` clear-on-mutation at `MatchFlow.ts:148,160`).
  - [ ] `MatchFlow` (`apps/web/src/flow/MatchFlow.ts`): init `playerTactic: 'autonomous'` in `emptyState()` (`:63-75`); add a guarded `setTactic(t: Tactic)` setter (guard `phase !== 'committed'`, like `draftUnit`/`placeUnit`); at the setup literal (`:224`) read `A: this.state.playerTactic` and `B: ai.tactic` (the AI's committed tactic from Task 2); hydrate `playerTactic: setup.tactics.A` in `startReplay()` (`:114`, beside the `playerLeader` hydrate). Scenes never mutate state directly (AD-13).
  - [ ] `PlacementScene` (`apps/web/src/scenes/PlacementScene.ts`): add the picker UI. Four beveled buttons, Autonomous pre-selected, **Attack Leader disabled** (follow the Draft "Add to army" gate precedent `DraftScene.ts:200-218`: `PALETTE.buttonFill` + `buttonTextDisabled`, and **attach NO `pointerup` handler** to the disabled tile). Feed selection through `flow.setTactic()`. Layout note below — the band between the tray (`TRAY_Y=486`, bottom ≈y518) and the Ready button (`btnY=596`) is tight (~50px); **dev's documented call on exact layout, confirm on device** (the 4.3 picker precedent: light spine note, no blocking amendment session). The commit button is **"Ready"** (not "Continue" — that's Draft).
  - [ ] `constants.ts`: add `TACTIC_DISPLAY_NAME: Record<Tactic, string>` = `{ autonomous:'Autonomous', weakest:'Attack Weakest', strongest:'Attack Strongest', leader:'Attack Leader' }` (keying off the `Tactic` union makes a missing label a compile error — the `CLASS_DISPLAY_NAME` precedent at `:101-113`); add any picker heading/one-line descriptions here too.

- [ ] **Task 6: Shell — Reveal shows both tactics (AC: 3)**
  - [ ] `RevealScene` (`apps/web/src/scenes/RevealScene.ts`): read `this.flow.getState().committedSetup.tactics.A`/`.B` (guarded present at `:49`) and render both as labels (FR6). `{typography.label}` (15px semibold) is the natural inheritance; pick a spot in the tight vertical budget (dev call, confirm on device). Enemy tactic B now reads a real AI choice (was always `Autonomous`).

- [ ] **Task 7: Docs — rules.md + Help absorb tactics (AC: 5)**
  - [ ] `docs/rules.md`: add the tactics section (the four tactics, the two-step pipeline in plain language, Last Stand, the blast/witch/heal interaction rules). `rules-doc.test.ts` derives from balance and the 2.4 drift guard keeps CI honest.
  - [ ] `HelpScene.ts`: verify it absorbs the new `rules.md` content at 360px (it renders `docs/rules.md?raw` generically — likely zero code change, as in 4.3; confirm).

- [ ] **Task 8: Gate + device sign-off (all ACs)**
  - [ ] Full gate: typecheck, lint, prettier, all tests incl. re-recorded goldens + both-mode sweep, engine coverage ≥90%.
  - [ ] Deploy; Danilo's device session: pick each enabled tactic at Placement, confirm Attack Leader reads disabled, confirm the tactic hides until Reveal and both tactics show at Reveal, play a full loop where a chosen tactic visibly changes who gets hit. Quote his sign-off verbatim.

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

### Debug Log References

### Completion Notes List

### File List
