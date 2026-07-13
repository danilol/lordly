---
title: "PRD: Lord Battle Tactics"
status: final
created: 2026-07-11
updated: 2026-07-13
---

# PRD: Lord Battle Tactics

*Slug: `lordly`. Upstream: [Product Brief](../../briefs/brief-lordly-2026-07-11/brief.md) (approved 2026-07-11). Companion: [addendum.md](addendum.md) holds OB64 reference research, rejected alternatives, and architecture input.*

## 1. Executive Summary

Lord Battle Tactics is a browser-based 1v1 strategy duel that distills the automated squad combat of Ogre Battle 64 (OB64) into a five-minute match playable on a phone. Each player secretly drafts 3 units from 6 classes and places them on a 3×3 formation grid. Boards reveal simultaneously and an animated auto-battle resolves the match — all skill is spent *before* the clash, in class picks and placement reads.

**MVP:** a complete, fun match against an AI opponent in an Android mobile browser, shipped as a PWA. **Second epic:** 1v1 with a friend via shareable link. This PRD specifies the MVP and states requirements so the link-play epic needs no rework (notably: a deterministic battle engine).

This is a passion project with a second agenda: the game is built AI-first through the BMAD method with no hand-written code, which elevates automated testing and documentation from hygiene to survival — the test suite is how a human verifies code they didn't write.

## 2. Goals & Success Criteria

1. **It's fun on the phone.** A full match (draft → placement → battle → result) plays smoothly in a mobile browser and the creator genuinely enjoys it. Gold signal: a friend asks for a rematch unprompted.
2. **The triangle matters.** Class picks and placement visibly decide outcomes; no composition dominates casual play. Counter-metric: the game must not become pure counter-picking either — placement reads must be able to beat a superior draft.
3. **The AI is worth beating.** It punishes lazy formations but is beatable with a good read. `[ASSUMPTION: a reasonable player wins roughly half their matches against it after a few games]`
4. **Match length under ~5 minutes**, bus-stop compatible. Counter-metric: the battle animation must be long enough to *watch and enjoy* — the payoff is the show. `[ASSUMPTION: battle animation lands in the 30–90 s band]`
5. **The link works cold** *(gate for the second epic, not the MVP)*: a friend with no explanation completes a 1v1 match from a bare shared URL.
6. **BMAD proves out.** Brief → PRD → architecture → epics → sprints, no hand-written code, with a test suite and documentation the creator trusts.

## 3. Players

**Primary:** the creator and his friends — strategy fans with Android phones, appetite for "one more round," zero tolerance for installs or accounts. **Secondary (if it goes public):** the OB64 nostalgia community and lapsed auto-battler players burned out on shop RNG and 30-minute lobbies. No accounts, no personal data: a player is just a browser.

### The match journey

Danilo opens the game at a bus stop. Tap **Play vs AI** → the draft screen shows six class cards; he taps Knight, Knight, Mage. Placement: he drags both Knights to the front row (left and center) and tucks the Mage in the back-center, betting the AI leads with Archers. Tap **Ready** → both boards flip face-up — the AI brought Archer/Archer/Cleric. His read was right: the reveal already tells him he's ahead. The battle plays out like a tiny OB64 clash: his Knights charge, arrows fly, the Mage's blast scorches the enemy back row; damage numbers pop. Banner: **Victory — 61% vs 18%**. He taps **Rematch** before the banner finishes animating. Total elapsed: under five minutes.

## 4. Functional Requirements

Requirements carry stable global IDs (FR1, FR2, …). Numbers in stat tables are **initial tuning values** — they will change during balancing without a PRD revision; the *rules* are the requirements. `[ASSUMPTION]` marks inferred decisions awaiting playtest or review.

### Feature 1 — Draft

- **FR1.** Each player composes an army of exactly **3 units** chosen from the **6 classes**; duplicates allowed (56 possible compositions). Both players always field the same army size.
- **FR2.** The draft screen presents each class with name, sprite, and a compact rules card (role, RPS relation, per-row behavior) — enough that a first-time player can draft without a tutorial.
- **FR3.** As each unit is added to the army, it is assigned a **random element** — **Fire, Water, Wind, or Earth** — drawn from the seeded generator (FR20). The owner sees the roll immediately (before placement, so the formation can adapt to it); the opponent sees it only at reveal. A Witch's prepared spell is fixed by her element (FR16). For every other class the element is displayed but has **no combat effect in the MVP** — it is the visible groundwork for the post-MVP elemental-affinity wheel (Out of Scope). `[ASSUMPTION: elements re-roll every match, rematches included — deliberate draft variance]`

