---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md
  - docs/planning-artifacts/prds/prd-lordly-2026-07-11/addendum.md
  - docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md
---

# Lord Battle Tactics - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Lord Battle Tactics, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Each player composes an army of exactly 3 units from 6 classes; duplicates allowed; both sides always equal army size.
FR2: Draft screen presents each class with name, sprite, and compact rules card — draftable without a tutorial.
FR3: Each drafted unit is assigned a random element (Fire/Water/Wind/Earth) from the seeded generator; owner sees it before placement, opponent at reveal; Witch's spell keys off it; cosmetic for other classes in MVP; re-rolled every match.
FR4: Placement on own 3×3 grid (front/middle/back × left/center/right) via touch drag-and-drop; any arrangement of the 3 units is legal.
FR5: Placement is hidden and simultaneous; nothing visible until both submitted; the AI commits without reading the player's choices.
FR6: On both submissions, a reveal shows the two boards face to face before combat.
FR7: Reach — a unit acts on its facing column and adjacent columns; corner units reach two, center units reach three; applies to Knight, Mercenary, Archer, Witch; Mage blast and Cleric heal ignore reach.
FR8: Melee targeting (Knight, Mercenary) — nearest occupied row among reachable, no bypass; priority: facing column → center-closer → left; re-evaluated per attack.
FR9: Ranged targeting (Archer) — rearmost occupied row among reachable; column priority and re-evaluation as FR8.
FR10: Mage row blast — hits every unit in one enemy row, ignoring reach; row with most living enemies, tie → rearmost; RPS per target.
FR11: Cleric heals lowest-HP-% living ally (self included), ignoring reach, capped at max HP; if no ally damaged, weak STR-based staff attack with magic targeting.
FR12: Witch casts her prepared spell on one enemy by magic targeting (rearmost reachable), preferring unaffected targets; deals no damage.
FR13: Initiative — AGI timeline in passes; one action per living unit per pass in descending AGI across both armies; multihit split; ties: front row → left → seeded coin flip; dead/sleeping units lose unspent actions; effects apply immediately in sequence.
FR14: RPS triangle — Mage > Knight > Archer > Mage; advantage ×1.5, disadvantage ×0.75; Mercenary/Cleric/Witch neutral.
FR15: Six fixed per-class attributes (STR/VIT/INT/MEN/AGI/DEX); integer-math formulas (phys = STR − VIT/2, magic = INT − MEN/2, min 1, then RPS; heal = INT × 1.25); per-row action counts per the class table; DEX reserved (no miss/crit in MVP); values live in a data file.
FR16: Witch spells keyed to element — Water→Sleep, Earth→Poison (15 dmg end of engagement), Fire→Weaken (damage halved), Wind→Confusion (50% seeded misfire onto own side; fizzle if no valid target); same spell doesn't stack.
FR17: Single-engagement mode — every unit spends its per-row action count once on the timeline; engagement end = match end.
FR18: Judging — wipe = instant win; else higher % of starting team HP remaining; exact tie = draw with rematch offer.
FR19: Until-wipeout mode (stretch) — engagements repeat until wipe; statuses clear between engagements except poison; cap 5 engagements then FR18.
FR20: Determinism — battle is a pure function of (compositions with elements, placements, seed); all randomness from the seeded generator.
FR21: Animated OB64-style battle scene — lanes, initiative-ordered actions, damage numbers, HP bars, status icons, visible deaths; camera perspective is a UX-phase decision; must read clearly on a phone.
FR22: Result screen — winner with both final HP %, both compositions, Rematch (one tap to fresh draft) and Home.
FR23: Battle-speed control (normal / fast ×2 minimum) and skip-to-result.
FR24: The AI plays by human rules — commits composition, placement, spells with no knowledge of the player's hidden choices.
FR25: AI selects from a curated strategy pool (~8–12 archetypes) with seeded variation; punishes lazy formations; single difficulty targeting ~50% win rate.
FR26: AI decision time < 1 s, fully client-side and offline.
FR27: Core loop Home → Draft → Placement → Reveal → Battle → Result → (Rematch | Home) in under 5 minutes, no account, no tutorial gate; rules/help screen from Home and Draft.
FR28: Battle history — last 10 results on-device (winner, compositions, date, seed); replayable via determinism; history screen from Home.
FR29: Ships as a PWA — installable, HTTPS, fully playable offline for vs-AI.
FR30: Mobile-first portrait layout (~360×640 CSS px up), touch-native; functional centered desktop layout.
FR31: Art from free/CC pixel-art packs; idle/attack/hurt/death representations per unit; license attributions in repo and on a credits screen.

