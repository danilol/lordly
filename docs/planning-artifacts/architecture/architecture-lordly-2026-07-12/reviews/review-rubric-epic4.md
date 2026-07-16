---
type: review
method: rubric-walk
subject: ../ARCHITECTURE-SPINE.md
scope: 2026-07-16 Epic 4 amendments (AD-1/4/6/9/10/12 amended, AD-14/AD-15 new, Deferred refresh, conventions/capability-map updates)
prd: ../../../prds/prd-lordly-2026-07-11/prd.md
reviewed: 2026-07-16
verdict: pass-with-findings
---

# Rubric Review — Architecture Spine, Epic 4 Amendments

**Verdict: PASS WITH FINDINGS.** The 2026-07-16 amendments are sound, integrate cleanly with the shipped spine, honestly ratify the Epics 1–3 codebase, and cover the amended PRD's Epic 4 capabilities. Two Medium findings sit on contracts the spine itself declares canonical (the monster anchor's derivation direction in `MatchSetup`; the completeness of AD-12's single-bump event checklist) — both are catchable by the mandated Epic 4 design story, but the spine is the document that should pin them or explicitly assign them. Three Low findings are tightening. Nothing blocks epic breakdown.

Scope honored: settled MVP decisions that passed the 2026-07-12 gate (AD-2/3/5/7/8/11/13, paradigm, stack strategy) were checked only for amendment-induced regressions, and none were found. The prior gate's Major finding (R1, seed-stream architecture) is visibly resolved by AD-9/AD-10, and the Epic 4 amendments extend those two ADs through exactly the API-change process AD-10 prescribes — the spine is eating its own dogfood, which is the strongest signal in this review.

---

## Checklist Item 1 — Fixes the real divergence points for the level below, misses none

**Mostly yes.** The Epic 4 fault lines for AI-built stories are the right ones and each got an owner:

- **Army sizing** (FR1) → AD-1: slot budget + per-class slot costs as balance data, never a constant outside it. Correct target — "5" hardcoded in a draft scene and "5" hardcoded in engine validation is precisely a two-owners bug. The shipped code already keeps `armySize` in `balance.ts` (read by `validate.ts`), so the amendment generalizes an existing single owner rather than inventing one.
- **Monster identity** (FR38) → AD-14: one unit, one id, one anchor, derived footprint. This kills the classic large-unit split (engine sees one entity, renderer/history/targeting see two cells) before any story exists. Events reference unit ids, never cells — consistent with AD-11's identity scheme.
- **New battle inputs** (FR34/FR35, FR20) → AD-9's amended `MatchSetup` carries `tactics` and `leaders` as stored data; AD-8's full-`MatchSetup` history entry then covers FR28's amendment with zero extra machinery. Clean.
- **New randomness** (FR36/FR37) → AD-10: `names/A`, `names/B` added via the closed-set process; crit/dodge ride `battle` with a fixed per-attack draw order, matching the PRD's determinism constraint verbatim.
- **AI hiddenness under new inputs** (FR24) → AD-6 extends "inputs cannot include" to tactic and leader. Still enforced by construction.
- **Version churn** (the mega-epic's one-bump decision) → AD-15 turns the PO's process decision into an architectural rule with a stated failure mode in each direction (dribbled `logVersion` vs. frozen `balanceVersion`). Good altitude.

Two misses, both on contracts the spine declares canonical:

### Finding E1 (MEDIUM) — The monster anchor's derivation direction is unpinned in the canonical `MatchSetup` contract

AD-9 pins `placements` as `unit index -> ANCHOR { row, col }` with "a monster's second cell DERIVED from its size class (AD-14)", and AD-14 forbids storing the second cell. But **neither AD says which cell the anchor is or which direction the footprint extends.** A Front+Middle body and a Middle+Back body can both have a Middle-anchored reading: anchor=Middle is ambiguous unless the convention is fixed (e.g., *anchor is the frontmost occupied cell; the footprint extends one row back*). At least four independent units of work must agree on this — engine placement validation, the placement scene's drag model, the battle renderer, History cards — and the spine's own MatchSetup comment is the only text they'll all read. The PRD (FR38) fixes the footprint *rule* but not the anchor *encoding*; the Epic 4 design story owns two-cell *semantics*, but the data-shape encoding is AD-9's property, and AD-9 is the spine's. One sentence in AD-9 or AD-14 closes it. (An engine-exported `footprintOf(unit)` helper would also stop shell surfaces from re-deriving the second cell independently — AD-14 currently forbids shell re-derivation of *targeting semantics* only, while rendering a two-cell sprite requires footprint math somewhere in the shell.)

### Finding E2 (MEDIUM) — AD-12's single-bump minimum omits FR32/FR33 and FR39b payloads, and AD-15 makes omissions expensive

AD-12's amended Epic 4 extension names crit/missed/dodged outcomes, `StatusCleared`, and a leader-death/penalty event — but not:

- **FR33's Guard outcomes** (mitigation raised for the engagement, or an incoming attack negated outright) — observable rules the log must narrate, and the PRD *explicitly* flags FR33's interaction with "the engine's closed BattleEvent union (AD-12)";
- **FR32's move-kind variation** (a back-row Knight Shield-Covering instead of attacking must be expressible, or the animator invents logic — AD-12's own stated divergence);
- **FR39b's action-ledger economy** ("2 actions this turn → used 1 → 1 left"). Under AD-2/AD-12 doctrine ("anything the UI needs to show must be an event in the log", "the player never re-derives state"), the live ledger either needs per-action economy in event payloads or the shell will compute it from FR15 row counts + FR32 move tables + monster acting-row rules — rule evaluation in the render loop, the exact thing AD-2 exists to prevent. The PO flags the ledger as the epic's key presentation problem; the spine should say which side of the log line it lives on.

