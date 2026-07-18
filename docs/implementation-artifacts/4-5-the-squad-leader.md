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

Status: ready-for-dev

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

- [ ] **Task 1: Engine — track leader death, emit `LeaderFell`, apply the sober package (AC: 2)**
  - [ ] Add per-side `leaderFallen: Record<Side, boolean>` resolution state in `resolveBattle()` (`resolve.ts`, alongside `let wiped: WipeState = undefined` near line 70) — persists across the whole battle, all engagements, like `wiped`.
  - [ ] At BOTH death sites — `strike()`'s kill check (`resolve.ts:386-389`, `target.hp === 0 && target.alive`) and the poison-tick kill (`resolve.ts:157-158`) — check whether the dying unit's id equals `${side}:${setup.leaders[side]}` (the exact pattern `act()` already uses for `enemyLeaderId`, `resolve.ts:214`); if so and `leaderFallen[side]` isn't already true, push `{ type: 'LeaderFell', side, unit: target.id }` immediately after the `UnitDied` push, and set `leaderFallen[side] = true`. `strike()`'s signature (`resolve.ts:378`) and the poison-tick loop don't currently receive `setup`/`leaderFallen` — thread them in. **Caution:** `act()` (`resolve.ts:209`) already receives `setup`, but `misfire()` (`resolve.ts:298`) currently does NOT — it's called as `misfire(unit, units, battle, setup.mode)` (`:197`), receiving only `mode`. Since `misfire()` also calls `strike()` for melee/ranged/cleric ally-friendly-fire (and that hit should ALSO carry the leader-fall penalty per the Dev Notes below), `misfire()`'s signature must grow to receive `setup` (or at least `setup.leaders`/`leaderFallen`) too — don't assume it already has what it needs.
  - [ ] **Tactic reversion**: at the point `act()` reads `setup.tactics[unit.side]` (`resolve.ts:212`), override to `'autonomous'` when `leaderFallen[unit.side]` is true — do NOT mutate `setup` itself (it's the validated input, treated as immutable elsewhere). This single override point covers the melee/ranged/blast/witch branches uniformly since they all read `tactic` from that one variable.
  - [ ] **Damage penalty**: add `leaderFallDealt`/`leaderFallTaken` `Ratio` entries to `BALANCE.formulas` (`balance.ts:74-97`, follow the exact doc-comment-plus-`Ratio`-literal pattern as `rpsAdvantage`/`blastAttenuation`). Apply them ONLY to the `physicalDamage` call sites in `act()`/`misfire()` (melee/archer/cleric-staff — NOT the mage/sorceress blast path). Recommended shape: a small wrapper closure built at each `physicalDamage` call site, e.g. `leaderPenaltyPhysical(attackerSide, defenderSide, leaderFallen)` returning a `(attacker, defender, weakened?) => number` that calls `physicalDamage(...)`, then applies `leaderFallDealt` (keyed to `attackerSide`) then `leaderFallTaken` (keyed to `defenderSide`) as fixed-order floor multiplications, then **re-clamps to `BALANCE.formulas.minDamage`** — `physicalDamage` already clamped once internally; a ×3/4 or ×5/4 multiply AFTER that can push back under `minDamage` and must be re-floored. For melee/ranged/staff, `defenderSide` is simply `enemySide` (`act()` already computes this, `resolve.ts` per story 4.4). For the misfire path (ally-targeting), apply the SAME rule uniformly (dealt keyed to attacker's side, taken keyed to defender's side) even when both are the same side — no special-casing.
  - [ ] `balance.ts` `version` 5 → 6; `test/balance-hash.test.ts`: add `6: '<new hash>'` (run once to learn it, per the AD-8 guard workflow).
  - [ ] Unit tests: `LeaderFell` fires exactly once per side, at the right moment (combat death AND poison death); tactic reversion takes effect from the NEXT action onward; the dealt/taken multipliers apply correctly (including the re-clamp-to-minDamage edge case); a regression test locking "enemy `Attack Leader` tactic falls back to Autonomous once our leader is dead" (already covered by 4.4's code — this test proves it, don't reimplement the fallback).

- [ ] **Task 2: Engine — the AI designates its own leader (AC: 1, FR24)**
  - [ ] Extend `AiChoice` (`ai.ts:36-43`) with `leader: number`, drawn from the AI's own stream inside `chooseSetup` as a **4th draw, appended LAST** (after the existing archetype pick → mirror flip → tactic pick chain documented at `ai.ts:228-238`) — uniform random index into the archetype's 5-unit army. Update the stream-ordering invariant doc comment to mention this 4th draw.
  - [ ] `test/ai.test.ts`: the AI's leader draw is deterministic from its stream; confirm the new draw didn't shift archetype/board/tactic selection for a pinned seed (same regression-pin pattern story 4.4 used for the tactic draw).

- [ ] **Task 3: Engine — the sweep sweeps leaders too (AC: 5)**
  - [ ] `sim/sweep.ts:175` currently hardcodes `leaders: { A: 0, B: 0 }` — wire `leaders: { A: a.leader, B: b.leader }` (mirroring how `tactics: { A: a.tactic, B: b.tactic }` was wired for story 4.4's tactic dimension).
  - [ ] `test/sim.test.ts`: both-mode ≤65% band MUST hold with leaders as a live dimension. Re-tune the POOL (not stats) if a comp dominates — mind the story-4.3/4.4 test-timeout lesson.

- [ ] **Task 4: Shell — MatchFlow leader wiring (AC: 1)**
  - [ ] `MatchFlow.ts`: add a guarded `setLeader(index: number)` setter mirroring `setTactic` (`:197-200`) — throw if committed, validate the index is in range AND the unit at that index is currently PLACED (EXPERIENCE.md: "tap a **placed** unit to crown it"). Toggling the same already-crowned index un-crowns it (tap-to-toggle); tapping a DIFFERENT placed unit MOVES the crown to it (no reject-and-ignore dead end — consistent with this codebase's no-dead-end interaction philosophy). **Decision (baked in, confirm on device): the crown is tied to the unit's ARMY INDEX, not board position — it persists through unplace/re-place** (only `draftUnit`/`removeUnit`'s existing AD-9 clear applies); since Ready already requires full placement, this is moot by commit time anyway.
  - [ ] **Decision (baked in): if `playerTactic === 'leader'` and the crown then clears** (via `draftUnit`/`removeUnit`), reset `playerTactic` to `'autonomous'` in that same clearing code path — prevents the invalid state of an `'leader'`-tactic selection with no crown to back it (D-3b's "no invisible defaults" extended).
  - [ ] `commit()` (`:250`): replace `leaders: { A: this.state.playerLeader ?? 0, B: ... }` — remove the silent `?? 0` fallback; throw an assembly-bug-style error if `playerLeader === null` at commit (mirrors the existing "cannot commit: place all N units first" throw — Ready should make this unreachable, so a throw here means Ready's gate itself is broken, not user error). Side B reads `ai.leader` (Task 2).
  - [ ] `test/match-flow.test.ts`: `setLeader` guard tests (mirroring `setTactic`'s), toggle-off/move-to-different-unit behavior, the tactic-auto-reset-on-crown-clear behavior, and the commit-throws-without-a-crown case.

- [ ] **Task 5: Shell — Placement crown UI + Ready gate + Attack Leader unlock (AC: 1)**
  - [ ] `PlacementScene.ts`: bind crown-toggle to a SINGLE tap on a placed unit. The existing double-tap-to-remove gesture (`:209-226`) already treats a single tap as a no-op (`if (!doubleTap) return;` at `:215`) — add the crown toggle INSIDE that no-op branch (before the early return), not as a second `pointerup` listener (which would double-fire). Render the crown glyph (♛) on the crowned unit's card; reuse `PALETTE.title` (`'#e8d5a3'`) for its color — DESIGN.md's `{colors.gold}` token is documented as used for "title accent," and `PALETTE.title` is already this codebase's Night-theme rendering of that exact token; no new color needed.
  - [ ] Ready gate (`:241`, `const ready = placed === state.playerArmy.length && state.playerArmy.length > 0`): add `&& state.playerLeader !== null`.
  - [ ] A visible "crown cleared" notice when draft/remove clears it (EXPERIENCE.md: "any army mutation clears the crown WITH a visible notice") — nothing like this exists today; a transient toast/label is the simplest fit.
  - [ ] Flip the tactic dropdown's `disabled = t === 'leader'` line (`:299`) to `disabled = t === 'leader' && state.playerLeader === null` — Attack Leader becomes pickable once a crown exists, still greyed out before one does.
  - [ ] Confirm on device: crown-tap doesn't fight the double-tap-remove gesture in practice (both are real gestures on the same card now); the crown-persists-through-unplace decision above.

- [ ] **Task 6: Shell — Reveal shows both crowns (AC: 1)**
  - [ ] `RevealScene.ts`'s `drawUnit()` (`:115-127`, reads `committedSetup` at `:81` as `setup`): layer the crown glyph on the sprite where `unit.id === \`${unit.side}:${setup.leaders[unit.side]}\`` — the same id-construction pattern used throughout the engine/shell. Crown belongs on the unit sprite itself (EXPERIENCE.md: "the read is the payoff" — a visual marker on the board, not a separate text line, unlike the tactic labels).

- [ ] **Task 7: Shell — Battle scene: full-beat banner + persistent HUD tint (AC: 3)**
  - [ ] `BattleScene.ts`: replace the placeholder `LeaderFell` case (`:335-338`, currently a floating `popup()`) with a full-beat banner reading **"The leader has fallen!"** (exact text per EXPERIENCE.md) — a new, screen-width beat, not the per-unit floating popup pattern. Then apply a persistent penalty tint to that side's HUD label (`BATTLE_ENEMY_LABEL`/`BATTLE_PLAYER_LABEL`, `:145-146`) for the rest of the match.
  - [ ] The Log panel narration string for `LeaderFell` **already exists** (`apps/web/src/flow/narration.ts:105-107`) — confirm it renders correctly; do not write a new one.

- [ ] **Task 8: Shell — History cards show tactic + leader (AC: 4)**
  - [ ] `HistoryScene.ts`: `entry.setup.tactics`/`entry.setup.leaders` are already persisted (`storage.ts`) — add a per-side tactic label (a compact stacked line, similar treatment to Reveal's) and a crown badge on the correct unit's card in `renderCompLine`/`renderUnitCard` (`:239-253`). Badge the existing card rather than widening the row — the exact overflow risk the 4.2 review caught.

- [ ] **Task 9: Docs — rules.md absorbs leader/penalty content**
  - [ ] `docs/rules.md`: a short section on crowning a leader and the sober-package penalty (numbers pulled from `BALANCE.formulas`, per the drift-guard convention `rules-doc.test.ts` enforces).

- [ ] **Task 10: Gate + device sign-off (all ACs)**
  - [ ] Full gate: typecheck, lint, prettier, all tests incl. re-recorded goldens (if any change) + both-mode sweep, engine coverage ≥90%.
  - [ ] Deploy; Danilo's device session: crown a unit, confirm Ready gates on it, confirm Attack Leader unlocks, confirm hidden-until-reveal + both crowns at Reveal, force a leader death in a battle and confirm the banner + persistent HUD tint + a visible feel-difference from the penalty, confirm History shows tactic + leader. Quote his sign-off verbatim.

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
3. **Crown glyph size:** not specified by DESIGN.md — dev picks a reasonable size, confirm it reads well at 360px on device.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