### NonFunctional Requirements

NFR1: Performance — 60 fps target / 30 floor on a mid-range Android (Pixel 6a class) in Chrome; initial load ≤ 5 s on 4G; bundle sized accordingly (spine: ≤ 3 MB compressed initial, atlas-packed sprites).
NFR2: Quality & tests — engine is a pure Phaser-free TS module; every battle rule covered by unit tests; property tests (termination, judging symmetry, seed identity); golden-battle snapshots; CI blocks red; ≥ 90% line coverage on the engine package.
NFR3: Documentation — README quickstart; rules document aligned with PRD Features 3–5 doubling as in-game help; ADRs for load-bearing choices; doc comments on engine exports.
NFR4: Balancing instrumentation — stats in a data file; headless AI-vs-AI simulation harness sweeping compositions to flag dominant strategies.
NFR5: Privacy — no accounts, no personal data, no tracking, no monetization; localStorage only.
NFR6: Forward compatibility — engine treats "two boards + seed → battle log" as its contract; army size is a parameter (3 now, 5-slot era later); link-play swaps the opponent without engine changes.

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

### UX Design Requirements

No UX design contract exists yet. Open UX decisions carried as design notes in stories: camera perspective for the battle scene (FR21 — isometric vs side-on), screen layouts/wireframes, sprite pack selection (FR31). Consider running `bmad-ux` before the presentation-layer epic.

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
FR10: Epic 1 - Mage row blast (engine)
FR11: Epic 1 - Cleric healing (engine)
FR12: Epic 1 - Witch status casting (engine)
FR13: Epic 1 - AGI initiative timeline (engine)
FR14: Epic 1 - RPS triangle multipliers (engine)
FR15: Epic 1 - Attributes, formulas, class table (engine balance data)
FR16: Epic 1 - Element-keyed Witch spells (engine)
FR17: Epic 1 - Single-engagement resolution (engine)
FR18: Epic 1 - HP % judging, draw handling (engine)
FR19: Epic 1 - Until-wipeout mode (stretch story)
FR20: Epic 1 - Determinism (engine + seed streams)
FR21: Epic 2 - Animated OB64-style battle scene
FR22: Epic 2 - Result screen polish
FR23: Epic 2 - Battle speed / skip controls
FR24: Epic 1 - AI blindness (engine AI module)
FR25: Epic 1 - AI strategy pool
FR26: Epic 1 - AI speed/offline
FR27: Epic 1 - Core match loop (help screen lands in Epic 2)
FR28: Epic 3 - Battle history + replay
FR29: Epic 3 - PWA install/offline
FR30: Epic 1 - Mobile-first portrait touch layout
FR31: Epic 2 - CC pixel-art assets + credits screen
FR32: Epic 4 (post-MVP) - Per-row move variety
FR33: Epic 4 (post-MVP) - Defensive "Guard" move type

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

**Future (outside MVP breakdown):**
- Link-play 1v1 via shareable URL — its engine seam (AD-1/AD-3/AD-11) is already fixed; broken down when the epic is scheduled.
- **Epic 4: Position-dependent move variety** — per-row move-*kind* variation per class (FR32/FR33), including a new defensive "Guard" move type. Touches AD-4 (new domain vocabulary), AD-12 (BattleEvent union extension → logVersion bump), and AD-8 (balance-table schema → balanceVersion bump) — a PM/Architect design pass at scoping time, not a Direct Adjustment to Epic 1-3's shipped/planned stories. Broken down into stories when scheduled.

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

The game becomes a true pocket game: installable, fully offline, verified against the performance budget — and it remembers. Covers FR28, FR29, and NFR1 verification.

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
