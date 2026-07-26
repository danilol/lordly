---
baseline_commit: 286cda5b266a9f3d048aaf3ecf1f05c6d7a0b104
---

# Story 5.1: The roster and moves dossier

Status: done

## Story

As the game's product owner,
I want every class I intend to ship — human and monster — designed on paper with its full row-by-row move table, from OB64 source evidence,
so that the roster stories implement a settled design instead of discovering it on my phone.

## Acceptance Criteria

1. **Source evidence first (the epic-4 retro team agreement).** Danilo supplies the full class list (humans AND monsters) with OB64 reference captures/research for every mechanic in question, and the dossier records the evidence beside each decision — no rule is invented where the source can answer.
2. **Complete class rows.** Every class has a stat row (HP/STR/VIT/INT/MEN/AGI/DEX), role, sex, 3-letter code, slot cost, and a complete front/mid/back move-and-count row — including a PO-reviewed revision of the shipped 12 (the owed 4.7 fine-tune, absorbed here), and the two 4.7 deferred rulings are decided: `attackMoveOf`'s behavior if a future table puts Guard in the back row, and the overlapping-guards tie-break.
3. **Monsters on the shipped model.** Each monster reuses the shipped single-cell + 8-neighbor king-move reservation model with its slot cost and loom treatment stated; if dragons are listed, their slayer classes and role-relation entries arrive in the same table (dossier D-1b's pairing honored).
4. **Versioning confirmed, PO signed off, zero code.** The dossier confirms the era needs NO `logVersion` bump (no event-shape change; any new `MoveKind` value rides `balanceVersion` per the 4.7 precedent), states the expected `balanceVersion` tick points (5.4, 5.5, conditionally 5.10), and Danilo signs off the whole dossier — zero code in this story.

## Tasks / Subtasks

- [x] Task 0: Set up the dossier home (AC: 1, 4)
  - [x] Create `docs/planning-artifacts/epic-5-dossier/DOSSIER.md` as the single authoritative design record (the 4.1 pattern: sectioned per AC, a dated decision log, evidence beside each decision). The epic-4 dossier stays untouched — era decisions that survive (single-cell monsters, ADR 0003, Guard shield) are REFERENCED, not copied.
  - [x] Open with the constraint header: no new systems (the epic fence), `logVersion` 4 untouched, ADR 0003 frozen (no new draw sites — any move that would add a `battle`-stream draw is out of scope for this era), Guard = Full/Half shield (4.7 amendment, not the superseded bodyguard text above it).
- [x] Task 1: Sitting 1 — the class list and the source evidence (AC: 1)
  - [x] Danilo supplies the target roster: which humans join the shipped 11 smalls, which monsters join Golem, and (if dragons) which slayer classes pair with them. His pasted OB64 research is authoritative (the standing agreement); the reference links live in `docs/planning-artifacts/midjourney-asset-prompts-2026-07-23.md#Reference-material` (ogrebattle64archive male/female class guides, spriters-resource sheets, rpgamer class list).
  - [x] For every mechanic in question, capture the OB64 evidence IN the dossier next to the decision (quote or screenshot reference + link). Where OB64 has no answer or Danilo deviates on purpose, record the deviation explicitly with rationale (the OB64-fidelity convention).
  - [x] Check each new class against the 7-role vocabulary (Vanguard/Skirmisher/Sniper/Artillery/Support/Control/Brute — epic-4 dossier §1). New relations are allowed as versioned `roleRelations` entries; a new ROLE is a bigger call — flag it explicitly if proposed.
- [x] Task 2: Sitting 2 — stat rows, codes, and the move table (AC: 2)
  - [x] Every new class gets the full row: HP/STR/VIT/INT/MEN/AGI/DEX, role, sex (name-stream key — the gender-split convention, D-1f), UNIQUE 3-letter code (taken: KNI MER ARC WIZ CLE WIT BER PHA NIN VAL SOR GOL), slot cost via `sizeClass`, and actions-f/m/b + move-kind-f/m/b.
  - [x] The owed 4.7 fine-tune: walk the shipped 12's move table (`balance.ts` `classes[*].moves` — currently START-GENERIC: Knight mid=guard-half, Phalanx front/mid=guard-full back=bash, Wizard/Sorceress front=staff mid/back=blast, everyone else uniform) row by row with Danilo and record keep-or-change per class. Changes are balance data only (`balanceVersion` ticks at 5.4) — but any change to existing classes re-records goldens in 5.4, so mark each changed row "re-records existing battles: yes/no" as 5.4's audit input.
  - [x] Decide the two 4.7 deferred rulings (deferred-work.md, code review of 4-7):
    - `attackMoveOf` (resolve.ts:451-455) falls back to `moves.back as MoveKind` for a confused misfire — unsound if any future table puts Guard in the back row. Rule now: either the dossier FORBIDS back-row Guard as a data rule, or it mandates the scan-for-first-real-MoveKind fix (lands in 5.4 if any table row triggers it).
    - Overlapping guards on one cell (resolve.ts:466-473): own guard-half + front ally's guard-full — today the target's own weaker charge is consumed first. Rule now: keep shipped behavior or switch to "strongest shield on the cell wins" (flag: may re-record goldens/sweep battles in 5.4).
  - [x] New move kinds (if any class needs a new attack verb): each is a `MoveKind` union extension riding `balanceVersion` only (the 4.7 `bash` precedent — no event-shape change), and each must state its damage type for the 5.6 card glyph rule (blast/spell = magic; slash/arrow/bash/staff = physical). A new move that needs NEW MECHANICS (extra draws, statuses, targeting rules) violates the epic fence — redesign or defer it.
  - [x] Sanity-audit each new stat row on paper (the 4.1 method — a design-time sweep is still not executable for unshipped classes): 3–5 neutral melee hits to kill a small, and note each class's intended showcase (the binding ≤65% sweeps stay with 5.4/5.5 per their ACs).
- [x] Task 3: Sitting 3 — monsters (AC: 3)
  - [x] Each monster: single-cell + 8-neighbor king-move reservation (the shipped 4.8 model as amended in epic-4 dossier §2 — no new placement semantics), slot cost (Golem precedent: 2), stat row, per-row moves, and loom treatment (Golem precedent: dedicated frame, ≥48px-equivalent presence, one HP bar/code at the cell).
  - [x] If dragons land: slayer classes and their `roleRelations` entries arrive in the SAME table (D-1b's pairing — a dragon without its counterplay doesn't ship). Elements (FR16) and any dragon-specific ideas must fit existing systems or be explicitly deferred.
  - [x] Max-monsters-per-army and no-shared-column rules: confirm the shipped values (max 2, never same column) still hold for the grown roster, or record the revision as balance data for 5.5.
- [x] Task 4: Assemble, gate, and hand off (AC: 4)
  - [x] Versioning section: NO `logVersion` bump this era (walk it: new classes = new `UnitClass` values in setup/balance data, no event-shape change — the 4.8 precedent; new `MoveKind` values ride the hash — the 4.7 precedent). State the tick points: `balanceVersion` (now 9) ticks at 5.4 (humans + shipped-12 revision), 5.5 (monsters), conditionally 5.10 (verdict tuning).
  - [x] Name the downstream carries explicitly for the 5.4/5.5/5.6 create-story passes: name-table growth per new class+sex (`names.ts` — `rollName` exhaustion fallback must stay unreachable, the 4.2 forward-note), Draft grid + army-row scenes vs BASE_WIDTH=360 (the standing coupling-site rule), AI-pool newcomer representation (single-unit substitutions first), and the 5.6 card reading everything live from BALANCE.
  - [x] Decision log complete (dated, with rationale and evidence links); PRD follow-ups flagged (FR38 wave wording, FR15 table growth) — not edited here.
  - [x] Danilo signs off the WHOLE dossier — the story's done-gate (the 4.1 precedent: a design story's review IS the PO sign-off; no code-review pass applies).
  - [x] Gate check: `packages/engine` and `apps/web` diffs EMPTY; prettier clean on the new docs.

