# Implementation Readiness Assessment Report

**Date:** 2026-07-17
**Project:** Lord Battle Tactics (Epic 4 — the squad era)

## Document Inventory

| Document | File | Status |
|---|---|---|
| PRD | `prds/prd-lordly-2026-07-11/prd.md` (+ `addendum.md` companion) | final, updated 2026-07-16 (Epic 4 amendments, FR1–FR39) |
| Architecture | `architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md` | final, updated 2026-07-16 (AD-1…AD-15) |
| Epics & Stories | `epics.md` | Epics 1–3 shipped; Epic 4 stories 4.0–4.12 drafted 2026-07-16 |
| UX Design | `ux-designs/ux-lordly-2026-07-13/DESIGN.md` + `EXPERIENCE.md` | final pair, 2026-07-13/15 — pre-dates Epic 4 |

No whole/sharded duplicates. Supporting context: `epic-4-design-pass-input-2026-07-16.md`, PRD review docs (`review-consistency-epic4.md`, `review-rubric-epic4.md`), sprint change proposals, epic retros. Scope of this assessment: **the Epic 4 era** (Epics 1–3 are shipped and were validated by the 2026-07-12 report).

## PRD Analysis

### Functional Requirements

FR1: 5-slot army budget (small = 1, monster = 2); all 5 slots spent exactly; max 2 monsters; duplicates allowed; equal budgets. *(amended 2026-07-16)*
FR2: Draft cards: name, sprite, compact rules card; from Epic 4 the improved spec — role, matchups, per-row behavior, action counts.
FR3: Per-unit random element (Fire/Water/Wind/Earth) from seeded generator; owner sees pre-placement, opponent at reveal; keys the Witch's spell.
FR4: 3×3 owner-grid touch placement; monster = two vertical cells of one column (F+M or M+B), two monsters never share a column; placement designates leader (FR35) and tactic (FR34). *(amended)*
FR5: Hidden simultaneous placement — composition, placement, tactic, leader all hidden until both submit; AI commits blind.
FR6: Reveal shows both boards face to face incl. leader marking and tactic. *(amended)*
FR7: Reach (facing + adjacent columns) is melee-only from Epic 4; ranged/magic get global range; Last Stand fallback for reach-starved melee. *(amended)*
FR8: Melee targeting — nearest occupied row among reachable, no bypass; facing → center-closer → left; re-evaluated per attack.
FR9: Ranged targeting — rearmost-first as Autonomous behavior over the whole grid; tactics dissolve row preference. *(amended)*
FR10: Mage row blast — most-living row, tie rearmost; `blastAttenuation` ×0.75 in wipeout only; RPS per target. Archmage gating postponed post-link-play (PO, 2026-07-16).
FR11: Cleric heals lowest-HP-% living ally, ignoring reach; staff fallback with magic targeting.
FR12: Witch casts element-keyed spell by magic targeting, prefers unaffected; no damage.
FR13: AGI initiative timeline in passes; multihit split; ties front → left → seeded coin flip; dead/sleeping lose actions.
FR14: Role-based advantage relations (symmetric ×1.5/×0.75 or one-way ×1.5) replace the class triangle; shipped matchups reproduced as the degenerate case; sweep-policed. *(amended)*
FR15: Six OB64 attributes fixed per class; integer math, fixed rounding order; 12-class roster wave 1 (+4 smalls, +2 monsters); DEX unreserved. *(amended)*
FR16: Witch spells — Water→Sleep, Earth→Poison(15/engagement end), Fire→Weaken, Wind→Confusion (50% seeded misfire); no stacking.
FR17: Single-engagement mode — actions spent once; engagement end = match end.
FR18: Judging — wipe wins; else higher % starting team HP; exact tie = draw + rematch offer.
FR19: Until-wipeout mode — statuses clear between engagements except poison; cap **10** engagements then FR18. *(amended: 5 → 10)*
FR20: Determinism — battle is a pure function of (compositions+elements, placements, tactics, leaders, seed). *(amended)*
FR21: Animated OB64-style battle scene, phone-readable.
FR22: Result screen — winner, HP %s, compositions, Rematch/Home.
FR23: Battle speed control (normal/×2+) and skip-to-result.
FR24: AI plays by human rules — commits composition, placement, spells, tactic, leader blind. *(amended)*
FR25: AI strategy pool (~8–12 archetypes), seeded variation, punishes lazy formations.
FR26: AI decision < 1 s, client-side, offline.
FR27: Core loop under 5 min, no account, no tutorial gate; help from Home/Draft.
FR28: History — last 10 on-device; stored setup carries tactic + leader from Epic 4; replayable. *(amended)*
FR29: PWA — installable, HTTPS, offline vs-AI.
FR30: Mobile-first portrait ~360×640+, touch-native.
FR31: Free/CC pixel art, 4 animation states, attribution manifest + credits screen.
FR32: Per-row move-kind variety per class; full move table is a design deliverable. *(new)*
FR33: Defensive "Guard" move type — raised mitigation or negate-one-attack; core new-mechanic design question. *(new)*
FR34: Army-wide tactic in MatchSetup (autonomous/weakest/strongest/leader); fixed two-step targeting pipeline; absolute-HP metric; ties → Autonomous priority; no mid-battle switching. *(new)*
FR35: Squad leader designation; leader-killed penalty state (tactic reversion + physical reduction ratio). *(new)*
FR36: Crits and dodge from DEX; seeded per-attack draws on `battle` stream, frozen draw order; event outcomes crit/missed/dodged. *(new)*
FR37: Generated unit names — rolled once at draft on `names/A|B` streams, stored in setup; flavor only. *(new)*
FR38: Monsters — dragon + golem; 2 slots, two-cell vertical footprint; full stat citizens; two-cell semantics (targeting AND acting) defined before implementation. *(new)*
FR39: Battle legibility — (a) "Turn" wording, (b) action ledger, (c) placement action counts, (d) from→to attacks, (e) drop "front" label, (f) label contrast fix, (g) pause (dropped for wave 1, PO 2026-07-16). *(new)*

