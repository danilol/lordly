---
baseline_commit: f479ee4
context:
  - docs/planning-artifacts/epic-4-dossier/DOSSIER.md
  - docs/planning-artifacts/epics.md
  - docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md
---

# Story 4.5: The squad leader

Status: done

## Story

As a player,
I want to crown a leader my opponent will hunt,
so that protecting — and hunting — a leader becomes part of the read.

## Acceptance Criteria

1. **Leader designation at Placement, hidden until reveal (FR4/FR5, UX-DR9).** The player crowns exactly one placed unit via tap (`{components.leader-crown}` — glyph ♛, `{colors.gold}`); Ready is gated on a crown existing, same as it's gated on full placement. Any army mutation (draft/remove) clears the crown **with a visible notice** (AD-9's invariant — the model-side clearing already exists from story 4.2; the notice does not). The choice stays hidden until Reveal (FR5), where both leader crowns are shown on the units themselves (FR6 — "the read is the payoff"). The AI designates its own leader with **seeded variation, not always unit 0** (FR24).

2. **A side's leader falling triggers the "sober package" (FR35, dossier D-2d).** When a side's leader dies (combat or poison), the engine emits `LeaderFell { side, unit }` — **this event type already exists in the `LOG_VERSION` 4 union since story 4.2; no logVersion bump.** From that point for the rest of the battle: that side's tactic reverts to **plain Autonomous** (deterministic, zero new stream draws — the "panicked" OB64 variant is explicitly rejected), its units deal **×3/4** physical damage and take **×5/4** physical damage (named, versioned ratios — `balanceVersion` bumps for the new data, sweep-policed), **no initiative perks**. The **physical-only** scoping matters: this touches `physicalDamage`'s call sites (melee/ranged/cleric-staff), not `blastDamage`/`magicDamage`. The enemy's `Attack Leader` tactic falling back to Autonomous once the leader is dead is **already correct for free** — 4.4's `applyTactic` already falls back to Autonomous when the designated leader isn't in the legal (living) list; lock this cross-story guarantee with a regression test, don't reimplement it.

3. **The Battle scene renders the crown and the penalty onset visibly (dossier §6).** `LeaderFell` gets a **full-beat banner** ("The leader has fallen!") plus a **persistent** penalty tint on that side's HUD label for the rest of the match — not the placeholder floating popup that exists today. The Log panel's narration string for this event **already exists** — reuse it, don't rewrite it.

4. **History cards show each side's tactic and leader (FR28, UX-DR10).** `HistoryEntry.setup` **already stores** `tactics`/`leaders` (nothing new to persist) — only the render is missing. Add tactic + a leader-crown badge on the correct unit's card, mindful of the 4.2 "army-row scenes are coupling sites" 360px-overflow lesson: badge the existing card, don't widen the row.

5. **Balance discipline + the sweep (AD-8, NFR4).** `balanceVersion` bumps for the two new named ratios (dealt/taken); goldens re-recorded if the autonomous path is untouched (it should be — the penalty only fires after a leader dies, a state no existing golden reaches without checking); `logVersion` does **NOT** change (AC2). The sweep adds leaders as a dimension (mirroring how story 4.4 added tactics) and stays inside the ≤65% band in both modes. Penalty math, `LeaderFell` emission, and tactic reversion are unit-tested; judging symmetry still holds (the swap-sides property test already swaps `tactics`/`leaders` since story 4.4's review — confirm it still passes, don't re-add the swap).

## Tasks / Subtasks