## Dev Notes

### Execution mode — design pass, not a code sprint (the proven 4.1 pattern)

Facilitated sittings (PM/Architect hats + Danilo as PO) producing DOCUMENTS. **Zero engine diffs, zero version bumps** — `balanceVersion` 9 and the balance hash must be identical at story close. This story is the epic's GATE: 5.4, 5.5, and 5.6 all consume its table (5.6 reads per-row moves + stats live from BALANCE, so the table's shape IS the card's content). Plan multiple sittings with the DOSSIER as the running artifact; don't trim the evidence capture — it's the whole point of the story (epic-4 retro agreement: source evidence BEFORE engine code).

### What is already settled — do not reopen

- **Single-cell monsters + king-move reservation** (epic-4 dossier §2 amendment, shipped in `validate.ts`/`targeting.ts`, PRD FR38 amended at 5.0). New monsters REUSE this; the dossier states per-monster data, not new semantics.
- **ADR 0003 (frozen draw table)** — always-2-draws [dodge, crit] per finalized physical single-target hit; magic takes zero draws. No new class/move may add a draw site. If a proposed move would, it's out of the era.
- **Guard = Full/Half damage shield** (4.7 amendment in epic-4 dossier §4) — outermost post-pipeline reduction, no redirect. The §4 text ABOVE the amendment (column-bodyguard redirect) is superseded — don't design against it.
- **Melee never bypasses the front line** even under target tactics (4.4 amendment in §4); blast under Attack Leader targets the leader's row; Witch prefer-unafflicted pre-filters; heals ignore tactics.
- **The epic fence**: no new mechanics/systems/tactics. New content = new rows in existing tables. (Mid-battle tactics stays deferred to post-link-play; tactic-roster extension candidates live in deferred-work.md for Epic 6+ — do not absorb them here.)
- **ONE theme** (PO 2026-07-23) — irrelevant to stats but binds any UX note the dossier makes.

