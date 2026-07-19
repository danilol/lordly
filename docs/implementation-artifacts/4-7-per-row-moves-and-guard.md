---
baseline_commit: ecf7d86
context:
  - docs/planning-artifacts/epic-4-dossier/DOSSIER.md
  - docs/adr/0003-battle-stream-draw-order.md
  - docs/planning-artifacts/epics.md
  - docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md
  - docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md
---

# Story 4.7: Per-row moves and Guard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want a unit's row to change what it does, not just how often,
so that placement decides behavior — the deepest placement read yet.

## Acceptance Criteria

1. **The dossier's move table lands as balance DATA, and `act()` dispatches on the (class, row) move — not the class (FR32, AD-12).** Each class/row resolves the move kind the dossier §4 froze (the table is DATA, not code — see Dev Notes for the exact frozen table). `UnitAttacked.kind` is now derived per **(class, row)** — never from the class alone (`CLASS_MOVE_KIND` is retired). The `MoveKind` union gains **`'bash'`** (Phalanx back). New kinds/rows that matter this era: Knight front `2× slash` / mid **Guard** / back `1× slash`; Phalanx front+mid **Guard** / back `1× bash`; Wizard(`mage`)/Sorceress front `1× staff` (**physical, melee targeting** — a weak Staff Attack, NOT the blast) / mid+back `blast`; **everyone else uniform** (only action *counts* vary by row, unchanged). No `logVersion` bump — `kind` and every Guard carrier already shipped in the story-4.2 v4 bump; `balanceVersion` bumps 7→8 for the new `moves` data.

