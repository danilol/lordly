---
stepsCompleted: [1, 2, 3, 4, 5, 6]
documentsIncluded:
  prd: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md
  prdAddendum: docs/planning-artifacts/prds/prd-lordly-2026-07-11/addendum.md
  architecture: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md
  epics: docs/planning-artifacts/epics.md
  ux: none (deliberately skipped — open UX calls owned by stories 2.1/2.2)
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-12
**Project:** Lord Battle Tactics (lordly)

## Document Inventory

| Document | Path | Status | Notes |
|---|---|---|---|
| PRD | `prds/prd-lordly-2026-07-11/prd.md` | final | 31 FRs, 6 NFRs; addendum as reference |
| Architecture Spine | `architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md` | final | 13 ADs, verified stack |
| Epics & Stories | `epics.md` | steps 1–3 complete | 3 epics, 16 stories |
| UX Design | — | intentionally absent | camera perspective → story 2.2 ADR; sprite pack → story 2.1 |

No duplicate document formats found. Product brief exists upstream and is superseded by the final PRD (not an assessment target).

## PRD Analysis

### Functional Requirements

FR1: Army of exactly 3 units from 6 classes; duplicates allowed (56 compositions); both sides equal size.
FR2: Draft screen — name, sprite, compact rules card per class; draftable without a tutorial.
FR3: Random element per drafted unit (Fire/Water/Wind/Earth) from the seeded generator; owner sees pre-placement, opponent at reveal; fixes Witch spell (FR16); cosmetic otherwise in MVP; re-rolled every match.
FR4: Placement on own 3×3 grid (front/middle/back × left/center/right), touch drag-and-drop, any arrangement legal.
FR5: Hidden simultaneous placement; nothing visible until both submit; AI commits blind (FR24).
FR6: Reveal shows both boards face to face before combat.
FR7: Reach — facing column + adjacent; corner reaches two, center three; applies to Knight/Mercenary/Archer/Witch; Mage blast and Cleric heal ignore reach.
FR8: Melee targeting — nearest occupied row, no bypass; priority facing → center-closer → left; re-evaluated per attack.
FR9: Ranged targeting (Archer) — rearmost occupied reachable row; FR8 column priority and re-evaluation.
FR10: Mage row blast — whole enemy row ignoring reach; row with most living units, tie → rearmost; RPS per target.
FR11: Cleric heals lowest-HP-% living ally (self included, max HP cap); weak STR staff attack via magic targeting when no ally damaged.
FR12: Witch casts prepared spell on one enemy via magic targeting, prefers unaffected targets, deals no damage.
FR13: AGI initiative timeline in passes; one action per living unit per pass, descending AGI across both armies; multihit split; ties front → left → seeded coin; dead/sleeping lose actions; effects apply immediately.
FR14: RPS — Mage>Knight>Archer>Mage; ×1.5 advantage, ×0.75 disadvantage; Mercenary/Cleric/Witch neutral.
FR15: Six fixed per-class attributes (STR/VIT/INT/MEN/AGI/DEX; DEX reserved); formulas phys = STR−VIT/2, magic = INT−MEN/2, min 1, then RPS; heal = INT×1.25; integer math, fixed rounding order; class stat table as data-file tuning values.
FR16: Witch spells by element — Water→Sleep, Earth→Poison (15 at engagement end, pre-judging; each engagement in wipeout), Fire→Weaken (damage halved), Wind→Confusion (50% seeded misfire onto own side; fizzle if no target); no stacking.
FR17: Single engagement — every unit spends its per-row action count once; engagement end = match end.
FR18: Judging — wipe = instant win; else higher % of starting team HP; exact tie = draw with rematch offered.
FR19: Until-wipeout mode (stretch) — repeat engagements; statuses clear between except poison persists; 5-engagement cap then FR18.
FR20: Determinism — battle is a pure function of (compositions with elements, placements, seed); all randomness seeded.
FR21: Animated OB64-style battle scene — lanes, initiative-ordered action beats, damage numbers, HP bars, status icons, visible deaths; camera perspective is a UX-phase decision; must read on a phone.
FR22: Result screen — winner + both HP %, both compositions, one-tap Rematch and Home.
FR23: Battle speed control (normal / ×2 min) + skip-to-result.
FR24: AI plays by human rules; commits composition/placement/spells with no knowledge of player choices.
FR25: AI curated strategy pool (~8–12 archetypes), seeded variation, punishes lazy formations; single difficulty ~50% win target.
FR26: AI decision < 1 s, fully client-side, offline.
FR27: Core loop Home→Draft→Placement→Reveal→Battle→Result→(Rematch|Home) under 5 min, no account, no tutorial gate; rules/help screen from Home and Draft.
FR28: Battle history — last 10 on-device (winner, compositions, date, seed); replayable via FR20; History from Home.
FR29: PWA — installable, HTTPS, fully offline for vs-AI.
FR30: Mobile-first portrait (~360×640+), touch-native; functional centered desktop layout.
FR31: Art from free/CC pixel packs; idle/attack/hurt/death per unit; attributions in repo + credits screen.