### The engine surfaces the table must land on (recon-verified 2026-07-24 at story creation)

- `packages/engine/src/balance.ts`: `version: 9`, `slotBudget: 5`, `classes: Record<UnitClass, ClassStats>` where each entry carries `role`, `sizeClass`, stats, `actions: {front,mid,back}`, `moves: {front,mid,back}` of `RowMove`. `roleRelations: readonly RoleRelation[]` (5 entries today). `formulas.guardHalf = {num:1,den:2}`.
- `packages/engine/src/types.ts:191`: `MoveKind = 'slash'|'arrow'|'blast'|'staff'|'bash'`; `RowMove = MoveKind | 'guard-full' | 'guard-half'` (Guard deliberately NOT a MoveKind — it emits `GuardRaised`, not `UnitAttacked`). A new `UnitClass` or `MoveKind` value = union + `Record` extension everywhere (exhaustiveness makes misses compile errors — the 4.8 lesson says run typecheck early in 5.4/5.5, and the dossier should size that surface list for them).
- `packages/engine/src/resolve.ts:451-455` (`attackMoveOf` back-row cast) and `:466-473` (`applyGuard` charge choice) — the two lines the AC-2 rulings govern. Read them during Sitting 2 so the ruling is made against source, not memory (the 4.0/4.1 verify-before-committing lesson).
- `packages/engine/src/names.ts`: per-sex name lists + construct designations (Golem precedent) — each new class needs its sex recorded so 5.4 knows which list grows; list sizing keeps `rollName`'s exhaustion fallback unreachable.
- `packages/engine/src/ai.ts` `STRATEGY_POOL`: newcomer representation is 5.4/5.5 work (single-unit substitutions first — the 4.3 method), but the dossier's showcase note per class ("what comp proves this class works") feeds it.

### The shipped-12 baseline the fine-tune revises

Stats + roles: epic-4 dossier §1 table (engine values match; shipped-six rows were continuity-locked then — the fine-tune MAY now change them, that's its purpose; any change re-records goldens in 5.4 and must be marked). Moves: the START-GENERIC table in §4 (Knight mid=Guard-Half; Phalanx front/mid=Guard-Full, back=bash; Wizard/Sorceress front=staff, mid/back=blast; all others uniform kind with per-row counts). Action counts f/m/b are in the §1 table. The witch's cast and cleric's heal are NOT in the moves table (they're the FR16 spell system — out of scope for the move-table revision; only their action counts and any melee fallback rows are in play).

### Art context (new since the epic breakdown — 2026-07-24)

The Midjourney sprite pipeline is COMPLETE for the current 12: `docs/planning-artifacts/ux-designs/midjourney/selected/` holds all 12 class sprites + castle battleground + Home art, and the guide records the verbatim winning prompts. Consequence for the dossier: every NEW class it adds needs art through the same pipeline (prompt → batch → pick), so the dossier's class list is also the art shopping list — hand it to Danilo's pipeline as soon as the list settles (5.9 integrates; 5.4/5.5 ship on interim sprites per their ACs, but the earlier the prompts start, the less 5.9 floats).

