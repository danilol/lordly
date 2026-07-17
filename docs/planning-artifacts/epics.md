---
stepsCompleted: [1, 2, 3, 4]
epic4ExtensionRun: 2026-07-16
inputDocuments:
  - docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md
  - docs/planning-artifacts/prds/prd-lordly-2026-07-11/addendum.md
  - docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md
  - docs/planning-artifacts/epic-4-design-pass-input-2026-07-16.md
---

# Lord Battle Tactics - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Lord Battle Tactics, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: *(amended 2026-07-16, Epic 4 — the MVP shipped with exactly 3 units)* Each player composes an army against a **5-slot budget**: a small unit costs 1 slot, a monster costs 2 (FR38); every army spends all 5 slots exactly; max 2 monsters; duplicates allowed; both sides always field the same budget.
FR2: Draft screen presents each class with name, sprite, and compact rules card — draftable without a tutorial; from Epic 4 the cards carry each class's improved spec: role, matchups, per-row behavior, and action counts (FR15 amendment).
FR3: Each drafted unit is assigned a random element (Fire/Water/Wind/Earth) from the seeded generator; owner sees it before placement, opponent at reveal; Witch's spell keys off it; cosmetic for other classes in MVP; re-rolled every match.
FR4: *(amended 2026-07-16)* Placement on own 3×3 grid (front/middle/back × left/center/right) via touch drag-and-drop; any arrangement of small units is legal; a monster occupies two vertically adjacent cells of a single column (Front+Middle or Middle+Back, never horizontal) and two monsters never share a column (FR38); placement also designates the squad leader (FR35) and sets the army's tactic (FR34).
FR5: Placement is hidden and simultaneous; nothing — composition, placement, and from Epic 4 tactic (FR34) and leader (FR35) — visible until both submitted; the AI commits without reading the player's choices.
FR6: On both submissions, a reveal shows the two boards face to face before combat; from Epic 4 the reveal includes each side's leader marking and chosen tactic.
FR7: *(amended 2026-07-16)* Reach — facing column plus adjacent columns; corner units reach two, center units three — becomes **melee-only** from Epic 4. Ranged and magic attackers (Archer, Witch, Cleric's staff fallback) gain global range: no column filter; under Autonomous they keep their row preference (FR9), under a target tactic (FR34) rows dissolve too. **Last Stand:** a melee unit whose reach-filtered target list is empty may target out-of-reach enemies — a battle never stalls with living units unable to act.
FR8: Melee targeting (Knight, Mercenary) — nearest occupied row among reachable, no bypass; priority: facing column → center-closer → left; re-evaluated per attack.
FR9: *(amended 2026-07-16)* Ranged targeting (Archer) — rearmost occupied row first; from Epic 4 this is the ranged unit's **Autonomous** behavior over the whole grid (no column filter); under a target tactic (FR34) row preference is ignored too; column priority and re-evaluation per attack as FR8.
FR10: Mage row blast — hits every unit in one enemy row, ignoring reach; row with most living enemies, tie → rearmost; per-target `blastAttenuation` ×0.75 after base, before RPS, in WIPEOUT mode only (amended 2026-07-14; mode-scoped in story 3.0 per the both-mode sweep, PO-approved); RPS per target. Archmage-style promotion gating of the blast: **postponed until after link-play** (PO decision at the Epic 4 breakdown, 2026-07-16 — promotion needs most/all classes present first; this era works with first-level classes only, closing PRD Open Item 4).
FR11: Cleric heals lowest-HP-% living ally (self included), ignoring reach, capped at max HP; if no ally damaged, weak STR-based staff attack with magic targeting.
FR12: Witch casts her prepared spell on one enemy by magic targeting (rearmost reachable), preferring unaffected targets; deals no damage.
FR13: Initiative — AGI timeline in passes; one action per living unit per pass in descending AGI across both armies; multihit split; ties: front row → left → seeded coin flip; dead/sleeping units lose unspent actions; effects apply immediately in sequence.
FR14: *(amended 2026-07-16 — role-based relations replace the triangle as the scalable form)* Every class carries a **role**; advantage relations are defined **between roles, not classes**, as versioned balance data — each relation either symmetric (×1.5 / ×0.75, today's triangle semantics) or one-way (×1.5, no reverse penalty — today's `rpsHunts`, which this generalizes). The shipped triangle (Mage>Knight>Archer>Mage) and the Archer's caster-hunt must be reproducible as the degenerate case of the role data (continuity constraint); any relation/multiplier change mandates NFR4 sweep re-verification (≤65% dominance band, both modes). The wave-1 role vocabulary and relation table are Epic 4 design deliverables.
FR15: *(amended 2026-07-16)* Six fixed per-class attributes (STR/VIT/INT/MEN/AGI/DEX); integer-math formulas (phys = STR − VIT/2, magic = INT − MEN/2, min 1, then RPS; heal = INT × 1.25) with fixed rounding order (base → blast attenuation → RPS → status modifiers); per-row action counts per the class table; values live in a data file. Epic 4 roster wave 1: **6 → 12 classes** (6 shipped + 4 new smalls + 2 monsters — dragon and golem, FR38); newcomers ship as role/stat variants first ("start generic, iterate to unique"); **DEX stops being reserved** (FR36). The wave-1 class list, roles, and stat rows are an Epic 4 design deliverable validated by the NFR4 sweep.
FR16: Witch spells keyed to element — Water→Sleep, Earth→Poison (15 dmg end of engagement), Fire→Weaken (damage halved), Wind→Confusion (50% seeded misfire onto own side; fizzle if no valid target); same spell doesn't stack.
FR17: Single-engagement mode — every unit spends its per-row action count once on the timeline; engagement end = match end.
FR18: Judging — wipe = instant win; else higher % of starting team HP remaining; exact tie = draw with rematch offer.
FR19: *(amended 2026-07-16 — cap raised 5 → 10, PO: "5 engagements is too few"; rides Epic 4's combined bump and mandates the NFR4 both-mode sweep re-run)* Until-wipeout mode — engagements repeat until wipe; statuses clear between engagements except poison; cap 10 engagements then FR18.
FR20: *(amended 2026-07-16)* Determinism — battle is a pure function of (compositions with elements, placements, seed — and from Epic 4 both tactics and leader designations, FR34/FR35, which live in the match setup); all randomness from the seeded generator.
FR21: Animated OB64-style battle scene — lanes, initiative-ordered actions, damage numbers, HP bars, status icons, visible deaths; camera perspective is a UX-phase decision; must read clearly on a phone.
FR22: Result screen — winner with both final HP %, both compositions, Rematch (one tap to fresh draft) and Home.
FR23: Battle-speed control (normal / fast ×2 minimum) and skip-to-result.
FR24: The AI plays by human rules — commits composition, placement, spells — and from Epic 4 a tactic (FR34) and leader designation (FR35) — with no knowledge of the player's hidden choices.
FR25: AI selects from a curated strategy pool (~8–12 archetypes) with seeded variation; punishes lazy formations; single difficulty targeting ~50% win rate.
FR26: AI decision time < 1 s, fully client-side and offline.
FR27: Core loop Home → Draft → Placement → Reveal → Battle → Result → (Rematch | Home) in under 5 minutes, no account, no tutorial gate; rules/help screen from Home and Draft.
FR28: *(amended 2026-07-16)* Battle history — last 10 results on-device (winner, compositions, date, seed; from Epic 4 the stored setup also carries each side's tactic and leader — they are FR20 battle inputs replay must reproduce); replayable via determinism; history screen from Home.
FR29: Ships as a PWA — installable, HTTPS, fully playable offline for vs-AI.
FR30: Mobile-first portrait layout (~360×640 CSS px up), touch-native; functional centered desktop layout.
FR31: Art from free/CC pixel-art packs; idle/attack/hurt/death representations per unit; license attributions in repo and on a credits screen.
FR32: *(Epic 4)* Per-row move variety — a class's row may vary the **kind** of action, not just the count (e.g. front Knight 2× melee "Sword Slash" / back Knight defensive "Shield Cover"; front Mage weak "Staff Attack" / back Mage full row blast at increased frequency); the complete per-class per-row move table — including Archer/Cleric/Witch variants — is an Epic 4 design deliverable.
FR33: *(Epic 4)* Defensive move type ("Guard") — at least one class/row combination substitutes attacking for a defensive action new to the ruleset: raising the unit's mitigation for the rest of the engagement, or negating one incoming attack outright; which mechanic (or both) is the epic's core new-mechanic design question, including its interaction with role relations (FR14) and the closed BattleEvent union (AD-12).
FR34: *(Epic 4)* Target-selection tactics — at placement each player sets one army-wide tactic, stored in `MatchSetup`: **Autonomous / Attack Weakest / Attack Strongest / Attack Leader**. Fixed two-step pipeline (OB64-faithful, PO-supplied; reference algorithm in the addendum): ① build the legal-target list — melee filters by reach with the Last Stand fallback; ranged/magic take the whole living enemy grid — ② apply the tactic over the list: Weakest/Strongest by **absolute current HP**, ties fall back to the Autonomous priority (no new randomness, FR20); Attack Leader picks the enemy leader if legal, else behaves as Autonomous until the path clears. A tactic never expands melee reach. Fixed at placement for the whole battle — mid-battle switching rejected (AD-2, recorded deviation from OB64).
FR35: *(Epic 4)* The squad leader — placement designates exactly one unit as leader; the leader anchors the Attack Leader tactic (both sides'). **Leader-killed penalty:** the side enters a penalty state for the rest of the battle — its tactic reverts to plain Autonomous (an OB64-"panicked" seeded variant is a design option) and its units suffer a severe physical attack/defense reduction (a named, versioned balance ratio, NFR4-tuned). Penalty magnitude and any wave-1 leader initiative perks are design decisions; named hero leaders and Tamer/Master synergies are parked.
FR36: *(Epic 4)* Critical hits and dodge — DEX spends its reserved purpose: an attack may crit (bonus damage) or be dodged/missed (no damage), both as seeded per-attack draws on the `battle` stream with a **fixed draw order** (determinism constraint — the order is frozen forever once shipped, FR20); attack events carry `crit`/`missed`/`dodged` outcomes (AD-12); chances, multipliers, and the magic-crit rule are design deliverables (OB64 precedent: magic never crits).
FR37: *(Epic 4)* Generated unit names — every drafted unit gets an OB64-style generated name, rolled exactly once at draft from a dedicated per-side seeded stream (`names/A`, `names/B` — AD-10 closed-set addition) and **stored in `MatchSetup`** alongside class and element (AD-9) so replays show identical soldiers; shown at minimum on placement/reveal cards and battle; the name table is engine data **outside** the balance-hash surface; flavor only in wave 1.
FR38: *(Epic 4)* Monsters (large units) — wave 1 ships **dragon and golem**: 2 slots of FR1's budget, physically two vertically adjacent cells of one column (Front+Middle or Middle+Back; never horizontal; max 2 per army; never sharing a column — the exact OB64 rule); full FR15 stat-table citizens with roles (FR14); "monster" is a size-class, not a theme. **Two-cell-body semantics are the epic's core engine design task, BOTH directions:** how a monster is targeted (row-blast counting, melee nearest-row blockade, ranged rearmost eligibility, reach from a two-cell origin) AND how it acts (which row's action count and move-kind; how FR13's front-before-back tie-break reads a two-row body) — all defined before any monster story is implemented.
FR39: *(Epic 4)* Battle legibility — (a) player-facing wording says "Turn" where the engine says "pass" (display rename only); (b) a live **action ledger** during battle shows each unit's per-turn action economy (display design UX-owned — the PO flags it as the epic's key presentation problem); (c) placement surfaces per-row action counts so positioning is an informed choice; (d) attacks read **from→to**: melee visibly moves to its target and returns; projectiles/heals/spells trace origin→target; (e) the redundant "front" row label is removed from the battle board; (f) unit labels get a contrast treatment legible on same-colored tiles (shipped defect, screenshot-evidenced); (g) a pause control in vs-AI battles (wave-1-optional if speed/skip satisfies on-device review).

### NonFunctional Requirements

NFR1: Performance — 60 fps target / 30 floor on a mid-range Android (Pixel 6a class) in Chrome; initial load ≤ 5 s on 4G; bundle sized accordingly (spine: ≤ 3 MB compressed initial, atlas-packed sprites).
NFR2: Quality & tests — engine is a pure Phaser-free TS module; every battle rule covered by unit tests; property tests (termination, judging symmetry, seed identity); golden-battle snapshots; CI blocks red; ≥ 90% line coverage on the engine package.
NFR3: Documentation — README quickstart; rules document aligned with PRD Features 3–5 doubling as in-game help; ADRs for load-bearing choices; doc comments on engine exports.
NFR4: Balancing instrumentation — stats in a data file; headless AI-vs-AI simulation harness sweeping compositions to flag dominant strategies. Epic 4: the harness's archetype pool and run budget get a scaling pass — 12 classes plus tactics and leaders as new sweep dimensions (PRD Open Item 5).
NFR5: Privacy — no accounts, no personal data, no tracking, no monetization; localStorage only.
NFR6: *(amended 2026-07-16)* Forward compatibility — engine treats "two submitted boards (armies, placements — and from Epic 4, tactics and leaders) + seed → battle log" as its contract; army sizing is slot-budget data (the 5-slot budget from Epic 4, FR1); link-play swaps the opponent without engine changes.

### Additional Requirements

From the Architecture Spine (all 13 ADs bind implementation; those with direct story impact):

- **Starter template (Epic 1 Story 1 impact):** scaffold `apps/web` with `npm create @phaserjs/game@latest` (official CLI, Vite + TypeScript template), then bump deps to the pinned stack (Phaser 4.2.x, Vite 8.x, TS 5.9.x explicit pin, Vitest 4.1.x, fast-check 4.x + @fast-check/vitest 0.4.x, pure-rand 8.x, vite-plugin-pwa 1.x, wrangler 4.x, Node 24, pnpm 11 workspaces). `packages/engine` is hand-rolled plain TS.
- **Monorepo:** pnpm workspaces — `packages/engine` (pure, only runtime dep pure-rand) + `apps/web`; dependency direction fixed (AD-3); engine owns all domain types + balance data (AD-4).
- **Paradigm:** functional core / imperative shell; `resolveBattle(setup) → BattleLog` pure with integer math (AD-1); replay model — shell never evaluates combat rules (AD-2).
- **Seed streams:** one 32-bit seed per match; closed named streams `elements/A`, `elements/B`, `ai/A`, `ai/B`, `battle`; raw seed never consumed directly (AD-10). Elements are data in `MatchSetup`, rolled once by the shell via an engine-exported function (AD-9; canonical MatchSetup shape fixed in the spine).
- **Sides & coordinates:** engine knows sides A/B; human is always A in vs-AI; owner-local coordinates everywhere; lane mirroring is renderer math only; unit id = `side:index` (AD-11).
- **BattleLog:** closed versioned event union, one event per (actor, action), carrying all render data; covers BattleStarted, PassStarted, UnitAttacked, UnitHealed, StatusApplied, ActionMisfired, ActionFizzled, ActionSkipped, PoisonTicked, UnitDied, EngagementEnded, BattleEnded (winner incl. draw + HP %) (AD-12).
- **App state:** scene-per-screen FSM (Home, Draft, Placement, Reveal, Battle, Result, History, Help, Credits); single serializable MatchState owned by MatchFlow — sole engine caller, sole history writer, live|replay modes (AD-5, AD-13).
- **Persistence:** `web/storage` is the sole localStorage gateway; `lordly.v1.*` key manifest; HistoryEntry = MatchSetup + winner (A|B|draw) + ISO date; replay re-resolves only on matching balanceVersion; caching a BattleLog forbidden; balance-hash CI test enforces version bumps (AD-8).
- **AI module:** pure seeded function in the engine — (strategy pool, own stream) → (composition, placement); cannot receive player hidden state (AD-6).
- **CI/CD & hosting:** GitHub Actions — typecheck + tests + engine coverage gate on every push, red blocks merge; `main` deploys static assets to Cloudflare Workers via wrangler; environments = local dev + production (AD-7).
- **Docs:** `docs/adr/` one ADR per load-bearing change; engine exports doc-commented (NFR3 convention).
- **Deferred (not story fodder now):** Durable Objects room protocol (link-play epic), TS 7 migration, PWA service-worker update strategy (decide at first deploy), performance-budget tooling, until-wipeout internals, sprite pack selection (UX/content), rules-doc generation mechanism, sim-harness location, i18n/difficulty tiers/roster growth.

**Epic 4 additions (2026-07-16 architecture pass; the spine now binds FR1–FR39):**

- **AD-14 (new) — a monster is one unit:** one `side:index` id, one stored **anchor** cell (always the front-most; the footprint extends exactly one row back — anchor `back` is illegal); the second cell is derived via engine-exported `footprintCells(class, anchor)`, never stored. Placement legality has one implementation: engine-exported `legalAnchors`/`canPlace` share code with `validateMatchSetup`; the placement scene's live drag feedback never re-implements FR4's rules. Every log event references the unit id, never a cell.
- **AD-15 (new) — version-bump choreography:** the epic designs the **complete** event-union extension up front and bumps `logVersion` exactly once, with the first union-touching story; `balanceVersion` keeps per-change discipline (mid-epic intermediates accepted — they display but stop replaying, the 3.2 UX already handles it). Never mutate a pinned version's meaning.
- **AD-1 amendment — slot vocabulary is canonical and exclusive:** `slotBudget` + per-class `slotCost` + engine-exported `slotTotal(army)`; the shipped `armySize` constant is **deleted** at the FR1 story; no code — engine validation, flow gates, scene UI — may use `army.length` as a legality measure (a two-monster army is full at 3 units).
- **AD-4 amendment:** role relations **replace** `rpsBeats`/`rpsHunts` as the single matchup source at the FR14 story — draft-card `beats`/`beatenBy` derive from role data; no dual matchup tables survive. Roles, relations, slot costs/size classes, leader-penalty ratio, and crit/dodge chances all join the versioned balance data. The FR37 name table is engine data **outside** the balance-hash surface (name edits never invalidate history).
- **AD-6 amendment:** the AI module does **not** roll names — `MatchFlow` rolls names for both sides via the engine roll function on each side's `names/*` stream at army construction.
- **AD-9 amendment — canonical `MatchSetup` extended:** `tactics: {A, B}`, `leaders: {A, B}` (unit index), `Unit = {class, element, name}`, placements store the **anchor** cell. Invariants: any army mutation (add/remove/reorder) clears that side's leader designation; `commit()` requires an explicit tactic and a valid leader.
- **AD-10 amendment:** the closed stream set formally extends by `names/A`, `names/B`. Crit and dodge ride the existing `battle` stream with a **fixed per-attack draw order AND count** — the design story pins exactly how many draws each action type consumes and in what sequence (multi-target blasts fan out per target in target order), recorded as a table and frozen forever.
- **AD-12 amendment — the single union extension** carries at minimum: `crit`/`missed`/`dodged` outcomes on the attack event, `StatusCleared` (the story-2.2 deferral), a leader-death/penalty-state event, Guard outcomes, move-kind identification on action events, and the FR39b ledger payload (actions remaining/spent). Because AD-15 forbids a second bump, the design story must walk **every render surface of FR32–FR39** (battle scene, ledger, reveal, History cards) against the union plus AD-2's static-facts channel and prove each is expressible BEFORE the bump ships.
- **Performance convention:** the text-ceiling fix (360px backing store) is scheduled inside Epic 4's legibility cluster — candidate (a) DPR-sized backing + per-scene zoom, measured before/after against `docs/performance-verdict.md`'s baseline (NFR1-gated).
- **Carried-in design inputs (must not be lost at story design):** the 3.0 sweep's melee-witch floor (wardens 33% single-mode — tactics should fix wasted swings; sweep acceptance should show it); non-replayable-history UX gets an on-device confirmation once the combined bump lands (3.2 UX handles it, verify it in anger); sim harness stays a dev CLI in `packages/engine` (the scaling pass changes its pool, not its home).

### UX Design Requirements

*(The bmad-ux spine pair — `DESIGN.md` + `EXPERIENCE.md`, final 2026-07-13 — landed after the Epic 1–3 breakdown and is a binding contract: mocks illustrate, the spine decides. It pre-dates Epic 4, so it constrains all new surfaces but does not yet design them; UX-DR9 covers the required extension.)*

UX-DR1: **Blue = you / red = enemy, everywhere, both themes** — every unit card border, iso tile, HP fill, and combat number; outcomes inherit it (win = blue, lose = red, draw = neutral); every side/outcome cue pairs with a non-color anchor (label, position — enemy top, you bottom). All new Epic 4 surfaces (ledger, tactic/leader UI, monster cards, names) obey this.
UX-DR2: Both themes are first-class — every new Epic 4 surface is designed in **Heritage Parchment and Night Tactics**, built exclusively from `DESIGN.md` tokens (gold reserved for frame/selected/title; element dots identical across scenes and never side-coding).
UX-DR3: The type scale and floors bind new surfaces: 3-letter class codes at 15px/weight-800 on compact cards — **the 4 new classes and 2 monsters each need a code** (KNI/MER/ARC/MAG/CLE/WIT is the shipped set); tabular monospace for all numbers (ledger counts included); 10px hard floor; damage/heal ≥ 14px and sprites ≥ 32px on a 360px viewport.
UX-DR4: Touch floors: ≥ 44px tap targets, no hover-dependent affordances; placement drag-and-drop keeps swap-on-occupied / no-lost-drops and extends to monsters — two-cell footprint drag feedback driven by the engine's `legalAnchors`/`canPlace` (AD-14), never scene-local legality math.
UX-DR5: The locked Battle HERO layout (slim top HUD, two diagonal iso boards with clash gap, pinned bottom control bar) is the frame the FR39b **action ledger** and FR39g **pause** must fit into without crowding the boards — the ledger display design is the epic's key presentation problem (PO-flagged) and is UX-owned.
UX-DR6: FR39d from→to reading: melee visibly moves to its target and returns; arrows/blasts/heals trace origin→target across the clash gap; beats stay ≥ 300 ms; reduced-motion damps flourishes but preserves the beats (they are the information).
UX-DR7: FR39f label-contrast defect (shipped, screenshot-evidenced): class codes must be legible on same-colored board tiles in both themes — the fix lands in the `DESIGN.md` unit-card token treatment, not ad hoc per scene.
UX-DR8: **Conflict to reconcile:** FR39e removes the redundant "front" word from the battle board, but `EXPERIENCE.md`'s locked battle layout specifies a front-row indicator with a directional "FRONT" arrow. Likely resolution: keep the non-verbal indicator (brighter tiles + gold edge), drop the word — but the spine must be amended, not silently contradicted.
UX-DR9: The UX spine has **no ledger, tactic, leader, monster, or name UX** — Epic 4's design work must extend `DESIGN.md`/`EXPERIENCE.md` (a bmad-ux pass or equivalent spine amendment) covering: tactic selection + leader designation at placement, reveal disclosure of tactic/leader (FR6), monster two-cell rendering on boards and cards, name display surfaces (FR37), the action ledger (FR39b), and per-row action counts at placement (FR39c) — before the implementing stories run.
UX-DR10: Copy/content updates riding the epic: Home's Wipeout hint "max 5 engagements" → 10 (FR19); History cards display tactic and leader from the stored setup (FR28); "Turn" replaces "pass" in all player-facing copy (FR39a — display rename only, `constants.ts` register preserved); Help/rules content and `docs/rules.md` absorb tactics, leaders, monsters, crits/dodge, names, and the 12-class table (the story-2.4 drift guard keeps CI honest).
UX-DR11: Text crispness: the current `crispText`/`TEXT_RESOLUTION` mitigation stays; the real text-ceiling fix (DPR-sized backing store + per-scene zoom) ships inside the Epic 4 legibility cluster, NFR1-gated against the measured performance baseline.

### FR Coverage Map

FR1: Epic 1 - Draft 3 of 6 classes, duplicates allowed
FR2: Epic 1 - Draft screen with rules cards (visual polish in Epic 2)
FR3: Epic 1 - Element rolls at draft (seeded, AD-9/AD-10)
FR4: Epic 1 - 3×3 touch placement
FR5: Epic 1 - Hidden simultaneous placement
FR6: Epic 1 - Reveal screen
FR7: Epic 1 - Reach / column adjacency (engine)
FR8: Epic 1 - Melee targeting (engine)
FR9: Epic 1 - Ranged targeting (engine)
FR10: Epic 1 - Mage row blast (engine); blast attenuation tuning in story 3.0
FR11: Epic 1 - Cleric healing (engine)
FR12: Epic 1 - Witch status casting (engine)
FR13: Epic 1 - AGI initiative timeline (engine)
FR14: Epic 1 - RPS triangle multipliers (engine); archer-vs-casters amendment in story 3.0; role-relations generalization in Epic 4
FR15: Epic 1 - Attributes, formulas, class table (engine balance data)
FR16: Epic 1 - Element-keyed Witch spells (engine)
FR17: Epic 1 - Single-engagement resolution (engine)
FR18: Epic 1 - HP % judging, draw handling (engine)
FR19: Epic 1 - Until-wipeout mode (stretch story); Epic 4 - cap raised to 10
FR20: Epic 1 - Determinism (engine + seed streams); Epic 4 - tactics/leaders join the inputs, crit/dodge draw order frozen
FR21: Epic 2 - Animated OB64-style battle scene
FR22: Epic 2 - Result screen polish
FR23: Epic 2 - Battle speed / skip controls
FR24: Epic 1 - AI blindness (engine AI module)
FR25: Epic 1 - AI strategy pool
FR26: Epic 1 - AI speed/offline
FR27: Epic 1 - Core match loop (help screen lands in Epic 2)
FR28: Epic 3 - Battle history + replay; Epic 4 - stored setup gains tactic + leader
FR29: Epic 3 - PWA install/offline
FR30: Epic 1 - Mobile-first portrait touch layout
FR31: Epic 2 - CC pixel-art assets + credits screen
FR32: Epic 4 - Per-row move variety (per-class per-row move table)
FR33: Epic 4 - Defensive "Guard" move type
FR34: Epic 4 - Target-selection tactics (autonomous/weakest/strongest/leader) + the fixed targeting pipeline
FR35: Epic 4 - Squad leader designation + leader-killed penalty state
FR36: Epic 4 - Critical hits and dodge (DEX spends its purpose; frozen draw order)
FR37: Epic 4 - Generated unit names (names/A, names/B streams; stored in setup)
FR38: Epic 4 - Monsters: dragon + golem, 2 slots, two-cell vertical footprint
FR39: Epic 4 - Battle legibility: Turn wording, action ledger, from→to attacks, contrast fix; (g) pause DROPPED for wave 1 (PO decision at breakdown, 2026-07-16 — speed/skip suffice, revisit post-wave)

Epic 4 amendments to shipped FRs (all land inside Epic 4): FR1 (5-slot budget), FR2 (improved spec cards), FR4–FR6 (monster placement, leader/tactic designation, hidden + revealed), FR7 (melee-only reach + Last Stand), FR9 (ranged global range), FR10 (Archmage gating in/out decided at breakdown), FR14 (role relations), FR15 (12-class roster, DEX unreserved), FR19 (wipeout cap 10), FR20 (tactics/leaders as battle inputs), FR24 (AI commits tactic + leader), FR28 (history stores them). NFR4 gains the sweep scaling pass.

## Epic List

### Epic 1: Play a complete match against the AI on your phone
From an empty repo to a full playable duel: draft 3 units with element rolls, place them by touch, and watch a rules-complete battle resolve with a functional (not yet beautiful) presentation — deployed and loadable on an Android phone from the first story. Includes the workspace scaffold (official Phaser starter + dep bumps), the entire deterministic engine with its test suite and sim harness, and the AI opponent. Until-wipeout mode rides along as a stretch story.
**FRs covered:** FR1–FR20 (FR19 stretch), FR24–FR27 (core loop), FR30

### Epic 2: The battle becomes a show
The OB64 fantasy lands: CC pixel-art sprites with idle/attack/hurt/death animations, the animated lane-based battle scene with damage numbers and status icons, speed/skip controls, a worthy result screen, plus the rules/help screen and the credits screen the art licenses require.
**FRs covered:** FR21, FR22, FR23, FR31, FR27 (help screen), FR2 (rules-card polish)

### Epic 3: Take it anywhere, keep your battles
The game becomes a real PWA: installable, fully offline for vs-AI, verified against the performance budget on a mid-range phone — and battle history arrives: last 10 matches on-device, replayable tick-for-tick via determinism.
**FRs covered:** FR28, FR29 (+ NFR1 verification)

### Epic 4: The squad era — command a real OB64 squad *(committed 2026-07-16, sequenced before link-play)*
The game Danilo actually targets arrives: 5-slot armies with two-cell dragons and golems looming over the grid, a 12-class roster held together by role-based advantage relations, a tactic to call and a leader to crown and protect, crits and dodges that make DEX real, soldiers with names you start to remember — and a battle a newcomer can finally *read* (action ledger, from→to attacks, Turn wording, the contrast fix). One mega-epic by explicit PO decision: **one combined `logVersion`/`balanceVersion` bump** (AD-15 — one history invalidation, not several; the design-complete union extension ships with the first union-touching story; `StatusCleared` and the wipeout cap 5→10 ride the same bump). Stories still ship and get device-accepted incrementally.
**FRs covered:** FR32–FR39 (new), plus the Epic 4 amendments to FR1, FR2, FR4–FR7, FR9, FR10 (Archmage gating decision), FR14, FR15, FR19, FR20, FR24, FR28; NFR4's sweep scaling pass; NFR6's widened engine contract.

**Future (outside this breakdown):**
- Link-play 1v1 via shareable URL — its engine seam (AD-1/AD-3/AD-11) is already fixed; broken down when the epic is scheduled (sequenced after Epic 4 — epic-3 retro decision).

## Epic 1: Play a complete match against the AI on your phone

From an empty repo to a full playable duel: draft, place, battle, result — rules-complete with functional presentation, deployed to a real URL from the first story. Covers FR1–FR20 (FR19 stretch), FR24–FR27, FR30; carries NFR2 (engine tests), NFR4 (sim harness), NFR6 (engine contract) and spine ADs 1–13.

### Story 1.1: Monorepo scaffold and the CI quality gate

As the game's developer,
I want a scaffolded workspace where every push is typechecked and tested,
So that all later work lands on rails from the first commit.

**Acceptance Criteria:**

**Given** an empty repository
**When** the scaffold story is complete
**Then** a pnpm-workspaces monorepo exists with `packages/engine` (plain TS, only runtime dependency `pure-rand`) and `apps/web` (scaffolded via `npm create @phaserjs/game@latest`, Vite + TypeScript template)
**And** dependencies are bumped to the pinned stack: Phaser 4.2.x, Vite 8.x, TypeScript 5.9.x (explicit pin), Vitest 4.1.x, fast-check 4.x + @fast-check/vitest, vite-plugin-pwa 1.x, wrangler 4.x, Node 24, pnpm 11.

**Given** the monorepo
**When** any commit is pushed
**Then** GitHub Actions runs typecheck and all tests, and a red run blocks merge (AD-7)
**And** a placeholder engine unit test and a web smoke test prove both packages are wired into the runner
**And** the coverage step runs from the start; the ≥90% engine-line threshold activates with the full-roster story (1.6) — an accepted, recorded sequencing of AD-7's gate.

**Given** the repo
**When** a stranger reads `README.md`
**Then** they can install, test, and run locally in documented steps (NFR3).

### Story 1.2: A deployed home screen on a real URL

As a player,
I want the game's URL to load a home screen on my Android phone,
So that from day one there is a real, reachable game to grow.

**Acceptance Criteria:**

**Given** a merge to `main`
**When** the deploy workflow runs
**Then** `apps/web` static assets deploy to Cloudflare Workers via wrangler (AD-7).

**Given** the production URL
**When** opened in Android Chrome
**Then** a portrait-oriented Home scene shows the game title and a disabled "Play vs AI" button (FR30 layout baseline).

**Given** the repo
**When** the README's deploy section is followed
**Then** a stranger can deploy in documented steps (NFR3).

### Story 1.3: Engine foundation — types, balance data, and seed streams

As the game's developer,
I want the engine package to own the domain vocabulary, balance numbers, and deterministic randomness,
So that every later rule is built on one shared, tested foundation.

**Acceptance Criteria:**

**Given** `packages/engine`
**When** the foundation lands
**Then** `types.ts` defines the canonical `MatchSetup` exactly as AD-9 fixes it (seed, balanceVersion, mode, armies of `{class, element}`, owner-local placements), sides `'A' | 'B'`, unit ids `side:index`, and the PRD Glossary vocabulary (AD-4, AD-11)
**And** `balance.ts` holds the FR15 class table (HP, STR, VIT, INT, MEN, AGI, DEX, per-row action counts) and formula constants as data with a `balanceVersion` integer.

**Given** the balance data
**When** CI runs
**Then** a test asserts the balance content hash matches the declared `balanceVersion`, so a forgotten bump fails the build (AD-8).

**Given** a 32-bit match seed
**When** randomness is requested
**Then** `rng.ts` exposes exactly the closed stream set `elements/A`, `elements/B`, `ai/A`, `ai/B`, `battle` over pure-rand, the raw seed is not directly consumable, and streams are independent (AD-10)
**And** an engine-exported `rollElement(stream)` returns Fire/Water/Wind/Earth (FR3)
**And** property tests prove: same seed → identical streams; different labels → uncorrelated sequences.

**Given** the engine package
**When** its public API is reviewed
**Then** every export carries doc comments (NFR3) and the package imports nothing effectful (AD-1 paradigm check).

### Story 1.4: Battle timeline and the BattleLog chassis

As the game's developer,
I want the engagement loop resolving on the AGI timeline over a validated input contract,
So that every combat mechanic lands on a proven, deterministic chassis.

**Acceptance Criteria:**

**Given** a valid `MatchSetup`
**When** `resolveBattle(setup)` runs
**Then** it returns an immutable `BattleLog` (`logVersion` + ordered events) without mutating its input (AD-1, AD-12), scaffolding the event envelope with `BattleStarted`, `PassStarted`, `EngagementEnded`, and `BattleEnded`
**And** combat runs in passes: one action per living unit per pass, descending AGI across both armies, multihit split across passes, ties broken front-row → left → seeded coin flip; units with no actions remaining are skipped (FR13, FR17 loop structure).

**Given** a malformed `MatchSetup` (wrong army size, out-of-grid or overlapping placement, unknown class or element, `balanceVersion` mismatch)
**When** `resolveBattle` is called
**Then** it throws a typed validation error naming the violation — the only condition under which the engine throws (spine errors convention) — and each case is unit-tested.

**Given** the chassis test suite
**When** CI runs
**Then** unit tests cover FR13's ordering, tie-breaking, and multihit split via the event stream, and property tests prove termination and seed identity (same setup → bit-identical log) (NFR2, FR20).

### Story 1.5: Melee combat, damage, and judging

As a player,
I want two armies of Knights and Mercenaries to fight a complete engagement with a decided winner,
So that the battle core exists end to end before the full roster arrives.

**Acceptance Criteria:**

**Given** a `MatchSetup` with Knight/Mercenary armies
**When** the battle resolves
**Then** melee targeting obeys reach (FR7: facing + adjacent columns) and nearest-occupied-row-no-bypass with facing → center → left priority, re-evaluated per attack (FR8).

**Given** an attack resolves
**When** damage is computed
**Then** physical damage = STR − VIT/2 (integer math, floor rounding in fixed order, minimum 1) with RPS ×1.5/×0.75 per FR14–FR15
**And** the emitted `UnitAttacked` event carries source, target, damage, and HP-after (AD-12); deaths emit `UnitDied` and dead units lose unspent actions.

**Given** all actions are spent
**When** the engagement ends (FR17)
**Then** judging follows FR18: wipe = instant win, else higher team-HP-%, exact tie = `winner: 'draw'`, ending with `BattleEnded { winner, hpPct }`.

**Given** the engine test suite
**When** CI runs
**Then** each FR7/FR8/FR14/FR17/FR18 rule has unit tests, a property test proves judging symmetry (swapping sides swaps the result), and at least 3 golden-battle snapshots guard regressions (NFR2).

### Story 1.6: Full class roster — Archer, Mage, Cleric, and Witch

As a player,
I want all six classes fighting by their real rules,
So that the rock-paper-scissors mind-game is complete.

**Acceptance Criteria:**

**Given** armies containing Archers
**When** they act
**Then** they target the rearmost occupied reachable row with FR8's column priority, 1/2/2 actions by row (FR9, FR15).

**Given** armies containing Mages
**When** they cast
**Then** the blast hits every unit in the enemy row with most living units (tie → rearmost), ignoring reach, magic damage INT − MEN/2 with per-target RPS (FR10).

**Given** armies containing Clerics
**When** they act
**Then** they heal the lowest-HP-% living ally (self included, capped at max HP, heal = INT × 1.25); with no damaged ally they make the weak STR staff attack using magic targeting (FR11).

**Given** a Witch with each element
**When** she casts (magic targeting, prefers unaffected targets, no damage — FR12)
**Then** Water→Sleep voids the target's remaining actions; Earth→Poison deals 15 at engagement end before judging; Fire→Weaken halves the target's damage; Wind→Confusion gives each target action a 50% seeded misfire onto its own side, fully specified per class: a confused melee/ranged attack strikes a uniformly random (seeded, `battle` stream) living ally of the confused unit; a confused Mage blasts its own fullest row; a confused Cleric heals a random living enemy; a confused Witch applies her spell to a random living ally; any action with no valid misfire target fizzles and is spent; same spell never stacks (FR16)
**And** the `BattleEvent` union now covers the full closed set: `BattleStarted`, `PassStarted`, `UnitAttacked`, `UnitHealed`, `StatusApplied`, `ActionMisfired`, `ActionFizzled`, `ActionSkipped`, `PoisonTicked`, `UnitDied`, `EngagementEnded`, `BattleEnded` (AD-12).

**Given** the full roster
**When** CI runs
**Then** every FR9–FR12/FR16 rule has unit tests, property tests still hold over all-class armies, and golden battles cover at least one battle per class (NFR2, ≥90% engine line coverage gate now enforced in CI — AD-7).

### Story 1.7: The AI opponent and the balancing harness

As a player,
I want an AI that commits its own hidden army and formation,
So that I always have an opponent who can punish a lazy formation.

**Acceptance Criteria:**

**Given** the engine's AI module
**When** it picks
**Then** `chooseSetup(strategyPool, aiStream)` is a pure function in `packages/engine` returning composition + placement, with no parameter through which the player's draft or placement could pass (FR24, AD-6)
**And** it draws only from its own named stream (`ai/A` or `ai/B` — AD-10).

**Given** the curated strategy pool
**When** the AI plays repeated matches
**Then** it varies over 8–12 archetypes with seeded variation (not the same board twice in a row), including at least one back-row-sniper archetype and one anti-front-stack archetype (FR25)
**And** selection completes in under 1 second entirely client-side (FR26).

**Given** the sim harness (`engine/sim`)
**When** run headlessly from the CLI
**Then** it sweeps AI-vs-AI matches across compositions (each side on its own stream — no mirror-match artifact), reporting win rates per composition/archetype to flag dominant strategies (NFR4)
**And** across the sweep no single archetype exceeds a 65% aggregate win rate `[initial acceptance band — tuning value]`; the ~50% human-vs-AI target (FR25) is explicitly deferred to playtesting (PRD Open Item 1).

### Story 1.8: Draft and placement on the phone

As a player,
I want to draft three units, see their elements, and secretly place them on my grid by touch,
So that all my strategic decisions are made and locked in.

**Acceptance Criteria:**

**Given** the Home scene's now-enabled "Play vs AI"
**When** I enter the Draft scene
**Then** six class cards show name, sprite placeholder, and compact rules card (role, RPS relation, per-row behavior — FR2)
**And** tapping adds a unit (duplicates allowed) up to exactly 3, each instantly showing its element rolled once via the engine's roll function on my `elements/A` stream (FR1, FR3, AD-9).

**Given** a drafted unit
**When** I remove it from my army
**Then** the unit and its element are discarded; the element stream is **forward-only** — re-adding any unit draws the *next* value from `elements/A`, never rewinding or reusing a discarded roll (AD-10 determinism preserved).

**Given** my drafted army
**When** I place units on the Placement scene
**Then** I drag each onto any empty cell of my 3×3 grid (portrait, touch-native, ~360×640 up — FR4, FR30) and can rearrange freely
**And** dropping onto an occupied cell swaps the two units; releasing a drag outside the grid returns the unit to where it came from (its previous cell or the unplaced tray) — no drop is ever lost or produces an illegal board.

**Given** fewer than 3 units are placed
**When** I look at the submit control
**Then** it is visibly disabled with a "place all 3 units" affordance, and becomes enabled exactly when the third unit lands.

**Given** I submit
**When** the AI commits
**Then** its setup comes from Story 1.7's module without any access to my choices (FR5, FR24), and nothing of the AI's board renders before the Reveal.

**Given** the whole flow
**When** state moves between scenes
**Then** a single serializable `MatchState` owned by `MatchFlow` is passed explicitly — no Phaser-registry state, no scene-local copies (AD-5, AD-13), with a fresh `crypto.getRandomValues` seed per match, rematches included (AD-10).

### Story 1.9: Reveal, battle playback, and result — the loop closes

As a player,
I want to watch the battle resolve and see who won, then rematch in one tap,
So that I can play complete matches on my phone, end to end.

**Acceptance Criteria:**

**Given** both boards are committed
**When** the Reveal scene shows
**Then** both boards display face to face with classes and elements visible (FR6), rendering the mirrored lanes correctly from owner-local coordinates (AD-11).

**Given** the reveal
**When** the battle plays
**Then** `MatchFlow` calls `resolveBattle` exactly once (AD-13) and the Battle scene plays the `BattleLog` sequentially — functional presentation (simple shapes/labels acceptable this epic): each event visibly rendered in order, HP bars deplete, deaths disappear, statuses marked (AD-2; FR21's full animation arrives in Epic 2)
**And** playback pacing is defined: a default beat duration per event (~600 ms at normal speed, a tuning constant in data, not code) with press-and-hold to fast-forward ×4 — an interim affordance until FR23's controls land in story 2.3
**And** the scene evaluates no combat rule — deleting the engine from it leaves no game logic behind.

**Given** the battle ends
**When** the Result scene shows
**Then** winner (or draw) with both final HP percentages and both compositions display (FR18, FR22 functional), with **Rematch** (one tap → fresh Draft with a new seed) and **Home** (FR27)
**And** a full loop Home → Draft → Placement → Reveal → Battle → Result → Rematch completes in under 5 minutes on a phone with no account and no tutorial gate (FR27)
**And** the deployed production URL delivers this complete loop on Android Chrome.

### Story 1.10: Until-wipeout mode (stretch)

As a player,
I want an extended battle mode where engagements repeat until one side falls,
So that Clerics and Witches get room to shine.

**Acceptance Criteria:**

**Given** `MatchSetup.mode = 'wipeout'`
**When** `resolveBattle` runs
**Then** engagements repeat until a side is wiped; statuses clear between engagements except poison, which persists and ticks each engagement end; after 5 engagements judging falls back to FR18 (FR19)
**And** `EngagementEnded` events delimit engagements in the log; determinism, termination, and golden-battle tests cover the mode (NFR2).

**Given** the MVP UI
**When** a player starts a match
**Then** they can choose between two modes before drafting — **Standard** (single engagement, FR17, the default) and **Wipeout** (engagements repeat until one side falls, FR19, capped at 5 engagements) — surfaced as a real, player-facing toggle (e.g. on Home or Draft), not a dev/debug-only affordance. (Product decision made — see PRD Open Item 2.)

## Epic 2: The battle becomes a show

The OB64 fantasy lands: real pixel-art units, an animated lane-based battle scene, watchability controls, and the content screens (help, credits) that make the game self-explanatory and license-clean. Covers FR21–FR23, FR31, FR27 (help screen), FR2 (rules-card polish). Design notes carried from the missing UX phase: camera perspective (FR21) and sprite-pack selection (FR31) are decided inside these stories.

### Story 2.1: Real units — sprite packs, atlases, and animations

As a player,
I want every unit to look like a fantasy pixel-art character with real animations,
So that the game stops looking like a prototype.

**Acceptance Criteria:**

**Given** the free/CC pack landscape (itch.io, OpenGameArt, Kenney)
**When** packs are selected
**Then** every class has a visually distinct sprite with at minimum idle, attack/cast, hurt, and death representations (frame animation or tween-based — FR31), and elements are visually distinguishable on a unit (badge/tint consistent across scenes — FR3)
**And** the selection is recorded with license terms in an attribution manifest in the repo (FR31); any pack not allowing redistribution is rejected.

**Given** the selected art
**When** it ships
**Then** sprites are packed into texture atlases and the initial bundle stays within the ≤3 MB compressed budget (NFR1 convention)
**And** Draft, Placement, and Reveal scenes render the real sprites in place of placeholders (FR2 visual baseline).

### Story 2.2: The animated battle scene

As a player,
I want to watch my formation fight an OB64-style animated clash,
So that watching my plan succeed or collapse is the payoff of the match.

**Acceptance Criteria:**

**Given** a resolved `BattleLog`
**When** the Battle scene plays it
**Then** the two formations face off in mirrored lanes (owner-local → screen mapping stays confined to the renderer — AD-11), and each log event renders as a distinct animated beat in initiative order — one event at a time, each beat ≥ 300 ms at normal speed: melee steps and strikes, arrows fly, blasts wash a row, heals glow, statuses show persistent icons, misfires/fizzles/sleeps are visibly distinct, deaths play out and the corpse leaves the lane (FR21, AD-12)
**And** on a 360×640 CSS px viewport: unit sprites render ≥ 32 px, damage/heal numbers ≥ 14 px, and HP bars and status icons are distinguishable per unit — the concrete floor for FR21's "reads clearly on a phone"
**And** floating damage/heal numbers and per-unit HP bars update exactly per the event payloads — the scene derives no game state itself (AD-2).

**Given** the camera perspective decision (open UX note in FR21)
**When** this story is planned
**Then** the choice (side-on vs isometric) is made explicitly against the selected sprite pack's available angles, recorded as an ADR (NFR3 convention), and both grids plus every action read clearly on a ~360×640 portrait phone screen (FR21, FR30).

**Given** the animation runs on a Pixel 6a-class phone
**When** the busiest battle plays
**Then** the scene sustains the 60 fps target / 30 floor (NFR1; full-budget verification happens in Epic 3).

**Given** the Battle scene is playing
**When** the player taps a "Log" toggle
**Then** a collapsible panel beneath the board expands to show a scrolling text narration of the same `BattleLog` events already driving the animation (e.g. "Knight A:0 struck Archer B:1 for 12 — 78→66 HP"), collapsing again on a second tap
**And** the panel reads directly from the log the scene already holds — no new data, no re-derivation (AD-2) — and does not pause or alter the animated playback.

### Story 2.3: Watchability controls and a worthy result screen

As a player,
I want to control battle pacing and get a satisfying verdict,
So that first battles are savored and rematch grinding stays fast.

**Acceptance Criteria:**

**Given** a battle is playing
**When** I use the controls
**Then** I can toggle speed (normal / fast ×2 minimum) and skip straight to the result at any moment, with no rule divergence — the same log just plays faster or resolves instantly (FR23, AD-2).

**Given** my speed preference
**When** I return for another match
**Then** it persisted via the `web/storage` gateway introduced in this story (sole localStorage owner, `lordly.v1.settings` key — AD-8; the gateway ships here with settings only, history keys arrive in Epic 3).

**Given** the battle ends
**When** the Result scene shows
**Then** the verdict presents winner or draw with a full-screen victory/defeat/draw banner, an animated count-up of both final HP percentages, and both compositions with sprites and elements, plus one-tap Rematch / Home (FR22)
**And** rematch reaches a fresh Draft (new seed) in a single tap (FR27).

### Story 2.4: Help, rules, and credits screens

As a new player,
I want the rules explained inside the game and the artists credited,
So that a first-timer can learn the game cold and licenses are honored.

**Acceptance Criteria:**

**Given** Home or Draft
**When** I open Help
**Then** a phone-readable rules screen explains: the class table with RPS triangle, per-row behaviors, elements and Witch spells, targeting basics, and judging — content aligned with PRD Features 3–5 as the single source of truth (FR27, NFR3)
**And** the rules content also exists as a standalone repo document (`docs/rules.md`) that the Help scene renders from — NFR3's rules document becomes an explicit artifact, not an implicit by-product
**And** each draft-screen rules card is polished to its final compact form consistent with Help content (FR2).

**Given** Home
**When** I open Credits
**Then** every art pack renders from the attribution manifest with author, pack name, and license (FR31)
**And** both screens are Phaser scenes in the AD-5 FSM, reachable and dismissible by touch.

## Epic 3: Take it anywhere, keep your battles

The game becomes a true pocket game: installable, fully offline, verified against the performance budget — and it remembers. Covers FR28, FR29, and NFR1 verification. Opens with a pre-epic balance tuning pass (story 3.0, added via sprint-change-proposal-2026-07-14) so history records battles under the tuned rules.

### Story 3.0: Balance tuning pass — the blast tamed, the archer a caster-hunter

As a player,
I want the Mage's row blast toned down and the Archer to counter every caster,
So that no single class dominates and battles stay tense before my history starts recording them.

**Acceptance Criteria:**

**Given** the amended FR14
**When** an Archer attacks a Mage, Cleric, or Witch
**Then** the attack deals ×1.5 damage — one-way: Cleric and Witch take no new penalty attacking the Archer, and the core triangle is unchanged
**And** `rpsBeats`' one-target-per-class map becomes a small multi-target lookup — a contained balance-data shape change, no new events, no new player choices, no UI work.

**Given** the amended FR10
**When** the Mage's blast resolves **in until-wipeout mode**
**Then** each target's damage is attenuated by the named `blastAttenuation` balance ratio (×0.75), applied after the base formula and before RPS — integer math and FR15's fixed rounding order preserved (FR20); single-engagement blasts stay unattenuated *(mode-scoping decided during the story from the both-mode sweep evidence, PO-approved: un-attenuated wipeout was three-mages-dominant at 74.6%, while attenuating single mode handed the meta to archer walls at ~75%)*.

**Given** AD-8 discipline
**When** the balance data changes
**Then** `balanceVersion` bumps, the balance-hash test is re-pinned, and golden battles are re-recorded
**And** `docs/rules.md` reflects the tuned rules and numbers — story 2.4's drift guard stays green (a lying Help screen fails CI).

**Given** the NFR4 sim harness
**When** the sweep runs headlessly
**Then** it runs in **both modes** — single-engagement and wipeout (the sweep's mode knob, deferred since story 1.10, ships here) — and no archetype exceeds the ≤65% aggregate dominance band in either mode.

**Given** the tuned build on the production URL
**When** Danilo plays real matches on his own device
**Then** felt balance is accepted: the blast no longer reads "too broken" and melee comps feel viable — the on-device felt-balance acceptance is this story's sign-off gate.

### Story 3.1: Battle history

As a player,
I want my last ten matches remembered on my phone,
So that I can see what I played and how it went.

**Acceptance Criteria:**

**Given** a live match ends
**When** `BattleEnded` lands
**Then** `MatchFlow` writes exactly one `HistoryEntry` — full `MatchSetup` (which carries seed and balanceVersion), winner (`'A' | 'B' | 'draw'`), ISO date — through the `web/storage` gateway under the `lordly.v1.*` history keys (FR28, AD-8, AD-13)
**And** only the 10 most recent entries are kept, oldest evicted first
**And** no `BattleLog` is ever stored or cached (AD-8).

**Given** Home
**When** I open History
**Then** the list shows each match's date, winner, and both compositions with class sprites and elements (FR28)
**And** entries from an unknown or older storage namespace are ignored, never migrated or crashed on (AD-8).

### Story 3.2: Replay any remembered battle

As a player,
I want to rewatch a past battle exactly as it happened,
So that I can study a great read or show a friend.

**Acceptance Criteria:**

**Given** a history entry whose `balanceVersion` matches the current engine
**When** I tap Replay
**Then** `MatchFlow` in `replay` mode re-resolves the battle from the stored `MatchSetup` (determinism guarantees tick-for-tick fidelity — FR20, FR28) and the Battle scene plays it with full Epic 2 presentation and speed/skip controls
**And** replay writes nothing: no new history entry, no state mutation — my real match history is untouched (AD-13).

**Given** an entry whose `balanceVersion` no longer matches
**When** History renders it
**Then** it still displays fully but is visibly marked non-replayable, and Replay is disabled for it (AD-8).

### Story 3.3: Install it, play it offline

As a player,
I want the game on my home screen working without a connection,
So that a bus-stop match needs nothing but my phone.

**Acceptance Criteria:**

**Given** the production URL in Android Chrome
**When** the PWA is evaluated
**Then** it is installable (valid manifest, icons, HTTPS) and appears on the home screen with the game's name and icon (FR29).

**Given** the game was loaded once
**When** I open it with no connectivity (airplane mode)
**Then** a complete vs-AI match — draft through result, history included — works fully offline via the service worker (FR29, FR26)
**And** the service-worker update strategy (prompt vs auto-update — the spine's deferred decision) is decided in this story and recorded as an ADR (NFR3).

### Story 3.4: The performance verdict

As a player,
I want the game fast and light on a normal phone,
So that it feels like a real game, not a heavy web page.

**Acceptance Criteria:**

**Given** a Pixel 6a-class Android phone on Chrome
**When** the full experience is measured (busiest battle animation, draft, placement)
**Then** frame rate sustains the 60 fps target and never drops below the 30 floor, measured and documented (NFR1).

**Given** a throttled 4G connection
**When** the production URL loads cold
**Then** the game is interactive in ≤ 5 seconds and the initial compressed bundle is ≤ 3 MB, with the measurement method documented (NFR1)
**And** any hotspot found (atlas size, engine pass, scene churn) is fixed within this story or filed with a measured baseline and a concrete follow-up if genuinely out of scope.

**Given** the measurements
**When** the story closes
**Then** results are recorded in the repo docs (NFR3), closing the MVP's performance requirement with evidence rather than assumption.

## Epic 4: The squad era — command a real OB64 squad

The game Danilo targets arrives: 5-slot armies with two-cell monsters, a 12-class roster on role relations, tactics and a leader, crits and dodge, named soldiers, and a battle a newcomer can read. Covers FR32–FR39 plus the Epic 4 amendments to FR1, FR2, FR4–FR7, FR9, FR14, FR15, FR19, FR20, FR24, FR28; NFR4's scaling pass; ADs 14–15 and the eight AD amendments; UX-DR1–11.

**Breakdown decisions (PO, 2026-07-16):** one mega-epic, one combined `logVersion`/`balanceVersion` era bump (AD-15 — `logVersion` bumps exactly once, in story 4.2; `balanceVersion` ticks freely per story, mid-epic intermediates display-but-don't-replay). Archmage-style promotion (FR10's parked item) is **postponed until after link-play** — promotion wants most/all classes present first; this era fields first-level classes only (Archer, Mage, Knight… before Sniper, Archmage, Paladin). The FR39g pause control is **dropped for wave 1** — speed/skip suffice; revisit post-wave. Design deliverables are front-loaded into story 4.1 because AD-12/AD-15 demand the complete union extension proven before the bump ships and FR38 forbids implementing monsters before their semantics are defined.

### Story 4.0: Battle legibility quick wins

As a player,
I want the battle board readable at a glance on my phone,
So that the shipped legibility defects stop obscuring the game before the era work begins.

**Acceptance Criteria:**

**Given** unit labels on same-colored board tiles (the screenshot-evidenced shipped defect)
**When** the contrast treatment lands
**Then** class codes are legible on side-colored tiles in both themes (FR39f), the fix living in `DESIGN.md`'s unit-card token treatment — not per-scene hacks (UX-DR7) — and is verified on device.

**Given** the battle board
**When** it renders
**Then** the redundant "front" word is removed while the non-verbal front-row indicator (brighter tiles + gold edge) stays (FR39e), and `EXPERIENCE.md` is amended to resolve its "FRONT"-arrow conflict with FR39e (UX-DR8) — the spine is amended, never silently contradicted.

**Given** any player-facing copy that says "pass"
**When** this story closes
**Then** it says "Turn" (FR39a) — a display rename only: engine vocabulary, `PassStarted`, and the glossary keep "pass".

**Given** the text-ceiling fix (candidate (a): DPR-sized backing store + per-scene zoom)
**When** implemented
**Then** text renders crisp at device resolution and before/after measurements against `docs/performance-verdict.md`'s baseline prove NFR1 still holds (UX-DR11), with results recorded.

**Given** the engine
**When** this story ships
**Then** nothing changed: no version bump, balance hash and golden battles untouched — this story is deliberately pre-era, display-only.

### Story 4.1: The Epic 4 design dossier

As the game's developer,
I want every rules-era design decision made, recorded, and proven expressible before implementation begins,
So that the era's single logVersion bump ships complete and no story stalls on an undesigned rule.

**Acceptance Criteria:**

**Given** FR14/FR15
**When** the dossier lands
**Then** it fixes the wave-1 role vocabulary, the role-relation table (symmetric ×1.5/×0.75 and one-way ×1.5 entries), and the 12-class list with full stat rows and 3-letter codes — first-level classes only (promotion postponed post-link-play) — with the shipped triangle and caster-hunt demonstrably reproduced as the degenerate case of the role data (FR14 continuity constraint).

**Given** FR38's open semantics
**When** the dossier lands
**Then** monster two-cell rules are defined in BOTH directions — row-blast counting, melee nearest-row blockade, ranged rearmost eligibility, reach from a two-cell origin, which row's action count and move-kind a Front+Middle vs Middle+Back body uses, and FR13's front-before-back tie-break for a two-row body — each stated once, testably.

**Given** FR36 and AD-10
**When** crit/dodge is designed
**Then** chances, multipliers, and the magic-crit rule are fixed, and the per-attack **draw-order-and-count table** (every action type, multi-target fan-out per target in target order) is recorded as an ADR and frozen forever — every future seed depends on it (FR20).

**Given** FR32/FR33 and the Open Item 3 touchpoints
**When** the dossier lands
**Then** the per-class per-row move table is complete (Guard's mechanic — mitigation-for-the-engagement vs negate-one-attack, or both — decided, including its FR14 interaction), and tactic interactions are pinned: tactics × Mage row blast, the Witch's prefer-unafflicted rule under a tactic, heals vs tactics; plus the leader-penalty ratio, the penalty tactic (plain Autonomous vs OB64-"panicked"), and the wave-1 leader-initiative-perk decision (FR35); plus the FR37 name-table content and display surfaces.

**Given** AD-12/AD-15
**When** the union extension is designed
**Then** the complete `BattleEvent` extension (`crit`/`missed`/`dodged`, `StatusCleared`, leader-death/penalty-state, Guard outcomes, move-kind on action events, the FR39b ledger payload) is walked against **every render surface of FR32–FR39** — battle scene, ledger, reveal, History cards — and each is proven expressible from the union plus AD-2's static-facts channel BEFORE story 4.2 ships the bump.

**Given** UX-DR9
**When** the dossier closes
**Then** `DESIGN.md`/`EXPERIENCE.md` are extended (a bmad-ux pass or equivalent spine amendment) covering: the tactic picker and leader designation at placement, reveal disclosure, monster two-cell rendering, name display, per-row action counts at placement, and the action ledger — the PO-flagged key display problem — in both themes, within the locked Battle HERO layout (UX-DR1–5)
**And** every load-bearing choice gets an ADR (NFR3).

### Story 4.2: The era turnover — five-slot armies and named soldiers

As a player,
I want to field a five-slot army of named soldiers,
So that my squad starts feeling like an OB64 squad, not a trio.

**Acceptance Criteria:**

**Given** AD-1's amendment
**When** the slot vocabulary lands
**Then** balance data carries `slotBudget: 5` and per-class `slotCost`, the engine exports `slotTotal(army)`, the shipped `armySize` constant is **deleted**, and no code anywhere uses `army.length` as a legality measure — validation already accepts that a future two-monster army is full at 3 units.

**Given** AD-9's amendment
**When** `MatchSetup` extends
**Then** it carries `tactics: {A, B}`, `leaders: {A, B}`, `Unit = {class, element, name}`, and anchor-based placements; any army mutation clears that side's leader; `commit()` requires an explicit tactic and a valid leader — until the pickers ship (4.4/4.5), `MatchFlow` explicitly commits `autonomous` and leader index 0 for both sides.

**Given** FR37 and AD-10
**When** names land
**Then** `names/A`/`names/B` join the closed stream set, an engine-exported roll function draws from the dossier's name table (engine data **outside** the balance-hash surface), `MatchFlow` rolls names for both sides at army construction (the AI module never rolls names — AD-6), and names display on placement/reveal cards and in battle.

**Given** AD-15
**When** the first union-touching change ships
**Then** the COMPLETE union extension from the dossier lands in types with `logVersion` bumped **exactly once**; `StatusCleared` is emitted immediately (wipeout inter-engagement clears — the story-2.2 deferral); the other new events sit in the union until their stories emit them.

**Given** FR19's amendment
**When** the balance data changes
**Then** the wipeout cap is 10, Home's mode-toggle hint says 10 (UX-DR10), `balanceVersion` bumps, the hash re-pins, and golden battles are re-recorded.

**Given** the phone
**When** I play
**Then** Draft and Placement handle 5 units in the portrait layout (FR1, FR30), the AI plays 5-slot archetypes (FR24/FR25), the full loop completes on device, pre-era history entries display marked non-replayable — **confirmed on device in anger** (the carried-in 3.2-UX check) — and new entries store tactics and leaders (FR28)
**And** determinism, termination, and judging-symmetry properties plus goldens all hold over 5-slot armies with the ≥90% coverage gate green (NFR2).

### Story 4.3: Roster wave 1 — twelve classes on role relations

As a player,
I want new classes to draft, held together by readable role matchups,
So that drafting gets deeper without an N-squared rules explosion.

**Acceptance Criteria:**

**Given** AD-4's amendment
**When** role relations land
**Then** they REPLACE `rpsBeats`/`rpsHunts` as the single matchup source, draft-card `beats`/`beatenBy` derive from role data, no dual matchup tables survive, and continuity tests prove the shipped 6 classes keep their effective matchups (FR14's degenerate-case constraint).

**Given** the dossier's wave-1 list
**When** the roster lands
**Then** the 4 new small classes ship as role/stat variants ("start generic, iterate to unique") with roles, stat rows, and 3-letter codes in balance data — first-level classes only — and every class renders with the FR2 improved spec card: role, matchups, per-row behavior, action counts, readable at 360px (UX-DR3).

**Given** the balance discipline
**When** the data changes
**Then** `balanceVersion` bumps with hash re-pin and re-recorded goldens; the AI archetype pool covers the newcomers; the NFR4 sweep runs both modes with no archetype over the ≤65% band; `docs/rules.md` and Help absorb the 12-class table (the 2.4 drift guard stays green).

### Story 4.4: Tactics — the order you give your army

As a player,
I want to set my army's tactic and see the enemy's at reveal,
So that a second strategic axis joins picks and placement.

**Acceptance Criteria:**

**Given** FR34 and the amended FR7/FR9
**When** the targeting pipeline is rewritten
**Then** it is the fixed two-step: ① legal-target list — melee filtered by reach with the **Last Stand** fallback (empty list → out-of-reach enemies become legal); ranged/magic take the whole living enemy grid — ② tactic over the list: Autonomous = today's priorities (melee facing→center→left; ranged rearmost-first), Weakest/Strongest by **absolute current HP** with ties falling back to Autonomous priority (no new randomness — FR20), Attack Leader = the enemy leader when legal, else Autonomous until the path clears; a tactic never expands melee reach; Mage blast / Witch prefer-unafflicted / heals behave exactly per the dossier's tactic-interaction rules.

**Given** placement
**When** I commit
**Then** I pick my tactic via the spine-extension picker, it stays hidden until reveal (FR5), the reveal shows both tactics (FR6), and the AI commits its own tactic from its stream with no knowledge of mine (FR24).

**Given** rules changed without data changing
**When** the story ships
**Then** `balanceVersion` bumps anyway (same setup must not silently replay differently — AD-8), goldens are re-recorded, every pipeline branch has unit tests, and the both-mode sweep — now sweeping tactics as a dimension — stays inside the ≤65% band **and shows the melee-witch wasted-swing floor improving** (the carried-in wardens-33% check).

### Story 4.5: The squad leader

As a player,
I want to crown a leader my opponent will hunt,
So that protecting — and hunting — a leader becomes part of the read.

**Acceptance Criteria:**

**Given** placement
**When** I designate my leader
**Then** exactly one unit is crowned via the spine-extension UI, any army mutation clears the designation (AD-9 invariant, surfaced honestly in the UI), the choice is hidden until reveal, and the reveal marks both leaders (FR6); the AI designates its own with seeded variation — not always unit 0 (FR24).

**Given** a side's leader dies
**When** the engine resolves on
**Then** a leader-death/penalty-state event is emitted (AD-12), that side's tactic reverts to the dossier's penalty tactic for the rest of the battle, and its units take the named, versioned physical attack/defense reduction (FR35); Attack Leader on the other side falls back per FR34; the battle scene renders the crown and the penalty onset visibly from the event.

**Given** History
**When** a squad-era entry renders
**Then** the card displays each side's tactic and leader from the stored setup (FR28, UX-DR10) — both choices exist from this story on, so the display lands here.

**Given** the tests
**When** CI runs
**Then** penalty math, event emission, and tactic reversion are unit-tested, judging symmetry still holds, `balanceVersion` bumps, and the sweep — leaders now a dimension — stays inside the band.

### Story 4.6: Crits and dodge

As a player,
I want attacks that can crit, miss, or be dodged,
So that DEX matters and battles carry earned drama.

**Acceptance Criteria:**

**Given** the dossier's numbers and frozen draw table
**When** an attack resolves
**Then** crit and dodge/miss are seeded per-attack draws on the `battle` stream in EXACTLY the frozen order and count (multi-target blasts fanning out per target in target order — AD-10), chances keyed to DEX per FR36, the magic-crit rule enforced, integer math and FR15's rounding order preserved.

**Given** the outcomes
**When** events are emitted
**Then** attack events carry `crit`/`missed`/`dodged` (union members since 4.2, now emitted), and the battle scene and Log panel narrate each distinctly — crit emphasis and miss/dodge reads per the spine extension, numbers ≥ 14px (UX-DR3/6).

**Given** determinism
**When** a battle replays
**Then** crits and misses reproduce from the seed alone — zero per-hit storage (FR20); property tests pin seed identity, goldens are re-recorded, `balanceVersion` bumps, and the both-mode sweep confirms dodge hasn't broken the band.

### Story 4.7: Per-row moves and Guard

As a player,
I want a unit's row to change what it does, not just how often,
So that placement decides behavior — the deepest placement read yet.

**Acceptance Criteria:**

**Given** the dossier's move table
**When** it lands in balance data
**Then** each class/row resolves the specified move kind (e.g. front Mage weak Staff Attack, back Knight Shield Cover — the table is data, not code), action events carry the move-kind identifier (AD-12), and the Guard mechanic behaves exactly as the dossier decided (raised mitigation for the engagement or negate-one-attack), including its FR14 role-relation interaction, with Guard outcomes emitted as their union events.

**Given** the player surfaces
**When** the story ships
**Then** draft spec cards and Help/rules.md show per-row moves (FR2, drift guard green), and the battle scene renders distinct move kinds visibly (a Guard read differently from an attack).

**Given** the discipline
**When** CI runs
**Then** every move rule has unit tests, goldens re-record, `balanceVersion` bumps, and the both-mode sweep stays in the band.

### Story 4.8: Monsters in the engine

As the game's developer,
I want dragons and golems fighting correctly in the pure engine,
So that the monster era is proven deterministic before any pixel renders.

**Acceptance Criteria:**

**Given** FR38 and AD-14
**When** monsters land
**Then** dragon and golem enter balance data (2-slot cost, size class, stats, roles), a monster is one unit — one `side:index` id, anchor = front-most cell, footprint derived via engine-exported `footprintCells` (anchor `back` illegal, never horizontal, max 2 per army, never sharing a column) — and `legalAnchors`/`canPlace` share their implementation with `validateMatchSetup` (one legality implementation), each violation a typed, tested validation error.

**Given** the dossier's two-cell semantics
**When** battles resolve
**Then** row-blast counting, melee nearest-row blockade, ranged rearmost eligibility, reach from a two-cell origin, the acting row (action count + move-kind), and FR13's tie-break for a two-row body all behave exactly as designed, every event referencing the unit id, never a cell (AD-14).

**Given** the AI and harness
**When** they run
**Then** archetypes cover 1-monster and 2-monster compositions, the sim sweeps them in both modes inside the ≤65% band, exhaustive unit tests cover each semantic, property tests hold over monster armies, goldens include monster battles, and `balanceVersion` bumps.

### Story 4.9: Monsters on the phone

As a player,
I want to draft a dragon and watch it loom over two cells of my grid,
So that the squad era is visible, not just simulated.

**Acceptance Criteria:**

**Given** Draft
**When** I compose
**Then** monster cards show their 2-slot cost, the running budget reads in slots ("3 / 5 slots"), and every FR1 combination is draftable (5 smalls; 1 monster + 3; 2 monsters + 1).

**Given** Placement
**When** I drag a monster
**Then** two-cell footprint feedback comes live from the engine's `legalAnchors`/`canPlace` (AD-14, UX-DR4) — illegal anchors visibly rejected before the drop, no drop ever lost — and leader designation and tactic selection work unchanged with monsters in the army.

**Given** Reveal, Battle, and History
**When** monsters render
**Then** a monster occupies both its cells visually per the spine extension (sprite proportionally large, HP bar and status per unit — one unit, not two), and History cards render monster compositions correctly.

**Given** FR31 and NFR1
**When** the art lands
**Then** dragon and golem sprites come from free/CC packs with idle/attack/hurt/death coverage, the attribution manifest and Credits update, the bundle stays within budget, and the full loop with monsters on both sides is played on device.

### Story 4.10: Attacks read from→to

As a player,
I want to see who attacks whom — melee steps in, arrows arc, heals trace,
So that battles read as cause and effect.

**Acceptance Criteria:**

**Given** the battle scene
**When** any action plays
**Then** melee units visibly move to their target and return, and projectiles, blasts, heals, and spells trace origin→target across the clash gap (FR39d), driven purely by event payloads (AD-2), beats ≥ 300 ms, reduced-motion damping flourishes while preserving the beats (UX-DR6).

**Given** the busiest monster battle on a Pixel 6a-class phone
**When** the animation plays
**Then** it sustains the 60 fps target / 30 floor against the measured baseline (NFR1).

**Given** the FR39g pause control
**When** this story is scoped
**Then** it is explicitly dropped for wave 1 (PO decision 2026-07-16) — speed and skip remain the pacing controls; revisit post-wave.

### Story 4.11: The action ledger and informed placement

As a new player,
I want to see who acts, how often, and why — during battle and before it,
So that action economy is understandable without ever having seen OB64.

**Acceptance Criteria:**

**Given** Placement
**When** I position a unit
**Then** per-row action counts are surfaced per the spine-extension design (FR39c) — "Mage: back row 2×, front row 1×" — so positioning is an informed choice.

**Given** Battle
**When** the ledger renders
**Then** it implements the 4.1 spine-extension design (FR39b — the PO-flagged key display problem): each unit's actions this Turn, used and remaining, resetting on `PassStarted`, fed strictly from the union's ledger payload plus AD-2's static facts — the scene derives nothing — fitting the locked HERO layout without crowding the boards (UX-DR5), in both themes at the type floors (UX-DR2/3).

**Given** the deliverable
**When** the story closes
**Then** Danilo signs off on-device that a new player can follow who acts, how often, and why — the epic's readability gate.

### Story 4.12: The squad-era balance verdict

As a player,
I want the twelve-class squad era tuned and certified,
So that no composition, tactic, or monster dominates and the game stays fun.

**Acceptance Criteria:**

**Given** NFR4's scaling pass (PRD Open Item 5)
**When** the harness is scaled
**Then** the archetype pool and run budget cover 12 classes × tactics × leaders × monster compositions, the harness stays a dev CLI in `packages/engine`, and both-mode sweeps complete in a workable budget.

**Given** the sweeps
**When** they run
**Then** no archetype exceeds the ≤65% aggregate band in either mode, the melee-witch wasted-swing floor is re-checked against 3.0's wardens baseline (tactics should have fixed it), and 10-engagement wipeout compounding (poison, blast attenuation) is verified (FR19).

**Given** tuning changes
**When** they land
**Then** each bumps `balanceVersion` with hash re-pin and re-recorded goldens, and `docs/rules.md`/Help reflect final numbers (drift guard green).

**Given** the tuned build on the production URL
**When** Danilo plays real matches on his device
**Then** felt balance is accepted — squads, tactics, leaders, monsters, crits all feel fair and fun — and performance is re-verified against the baseline with the post-monster asset load; the on-device sign-off closes the epic.