Total FRs: 31

### Non-Functional Requirements

NFR1: 60 fps target / 30 floor on Pixel 6a-class Android Chrome; load ≤ 5 s on 4G; bundle sized accordingly.
NFR2: Engine = pure Phaser-free TS module; every Features 3–5 rule unit-tested; property tests (termination, judging symmetry, seed identity); golden-battle snapshots; CI blocks red; ≥ 90% engine line coverage.
NFR3: README quickstart; rules doc aligned with Features 3–5 (doubles as help content); ADRs; doc comments on engine public API and exports.
NFR4: Stats in a data file; headless AI-vs-AI sim harness sweeps compositions for dominant strategies.
NFR5: No accounts, personal data, tracking, or monetization; localStorage only.
NFR6: Engine contract "two boards + seed → battle log"; army size parameterized (3 now, 5 later); link-play swaps opponent without engine change.

Total NFRs: 6

### Additional Requirements

- 16 inline `[ASSUMPTION]` tags (tuning values, AGI ordering, multipliers, cap values, element re-roll, portrait-first, coverage gate) — documented risks, none blocking.
- Out of Scope explicitly parks: link-play, world map, leveling/promotions, elemental-affinity wheel, DEX mechanics/parries, items, accounts, native packaging, tactics orders, squad-leader mechanics, roster/5-slot growth.
- Open Items (§7): balance numbers unproven until harness+playtests (not a blocker); FR19 MVP-or-later decision delegated to epic planning; speed/skip default watch item.
- Glossary (§8) fixes the domain vocabulary the architecture adopts verbatim (AD-4 convention).

### PRD Completeness Assessment

The PRD is unusually implementation-ready: FRs are numbered, testable, and written as a rules spec (Features 3–5 explicitly double as the test spec per NFR2). Judging, tie-breaking, edge cases (confusion misfire targets, fizzle, poison timing vs judging) are specified. The stat table is declared tuning data, cleanly separating rules from numbers. Open items are triaged with owners/conditions. No vague or untestable FR found. UX-level detail (camera perspective, layouts) is explicitly delegated rather than silently missing.

## Epic Coverage Validation

Verified mechanically: every FR citation in every story's acceptance criteria was extracted by regex (excluding NFR matches) and mapped back to the PRD's 31 FRs.

### Coverage Matrix

| FR | Requirement (abbrev.) | Story Coverage | Status |
|---|---|---|---|
| FR1 | Draft 3 of 6, duplicates | 1.6 | ✓ |
| FR2 | Class rules cards | 1.6, 2.1, 2.4 | ✓ |
| FR3 | Element rolls at draft | 1.2, 1.6, 2.1 | ✓ |
| FR4 | 3×3 touch placement | 1.6 | ✓ |
| FR5 | Hidden simultaneous | 1.6 | ✓ |
| FR6 | Reveal | 1.7 | ✓ |
| FR7 | Reach / column adjacency | 1.3 | ✓ |
| FR8 | Melee targeting | 1.3, 1.4 | ✓ |
| FR9 | Ranged targeting | 1.4 | ✓ |
| FR10 | Mage row blast | 1.4 | ✓ |
| FR11 | Cleric heal / staff | 1.4 | ✓ |
| FR12 | Witch casting | 1.4 | ✓ |
| FR13 | AGI initiative timeline | 1.3 | ✓ |
| FR14 | RPS multipliers | 1.3 | ✓ |
| FR15 | Attributes & formulas | 1.2, 1.3, 1.4 | ✓ |
| FR16 | Element-keyed spells | 1.4 | ✓ |
| FR17 | Single engagement | 1.3 | ✓ |
| FR18 | HP % judging, draw | 1.3, 1.7, 1.8 | ✓ |
| FR19 | Until-wipeout (stretch) | 1.8 | ✓ |
| FR20 | Determinism | 1.3 (seed-identity AC, by content), 3.2 (cited) | ✓ |
| FR21 | Animated battle scene | 1.7 (functional), 2.2 (full) | ✓ |
| FR22 | Result screen | 1.7, 2.3 | ✓ |
| FR23 | Speed / skip | 2.3 | ✓ |
| FR24 | AI blindness | 1.5, 1.6 | ✓ |
| FR25 | AI strategy pool | 1.5 | ✓ |
| FR26 | AI < 1 s, offline | 1.5, 3.3 | ✓ |
| FR27 | Core loop + help | 1.7 (loop), 2.4 (help) | ✓ |
| FR28 | History + replay | 3.1, 3.2 | ✓ |
| FR29 | PWA offline | 3.3 | ✓ |
| FR30 | Portrait touch layout | 1.1, 1.6, 2.2 | ✓ |
| FR31 | CC art + credits | 2.1, 2.4 | ✓ |