### Previous story intelligence (5.0, done 2026-07-24)

5.0 was housekeeping — no design content — but three things carry: (1) the stale-text bundle landed, so PRD FR38/FR17 and dossier §2 now say what the engine does (single-cell, wipeout default) — the 5.1 sittings can cite them without caveats; (2) the review lesson "prove claims under load, not idle" translates here as: verify rulings against SOURCE (resolve.ts lines, OB64 captures), never from memory; (3) the coverage gate is trustworthy again (5/5 clean instrumented runs + loaded-core proof) — 5.4/5.5 inherit a reliable gate, no flake excuses.

### Project Structure Notes

- NEW: `docs/planning-artifacts/epic-5-dossier/DOSSIER.md` (+ evidence captures beside it if Danilo uploads screenshots — name them `evidence-*.png`).
- MODIFIED: `docs/implementation-artifacts/sprint-status.yaml`, this story file, `docs/implementation-artifacts/deferred-work.md` (mark the two 4.7 entries resolved-by-ruling with the dossier reference once decided).
- NOT modified: `packages/engine/**`, `apps/web/**`, the PRD (follow-ups flagged in the dossier for the next `bmad-prd` touch), the epic-4 dossier (referenced, never edited), `docs/rules.md` (rides the implementing stories via the drift guard), the UX spines (5.6 owns the card amendment).

### References