- [x] **Task 1: Engine — track leader death, emit `LeaderFell`, apply the sober package (AC: 2)**
  - [x] Add per-side `leaderFallen: Record<Side, boolean>` resolution state in `resolveBattle()` (persists across the whole battle, like `wiped`).
  - [x] At BOTH death sites — `strike()`'s kill check and the poison-tick kill — emit `LeaderFell` immediately after `UnitDied` via the shared `isLeaderFall()` guard; threaded `setup.leaders`/`leaderFallen` into `strike()` and grew `misfire()`'s signature to receive `setup`/`leaderFallen`.
  - [x] **Tactic reversion**: `act()` overrides `tactic` to `'autonomous'` when `leaderFallen[unit.side]` (single read; `setup` never mutated).
  - [x] **Damage penalty**: `leaderFallDealt` (×3/4) / `leaderFallTaken` (×5/4) added to `BALANCE.formulas`; applied via `leaderPenaltyPhysical()` wrapper built only when a leader has fallen (else bare `physicalDamage`, keeping the common path allocation-free + bit-identical), at the melee/archer/cleric-staff/misfire physical call sites — NOT blast. Re-clamps to `minDamage` LAST.
  - [x] `balance.ts` `version` 5 → 6; `test/balance-hash.test.ts` pins `6: '49466cd4'`.
  - [x] Unit tests (`test/leader.test.ts`): `LeaderFell` once-per-side + right moment (combat AND poison, property + deterministic); tactic reversion (control comparison); dealt/taken/combined + re-clamp (direct `leaderPenaltyPhysical` table tests + in-battle); enemy `Attack Leader` fallback regression. Goldens #4/#5/#6/#8 + resolve/wipeout/sim anchors re-derived for the penalty.

- [x] **Task 2: Engine — the AI designates its own leader (AC: 1, FR24)**
  - [x] Extended `AiChoice` with `leader: number`, drawn as the 4th `chooseSetup` draw (appended LAST); stream-ordering invariant doc updated. **Also unlocked `leader` in `AI_TACTICS` (Danilo-confirmed) so the AI hunts the player's leader.**
  - [x] `test/ai.test.ts`: four-int draw invariant, leader draw deterministic + in-range + seeded-variation, tactic now includes `leader`; archetype/board anchors held (draws ①② precede the leader draw).

- [x] **Task 3: Engine — the sweep sweeps leaders too (AC: 5)**
  - [x] `sim/sweep.ts` wires `leaders: { A: a.leader, B: b.leader }`.
  - [x] `test/sim.test.ts`: both-mode ≤65% band holds with leaders + `leader` tactic as live dimensions — NO pool re-tune needed (converged runs=150: single max 60.4%, wipeout max 62.4%; wardens viable 37–58%).

- [x] **Task 4: Shell — MatchFlow leader wiring (AC: 1)**
  - [x] `setLeader(index)` added (mirrors `setTactic`): throws if committed / out of range / unit not placed; tap-to-toggle (same index un-crowns) + move-crown (different placed unit); crown tied to army index, persists through unplace.
  - [x] Crown-clear now routes through a shared `clearLeaderDesignation()` (draft/remove) that ALSO resets `playerTactic` `'leader'`→`'autonomous'` (D-3b — no crownless leader-tactic).
  - [x] `commit()`: dropped the `?? 0` fallback; throws `cannot commit: designate a leader first` when `playerLeader === null`; side B reads `ai.leader`.
  - [x] `test/match-flow.test.ts`: setLeader guards, toggle-off/move, tactic-auto-reset, commit-without-crown throw; `draftAndPlaceAll` now crowns (the new Ready requirement).

- [x] **Task 5: Shell — Placement crown UI + Ready gate + Attack Leader unlock (AC: 1)**
  - [x] Single-tap-on-placed-unit crown-toggle added INSIDE the existing double-tap no-op branch (not a second listener); ♛ rendered on the crowned card in `PALETTE.title` (gold); intro copy + crown-hint updated.
  - [x] Ready gate gains `&& state.playerLeader !== null`; the submit hint switches to "tap a unit to crown a leader" once fully placed.
  - [x] Crown-cleared notice — **DEVIATION: implemented in `DraftScene`, not `PlacementScene`.** draft/remove (the crown-clearing mutations) live in DraftScene, and the crown is set only in Placement (after drafting) with no Placement→Draft back-path, so the notice is defensive/unreachable in the current forward-only flow. Flagged for Danilo (see Open Questions). The model invariant + tactic reset are enforced + tested in MatchFlow.
  - [x] Tactic dropdown `disabled = t === 'leader' && !hasLeader` — Attack Leader unlocks once a crown exists.
  - [x] Confirm on device: crown-tap vs double-tap-remove; crown-persists-through-unplace. **DEVICE-ACCEPTED 2026-07-19 (Danilo: "it's working great. I loved it").**