### Missing Requirements

None. No FR lacks story coverage; no story invents an FR absent from the PRD (max cited ID = FR31, matching the PRD).

Observation (non-blocking): FR20's tag appears in story 3.2's ACs, while its substance in Epic 1 is carried by story 1.3's seed-identity/property-test ACs without the literal tag. Traceability is intact via content; a dev agent reading 1.3 cannot miss the determinism requirement.

### Coverage Statistics

- Total PRD FRs: 31
- FRs covered in epics: 31
- Coverage percentage: **100%**

## UX Alignment Assessment

### UX Document Status

**Not found** — and UX/UI is unambiguously implied (touch-first mobile game, nine Phaser scenes). The skip was a deliberate, recorded decision (epics-and-stories input round, 2026-07-12), not an oversight.

### Alignment Issues

None between the documents that exist: the PRD carries the UX-critical requirements itself (FR30 portrait/touch layout, FR21 readability on a phone, FR2 no-tutorial draftability, FR27 no-gate flow), and the architecture supports them (AD-5 scene FSM enumerates all nine screens; NFR1 performance envelope is a spine convention with a verification story).

### Warnings

⚠️ **UX gap is real but contained.** The two design decisions a UX phase would normally own are explicitly assigned to stories with an ADR obligation: camera perspective (FR21 → story 2.2) and sprite-pack selection (FR31 → story 2.1). Remaining risk: screen layouts and interaction details will be designed inline by dev agents during Epic 1's UI stories (1.6, 1.7) with only FR30's constraints as guidance — acceptable for a solo passion project, but if draft/placement ergonomics feel wrong at the 1.7 playable milestone, running `bmad-ux` before Epic 2 is the correction point.

## Epic Quality Review