2. **Guard is a one-shot Full/Half damage shield over the guarding unit AND the ally behind it (FR33 — REVISED by Danilo 2026-07-19, supersedes dossier D-2a's redirect).** A unit whose (class, row) move is Guard spends its action to raise a **one-shot guard charge** (emit `GuardRaised { unit }`). The charge shields **two cells: the guarding unit's own cell, and the ally directly behind it** (row = guard's row + 1, same column, same side). The **next single-target PHYSICAL attack that lands (is not dodged) on either shielded cell** is reduced, then the charge is spent (emit `GuardEnded { unit }` at that moment): **Full Guard (Phalanx) → damage `0`** (negated); **Half Guard (Knight) → `max(minDamage, floor(dmg/2))`** (halved). **Magic, heals, and status bypass Guard entirely** (a later unit brings magic-guard — out of scope). It is a **damage-reduction shield, NOT a redirect**: the attacked unit stays the target and takes the reduced/zero damage; the guard itself takes nothing and is not retargeted. Guarding with nobody behind still shields the guard's own cell (legal, useful vs melee/arrows on that cell). A charge unconsumed by engagement end emits `GuardEnded` at the natural engagement end (log-driven, no shell lifecycle rule); a wipe short-circuits it (mirror poison). The reduction takes **zero new `battle`-stream draws** (ADR 0003 — the frozen draw table is unaffected; see AC3). Full-vs-Half is per-class balance DATA.

3. **No redirect → the FR36 dodge/crit draws are unchanged; Guard reduces the FINAL damage as the last pipeline step (ADR 0003, FR36).** Because Guard no longer redirects (this replaces the old "roll vs the guard" item), story 4.6's A3 dodge draw stays keyed to the **actual target's** DEX and A4 crit to the attacker's — exactly as shipped, no change to who rolls. The guard reduction (Full → 0 / Half → floor(dmg/2)) applies **after** the whole FR15 pipeline (`base → blast attenuation → RPS → crit → weaken → clamp`) and after the leader-fall penalty — the **outermost** step, like a post-clamp modifier. A dodged hit (damage already 0) does **not** consume the charge — only a landed hit does. Full Guard sets damage exactly `0` (exempt from the minDamage floor, like a dodge); Half re-clamps to `minDamage`. `missed` stays reserved/unused; magic still never crits, dodges, or is guarded. **ADR 0003 + dossier D-2a get a prose amendment** (redirect → negate/halve shield); the frozen draw ORDER/COUNT and every shipped 4.6 golden are untouched (Guard still adds zero draws and never reorders).

4. **The player surfaces show per-row moves, and the battle scene reads move kinds from the payload (FR2, AD-2, AD-12, UX-DR2/3).** Draft spec cards (`classRulesCard`) and `docs/rules.md` show each class's per-row moves + the Full/Half Guard mechanic (drift guard green). The battle scene renders **distinct move kinds visibly** and a Guard **reads differently from an attack**: `attackFlavor` reads `UnitAttacked.kind` from the payload (the class-inference at `BattleScene.ts:442` is the FR32 bug this story fixes — AD-2, the scene derives nothing); `GuardRaised` shows the guard-stance marker (`{components.guard-marker}` 🛡) which clears on `GuardEnded`; and a **guarded hit reads as a block** — the shielded target flashes/shows the reduced-or-zero number with a shield beat attributing the guard (the `redirectedFrom` payload carries the **guarding unit's id** so the scene can attribute the block — see Dev Notes), ≥300ms, reduced-motion damped (UX-DR6). Both themes, numbers ≥14px. (The full move-name *plate* with action pips is FR39b — story **4.11**'s action ledger — NOT this story; 4.7 delivers the move-kind flavor + Guard reads only.)

5. **Determinism, goldens, sweep (FR20, NFR4, AD-8).** Every move rule and the Guard shield (Full negate, Half halve, self + behind, one-shot, consume-on-landed-hit) are unit-tested; a property test pins that a guarded hit consumes **zero** extra `battle` draws (the two-streams-agree idiom — the shield is post-pipeline, the draw sequence is frozen). All **9 goldens re-record** (physical `kind` is now per-row; Guard adds `GuardRaised`/`GuardEnded` and reduced-damage hits carrying `redirectedFrom`) — audited event-by-event; a **new golden** exercises a Full Guard negating an arrow aimed at the ally behind. `balanceVersion` bumps 7→8 (hash re-pinned: the `moves` table + the Half-guard ratio). The **both-mode sweep (single + wipeout) stays in the ≤65% band** — Full Guard hard-negates hits and Wizard-front loses its blast, so a pool re-tune is likely; re-run and record the converged numbers, keeping the wardens melee-viability floor honest. `events.test.ts`'s per-class `EXPECTED_KIND` map becomes per-(class, row), and its `redirectedFrom`-is-undefined assertion is updated.

## Tasks / Subtasks

- [x] **Task 1: Engine — the per-row move table as balance data (AC: 1)**
  - [x] Add `'bash'` to `MoveKind` (`types.ts:170`) — the doc comment already reserves it. `MoveKind` is a payload value, not an event; adding a literal is NOT a `logVersion` change.
  - [x] Add a per-row `moves` field to `ClassStats` (`balance.ts:22-36`), keyed exactly like `actions`: `moves: { front: RowMove; mid: RowMove; back: RowMove }` where `RowMove = MoveKind | 'guard-full' | 'guard-half'` (define the small type in `types.ts`; the guard values are non-attack behaviors, deliberately NOT `MoveKind`s since they never ride `UnitAttacked.kind`). Populate every class from the frozen table (Dev Notes) — Knight mid = `'guard-half'`, Phalanx front+mid = `'guard-full'`. "Everyone else" repeats its uniform kind across all three rows (e.g. archer `arrow/arrow/arrow`) — explicit data, so the table is total and the drift guard can read it.
  - [x] Add the Half-guard ratio to `BALANCE.formulas`: `guardHalf: { num: 1, den: 2 }` (a `Ratio`, like `critMultiplier`). Full guard needs no ratio — it sets damage to `0`.
  - [x] `balance.ts` `version` 7 → 8; add `8: '<hash>'` to `test/balance-hash.test.ts` (compute via a one-off `contentHash(BALANCE)`).

- [x] **Task 2: Engine — `act()` dispatches on the move, not the class (AC: 1)**
  - [x] Retire `CLASS_MOVE_KIND` (`resolve.ts:397-410`). Derive the acting unit's move from `BALANCE.classes[unit.class].moves[ALL_ROWS[unit.rowIndex]]` and branch on it:
    - `slash` / `bash` → physical **melee** (`selectMeleeTarget`, `physicalDamage`), `kind` = that value.
    - `arrow` → physical **ranged** (`selectRangedTarget`), `kind: 'arrow'`.
    - `staff` → physical, and for **Wizard/Sorceress front it uses MELEE targeting** (dossier §4 "melee targeting" — distinct from the Cleric's existing global staff fallback, which stays ranged). `kind: 'staff'`.
    - `blast` → the existing row-blast (magic; `blastDamage`; leader-row rule under Attack Leader).
    - `guard-full` / `guard-half` → raise a Guard charge (Task 3) — no attack, no `UnitAttacked`.
  - [x] Set `UnitAttacked.kind` from the resolved move at the single write site (`strike()`, `resolve.ts:493`) — thread the kind in (or compute inside `strike` from `source.rowIndex`, since `UnitState.rowIndex` is available). The misfire physical path (`resolve.ts:341-357`) shares `strike()` — its `kind` becomes row-derived through the same change; a confused physical attacker's misfire keeps its row's melee kind.
  - [x] Cleric heal/staff, Witch cast, and the confusion misfire branches keep their current behavior — only the move-KIND label and the new Guard/Wizard-front-staff branches change. Autonomous non-guard, non-front-staff paths must stay bit-identical except for the `kind` string.

- [x] **Task 3: Engine — the Full/Half Guard shield (one-shot, self + behind) (AC: 2, 3)**
  - [x] Add per-unit Guard state to `UnitState` (`resolve.ts:21-38`), e.g. `guard: 'full' | 'half' | undefined` (a live one-shot charge; init undefined in `buildUnits`). When an acting unit's move is `guard-full`/`guard-half`: set `unit.guard` to `'full'`/`'half'` and emit `GuardRaised { unit }`; the action is spent with no attack. Re-raising (a Phalanx front's 2nd action, or a later pass after the charge was spent) sets a fresh charge + emits `GuardRaised` again — the charge is a one-shot, so re-arming is legal and expected.
  - [x] **Consume on a landed hit (the redirect is GONE — this is a damage shield).** At every physical single-target strike site (melee, archer, cleric-staff, Wizard-front-staff, misfire physical-on-ally), the target stays the target — do NOT swap it, do NOT change what `rollHit` sees. After the damage is fully computed for a **landed (non-dodged)** hit, check whether the target is shielded: the target itself has a live `guard`, OR a living ally directly in front of it (at `(target.rowIndex - 1, target.colIndex)`, same side) has a live `guard`. If shielded, reduce the final damage — `full` → `0` (exempt the minDamage floor), `half` → `max(minDamage, floor(dmg/2))` — consume that charge (set the guarding unit's `guard = undefined`, emit `GuardEnded { unit: guardUnitId }`), and set `redirectedFrom` on the `UnitAttacked` to the **guarding unit's id** (attribution for the shell; see Dev Notes — amend the field comment). A dodge (damage already 0) does NOT consume a charge. Magic/heal/status never trigger this.
  - [x] Ordering: the shield reduction is the **outermost** damage step — after `physicalDamage`/`leaderPenaltyPhysical` (and its re-clamp) return. Prefer a single shared helper `applyGuard(finalDamage, target, units) → { damage, guardedBy? }` called at each physical strike site, mirroring how `rollHit`/`leaderPenaltyPhysical` are single-sourced. `strike()` gains an optional `redirectedFrom?: UnitId` param written into the event at `resolve.ts:493`.
  - [x] At the **natural** engagement end (the poison-tick seam / between-engagement reset, `resolve.ts:86-96` + `:156-175`), emit `GuardEnded { unit }` for every unit still holding a live charge and clear it — an instant wipe short-circuits and skips it (mirror poison). Charges reset each engagement (re-raised when the unit next acts).
  - [x] Zero new `battle` draws — the shield is pure post-pipeline arithmetic (ADR 0003; frozen draw table unaffected).

- [x] **Task 4: Engine — tests (AC: 1, 2, 3, 5)**
  - [x] New `test/guard.test.ts` (mirror `leader.test.ts`): `GuardRaised` on raise (right moment), `GuardEnded` on consume AND on engagement-end expiry (living, skipped on wipe); Full negates an arrow aimed at the ally behind (target takes 0, `redirectedFrom` = guard); Half halves it; the shield also covers the guard's OWN cell; magic/heal/status bypass; a dodge does NOT consume the charge; one-shot — a 2nd attack the same engagement is unshielded until re-raised; re-raise on a later action arms a fresh charge; misfire-onto-a-shielded-ally is reduced (proven via the ARBITRARY-battle replay-invariant property test, not a hand-seeded misfire fixture — see Completion Notes); Half re-clamps to `minDamage`, Full is exactly 0.
  - [x] `test/crit-dodge.test.ts`: add a "a guarded hit consumes zero extra `battle` draws" pin (two-streams-agree idiom) — the shield is post-pipeline, the frozen draw sequence must not move.
  - [x] `test/damage.test.ts`: Wizard/Sorceress front staff arithmetic (physical STR-based) rows.
  - [x] `test/roster.test.ts`: per-(class,row) move-kind coverage — every class×row resolves the frozen move; property/table over `ALL_CLASSES × ALL_ROWS`.
  - [x] `test/events.test.ts`: `EXPECTED_KIND` (currently per-class, `:129-141`) becomes per-(class,row); the `redirectedFrom` is-undefined assertion (`:149`) updated to allow guarded hits carrying the guard's id; union-membership test still 16 (no new event).

- [x] **Task 5: Engine — goldens + sweep (AC: 5)**
  - [x] Re-record all 9 goldens (`pnpm --filter @lordly/engine test -u`), audit event-by-event: physical `kind` now per-row; Guard adds events; Wizard-front-staff and Knight-mid guard-half change outcomes. Add a NEW golden: a Phalanx **Full** guard negating an arrow aimed at the ally behind it (target damage `0`, `redirectedFrom` = the Phalanx, `GuardRaised` + `GuardEnded`-on-consume present). (A Knight **Half** guard halving a hit is exercised in `guard.test.ts`, not folded into the same golden — the "ideally" was a nice-to-have, not an AC.)
  - [x] Re-run `pnpm --filter @lordly/engine sim -- --runs=100` in **both** modes; hold ≤0.65. Guard tankified fronts and Wizard-front lost its blast as predicted — `farshot` broke 65% in wipeout (65.4%); re-tuned by moving one archer front→exposed (mirrors the 4.4 `gale` re-tune), converged wipeout max 60.6% (longbows), single max 60.4% (cabal). Re-derived the `sim.test.ts` hand-derived anchor by hand (verified via a scratch trace, not pasted from the failing diff) — 10%/100% now (was 10%/96%: the mid knights guard instead of striking the mid mages, so B's mid pair is never touched).

- [x] **Task 6: Shell — battle scene renders move kinds + Guard reads (AC: 4)**
  - [x] `BattleScene.attackFlavor`: reads `event.kind` from the payload instead of inferring from `attacker.cls` — the FR32 fix (AD-2). Maps each `MoveKind` to its flavor; `bash`/`slash`/`staff` are melee-style, `arrow`/`blast` keep their travel.
  - [x] `GuardRaised`: the placeholder `'guards'` popup is replaced by a persistent shield marker (`{components.guard-marker}` 🛡, new `GUARD_MARKER_GLYPH`/`GUARD_MARKER_COLOR` constants) via a dedicated `applyGuardMarker`/`removeGuardMarker` pair (separate field from `statuses`, since Guard isn't a `SpellKind`); `GuardEnded` removes it — now a real visual change (`render` returns `true`, not silent), firing on both consume and natural-end expiry.
  - [x] `UnitAttacked`: when `event.redirectedFrom` is present, a new `guardFlash` (a shield-colored ring pulse, ≥300ms, damped under `reduceMotion`) replaces the plain hurt-flash, and the popup carries the `GUARDED` caption (new constant) instead of `CRITICAL`/`DODGE` — distinct from both a plain hit and a dodge.
  - [x] `narration.ts`: extended the `UnitAttacked` case to name the guardian and distinguish a full block ("guard holds, fully blocked!") from a halved one ("guard halves it to N — before→after HP"); two new narration tests added.

- [x] **Task 7: Shell — draft cards + rules.md show per-row moves (AC: 4)**
  - [x] `draftModel.ts` `RulesCard` gained a `moves` field (`stats.moves`, redundant-but-named for card consumers) plus two exported helpers (`movesVaryByRow`, `moveLabel`); `DraftScene.ts` renders a compact `Front X · Mid Y · Back Z` line, gated to the four classes whose move actually varies (Knight/Phalanx/Wizard/Sorceress) — the DETAIL panel has no room for a restated uniform line on the other seven. `CLASS_TEXT` behavior prose updated for those four classes to name the row split.
  - [x] `docs/rules.md`: a "Rows matter" per-row-moves paragraph + a new "## Guard" section (Full negates completely, Half halves, one-shot, self + ally-behind, magic/status bypass, dodge doesn't consume). `rules-doc.test.ts` gained a drift-guard block pinning the four varying classes' exact `BALANCE.classes[*].moves` values, that every OTHER class stays uniform, and the Half ratio (`BALANCE.formulas.guardHalf` must be exactly 1/2 for the "halves" wording to hold).
  - [x] Amended `docs/adr/0003-battle-stream-draw-order.md` (Guard's zero-draws line + an explicit "Amendment" blockquote) and `docs/planning-artifacts/epic-4-dossier/DOSSIER.md` (D-2a decision-log entry marked SUPERSEDED with a pointer; §4's Guard section gained a full "Amendment" subsection describing the Full/Half shield; the move table's Guard cells now say `(Full)`/`(Half)`; §5's `redirectedFrom` union-extension row updated to the repurposed meaning) — both preserve the original text with a dated amendment note rather than silently rewriting history.

- [x] **Task 8: Gate + device sign-off (all ACs)**
  - [x] Full gate GREEN: typecheck (both packages), eslint + prettier clean, `pnpm coverage` — 490 tests passed across 39 files, engine `src` at 99.57% lines / 94.44% branches (well above the 90% gate; the one uncovered resolve.ts line is the pre-existing idle-`skip()` helper, unrelated to this story), `pnpm --filter web build` succeeds. All 9 goldens + the new golden #10 re-recorded and reviewed event-by-event (see Completion Notes). Both-mode sweep in band (see Task 5).
  - [x] Danilo device session: Guard reads clearly (shield marker + a guarded hit visibly blocked — Full shows a negated 0, Half a reduced number), move kinds read distinctly, both themes at 360px. **DEVICE-ACCEPTED 2026-07-19 (Danilo: "I like it").** One device fix applied first: the Draft detail panel's per-row move line was STACKING on the prose behavior line and overflowing into the matchup chips — for the four row-varying classes it now REPLACES the prose line (one text block, compact `F/M/B` prefixes) instead of adding a second. Shield marker read confirmed good on device.

### Review Findings

Senior code review 2026-07-19 (Sonnet 5, 3-layer: Blind Hunter + Edge Case Hunter + Acceptance Auditor). No High findings — the engine core (guardian geometry, consume ordering, zero-draws, engagement-boundary expiry) is sound. 1 decision, 4 patches, 2 deferred, ~10 dismissed as non-issues.

- [x] [Review][Decision→Patch] Confused front-row Wizard/Sorceress self-blasts instead of doing its new single-target staff — RESOLVED (Danilo: single-target staff on an ally). `misfire()` now dispatches on the (class,row) move: a front-mage (`move === 'staff'`) misfires as a physical single-target strike on a random ally (row-consistent), mid/back keep the self-blast. Clean under ADR 0003 (a misfired physical single-target attack is already a defined A2+A3/A4 draw site — no frozen-table change). Zero re-derivation (no golden/sweep/existing-test places a front-row mage). New `confusion.test.ts` pin locks it (seed 1, wipeout). [`resolve.ts:394-410`]
- [x] [Review][Patch] Full-Guard block renders a `-0` floating number → now shows `0` when damage is 0 [`apps/web/src/scenes/BattleScene.ts:341`]
- [x] [Review][Patch] `RowMove` type not exported from the engine barrel → added (AD-4) [`packages/engine/src/index.ts`]
- [x] [Review][Patch] `movesVaryByRow` hardcoded `{knight,phalanx,mage,sorceress}` → now derived from `BALANCE.classes[*].moves` (single source of truth) [`apps/web/src/flow/draftModel.ts`]
- [x] [Review][Patch] The min-damage property test's overclaiming comment → tightened to point at `guard.test.ts` for the exact per-tier floors [`packages/engine/test/combat.test.ts`]
- [x] [Review][Defer] `attackMoveOf` casts `moves.back` to `MoveKind` with no guard against a future tuning table giving a class a back-row Guard tier [`packages/engine/src/resolve.ts:451-455`] — deferred, latent (safe for the current frozen table; revisit at the move-table tuning pass)
- [x] [Review][Defer] Overlapping guards on one cell (own Half + a front-ally's Full) — the target's own weaker charge is consumed first and the stronger front charge is wasted; unspecified tie-break [`packages/engine/src/resolve.ts:466-473`] — deferred, narrow + deterministic (needs a Phalanx-front + Knight-mid same-column double-guard; revisit at the tuning pass)

## Dev Notes

### THE MOVE TABLE (dossier §4 baseline — DATA, not code; values are TUNABLE with Danilo)
| Class | Front | Mid | Back |
|---|---|---|---|
| Knight | `slash` (2×) | **`guard-half`** | `slash` (1×) |
| Phalanx | **`guard-full`** | **`guard-full`** | `bash` (1×) |
| Wizard (`mage`) | `staff` (physical, **melee targeting**) | `blast` | `blast` (2×) |
| Sorceress | `staff` (physical, **melee targeting**) | `blast` | `blast` (2×) |
| Everyone else (mercenary/berserker/ninja/valkyrie, archer, cleric, witch) | uniform | uniform | uniform |

Row governs only the action *count* (FR15, unchanged) for "everyone else" — the move KIND is uniform for them. Only Knight, Phalanx, Wizard, Sorceress vary their move by row. This table is the dossier's "start generic" baseline — **Danilo wants to fine-tune the per-class/per-row moves AND counts (e.g. a front Wizard's 1× staff vs a back Wizard's 2× blast)** as a follow-up design pass; treat the values as sweep-policed balance DATA, not frozen. Land the STRUCTURE (per-row `moves` + Full/Half Guard) in this story; refine the exact assignments with Danilo during dev/device. [Source: DOSSIER.md#§4, D-2b; Danilo 2026-07-19] The `moves` data must be written for every class×row (repeat the uniform kind) so the table is total and the FR2 drift guard reads real data.

### "Shield Cover" (epics/PRD) is STALE — the move table overrode it
The epics AC and PRD FR32 example say "back Knight Shield Cover." The table says back Knight = `1× slash` (an attack). The **defensive rows are Knight-MID (`guard-half`) and Phalanx front+mid (`guard-full`)**, and Phalanx **back** = `bash` (an attack). There is no "Shield Cover" move. [Source: DOSSIER.md#§4 vs epics.md#Story-4.7; prd.md#FR32]

### Guard is a Full/Half DAMAGE SHIELD — REVISED by Danilo (2026-07-19), supersedes dossier D-2a
The dossier D-2a decided a *column-bodyguard REDIRECT* (attack retargets onto the guard). **Danilo replaced that** with a cleaner two-tier shield (confirmed this session — "one attack only" + "protects the ally behind too"):
- A Guard move raises a **one-shot charge** that shields **the guarding unit's own cell AND the ally directly behind it** (row+1, same column).
- The **next landed single-target physical attack** on either shielded cell is reduced — **Full (Phalanx) → 0**, **Half (Knight) → floor(dmg/2)** — then the charge is spent (`GuardEnded`).
- **No redirect**: the attacked unit stays the target and takes the reduced/zero damage; the guard takes nothing. Magic/heals/status bypass (a future unit brings magic-guard).
This is NOT the dossier's redirect and NOT the PRD's "raise mitigation for the engagement." **Amend dossier D-2a + §4 to record the Full/Half shield** as part of this story's doc pass. [Source: Danilo 2026-07-19 design decision; supersedes DOSSIER.md#§4/D-2a]

### The shield is POST-pipeline — 4.6's dodge/crit draws are untouched (ADR 0003 stays safe)
Because there is no redirect, the attacked unit remains the target: story 4.6's A3 dodge (vs the target's DEX) and A4 crit (attacker) roll **exactly as shipped** — the frozen draw order/count does not move, and 4.6's goldens are unaffected. The Full/Half reduction is the **outermost** damage step, applied after `physicalDamage`/`leaderPenaltyPhysical` return (Full → 0, exempt from the minDamage floor like a dodge; Half → `max(minDamage, floor(dmg/2))`). A dodged hit (already 0) does not consume the charge. **The old ADR 0003 "Guard interception (deterministic redirect … roll vs the GUARD)" line is now inaccurate — amend it (prose only) to "Guard = post-pipeline Full/Half damage reduction; zero draws; the protected unit stays the target so A3/A4 are unchanged."** The frozen draw TABLE (E1/A1–A4) is untouched; this is a description fix, not a resequencing. [Source: docs/adr/0003-battle-stream-draw-order.md; 4-6-crits-and-dodge.md; Danilo 2026-07-19]

### Item 3 (the old "RPS recomputes against the guard") is GONE
Under the retired redirect model, an attack retargeted to the guard, so RPS/dodge/crit resolved against the guard — that was the old AC3. With the shield model there is no retarget: RPS/dodge/crit resolve against the **actual target** as normal, and the guard only softens the final number. There is nothing to recompute. (This is what Danilo meant by "re-read item 3.")

### No logVersion bump — the union carriers all shipped in 4.2
`UnitAttacked.kind`, `redirectedFrom`, `GuardRaised`, `GuardEnded` are all in the `LOG_VERSION` 4 union (story 4.2, AD-15's single era bump) — 4.7 EMITS them, does not bump. `MoveKind` gaining `'bash'` is a type widening on an existing payload field, not a new event. Only `balanceVersion` bumps (7→8, for the `moves` data). [Source: types.ts:155-170, 328-346; ARCHITECTURE-SPINE.md#AD-15]

### `act()` dispatch must become move-driven — the heart of the story
Today `act()` (`resolve.ts:243-321`) switches on `unit.class`; row only affects action count. This story makes behavior depend on **(class, row)** via the `moves` table. The Wizard is the sharpest case: front = a physical melee-targeted staff attack, mid/back = the magic blast — the SAME class does physically different things by row. Knight mid Guards instead of slashing. This is "the table is data, not code" — dispatch on the looked-up move, keep the class switch only where a move maps to class-specific targeting (e.g. cleric heal vs staff). [Source: engine research map; resolve.ts:243-321, 397-410]

### Guard's action economy — the one real open question
Knight-mid = 1 action (Guards once, clean). **Phalanx-front = 2 actions**, both `guard` — the stance is engagement-long, so the 2nd action can't raise it again. Default: `GuardRaised` fires once on the transition; a `guard` action while already guarding is spent with no new event (the loop still decrements `actionsLeft`). Confirm on device / at review — the alternative (an `ActionSkipped 'idle'`) narrates as "waits," which may read wrong for a guard holding the line. [Source: DOSSIER.md#§1 action counts, §4; dossier does not state the repeat-Guard rule]

### Previous-story intelligence (4.6, shipped ecf7d86)
4.6 established the exact seams this story extends: `strike()` already threads `leaders`/`leaderFallen`/`roll?` and is the single `UnitAttacked` write site — add `redirectedFrom` there the same way. `rollHit(attacker, defender, battle)` stays keyed to the **actual target's** class — the shield does NOT change what `rollHit` sees (no redirect); the Full/Half reduction happens after, on the computed damage. The "two-streams-agree" idiom (`crit-dodge.test.ts:20-31`) is the tool for the zero-extra-draws Guard pin. Every seeded golden/anchor re-derives when battle behavior shifts (4.6 re-derived 6 anchors + 5 goldens) — expect the same breadth here, and audit that magic/heal/poison values stay coherent. The `rules-doc.test.ts` drift-guard pattern (leader block `:76-81`, crit block `:83-87`) is the template for the moves/Guard pins. [Source: 4-6-crits-and-dodge.md File List + Dev Notes]

### Shell: 4.7 is move-kind FLAVOR + Guard reads — NOT the full move-plate
The EXPERIENCE "move-name plate" (gold plate over the actor, naming the move + action pips fed by `PassStarted.actionsRemaining`) is **FR39b — the action ledger, story 4.11** (the dossier §6 "the action ledger IS the move-name plate", D-3a). 4.7's shell scope is narrower: (a) `attackFlavor` reads `kind` from the payload so kinds read distinctly, (b) the Guard shield marker + step-in interception. Don't build the pip-carrying plate here. [Source: EXPERIENCE.md#Epic-4-extension; DOSSIER.md#§6 D-3a; epics.md#Story-4.11]

### The attackFlavor class-inference is the FR32 bug to fix
`BattleScene.ts:442` derives `kind` as `attacker.cls === 'archer' ? 'arrow' : attacker.cls === 'mage' ? 'blast' : 'melee'` — with per-row moves this is wrong (a front Wizard staffs, not blasts; a Phalanx bashes). Read `event.kind` (AD-2: the scene renders payload, never re-derives). [Source: BattleScene.ts:438-446]

### `redirectedFrom` is repurposed to attribute the block (no union change)
Under the old redirect model, `UnitAttacked.redirectedFrom` meant "the original target the bodyguard stepped in front of." With the shield model there is no retarget, so this story repurposes the field to carry **the guarding unit's id** on a guarded hit — the shell reads it to attribute the block (shield flash + marker) to the right unit. **Amend the field's doc comment** (`types.ts:252-258`) to the new meaning. This is a comment change on an as-yet-unemitted field, not a union-structure change → **no `logVersion` bump**. If a cleaner signal is wanted later, that's a future union extension (a new era's bump), not this story.

### What's explicitly OUT of scope
No magic-guard (a future unit — this story's Guard is physical-only, magic bypasses). No move-plate with pips (4.11). No Golem (4.8 — "everyone else", uniform melee kind when it lands). No `missed` (reserved). Magic never crits/dodges/is-guarded. The full per-class move+count fine-tuning is a follow-up design pass with Danilo (land the structure now). No new RNG stream, no `logVersion` bump. [Source: DOSSIER.md; ADR 0003; Danilo 2026-07-19]

### Project Structure Notes
- Engine: `src/types.ts` (`MoveKind` +`'bash'`, `RowMove` type, `redirectedFrom` comment amend), `src/balance.ts` (`ClassStats.moves`, `formulas.guardHalf`, `version` 7→8), `src/resolve.ts` (move-driven `act()`, retire `CLASS_MOVE_KIND`, `UnitState.guard`, `GuardRaised`/`GuardEnded` emission, the `applyGuard` shield helper, `strike()` `redirectedFrom` param). Tests: new `test/guard.test.ts`; `test/{crit-dodge,damage,roster,events,combat,sim,golden}.test.ts` + `__snapshots__`; `test/balance-hash.test.ts`.
- Shell: `apps/web/src/scenes/BattleScene.ts` (attackFlavor kind-from-payload, Guard marker, guarded-hit block read), `src/flow/narration.ts` (guarded-hit line), `src/flow/draftModel.ts` (+`moves` on the card), `src/scenes/DraftScene.ts`. Tests: `apps/web/test/{narration,rules-doc,draft-model}.test.ts`.
- Docs: `docs/rules.md` (moves + Guard section), `docs/adr/0003-battle-stream-draw-order.md` + `docs/planning-artifacts/epic-4-dossier/DOSSIER.md` (prose amend: redirect → Full/Half shield).
- Docs: `docs/rules.md` (per-row moves + Guard section).
- `logVersion` stays 4; `balanceVersion` 7→8; no new dependencies; no new RNG stream.

### References
- [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md#§4] — the move table (D-2b) + Guard mechanic (D-2a); §5 union carriers; §6 UX walk (move-name plate D-3a, guard marker + step-in).
- [Source: docs/adr/0003-battle-stream-draw-order.md] — Guard takes zero draws (its Guard line describes the retired redirect — amend it per this story; the frozen A1–A4 order is untouched).
- [Source: docs/planning-artifacts/epics.md#Story-4.7] — the BDD ACs (note the stale "Shield Cover" example).
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md] — FR32 (per-row moves), FR33 (Guard), FR2 (draft cards), FR14 (role relations + ≤65% both-mode band), FR39d (from→to).
- [Source: ARCHITECTURE-SPINE.md] — AD-12 (one event/action, move-kind id, Guard outcomes), AD-2 (scene derives nothing), AD-15 (one logVersion/era), AD-8 (balanceVersion/hash).
- [Source: packages/engine/src/types.ts] — `MoveKind` (170), `GuardRaised`/`GuardEnded` (333-346), `UnitAttacked.kind`/`redirectedFrom` (252-258), `LOG_VERSION` 4.
- [Source: packages/engine/src/resolve.ts] — `act()` (243-321), `CLASS_MOVE_KIND` (397-410, retire), `strike()` (457-493, single `UnitAttacked` write at 493), `UnitState` (21-38), `buildUnits` (646-651), reset/poison seams (86-96, 156-175), `rollHit`/`leaderPenaltyPhysical`.
- [Source: packages/engine/src/balance.ts] — `ClassStats` (22-36), `actions` precedent (31), `formulas` (176-193), `version` (137).
- [Source: apps/web/src/scenes/BattleScene.ts] — `attackFlavor` class-inference bug (442), GuardRaised/Ended cases (363-369), status-icon infra (520-537), melee-lunge tween (446-462).
- [Source: apps/web/src/flow/narration.ts] — GuardRaised/GuardEnded lines (102-106), UnitAttacked case (59-72).
- [Source: apps/web/src/flow/draftModel.ts] — `classRulesCard`/`RulesCard` (7-66).
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md] — `{components.move-plate}` (147), `{components.guard-marker}` 🛡 (157).
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md#Epic-4-extension] — move-name plate + Guard shield marker/step-in bullets.

## Guard design — DECIDED with Danilo (2026-07-19)

- **Full (Phalanx) negates / Half (Knight) halves** the next physical hit on a shielded cell. ✓
- **One-shot** — consumed by the first landed physical hit, then re-armable on a later action. ✓
- **Shields the guarding unit AND the ally directly behind it** (self + behind). ✓
- **No redirect** — the guard doesn't take the hit; the target takes the reduced number. ✓
- Magic-guard is a future unit; this Guard is physical-only, magic bypasses. ✓

## Open questions for Danilo (not blockers; sensible defaults chosen — confirm on device)

1. **Phalanx front (2 actions) re-arming.** Default: each Guard action emits `GuardRaised` and sets a fresh one-shot charge — so a 2-action front Phalanx is effectively "always guarding" until a hit gets through between its actions. Confirm this feels right.
2. **Guarded-hit visual.** Default: a shield flash on the shielded target + the reduced/`0` number, distinct from a plain hit and a dodge. Confirm it reads as "the guard held" on device.
3. **Half-Guard flooring.** Default: `max(minDamage, floor(dmg/2))` (a halved hit still deals ≥1); Full is exactly 0. Confirm.
4. **Wizard/Sorceress front staff targeting.** Dossier says "melee targeting" (nearest reachable), distinct from the Cleric's global staff. Default: melee targeting. Confirm the feel.
5. **Move/count fine-tuning (your ask).** The per-class/per-row move+count table lands as tunable DATA this story; we'll refine the exact assignments together during dev/device. Tell me which classes/rows to revisit first.
6. **Golem move kind** (arrives 4.8, not now): filed under "everyone else" (uniform); 4.8's create-story pins the literal.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 — dev-story workflow.

### Debug Log References

- **Balance hash (AD-8):** `balanceVersion` 7 → 8, new content hash `249d336f` pinned in `balance-hash.test.ts` (computed via a one-off `contentHash(BALANCE)`). New data: the per-class `moves` table + `guardHalf {1,2}`.
- **Guard is gated on `roll !== undefined`, not a new param:** `strike()` already distinguished physical-single-target calls (which pass the ADR-0003 `roll`) from magic/blast calls (which don't) — Guard eligibility coincides EXACTLY with that existing gate, so `applyGuard` needed no extra "is this guardable" flag threaded through.
- **Downstream re-derivation (Knight's mid row now Guards instead of striking — every WALL-using fixture with a mid knight shifted):** `combat.test.ts` hand-derived judging test A87/B75→**A87/B82** (B no longer takes the two mid knights' 20-dmg swings) + the min-damage property now also exempts a Full-Guard-negated hit (damage 0, `redirectedFrom` set); `resolve.test.ts`'s AGI-pass-order test needed `GuardRaised` added to its actor-extraction helper (a Guard-row turn produces no `UnitAttacked`/`ActionSkipped`, so it silently vanished from the turn list without this); `resolve.test.ts`'s determinism anchor and `sim.test.ts`'s knight-wall-vs-mage-battery anchor both moved 10%/96%→**10%/100%** (B's mid mages, no longer struck by A's mid knights, hold full HP); `wipeout.test.ts`'s `knightsVsMercs` grind now runs **5 engagements** (was 4) at **A55%/B0%** (was 65%/0%); `wipeout.test.ts`'s `knightsVsClerics` equilibrium moved **A96%/B81%** (was 98%/77% — B takes less chip, holds even more comfortably); `ai.test.ts`'s seed-1 anchor placement updated for the `farshot` re-tune (see sweep note below).
- **Goldens (`vitest -u`, audited event-by-event):** #1/#6/#7 verdicts moved per the `wipeout.test.ts` derivations above (WALL-using fixtures); #3 (mirrored knight walls) stays a draw — Guard fires identically on both mirrored sides, so the symmetry (and the zero-crit/dodge seed pin from 4.6) survives untouched; #4 gained a real, unplanned Guard interaction — B:3 (a Knight placed mid-left in that fixture) Guard-halves and shields B:0 (the ally directly behind it, back-left) from A:1's arrow (30→15), a live demonstration of the ally-behind case that changed the death-order surrounding numbers but NOT the qualitative story (deaths, LeaderFell position unchanged) — audited and it's correct, not a regression. #2/#5/#8/#9 byte-unchanged (no Guard-eligible row in those fixtures). **NEW golden #10** — a Phalanx Full Guard (front-center) negating an arrow aimed at the archer directly behind it (mid-center), under a `leader` tactic that forces the shot onto that exact cell.
- **Both-mode sweep re-tune (predicted by the story, confirmed):** wipeout's `farshot` broke the 65% band (65.4%) — Guard tankified the knight-heavy rivals it used to lose ground to, and Wizard-front losing its blast weakened the mage-fronted rivals too, leaving farshot (no front-row melee at all) relatively stronger. Moved farshot's first archer mid-left → front-left (exposing it as a screen — mirrors the 4.4 `gale` re-tune precedent). Converged: single max 60.4% (cabal), wipeout max 60.6% (longbows); wardens (melee floor) stays viable + non-dominant (33.5% single / 47.2% wipeout).
- **Gate:** 490 tests (all packages), typecheck clean (both packages), eslint + prettier clean, `pnpm coverage` — engine `src` 99.57% lines / 94.44% branches (≥90% gate), `pnpm --filter web build` succeeds.

### Completion Notes List

- **Engine (Tasks 1–3):** `ClassStats.moves: {front,mid,back}: RowMove` (new `RowMove = MoveKind | 'guard-full' | 'guard-half'` type) populated for every class from the frozen table; `MoveKind` gained `'bash'`. `act()`'s per-class switch now looks up the row's move and branches on it (guard rows call the new `raiseGuard`; Wizard/Sorceress front routes to a melee-targeted physical staff strike instead of the blast); `CLASS_MOVE_KIND` retired. `strike()` gained explicit `kind`/`units` params (kind is now caller-resolved, never re-derived) and the Guard shield check (`applyGuard`, gated on `roll !== undefined` — exactly the existing physical-single-target eligibility, no new flag needed): Full negates to 0 (exempt from minDamage, like a dodge), Half re-clamps to minDamage, consumption emits `GuardEnded` + sets `redirectedFrom` to the guardian's id. `UnitState.guard` persists per-unit; a confused unit's misfire (which never raises Guard) falls back to its class's back-row move when its own row would Guard (`attackMoveOf`) so it always has a valid strike kind. Guard charges expire at every engagement's natural end (in the same `wiped === undefined` block as poison, so a mid-pass wipe short-circuits it identically). `balanceVersion` 7→8. `logVersion` UNCHANGED (all v4 union carriers shipped in 4.2).
- **Tests (Task 4):** new `test/guard.test.ts` — two hand-verified concrete fixtures (a Phalanx shielding the ally behind it, re-arming, and expiring unconsumed; a Knight shielding its own cell with the re-clamp visible) PLUS a `matchSetupArb` replay-invariant property test that reconstructs Guard liveness from the event stream and checks tier-consistent damage, magic/dodge bypass, and reachability of both tiers and the ally-behind case across arbitrary battles — this is what actually proves the one-shot/re-arm/misfire-interaction properties broadly, not just in the two seeded fixtures (a hand-seeded "confused unit's misfire lands on a guarded ally" fixture turned out to be impractical to construct deterministically; the property test covers this path instead, since misfire shares the same `strike()` call site). `crit-dodge.test.ts` gained a manual-replay pin proving a guarded battle's outcomes are exactly predicted by "E1 once + 2 draws/hit" — if Guard had consumed any stream draws, the replay would desync from the second hit onward. `damage.test.ts`/`roster.test.ts`/`events.test.ts` updated per the story's exact instructions (Wizard/Sorceress front-staff arithmetic table, a frozen (class,row)→move table test, and per-row `EXPECTED_KIND` + a `redirectedFrom`-is-a-real-unit assertion, respectively).
- **Shell (Tasks 6–7):** `attackFlavor` reads `event.kind` (the FR32 bug fix); a real Guard marker (🛡, own field — not the spell-keyed `statuses` map) applies/clears on `GuardRaised`/`GuardEnded`; a guarded hit gets its own visual (a shield-ring pulse + a `GUARDED` caption) distinct from a plain hit, a crit, and a dodge. `narration.ts` names the guardian and distinguishes a full block from a halved one. Draft cards show a compact per-row breakdown line for the four classes whose move varies (Knight/Phalanx/Wizard/Sorceress) — the DETAIL panel had no room to restate a uniform line for the other seven, so it's gated to only where it's informative.
- **Docs (Task 7):** `docs/rules.md` gained a per-row-moves note + a "Guard" section; the class table's Behavior column updated for the four varying classes (character-for-character identical to `classRulesCard`'s prose — the existing `rules-doc.test.ts` drift guard enforces this automatically) plus a new drift-guard block pinning the frozen move table + the Half ratio. ADR 0003 and the epic-4 dossier both amended IN PLACE with dated "Amendment"/"SUPERSEDED" notes (original decided-history text preserved, not deleted) describing the Full/Half shield that replaced the dossier's original column-bodyguard redirect design.
- **Not device-verified this session** (see Task 8's unchecked item): Guard's visual read (shield marker, block flash, per-row move flavor) has no scene-level test in this codebase (Phaser scenes are device-verified per project convention) — needs Danilo's on-device pass before this story can close.

### File List

**Engine (`packages/engine`)**
- `src/types.ts` — `MoveKind` +`'bash'`; new `RowMove` type; `UnitAttacked.redirectedFrom` doc comment repurposed (Guard shield attribution, not a redirect).
- `src/balance.ts` — `ClassStats.moves` field (+ populated per class); `formulas.guardHalf` (1/2); `version` 7 → 8.
- `src/resolve.ts` — `UnitState.guard`; `act()` dispatches per (class,row) move (Guard branches call `raiseGuard`; Wizard/Sorceress front routes to a melee-targeted staff strike); `misfire()` uses `attackMoveOf()` for its kind; `CLASS_MOVE_KIND` retired; `strike()` gains `kind`/`units` params + the `applyGuard` shield check + `redirectedFrom`; new `raiseGuard`/`attackMoveOf`/`applyGuard` helpers; Guard-expiry loop added to the natural-engagement-end (poison-tick) block.
- `test/guard.test.ts` — NEW: Full-guard-ally-behind + re-arm + natural-expiry fixture; Half-guard-own-cell + one-shot fixture; the `matchSetupArb` replay-invariant property test.
- `test/crit-dodge.test.ts` — NEW "zero extra battle draws" manual-replay pin.
- `test/balance-hash.test.ts` — pinned `8: '249d336f'`.
- `test/damage.test.ts` — NEW Wizard/Sorceress front-staff arithmetic block.
- `test/roster.test.ts` — NEW frozen (class,row)→move table test + Wizard-front melee-targeting live-battle test.
- `test/events.test.ts` — `EXPECTED_KIND` replaced with a per-(class,row) lookup; `redirectedFrom` assertion now allows a real guardian id.
- `test/combat.test.ts` — hand-derived judging verdict A87/B82; min-damage property exempts a Full-Guard-negated hit.
- `test/resolve.test.ts` — `turnsByPass` helper recognizes `GuardRaised` as a turn actor; AGI-pass-order + determinism-anchor expectations updated.
- `test/sim.test.ts` — knight-wall-vs-mage-battery anchor 10%/100%, re-derived comment.
- `test/wipeout.test.ts` — `knightsVsMercs` 5 engagements/A55%; `knightsVsClerics` equilibrium A96%/B81%; both derivation comments rewritten.
- `test/golden.test.ts` + `test/__snapshots__/golden.test.ts.snap` — #1/#6/#7 verdicts + comments updated; #4 comment notes the live Guard interaction; NEW golden #10 (Full Guard negates the ally-behind arrow); all snapshots re-recorded.
- `test/ai.test.ts` — seed-1 anchor placement updated for the `farshot` re-tune.
- `src/ai.ts` — `farshot`'s first archer moved mid-left → front-left (both-mode sweep re-tune).

**Web (`apps/web`)**
- `src/config/constants.ts` — `GUARD_MARKER_GLYPH`, `GUARD_MARKER_COLOR`, `GUARD_BLOCKED_CAPTION`.
- `src/scenes/BattleScene.ts` — `UnitView.guardMarker`; `attackFlavor` takes `moveKind: MoveKind` and reads it instead of inferring from class; `GuardRaised`/`GuardEnded` cases call new `applyGuardMarker`/`removeGuardMarker`; `UnitAttacked` case renders a `guardFlash` + `GUARDED` caption when `redirectedFrom` is set.
- `src/flow/narration.ts` — `UnitAttacked` case names the guardian and distinguishes a full block from a halved one.
- `src/flow/draftModel.ts` — `RulesCard.moves`; new `movesVaryByRow`/`moveLabel` exports; `CLASS_TEXT` behavior prose updated for Knight/Phalanx/Wizard/Sorceress.
- `src/scenes/DraftScene.ts` — renders the per-row move breakdown line, gated to the four varying classes.
- `test/narration.test.ts` — two new Guard-block narration tests; one comment fix.
- `test/draft-model.test.ts` — new `moves` field test + `movesVaryByRow`/`moveLabel` tests.
- `test/rules-doc.test.ts` — new drift-guard block (move table + Half ratio).

**Docs**
- `docs/rules.md` — class-table Behavior column (4 rows), "Rows matter" per-row-moves paragraph, new "## Guard" section.
- `docs/adr/0003-battle-stream-draw-order.md` — Guard's zero-draws line amended + an "Amendment" blockquote.
- `docs/planning-artifacts/epic-4-dossier/DOSSIER.md` — D-2a marked SUPERSEDED; §4 gained a full Guard-shield amendment subsection; move table Guard cells labeled (Full)/(Half); §5's `redirectedFrom` row updated.
- `docs/implementation-artifacts/sprint-status.yaml` — 4-7 status.

### Change Log

- 2026-07-19 — Story 4.7 implemented: FR32 per-row moves land as balance DATA (`ClassStats.moves`), `act()` dispatches on the (class,row) move instead of the class (retiring `CLASS_MOVE_KIND`); Wizard/Sorceress front row is now a physical, melee-targeted staff jab instead of the blast. FR33 Guard ships as Danilo's 2026-07-19 revision — a one-shot Full/Half damage SHIELD (self + the ally directly behind), not the dossier's original redirect: the attacked unit stays the target, Full negates to 0, Half halves (re-clamped to minDamage), consumed on the next landed physical single-target hit, zero extra `battle`-stream draws (ADR 0003 untouched). `balanceVersion` 7→8, `logVersion` unchanged (all v4 union carriers shipped in 4.2). Shell renders move-kind flavor from the payload (fixing the pre-existing FR32 class-inference bug), a persistent Guard marker, and a distinct guarded-hit block visual; draft cards + rules.md show the per-row moves and Guard mechanic. All 9 goldens re-recorded + audited, 1 new golden added; both-mode sweep re-tuned (`farshot` placement) back into the ≤65% band. ADR 0003 + the epic-4 dossier amended in place to record the Guard redesign. Gate green: 490 tests, typecheck + lint + prettier clean, engine coverage 99.57% lines.
- 2026-07-19 — DEVICE-ACCEPTED (Danilo: "I like it"). One device fix: the Draft detail panel's per-row move line was stacking on the prose behavior line and overflowing into the matchup chips — for the four row-varying classes (Knight/Phalanx/Wizard/Sorceress) it now REPLACES the prose line (one text block, compact `F/M/B` prefixes) rather than adding a second. Shield marker visual confirmed good on device. Typecheck + lint clean.
- 2026-07-19 — Senior code review (Sonnet 5, 3-layer: Blind Hunter + Edge Case Hunter + Acceptance Auditor). No High/Med defects — the engine core (guardian geometry, consume ordering, zero-draws, engagement-boundary expiry) verified sound; all 5 ACs met. 1 decision + 4 patches applied, 2 deferred, ~10 dismissed as non-issues (consistent-with-established-patterns: dead-units-clear-silently, poison-icon-persists-at-battle-end, etc.). **Decision** (Danilo): a confused front-row Wizard/Sorceress now misfires as a single-target STAFF on an ally (row-consistent) instead of a self-blast — `misfire()` dispatches on the (class,row) move; clean under ADR 0003, zero re-derivation, new `confusion.test.ts` pin. **Patches:** Full-Guard `-0`→`0` popup; `RowMove` exported from the barrel; `movesVaryByRow` derived from `BALANCE` (removed a 2nd source of truth); tightened the min-damage test's overclaiming comment. **Deferred** (logged to deferred-work.md, for the queued move-table tuning pass): `attackMoveOf` back-row cast robustness, and the overlapping-guards (own-Half + front-Full) tie-break. Gate re-run green: 491 tests, typecheck + lint + prettier clean, engine cov 99.57% lines. Status → done.
