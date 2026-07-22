---
baseline_commit: 5eaa14b787b0c246e329a511f7eec686456c65a1
---

# Story 4.13: Tactics at the face-off

Status: done

<!-- Emergent story from the 2026-07-20 device session (not in epics.md). See deferred-work.md's 2026-07-20 "tactics editable DURING battle" north-star. -->

## Story

As a player,
I want to choose (and change) my army tactic on the Reveal screen instead of during placement,
so that a forgotten tactic is never a dead-end and I set my stance at the moment I see the matchup.

> **Scope in one line.** Device-reported: on **Reveal** there is no way to fix a forgotten tactic — only `‹ Home` (abandon) or `Fight!`. The fix per Danilo (2026-07-20): **move the army-tactic picker entirely from Placement to Reveal.** You place your board (and crown your leader) on Placement as before; at the face-off you pick your tactic, then `Fight!` resolves the battle with it. This is the **pre-battle half** of a larger north-star (tactics editable *mid-battle*), which is blocked by the pre-resolved-battle architecture (AD-2) and stays deferred — see `deferred-work.md` (2026-07-20). It also lands the **first conscious relaxation of the FR5/FR24 "commit blind" pillar** (you now choose your tactic *after* the enemy is revealed).

## Acceptance Criteria

1. **The picker moves to Reveal.** The compact army-tactic dropdown is **removed from `PlacementScene`** and appears on `RevealScene`: the "You — <tactic>" line becomes an interactive picker (tap to open the four options: Autonomous / Attack Weakest / Attack Strongest / Attack Leader; tap one to select). The "Enemy — <tactic>" line stays a static display (FR6 reveal). All four tactics are selectable — a crown is always committed by Reveal (commit requires it), so `Attack Leader` needs no disabled state here. Placement keeps the leader-crown gesture unchanged.
2. **Choosing on Reveal re-resolves cleanly.** Selecting a tactic on Reveal updates the player's tactic through the flow (AD-13 — the scene never mutates state), which folds it into the committed `MatchSetup` (`tactics.A`) and **invalidates the cached battle log** so `Fight!` recomputes the outcome with the chosen stance. **Only `tactics.A` changes** — the AI board, elements, names, and leader are already committed and untouched, so **nothing is re-drawn from any RNG stream** (determinism/replay intact, AD-10/FR20). `balanceVersion` and `logVersion` are unchanged; no goldens change.
3. **Default and no-op are safe.** With the picker gone from Placement, the tactic defaults to `autonomous` at commit; a player who never touches it on Reveal fights Autonomous (the current behavior). Re-selecting the same tactic is a harmless no-op. The picker is a live-play affordance only: **replay goes straight to Battle (never Reveal)**, so a replayed match's tactic stays immutable — guarded in the flow (a replay flow rejects a post-commit tactic change).
4. **The deviation is recorded.** `EXPERIENCE.md` is updated: the tactic picker's home moves from Placement to Reveal, and the FR5/FR24 "simultaneous hidden commit" state pattern gains a recorded note that the player's *tactic* is now chosen after the enemy is revealed (a conscious PvE relaxation, Danilo 2026-07-20). The `RevealScene` singleton resets its picker-open state every `create()` (scenes-are-singletons discipline).
5. **On-device acceptance (Danilo).** On device: the forgotten-tactic dead-end is gone; the Reveal picker sets/changes the tactic; `Fight!` plays a battle consistent with the chosen tactic; Placement no longer shows a picker and still crowns leaders. Full gate green before review.

## Tasks / Subtasks