- [x] **Task 6: Shell — Reveal shows both crowns (AC: 1)**
  - [x] `RevealScene.drawUnit()` layers the ♛ on the sprite where `unit.id === \`${unit.side}:${setup.leaders[unit.side]}\`` (gold, on the board — "the read is the payoff"). Stale "leader waits for 4.5" comment updated.

- [x] **Task 7: Shell — Battle scene: full-beat banner + persistent HUD tint (AC: 3)**
  - [x] `BattleScene` `LeaderFell` case now shows a full-beat screen-width banner "The leader has fallen!" (`leaderFellBanner()`) + a persistent `PALETTE.penaltyTint` on the fallen side's HUD label (labels stored as fields). Placeholder popup removed.
  - [x] Log-panel narration for `LeaderFell` already existed (narration.ts) — reused, not rewritten.

- [x] **Task 8: Shell — History cards show tactic + leader (AC: 4)**
  - [x] `HistoryScene` `renderCompLine`/`renderUnitCard`: compact per-side tactic label (stacked line, extra height — not a widened row) + ♛ badge on the leader's card (top-left, opposite the element dot). Pre-era entries (no stored tactics/leaders) optional-chain to omit both.

- [x] **Task 9: Docs — rules.md absorbs leader/penalty content**
  - [x] `docs/rules.md`: new "The Leader" section + Attack Leader tactic bullet, stating the ×0.75 dealt / ×1.25 taken sober-package ratios; `rules-doc.test.ts` drift guard extended to pin them to `BALANCE.formulas`.

- [x] **Task 10: Gate + device sign-off (all ACs)**
  - [x] Full gate GREEN: typecheck (both packages), eslint + prettier clean, 447 tests (250 engine + 197 web), re-recorded goldens #4/#5/#6/#8 + both-mode sweep in band, engine coverage ≥90% (resolve.ts 99.46% lines).
  - [x] Danilo's device session — ACCEPTED 2026-07-19: initial pass ("it's working great. I loved it"), then two device follow-ups (leader crown on the battle board; Wipeout default + left) → **"it works great now. let's proceed."** Deploy to main + senior code review remain (the review handoff).

### Review Findings (2026-07-19, commit c8c5b3b — Blind Hunter + Edge Case Hunter + Acceptance Auditor)

- [x] **[Review][Decision] Open Question 4 (crown-cleared-notice home) — RESOLVED (Danilo, 2026-07-19): accept the defensive `DraftScene` placement as final.** No Placement→Draft back-path will be scoped; the notice stays where it is (fires if a future back-nav is ever added), and the load-bearing clearing invariant stays enforced + tested in `MatchFlow`. No code change.

- [x] **[Review][Patch] Crown-tap fires as a side effect on the FIRST tap of every double-tap-remove, before it's known a second tap will follow** [apps/web/src/scenes/PlacementScene.ts:230-240] — **APPLIED:** the crown-toggle is now DEFERRED past `DOUBLE_TAP_MS` via a per-index `pendingCrownTimers` map (`this.time.delayedCall`), cancelled if a genuine second tap on the same unit confirms a double-tap-remove instead. A true single tap now crowns after a ~300ms confirm delay. Field reset in `create()` (with `.remove()` on any still-pending timers, matching this scene's singleton-scene discipline).

- [x] **[Review][Patch] `MatchFlow.setLeader()`'s toggle-off branch doesn't reset a stale `'leader'` tactic** [apps/web/src/flow/MatchFlow.ts:225-234] — **APPLIED:** the toggle-off path now calls `clearLeaderDesignation()` (the same helper `draftUnit`/`removeUnit` use) instead of setting `playerLeader` directly, so the tactic reset is uniform across every crown-clear path. Regression test added (`match-flow.test.ts`, "toggling OFF the crown... ALSO resets a 'leader' tactic") — confirmed it fails against the pre-patch code (`Received: "leader"`) and passes now.

