---
baseline_commit: 0675a27ea78b4e393f124bcba1b84373b092170b
---

# Story 5.11: OB64 targeting fidelity and the dominated-Guard fix

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want units to pick targets the way Ogre Battle 64 does,
so that positioning is a real strategic decision instead of a lottery.

> **Scope in one line.** Created by `sprint-change-proposal-2026-08-01.md` after story 5.10's felt-balance pass returned findings instead of a sign-off. Four changes, **one `balanceVersion` train (11 → 12)**: ranged targeting gains the OB64 **column sector** rule, its Autonomous **row order flips to front-first**, the **Archer drops to 1/1/2**, and a **Guard row with nobody behind it attacks instead**. `logVersion` stays 4 — no event shape changes.

> **⚠️ THIS STORY MOVES THE WHOLE META, NOT JUST ARCHERS.** `selectRangedTarget` is on the attack path of the **Archer, the Cleric's staff fallback, every Witch cast, and every `bolt`** (Wizard/Sorceress mid+back, Valkyrie back). Re-tuning after the sweep is **expected work inside this story**, not a surprise. Budget for it.

> **⚠️ TWO OF THESE FOUR CHANGES ARE NOT OB64 FIDELITY, AND THE RECORD MUST KEEP SAYING SO.** An independent research pass (dossier §8) **contradicted** the Archer rationale and **failed to corroborate** the front-first row order. Both were kept on Danilo's felt-play judgement and are recorded as **E5-D19** and **E5-D20**. Do not "tidy" the story or the dossier into claiming OB64 mandates them.

## Acceptance Criteria

From `epics.md` Story 5.11, with the dossier decisions folded in. FR7, FR9, FR15, FR33, FR34, AD-8, NFR4.

1. **Ranged obeys the column sector rule — as a preference WITH a fallback.** A corner unit may target its facing enemy column and the centre; a centre unit may target all three. **When nothing living is in sector, the legal list falls back to every living enemy** — the sources are explicit that the restriction yields "unless there's no other option", and this is the same Last Stand shape melee already ships. Melee's own behaviour is unchanged. FR9 is amended in place with a dated note; `docs/rules.md` follows and `rules-doc.test.ts` stays green.

2. **Ranged Autonomous prefers the FRONT row (E5-D20 — PO direction, not sourced fidelity).** The depth order becomes front → middle → back, same column before centre within a row. **The legal list stays row-unrestricted**, so a target tactic (`leader`/`weakest`/`strongest`) still reaches over the front line — that behaviour is deliberate and OB64's own Leader rule depends on it. Melee keeps its FR8 nearest-row *blockade* (a hard restriction, not a preference) exactly as today.

3. **The Archer drops to `{ front: 1, mid: 1, back: 2 }` (E5-D19 — a deliberate balance deviation).** Recorded as a tuning decision, **explicitly not** an OB64 fix: sources state the OB64 Archer is "Shoot ×1 front, ×2 mid, ×2 back", i.e. the `1/2/2` already shipped.

4. **A Guard row with no living ally behind it attacks instead.** When a `guard-full`/`guard-half` row has **no living same-side ally directly behind it (row + 1, same column)**, the unit performs its class's attack instead of raising a shield, so guarding is never strictly dominated (a lone Phalanx currently raises a charge forever, deals zero damage and loses on HP fraction). FR33 and dossier §4 gain the condition.

5. **One versioned, drift-guarded, re-certified train.** `balanceVersion` 11 → 12 with the hash re-pinned; goldens re-recorded and **audited event-by-event**; the both-mode convergence sweep re-runs at `runs=500` across seeds 1/2/3 and every archetype lands **≤65%**, with any crossing tuned or recorded as a conscious deviation — never silent. `logVersion` stays **4**.

## Tasks / Subtasks

- [ ] **Task 1 — Read these three things before touching code (AC: all)**
  - [ ] `packages/engine/src/targeting.ts` **in full** (~200 lines). It is the whole blast radius and it is well-documented; the doc comments encode rules you must preserve.
  - [ ] Dossier **§8** (`epic-5-dossier/DOSSIER.md`) — the research pass, and decisions **E5-D16..E5-D20**. E5-D19/D20 tell you which parts are *not* fidelity.
  - [ ] `deferred-work.md` → "PO FIGHT-SYSTEM FINDINGS" — the original evidence, including Danilo's OB64 targeting research verbatim.