Total FRs: 39 (8 new in Epic 4; 14 carrying Epic 4 amendments)

### Non-Functional Requirements

NFR1: 60 fps target / 30 floor on Pixel 6a-class; load ≤ 5 s on 4G; measured baseline in `docs/performance-verdict.md`.
NFR2: Pure Phaser-free engine; every battle rule unit-tested; property tests (termination, judging symmetry, seed identity); golden battles; CI gate ≥ 90 % engine lines.
NFR3: README, rules doc (= Help content, drift-guarded), ADRs, doc comments on engine exports.
NFR4: Balance data file + headless AI-vs-AI sweep; Epic 4 scaling pass (12 classes × tactics × leaders × monsters).
NFR5: No accounts, no tracking, localStorage only.
NFR6: Engine contract "boards + tactics + leaders + seed → battle log"; slot-budget as data; link-play seam preserved. *(amended)*

Total NFRs: 6

### Additional Requirements

- One combined `logVersion`/`balanceVersion` era bump (PRD Feature 6b, AD-15); `StatusCleared` rides it; stories accept incrementally.
- Crit/dodge draw ORDER frozen forever (FR20/FR36/AD-10) — the seed is the recording.
- Open Items now closed at breakdown: Archmage gating (postponed post-link-play), FR39g pause (dropped wave 1).
- Open Items live: balance numbers (perpetual, sweep-policed), speed/skip default (playtest), Epic 4 design deliverables (owned by story 4.1), sweep scale (story 4.12).

### PRD Completeness Assessment

The PRD is complete and current for the Epic 4 era: Feature 6b carries all eight new FRs with their design deliverables explicitly named and routed to the epic's design story; the two decisions the PRD parked for story breakdown (Open Items 4, and FR39g's optionality) were made and recorded at the 2026-07-16/17 breakdown. One follow-up: PRD Open Item 4 and the Out-of-Scope list should absorb the "promotion postponed until after link-play" decision on the next PRD touch (currently recorded in epics.md only).

## Epic Coverage Validation

Method: each FR was checked against the **story acceptance criteria** in epics.md, not just the document's own FR Coverage Map. Shipped FRs (Epics 1–3, validated 2026-07-12 and delivered) are marked "shipped"; the matrix focuses on where each FR's Epic 4 delta lands.

### Coverage Matrix