The list is prefixed "at minimum" and the complete extension is delegated to the design story, so this is not a contradiction — but AD-15's one-`logVersion`-per-era rule means anything the design story misses forces either a second bump (violating AD-15) or a hacked-in shell derivation (violating AD-2). When the single-bump choke point is this load-bearing, the spine's minimum checklist should enumerate every FR-visible outcome family it already knows about. Three additions close it.

## Checklist Item 2 — Every AD's Rule enforceable and actually preventing its stated divergence

**Strong.** AD-1's budget-as-data is checkable (grep for numeric literals vs. `BALANCE` reads); AD-9/AD-10's stored-data + closed-stream rules are testable (replay identity, stream independence — and the closed set was extended by editing the AD, exactly as prescribed); AD-14's "one id, anchor stored, footprint derived" is enforceable in types (no second-cell field to store) and its "placement validation is the only code that reasons about footprint legality" gives a single grep-able home. AD-6's by-construction hiddenness survives the new inputs.

### Finding E3 (LOW) — AD-15's `logVersion` half has no mechanical enforcement

AD-8's `balanceVersion` discipline is CI-enforced (content hash pinned to the declared version — the fix for the original gate's R3). AD-15's "design the complete extension up front, bump exactly once" is process-only: nothing mechanical stops a second union-touching story from bumping again mid-era. This is probably right (a hash-per-era check is awkward), but the asymmetry deserves a sentence — e.g., the epic's design-story ADR states the era's target `logVersion`, and review treats any further bump as an AD-15 violation. As written, the rule depends on the reviewer remembering it; the spine's own standard elsewhere is "enforced by construction, not discipline."

Minor enforceability notes (no action forced): the "fixed per-attack draw order — designed once, frozen forever" note in AD-10 is testable via golden battles once shipped; FR35's optional "panicked" random-targeting variant would add a third `battle`-stream consumer, which is fine pre-bump but joins the frozen order — the design story should decide it before the order freezes, and the PRD's Open Item 3 already sequences it there.

## Checklist Item 3 — Nothing under Deferred could let two units diverge

**Clean, with one deliberate gate.** The refreshed Deferred list correctly retires resolved items with pointers to where they resolved. Each remaining entry is single-owner or a no-op today. The one divergence-capable deferral — **two-cell monster targeting/acting semantics** — is triple-gated: AD-14 fixes identity and the single engine home, FR38 mandates definition "before any monster story is implemented", and the Deferred entry names the design story as owner. That is a defer-with-a-gate, not a hole. Server persistence gained an explicit revisit condition. Mid-battle tactic switching stays out with its incompatibility named (AD-2), matching the PRD's recorded deviation. No leakage found beyond E1's anchor encoding, which is not deferred — it is silently absent, which is why it's a finding.

## Checklist Item 4 — Named tech verified-current

**Pass by absence and by pin-check.** The amendments name no new technology — Epic 4 is data, types, and rules inside the existing stack, which is the cheapest possible architecture for it. The stack table's verification date (2026-07-12) was not refreshed, but the table's own caveat now governs: "the code owns these once it exists," and the code exists. Verified against the workspace: Phaser ^4.2.1 (spine 4.2.x), Vite ^8.1.4 (8.x), Vitest ^4.1.10 (4.1.x), TS ~5.9.3 (5.9.x pin), pure-rand 8.4.2 (8.x, sole engine runtime dep as AD-1 demands), pnpm 11.12.0, wrangler ^4, vite-plugin-pwa ^1.3.0, fast-check ^4 + @fast-check/vitest ^0.4 — all match. The TS7 deferral remains correct.

## Checklist Item 5 — Ratifies rather than contradicts the brownfield codebase

**Pass — checked against source, not claims.**

- AD-10's stream set matches `packages/engine/src/rng.ts` exactly: `STREAM_LABELS = ['elements/A', 'elements/B', 'ai/A', 'ai/B', 'battle']` — the spine's pre-Epic-4 set verbatim, with `names/A`/`names/B` correctly marked as *additions to build*, not existing code.
- AD-1's amendment claims "through the MVP the budget was equivalent to '3 units'" and that sizing lives in balance data — true: `balance.ts` has `armySize: 3` and `validate.ts` reads `BALANCE.armySize`, no stray constant. The amendment is a generalization of shipped structure, not a retroactive indictment.
- AD-9's `mode: 'single' | 'wipeout'` matches `types.ts` (`export type Mode = 'single' | 'wipeout'`).
- The structural seed's ratification note (storage gateway living at `apps/web/src/flow/storage.ts` rather than a separate `web/storage` dir) matches the actual tree — the spine bent to the code, correctly. (Residual nit: AD-8's prose still says "the `web/storage` module"; the seed's ratified path is authoritative, but the AD text could name the module by role rather than path to avoid the mismatch reading as a rule.)
- AD-12's Epic 4 extension correctly carries the story-2.2 `StatusCleared` deferral, which is indeed absent from the shipped union in `types.ts`.