- [x] **Task 1 — Flow: allow the tactic to change post-commit (AC: 2, 3)**
  - [x] In `apps/web/src/flow/MatchFlow.ts`, change `setTactic(tactic)` so that when `phase === 'committed'` it ALSO re-assembles `committedSetup.tactics.A` (immutably) and clears the cached `log` (`this.log = undefined`) so `resolve()`/`Fight!` recomputes. Pre-commit behavior (setting `state.playerTactic`) is unchanged. Do NOT re-run `chooseSetup`, element/name rolls, or touch side B — only `tactics.A`. **DONE.**
  - [x] Guard: reject a post-commit tactic change while `replay` is true (a replayed match is immutable — `throw`, spine-errors convention). Defensive `'leader'`-without-crown guard (never trips post-commit since commit requires a crown, but keep it honest). **DONE.**
  - [x] Keep `historyWritten`/`replay` semantics intact; `recordResult()` still writes the (now possibly-updated) `committedSetup` at Result. Re-validate the reassembled setup (`validateMatchSetup`) — a swapped valid tactic stays valid; cheap insurance. **DONE.**
  - [x] Update `apps/web/test/match-flow.test.ts`: the "setTactic throws once committed" test (≈line 190) now asserts the NEW behavior (post-commit `setTactic` updates `committedSetup.tactics.A` and invalidates the cached log so a subsequent `resolve()` reflects the new tactic; a `replay` flow still rejects it). Add coverage that side B and the armies/placements/leaders are byte-unchanged across a post-commit tactic swap. **DONE: 3 new/rewritten tests (fold+invalidate; side-B-unchanged; replay-rejected).**
- [x] **Task 2 — Placement: remove the tactic picker (AC: 1)**
  - [x] In `apps/web/src/scenes/PlacementScene.ts`, delete `buildTacticPicker`, the `pickerOpen` field, its `create()` reset, and the `this.buildTacticPicker(...)` call (≈line 376). Remove now-unused imports (`ALL_TACTICS`; `TACTIC_DISPLAY_NAME` if unused after). Leave the leader-crown gesture and everything else intact; reclaim the freed band (~y416) or leave it — no new element required. **DONE: method + field + reset + call removed; `ALL_TACTICS`, `Tactic`, `TACTIC_DISPLAY_NAME` imports dropped.**
- [x] **Task 3 — Reveal: host the interactive picker (AC: 1, 4)**
  - [x] In `apps/web/src/scenes/RevealScene.ts`, replace the static "You — <tactic>" label (≈line 87) with a compact tap-to-open picker adapting Placement's dropdown pattern (bar shows `You — <tactic> ▼/▲`; open lists the four `ALL_TACTICS` options; a pick calls `flow.setTactic(t)` then redraws). All four enabled. Keep the "Enemy — <tactic>" static line and the `Fight!` button. Reset the picker-open flag in `create()` (singleton). The dropdown drops into the empty band below the tactics block (there is ample room above `Fight!`). **DONE: `renderTactics()` + `pickerOpen`/`tacticEls` fields; enemy line shifts below the options while open so nothing overlaps.**
  - [x] Confirm the picker only appears in live play (Reveal is never entered on replay — `HistoryScene` starts `Battle` directly). **DONE: verified `HistoryScene.ts:222` starts `Battle`; flow also rejects the edit under `replay`.**
- [x] **Task 4 — UX spec + docs (AC: 4)**
  - [x] Update `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md`: Placement section drops the tactic picker; Reveal section gains it; the "Simultaneous hidden commit" state-pattern row gets a recorded note that the *tactic* is now chosen post-reveal (conscious FR5/FR24 relaxation, PvE, Danilo 2026-07-20). Keep copy register consistent. **DONE (Placement/Reveal Epic-4 lines + the state-pattern rows).**
- [x] **Task 5 — Gate + device (AC: 5)**
  - [x] `pnpm typecheck`, `pnpm lint`, `pnpm coverage` (engine ≥90% unaffected — this is shell-only), `pnpm --filter web build`. **DONE: all green — 570 tests, lint+prettier clean, engine 99.42% lines, web build exit 0.**
  - [ ] Danilo on device: forgotten-tactic dead-end gone; Reveal picker sets/changes tactic; Fight reflects it; Placement clean. *(pending — the house device-acceptance step, done at review alongside code-review)*

### Review Findings (code-review 2026-07-20, Opus 4.8 — 3 adversarial layers)

Blind Hunter + Edge Case Hunter + Acceptance Auditor. No High severity; no wrong-result bug. Acceptance Auditor: all five ACs satisfied.

