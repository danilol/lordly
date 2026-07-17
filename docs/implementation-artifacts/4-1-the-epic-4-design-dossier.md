---
baseline_commit: cede84f352767e05d042d75b163e02fa93e90c43
---

# Story 4.1: The Epic 4 design dossier

Status: done

## Story

As the game's developer,
I want every rules-era design decision made, recorded, and proven expressible before implementation begins,
so that the era's single logVersion bump ships complete and no story stalls on an undesigned rule.

## Acceptance Criteria

1. **Roles & roster (FR14/FR15).** The wave-1 role vocabulary, the role-relation table (symmetric ×1.5/×0.75 and one-way ×1.5 entries), and the 12-class list with full stat rows and 3-letter codes are fixed — first-level classes only (promotion postponed post-link-play, PO 2026-07-17) — with the shipped triangle and caster-hunt demonstrably reproduced as the degenerate case of the role data (the continuity constraint).
2. **Monster two-cell semantics (FR38), BOTH directions.** Row-blast counting, melee nearest-row blockade, ranged rearmost eligibility, reach from a two-cell origin, which row's action count and move-kind a Front+Middle vs Middle+Back body uses, and FR13's front-before-back tie-break for a two-row body — each rule stated once, testably.
3. **Crit/dodge (FR36, AD-10).** Chances, multipliers, and the magic-crit rule fixed; the per-attack **draw-order-and-count table** (every action type, multi-target fan-out per target in target order, and whether a miss short-circuits the crit roll) recorded as an ADR and **frozen forever** — every future seed depends on it (FR20).
4. **Moves, tactics, leader (FR32/FR33/FR34/FR35 + Open Item 3).** The per-class per-row move table is complete (Guard's mechanic decided — mitigation-for-engagement vs negate-one-attack, or both — including its FR14 interaction); tactic interactions pinned: tactics × Mage row blast, the Witch's prefer-unafflicted rule under a tactic, heals vs tactics; the leader-penalty ratio, the penalty tactic (plain Autonomous vs OB64-"panicked"), and the wave-1 leader-initiative-perk decision; the FR37 name-table content and display surfaces.
5. **The union walk (AD-12/AD-15).** The complete `BattleEvent` extension (`crit`/`missed`/`dodged`, `StatusCleared`, leader-death/penalty-state, Guard outcomes, move-kind on action events, the FR39b ledger payload) is walked against **every render surface of FR32–FR39** — battle scene, action ledger, log-panel narration, reveal, History cards — and each surface proven expressible from the union plus AD-2's static-facts channel, BEFORE story 4.2 ships the bump.
6. **UX spine extension (UX-DR9 — the readiness report's standing condition).** `DESIGN.md`/`EXPERIENCE.md` are extended covering: the tactic picker and leader designation at placement, reveal disclosure, monster two-cell rendering, name display, per-row action counts at placement, and the action ledger — the PO-flagged key display problem — within the locked Battle HERO layout (UX-DR1–5). Non-negotiable: if this task stalls, it splits to a 4.1b story rather than being trimmed.
7. **Recorded decisions carried + ADRs.** Promotion postponed post-link-play and pause dropped for wave 1 are carried into the dossier's decision log; every load-bearing choice gets an ADR (NFR3).

## Tasks / Subtasks

- [x] Task 0: Set up the dossier home (AC: 7)
  - [x] Create `docs/planning-artifacts/epic-4-dossier/DOSSIER.md` as the single authoritative design document (sectioned per AC; frontmatter tracks sitting progress). ADRs go to `docs/adr/` (next free number — 0003 confirmed). Spine amendments land IN `DESIGN.md`/`EXPERIENCE.md` (surgical, dated — the 4.0 precedent; a separate UX folder would fork the contract's authority).
- [x] Task 1: Sitting 1 — roles & the 12-class roster (AC: 1) — DECIDED 2026-07-17, dossier §1
  - [x] Role vocabulary fixed (7 roles: Vanguard/Skirmisher/Sniper/Artillery/Support/Control/Brute); shipped six assigned.
  - [x] Role-relation table designed (3 symmetric + 2 one-way); continuity PROVEN on paper — the shipped `rpsBeats`/`rpsHunts` maps fall out exactly as the degenerate case.
  - [x] Roster decided — Danilo's OB64-authentic gender-split list: +Berserker, Phalanx, Ninja, Valkyrie, Sorceress (5 new smalls; Mercenary kept; Mage→"Wizard" DISPLAY rename only, code WIZ) + **Golem as wave 1's ONLY monster** (D-1b — dragon/beasts/slayers move to a later wave; PRD FR38 deviation flagged). All 12 stat rows drafted with unique codes; "more magic" scoped to Sorceress + the §4 move table.
  - [x] Slot schema defined: `slotBudget: 5`, `sizeClass: 'small'|'monster'`, cost 1/2 derived — replaces `armySize` at 4.2.
  - [x] Sweep-validation: HONEST DEVIATION recorded in dossier §1 — a design-time sweep of unshipped classes is not executable without building 4.2/4.3 early (union, 5-slot drafting, footprint); replaced by the hit-count arithmetic audit (3–5 neutral hits ✓, golem magic-vs-phys 2× ratio ✓); the BINDING ≤65% sweeps stay with stories 4.3/4.8 per their existing ACs. Wardens-floor input carries to the 4.4 tactic sweep.
- [x] Task 2: Sitting 2 — combat mechanics (AC: 2, 3, 4) — DECIDED 2026-07-17, dossier §2–§4 + ADR 0003
  - [x] Crit/dodge decided: DEX/3 chances as Ratios, crit ×3/2 slotted explicitly after RPS in the FR15 fixed order, magic neither crits nor is dodged (OB64 confirmed), one dodge draw defender-attributed (`missed` reserved, unused wave 1).
  - [x] THE FROZEN TABLE shipped as `docs/adr/0003-battle-stream-draw-order.md` — always-2-draws [dodge, crit] per finalized physical single-target hit (crit drawn even on dodge: fixed COUNT), existing confusion/tie draws documented at their shipped positions verbatim (resolve.ts:90/181/262/276/283), zero draws for magic/Guard/leader-fall/tactics.
  - [x] Golem semantics decided both directions (targeted-at-either-cell / blocks-both-rows / hit-once [PRD assumption CONFIRMED] / counts-per-row; acts from anchor). Wave-1 monster scope = Golem only (D-1b).
  - [x] Move table + Guard decided — Danilo's column-BODYGUARD design (a genuinely better third option than both proposed): engagement-long stance, redirects single-target physical attacks aimed at the ally behind, magic/status bypass; Knight mid=Guard, Phalanx front+mid=Guard, Wizard/Sorceress front=Staff. Reconciliation recorded: arrows MUST be interceptable or Guard protects nothing (melee already FR8-blocked, magic bypasses).
  - [x] Tactic interactions pinned (Open Item 3 closed): pipeline re-validated by Danilo's OB64 source; Witch prefer-unafflicted pre-filters then falls back; blast steers to the leader's row under Attack Leader only; heals ignore tactics; Last Stand precedes.
  - [x] Leader fall: sober package (plain-Autonomous reversion, ×3/4 dealt / ×5/4 taken, no perks) — "panicked" variant explicitly rejected to protect ADR 0003.
- [x] Task 3: Sitting 3 — names + the union walk (AC: 5, + FR37 from AC 4) — dossier §5 + §7
  - [x] Names: curated per-sex lists (gender-split roster, D-1f) + construct designations for Golem; ONE stream draw per unit with deterministic advance-if-taken; stored in setup (AD-9); table outside the balance hash; display = cards + narration + ledger row (board keeps codes). Flavor veto open at sign-off.
  - [x] The COMPLETE logVersion 3→4 extension enumerated (dossier §5 table): outcome/kind/redirectedFrom on UnitAttacked, GuardRaised/GuardEnded (log-driven expiry — the 2.2 lesson applied from birth), StatusCleared, LeaderFell, PassStarted.actionsRemaining — each tagged with its emitting story.
  - [x] THE WALK executed: every FR32–FR39 render surface × the extension — all expressible from union + static-facts channel; the AD-15 precondition for 4.2's bump HOLDS. One design consequence caught by the walk: `attackFlavor` currently infers animation from CLASS, which row-varied moves make wrong → the `kind` payload is mandatory, not optional.
- [x] Task 4: The UX spine extension (AC: 6) — WRITTEN into both spines 2026-07-17 (no 4.1b split needed)
  - [x] `EXPERIENCE.md` "Epic 4 extension" section: tactic picker (**Attack Leader greyed until 4.5** — readiness minor #3 closed), tap-to-crown leader designation with visible clear-on-mutation (AD-9 surfaced), reveal full disclosure, per-row action counts at placement, **THE LEDGER = the OB64 move-name plate + economy pips over the acting unit** (from Danilo's animation-off reference capture — a better answer than every chrome option proposed), Guard shield marker + step-in interception, LeaderFell banner, Golem one-body rendering, names on cards + narration, History tactic/leader.
  - [x] `DESIGN.md` Epic 4 component tokens: `move-plate` (gold-frame mini-panel), `leader-crown` (gold = leader, never side), `guard-marker`, `golem-body` (≥48px spanning both cells, one HP bar/code at anchor — readiness minor #4 closed). Both-theme spec'd; shipped values Night.
  - [x] FR2 improved spec card: role + matchups derive from role data (AD-4); per-row behavior + counts on the card; layout designed at 4.3's doorstep using the dossier §1 table (compact card carries role line, relation glyphs, and the f/m/b count row — EXPERIENCE register).
  - [x] Copy registry: wipeout cap hint reads from balance data (4.2), tactic labels (Autonomous/Weakest/Strongest/Leader), plate microcopy = move names + FR16 spell names; voice unchanged.
- [x] Task 5: Assemble, gate, and hand off (AC: 7, all)
  - [x] Decision log complete: D-0a/b (carried), D-1a–f (roster/roles/golem-only/display-rename/stats-weakness/gender), D-2a–f (Guard bodyguard, move table, blast×leader, sober leader-fall, crit/dodge, golem semantics), D-3a–c (plate ledger, greyed window, golem size) — every call dated with rationale.
  - [x] ADR 0003 filed (the frozen battle-stream draw table — the era's determinism lock).
  - [x] PRD follow-ups flagged in the dossier (Open Items 3/4, FR15 wave-1 table, **the D-1b golem-only FR38 deviation**).
  - [x] Verified against epics.md 4.1's ACs one by one (all seven covered; AC-2's "monster" scope narrowed to Golem per D-1b — recorded deviation, substance intact). **Danilo's sign-off on the complete decision set = the story's done-gate (pending below).**

## Dev Notes

### Execution mode — this story is a design pass, not a code sprint

The "implementation" is facilitated design sittings (PM/Architect/UX hats + Danilo as PO) producing DOCUMENTS. **No code ships: zero engine diffs, zero version bumps** — the era's single `logVersion` bump belongs to story 4.2, and AD-15 is precisely why this story exists first. The readiness report flags this story's scope risk explicitly: plan it as multiple sittings with `DOSSIER.md` as the running artifact; if Task 4 stalls, split it to a 4.1b story — the UX extension is the readiness report's standing condition and must not be trimmed.

### Danilo decision points (plan the sittings around these)

Identity/product: the 4 new class identities + flavor; role vocabulary; name-table flavor. Mechanics: Guard's mechanic; penalty tactic (deterministic vs panicked); initiative perk y/n; magic-crit rule; crit/dodge magnitudes; monster hit-once assumption; blast-under-Attack-Leader steering. UX: the ledger design pick; monster sprite-size floor; the 4.4 Attack-Leader window choice.

### The engine surfaces the design must land on (recon-verified, 2026-07-17)

- `BalanceData` (`packages/engine/src/balance.ts`): `version: 2`, `armySize: 3` (**dies in 4.2** — replaced by the Task 1 slot schema), `engagementCap: 5` (→10 rides 4.2), `classes: Record<UnitClass, ClassStats>` (hp/str/vit/int/men/agi/dex + per-row actions), `rpsBeats: {mage→knight, knight→archer, archer→mage}`, `rpsHunts: {archer→[cleric,witch]}` (the two maps role relations REPLACE — AD-4), `formulas` as integer `Ratio`s.
- **The formula-order constraint (FR15/FR20):** all combat arithmetic is `Math.floor(value × num / den)` in the FIXED order `base → blast attenuation (wipeout Mage only) → RPS → status modifiers`. Crit and dodge must be slotted into this order EXPLICITLY by the dossier (where does the crit multiplier apply? is a dodge a pre-formula gate?) — this is part of the frozen ADR, not an implementation detail.
- `BattleEvent` union (`types.ts:279`): 12 members, closed, past-tense, one event per (actor, action), payloads carry all render data (`UnitAttacked` is multi-target with per-target damage/hpAfter). `LOG_VERSION = 3`; the 4.2 bump takes it to 4 with the COMPLETE Task 3 extension.
- Streams (`rng.ts`, AD-10): closed set `elements/A|B`, `ai/A|B`, `battle`; 4.2 adds `names/A|B`. Crit/dodge draws ride `battle` — the frozen table governs them.
- `STRATEGY_POOL` (`ai.ts`): 10 archetypes (bulwark, longbows, three-mages, talons, hex-coven, cabal, farshot, wardens, ambushers, gale + 1). The sweep-scaling pass itself is story 4.12, but Task 1's draft-data sweeps use today's harness (`--mode=` knob exists since 3.0).

### Constraints carried from 4.0 (fresh, same-week)

- Spine amendments are surgical and dated — the 4.0 precedent (FRONT-arrow reconciliation, token addition) is the style to follow; don't restructure the spines.
- The DESIGN.md contrast token is now EXPLICITLY scoped to solid-tile board codes (PO decision at the 4.0 review) — monster board rendering inherits the outline treatment; monster tray/History cards don't.
- Landscape battle backdrops are a deferred PO wish — any new board-surface design (monster footprints!) must survive a busy background later.
- Only the Night theme exists in code; spec tokens for both themes, implement shipped values only.
- Perf baseline is fresh (post-4.0: zero floor breaches at the DPR-3 backing) — the ledger and monster rendering designs can reference real headroom numbers in `docs/performance-verdict.md`.
- 4.0's review lesson: when a claim about coordinate spaces / engine behavior decides a design, VERIFY it against source or a runtime probe before committing it to the dossier — two independent reviewers agreed on a "fix" that would have been a regression.

### Previous story intelligence (4.0)

4.0 shipped the legibility quick wins and closed same-day with device evidence. Directly reusable here: the headless screenshot drive (scratchpad puppeteer recipe) can mock up ledger/monster layouts against the real running game if a design question needs pixels; the `?perf=1` sampler is attached in Battle/Draft/Placement for any design-time perf question.

### Project Structure Notes

- NEW: `docs/planning-artifacts/epic-4-dossier/DOSSIER.md` (+ any mockup files beside it), `docs/adr/0003-*.md` (frozen draw table; verify next free number).
- MODIFIED: `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` + `EXPERIENCE.md` (dated Epic 4 extension sections).
- NOT modified: anything in `packages/engine` or `apps/web`, `docs/rules.md` (content updates ride the implementing stories via the drift guard), the PRD (follow-ups flagged for a later `bmad-prd` touch).

### References

- [Source: docs/planning-artifacts/epics.md#Story-4.1] — the seven AC blocks this story implements
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#Feature-6b, #Open-Items 3/5] — FR32–FR39 + the design-deliverables list
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/addendum.md#4] — OB64 monster deployment, leader rules, the targeting pipeline, epic-4-pass rejected alternatives
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-4,AD-9,AD-10,AD-12,AD-14,AD-15] — the invariants every design decision must satisfy
- [Source: docs/planning-artifacts/implementation-readiness-report-2026-07-17.md] — the standing UX condition, size-risk remediation (multi-sitting, 4.1b seam), minors #3/#4 to pin here
- [Source: packages/engine/src/balance.ts; types.ts:279; ai.ts STRATEGY_POOL; rng.ts] — the exact shapes being extended
- [Source: docs/implementation-artifacts/4-0-battle-legibility-quick-wins.md#Review-Findings] — the token-scoping decision + verify-before-committing lesson
- [Source: docs/performance-verdict.md] — the fresh post-4.0 baseline for any design-time perf reasoning

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — facilitated design pass with Danilo as PO (four sittings, one session)

### Debug Log References

- Engine recon before the ADR: the exact shipped `battle`-stream draw sites verified from source (resolve.ts:90 tie coin, :181 misfire check, :262/276/283 redirect targets) — ADR 0003 documents CURRENT positions verbatim, not from memory.
- Guard reconciliation: Danilo's OB64 lore ("ranged bypasses bodyguards") vs his Guard confirmation ("arrows hit the Knight instead") resolved by mechanism analysis — melee is already FR8-blocked and magic bypasses by rule, so arrows MUST be interceptable or Guard protects nothing. Surfaced explicitly, PO-accepted.
- The union walk caught one real design consequence: `attackFlavor` infers animation from CLASS today; row-varied moves make that wrong → `UnitAttacked.kind` is mandatory payload, not nice-to-have.
- The ledger answer came from Danilo's own reference upload (OB64 animation-off phone capture, frames extracted via ffmpeg at t=25/40s): the move-name plate replaced all three chrome proposals.

### Completion Notes List

- All seven ACs covered; dossier §1–§7 DECIDED; ADR 0003 filed; both UX spines extended in place (no 4.1b split needed); decision log carries 15 dated decisions with rationale.
- **Scope deviations, PO-decided and recorded:** wave 1 ships GOLEM as the only monster (D-1b — dragon/beasts/slayers next wave; PRD FR38 deviation flagged); roster is Danilo's gender-split OB64 list (5 new smalls, not 4 — Mercenary kept, total exactly 12); Mage→Wizard display rename only.
- **Design-time sweep honestly not executable** for unshipped classes (recorded in §1); replaced by hit-count arithmetic audit; binding sweeps stay with stories 4.3/4.8.
- Downstream story impacts to carry into their create-story passes: 4.2 (bump content = §5 table verbatim; slot schema §1), 4.3 (role data + 5 new smalls + spec cards), 4.4 (greyed Attack Leader), 4.5 (crown UI + LeaderFell + sober ratios), 4.6 (ADR 0003 implementation), 4.7 (move table + Guard + plate kinds), 4.8/4.9 (GOLEM-only scope shrink), 4.11 (the plate IS the ledger — story AC reframe).
- Gate: prettier clean; zero code touched (`packages/engine` and `apps/web` diffs empty — the story's hard constraint held).

### File List

- `docs/planning-artifacts/epic-4-dossier/DOSSIER.md` — NEW: the authoritative design record (§1–§7 + decision log + PRD follow-ups)
- `docs/adr/0003-battle-stream-draw-order.md` — NEW: the frozen draw-order-and-count table (FR20/FR36/AD-10)
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md` — MODIFIED: "Epic 4 extension" section (UX-DR9)
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` — MODIFIED: Epic 4 component tokens (move-plate, leader-crown, guard-marker, golem-body)
- `docs/implementation-artifacts/sprint-status.yaml`, this story file — MODIFIED: tracking

### Change Log

- 2026-07-17: Story 4.1 executed as a four-sitting facilitated design pass. Sitting 1: 7-role model with paper-proven degenerate-case continuity; Danilo's gender-split 12-class roster (Golem the only wave-1 monster — D-1b); slot schema. Sitting 2: Danilo's column-BODYGUARD Guard design; minimal move table; blast steers to the leader's row under Attack Leader (his OB64 sourcing); sober leader-fall; crit/dodge always-2-draws structure → ADR 0003 frozen. Sitting 3: name generation design; the COMPLETE logVersion 3→4 extension enumerated and walked against every render surface — the AD-15 precondition HOLDS. Sitting 4: the ledger = the OB64 move-name plate + pips (from Danilo's uploaded animation-off capture); greyed Attack Leader window; Golem ≥48px. Zero code shipped. Awaiting Danilo's sign-off on the decision set — the story's done-gate and the key that unlocks story 4.2.
- 2026-07-17: **DONE — Danilo's sign-off: "yes!"** The decision set is final, ADR 0003 is frozen, the spine extensions are binding, and story 4.2 (the era turnover — the single logVersion bump) is unlocked. A design story's review IS the PO sign-off; no code-review pass applies (nothing but docs shipped).