Standards from the create-epics-and-stories workflow, enforced by an independent fresh-context reviewer plus a standards walk. Clean categories first: **epic independence** (no violations — Epics 2/3 consume only earlier work; the `web/storage` split settings-in-2.3 / history-in-3.1 is correctly ordered), **forward dependencies** (none found — 1.6→1.5, 2.2→2.1, 3.2→3.1 all point backward), **storage timing** (no upfront schema), **starter template** (story 1.1 matches the spine's scaffold command, pinned bumps, and early CI exactly).

### 🔴 Critical Violations

None.

### 🟠 Major Issues (fix before sprint planning)

1. **Story 1.6 — invalid placement unspecified.** ACs cover the happy path only; no behavior for dropping onto an occupied cell, dropping off-grid, or the pre-submit disabled state. *Remediation: add G/W/T cases.*
2. **Story 1.6 — un-drafting undefined, touches the seed-stream contract.** Removing a drafted unit isn't specified; if re-adding draws again from `elements/A`, stream position changes (AD-10 interaction). *Remediation: specify remove/undo and its element-stream semantics.*
3. **Story 1.3 — secretly epic-sized.** Timeline + tie-breaks + multihit + reach/melee + formulas + deaths + judging + BattleLog skeleton + full test suite ≈ 3 sessions. *Remediation: split into 1.3a (timeline/initiative + BattleLog skeleton) and 1.3b (melee targeting + damage + judging + tests).*
4. **Story 1.1 — fat scaffold.** Monorepo + bumps + CI + deploy + Home scene + README ≈ 5–6 deliverables. *Remediation: split deploy+Home from scaffold+CI, or accept with a timebox.*
5. **Story 1.4 — confusion misfire underspecified for physical classes.** FR16 defines misfire targets for Mage and Cleric only; Knight/Mercenary/Archer/Witch own-side target selection is undefined. *Remediation: state the rule (e.g., normal targeting logic mirrored onto own board) — ideally patch FR16/PRD too.*

### 🟡 Minor Concerns (note and proceed)

6. Story 1.2 is a developer-facing foundation story — the known borderline case, acceptable as engine substrate inside a user-value epic.
7. Coverage-gate timing: AD-7 says ≥90% "on every push" but stories enable it at 1.4 — defensible sequencing; record the deviation.
8. Story 2.3 "dramatically" is untestable — replace with concrete elements.
9. Story 2.2 readability criteria lack measurable thresholds.
10. Story 1.7 playback pacing unspecified (no beat duration, no skip until Epic 2) — add a default beat duration or tap-to-advance.
11. Story 1.5 lacks an AC tying sim-harness output to FR25's ~50% win-rate target — add a band or explicitly defer tuning.
12. Engine typed-error validation (spine convention) has no test AC — add to 1.3.
13. NFR3's standalone repo rules document has no explicit story deliverable — story 2.4's help content covers it implicitly; make it an explicit 2.4 artifact.

## Summary and Recommendations

### Overall Readiness Status

**NEEDS WORK (minor) — one short remediation pass on `epics.md`, then READY.**

The plan's foundations are sound: 100% FR traceability verified mechanically, zero critical violations, clean epic independence, no forward dependencies, architecture and stories mutually consistent, and the starter-template mandate honored exactly. Nothing requires re-planning, re-architecture, or PRD changes (one optional PRD patch noted below). What stands between here and sprint planning is a set of acceptance-criteria edits and two story splits — an estimated single short editing session.

### Critical Issues Requiring Immediate Action

No critical issues. The five major items (all in `epics.md`, one optionally also in the PRD) to address before sprint planning:

1. Story 1.6: add ACs for occupied-cell drop, off-grid drop, pre-submit disabled state.
2. Story 1.6: define un-drafting and its `elements/A` stream semantics (AD-10).
3. Story 1.3: split into 1.3a (timeline + BattleLog skeleton) and 1.3b (melee combat + judging + tests) — it is 2–3 sessions as written.
4. Story 1.1: split deploy+Home from scaffold+CI, or accept with an explicit timebox.
5. Story 1.4: specify confusion-misfire target selection for physical classes (and optionally patch PRD FR16 to match).

### Recommended Next Steps

1. **Apply the remediation pass** to `epics.md` (5 major + optionally the 8 minor AC tightenings). Can be done immediately in this or a fresh session.
2. **Run `bmad-sprint-planning`** in a fresh context window to generate the sprint plan from the remediated epics.
3. **Begin the story cycle** (`bmad-create-story` → validate → `bmad-dev-story` → `bmad-code-review`) starting with Story 1.1.
4. Watch item: reassess the UX gap at the Story 1.7 playable milestone — if draft/placement ergonomics disappoint, run `bmad-ux` before Epic 2.

### Final Note

This assessment identified 13 issues (0 critical, 5 major, 8 minor) across 3 categories (story specification gaps, story sizing, testability wording). Address the majors before sprint planning; the minors can ride along in the same pass or be accepted consciously. The findings are edits, not redesign — the PRD → architecture → epics chain is coherent and traceable end to end.

---

*Assessed 2026-07-12 · Inputs: PRD (final), Architecture Spine (final), epics.md (steps 1–3) · Method: mechanical FR-coverage extraction + independent fresh-context quality review + standards walk.*

## Remediation Addendum (2026-07-12, same day)

All 5 major and 8 minor findings were applied to `epics.md` immediately after this assessment. **Epic 1 was renumbered by two story splits** (old → new): 1.1 → 1.1 (scaffold+CI) + 1.2 (deploy+home) · 1.2 → 1.3 · 1.3 → 1.4 (timeline chassis + typed-error validation) + 1.5 (melee+judging) · 1.4 → 1.6 · 1.5 → 1.7 · 1.6 → 1.8 · 1.7 → 1.9 · 1.8 → 1.10. Epic 1 now has 10 stories (18 total across the three epics). The coverage matrix above cites pre-remediation numbers. Additional changes: story 1.8 gained placement-error and forward-only un-draft ACs; 1.7 gained a sim-harness acceptance band; 1.9 gained playback pacing; 2.2/2.3 criteria made measurable; 2.4 gained the explicit `docs/rules.md` artifact; PRD FR16 patched with the confused-Witch misfire case (logged in the PRD memlog). **Status after remediation: READY for sprint planning.**