| FR | Requirement (short) | Coverage | Status |
|---|---|---|---|
| FR1 | 5-slot budget, monsters cost 2 | 4.2 (engine + draft), 4.9 (all combos draftable) | ✓ |
| FR2 | Draft rules cards → improved spec | shipped; 4.3 (spec cards), 4.7 (per-row moves) | ✓ |
| FR3 | Element rolls | shipped (1.3/1.8); unchanged | ✓ |
| FR4 | Placement + monster footprint + leader/tactic | shipped; 4.9 (monster drag), 4.4 (tactic), 4.5 (leader) | ✓ |
| FR5 | Hidden simultaneous commit incl. tactic/leader | shipped; 4.4/4.5 ACs (hidden until reveal) | ✓ |
| FR6 | Reveal incl. tactic + leader | shipped; 4.4/4.5 ACs (reveal disclosure) | ✓ |
| FR7 | Reach → melee-only + Last Stand | shipped; 4.4 (pipeline rewrite) | ✓ |
| FR8 | Melee targeting | shipped (1.5); priority reused as Autonomous in 4.4 | ✓ |
| FR9 | Ranged rearmost → global-range Autonomous | shipped (1.6); 4.4 | ✓ |
| FR10 | Row blast + attenuation; Archmage postponed | shipped (1.6/3.0); tactic interaction 4.1→4.4; postponement recorded | ✓ |
| FR11 | Cleric heal | shipped (1.6); tactic interaction 4.1→4.4 | ✓ |
| FR12 | Witch casting | shipped (1.6); prefer-unafflicted under tactics 4.1→4.4 | ✓ |
| FR13 | AGI timeline | shipped (1.4); two-row tie-break 4.1 (design) → 4.8 (impl) | ✓ |
| FR14 | Role-based relations | 4.3 (replace rpsBeats/rpsHunts, continuity tests) | ✓ |
| FR15 | Attributes + 12-class roster, DEX live | shipped (1.3); 4.1 (stat rows) → 4.3 (roster) | ✓ |
| FR16 | Witch spells | shipped (1.6); unchanged | ✓ |
| FR17/FR18 | Single engagement / judging | shipped (1.5); unchanged | ✓ |
| FR19 | Wipeout cap 10 | shipped (1.10); 4.2 (cap + Home copy) | ✓ |
| FR20 | Determinism incl. tactics/leaders | shipped; 4.2 (setup inputs), 4.6 (frozen draws, replay-from-seed AC) | ✓ |
| FR21–FR23 | Battle scene, result, speed/skip | shipped (Epic 2); 4.10 extends presentation | ✓ |
| FR24 | AI blind incl. tactic/leader | shipped (1.7); 4.2 (5-slot), 4.4 (tactic), 4.5 (leader, seeded variation) | ✓ |
| FR25/FR26 | AI pool / speed | shipped (1.7); pool extensions 4.3/4.8 | ✓ |
| FR27 | Core loop | shipped (1.9/2.4); unchanged | ✓ |
| FR28 | History + tactic/leader stored | shipped (3.1/3.2); 4.2 (store), 4.5 (History card display) | ✓ |
| FR29/FR30 | PWA / portrait | shipped (3.3, 1.x); unchanged | ✓ |
| FR31 | CC art + credits | shipped (2.1/2.4); 4.9 (monster sprites + manifest) | ✓ |
| FR32 | Per-row move variety | 4.1 (move table) → 4.7 (implementation) | ✓ |
| FR33 | Guard | 4.1 (mechanic decision) → 4.7 | ✓ |
| FR34 | Tactics | 4.1 (interaction rules) → 4.4 | ✓ |
| FR35 | Leader + penalty | 4.1 (numbers) → 4.5 | ✓ |
| FR36 | Crits + dodge | 4.1 (chances, frozen draw table) → 4.6 | ✓ |
| FR37 | Generated names | 4.1 (name table) → 4.2 | ✓ |
| FR38 | Monsters | 4.1 (semantics) → 4.8 (engine) → 4.9 (phone) | ✓ |
| FR39 | Legibility a–g | (a,e,f) 4.0; (b,c) 4.11; (d) 4.10; (g) dropped — recorded PO decision, not a gap | ✓ |

### Missing Requirements

None. Every PRD FR traces to shipped work or a named Epic 4 story AC. No FRs appear in epics.md that are absent from the PRD. The single deliberate descope — FR39g pause — is recorded in the PRD (`[ASSUMPTION: wave-1-optional]`), the epics preamble, and story 4.10's AC.

### Coverage Statistics

- Total PRD FRs: 39
- FRs covered (shipped or storied): 39
- Coverage: 100 % (one sub-item, FR39g, deliberately descoped with recorded rationale)

## UX Alignment Assessment

### UX Document Status