- [x] **[Review][Patch] Leader-fall banners can visually overlap if both sides' leaders fall close together** [apps/web/src/scenes/BattleScene.ts, `leaderFellBanner()`] — **APPLIED:** an `activeLeaderBanner` field tracks the current strip+text pair; `leaderFellBanner()` now destroys any still-fading previous banner before building a new one (mirroring `DraftScene.flashCrownCleared`'s existing precedent), and clears the field on its own tween completion. Reset in `create()`.

- [x] **[Review][Patch] Stale doc comment on `MatchSetup.leaders`** [packages/engine/src/types.ts:138-139] — **APPLIED:** comment updated to state designation UI + the sober package shipped in story 4.5, and that both flows always supply a real crowned index now.

- [x] **[Review][Patch] `docs/rules.md`'s Attack Leader tactic bullet and "The Leader" section use similar "reverts/collapses to Autonomous" language for two DIFFERENT triggers** [docs/rules.md:61, 69] — **APPLIED:** line 61 now explicitly says "the *enemy's* crowned leader" and cross-references "The Leader" section; "The Leader" section now explicitly says "a side's OWN leader" and "regardless of tactic, and regardless of what happens to the enemy's leader." Verified no test hardcodes the old wording.

Gate re-run after all 5 patches: 448 tests (250 engine + 198 web, +1 regression), typecheck + lint + prettier clean.

**Verified, not findings (dismissed as noise/false-positive/handled-elsewhere):** the misfire same-side penalty's net ×0.9375 multiplier (×3/4 dealt × ×5/4 taken) is the story's own explicit, deliberate spec decision ("apply the SAME rule uniformly... even when both are the same side — no special-casing" — original Task 1 text) — verified correct, not a defect. `leaderPenaltyPhysical`'s export is consistent with the established `physicalDamage`/`magicDamage`/`blastDamage`/`healAmount` "exported for direct table-driven tests" convention in the same file. `BattleScene.buildUnit`'s added boolean parameter mirrors `HistoryScene.renderUnitCard`'s existing `isLeader` pattern shipped in this same diff. The AI's uniform-random leader draw and the leader-tactic's validation-via-aggregate-sweep-band both satisfy their ACs (FR24's "seeded variation, not always unit 0"; AC5's band-holds requirement) exactly as specified — a smarter/weighted leader pick is a future balance-pass idea, not a gap in this story. The Home mode-default flip and the battle-board crown addition are explicit, in-session Danilo requests already recorded with dated amendments in EXPERIENCE.md and deferred-work.md — not unauthorized scope creep.

## Dev Notes

### This is NOT shell-only — the engine has ZERO leader-death logic today
Confirmed by direct grep: nothing in `resolve.ts`, `targeting.ts`, or anywhere in the engine ever constructs or emits `LeaderFell`, and no sober-package multiplier or tactic-reversion logic exists. The `LeaderFell` event TYPE and the `MatchSetup.leaders` SHAPE both already exist (story 4.2) — but nothing consumes or emits them yet. Task 1 is the heart of this story. [Source: engine research report]

### `LeaderFell` is already in the LOG_VERSION 4 union — do NOT bump logVersion
`packages/engine/src/types.ts:364-368` already defines `LeaderFell { type; side; unit }` as a `BattleEvent` union member (line 410); `packages/engine/test/events.test.ts`'s 16-member union-membership test already includes it. `LOG_VERSION` is 4 and stays 4 — the dossier's AD-15 "one combined bump" (spent in 4.2) already reserved this slot. Only `balanceVersion` bumps (5→6, for the two new damage ratios). Getting this backwards is the single easiest mistake to make in this story. [Source: engine research report; types.ts, events.test.ts]