## Checklist Item 6 — Covers the driving PRD's capabilities

**Pass with the two gaps already filed (E2) plus two Low findings.** Trace of the amended FRs: FR1→AD-1/AD-9; FR4/FR38→AD-14 + engine validation; FR7/FR9 melee-only reach + global range + Last Stand → engine-internal rules change under the existing `engine/targeting` capability row (no AD needed — no cross-unit seam moves); FR14→AD-4 (role tags + relation data in the versioned file); FR20→AD-9 (tactics/leaders as setup data); FR24/FR34/FR35→AD-6/AD-9/AD-12; FR36→AD-10/AD-12/AD-4 (chances as data); FR37→AD-9/AD-10; FR39→capability map (`web/scenes` ledger/clarity) + AD-2's any-speed/skip player covering 39g; FR19 cap raise → balance data + AD-15's bump. The sim-harness scaling pass (PRD Open Item 5) is in the capability map. The text-ceiling fix is scheduled in conventions with its NFR1 verification tether.

### Finding E4 (LOW) — FR37's "zero extra storage" rationale contradicts AD-9's stored-names design; deviation unrecorded

The PRD justifies name streams with "history entries keep their names with zero extra storage" (re-derivation). AD-9 rules the opposite mechanism: names are rolled once and **stored** in `MatchSetup.armies[].name`, never re-derived — so history *does* store the strings. AD-9's choice is the better one (it is the same anti-divergence principle that fixed elements, and it makes old names immune to name-table edits), and the player-visible outcome FR37 wants still holds. But the spine is silently overriding the PRD's stated mechanism rather than recording the deviation the way FR34's OB64 deviation is recorded. One clause in AD-9's amendment note (or a PRD errata) keeps the two documents from teaching different designs.

### Finding E5 (LOW) — The name table's home relative to `balanceVersion` is undecided, and the default answer is subtly wrong

AD-4's amended enumeration puts roles, relations, slot costs, penalty ratio, and crit/dodge chances "all in the same versioned data file" — the name table (FR37) is not listed, and no other text places it. The obvious agent move is to drop it into `balance.ts` too, but that couples pure flavor to `balanceVersion`: every name-table edit would bump the version and mark replayable history non-replayable (AD-8) despite names being stored data with zero effect on resolution. The right shape is probably *engine-owned data outside the balance-hash surface* (names never feed `resolveBattle`; they only feed the draft-time roll). Whatever the answer, it is a one-line AD-4 decision, not a design-story deliverable — the design story owns the table's *content*.

## Checklist Item 7 — Every dimension the altitude owns is decided, deferred, or an open question

**Pass.** Epic 4 adds no new operational or environmental surface: same hosting, CI, environments, config, logging, and privacy posture — all still decided under AD-7 and the conventions. The performance envelope was *strengthened* at this amendment: a measured baseline (2026-07-16) now anchors the NFR1 budget, and the text-ceiling fix is scheduled with a before/after verification rule. The sweep-scaling and design-story dimensions are correctly held as PRD open items with named owners, not spine debt. One cosmetic staleness: the Domain-naming convention row still lists only the original glossary words (*match, battle, engagement, pass…*) — the binding is "the PRD Glossary, verbatim," which now includes *slot, monster, role, leader, tactic, turn*, so no rule is broken, but the illustrative list reads as exhaustive and predates the amendment.

---

## Findings Summary

| # | Severity | Finding | Fix cost |
|---|---|---|---|
| E1 | Medium | Monster anchor cell / footprint-derivation direction unpinned in AD-9/AD-14's canonical `MatchSetup` contract | One sentence (+ optional engine `footprintOf` export) |
| E2 | Medium | AD-12's single-bump minimum omits FR32 move-kinds, FR33 Guard outcomes, FR39b ledger economy — expensive misses under AD-15 | Three list items |
| E3 | Low | AD-15's one-`logVersion`-per-era rule is process-only, unlike its `balanceVersion` sibling | One sentence (era target version stated in the design-story ADR) |
| E4 | Low | AD-9 stored-names design silently overrides FR37's "zero extra storage" re-derivation rationale; deviation unrecorded | One clause |
| E5 | Low | Name table's home vs. the balance-hash surface undecided; naive placement needlessly kills history replayability on flavor edits | One line in AD-4 |

**Recommendation:** fold E1 and E2 into the spine before (or as the first act of) the Epic 4 design story — both are one-edit fixes to text the design story will otherwise have to guess at. E3–E5 can ride the design story's ADR. No re-gate needed if applied as written.