**Found** — bmad-ux spine pair: `DESIGN.md` (visual identity, final 2026-07-13) + `EXPERIENCE.md` (behavior/IA, final, updated 2026-07-15). Both are binding contracts ("mocks illustrate, the spine decides"). **The pair pre-dates Epic 4 entirely.**

### Alignment Issues

1. **The spine's deferred list contradicts the current PRD.** `EXPERIENCE.md` "Explicitly Deferred" still lists *tactics orders* and *DEX mechanics* as "PRD Out of Scope" — both are now committed Epic 4 scope. The spine must stop deferring what the PRD now requires.
2. **Undesigned Epic 4 surfaces.** Tactic picker, leader designation, reveal disclosure of both, monster two-cell rendering (board, cards, History), unit-name display, the action ledger (FR39b — PO-flagged key display problem), and placement action counts (FR39c) have no spine coverage. **Mitigated by sequencing:** story 4.1's AC mandates the DESIGN/EXPERIENCE extension before any implementing story runs (UX-DR9).
3. **"FRONT" indicator conflict.** FR39e removes the "front" word; `EXPERIENCE.md`'s locked Battle layout specifies a directional "FRONT" arrow. Story 4.0's AC resolves it by amending the spine (keep the non-verbal indicator, drop the word) — flagged as UX-DR8.
4. **Stale copy and counts throughout the spine.** "Pick 3 units", "N / 3", "place all 3 units", Wipeout hint "max 5 engagements" — all superseded by FR1 (5 slots) and FR19 (cap 10). Individually small, but the 4.1 spine-extension pass should sweep **all** unit-count and cap references wholesale, not just the surfaces it adds.
5. **Settings realization** remains an open `[ASSUMPTION]` in the spine (modal vs tenth scene). Not Epic-4-blocking (pause was dropped; theme/speed shipped in 2.3), but it remains unresolved spine debt.

### UX ↔ Architecture Alignment

- The ledger's data path is architecture-clean: AD-12's union extension explicitly carries the per-action ledger payload, and story 4.11 pins "the scene derives nothing" (AD-2). ✓
- Placement drag feedback for monsters routes through engine-exported `legalAnchors`/`canPlace` (AD-14) — no scene-local legality math. ✓
- No new scenes needed: tactic/leader UI lives in Placement, the ledger in Battle — AD-5's closed nine-scene FSM holds. ✓
- Performance risk from UX additions (text-ceiling backing store, monster sprites, ledger redraws) is gated: 4.0 and 4.12 measure against `docs/performance-verdict.md`'s baseline (NFR1). ✓

### Warnings

⚠️ **The UX spine is currently a contract that contradicts the PRD it must serve.** This is acceptable **only** because story 4.1 gates all implementation and its ACs require the spine extension + amendments first. If 4.1's UX scope gets trimmed under pressure, stories 4.2–4.11 lose their binding UX authority — treat the 4.1 spine extension as non-negotiable.

## Epic Quality Review

Scope: Epic 4 (stories 4.0–4.12). Epics 1–3 are shipped and were quality-reviewed in the 2026-07-12 report; re-litigating delivered work adds nothing.

### Epic Structure

