# Sprint Change Proposal — 2026-07-14: The balance/tactics package

Trigger: Epic-2 retrospective critical-path action item (PO wish cluster registered during epic-2 play, plus the archer item from 2026-07-13). Mode: incremental; all 6 proposals approved individually by Danilo.

## 1. Issue Summary

Epic 2's presentation quality exposed the rules: Danilo, playing the shipped animated battles on device, found (a) the Mage's row blast dominating ("too broken" — in OB64 area damage is gated behind the Archmage upgrade), (b) Knights/Mercenaries under-performing with no OB64-style target-selection tactic (attack weakest/strongest/autonomous), (c) a wish for critical hits, and — from 2026-07-13 — (d) the Archer should counter ALL casters, not just the Mage. The epic-2 retro additionally surfaced a sequencing interaction: AD-8 makes pre-balance-bump history non-replayable, so balance timing interacts with Epic 3's history/replay stories.

Context update from Danilo during this correct-course: **no release/go-live is planned**, so MVP delay is acceptable and replay staleness is a non-issue until history actually ships — the split below therefore stands on design quality, not staleness pressure.

## 2. Impact Analysis

- **Epics:** Epic 3 gains a pre-epic story 3.0 (balance tuning pass, sequenced before 3-1). Epic 4 widens from "position-dependent move variety" to **"Combat depth — moves, tactics, crits, promotions"** (still post-MVP, still pending its PM/Architect design pass; its single LOG_VERSION bump also carries the 2.2-deferred StatusCleared events).
- **PRD:** FR14 amended (archer one-way ×1.5 vs Mage/Cleric/Witch; triangle core unchanged); FR10 amended (blast per-target attenuation, named ratio, initial ×0.75; Archmage gating explicitly parked for Epic 4); Feature 6b gains the Epic-4 index paragraph. No MVP scope change.
- **Engine (story 3.0's implementation surface):** `rpsBeats` one-target map → small multi-target lookup; new `blastAttenuation` formula ratio; `balanceVersion` bump + hash re-pin + golden re-records; NFR4 sweep re-verification **in both modes** (the wipeout sweep knob deferred since 1.10 ships here). No new events, no new player choices, no UI work.
- **Docs:** `docs/rules.md` must update with the tuned numbers — enforced automatically by 2.4's drift guard (CI fails on a lying Help screen).
- **Sequencing decision (retro discovery):** RESOLVED — tune before history (story 3.0 before 3-1); structural systems after MVP in Epic 4, one combined bump.

## 3. Recommended Approach (approved)

**Direct Adjustment + scoped deferral.** Split the cluster by kind:
- **Data/rules tuning now** (story 3.0): archer-vs-casters + blast attenuation — one bump, one sweep, small contained engine edit.
- **Structural systems later** (Epic 4 design pass): tactics, crits, Archmage promotion gating, position moves, StatusCleared — designed together, bumped once.
- Post-Epic-3 planning decides Epic 4 vs link-play order (link-play remains the unscheduled Future epic; noted per Danilo's question).

Risk: low — the sweep is the safety net; the drift guard keeps player-facing rules honest. No rollback of shipped work.

## 4. Detailed Change Proposals (all approved, applied with this proposal)

1. **PRD FR14** — archer advantage generalizes one-way to all casters (×1.5 dealt; no symmetric penalty), core triangle unchanged, sweep re-verification mandated.
2. **PRD FR10** — blast per-target attenuation (named balance ratio, initial ×0.75, applied after base and before RPS); Archmage gating referenced as Epic 4 design item.
3. **epics.md** — Story 3.0 added at the head of Epic 3 with BDD ACs (bump/hash/goldens/rules.md-guard; both-mode sweep ≤65%; Danilo's on-device felt-balance acceptance); Epic 4 Future entry widened and renamed.
4. **PRD Feature 6b** — one-paragraph index of Epic 4's widened scope (tactics, crits — DEX's reserved purpose, promotion gating).
5. **sprint-status.yaml** — `3-0-balance-tuning-pass: backlog` sequenced before 3-1; epic-4 comment updated.
6. **deferred-work.md** — the three 2026-07-14 wishes + the 2026-07-13 archer item marked RESOLVED with routing.

## 5. Implementation Handoff

**Scope: Moderate** (backlog reorganization + PRD amendments — no fundamental replan). Routed to: PO/DEV — i.e. the standing loop: `create-story 3-0` → `dev-story` → `code-review`, then Epic 3 proper. Success criteria: story 3.0 done with both-mode sweep inside the dominance band, drift guard green, Danilo's on-device felt-balance acceptance.

Roadmap note (Danilo's question, answered during this session): **PvP = the link-play epic**, planned since the brief, intentionally unscheduled in epics.md's Future section; the engine seam (FR20 determinism, NFR6) is already built for it. The Epic-4-vs-link-play ordering is the post-Epic-3 planning decision.
