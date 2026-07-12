---
title: "Reconciliation: PRD → Architecture Spine (Lord Battle Tactics)"
status: complete
created: 2026-07-12
inputs:
  - docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md
  - docs/planning-artifacts/prds/prd-lordly-2026-07-11/addendum.md
target: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md
---

# Input Reconciliation — PRD/Addendum vs. Architecture Spine

Method: every FR (1–31), NFR (1–6), and addendum §2 technical note was checked for an
architectural home in the spine (an AD, a consistency convention, the structural seed,
the capability map, or a Deferred entry). Per the spine's charter, missing *rationale*
and missing *implementation detail* were not flagged — only absent/contradicted homes,
dropped §2 notes, uncovered NFR dimensions, and contradictions. Phaser 3→4 is a
deliberate, user-approved amendment and is not treated as a gap.

## 1. FR coverage table

| FRs | PRD content | Spine home | Verdict |
|---|---|---|---|
| FR1–FR3 | Draft, 3 units, seeded element roll | Capability map row 1; AD-4, AD-5; element roll tied to match seed (AD-1); seed convention (`crypto.getRandomValues` at match start) | Covered |
| FR4–FR6 | Hidden simultaneous placement, reveal | Capability map row 2; AD-5 (`MatchState`); FR5 hidden-info additionally enforced by AD-6 construction (AI cannot receive player choices) | Covered |
| FR7–FR13 | Reach, targeting, blast, heal, status, initiative | `engine/targeting.ts`, `engine/resolve.ts`; AD-1/AD-2/AD-4; NFR2 test convention makes FR text the test spec | Covered |
| FR14–FR16 | RPS, attributes/class table, Witch spells | `engine/balance.ts` (versioned data file, AD-4); integer-math rule restated in AD-1 | Covered |
| FR17–FR20 | Engagement, judging, until-wipeout, determinism | AD-1 (determinism, bit-identical), AD-2 (log); FR19 explicitly Deferred with mode-as-parameter seam | Covered |
| FR21–FR23 | Battle scene, result screen, speed/skip | AD-2 (scene is a pure log player — speed/skip/replay fall out); `BattleLog` event convention carries all UI-visible data | Covered |
| FR24–FR26 | AI: fair, varied, fast, offline | AD-6 (pure seeded engine module; hidden-info by construction; client-side/offline by purity) | Covered |
| FR27 | Core loop **+ rules/help screen reachable from Home and Draft** | AD-5 scene FSM covers the loop. The rules/help **screen** is absent from AD-5's scene enumeration and the structural seed (`web/scenes` lists exactly Home, Draft, Placement, Reveal, Battle, Result, History). The Deferred entry covers only the rules-doc→help *generation mechanism*, not the screen | **GAP (partial) — see Gap 3** |
| FR28 | 10-entry on-device history w/ seed, replayable | AD-8 (versioned localStorage, balance-version-guarded replay) — actually *strengthens* the PRD's replay assumption | Covered |
| FR29–FR30 | PWA, offline vs-AI, portrait mobile-first | AD-7, vite-plugin-pwa in stack, offline noted in system diagram; FR30 layout is a UX-phase concern, correctly not a spine matter | Covered |
| FR31 | Free/CC sprites, license attributions in repo, **in-game credits screen** | `web/assets` seed comment covers packs + attribution; sprite-pack choice properly Deferred. The **credits screen** has no home: not in AD-5's scene list, not in the seed, not Deferred | **GAP (partial) — see Gap 3** |

## 2. NFR coverage

| NFR | Dimensions | Spine home | Verdict |
|---|---|---|---|
| NFR1 Performance | 60 fps target / 30 floor on Pixel-6a-class; initial load ≤ 5 s on 4G; bundle small enough | Capability map binds NFR1 to "apps/web build (vite-plugin-pwa), AD-7" — but AD-7's rule is hosting + CI test gate only. **No AD, convention, seed element, or Deferred entry addresses the performance budget**: no bundle-size budget or CI size check, no asset-weight rule (pixel-art packs, FR31, are the main bundle risk), no frame-budget statement for the battle scene | **GAP — see Gap 1** |
| NFR2 Quality/tests | Pure engine; per-rule unit tests; property tests; golden battles; CI red blocks merge; **coverage gate ≥ 90% lines on engine** | AD-1, Tests convention (Vitest + fast-check + golden), AD-7 (CI gate). All landed **except the coverage gate**, which appears nowhere (Tests convention and AD-7 are silent on coverage) | **Mostly covered; coverage gate — see Gap 5** |
| NFR3 Documentation | README (stranger→running game); rules document; **ADRs for load-bearing choices**; **doc comments on engine public API and every exported module** | Only one of four dimensions has a home: the rules-doc→help mechanism (Deferred). README, ADR practice, and the doc-comment standard have **no convention, seed entry, or Deferred item**. For a project whose PRD calls documentation "survival" (AI-first, no hand-written code), this is a quiet requirement the structure dropped | **GAP — see Gap 2** |
| NFR4 Balancing | Stats in data file; headless AI-vs-AI sweep harness | AD-4 (`balance.ts`, versioned), `engine/sim` seed, capability map row; harness location Deferred with a trigger | Covered |
| NFR5 Privacy | No accounts/tracking/monetization; localStorage only | AD-8; Logging convention ("None in production (NFR5)") | Covered |
| NFR6 Forward compat | Engine contract = "two boards + seed → battle log"; **army size is a parameter (3 now, 5-slot era later)** | AD-1 contract + AD-3 + link-play capability row cover the contract and the server seam. **Army-size-as-parameter is nowhere**: AD-1's `MatchSetup` doesn't state it, no convention mentions it, Deferred's roster note covers class growth via balance-as-data but not squad size. If the engine hard-codes 3 (grid is 3×3 regardless — squad size ≠ grid size), NFR6's stated seam is silently lost | **GAP (minor) — see Gap 4** |