### Feature 2 — Placement

- **FR4.** Each player places their 3 units on their own **3×3 grid** — rows **front / middle / back**, columns **left / center / right** — via touch drag-and-drop. Any arrangement of the 3 units is legal.
- **FR5.** Placement is **hidden and simultaneous** (Battleship-style). Neither the opponent's composition nor placement is visible until both players have submitted. The AI opponent must commit its choices without reading the player's (FR24).
- **FR6.** On both submissions, a **reveal** shows the two boards face to face before combat begins.

### Feature 3 — The Battle Grid: how units fight

*This section is the definitive description of targeting. It is deliberately exhaustive — it doubles as the rules reference for players, tests, and the AI.*

The two grids face each other: front rows adjacent, and each column directly faces one enemy column (a mirrored pairing — your left column faces the enemy's right, which the battle scene renders as one straight lane). "Facing column" below means that lane.

- **FR7. Reach (column adjacency).** A unit can act on enemies in its facing column and the columns adjacent to it. A **corner-column** unit reaches two enemy columns; a **center-column** unit reaches all three. This applies to Knights, Mercenaries, Archers, and the Witch. The Mage's row-blast and the Cleric's healing ignore reach (FR10, FR11).
- **FR8. Melee targeting (Knight, Mercenary) — nearest, no bypass.** Among reachable enemies, only those in the **nearest occupied row** are eligible: a living front unit shields reachable middle- and back-row units behind it. From eligible targets, pick by priority: ① facing column, ② column closer to center, ③ left over right. Each attack re-evaluates — if the first swing kills the target, the second swing picks the next eligible enemy.
- **FR9. Ranged targeting (Archer) — rearmost first.** Among reachable enemies, only those in the **rearmost occupied row** are eligible — arrows arc over the front line to snipe the artillery, exactly the OB64 counter-logic (Archer beats Mage). Column priority and re-evaluation as in FR8.
- **FR10. Row blast (Mage).** Each cast strikes **every unit in one enemy row**, ignoring column reach. Target row = the row with the most living enemies; tie broken toward the **rearmost** row. Damage applies to each unit in the row, with RPS modifiers per target.
- **FR11. Healing (Cleric).** Each heal restores HP to the **living ally with the lowest HP percentage** (the Cleric herself included), ignoring reach, never exceeding max HP. If no ally is damaged, the Cleric instead makes a weak **STR-based staff attack** using magic targeting (rearmost reachable, as FR9) — her STR is deliberately tiny (FR15).
- **FR12. Status casting (Witch).** Each cast applies her prepared spell (FR16) to one enemy by magic targeting (rearmost reachable, as FR9), preferring targets not yet affected by that spell. She deals no damage.
- **FR13. Initiative — the Agility timeline.** Combat runs in **passes**. In each pass, every living unit that still has actions remaining (per-row counts, FR15) takes **one** action, in descending **AGI** order across both armies — the timeline weaves between the two sides, OB64-style. Multi-attack units split their attacks across passes (the "multihit split"): a front-row Knight swings once on his AGI turn, faster and slower units act, and his second swing lands on the next pass. Passes repeat until every action is spent. Ties: equal AGI → front row before back, then left before right, then a seeded coin flip across players per engagement. Dead and sleeping units lose unspent actions. Damage and effects apply immediately, in sequence. `[ASSUMPTION: class AGI values (FR15) are tuned so the natural order is Witch → Archer → Mercenary → Mage → Cleric → Knight — disruptors strike first, heals answer damage late, and the heavy tank hits last but survives to do it]`

### Feature 4 — Classes

- **FR14. The RPS triangle.** **Mage beats Knight, Knight beats Archer, Archer beats Mage.** An attack with class advantage deals **×1.5** damage; with disadvantage, **×0.75**. Mercenary, Cleric, and Witch sit outside the triangle (×1.0 both ways). `[ASSUMPTION: 1.5/0.75 multipliers — first balancing lever]`
- **FR15. Attributes & class table.** Every unit carries the six OB64 attributes. At MVP the values are **fixed per class** — no leveling or growth; the attribute model exists so the post-MVP leveling hook slots in without a rebalance from scratch:
  - **STR** — physical damage dealt (Knight, Mercenary, Archer attacks; Cleric's staff bonk)
  - **VIT** — physical mitigation
  - **INT** — magic damage (Mage blast) and healing power (Cleric)
  - **MEN** — magic mitigation
  - **AGI** — initiative on the timeline (FR13)
  - **DEX** — **reserved**: accuracy, evasion, and crits are post-MVP; in the MVP every attack hits and nothing crits `[ASSUMPTION: misses are too swingy in a 3-unit battle]`

  Combat formulas `[ASSUMPTION — the first balancing levers]`: physical hit = `STR − VIT(target)/2`; magic hit = `INT − MEN(target)/2`; both then apply RPS (FR14), minimum 1 damage. Heal = `INT × 1.25`. All combat arithmetic is **integer math**: every division and multiplier result rounds down, in a fixed order (base → RPS → status modifiers) — required for FR20's tick-for-tick determinism across devices.

| Class | Role | HP | STR | VIT | INT | MEN | AGI | DEX | Actions front/mid/back | Behavior |
|---|---|---|---|---|---|---|---|---|---|---|
| **Knight** | Front-line tank | 140 | 30 | 28 | 8 | 14 | 8 | 16 | **2** / 1 / 1 | Melee (FR8); beats Archer |
| **Mercenary** | Neutral sellsword | 110 | 26 | 20 | 10 | 14 | 14 | 18 | **2** / 1 / 1 | Melee (FR8); no RPS relation |
| **Archer** | Back-row sniper | 90 | 24 | 12 | 10 | 12 | 22 | 24 | 1 / **2** / **2** | Ranged (FR9); beats Mage |
| **Mage** | Row artillery | 80 | 6 | 8 | 30 | 22 | 12 | 14 | 1 / 1 / **2** | Row blast (FR10); beats Knight |
| **Cleric** | Support | 90 | 8 | 12 | 24 | 24 | 10 | 12 | 1 / 1 / **2** | Heal (FR11) |
| **Witch** | Control | 85 | 6 | 10 | 26 | 20 | 26 | 16 | 1 / 1 / **2** | Status (FR12) |

  The distribution follows the OB64 archetypes: heavy melee stacks STR/VIT and pays for it with the worst AGI (hits last, but survives to hit); the skirmisher Archer runs high AGI/DEX on a thin VIT frame; casters carry high INT/MEN and near-useless STR/VIT; the Witch is the fastest unit on the field so her control lands before targets act. `[ASSUMPTION: all values are initial tuning numbers, sized so a unit falls in ~3–5 neutral hits (OB64-calibrated); they live in a data file, not code, and change freely during balancing]`

- **FR16. Witch spells — keyed to her element** (FR3); effects last the current engagement:
  - **Water → Sleep** (slumber mist) — target loses all remaining actions this engagement.
  - **Earth → Poison** (toxic spores) — target takes 15 damage at the end of the engagement, applied before FR18 judging. In until-wipeout mode, at the end of *each* engagement.
  - **Fire → Weaken** (searing fatigue) — target's damage is halved.
  - **Wind → Confusion** (mind-scrambling gale) — each of the target's actions has a 50% chance (seeded, FR20) to misfire. A misfired action turns on the confused unit's own side: an attack strikes a random living ally of the confused unit (a confused Mage blasts its own fullest row); a confused Cleric heals a random living enemy instead; a confused Witch applies her spell to a random living ally. If no valid misfire target exists, the action fizzles and is spent.
  - Same spell does not stack on one target; a second application is wasted. `[ASSUMPTION: the element→spell mapping is a flavor pairing, swappable during UX]`

### Feature 5 — Battle Resolution

- **FR17. Single engagement (MVP mode).** Every unit spends its per-row action count (FR15) once, in initiative order (FR13). When all actions are spent, the engagement — and the match — ends.
- **FR18. Judging.** Instant win if the enemy army is wiped. Otherwise the winner is the side with the **higher percentage of its total starting HP remaining**. An exact tie is a **draw**, with rematch offered.
- **FR19. Until-wipeout mode (stretch, ship only if cheap).** Engagements repeat until one side is wiped. Between engagements all statuses clear **except poison**, which persists for the rest of the battle and deals its damage at the end of every engagement (the brief's intended Witch-in-wipeout synergy). Anti-stalemate: after **5 engagements**, judge by FR18. `[ASSUMPTION: cap value]`
- **FR20. Determinism.** A battle is a pure function of (both compositions with their rolled elements, both placements, one random seed). The same inputs always produce the identical battle, tick for tick. All randomness (confusion, coin flips) draws from the seeded generator. *This is a product requirement, not just an engineering nicety: it makes battles unit-testable, replayable from history, and server-verifiable in the link-play epic.*

### Feature 6 — Battle Presentation

- **FR21.** The battle plays as an **animated OB64-style scene**: the two formations face off in lanes, units step/shoot/cast in initiative order, damage numbers pop, HP bars deplete, status effects show icons, deaths are visible. Indirect control is the fantasy — the player watches their plan work. The camera perspective (OB64's nostalgic isometric vs. a simpler side-on view) is a UX-phase decision; the requirement is that both grids and every action read clearly on a phone screen.
- **FR22.** The result screen declares the winner with both final HP percentages, shows both compositions, and offers **Rematch** (one tap, straight to a fresh draft) and **Home**.
- **FR23.** A battle-speed control (at minimum: normal / fast ×2) and a skip-to-result affordance. `[ASSUMPTION: watching is the payoff, but rematch grinding needs fast-forward]`
- **FR31. Art direction.** All visuals come from **free/CC fantasy pixel-art sprite packs** (itch.io, OpenGameArt, Kenney) — retro, OB64-adjacent feel with zero custom art production in the MVP. Every unit needs at minimum: idle, attack/cast, hurt, and death representations (frame animation or tween-based). License attributions are tracked in the repo and shown on an in-game credits screen.

### Feature 6b — Position-dependent move variety (post-MVP, Epic 4)

- **FR32. Per-row move variety.** For a class whose row already varies its *action count* (FR15), the row may also vary the *kind* of action taken, not just how many. Illustrative examples volunteered by the creator (not exhaustive — the full per-class table is an Epic 4 design task): a Knight in the front row throws 2× a melee "Sword Slash" (today's FR8 behavior); in the back row it instead performs a defensive move ("Shield Cover") in place of attacking. A Mage in the front row makes a weak physical "Staff Attack" instead of its row blast (mirroring the Cleric's existing no-target fallback, FR11); in the back row it casts its full row blast (FR10) at increased frequency. `[ASSUMPTION: the complete per-class, per-row move table — including Archer/Cleric/Witch variants — is undesigned; Epic 4 scoping defines it]`
- **FR33. Defensive move type ("Guard").** At least one class/row combination (e.g. back-row Knight) substitutes an attack action for a new defensive action category not present in the MVP ruleset: raising the unit's damage mitigation for the remainder of the engagement, *or* negating one incoming attack outright. `[ASSUMPTION: which of the two mechanics — or both — is undecided; this is the core new-mechanic design question for Epic 4, including its interaction with RPS (FR14) and the engine's closed BattleEvent union (AD-12)]`

### Feature 7 — AI Opponent

- **FR24.** The AI plays by the exact rules a human does: it commits a composition, placement, and Witch spells with **no knowledge of the player's hidden choices**.
- **FR25.** The AI selects from a pool of curated strategies (composition + formation archetypes) with seeded variation, so it doesn't repeat the same board every match and punishes lazy formations (e.g., it sometimes brings back-row snipers against everyone-in-front). `[ASSUMPTION: single difficulty at MVP targeting Goal 3's ~50% win rate; pool of ~8–12 archetypes at launch, validated with the NFR4 harness; difficulty tiers post-MVP]`
- **FR26.** AI decision time is imperceptible (< 1 s); it runs fully client-side and offline.

### Feature 8 — Match Flow & History

- **FR27.** Core loop: **Home → Draft → Placement → Reveal → Battle → Result → (Rematch | Home)**, completable end-to-end in under 5 minutes on a phone, no account, no tutorial gate. A compact rules/help screen is reachable from Home and Draft (content = Features 3 & 4 rules, player-worded).
- **FR28.** **Battle history:** the last **10** match results persist on-device (winner, both compositions, date, seed). No backend. History screen reachable from Home. `[ASSUMPTION: storing the seed alongside compositions makes past battles replayable via FR20 — cheap and delightful]`

### Feature 9 — Platform Shell

- **FR29.** The game ships as a **PWA**: installable to the Android home screen, served over HTTPS, **fully playable offline** for vs-AI once loaded.
- **FR30.** Mobile-first **portrait** layout for phone screens (~360×640 CSS px and up); all interactions touch-native (tap, drag); a desktop browser gets a functional, centered layout without extra work. `[ASSUMPTION: portrait primary — draft cards and stacked grids fit it naturally]`

## 5. Non-Functional Requirements

- **NFR1. Performance.** Playable at a smooth frame rate (target 60 fps, floor 30) on a mid-range Android phone (~2022, e.g. Pixel 6a class) in Chrome; initial load ≤ 5 s on 4G; total bundle small enough to make that true.
- **NFR2. Quality & tests — first-class, per the creator's explicit directive.** Since no code is written by hand, the test suite is the trust anchor:
  - The battle engine is a **pure, Phaser-free TypeScript module**; every battle rule in Features 3–5 (reach, blockade, targeting priority, row counts, RPS, statuses, initiative, judging, determinism) is covered by automated unit tests — the FR text is the test spec.
  - Property-level guarantees tested explicitly: every battle terminates; judging is symmetric (swapping players swaps the result); same seed → identical battle log.
  - Golden-battle snapshot tests guard against regressions when tuning numbers change *rules* by accident.
  - CI runs the full suite on every change; a red suite blocks merge. `[ASSUMPTION: coverage gate ≥ 90% lines on the engine package]`
- **NFR3. Documentation — first-class.** The repo carries: a README that gets a stranger to a running game in minutes; a **rules document** generated from/aligned with Features 3–5 (doubles as in-game help content); architecture decision records for load-bearing choices; and doc comments on the battle engine's public API and every exported module.
- **NFR4. Balancing instrumentation.** Stats (FR15) live in a data file, not code. A headless AI-vs-AI simulation harness can sweep compositions to flag dominant strategies — cheap given FR20, and the tool for Goal 2.
- **NFR5. Privacy & compliance.** No accounts, no personal data, no tracking, no monetization. The only persistence is local device storage (FR28).
- **NFR6. Forward compatibility.** The engine API treats "two submitted boards + seed → battle log" as its contract so the link-play epic swaps the AI for a remote opponent without engine changes; army size is a parameter (3 now, 5-slot era later).

## 6. Out of Scope (MVP)

- Link-play 1v1 (second epic — Node.js/WebSocket, room links, server-authoritative via FR20)
- World map, unit movement, strongholds
- **Attribute growth** — leveling, stat gains, promotions (the FR15 attribute model is their landing zone)
- **Elemental-affinity wheel** — Fire↔Water and Earth↔Wind damage interactions building on FR3's rolls
- **DEX mechanics** — accuracy, evasion, critical hits
- Items, equipment
- Accounts, rankings, matchmaking, monetization
- Native Android packaging
- Tactics orders (Autonomous / Attack Strongest / Weakest / Leader — parked, see addendum)
- **Parries** (paired with the DEX mechanics)
- **Squad-leader mechanics** (leader unit, leader-death rout — a 5-slot-era candidate)
- Additional classes and 5-slot squads (top post-MVP priority)
- **Position-dependent move variety (FR32/FR33)** — per-row move-*kind* variation building on FR15's per-row action *counts*; landing zone: Epic 4 (post-MVP).

## 7. Open Items

1. **Balance numbers** (FR14–FR16) are unproven until the NFR4 harness and playtests run — expected to change; not a phase blocker.
2. **Until-wipeout mode** (FR19): the UI-exposure decision is made — when story 1.10 ships, mode is a real player-facing choice (Standard vs. Wipeout), not a dev-only toggle. Whether 1.10 itself lands in MVP scope or ships after remains the epic-planning call; single-engagement stays the default either way.
3. **Battle speed/skip default** (FR23): watch first-time vs. grind behavior in playtests.
4. **Fifth-class-era point budgets, tactics orders, large monsters:** parked in the brief addendum's post-MVP roadmap; not PRD concerns.
5. **Position-dependent move variety (FR32/FR33):** the full per-class per-row move table and the exact Guard mechanic are undesigned — a design pass at Epic 4 scoping, not a current-epic concern.

## 8. Glossary

- **Match** — one full loop: draft → placement → reveal → battle → result.
- **Battle** — the automated combat between the two revealed boards; one engagement in the MVP mode, several in until-wipeout mode.
- **Engagement** — one complete spending of every unit's actions (FR15 row counts), resolved on the initiative timeline.
- **Pass** — one sweep of the initiative timeline in which each living unit with actions remaining takes exactly one action (FR13).
- **Action** — a single attack, blast, heal, or cast.
- **Facing column** — the enemy column directly across the battlefield lane from a unit's own column (FR7).
- **Reach** — the set of enemy columns a unit may act on: its facing column plus adjacent ones (FR7).
- **Element** — Fire, Water, Wind, or Earth; rolled per unit at draft (FR3); determines the Witch's spell, cosmetic otherwise in the MVP.
- **RPS** — the class triangle Mage > Knight > Archer > Mage and its damage multipliers (FR14).
- **Judging** — deciding the winner when both sides survive: higher percentage of starting team HP remaining (FR18).
- **Seed** — the single random source a battle is replayed from (FR20).