- [Source: docs/planning-artifacts/epics.md#Story-5.1 (lines 981–1003) + the Epic 5 breakdown decisions block (line 955)] — the four AC blocks and the fence
- [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md#§1 roster table, #§2 single-cell amendment, #§3 ADR 0003 summary, #§4 move table + Guard amendment] — the settled base the dossier extends
- [Source: docs/adr/0003-battle-stream-draw-order.md] — the frozen draw table no new design may violate
- [Source: docs/implementation-artifacts/deferred-work.md#Deferred-from-code-review-of-story-4-7 (lines 176–177)] — the two rulings AC 2 closes, with exact resolve.ts line context
- [Source: packages/engine/src/balance.ts (version 9, classes, roleRelations, guardHalf); types.ts:191 (MoveKind/RowMove); resolve.ts:451-455, 466-473; names.ts; ai.ts STRATEGY_POOL] — recon-verified shapes
- [Source: docs/planning-artifacts/midjourney-asset-prompts-2026-07-23.md#Reference-material] — Danilo's OB64 evidence links (class guides, sprite sheets)
- [Source: docs/implementation-artifacts/epic-4-retro-2026-07-22.md] — the source-evidence-before-engine-code team agreement this story exists to honor
- [Source: docs/implementation-artifacts/4-1-the-epic-4-design-dossier.md] — the proven dossier-story pattern (sittings, decision log, PO sign-off as done-gate, zero-code constraint)

## Dev Agent Record

### Agent Model Used

Fable 5 (claude-fable-5)

### Debug Log References

### Completion Notes List

- 2026-07-25 (Task 0): Dossier home created at `docs/planning-artifacts/epic-5-dossier/DOSSIER.md` — constraint header (epic fence, logVersion 4 untouched, ADR 0003 frozen, Guard = Full/Half shield per the 4.7 amendment, single-cell king-move monsters, balanceVersion 9 tick points), empty decision log, §1–§4 sitting sections. Shipped-12 move-table baseline re-verified against `balance.ts` (version 9) at write time and pre-loaded into §2 as Sitting 2's walking material; the two 4.7 deferred rulings copied in with their `resolve.ts:451-455` / `:466-473` source context. Prettier-clean. Zero engine/web diffs.
- 2026-07-26 (Task 1, Sitting 1): Danilo's evidence corpus received (3 CSVs beside the dossier: OB64 reference extract, MVP wish list = the July-2026 endgoal roadmap, move catalog). Class list SETTLED: 5.4 humans (shipped 11 revised + Fencer, Dragon Hunter, Hawkman, Vultan, Raven), 5.5 monsters (Golem + Gryphon/Wyrm/Hellhound/Whelp + 6 named dragons), boosters + status-dependent classes DEFERRED (fence), promoted tiers recorded as future roadmap. Role vocabulary grown 7→10 (Dragon/Beast/Dragonslayer — the flagged "bigger call", accepted). `ROSTER.md` created as the Danilo-requested source-of-truth table companion (DOSSIER.md holds decisions/evidence; ROSTER.md the current shape + original descriptions).
- 2026-07-27 (STORY DONE): Danilo's whole-dossier SIGN-OFF ("i love it. im excited to proceed") — the story's done-gate per the 4.1 precedent (a design story's review IS the PO sign-off; no code-review pass applies). Final gate verified: `packages/engine` + `apps/web` diffs EMPTY, prettier clean on all new docs, balanceVersion 9 + hash untouched. THE GATE IS OPEN: 5.4/5.5/5.6 may be created. Art shopping list ready for the MJ pipeline (5 humans + 10 monsters).
- 2026-07-27 (Tasks 2+3 COMPLETE, Task 4 near-complete): Engine stat rows APPROVED by Danilo (E5-D15, incl. Valkyrie INT 12→18); §2/§3 flipped to DECIDED; §4 versioning walk CONFIRMED against the settled table (15 UnitClass values + bolt/breath MoveKinds + race field + 3 roles/1 relation — no event-shape change, logVersion 4 holds); PRD follow-ups extended (FR14 roles, leader rule). Remaining: Danilo's whole-dossier sign-off + final gate check.
- 2026-07-27 (Task 2 partial + Task 3 partial): Fine-tune walk COMPLETE (E5-D4 Wizard/Sorceress lose splash → new `bolt` kind; E5-P2 guard fine-tune; E5-D10 flavor pack; per-class re-record flags tabled in §2). The two 4.7 rulings DECIDED (E5-D12: back-row Guard forbidden as data; overlapping guards keep shipped) — deferred-work.md entries marked resolved-by-ruling. New MoveKinds settled (`bolt` magic ranged-single; `breath` physical row-AoE; both zero-draw, riding balanceVersion). Monster caps confirmed + NEW humans-only leader rule (E5-D13, race field carried by 5.5). E5-D14 consistency ruling: Wind Shot/Thunder Arrow ride `arrow` (physical Skills). Engine-scale stat rows for all 16 new/amended classes PROPOSED in ROSTER.md (kill-audit + showcase per class) — awaiting Danilo's review (Task 2 remainder).

### File List

- `docs/planning-artifacts/epic-5-dossier/DOSSIER.md` (new)
- `docs/planning-artifacts/epic-5-dossier/ob64-recall-draft.md` (new — agent recall draft, superseded by Danilo's CSVs as evidence)
- `docs/planning-artifacts/epic-5-dossier/lordly-original-ob64-class-list-and-more.csv` (new — Danilo's OB64 reference extract, AC-1 evidence)
- `docs/planning-artifacts/epic-5-dossier/lordly-my-mvp-wish-wip.csv` (new — Danilo's MVP wish list, Sitting 1 input)
- `docs/planning-artifacts/epic-5-dossier/attack-names-and-more.csv` (new — move catalog evidence)
- `docs/planning-artifacts/epic-5-dossier/ROSTER.md` (new — the source-of-truth roster/moves table, Danilo-requested companion; DOSSIER.md holds the decisions)
- `docs/implementation-artifacts/deferred-work.md` (modified — the two 4.7 entries marked resolved-by-ruling, E5-D12)

## Change Log

- 2026-07-25: Story started (dev-story); dossier home created (Task 0).
- 2026-07-26: Sitting 1 — evidence corpus (3 Danilo CSVs) received; class list settled; ROSTER.md source-of-truth companion created; decisions E5-D1..D9 + role-vocabulary growth.
- 2026-07-27: Sittings 2+3 — fine-tune walk, both 4.7 rulings closed (deferred-work.md updated), monster rules + humans-only leader rule, engine stat rows approved (E5-D10..D15); §4 versioning walk confirmed (logVersion 4 holds).
- 2026-07-27: Danilo's whole-dossier sign-off → story DONE (design-story precedent: PO sign-off is the review). Zero engine/web diffs; no version bumps.
- `docs/implementation-artifacts/sprint-status.yaml` (modified — 5-1 in-progress)
- `docs/implementation-artifacts/5-1-the-roster-and-moves-dossier.md` (modified — this file)