## 3. Addendum §2 technical notes

| §2 note | Spine home | Verdict |
|---|---|---|
| Deterministic seeded engine; pure TS module, no Phaser dependency; Phaser is presentation only; server re-runs sim, clients animate | AD-1, AD-2, AD-3; Design Paradigm; link-play row in capability map | Landed |
| Quality bar: exhaustive engine unit tests, property tests (termination, judging symmetry, seed stability), golden battles, lighter integration tests on scenes | Tests convention matches point-for-point ("smoke-level scene tests only" = "lighter integration tests on scenes") | Landed |
| Rules documentation doubles as in-game help content | Deferred entry (mechanism), content source pinned to PRD Features 3–5 | Landed (mechanism); the help *screen* gap is tracked under FR27, Gap 3 |
| Balancing workspace: `balance.ts`/JSON so numbers change without touching engine code; headless sim over 56 compositions | AD-4 rule ("versioned data file, not code"), `engine/sim` seed | Landed |

## 4. Contradiction check

- **Phaser 3 vs 4** — spine uses Phaser 4.2.x. Deliberate, user-approved amendment; not a gap.
- **FR20 input tuple** — PRD: battle is a pure function of (compositions *with rolled elements*, placements, seed). Spine: `resolveBattle(setup, seed)` with elements rolled from the match seed. Consistent as long as `MatchSetup` carries the rolled elements (AD-4 owns the type); no contradiction found.
- **FR28 replayability** — PRD assumes stored seed makes battles replayable; AD-8 conditions replay on matching `balanceVersion`. This is a *refinement*, not a contradiction: an unguarded replay after a balance change would violate FR20's "identical battle" promise. Correct call.
- No other spine statement contradicts an FR/NFR.

## 5. Gaps

### Gap 1 — NFR1 performance budget has no architectural home (major)
AD-7 nominally binds NFR1 but its rule governs hosting and the CI test gate only. No AD,
convention, seed element, or Deferred entry covers: the 60/30 fps envelope, the ≤ 5 s /
4G initial load, or a bundle-size budget — and nothing constrains the one obvious threat
to it (sprite-pack asset weight, FR31). Minimum fix: a convention or AD line fixing a
bundle budget (e.g. a size check in the AD-7 CI gate) and naming the battle scene's
frame budget as a constraint on `BattleLog` playback; or an explicit Deferred entry with
a trigger.

### Gap 2 — NFR3 documentation landed only 1 of 4 dimensions (major)
Only the rules-doc→help generation mechanism appears (Deferred). README, ADR practice
for load-bearing choices, and the doc-comment standard (engine public API + every
exported module) have no convention, seed entry, or Deferred item. Given the PRD frames
documentation as a survival property of the no-hand-written-code method (Goal 6,
Exec Summary), this is exactly the kind of quiet requirement the reconciliation exists
to catch. Minimum fix: one Consistency Conventions row ("Docs: README run-path, ADRs
in <path>, TSDoc on engine exports — CI-checkable where possible") or a Deferred entry
with an owner/trigger.

### Gap 3 — Two PRD-required screens missing from the scene enumeration (moderate)
AD-5's rule and the structural seed enumerate exactly seven scenes (Home, Draft,
Placement, Reveal, Battle, Result, History). The PRD requires two more surfaces:
the **rules/help screen** reachable from Home and Draft (FR27) and the **credits/
attribution screen** (FR31, license compliance — this one has legal weight, not just
polish). Because AD-5 phrases the list as the definitive screen↔scene mapping,
downstream epic generation from the spine would silently drop both. Fix: add
Help and Credits to AD-5's list and the seed's `scenes/` comment.

### Gap 4 — NFR6 "army size is a parameter" not surfaced (minor)
The engine contract seam for link-play is well covered, but NFR6's second clause —
army size parameterized (3 now, 5-slot era later) — appears nowhere. One clause in
AD-1 or AD-4 (`MatchSetup` carries squad size; balance/rules must not hard-code 3)
or a Deferred entry keeps the 5-slot landing zone the PRD paid for.

### Gap 5 — NFR2 coverage gate absent from test/CI rules (minor)
NFR2 sets a ≥ 90 %-lines coverage gate on the engine package `[ASSUMPTION]`. The Tests
convention and AD-7's CI rule specify suites and red-blocks-merge but never coverage.
Either add it to the AD-7 gate / Tests convention or consciously drop it (it is an
assumption-flagged number, but silence is neither).

## 6. Verdict

The spine covers 29 of 31 FRs fully (FR27/FR31 partially — missing screens) and
3 of 6 NFRs fully; all four addendum §2 notes landed. No contradictions beyond the
approved Phaser amendment. Five gaps, two of them major (NFR1 performance budget,
NFR3 documentation), all cheap to close with a convention row, two scene-list
additions, and two AD clauses.