**Decision needed:**
- [x] [Review][Decision] Enemy-tactic line jumps ~100px down when the picker opens — RESOLVED (Danilo, 2026-07-20): **pin "You"/"Enemy" adjacent and drop the options into the band beneath both lines.** The two tactic readouts stay paired (FR6) and never jump. Applied in `renderTactics`. [apps/web/src/scenes/RevealScene.ts]

**Patch (all applied):**
- [x] [Review][Patch] `resolve()` docstring rewritten (memoized-not-once; invalidated by `setTactic`; the "log always matches current `committedSetup`" invariant `recordResult` relies on); `setTactic` docstring + the Reveal roster-resolve comment updated [apps/web/src/flow/MatchFlow.ts]
- [x] [Review][Patch] Added the end-to-end determinism test — a post-commit fold to 'strongest' produces a byte-identical `committedSetup` AND `BattleLog` to a flow committed with 'strongest' from the start [apps/web/test/match-flow.test.ts]
- [x] [Review][Patch] `setTactic` now validates the fold BEFORE any mutation and assigns `playerTactic` LAST — no split state on a defensive throw [apps/web/src/flow/MatchFlow.ts]
- [x] [Review][Patch] No-op guard added — re-selecting the already-committed tactic skips the fold and does not drop the cached log [apps/web/src/flow/MatchFlow.ts]
- [x] [Review][Patch] Added the post-commit `setTactic('leader')` test (the only live leader-guard path) [apps/web/test/match-flow.test.ts]
- [x] [Review][Patch] Documented the Reveal dropdown geometry coupling to the tactic count (re-lay against the Fight button before a 7th tactic) [apps/web/src/scenes/RevealScene.ts]
- [x] [Review][Patch] Moved the `pickerOpen`/`tacticEls` singleton reset to the top of `create()`, above the uncommitted early-return [apps/web/src/scenes/RevealScene.ts]

**Deferred:**
- [x] [Review][Defer] `RevealScene` resolves the full battle just to read the initial (tactic-independent) roster, then re-resolves in Battle after any tactic change — pre-existing double-resolve, not caused by this change [apps/web/src/scenes/RevealScene.ts:81] — deferred, pre-existing