### The enemy's "Attack Leader falls back when the leader dies" already works — don't reimplement it
4.4's `applyTactic` (`targeting.ts`) already computes the legal-target list from LIVING enemies only; a dead leader is never in that list, so the `'leader'` tactic branch's `legal.find(...)` naturally misses and falls back to `bestOf(autonomous)` — no new engine code needed for this specific epics.md AC1 line ("Attack Leader on the other side falls back per FR34"). Add a regression test proving it, but do not touch `applyTactic` for this. [Source: engine research report, verified against targeting.ts's existing `leader` branch]

### The damage-penalty scope is PHYSICAL ONLY
The dossier says "physical attack/defense" — `physicalDamage` (melee/archer/cleric-staff) carries the penalty; `blastDamage`/`magicDamage` (mage/sorceress) do NOT. `strike()` is shared by both physical and blast call sites via its `formula` parameter, so the penalty must be applied at the CALL SITE (wrapping `physicalDamage` before it's passed to `strike()`), not inside `strike()` itself generically — otherwise it would leak into blast damage too. [Source: engine research report; resolve.ts's `strike()`/`act()` structure]

### Re-clamp to minDamage after the new multipliers — a real trap
`physicalDamage` already floors to `BALANCE.formulas.minDamage` internally. A ×3/4 or ×5/4 multiply applied AFTER that can push the result back under `minDamage` (e.g. `minDamage=1`, base result `1`, ×3/4 floors to `0`). The wrapper must re-clamp with `Math.max(minDamage, ...)` as the LAST step, mirroring the existing pipeline's "clamp last" convention. [Source: direct read of `damagePipeline`, `resolve.ts:460-468`]

### The UX spec is mostly complete for this story — two real gaps, both resolved with defaults above
Unlike story 4.4's tactic-picker layout (which was almost entirely undesigned), the leader-crown UI IS specced: exact interaction verb ("tap a placed unit to crown it"), the Ready-gating invariant, the clear-on-mutation requirement, the full visual token (`{components.leader-crown}`: glyph ♛, `{colors.gold}`), and where it appears (placement/reveal/battle/history — `DESIGN.md:153-156`). The two real gaps — (1) what a second crown-tap does (move vs. reject), (2) whether unplacing a crowned unit clears the crown — are NOT written anywhere in EXPERIENCE.md/DOSSIER.md. Both are resolved with sensible defaults in Task 4/5 above (move the crown; persists through unplace) — confirm on device rather than blocking implementation on a PM session, per the story-4.3/4.4 precedent for undersp­ecified UI details. [Source: UX research report]

### Crown color: reuse `PALETTE.title`, don't invent a new token
DESIGN.md's `colors.gold` (`#c9a227`) is documented as used for "frame bevel, enabled/selected fills, title accent." This codebase's `PALETTE.title` (`'#e8d5a3'`, `constants.ts:17`) is already the Night-theme-adapted rendering of that exact "title accent" use — the crown should reuse it directly rather than adding a new, un-adapted color. [Source: DESIGN.md:11; constants.ts:17]

### Previous-story intelligence (4.4, just shipped f479ee4)
4.4 built the tactic infrastructure this story extends: `MatchState.playerTactic`, `MatchFlow.setTactic()`, the Placement tactic dropdown (compact, 24px rows — a DELIBERATE device-confirmed deviation from the 44px UX-DR4 floor, do not "fix" it), double-tap-to-place/remove on unit cards (the exact gesture Task 5 must coexist with), and the Reveal two-tactic disclosure. 4.4's senior review also fixed a drag-then-tap race (a completed drag now resets the double-tap timer) and aligned the drag/tap distance thresholds at `TAP_DISTANCE_PX = 10` — reuse this constant, don't reintroduce a mismatched threshold for the crown tap. 4.4's melee blockade (a front unit ALWAYS shields the back row, even under a tactic — Danilo's must-have, dossier §4 amended) is unaffected by this story but is exactly the kind of "player correction becomes a hard rule" precedent this story's leader-fall penalty should be held to the same rigor on. [Source: 4-4 story + review commits 2552fba, f479ee4]

### What's explicitly OUT of scope
No initiative perks in wave 1 (dossier: "no initiative perks in wave 1" — a deliberate wave-1 limit, not this story's job to add). The OB64 "panicked" random-targeting variant is REJECTED for this era (not deferred — rejected, protects ADR 0003's simplicity). No multiple leaders, no re-crowning after a leader dies mid-battle (the penalty and tactic reversion are permanent for the rest of that battle). [Source: DOSSIER.md D-2d, §4]