- **User value:** the epic title and goal are player-outcome-centric ("command a real OB64 squad"); the epic delivers a complete, playable transformation. ✓
- **Independence:** Epic 4 builds only on shipped Epics 1–3; nothing requires link-play. The one-mega-epic consolidation was explicitly decided by the PO with recorded rationale (one history invalidation under AD-15) — the within-epic file churn on engine targeting/balance files is the *reason* for consolidation, not an accident. ✓
- **Starter template / greenfield checks:** N/A — brownfield era on a shipped codebase; integration stories exist (4.2's non-replayable-history device check, per-story golden re-recording). ✓
- **Data-creation timing:** balance data lands with the story that needs it (slots 4.2, roster 4.3, monsters 4.8). The deliberate exception — the full event-union *types* land in 4.2 before all emitters exist — is mandated by AD-15, not premature generality. ✓

### 🔴 Critical Violations

None found. No technical-layer epics, no forward dependencies (each story runs on predecessors only; interim defaults in 4.2 are the same pattern story 1.9 used for its interim fast-forward).

### 🟠 Major Issues

1. **Story 4.1 (design dossier) carries scope risk.** It bundles the entire era's rules design (roles, 12 classes, monster semantics, crit/dodge + frozen draw table, moves/Guard, tactic interactions, leader numbers, name table), the AD-12 render-surface walk, AND the DESIGN/EXPERIENCE spine extension. Any one of these is a real session. *Remediation:* keep it as one story (its deliverables must cohere — the union walk needs every design decided), but plan its execution as multiple sittings with the dossier document as the running artifact; if it stalls, split the UX spine extension into a 4.1b rather than trimming it (see UX warning above).
2. **Story 4.2 (era turnover) is the epic's biggest implementation story.** Slot vocabulary + MatchSetup reshape + the logVersion bump + names + wipeout cap + 5-unit draft/placement + AI + device checks. It is coherent (one setup-shape change, one bump — splitting would either double-touch `MatchSetup` or dribble bumps, violating AD-15), but it is large. *Remediation:* accept the size as architecture-forced; at create-story time, front-load the engine work and treat the draft/placement layout adaptation as its tail — and if it must split, the seam is engine-vs-shell *within the same bump commit train*, never two bumps.

### 🟡 Minor Concerns

3. **Attack Leader is selectable one story before leaders are player-visible.** 4.4 ships the tactic picker (leader = interim index 0 from 4.2); the leader designation UI and reveal marking arrive in 4.5. A player picking "Attack Leader" in the 4.4-only build targets an invisible default. *Remediation:* let the 4.1 spine extension decide — either the picker greys out "Attack Leader" until 4.5 ships, or the interim default is accepted as a one-story window. Record the choice in 4.4's story file at create-story time.
4. **"Proportionally large" (4.9) is not a number.** The monster sprite-size floor must come out of the 4.1 spine extension as a concrete px/cell rule, like Story 2.2's ≥32px floor. Acceptable now only because 4.1 precedes it.
5. **Subjective sign-off gates** (4.11 "a new player can follow", 4.12 "felt balance accepted"). Consistent with this project's shipped pattern (3.0's felt-balance gate) and the PO is the primary user — accepted deviation, noted for the record.

### Best-Practices Checklist (Epic 4)

- [x] Epic delivers user value
- [x] Epic functions independently (no future-epic requirement)
- [x] Stories sized for a single dev agent — with the two flagged size risks (4.1, 4.2)
- [x] No forward dependencies (interim-default pattern used correctly)
- [x] Data/entities created only when needed (AD-15 union exception documented)
- [x] ACs in Given/When/Then, testable, with error paths (validation errors 4.8, drop rejection 4.9)
- [x] FR/AD/UX-DR traceability maintained throughout

## Summary and Recommendations

### Overall Readiness Status

**READY** — with one standing condition: story 4.1's UX-spine extension is load-bearing and must not be trimmed.

### Critical Issues Requiring Immediate Action

None. Zero critical violations: full FR traceability (39/39), architecture and epics aligned on the same era rules (AD-14/AD-15 both reflected in story ACs), no forward dependencies.

### Issues to Carry Into Implementation

1. **UX spine debt (the condition):** DESIGN/EXPERIENCE pre-date Epic 4 and currently contradict the PRD in spots (deferred list, "FRONT" arrow, 3-unit copy, cap 5). Story 4.1 must extend and amend the spine — including a wholesale sweep of unit-count/cap references — before any implementing story runs.
2. **Two size-risk stories:** 4.1 (design dossier) and 4.2 (era turnover) are the two biggest items; both have recorded remediation seams (4.1: split UX extension to 4.1b if it stalls; 4.2: engine-vs-shell split within one bump train, never two bumps).
3. **Two decisions to pin at create-story time:** the Attack-Leader-before-leader-UI window in 4.4 (grey out vs interim default), and the concrete monster sprite-size floor for 4.9 (from the 4.1 spine extension).
4. **PRD housekeeping (non-blocking):** fold the "promotion postponed until after link-play" decision into PRD Open Item 4 / Out of Scope on the next PRD touch.

### Recommended Next Steps

1. Commit the planning artifacts (epics.md + this report) so the era's planning baseline is a clean commit.
2. Run `bmad-sprint-planning` in a fresh context to regenerate `sprint-status.yaml` for Epic 4 (stories 4.0–4.12).
3. Start the story cycle with `bmad-create-story` on story 4.0 (legibility quick wins) — it ships value immediately while 4.1's design work proceeds.

### Final Note

This assessment identified 0 critical, 2 major, and 3 minor issues plus 1 standing UX condition across four categories (coverage, UX alignment, epic quality, sequencing). Nothing blocks implementation; the majors are size-management risks with named seams, not defects. Assessed by: John (PM) readiness workflow, 2026-07-17.