**Dismissed (3):** pick-handler `try/catch` (the throw is unreachable from Reveal — replay routes straight to Battle, and a crown is always committed post-commit); "dead" pre-commit `setTactic` branch (its tests guard the real `clearLeaderDesignation` state invariant, and `commit()` reads the default `playerTactic`); no Reveal scene-level test (consistent with the repo's device-accepted scene posture).

## Dev Notes

### The core constraint — the battle is pre-resolved (AD-2/AD-13)
`resolveBattle` computes the entire `BattleLog` once from the committed `MatchSetup`. `RevealScene` already calls `this.flow.resolve()` (RevealScene.ts:76) to draw the rosters, so the log exists by Reveal. Changing the tactic therefore means **invalidating that cached log** so `Fight!` recomputes — this is why `setTactic` must clear `this.log`. The initial roster (`BattleStarted.units`) is tactic-independent, so the boards shown on Reveal do not change when only the tactic changes; only the resolved outcome does. [Source: apps/web/src/scenes/RevealScene.ts:74-97; flow/MatchFlow.ts:345-352]

### Why only `tactics.A` — determinism stays intact
`commit()` assembles side B (AI board via `chooseSetup` on `ai/B`, plus element/name rolls on the B streams) exactly once. A post-commit tactic change must touch **only** `committedSetup.tactics.A` and leave side B, both armies, placements, and leaders byte-identical — so no RNG stream is re-drawn and replay/FR20 hold. The AI is seed-locked regardless, so re-committing would reproduce the identical opponent anyway; we simply avoid re-running it. [Source: apps/web/src/flow/MatchFlow.ts:265-334]

### The FR5/FR24 relaxation (recorded)
`EXPERIENCE.md` makes Placement→Reveal a "simultaneous hidden commit": commit blind, then Reveal shows the enemy composition, elements, AND tactic (FR6). Moving the player's tactic choice to Reveal means it is chosen **after** the enemy is revealed — a counter-pick. Low-stakes here (solo PvE, seed-locked AI) and Danilo's explicit call (2026-07-20); recorded in EXPERIENCE.md and this story rather than shipped silently (UX spec is binding). The mid-battle extension of this idea is the deferred north-star. [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md:92-93,158-160]

### The picker component (what moves)
Placement's `buildTacticPicker` (PlacementScene.ts:432-482) is a compact 200×24 dropdown: a bar showing the current tactic, expanding to four option rows over the tray. It reads `ALL_TACTICS`/`TACTIC_DISPLAY_NAME` and writes via `flow.setTactic` (AD-13). On Placement the `'leader'` option is disabled until a crown exists; on **Reveal a crown always exists** (commit requires one), so the Reveal picker enables all four with no disabled state. Note the RECORDED DEVIATION on the picker: 24px rows sit under the 44px tap-target floor — a tested product decision (Danilo, "it works great now"); keep that size, do not "fix" it. [Source: apps/web/src/scenes/PlacementScene.ts:416-482]

### Scenes are singletons
`RevealScene` is reused across a session — reset any picker-open flag in `create()` or state leaks between plays (the memorized Phaser-singleton lesson; Placement already does this for `pickerOpen`). [Source: apps/web/src/scenes/PlacementScene.ts:54,110]

### What this story is NOT
- Not the mid-battle tactic change (the north-star) — that is an engine/replay/history epic, deferred (`deferred-work.md`, 2026-07-20).
- Not a leader-crown relocation — the crown stays on Placement.
- No engine, balance, or `logVersion` change; shell + UX-doc only. Goldens untouched.

### Testing standards
Flow logic is unit-tested (`apps/web/test/match-flow.test.ts`) with a fixed seed; the tactic re-resolve + side-B-unchanged invariants are the new pins. Scene interaction (the picker UI) follows the house device-acceptance pattern. Full gate before review: `pnpm typecheck`, `pnpm lint`, `pnpm coverage`, `pnpm --filter web build`.

### References
- [Source: apps/web/src/scenes/RevealScene.ts] — the Reveal renderer + the static tactic labels being replaced.
- [Source: apps/web/src/scenes/PlacementScene.ts:376,416-482] — the picker being removed.
- [Source: apps/web/src/flow/MatchFlow.ts:218-221 (setTactic), 265-334 (commit), 345-352 (resolve), 103-128 (startReplay)] — the write path + the re-resolve seam + replay immutability.
- [Source: apps/web/src/scenes/HistoryScene.ts:216-222] — replay starts Battle directly (Reveal never entered on replay).
- [Source: docs/implementation-artifacts/deferred-work.md] — the 2026-07-20 mid-battle-tactics north-star this story partially serves.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — `claude-opus-4-8[1m]`.

### Debug Log References

- Confirmed `RevealScene` resolves the log for the roster (`RevealScene.ts:76`) and `BattleScene` re-resolves via `flow.resolve()` (`BattleScene.ts:234`) — so invalidating the cached log on a tactic change makes `Fight!` recompute with the new stance, no extra plumbing.
- Confirmed replay bypasses Reveal (`HistoryScene.ts:222` → `Battle` directly); the flow guard is belt-and-suspenders.

### Completion Notes List

- **Code complete + full gate green; on-device acceptance (Task 5's last sub-task) pending — the house pattern, handled at review.**
- **Shell + UX-doc only — no engine, balance, `logVersion`, or golden change.** The pre-resolved-battle architecture (AD-2) is untouched: a tactic change on Reveal just drops the cached log so `Fight!`/`resolve()` recomputes.
- **Flow (`MatchFlow.setTactic`):** now works post-commit — folds the new tactic into `committedSetup.tactics.A` (immutably) and sets `this.log = undefined`. Only side A's tactic changes; side B / armies / placements / leaders are byte-unchanged (pinned by a new test), so no RNG stream is re-drawn — determinism/replay (FR20/AD-10) intact. Guards: rejects the edit in `replay` mode; defensive `'leader'`-without-crown throw.
- **Placement:** the tactic picker (`buildTacticPicker`, `pickerOpen`, its reset + call) is gone; unused imports dropped. Leader crown gesture untouched. Tactic now defaults to `autonomous` at commit.
- **Reveal:** the "You — <tactic>" line is a tap-to-open picker (`renderTactics`); all four tactics enabled (a crown is always committed by Reveal); the "Enemy — <tactic>" line stays static and shifts down while the dropdown is open. `pickerOpen`/`tacticEls` reset in `create()` (singleton discipline).
- **Recorded FR5/FR24 relaxation:** the player's tactic is now chosen after the enemy is revealed (a counter-pick) — conscious PvE call (Danilo 2026-07-20), noted in `EXPERIENCE.md`. Pre-battle half of the deferred mid-battle-tactics north-star (`deferred-work.md`).
- **Tests:** `apps/web/test/match-flow.test.ts` — the old "throws once committed" test rewritten to the new fold-and-invalidate behavior; +side-B-unchanged invariant; +replay-rejected guard. Full suite 570 pass (+2 net).

### File List

- `apps/web/src/flow/MatchFlow.ts` — `setTactic` works post-commit (fold into `committedSetup.tactics.A` + invalidate cached log; replay + leader-crown guards).
- `apps/web/src/scenes/PlacementScene.ts` — removed the tactic picker (`buildTacticPicker`, `pickerOpen`, reset, call) and now-unused imports.
- `apps/web/src/scenes/RevealScene.ts` — added the interactive tactic picker (`renderTactics`, `pickerOpen`, `tacticEls`); replaced the static "You —" label.
- `apps/web/test/match-flow.test.ts` — rewrote/added tactic tests (post-commit fold+invalidate, side-B-unchanged, replay-rejected).
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md` — picker moves Placement→Reveal; recorded FR5/FR24 tactic relaxation.
- `docs/implementation-artifacts/deferred-work.md` — logged the mid-battle-tactics north-star (2026-07-20 section).
- `docs/implementation-artifacts/4-13-tactics-at-the-face-off.md` — this story.
- `docs/implementation-artifacts/sprint-status.yaml` — story added + status.

### Change Log

- 2026-07-20 — **Senior code-review (Opus 4.8, 3 adversarial layers) PASSED.** Acceptance Auditor: all 5 ACs met. No High severity, no wrong-result bug. 1 decision (Danilo: pin You/Enemy adjacent, options drop below — no jump) + 7 patches all applied (resolve/setTactic docstrings; validate-before-mutate; no-op re-select guard; end-to-end determinism test; post-commit `leader` test; dropdown geometry-coupling comment; singleton reset moved above the guard) + 1 deferred (pre-existing Reveal double-resolve → deferred-work.md) + 3 dismissed (unreachable try/catch; "dead" branch whose tests guard a real invariant; no scene test — repo posture). Gate re-run GREEN: 572 tests (+2), typecheck/lint/prettier clean, engine cov 99.42% lines, web build exit 0. Remaining gate: deploy + Danilo's on-device acceptance → done.
- 2026-07-20 — Implemented. Tactic picker moved entirely from Placement to Reveal; `setTactic` folds post-commit changes into `committedSetup.tactics.A` and invalidates the cached log so `Fight!` re-resolves (only side A's tactic changes — determinism/replay intact). First conscious FR5/FR24 "commit blind" relaxation, recorded in EXPERIENCE.md. Shell + UX-doc only; gate green (570 tests, typecheck/lint/build clean). Status → review; on-device acceptance pending.
- 2026-07-20 — Story created (emergent, from the device session). Move the army-tactic picker entirely from Placement to Reveal so a forgotten tactic is editable at the face-off; a post-commit `setTactic` folds into `committedSetup.tactics.A` and invalidates the cached log so `Fight!` re-resolves (only side A's tactic changes — determinism/replay intact). First conscious FR5/FR24 "commit blind" relaxation (tactic chosen after the enemy is revealed), recorded in EXPERIENCE.md. Pre-battle half of the deferred mid-battle-tactics north-star. Shell + UX-doc only; no engine/balance/logVersion change.