### Project Structure Notes
- Engine changes: `packages/engine/src/{resolve.ts, balance.ts, ai.ts}`; tests `test/{resolve,combat,roster,ai,balance-hash,sim,golden}.test.ts`; `sim/sweep.ts`.
- Shell changes: `apps/web/src/flow/{MatchState.ts already has the field, MatchFlow.ts}`, `apps/web/src/scenes/{PlacementScene.ts, RevealScene.ts, BattleScene.ts, HistoryScene.ts}`, `apps/web/src/config/constants.ts` (if any new label constants are needed — the crown color reuses `PALETTE.title`, no new PALETTE entry expected).
- Docs: `docs/rules.md`.
- `logVersion` stays 4; single `balanceVersion` bump 5→6; no new dependencies.

### References
- [Source: docs/planning-artifacts/epics.md#Story-4.5] — the BDD ACs (lines 767-789).
- [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md#§4] — Leader fall / sober package (lines 118-120); D-2d decision (line 28); D-3b (line 32); §5 LeaderFell event + render-surface walk (lines 133, 138); §6 UX spine (lines 144-151).
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md#Epic-4-extension] — leader designation (line 195), LeaderFell banner (line 199), Reveal disclosure (line 196), History cards (line 202).
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md#Components] — `{components.leader-crown}` token (lines 153-156).

## Open questions for Danilo (raised at story creation — not blockers, all resolved with defaults above)

1. **Second crown-tap behavior:** defaulting to "moves the crown to the newly-tapped unit" (no reject-and-ignore dead end). Confirm on device.
2. **Does unplacing a crowned unit clear the crown?** Defaulting to NO — the crown persists through unplace/re-place (tied to army index, not board position); only draft/remove clears it. Confirm this feels right, or say if you'd rather it clear.
3. **Crown glyph size:** not specified by DESIGN.md — dev picked 16px (board/placement/reveal) / 12px (history badge). Confirm it reads well at 360px on device.
4. **Crown-cleared notice is architecturally stranded (RESOLVED as a deviation — please confirm the call):** EXPERIENCE.md/AC1 want a "visible notice" when an army mutation clears the crown. But draft/remove happen only in `DraftScene`, the crown is set only in `PlacementScene` (after drafting), and there is NO Placement→Draft back-path — so in the current forward-only flow the crown can never be cleared by a mutation while it exists. I implemented the notice defensively in `DraftScene` (fires if a mutation ever drops a live crown) and kept the load-bearing clearing invariant + tactic-reset in `MatchFlow` (unit-tested). Options if you want it truly live: (a) accept the defensive placement as-is (recommended — the invariant is real, the notice is future-proof); (b) add a Placement→Draft "edit army" back-path (new scope). Confirm on device / at review.

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — dev-story workflow.

### Debug Log References

- **Balance hash (AD-8):** `balanceVersion` 5 → 6, new content hash `49466cd4` pinned in `balance-hash.test.ts` (learned via a one-off `contentHash(BALANCE)` run).
- **Goldens re-recorded (`vitest -u`):** #4, #5, #6, #8 — every diff audited to be ONLY `LeaderFell` insertions + physical-penalty deltas (A takes less / B takes more once B's default leader B:0 falls). #8 legitimately ends one engagement sooner (5, was 6) because the penalty accelerates B's collapse. #1/#2/#3/#7 unchanged (no index-0 death reaches the penalty).
- **Hand-derived anchors re-derived** for the leader-fall penalty: resolve.ts determinism trace (`LeaderFell` after `died:A:0`; mid-knight hits 19→14; B verdict 90→93), sim anchor (10%/90%→10%/93%), wipeout multi-engagement (A 64%→66%). Comments updated with the new arithmetic, not pasted from runs.
- **AI 'leader' tactic unlocked** (Danilo-confirmed, this session): `AI_TACTICS` gained `'leader'`. This shifts the AI's tactic pick range (3→4) but NOT the archetype/board draws (①② precede it), so the seed-1/seed-2 chooseSetup anchors held unchanged.
- **Sweep:** both-mode ≤65% band holds with leaders + the `leader` tactic as live dimensions — NO pool re-tune. Converged (runs=150): single max 60.4% (bulwark), wipeout max 62.4% (bulwark); wardens viable (37.4% single / 58.0% wipeout).

### Completion Notes List

- **Engine (Task 1–3):** `LeaderFell` emitted at both death sites (combat via `strike()`, poison via the tick loop) through a shared `isLeaderFall()` guard, once per side, immediately after the leader's `UnitDied`. The sober package: tactic reversion to `'autonomous'` (single override at `act()`'s tactic read; `setup` never mutated) + `leaderPenaltyPhysical()` wrapper (×3/4 dealt / ×5/4 taken, re-clamped to `minDamage`) applied ONLY at physical call sites (melee/archer/cleric-staff/misfire), never blast. The wrapper is built only when a leader has fallen, so the no-fall autonomous path stays allocation-free AND bit-identical (existing goldens without an index-0 death are byte-unchanged). `leaderFallen` persists across engagements like `wiped`. AI draws its own leader (4th `chooseSetup` draw, appended LAST) and can now commit the `leader` tactic; the sweep wires both.
- **`leaderPenaltyPhysical` exported** for direct table-driven tests (the `physicalDamage` convention) — the re-clamp trap is pinned precisely there, not only through a battle.
- **Enemy Attack-Leader fallback** left untouched (4.4's `applyTactic` already falls back when the leader isn't in the living legal list); a new battle-level regression proves B keeps fighting (no idle-stall) after the leader it hunts dies.
- **Shell (Task 4–8):** MatchFlow `setLeader` + no-fallback `commit` + shared crown-clear (with tactic reset); Placement single-tap crown, Ready gate, Attack-Leader unlock; Reveal both crowns on the sprites; Battle full-beat banner + persistent HUD tint; History tactic label + crown badge (stacked, never a widened row — the 4.2 coupling lesson).
- **DEVIATION — crown-cleared notice home:** the story assigned the "visible notice" to `PlacementScene`, but draft/remove (the crown-clearing mutations) live in `DraftScene`, and the crown is set only in Placement afterward, with no Placement→Draft return path — so the notice is unreachable in the current forward-only flow. Implemented defensively in `DraftScene` (fires if a mutation drops a live crown; becomes live the moment back-nav is added). The load-bearing clearing invariant + tactic reset are enforced and unit-tested in `MatchFlow`. Flagged for Danilo (Open Question 4).
- **Verified:** 447 tests green (250 engine + 197 web), typecheck + eslint + prettier clean, engine line coverage ≥90%, both-mode sweep in band. NOT yet run in the browser / on device — that is the outstanding acceptance step.

### File List

**Engine (`packages/engine`)**
- `src/resolve.ts` — `leaderFallen` state; `LeaderFell` at both death sites; tactic reversion; `leaderPenaltyPhysical` (exported) at physical call sites; `isLeaderFall`; threaded `setup`/`leaderFallen` through `takeTurn`/`act`/`misfire`/`strike`.
- `src/balance.ts` — `leaderFallDealt` (3/4) + `leaderFallTaken` (5/4); `version` 5 → 6.
- `src/ai.ts` — `AiChoice.leader`; 4th stream draw; `'leader'` added to `AI_TACTICS`; invariant doc updated.
- `sim/sweep.ts` — `leaders: { A: a.leader, B: b.leader }`.
- `test/leader.test.ts` — NEW: LeaderFell emission (combat + poison + property), penalty math + re-clamp, tactic reversion, enemy-fallback regression.
- `test/balance-hash.test.ts` — pinned `6: '49466cd4'`.
- `test/ai.test.ts` — four-draw invariant, leader-draw coverage, `leader` tactic now allowed.
- `test/resolve.test.ts`, `test/sim.test.ts`, `test/wipeout.test.ts`, `test/roster.test.ts` — anchors re-derived for the penalty.
- `test/__snapshots__/golden.test.ts.snap` + `test/golden.test.ts` — goldens #4/#5/#6/#8 re-recorded + inline assertions updated.
- `src/types.ts` — review patch: `MatchSetup.leaders` doc comment updated (was stale, still said "until 4.5 ships").

**Web (`apps/web`)**
- `src/flow/MatchFlow.ts` — `setLeader`; `clearLeaderDesignation` (crown + tactic reset); no-fallback `commit`. Review patch: `setLeader`'s toggle-off now routes through `clearLeaderDesignation` (was a confirmed bug — left a stale `'leader'` tactic with no crown).
- `src/scenes/PlacementScene.ts` — crown-tap, ♛ render, Ready gate, submit-hint, Attack-Leader unlock, intro copy. Review patch: crown-toggle deferred past `DOUBLE_TAP_MS` via `pendingCrownTimers` (was a confirmed bug — every double-tap-remove also mutated the crown as a side effect).
- `src/scenes/RevealScene.ts` — crown on the leader sprite.
- `src/scenes/BattleScene.ts` — full-beat `leaderFellBanner()` + persistent HUD tint; label fields; ♛ crown on each leader ON the battle board (device follow-up). Review patch: `activeLeaderBanner` guard prevents overlapping banners on near-simultaneous mutual leader deaths.
- `src/scenes/HomeScene.ts` — Wipeout default + on the left (device follow-up).
- `src/scenes/HistoryScene.ts` — per-side tactic label + crown badge.
- `src/scenes/DraftScene.ts` — defensive crown-cleared toast (`flashCrownCleared`).
- `src/config/constants.ts` — `LEADER_CROWN_GLYPH`, `BATTLE_LEADER_FELL_BANNER`, `PLACEMENT_CROWN_HINT`, `PALETTE.penaltyTint`.
- `test/match-flow.test.ts` — setLeader/commit/tactic-reset tests; helper crowns a leader. Review patch: regression test for the toggle-off tactic-reset bug (confirmed failing pre-patch).
- `test/rules-doc.test.ts` — leader-fall ratio drift guard.

**Docs**
- `docs/rules.md` — "The Leader" section + Attack Leader tactic bullet. Review patch: disambiguated "enemy's leader" (Attack Leader tactic fallback) vs. "your own leader" (the sober package) — adjacent sections used similar wording for two different triggers.

### Change Log

- 2026-07-19 — Story 4.5 implemented: FR35 leader-fall sober package (engine) + squad-leader crown UI across Placement/Reveal/Battle/History (shell). `balanceVersion` 5→6 (two new physical-penalty ratios), `logVersion` unchanged (LeaderFell already in the v4 union). AI leader designation + `leader` tactic unlocked (Danilo-confirmed). Gate green (447 tests); device sign-off pending.
- 2026-07-19 — Device follow-up (Danilo: "it's working great. I loved it"): (1) **Leader crown now rides the BATTLE board** for the whole fight (`BattleScene.buildUnit`), not just Reveal — groundwork for the mid-battle tactic switch ("go for the leader or not"); EXPERIENCE.md amended (supersedes the reveal-only framing for the Battle surface). (2) **Wipeout is now the Home default and on the LEFT** (`HomeScene`), Standard on the right — EXPERIENCE.md amended; PRD FR17 update logged to deferred-work.md (balance unaffected — sweep polices both modes). Gate re-run green (447 tests).
- 2026-07-19 — Senior code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor, commit c8c5b3b): 1 decision resolved by Danilo (crown-cleared-notice home stays in `DraftScene`, no back-nav scoped), 5 patches applied — 2 real confirmed bugs (crown-tap firing as a side effect of every double-tap-remove; `setLeader`'s toggle-off not resetting a stale `'leader'` tactic, regression-tested) + 3 low-severity polish (overlapping leader-fall banners, a stale doc comment, an ambiguous rules.md wording pair). 8 items verified as non-issues and dismissed (spec-compliant misfire math, established export/parameter conventions, AC-satisfying design choices, already-authorized scope). Gate green: 448 tests (250 engine + 198 web), typecheck + lint + prettier clean. Status → done.