- [ ] **Task 2 — The sector filter for ranged (AC: 1)**
  - [ ] `legalTargets` currently short-circuits: `if (mode === 'ranged') return living;`. Replace with a sector filter **that keeps all rows**:
        `const inSector = living.filter(i => reach.includes(candidates[i].colIndex)); return inSector.length > 0 ? inSector : living;`
        where `reach = reachableEnemyCols(attackerColIndex)`. **Do NOT add a row restriction here** — that is what keeps AC2's target-tactic arc working.
  - [ ] Reuse `reachableEnemyCols` as-is; its math is already correct (facing `2 − i` plus adjacent, so a corner reaches 2 columns and the centre reaches 3). **Update its doc comment** — it currently says "(FR7, melee only)" and that becomes wrong.
  - [ ] Note the AD-11 mirror convention while reasoning about columns: own column `i` faces enemy owner-local column `2 − i`. Do not "fix" this; it is the shipped convention and `meleeCmp`/`rangedCmp` both depend on it.
  - [ ] Test the fallback explicitly: a left-column archer with **only** enemy right-column units alive must still shoot (not skip). This is the branch the sources describe and the one most likely to be missed.

- [ ] **Task 3 — Front-first row order (AC: 2)**
  - [ ] `rangedCmp` currently sorts `b.rowIndex - a.rowIndex` (rearmost first). Flip to `a.rowIndex - b.rowIndex`. Row indices are **front = 0, mid = 1, back = 2** (confirmed: melee's blockade takes `Math.min(rowIndex)` to mean the front).
  - [ ] **After this flip `rangedCmp` and `meleeCmp` have identical bodies.** Decide deliberately and say which you did: unify into one `autonomousCmp(attackerColIndex)` used by both (cleaner, and avoids `knip`/reviewer questions about a duplicated comparator), or keep two named exports for future divergence. **Do not leave two identical functions with no comment explaining why.**
  - [ ] Rewrite `rangedCmp`'s doc comment — it currently *explains the old rule* ("Arrows arc over the front to snipe the back line"), which becomes actively misleading. Replace with the front-first rule and cite E5-D20 as PO direction, not fidelity.
  - [ ] **The asymmetric-fixture rule (the chirality lesson):** a symmetric mirror comp passes a reversed-row bug. Add at least one test whose expected target is *different* under front-first than under rearmost-first, on an asymmetric board — that test is the entire point of Task 3.

- [ ] **Task 4 — Archer actions (AC: 3)**
  - [ ] `balance.ts` → `archer.actions` becomes `{ front: 1, mid: 1, back: 2 }`.
  - [ ] Comment it as **E5-D19, a deliberate balance deviation**, with the one-line reason (sources say `1/2/2`; kept on felt play). A future reader must not mistake it for a fidelity fix.

- [ ] **Task 5 — Guard fall-through (AC: 4)**
  - [ ] **The clean seam, use it:** resolve the substitution **before** `act()`'s inner switch rather than inside the guard case (no recursion, no duplicated dispatch, and the exhaustive switch keeps protecting you):
        ```ts
        let move = BALANCE.classes[unit.class].moves[unit.snapshot.placement.row];
        if ((move === 'guard-full' || move === 'guard-half') && !hasLivingAllyBehind(unit, units)) move = attackMoveOf(unit);
        switch (move) { … }
        ```
        `attackMoveOf` already returns the class's back-row move for a guard row (Knight back = `slash`, Phalanx back = `bash`), which is exactly the fall-through shape — and E5-D12a's back-row-Guard invariant guarantees it is a real attack.
  - [ ] `hasLivingAllyBehind` = a living same-side unit at **`rowIndex + 1`, same `colIndex`**. **COUPLING SITE:** this is the exact inverse of `applyGuard`'s guardian search, which finds the shield at `rowIndex − 1`, same column (`resolve.ts`). The two must stay consistent — if the guard geometry is ever changed, both move. Say so in a comment on both.
  - [ ] Do the same for `misfire()`? **No** — a confused guard row already falls through via `attackMoveOf`. Verify that and state it; do not duplicate the logic.
  - [ ] Tests: a Phalanx with an ally behind still raises Full Guard (unchanged); the same Phalanx alone in its column attacks; a **lone surviving** Phalanx attacks rather than guarding to death (the case Danilo reported).

- [ ] **Task 6 — Version, hash, goldens (AC: 5)**
  - [ ] `balance.ts` `version` 11 → 12; re-pin the hash in `balance-hash.test.ts` (the test message spells out the two-step). **One bump for the whole story** — do not bump per change.
  - [ ] Re-record goldens (`pnpm --filter @lordly/engine test -u`) and **audit event-by-event**. Expect **most of the 11 to move** — archers, cleric staffs, witches and bolts all route through the changed path. **The 4.4 regression pin still applies:** a golden containing none of those must stay **byte-identical**; verify that rather than assuming it.
  - [ ] `logVersion` stays 4 — confirm and state it. No event shape changes here (no new event, no new field).

- [ ] **Task 7 — Expected test casualties: fix them, don't be surprised (AC: 5)**
  - [ ] **`wipeout.test.ts`'s cap-length POISON pin (added by 5.10) WILL break.** It asserts exact tick counts (first segment 4, last segment 10) on a mirrored witch fixture, and **witches cast through `selectRangedTarget`** — the sector filter and row flip both change who gets poisoned. Re-derive the numbers; keep the *property* (ticks in all 10 engagements, zero deaths) and re-pin the counts. **Do not weaken the assertion to make it pass.**
  - [ ] The **breath** attenuation pin is safe — row-AoE goes through `selectBlastRow`, not the ranged path. Confirm it stays green rather than assuming.
  - [ ] `targeting.test.ts` (30 tests) is the primary suite to extend. Also expect movement in `roster.test.ts`, `combat.test.ts`, `confusion.test.ts`, `leader.test.ts`, `guard.test.ts`, `crit-dodge.test.ts` and `resolve.test.ts`'s determinism anchor.
  - [ ] `sim.test.ts`'s `CI_CONFIG` proxy (baseSeed 21, runsPerPair 15) may fall out of band once the meta moves. **Re-verify and re-pin the baseSeed only if it does** — the 5.4/5.5 precedent is to scan a window of seeds and pick one mid-run, never to raise `runsPerPair`.

- [ ] **Task 8 — Re-certify the band (AC: 5)**
  - [ ] Convergence sweep, both modes, run the CLI **directly** from `packages/engine`: `pnpm exec tsx sim/run.ts --runs=500 --seed=1 --threshold=0.65 --mode=single|wipeout` (the `pnpm --filter … sim -- --flags` form double-passes `--`; CLI caps at 500).
  - [ ] Seeds **1/2/3**, both modes. Pre-change baseline to compare against: single max **twin-golems 64.3–64.4%**, wipeout max **longbows 63.8%**, floors `gale` **29.6%** / `breath-battery` **30.3%**.
  - [ ] **Expect the archer comps to fall** (`longbows`, `talons`, `farshot`, `gale` lose a mid-row action AND lose free back-line access) **and the melee/monster comps to rise**. If something crosses 65%, tune the smallest lever — 5.5's precedent is that an `ai.ts` placement slide can fix a comp at **zero** version cost, since the pool is not hashed balance data.
  - [ ] Record every number for 5.10 to consume. **Do NOT write `balance-verdict.md` here** — that is 5.10's job; this story hands it the raw sweep.

- [ ] **Task 9 — Docs and the drift guard (AC: 1, 3, 4)**
  - [ ] **FR9** (`prd.md`) — dated in-place note: ranged is **sector-restricted with a no-other-option fallback**, not global; Autonomous depth order is front → middle → back; the legal list stays row-unrestricted so target tactics still arc. Record that "global range" as originally written diverged from OB64 and was corrected here.
  - [ ] **FR33** — dated note: a Guard row with no living ally behind it falls through to its class's attack.
  - [ ] **FR15** — one line: the Archer row moves to `1/1/2` per E5-D19 (`BALANCE.classes` stays normative).
  - [ ] **`docs/rules.md`** — the player-facing Melee/Ranged/Guard text must now teach the sector rule and front-first order, because it is strategy the player needs. `apps/web/test/rules-doc.test.ts` pins every NUMBER in it to `BALANCE` — keep it green.
  - [ ] **dossier §4** — the Guard condition, dated.

- [ ] **Task 10 — Gate + device (AC: all)**
  - [ ] Full gate: `pnpm typecheck && pnpm lint && pnpm knip && pnpm coverage` (engine ≥90% lines) `&& pnpm --filter web build`.
  - [ ] Check the Draft/Placement copy that *teaches* targeting (`flow/draftModel.ts` `CLASS_TEXT`, the unit-data card) — if any string says arrows hit the back line, it is now wrong. This is shell text, not engine.
  - [ ] Device pass with Danilo: **does the front-first order feel right?** This is the one change with no source behind it (E5-D20), so his felt verdict IS the evidence. Deploy to production first (CI deploys on `main`).

## Dev Notes

### The current targeting pipeline, exactly as it stands (read this before changing it)

Two steps, in order, and a tactic **never** expands melee reach:

1. **`legalTargets(mode, attackerColIndex, candidates)`** → indices into `candidates`.
   - `melee`: living enemies in `reachableEnemyCols`, **or all living if reach is empty** (FR7 Last Stand), then narrowed to the **nearest occupied row only** (the FR8 blockade — a hard restriction, so melee can never hit past the front line *even under a target tactic*; Danilo's 2026-07-18 ruling).
   - `ranged`: **`return living`** — every living enemy, any row, any column. **This line is the bug.**
2. **`applyTactic(legal, candidates, tactic, cmp, leaderId)`** → the chosen index. `autonomous` = `cmp` best; `weakest`/`strongest` = min/max HP with `cmp` as tie-break; `leader` = the leader if it is in the legal list, else `autonomous`.

Comparators (`RankCmp`, allocation-free by design — the sim resolves thousands of battles, story 2.0 lesson):
- `meleeCmp`: `a.rowIndex - b.rowIndex` (front first) → facing column → centre-ness → left-ness.
- `rangedCmp`: `b.rowIndex - a.rowIndex` (**rearmost first**) → the same column chain.

[Source: packages/engine/src/targeting.ts]

### What the two changes do and do not touch

| | Legal list | Autonomous row order | After this story |
|---|---|---|---|
| **melee** | sector + Last Stand, then **nearest row only** | front first | **unchanged** |
| **ranged** | ~~all living~~ → **sector + fallback, ALL rows** | ~~rearmost~~ → **front** | both change |

Keeping ranged's legal list row-unrestricted is what preserves "a target tactic arcs over the front" — AC2 depends on it and so does OB64's own Leader behaviour. Melee's row narrowing stays a *hard* restriction. **The only structural difference between melee and ranged after this story is that row narrowing.**

### Everything that routes through `selectRangedTarget` (the blast radius)

- `archer` — every row (`arrow`, row-uniform).
- **`cleric`** — the staff fallback when nobody is damaged (it is physical + ranged, and it *does* obey the tactic).
- **`witch`** — every cast. She passes a pre-filtered candidate set (prefer-unafflicted, FR12) whose **indices are parallel to `enemies`** — respect that contract; `legalTargets`' returned indices are positional into `candidates` as passed.
- **`bolt`** — Wizard/Sorceress mid+back, Valkyrie back (5.4, E5-D4).

`selectBlastRow` (blast/breath row-AoE) is a **separate** path and is out of scope. [Source: packages/engine/src/resolve.ts `act()`]

### The research pass, and why two changes are labelled non-fidelity

Danilo supplied OB64 targeting research; independent verification (dossier §8) then found:
- **Sector rule: corroborated by three sources**, *and* they add the "unless there's no other option" fallback his version lacked → AC1's fallback is sourced, not invented.
- **Archer `1/1/2`: contradicted.** Sources say ×1 front / ×2 mid / ×2 back = what we ship. Kept as **E5-D19**, a balance deviation.
- **Front-first row order: not corroborated by any source found.** Kept as **E5-D20**, PO direction.

This matters for the story's own honesty: it is titled a fidelity pass and two of its four changes are not fidelity. The comments and PRD notes you write must preserve that distinction.

### Versioning discipline

`balanceVersion` is **11**. One bump to **12** for this whole story; hash re-pinned once. A bump invalidates stored replay history (AD-8; 3.2 marks stale entries non-replayable) — that cost is already accepted for this story, so do not add a second bump. **`ai.ts`'s `STRATEGY_POOL` is NOT hashed balance data** — a placement fix there needs no bump and leaves goldens byte-identical (5.5 verified by md5). Prefer it as a tuning lever. [Source: packages/engine/src/balance.ts, test/balance-hash.test.ts]

### Previous-story intelligence (5.10, in progress; 5.4's review lesson applies directly)

- **5.10 is HELD OPEN for this story** and re-certifies afterwards. Its Tasks 1/5/6/7 survive; its convergence numbers and `balance-verdict.md` addendum do not. Hand it clean sweep output.
- **The 5.4 review lesson is this story's main hazard: changing a rule silently empties the guards written for the old rule.** That review found three tests that kept passing while asserting nothing after `blast` was retired, and 5.10 found a fourth (the `wardens` floor guard) and a fifth (a stale perf benchmark). **When you flip the row order, grep the test suite for anything asserting "back"/"rearmost"/"snipe" targeting and re-point it rather than letting it pass vacuously.** Prove new guards bite by mutation — break the source, watch the test go red, revert.
- The engine has been stable since 5.5; 5.6/5.7/5.8 were shell-only. So any golden movement here is *this* story's doing.

### Testing standards

Engine tests are the contract: `targeting.test.ts` (primary), plus `roster`/`combat`/`confusion`/`leader`/`guard`/`crit-dodge`/`resolve`/`wipeout`/`sim`. Property tests derive class lists from `ALL_CLASSES` via `arbitraries.ts` and pick changes up automatically — watch for a starved/flaky property and **reweight rather than lowering `numRuns`** (the 4.8 lesson); verify under `pnpm coverage`, not just `pnpm test`, since instrumentation load is where flakes surface. Full gate before review: `typecheck`, `lint`, `knip`, `coverage` (engine ≥90% lines), `web build`.

### Project Structure Notes

- **Engine (UPDATE):** `src/targeting.ts` (sector filter + comparator), `src/balance.ts` (archer row + `version`), `src/resolve.ts` (guard fall-through + `hasLivingAllyBehind`).
- **Engine tests (UPDATE):** `targeting.test.ts`, `balance-hash.test.ts`, `balance.test.ts`, `wipeout.test.ts` (poison pin), `guard.test.ts`, `__snapshots__/golden.test.ts.snap`, likely `roster`/`combat`/`confusion`/`leader`/`crit-dodge`/`resolve`/`sim`.
- **Docs (UPDATE):** `prd.md` (FR9, FR33, FR15), `docs/rules.md`, `epic-5-dossier/DOSSIER.md` (§4).
- **Shell:** only if a `CLASS_TEXT`/card string teaches the old rule. No new scene, no new event, no new dependency, no new RNG stream.

### What this story is NOT

- **Not the sleep rework** — that is story 5.12 (E5-D16/D17), landing after this.
- **Not the certification** — 5.10 owns `balance-verdict.md` and the felt-balance sign-off.
- **Not poison's timing/scale** (E5-D18, deliberate deviation), not the **super-critical knockback** (PO-deferred to Epic 6+, needs an ADR 0003 amendment and the first `logVersion` bump since 4.2), not the deferred **performance** story.
- **Not a melee change.** If you find yourself editing melee's blockade, stop — that is a Danilo ruling from 2026-07-18.

### References

- [Source: docs/planning-artifacts/epics.md#Story-5.11] — the five AC blocks; the Epic 5 fence amendment sits in the epic's breakdown decisions.
- [Source: docs/planning-artifacts/sprint-change-proposal-2026-08-01.md] — why this story exists, the impact analysis, the sequencing decision.
- [Source: docs/planning-artifacts/epic-5-dossier/DOSSIER.md §8 + decisions E5-D16..E5-D20] — the OB64 evidence, the research contradictions, and which changes are fidelity vs PO direction.
- [Source: docs/implementation-artifacts/deferred-work.md] — "PO FIGHT-SYSTEM FINDINGS" (the five confirmed deviations with code evidence) and the super-crit entry.
- [Source: packages/engine/src/targeting.ts] — `legalTargets`, `reachableEnemyCols`, `applyTactic`, `meleeCmp`, `rangedCmp`, `selectMeleeTarget`, `selectRangedTarget`, `selectBlastRow`.
- [Source: packages/engine/src/resolve.ts] — `act()`'s move-driven dispatch, `raiseGuard`, `attackMoveOf`, `applyGuard` (the guardian geometry this story inverts).
- [Source: packages/engine/src/balance.ts] — `archer.actions`, `version: 11`.
- [Source: packages/engine/test/sim.test.ts] — `CI_CONFIG` rationale, the certified converged maxima, the derived viability-floor guard.
- [Source: docs/implementation-artifacts/5-10-the-pre-pvp-verdict.md] — what re-certifies after this story, and the 5.4 guard-decay lesson in its review findings.

## Open questions for Danilo (not blockers; defaults chosen)

1. **Comparator unification** — default: merge `meleeCmp`/`rangedCmp` into one `autonomousCmp` once their bodies match, with a comment that the melee/ranged difference now lives entirely in `legalTargets`. Say so if you would rather keep two names for future divergence.
2. **If an archer comp collapses below the viability floor** (they lose a mid-row action *and* free back-line access in one story — `gale` is already the floor at 29.6%) — default: fix it with an `ai.ts` placement slide (zero version cost) rather than giving the Archer stats back. Tell me if you would rather re-tune the class.
3. **Front-first on device (E5-D20)** — this is the one change with no source behind it. Default: your device pass is the acceptance evidence, and if it feels wrong we revert *that* change alone and keep the sector rule.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
