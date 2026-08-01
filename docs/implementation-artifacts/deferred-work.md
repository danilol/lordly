# Deferred Work

## Product north-star (PO, Danilo, epic-4 retrospective 2026-07-22) — TEAM PvP BATTLES

- **The idea:** each player builds **3 or more squads** under class constraints that force themed variety (e.g. one magic-leaning, one physical-leaning, one with monsters), then the players fight a **best-of-3 / best-of-5 series** and the series winner is crowned. Lives ALONGSIDE single battles, not replacing them.
- **Why it's cheap to keep alive:** architecturally it's a *series wrapper* around the existing single-battle contract (setup + seed → log) — nothing in Epic 5 (polish) or Epic 6 (link-play) blocks it. The one thing the link-play design pass MUST honor now: the room protocol should not hard-assume "one battle per room" (a room hosting a sequence of battles with per-game squad selection is the future shape).
- **Not scoped for any current epic** — Danilo: "keep this in mind, but we don't need to build it this epic." Surface at the link-play design pass and again at the epic after it.

## Design input (PO + team, epic-4 retrospective 2026-07-22) — EXTENDING THE TACTIC ROSTER beyond OB64's four

- **Status quo ships:** the OB64 four (Autonomous / Attack Leader / Attack Strongest / Attack Weakest) stay as-is for now — Danilo: "we could proceed with these 4 for now. But I think having more strategies would be fun." Attack Strongest is suspected low-value in Lordly (in OB64 it earns its keep via story/loot); leave it — monsters may redeem it ("strongest" = the 300-HP Golem wall).
- **Brainstormed candidates (retro session, recorded for the future tactics story):**
  1. **Hunt the Prey** — each unit prefers targets its role has ×1.5 advantage over (uses the existing `roleRelations` table; teaches the matchup system by watching).
  2. **Silence the Support** — prioritize healers/controllers (Cleric, Witch, Sorceress) before all else; the anti-sustain counter-pick.
  3. **Break the Wall** — prioritize monsters/Bulwarks first; situational anti-Golem play.
  4. **Protect the Leader** — the mirror of Attack Leader: guard-capable units shield the leader's column / the army fights cautiously around the crown. The mind-game maker — with tactics now chosen AFTER seeing the enemy board (4.13; symmetric in PvP per the retro decision), this creates the predict-and-counter-pick layer of Danilo's north-star.
  5. **All-Out Attack / Hold the Line** — army-wide stance multipliers (×5/4 dealt & taken, or ×3/4 both); mechanically the `leaderPenaltyPhysical` wrapper shape from 4.5, but a new MECHANIC (more balance work), strongest in best-of-N team battles.
  6. **Spread Fire** — never double a target while fresh enemies remain; the anti-Cleric distribution play.
- **Shortlist:** Hunt the Prey + Protect the Leader (one rewards roster knowledge, one creates the counter-pick meta; both gain value in PvP → natural home near the link-play era).
- **Danilo's named BALANCE CONSTRAINT for the design pass:** information-rich tactics must not become the auto-pick. His candidate lever: **reach limits** — e.g. a tactic-directed unit may only pick targets in its own column + adjacent columns (instead of the full legal list), so smarter targeting trades off against reach. The melee blockade (front shields back) stays inviolable regardless. Any addition = `balanceVersion` tick + tactics-as-dimension sweep (machinery exists since 4.4).
- **UX ceiling (Sally):** the tactic dropdown reads well at 4–6 options — this is a pick-1-or-2 exercise, not ship-all-six.

## Deferred from: code review of story 4-13-tactics-at-the-face-off (2026-07-20)

- ~~**`RevealScene` double-resolves the battle.**~~ **RESOLVED (story 5.8, 2026-07-29):** Reveal now renders both boards straight off `committedSetup` (`armies`/`placements`/`leaders`) and never resolves — AD-13's "double resolution" is gone and `BattleScene` is the single resolver, on the Fight! tap. No shell-side snapshot was built, so no engine logic is duplicated; the roster↔setup index correspondence Reveal relies on is pinned in `apps/web/test/reveal-roster.test.ts`. Note the citation below drifted: the call was at `RevealScene.ts:109`, not `:81`. Original entry kept for the record. **Reveal double-resolves the battle.** `create()` runs the full `resolveBattle` (`RevealScene.ts:81`) only to read `events[0]` — the tactic-independent `BattleStarted` roster — then any tactic pick nulls the cached log (`MatchFlow.ts` `setTactic`) so `Fight!` pays for a second full resolve in Battle. Pre-existing (Reveal always resolved for the roster), but story 4.13 makes the double-resolve the guaranteed path for every tactic-changer. Battles are pure and fast so the cost is small; the clean fix is to read the initial roster from `committedSetup` (armies + placements) without resolving, so Reveal never resolves at all. Revisit if a perf capture ever flags Reveal→Battle entry.

## Deferred from: code review of story 4-9-monsters-on-the-phone (2026-07-20)

- The DCSS pack's PWA icon assets (`apps/web/public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`) still trace to `dc-mon/vault_guard.png` in `attribution.ts` — the same tile the Golem used to borrow before 4.9 gave it its own dedicated frame. Pre-existing, not caused by this diff (icon generation wasn't touched; the icons were always the Knight tile's provenance, independent of what the Golem points at today). A documentation-accuracy nuance only — revisit if the icons themselves are ever regenerated from different art.

## Product wish / north-star (PO, Danilo, 2026-07-20 device session) — tactics editable DURING battle

- **The goal:** the player can change their army tactic (autonomous / weakest / strongest / leader) **at any time, including mid-battle** — not just before the clash. Danilo's framing: a whole game could exist just around *predicting and reacting* to the opponent's tactic. He is explicitly open to **diverging from OB64** here (OB64 locks the tactic before the fight); brainstorm the mechanic later.
- **The architecture wall (why this is an epic/spike, not a tweak):** the battle is **fully pre-resolved at commit** — `resolveBattle` computes the entire `BattleLog` once from the committed `MatchSetup` (tactics included), and the Battle scene is a **pure log player** that does no combat math (AD-2/AD-13). This is load-bearing for determinism, replay (FR20, byte-identical), history (AD-8), and the perf model. "Change my tactic at engagement 3" therefore means **re-resolving from a mid-battle state**, which the engine does not model (it resolves all-at-once, not re-entrantly from a partial state). Landing this touches the engine's resolution model, replay, and history at once.
- **Design questions to settle first (a future PM/Architect pass or spike):** does a mid-battle tactic change (a) re-resolve the *remainder* from the current engagement forward (needs a re-entrant `resolveFrom(state, tactic)` engine entry point + a `LOG_VERSION`/replay story for "tactic changed at beat N"), or (b) simply restart the battle with the new plan (= edit-then-replay, much cheaper, but not truly "mid-battle")? How does replay record and reproduce a tactic changed at a specific beat? How does the AI react (does its tactic also become live)?
- **Near-term slice shipped separately:** the "forgot my tactic / no way to change it at Reveal" dead-end is fixed by story **4-13** (move the tactic picker entirely to the Reveal screen, editable there before Fight, re-resolve on Fight — see below). That fix is the *pre-battle* half of this goal; the *mid-battle* half is this deferred item. It also carries the first conscious relaxation of the FR5/FR24 "commit blind" pillar (you now choose your tactic AFTER the enemy is revealed) — the design pillar most affected by the eventual mid-battle feature.

## PRD follow-up (from story 4.8's dossier, D-1b, 2026-07-19) — "dragon and golem" wording is stale — RESOLVED (story 5.0, 2026-07-23)

**Both bullets applied as dated amendments:** PRD FR38 superseded to the shipped single-cell king-move model + Golem-only wave 1 (dragon → Epic 5 roster); Open Item 3's two-cell clause marked superseded; the Epic-4 intro/vignette/roster mentions annotated; FR17 gained the Wipeout-default note and FR34 the 4.13 tactic-at-Reveal relaxation; dossier §2 gained its amendment block; spine AD-14 amended (+ the Deferred list's two-cell bullet resolved); epics.md story 4.8 got a shipped-reality note. Original entry kept below for the record.

- `epics.md` Story 4.8's AC and PRD FR38 both still read "dragon and golem." The story-4.1 design dossier (signed off by Danilo 2026-07-17, decision D-1b) narrowed wave 1 to the **Golem only** — dragons and beasts land in a later wave together with their slayer classes. Story 4.8 shipped Golem-only per the dossier and documented the deviation in its own Dev Notes (the same pattern story 4.7 used for the stale "Shield Cover" wording). This entry is the formal pointer so a future `bmad-prd`/`correct-course` pass updates `epics.md`/PRD FR38 to say "Golem (wave 1); dragon/beasts (a later wave, with their slayer classes)."
- **ALSO stale after story 4.8's device revision (2026-07-20): the MONSTER MODEL itself.** FR38 and dossier §2 describe a monster as a **two-cell** unit (front+mid or mid+back) with the "two-cell TARGETED/ACTS semantics" (melee-front / ranged-rear / blast-double-count / acts-from-anchor). Danilo replaced that on device with a much simpler model, approved and shipped: **a monster is a SINGLE-cell unit that costs 2 slots and reserves all 8 king-move neighbors (orthogonal + diagonal) at placement** — no unit may stand beside it. There is no second body cell and no special battle targeting (a monster is just a beefy one-cell participant). The same `bmad-prd`/`correct-course` pass should rewrite FR38 + dossier §2 to this single-cell + king-move rule. (`docs/rules.md` and the engine/tests already reflect the shipped design; only the upstream PRD/dossier/epics text is stale.)

## Deferred from: epic-4 architecture pass (2026-07-16)

- ~~**Landscape battle backgrounds**~~ **RESOLVED (story 5.3):** seed-derived terrain now sits under both boards (Reveal and Battle share the seed, so the face-off and the clash share a place); the FR39f contrast treatment survived the busy ground as this entry required. Never annotated at the time — closed during story 5.8's ledger sweep. Original entry: **Landscape battle backgrounds (PO wish, Danilo, with OB64 reference screenshot):** replace the dark battle backdrop with OB64-style terrain — a field, mountains, rocks — under the floating formation grids. Art/UX wave item, explicitly NOT Epic 4 scope ("note for later"). Interacts with the label-contrast fix (FR39f) — whatever contrast treatment ships must survive a busy background later.
- **Server-side persistence / database:** deferred to the link-play epic (architecture decision, memlog'd). Revisit condition: the first feature needing cross-device or authoritative state. Landing zone: Cloudflare Durable Objects storage / D1 — same platform per AD-7, no second provider.

## Product wish (PO, 2026-07-15) — history rows show OPPONENT TYPE (vs AI / PvP) — deferred to the link-play epic

- Danilo (during story 3.1 review): history should show the battle type — mode AND opponent. The **mode** (Standard/Wipeout) shipped immediately inside 3.1 (display-only; it was already stored in `HistoryEntry.setup.mode`). The **opponent type** is deferred to link-play with a safe-backfill guarantee: PvP does not exist, so every entry written before link-play ships is provably vs AI — "field absent = AI" is a forever-correct default, and adding an `opponent` field to `HistoryEntry` is a spine AD-8 shape amendment that belongs to link-play's design pass (alongside its side-assignment/rooms work). When link-play is scoped, remember: HistoryEntry schema + History row layout (the right edge is reserved for 3.2's Replay button — opponent tag placement must coexist).

## Bug report (Danilo on device, 2026-07-15) — Reveal/Battle iso boards render the player's formation MIRRORED

- **Symptom:** placement front/left + front/center knights + back/left mage renders on the Reveal iso board with the mage on the player's RIGHT — the player's own board reads as a left-right reflection of what they placed, not a rotation. Both boards are flipped consistently (lane pairing and combat are untouched — AD-11 keeps the engine owner-local), so battles look internally coherent but contradict the player's placement intent (FR6 "the reveal shows the two boards face to face").
- **Root cause (diagnosed):** `apps/web/src/flow/battleView.ts` `projection()` (line ~37) maps side A as `{ r: colIndex, c: rowIndex }` — a **transpose** (determinant −1 = reflection), not a rotation. A chirality-preserving mapping is `{ r: 2 − colIndex, c: rowIndex }` for A and `{ r: colIndex, c: 2 − rowIndex }` for B (180°-opposed rigid rotations; A-left still faces B-right across the clash gap, FR7 preserved). Fix surface: `projection()` + `battle-view.test.ts` facing-pair pins + a screenshot check of the `\` layout (labels/HUD anchors use `unitTileCenter`, so they follow automatically). Not caught in 2.2 because device acceptance used near-symmetric comps where chirality is invisible.
- **Routing:** **RESOLVED same day (quick targeted patch, Danilo's call):** `projection()` now maps both sides as rigid rotations (A: `r = 2 − colIndex`; B: `r = colIndex`, `c = 2 − rowIndex`); two CHIRALITY tests added to `battle-view.test.ts` pinning the regression case (player's left column renders screen-left; a facing enemy's left renders on OUR right); all prior invariants (FR7 lane pairing, bijection, bounds) held without re-pinning. 311 tests green. Visual confirmation on Danilo's device after deploy.

## Product wishes (PO, 2026-07-17) — from the story-4.2 device session

- ~~**Hide the 3-letter class codes on the battle/reveal BOARD**~~ **DECIDED AND SHIPPED (story 5.8, 2026-07-29).** Danilo confirmed the direction at 5.8's story creation; the CONFLICT FLAG below was honoured rather than bypassed — the spine was superseded with dated notes (`EXPERIENCE.md` §Epic-4 extension + the Golem clause + the unit-card/tile row, epic-4 `DOSSIER.md` §7, `DESIGN.md`'s FR39f token block re-scoped) in the same story that removed the two `crispText` calls. `unitCodeStyle` survives with exactly ONE consumer, the Reveal soldier NAME. The crown/badge did NOT move: the band the code freed sits inside a loomed monster's silhouette, so that re-lay is logged separately below. Original entry: **Hide the 3-letter class codes on the battle/reveal BOARD — identify by sprite** (Danilo, 2026-07-17, story-4.2 device session: "now that the image is clear and better, we can identify the class by the sprite. So we can remove them"). The 4.0 backing-store fix made sprites crisp enough that the board codes read as redundant chrome to the PO. **CONFLICT FLAG — this needs a UX-spine amendment, not a silent change:** dossier §7 and EXPERIENCE.md's Epic 4 extension explicitly say "the board keeps codes" (the 13px-space rationale), and story 4.0 shipped the FR39f code-contrast treatment (`unitCodeStyle`) specifically FOR board codes. Also interacts with what's landing next: 4.5's leader crown and 4.7's guard marker anchor visually near the code, and 4.9's Golem keeps "one code at the anchor" (D-3c). Route through Sally/PO at the next UX touch (or correct-course if it should ship sooner); if decided, the change itself is small (Reveal/Battle stop drawing `CLASS_ABBREVIATIONS`, `unitCodeStyle` stays for whatever text remains on tiles).
- ~~**Result screen: a battle-stats summary**~~ **RESOLVED (story 5.7, 2026-07-29):** shipped as an OPTIONAL ▸ BATTLE SUMMARY link opening a sheet with per-side totals and LoL-style per-unit damage bars, plus the full per-unit table behind a chip long-press. Pure shell fold over the log, exactly as this entry predicted; engine untouched. Never annotated at the time — closed during story 5.8's ledger sweep. Original entry: **Result screen: a battle-stats summary — damage, blocks, status changes, heals; in total and per character** (Danilo, 2026-07-17, story-4.2 device session: "it would be nice (future)"). Pure shell work by design: the `BattleLog` already carries everything (AD-2 — fold over `UnitAttacked`/`UnitHealed`/`StatusApplied`/`PoisonTicked`, and from 4.6/4.7 the `outcome`/`redirectedFrom` fields add dodges and Guard blocks to the tally), so no engine change is needed. Natural scoping moment: alongside story 4.11's action-ledger work (same "read the log, present the economy" family) or as post-wave polish.

## Product wishes (PO, 2026-07-14) — battle balance & tactics — ALL RESOLVED via `correct-course` (2026-07-14, see `docs/planning-artifacts/sprint-change-proposal-2026-07-14.md`)

- **Mage area damage is too strong — gate the row blast behind an upgrade, OB64-style** (Danilo, 2026-07-14, after playing the 2.2/2.3 animated battles): in OB64 the base mage is single-target and only gains area damage when upgraded to Archmage. Today Lordly's mage blasts a whole row from level zero (FR10), which reads as "too broken" in real matches. Candidate shapes when scoped: base mage single-target with blast as an upgrade/promotion mechanic (a NEW system — nothing like promotion exists in the PRD), or a plain damage/targeting nerf inside current rules. Either way it is an FR10/balance-data change → `balanceVersion` bump + hash re-pin + golden re-records (AD-8 discipline) and an NFR4 sim sweep re-verification (≤65% dominance band). Natural bundle: the archer-vs-casters FR14 item below + the Epic 4 design pass. **RESOLVED via `correct-course` (2026-07-14): split by kind** — the immediate nerf ships as **story 3.0**'s `blastAttenuation` (FR10 amended: per-target ×0.75 after base, before RPS); the OB64 Archmage promotion gating is parked as an **Epic 4** design item (PRD Feature 6b).
- **Knights/mercenaries too weak because there is no target-selection tactic — OB64's attack-weakest/strongest/autonomous is a core battle feature** (Danilo, 2026-07-14): melee currently strikes the nearest reachable enemy (FR8) with no player-chosen approach. The wish: a per-unit or per-army TACTIC (attack weakest / strongest / autonomous, per OB64) chosen at draft/placement, which would both empower melee and add strategic depth. This is a targeting-rules change (FR8/FR9) + a new player-facing choice (UI + `MatchSetup` data → engine API change, determinism/AD-9 discipline) — squarely a design-pass item, and a sibling of Epic 4's position-dependent move variety (FR32/FR33): both change "what a unit does with its action," so they should be designed TOGETHER in Epic 4's PM/Architect scoping pass. **RESOLVED via `correct-course` (2026-07-14):** routed whole into **Epic 4**, widened & renamed "Combat depth — moves, tactics, crits, promotions" (epics.md Future entry + PRD Feature 6b index paragraph); designed together with FR32/FR33 in the PM/Architect pass.
- **Critical hits** (Danilo, 2026-07-14): a crit chance/multiplier on attacks. Engine rules change: a new battle-stream draw per attack (stream-ordering invariant / FR20 replay stability — draws must slot into the documented order), damage formula amendment (FR14/FR15), a `crit` flag on `AttackTarget` so the shell can flash it (AD-12 — that is a `LOG_VERSION` bump, which is ALSO the sanctioned moment to add the deferred `StatusCleared` events from the 2.2 review), balance-data addition (version bump + goldens), and NFR4 sim re-verification. Presentation rides free once the payload carries the flag (bigger/shaking combat number). Bundle with the balance pass above. **RESOLVED via `correct-course` (2026-07-14):** routed to **Epic 4** (DEX's reserved purpose spends there); the crit flag rides Epic 4's single combined `LOG_VERSION` bump together with the deferred `StatusCleared` events — story 3.0 deliberately adds no events.
  - **Miss / dodge — design as the crit's sibling (Danilo, 2026-07-15, during story 3.2 review).** The PRD already reserves DEX for "accuracy, evasion, and crits" (FR15), so a miss/dodge roll is anticipated, not new scope. Same machinery as crits: a seeded `battle`-stream draw per attack (so it replays tick-for-tick — the seed IS the recording, exactly why story 3.2's replay needs no per-hit storage) and an attack-event outcome the shell renders (a `missed`/`dodged` outcome on `AttackTarget`, riding the SAME combined `LOG_VERSION` bump as crit + `StatusCleared`). **Epic 4's design pass MUST decide the draw ORDER explicitly** — crit-roll and hit/miss-roll both consume the `battle` stream per attack; their relative order (and whether a miss short-circuits the crit roll) is a determinism-locking decision that, once shipped, every future seed depends on (FR20). Frame it as attacker-misses vs defender-dodges: mechanically one seeded draw, a flavor/attribution choice (attacker ACC vs defender EVA from DEX). Presentation rides free (a "miss"/"dodge" whiff beat, like the existing confusion-misfire beat).

## Product wishes (PO, 2026-07-12) — to scope in a future planning pass

- **Tech-debt story before epic 2** (Danilo, during story 1.5 planning): before the first epic-2 story starts, insert a dedicated refactoring / cleanup / performance-improvement story. Natural scope inputs when it's created: everything in this file's deferred sections (lint tooling + AST purity guard, vite-config consolidation, template cruft, seed-bound constant dedup, chassis-stub notes), **the blurry-font investigation below**, plus any hotspots the epic-1 retrospective surfaces. Formalize via `correct-course` or at the epic-1 retrospective so it lands in sprint-status ahead of story 2.1.

- **"Nice documentation about the project"** (Danilo, during epic 1). The plan already carries NFR3's artifacts (README, `docs/rules.md` arriving with story 2.4's Help screen, ADRs, engine doc comments) — but the PO wants to go beyond that baseline. Candidate scope to discuss when planned (e.g. via `correct-course` or when epic 2 closes): a proper docs site or polished docs/ index, architecture walkthrough for outsiders, gameplay/rules showcase, screenshots/GIFs in the README, contributor guide. Not a current-sprint concern.

- **Position-dependent move variety per class** (Danilo, after playing the story-1.9 build on Android Chrome — "forgot to add on the project briefing"). Today each class has one attack behavior and only its *action count* varies by row (`BALANCE.classes[cls].actions.{front,mid,back}`, per FR13). The wish: the *move itself* also varies by row — e.g. Knight front row → 2× "Sword Slash" (full melee), mid row → 1× "Sword Slash", back row → 1-2× "Shield Cover" (a defensive move: raise defense or block one attack) instead of attacking; Mage front row → "Staff Attack" (a weak physical poke, since a squishy caster shouldn't be in melee range), mid row → 1× spell cast, back row → 2× spell cast (full caster value from safety). **RESOLVED via `correct-course` (2026-07-13, see `docs/planning-artifacts/sprint-change-proposal-2026-07-13.md`):** formalized as PRD FR32/FR33 and a new post-MVP **Epic 4** stub in `epics.md`; the full per-class per-row table and the exact Guard mechanic remain an open design question for Epic 4's PM/Architect scoping pass.

- **Move names/flavor text per class** (Danilo, same session) — cosmetic layer on top of the above: "Sword Slash" (Knight/Mercenary), "{element} Cast" (Witch/Mage spells), "Sniper Arrow" (Archer), etc., surfaced in the class-selection UI (Draft scene) with a clearer, more highlighted display of what each class does *per row*. Bundles naturally with the position-dependent-move-variety item above — the flavor text is most valuable once the moves actually differ by row, so it rides along into Epic 4 rather than shipping standalone.

- **Battle log visible on the Battle scene** (Danilo, same session) — an expand/collapse panel under the board showing the scrolling text log of what's happening (not just the animated sprites), so a player can review what just occurred. **RESOLVED via `correct-course` (2026-07-13):** added as a new AC on story 2.2 ("The animated battle scene") in `epics.md` — no engine change, reads the scene's existing `BattleLog`.

- **Endless vs. limited-turn match mode** (Danilo, same session) — clarified as: wipeout (or a time limit) as one mode, alongside today's single-engagement/limited-turns mode as the other. **RESOLVED via `correct-course` (2026-07-13):** story 1.10's AC2 amended in `epics.md` to make mode a real player-facing choice (Standard vs. Wipeout) instead of a dev/debug-only toggle — story 1.10 is still `backlog`/unstarted, so no rework needed.

- **Archer should be strong against ALL magical units — mage, cleric, AND witch** (Danilo, 2026-07-13, after losing to a witch comp while playtesting the story-1.10 wipeout build: "we need to make archer good against mage and cleric and witch, so magical units"). Today FR14's triangle gives the archer advantage over the **mage only** (×1.5); cleric and witch sit outside the triangle (×1.0 both ways) — though the archer already counters casters *positionally* via FR9's rearmost-row sniping. This is an FR14 **rules change**, not a number tweak: `BALANCE.rpsBeats` is a one-target-per-class map, so "archer beats three classes" changes the balance-data *shape* (→ `balanceVersion` bump + hash re-pin + golden re-records, AD-8 discipline) and the PRD's triangle definition. Design questions to settle when scoped: one-way advantage (archer deals ×1.5 to casters) vs. full pairs (casters also take ×0.75 disadvantage... i.e. deal less to archer)? Does "beats" stay reciprocal in wording ("Archer beats Mage" already exists — extend or generalize to "Archer beats casters")? And the NFR4 sim harness MUST re-verify the ≤65% dominance band afterward — a 3-class advantage could easily make archer dominant. Worth also checking whether the felt problem is archer weakness or **witch strength** (AGI 26 first-strike + sleep/confusion) — the sim sweep can distinguish. Formalize via `correct-course` (PRD FR14 amendment + a balance story). **RESOLVED via `correct-course` (2026-07-14, see `sprint-change-proposal-2026-07-14.md`):** FR14 amended **one-way** — Archer deals ×1.5 to Mage/Cleric/Witch, no symmetric caster penalty, core triangle unchanged; lands in **story 3.0** with the mandated both-mode sweep re-verification (≤65% band), which also answers the witch-strength question empirically.

- ~~**Font still reads as blurry on Danilo's actual Android device**~~ **ADDRESSED (story 2.0 AC2, reclassified ACCESSIBILITY at the epic-1 retro):** `crispText` is now `devicePixelRatio`-aware (floor `TEXT_RESOLUTION = 3`, `?textres=N` diagnostic override for on-device comparison) and a `MIN_FONT_PX = 10` floor raised the ten 8–9px micro-labels. **Final sign-off = Danilo reading his own phone** (the story's acceptance gate); if it still reads blurry there, reopen with the on-device `?textres` comparison data.

## Deferred from: code review of story-2.2 (2026-07-14)

- **RESOLVED (story 4.2, 2026-07-17).** ~~Status lifecycle rule is duplicated in the shell (sanctioned AD-2 exception — consider `StatusCleared` events at the next `LOG_VERSION` bump).~~ The v4 union (the era's single combined bump) added `StatusCleared {unit, spell}`, emitted at every between-engagement reset; `BattleScene` now removes icons log-driven (`removeStatusIcon`) and `clearStatusIconsExceptPoison()` is DELETED — the sanctioned exception is dead, exactly as this item prescribed. Original record: the event union had no status-expiry events, so the Battle scene's persistent status icons re-stated the engine rule "EngagementEnded sheds every status except poison" in `clearStatusIconsExceptPoison()` — the one place shell rendering would silently desync if the engine rule ever changed.

## Deferred from: code review of story-2.1 (2026-07-13)

- ~~**Normalize the element badge to DESIGN's dot-only compact unit-card across all scenes.**~~ **RESOLVED — and it had already happened (story 5.8, 2026-07-29).** The element WORDS this entry asked to drop left with the card-width shrinks in stories 2.3 and 4.2; a grep at 5.8 found no element word anywhere in `apps/web/src` and all seven surfaces already calling the one dot-only `addElementBadge`. So 5.8 spent AC3 on what was actually missing: the treatment had ZERO test coverage, so it now carries pins (the 12px dot and the four DESIGN hexes; the colour table restricted to exactly ONE consumer; no element word and no `setTint` anywhere), and the 5.7 per-unit stats sheet — the one surface still lacking a dot — gained one. NOTE the rule is the UX spine's (`DESIGN.md:257`, `EXPERIENCE.md:82`), not FR3's: FR3 says only that the element "is displayed". Original entry: **Normalize the element badge to DESIGN's dot-only compact unit-card across all scenes.** Story 2.1 shows the element WORD in the Draft tray, Placement cards, and Battle, but dropped it in Reveal (tight 52px cells) — DESIGN's compact unit-card is 3-letter code + 12px dot only, no word. Normalizing now would make Draft/Placement/Reveal consistent but leave Battle inconsistent (Battle rendering is story 2.2's scope), so the clean time to unify is when Battle's and History's unit cards are (re)built (2.2 / epic 3). The element *color* already flows from the single reconciled `ELEMENT_COLORS` source, so this is purely dropping the redundant word label. Danilo approved the current screens on-device; the words aid first-time legibility on the roomy Draft/Placement cards, so there is no urgency.

## Deferred from: story-2.1 dev (2026-07-13)

- **RESOLVED in code (story 4.0, 2026-07-17) — pending the on-device fps confirmation.** Candidate (a) shipped: DPR-sized backing store (`backingScaleFor`, capped ×3) + per-scene camera zoom (`applyHiDpiCamera`); headless probe confirms backing 1080×1920 at DPR 3 (was fixed 360×640) with pixel-consistent layout and sharp text. Danilo's `?perf=1` before/after session against `docs/performance-verdict.md`'s post-review baseline is the remaining gate (procedure in that doc's story-4.0 addendum); if the 30fps floor breaks even DPR-capped, revert and fall back to candidates (b)/(c) below. Original diagnosis kept for the record: **text still reads soft on Danilo's device — and the ceiling is now DIAGNOSED (measured, not guessed).** The canvas **backing store is 360×640 regardless of devicePixelRatio** (probed headlessly at DPR 3: `canvas.width=360` vs CSS ~420 → the browser smooth-upscales ~×3 physical). Consequences: (1) **no `?textres=N` value can ever fix it** — crispText's supersampled glyphs are minified into the 360px backing before the lossy CSS upscale; story 2.0's fix improved glyph quality *within* this ceiling, which is why Danilo accepted it then and why prod and 2.1 read identically now (his own comparison — 2.1 did NOT regress). (2) Pixel-art sprites survive (NEAREST blocks upscale acceptably — approved on device); ~1px text strokes don't. Candidate fixes, all story-sized: **(a)** DPR-sized backing + per-scene camera zoom, **(b)** redesign the layout grid at 720×1280 (constants, 6 scenes, fonts ×2), **(c)** hybrid DOM text overlay. All multiply GPU fill cost (up to ~9× pixels on a Pixel 6a) — **must be verified against NFR1's 60fps budget**, so the natural home is alongside story 2.2's animation perf work or story 3.4's performance verdict. Global `pixelArt: true` is NOT an option (tried in 2.1: makes text worse — ragged; per-texture NEAREST is the established pattern). **Baseline supplied (story 3.4):** `docs/performance-verdict.md` is the fps baseline any of the three candidate fixes must not regress below — but heed that doc's own scope caveats: the 2026-07-16 senior review superseded the first on-device capture (EMA metric, impossible sample count), so compare candidates only against the post-review re-captured numbers, not the superseded table. Story 3.4 itself does NOT implement any of the three fixes — it only supplies this baseline.

- **RESOLVED-AS-AMENDED (story 5.2, 2026-07-27):** the PO's one-theme decision (2026-07-23) retired the two-theme system and its Settings toggle UNBUILT; story 5.2 shipped the remaining substance as the single medieval theme — gold button/frame accents (the legacy green retired), the night-slate/parchment-gold grounds re-toned to DESIGN's Night tokens, and a serif gold wordmark treatment (the bundled-display-font idea continues as the Midjourney wordmark, floating on the art batch). DESIGN.md carries the dated amendment with the as-shipped token block. ~~**Full Heritage/Night two-theme system**~~ — DESIGN.md specifies two first-class switchable themes (Heritage Parchment light default / Night Tactics dark) with a Settings toggle persisted via `lordly.v1.settings` (AD-8, natural bundle: story 2.3's settings gateway). Story 2.1 shipped only the side-semantics slice of the palette reconcile (blue=you / red=enemy, element hexes to the DESIGN values); the theme infrastructure (per-theme ground+ink pairs, panel styling, theme toggle) is a dedicated theming story. Includes the **gold button/frame accents** (DESIGN wants enabled buttons + panel frames gold, not the current legacy green — `buttonFillEnabled`/`buttonStrokeEnabled` deliberately kept green in 2.1 to avoid conflating side and button semantics in one pass), the **parchment/stone grounds**, and the **bundled ornate/blackletter display title font** (Georgia stands in; pack choice was paired with the 2.1 sprite decision but not shipped).
- ~~**Element badge shape in Battle and Result scenes**~~ **RESOLVED:** Battle normalized to the shared 12px-dot helper in story 2.2 (unit rebuild), Result in story 2.3 (chip polish — the last placeholder-era square retired). One badge treatment everywhere (FR3).

## Deferred from: UX design (2026-07-13)

- **Player-facing board-orientation toggle (| / \\ / /)** — the UX ships the `\\` diagonal battle view as the polished default, but the renderer's owner-local→screen mapping (`battleView.toScreenCell`, AD-11) is being built to accept an ORIENTATION parameter from the start (the "cheap seam"). Adding a Settings toggle that lets the player pick vertical `|` / diagonal `\\` / diagonal `/` is then a small, engine-safe addition — it rides the same `web/storage` settings gateway as theme + battle speed (story 2.3). Deferred because 3 orientations = ~3× layout/QA (sprite sizing, HUD fit, clash-animation direction per angle) and the MVP's job is to make one battle screen sing. Danilo's idea; revisit post-Epic-2 or as a 2.3 stretch.

## Deferred from: code review of story-2.0 (2026-07-13)

- **Text resolution never recomputes on resize / orientation change** — `crispText`'s resolution is resolved once (lazily, after the story-2.0-review patch) and applied per-label at creation; a window resize or phone rotation that materially changes the `Scale.FIT` zoom leaves existing labels at the boot resolution until reload. A proper fix needs a live-label registry (or a resize handler that re-`setResolution`s every text object) — presentation-layer infrastructure that the epic-2 UX/animation stories (2.2/2.3) are the natural home for. Portrait-baseline game (FR30), so rotation is not a primary flow; low urgency.

## Deferred from: story-1.10 dev (2026-07-13)

- ~~**Sim-harness wipeout sweep**~~ **RESOLVED (story 3.0, 2026-07-15):** mode knob shipped (`SweepConfig.mode` + `--mode=` CLI), both-mode ≤65% band enforced in CI. The first-ever wipeout sweep vindicated the deferral's warning: v1 wipeout was three-mages-dominant at 74.6% — found and fixed (wipeout-scoped `blastAttenuation`).

## Deferred from: code review of story-1.1 (2026-07-12)

- ~~No lint/format step in the CI quality gate~~ **RESOLVED (story 2.0):** ESLint (flat config, incl. an AST purity layer for the engine) + Prettier check run in CI between typecheck and coverage.
- `pnpm-workspace.yaml`'s `allowBuilds` allowlist is hand-maintained (esbuild, sharp, workerd — currently all legitimately required by wrangler's dependency tree). A future dependency bump that introduces a new native postinstall script not yet listed will hard-fail `pnpm install --frozen-lockfile` in CI with `ERR_PNPM_IGNORED_BUILDS`, unrelated to any code change in that PR.
- ~~`apps/web/src/main.ts` has no try/catch or fallback UI if Phaser init throws~~ **RESOLVED (story 2.0):** init wrapped; plain-DOM fallback message on failure.
- ~~engine/web tsconfig strictness asymmetry~~ **RESOLVED (story 2.0):** flags symmetrized both ways (zero new errors surfaced); the one remaining divergence (`strictPropertyInitialization: false` on web, for Phaser's init()/create() lifecycle) now carries a rationale comment in the config.

## Deferred from: code review of story-1.1, second pass (2026-07-12)

- CI's corepack bootstrap depends on the runner image's preinstalled Node still bundling corepack; corepack has been removed from newer Node distributions, so a future ubuntu-latest image bump could break the `corepack enable` step. Revisit if/when CI fails with "corepack: command not found".
- `pnpm -r typecheck` silently skips any workspace package that lacks a `typecheck` script (it only hard-fails when no package has it). No clean guard exists; recheck when a third workspace package is added.
- ~~Template cruft in apps/web (phasermsg banner, duplicated vite configs, dead keys)~~ **RESOLVED (story 2.0):** configs consolidated onto `vite/config.base.mjs`, banner deleted, dead keys removed. (The `Game.ts` demo text was already gone before this story.)

## Deferred from: code review of story-1.3 (2026-07-12)

- ~~The engine purity guard is regex-based and inherently bypassable~~ **RESOLVED (story 2.0):** AST layer added in `eslint.config.mjs` (no-restricted-imports/globals/properties/syntax scoped to `packages/engine/src/**`); the regex sieve stays as belt-and-suspenders (it also locks the dependency list and source-file census).

## Deferred from: code review of story-1.4 (2026-07-12)

- Chassis `BattleEnded`/`hpPct`/`EngagementEnded.hp` are hardcoded stubs (all-full-HP draw) type-indistinguishable from real judged output. Story 1.5 makes them real; no shell consumes the log until 1.9. Revisit only if a consumer appears before 1.5.
- ~~Seed-range bound `0xffffffff` duplicated in `validate.ts` and `rng.ts`~~ **RESOLVED (story 2.0):** one exported `MAX_SEED` in rng.ts, consumed by validate.ts and sim/run.ts (it had actually triplicated). Error types stay layer-appropriate by design.

## Deferred from: code review of story-1.5 (2026-07-12)

- ~~Engine hot-path allocation churn (`candidatesOf`/`judgedView` projections)~~ **RESOLVED (story 2.0), with a finding:** projections deleted (UnitState now structurally satisfies MeleeCandidate/JudgedUnit) and throughput MEASURED — sweep median 812 ms before vs 792–819 ms after at runsPerPair=500: **no measurable gain**. The "matters for sim throughput" hypothesis was empirically false at 6 units (V8's generational GC absorbs short-lived projections); kept anyway as a net code deletion, goldens byte-identical.
- Judging-symmetry property proves symmetry only for asymmetric rosters (mirror-tie setups are filtered because the coin flip is not side-symmetric). A complementary invariant — "the coin flip is the SOLE source of mirror-match asymmetry" — needs a test harness that can control/inject the flip. Design note for the tech-debt story.

## Deferred from: code review of story-1.8 (2026-07-13)

- Navigation is one-way with a dead-end: Home→Draft→Placement→Reveal has no back-navigation, and the Reveal placeholder has no exit (the player is stranded until a tab reload). Explicitly deferred to story 1.9, which owns the real post-submit screens (Reveal/Battle/Result) and the Result→Rematch→Home navigation. 1.8 ships as a demoable one-way milestone. When 1.9 lands, ensure: a Home/back affordance exists from every scene, and Placement→Draft back-nav (if wanted) accounts for the forward-only element stream (re-adding re-rolls).

## Deferred from: code review of story-4-3-roster-wave-1-twelve-classes-on-role-relations (2026-07-18)

- `card.beats`/`card.beatenBy` computed by `classRulesCard` (apps/web/src/flow/draftModel.ts:61-62) but never consumed by `DraftScene` — it independently re-derives "strong vs"/"weak to" pills straight from `BALANCE.roleRelations`. Harmless (both derivations bottom out in the same table, no drift risk), only exercised by `draft-model.test.ts`. Revisit if a future screen wants a class-name-list view instead of the damage-type pills.
- ~~`chip()` matchup-pill layout (apps/web/src/scenes/DraftScene.ts:126) has no width/right-edge bounds check against `BASE_WIDTH` (360).~~ **RESOLVED in story 5.4 (2026-07-28):** `chip()` now clamps against the detail panel's right edge — a pill that would overflow is ellipsized to fit, and one with no room at all is dropped instead of escaping the frame (the exact "roster keeps growing" trigger this entry predicted: 17 classes landed).
- `sprites.test.ts` hardcodes an untracked `SHEET_FRAMES = 6` constant (apps/web/test/sprites.test.ts:695-712), duplicating knowledge already implicit in the sheet dimensions and independently re-derived at runtime in `BootScene.ts`. Nothing forces it to bump when the sheet is later extended to 11 frames (dedicated newcomer tiles).

## Deferred from: story 4.4 device review (2026-07-18) — PO course-correction

- **Mid-battle tactic switching (OB64-style) — REVISES AD-2.** Danilo (2026-07-18): OB64 lets you change your army's tactic during the fight; he wants that. Story 4.4 shipped tactics as FIXED at placement (AD-2 explicitly recorded "mid-battle switching rejected, deviation from OB64"). PO decision: **defer to a dedicated design pass / story** (do NOT hack into 4.4). Needs: (1) tactic becomes a time-varying, RECORDED input so replays + history stay deterministic (FR20/AD-2/AD-9); (2) a Battle-scene pause-and-command UI; (3) history stores the tactic-change events; (4) the balance sweep re-run under mid-battle tactics (would reshape the meta). This is an epic-4 amendment — run correct-course to scope it and revise AD-2. Sequence: after the current epic-4 wave, likely.
- **Melee blockade under tactics — DECIDED & implemented (not deferred; recorded here for the ADR update).** Danilo (2026-07-18): a melee unit can NEVER hit the back row through a living front unit, even under a target tactic (Attack Weakest/Strongest). This is a must-have mechanic. This REVISES the dossier §4 note "target tactics dissolve rows too" — that holds only for ranged/magic (which arc over the front). Implemented in `targeting.ts` (melee legal list restricted to the nearest occupied row). The dossier §4 / ADR should be amended to record this.

## Deferred from: code review of story-4-4-tactics-the-order-you-give-your-army (2026-07-19)

- Reveal/Placement tactic-label pixel positions (`RevealScene.ts` y=344/366/388, `PlacementScene.ts` y=416 band) are hand-placed with no regression test pinning them. Deferred, not a story-4.4-introduced risk — every other scene in this codebase relies on device confirmation rather than golden-pixel tests for layout, and these specific positions were confirmed by Danilo across two device-review rounds.

## Deferred from: story 4.5 device follow-up (2026-07-19) — PO course-correction

- ~~**Battle mode default flipped to Wipeout (left) — PRD-touch pending.**~~ **RESOLVED (story 5.0):** FR17/FR19 were amended to record Wipeout-as-default, so the PRD and the shipped app agree. Never annotated at the time — closed during story 5.8's ledger sweep. Original entry: **Battle mode default flipped to Wipeout (left) — PRD-touch pending.** Danilo (2026-07-19): Wipeout is now the Home default and sits on the LEFT; Standard is the right option. Implemented in `HomeScene.ts` and recorded in EXPERIENCE.md (dated amendments to the Home + mode-toggle rows). **PRD FR17 still reads "Standard is the MVP default"** — the next `bmad-prd` touch should update FR17/FR19 to reflect Wipeout-as-default so the PRD and the shipped app agree. Balance is unaffected (the NFR4 sweep already polices BOTH modes at ≤65%). `MatchFlow`'s constructor default stays `'single'` (a neutral engine-level fallback; Home always passes the chosen mode) — only the product-facing default moved.
- **Leader crown now rides the Battle board (implemented, groundwork noted).** Danilo (2026-07-19) wanted the leader identifiable during the fight, explicitly so the coming mid-battle tactic switch can offer "go for the leader or not." Shipped in `BattleScene.buildUnit` + EXPERIENCE.md amendment. This directly feeds the ALREADY-DEFERRED **"Mid-battle tactic switching (OB64-style)"** item (story 4.4 device review, above): when that story is scoped, the on-board crown is the read the pause-and-command UI targets. No further work here — logged as the connective tissue.

## Deferred from: code review of story-4-6-crits-and-dodge (2026-07-19)

- The physical-vs-magic `roll` invariant (draw-count-always-2, physical-only-crit) is enforced purely by call-site discipline in `strike()`'s optional `roll` param, not the type system (`packages/engine/src/resolve.ts`). Pre-existing pattern — mirrors the already-accepted `leaderPenaltyPhysical` convention from story 4.5, extended here for a second invariant. Verified unreachable today: all 4 physical call sites pass a single-target array with `roll`; both blast call sites never pass `roll`. Worth someone consciously deciding whether the pattern should still be call-site-discipline-only as it compounds across stories, or whether a future refactor should thread the invariant through the type system.
- `'missed'` outcome (`AttackTarget.outcome`) has no explicit render branch in `apps/web/src/flow/narration.ts` or `apps/web/src/scenes/BattleScene.ts` — both fall through to the default `'hit'`-shaped line/popup. Currently unreachable: `rollHit()` (`packages/engine/src/resolve.ts`) never returns `'missed'` — it's reserved and unimplemented per ADR 0003 for wave 1. Real only when a future story implements an accuracy/miss mechanic distinct from dodge; that story should add the UI branch alongside the engine change (inventing the UI now would be guessing at an undesigned future beat).
- `rollHit()` reads DEX from static `BALANCE.classes[cls].dex`, not a live per-unit stat (`packages/engine/src/resolve.ts`) — a deliberate, documented simplification (DEX isn't carried on `UnitState`, only `agi` is). Hard-wires the assumption that DEX is never dynamically modified by a status effect. No current status effect touches DEX, so this is fine today. Revisit `rollHit`'s signature (and whether DEX needs to join `UnitState`) if a future "blinded"-style DEX debuff, or any other DEX-modifying mechanic, ever ships.

## Deferred from: code review of story-4-7-per-row-moves-and-guard (2026-07-19)

- **`attackMoveOf` back-row-move cast is unguarded against a future Guard-in-back tuning table** (`packages/engine/src/resolve.ts:451-455`). When a confused unit's acting row is a Guard tier, `attackMoveOf` falls back to `moves.back as MoveKind` to give the misfire a real attack shape. Safe for the current frozen table (Knight back = slash, Phalanx back = bash — both real attacks). But the move table is explicitly TUNABLE (Danilo's queued per-class/row move+count pass), and a future table that gives a class a back-row `guard-full`/`guard-half` would make a confused misfire emit `UnitAttacked { kind: 'guard-full' }` — an invalid attack shape. (Story 4.10 update: the Battle renderer now routes kinds through an exhaustive `Record<TraceKind, …>` travel map, so widening `MoveKind` is a compile error in the shell rather than a silent misrender — but the emitted event would still carry a value outside the declared `MoveKind` union, which nothing validates at runtime.) Revisit when the tuning pass runs: either forbid back-row Guard in the type/data, or have `attackMoveOf` scan for the first real `MoveKind` across rows instead of assuming `back`. **RESOLVED-BY-RULING 2026-07-27 (story 5.1, dossier E5-D12a): back-row Guard is FORBIDDEN as a data rule this era — no code change; a future era wanting it must first land the scan fix. See `docs/planning-artifacts/epic-5-dossier/DOSSIER.md`.**
- **Overlapping guards on one cell — the weaker charge is consumed first, the stronger wasted** (`packages/engine/src/resolve.ts:466-473`, `applyGuard`). When a target holds its OWN `guard-half` charge AND a `guard-full` ally sits directly in front of it (a same-column Phalanx-front + Knight-mid double-guard), a landed physical hit consumes only the target's own Half charge (`target.guard !== undefined ? target : find(front-ally)`) — the Phalanx's Full negation, which also covers that cell, is left unspent. Deterministic and not wrong (the Full charge survives for a later hit), but counterintuitive: the player's stronger shield doesn't absorb the blow it could have fully negated. The spec never specified the tie-break when two charges cover one cell. Narrow (needs the specific double-guard column) — revisit at the move-table tuning pass or if a player reports it; if changed, prefer "strongest shield on the cell wins" (may re-record any golden/sweep battle that hits the case). **RESOLVED-BY-RULING 2026-07-27 (story 5.1, dossier E5-D12b): KEEP the shipped own-charge-first behavior — spending the weaker charge preserves the Full negate for the next hit; goldens stay stable. See `docs/planning-artifacts/epic-5-dossier/DOSSIER.md`.**

## Deferred from: story 4.10 acceptance (2026-07-20) — PO decision — RESOLVED (story 5.0, 2026-07-24)

**Capture ran 2026-07-24 on Danilo's device against production** (after three deferrals; the epic-4 retro made it story 5.0's hard deadline). Results + honest procedure notes (missed reset handled by prefix-slice; adaptive-120Hz caveat) recorded in `docs/performance-verdict.md`'s story-5.0 capture record — now THE EPIC-5 BASELINE. Battle ×2 clean; Battle 1× shows 4 isolated sub-30 single-frame hitches (0.095%), median 59.88 — Danilo watched and accepted ("felt smooth", recorded deviation). Original entry kept below.

- **Post-deploy `?perf=1` frame-rate capture for the 4.10 from→to motion.** Danilo accepted and shipped 4.10 on the local build without a formal on-device capture; the capture procedure (docs/performance-verdict.md — three-mages-wipeout Replay at 1× and ×2, per-scenario resets, single-read traces) compares against DEPLOYED-URL baselines, so the 1:1-comparable capture happens after merge to main (a local `vite preview` capture was possible pre-merge, but wouldn't compare cleanly — review note 2026-07-20). The perf doc's 4.10 addendum has the stress-case decision (`three-mages` stays the benchmark) and per-beat object accounting (melee step = 0 new GameObjects, projectile trace = 1 destroyed-on-arrival sliver); its on-device table is stubbed pending this capture. Low risk vs the post-4.0 baseline (zero floor breaches with the same wash/popup churn), but the doc's own doctrine is empirical-over-reasoned — run the capture at the next convenient device session and fill the table. **STILL OPEN after story 4.12 (2026-07-20):** 4.12 bundled this capture into its AC5 but Danilo closed 4.12 on the balance certification + felt-balance sign-off WITHOUT running it (PO call). The capture now also covers the 4.11 move-plate and the post-monster asset load (4.8/4.9). Now that 4.13 (tactics on Reveal) is also queued, whichever deploy carries these to production is the natural moment to run the single capture.

## Logged from: story 5.1 close (2026-07-27) — PO wish: rotating battle backgrounds → route to story 5.3

- ~~**Danilo wants 2+ battle backgrounds in rotation.**~~ **RESOLVED (story 5.3) — closed late at the
  2026-08-01 review.** 5.3 shipped exactly what this entry recommended: two biomes, the index derived
  from the match seed in the shell (`backgroundKeyForSeed`, `seed % length`), the engine untouched, and
  the list kept as a shell-side manifest. The story delivered it and never annotated the wish — the same
  lapse its sibling entry at `:47` had. NOTE for whoever adds the third biome: `seed % length` means
  growing the manifest re-skins stored replays; the constant's comment and a test pin now say so.
  Original entry: **Danilo wants 2+ battle backgrounds in rotation, "randomly picked before the match starts."** Assets on hand: `castle-battleground.png` (in `ux-designs/midjourney/selected/`) + a green-plains candidate (`midjourney/u5297536118_fantasy_battlefield_landscape_green_plains_*.png`, not yet promoted to `selected/` — the pick is Danilo's, per the folder convention). Implementation recommendation for 5.3's create-story: derive the background index **from the match seed in the shell** (e.g. seed mod backgrounds.length), NOT `Math.random` — deterministic, so a replay shows the same background as the original battle, and the engine stays untouched (background is presentation, never `MatchSetup` data). Keep the background list as a shell-side manifest so new selected art is a one-line addition.

## Logged from: story 4.11 dev session (2026-07-20) — PO wish: the OB64 unit-data card

- **Unit detail card at squad assembly (OB64 "UNIT DATA" fidelity) — Danilo's stated dream, with three authoritative OB64 reference screenshots (conversation 2026-07-20).** Selecting a unit while assembling the squad opens a detail view showing: (1) per-row moves WITH counts — the "Pierce ×2 front / Banish ×1 mid / Banish ×2 back" read; (2) a small damage-type glyph per move row (OB64 puts a staff icon over Acid Vapor = magic damage — "the attention to details... small, and placed where it makes sense"); (3) the stat block (STR/VIT/INT/MEN/AGI/DEX), HP, element; (4) LATER, explicitly not needed now: derived attack/defense summaries (physical def / magical def, OB64's right column + UNIT DATA panel). Presentation shape: a modal/bottom-sheet over Placement ("a new opened modal"). Also flagged by Danilo: the Placement screen itself could move toward OB64's information density — smaller board, smaller tray squares — "that would mean a total rework". DATA IS MOSTLY BUILT: `rowActionCounts` (4.11), `moveDisplayName`/`MOVE_PLATE_NAMES`/`SPELL_DISPLAY_NAME` (4.11), `BALANCE` stats, `draftModel.classRulesCard` (Draft DETAIL panel); the damage-type glyph derives from `MoveKind` (blast/spell = magic; slash/arrow/bash/staff = physical). NEW WORK: the card layout (UX-spine extension — DESIGN/EXPERIENCE amendment), a selection gesture at Placement (tap = crown today — conflict; long-press / info affordance / part of the rework), and the glyph row. Route: own story via correct-course (if it should join epic 4's tail) or the epic-4 retrospective as a wave-2 opener — NOT bolted onto 4.11.

## Deferred from: code review of story 4-11 (2026-07-20) — CI/gate hygiene

- **RESOLVED (story 5.0, 2026-07-23; completed at review 2026-07-24):** explicit timeouts now cover EVERY `matchSetupArb` full-battle property and heavy sweep test in the suite — dev round: `sim.test.ts` determinism + mode-default (20s each), `monster.test.ts` ×2 (20s, incl. the recorded offender), `guard.test.ts` 20s→40s; review round: `resolve.test.ts` ×3, `crit-dodge.test.ts`, `leader.test.ts`, and the single-mode band test (belt only). **Proof: 2 full `pnpm coverage` runs with all 10 cores saturated by busy-loop burners — both clean** (idle runs alone were a weak proof; pre-fix idle runs also passed). Known residual: `sim.test.ts`'s describe-scope `runSweep` executes at collection time, unreachable by per-test timeouts — if a sim band test ever times out again under coverage, move the sweep into a `beforeAll` (respects `hookTimeout`). ~~`pnpm coverage` intermittently times out one heavy engine test under instrumentation + parallel load~~ (seen across stories 4.8, 4.10, 4.11 — e.g. `monster.test.ts`'s arbitrary-battle property test, `sim.test.ts`'s determinism sweep). Each time it passed clean on a retry and always passes uninstrumented (`pnpm test`), so it reads as an instrumentation-slowdown flake, not a real failure — but a gate that only goes green on retry is quiet erosion, and CI runs `pnpm coverage` (not `pnpm test`), so a bad-luck timeout could red a legitimate build. Options to weigh at the next tooling/tech-debt pass: raise the per-test `testTimeout` for the known-heavy property/sweep suites (they already carry explicit timeouts in some cases — extend the pattern), reduce coverage-run thread contention (vitest `poolOptions`/`maxThreads`), or memoize/trim the heaviest arbitraries further (story 4.8 already memoized `VALID_MONSTER_PLACEMENTS` for exactly this reason). Low urgency; no correctness impact — purely gate reliability.

## Deferred from: code review of story-5-2-the-medieval-look (2026-07-27)

- **Battle log panel caps LOGICAL lines, never visual ones.** *(Note 2026-08-01, story 5.8's review: the app-wide `PANEL_FRAME_SLICE` 30→46 change altered this panel's border geometry too — the band is thinner and uniform now, and the review bumped the log text's inset 14→16 to clear the measured 15.3px ornament. The overflow defect below is unchanged and still owns its own re-lay; the Draft detail panel's title also sits ~2px of ink into the band and belongs to the same future pass.)* `appendLog` keeps `LOG_PANEL_LINES` (11) narration lines, but long lines wrap: `narration.ts` emits strings like "<src> struck <tgt> — <guardian>'s guard halves it to 7 — 24→17 HP" that exceed the 300px wrap width at 11px, so 11 logical lines can render as ~14 visual lines (~250px) inside a ~212px interior and spill past the panel's bottom border. PRE-EXISTING (the flat-rect version overflowed at ~228px too), but story 5.2's 9-slice border shrank the interior by ~16px and makes the overflow read as broken art rather than text meeting an edge. Fix options when touched: cap visual lines (measure and trim), grow the panel, or clip the container.
- **`wordmark.jpg` ground doesn't match the plaque body.** The logo's own dark-olive ground `(19,18,0)` sits inside `panel-frame.png`'s neutral `(28,28,26)` body, leaving a ~6px ring — the mark reads as a pasted screenshot rather than art mounted in the frame. JPEG is also the wrong container for a hard-edged gold-on-black wordmark (ringing on the app's primary logo; every other crisp-edged chrome asset is PNG). May partly resolve with the panel-frame re-crop; re-judge on device, then either re-export the wordmark as a trimmed PNG or tint the plaque body to match.
- **Home's scrim is a hard-edged rectangle.** `rectangle(360, 307.2, buttonFill, 0.55)` puts a straight 55%-dark step at y≈333 across the castle painting — the first screen a player sees. The code comment flags only the alpha as tunable; the edge is structural and no alpha removes it. Needs a gradient (a small vertical-gradient texture, or 3–4 stacked bands with graduated alpha) — a design call, not a mechanical fix.
- **PWA icon ground vs manifest splash colour.** The generated icons' own ground is `#142637` (navy-teal, sampled from Danilo's art) while the manifest `background_color`/`theme-color` is `#161a2e` (the app's slate), so Android's install splash shows a subtle square around the icon. Either regenerate the icons composited on `#161a2e` or accept the mismatch (the maskable safe zone itself is verified fine).
- **Credits shows a CC-BY-4.0 pack with no "supplies" statement.** `flow/credits.ts` derives its `Supplies:` line from `classSources`, which is `{}` for the Midjourney art entry (it supplies chrome, not class sprites), so the one pack whose licence actually requires credit is the one listed without saying what it contributed. Attribution terms are met (author + licence + URL), so this is polish: add a non-sprite `supplies` field to `ArtPackAttribution` when the manifest is next touched.
- **`addButton`'s Phaser-object behaviour is untested.** The new shared builder carries real behaviour — `style: 'disabled'` must block `onTap`, `setStyle('primary')` must RE-ENABLE interactivity after `disableInteractive()` (BattleScene's speed toggles depend on this every tap), and `parts` must contain every created object or dynamic-redraw scenes leak art layers. None of it is covered: `apps/web/test` has no `vi.mock` and no Phaser-object precedent — every existing web test targets pure seams. Introducing a light Phaser mock harness is its own tooling story; the pure geometry half (origin math + inset clamp) was extracted and tested at review time.
- **Reveal's tactic-dropdown rows are 24px, under the FR30 44px tap floor.** Pre-existing from story 4.13 (the picker moved to Reveal at that size); surfaced again by story 5.2's code review, where the fix was scoped to the dropdown's FRAMING (option b: one `addFramedPanel` around the open menu, flat rows inside) and deliberately NOT to its geometry — four 44px rows plus the bar would add ~80px to an already crowded Reveal screen. Revisit if a device session reports mis-taps, or when Reveal is next laid out (a scrollable or 2-column picker would buy the height back).

## Deferred from: story 5-3-battle-backgrounds (2026-07-28) — PO call

- **The story-5.3 `?perf=1` capture (its AC 3) was NOT run.** Danilo accepted the look on device and chose to keep moving; no blocking reason stated. The story shipped with AC 3 marked *satisfied-with-recorded-deviation* rather than satisfied. **Why this one is not a formality:** 5.3 added two full-screen terrain textures AND enlarged the rendered board area by ~55% (tiles 56×28 → 74×37, plus the spread), and both the story-5.0 baseline and the story-5.2 addendum recorded a ~5-frame scene-entry burst (bottoming 8–11 fps) at exactly the moment the Battle scene loads its assets — the moment this story made heavier. **Owner: story 5.10 (the pre-PvP verdict)**, which already carries a closing capture; that capture must now cover 5.2's chrome, 5.3's terrain and the enlarged boards together, and should explicitly compare the scene-entry burst against the 5.0/5.2 figures. Context worth remembering: the epic-4 retrospective named this capture as one that had already survived three deferrals, which is why story 5.0 made it a hard deadline.

## Logged from: story 5-5-roster-wave-monsters (2026-07-28) — PRD deviation for the PO to ratify

**RATIFIED 2026-07-29 by Danilo: "we have 18. That's the reality. FR25 is the past."** FR25's
pool-size clause is amended in epics.md (dated note); the exact-18 pin in `ai.test.ts` stays as
the growth gate, and the ≤65% sweep band remains the curation criterion. Nothing here is open
any more. Original entry kept below for the record.

- ~~**The AI strategy pool now holds 18 archetypes; FR25 says "~8–12".**~~ Needs Danilo's
  ratification (or a push-back) — flagged here rather than silently rewritten. Why it grew:
  story 4.12's reverse-coverage guard requires EVERY class to appear in at least one
  archetype, so the sweep certifies the whole roster. A `sizeClass: 'monster'` unit costs 2
  of the 5 slots, so a monster comp fields only 3–4 units, and the ten classes of the 5.5
  wave needed six new comps (`breath-battery`, `dragon-wall`, `wyrmhold`, `stormflight`,
  `beast-rush`, `skyclaw`) to hold them. Folding monsters into the twelve existing comps as
  single-unit swaps — the 4.3 method — is not available: dropping two smalls to seat one
  monster rewrites a comp's identity rather than extending it. FR25's *intent* (enough board
  variety that the AI never repeats itself) is exceeded, not weakened. **Cost:** the sweep is
  n², so CI went from 12² to 18² pairings per mode; measured runtime is still well inside
  budget (the full runs=500 wipeout convergence sweep takes ~16s locally, CI's runs=15 proxy
  is a fraction of that). The `ai.test.ts` bound was widened 12 → 20 with this note attached.
  **If the PO wants the pool back under 12,** the honest options are (a) drop the
  reverse-coverage guard for monsters and accept that some classes ship uncertified by the
  sweep, or (b) merge comps by pairing two monsters per entry — which the 5.5 sweep found is
  the game's most overtuned shape when the pair sits in the back row (87.9% before re-shaping).
## Resolved same-day (2026-07-28): the ROSTER.md monster-rules correction — nothing here awaits the PO

- **RESOLVED 2026-07-28 (same day, at Danilo's request): the ROSTER.md correction is applied.**
  The bullet now records both errors and the reachable demonstration, and reviewing it surfaced a
  SECOND stale claim the story had not caught — "monsters never share a column" is not a rule at
  all (front-left + back-left is legal; only king-adjacency is banned). Both are pinned in
  `validate.test.ts`. Original entry kept below for the record.
- ~~**`ROSTER.md` §Monster rules states a consequence that cannot occur.**~~ "A 2-monster + Whelp
  army is legal, if a human leader is aboard" (Danilo-confirmed, 2026-07-27) — but at
  `slotBudget: 5` that army is 2+2+1 = 5 slots with no room left for the human, so it can
  never validate. The *rule* it illustrates is implemented exactly as decided (the Whelp is a
  small and does NOT consume a monster-cap slot, so 1 monster + Whelp + 2 humans IS legal);
  only the illustration is unreachable. Pinned in `validate.test.ts` so the distinction stays
  deliberate. Worth a one-line correction in ROSTER.md at the next dossier pass.

## Deferred from: code review of story-5-5-roster-wave-monsters (2026-07-28)

- **Scene-level coverage for the Draft tab strip** (the rebuild path, double-tap-state reset, and
  selection migration on tab switch have no tests — only the pure model is covered). Pre-existing
  gap, not caused by 5.5: `apps/web/test` has no Phaser mock harness, the same tooling story the
  5.2 review recorded for `addButton`'s untested Phaser behaviour. When that harness lands, the
  tab strip should be its second customer.

## Logged from: story 5-6 device pass (2026-07-29) — PO wish: the unit data INLINE on the Draft detail panel

- **Danilo's true wish for the unit-data read (his words: "my true wish… is to have it visible
  on the main screen, not as an overlay"), pointing at the DRAFT detail panel as the place
  ("That should be the place where you think: this char is what i need, this one is strong,
  this one is weak for my comp"), "probably smaller and more discreet", "maybe use more icons
  than text — i want to love it the same way i love OB64."** He accepted the Placement overlay
  for now (his explicit "I can accept for now"), so 5.6 ships the card as specced; this wish is
  the NEXT step, not a 5.6 correction. What it actually asks for: folding the card's richness
  (per-row moves w/ counts, damage-type glyphs, the stat spider chart) into `DRAFT_DETAIL` —
  which is 108px tall today and already carries name/role/behavior/matchup-chips/Add — so it is
  a Draft-panel REDESIGN (denser, icon-first, possibly taller at the grid's expense), not a
  bolt-on. Assets that make it cheaper by then: the pure `unitCard` model + `statAxisRatios`/
  `radarPoints` + `CARD_GLYPHS` all exist and are surface-agnostic; the 5.9 portraits will have
  landed. **Route: a design pass first (DESIGN/EXPERIENCE amendment with a mock), then its own
  story — natural slots: beside 5.9 (portraits land in the same panel) or the epic-5 retro.**
  Surface this at the next retro/correct-course (the PO-wish convention).

## Deferred from: code review of story-5-6-the-unit-data-card (2026-07-29)

- **Multi-touch audit for the scene gesture system.** The 5.6 review noted the new long-press
  shares one timer across pointers (a second finger re-arms it), a card opened mid-drag
  freezes the dragged unit, and close-during-drag resumes swallowed drag events. NOT a 5.6
  regression: the whole gesture system (double-tap windows, deferred crown timers) has been
  single-pointer by design since story 1.8, and the target platform is one-thumb portrait
  play. If a device session ever shows two-finger weirdness, the fix is pointer-id-scoped
  gesture state across DraftScene/PlacementScene — an audit-shaped task, not a patch.

## Deferred from: code review of story-5-7-the-battle-stats-summary (2026-07-29)

- **Multi-touch (extension of the 5.6 deferral):** ResultScene adds a third single-pointer
  gesture surface (chip long-press + the summary link). Same shape as before — a second
  finger clobbers the shared timer — and the same verdict: the whole gesture system is
  single-pointer by design since 1.8; fold Result into the pointer-id audit if it ever runs.
- **The poison-witch read on the summary bars (a UX decision for Danilo, not a bug):**
  `PoisonTicked` carries no actor, so a poison-heavy witch who wins the match bars as a
  near-pacifist (dealt ≈ 0) while her victims' grey taken-bars swell. Semantically honest and
  documented in the fold, but the summary sheet never SAYS it — the one archetype whose
  damage model differs is the one the teaching surface under-credits. Candidate fix when it
  itches: a small ☠ annotation on rows with poisonTaken, or crediting ticks to the caster
  (which would change the fold's semantics and the conservation law — a real design call).

## Deferred from: story 5.8 (2026-07-29, updated through the 2026-08-01 device rounds)

- **The Battle tile's chrome re-lay is monster-aware work, not a drive-by.** Retiring the board class
  code (AC2) freed the band y≈−3…+11 in the unit container, and the obvious follow-up — move the ♛ crown
  (−16,−28) and the element dot (+16,−28) down out of the sprite's silhouette — does NOT work as stated:
  a LOOMED monster spans y−49.5…y+13.5 at `MONSTER_LOOM_SCALE`, so the freed band is entirely inside the
  artwork for all ten monster classes, and so is the crown's current position. Story 5.8 therefore removed
  the code and changed nothing else on that tile. A real fix has to be size-aware (per-class offsets the
  way `revealNameOffsetY` now is, or chrome that sits outside the sprite bounds for both spans) and wants
  its own device round on a monster comp. The lane pitch is the budget: `ISO_BOARD.tileH / 2` = **18.5px**
  at today's 74×37 tiles, against a chrome stack still spanning ~52px. (The "28px" this entry carried
  until the 2026-08-01 review was inherited from a stale BattleScene comment — it was the pre-5.3 tile
  height, not a pitch. Plan against 18.5.)
- **The Reveal tactic picker is at its ceiling: FOUR tactics.** Story 5.8 brought the bar and option rows
  up to FR30's 44px floor as a 2×2 grid, and pinned the clamp against the Fight button that the scene's
  own comment had only warned about. The arithmetic leaves no room for a fifth: 5 tactics need a third row
  and overrun Fight's top by 38px (panel bottom 606 vs Fight top 568 — corrected at the 2026-08-01 review,
  which also re-anchored the panel BELOW the enemy tactic line and set its pad to 18), so
  `battle-view.test.ts` fails on a grown `ALL_TACTICS`. Whoever picks up
  the **tactic-roster extension** (deferred above, Epic 6+) must re-lay this picker first — scroll, three
  columns, or a shorter bar — and the failing test is the intended forcing function, not an obstacle.
- ~~**How does a player DISCOVER the per-unit stats sheet?**~~ **DECIDED AND SHIPPED (story 5.8 device
  round 4, 2026-08-01).** Danilo picked the placement himself: *"this hint about the char card summary
  could be placed between the bottom team and the REMATCH button. I would like it there."* That is
  candidate (c) below — teach the gesture where it can actually be performed — and it is now a muted
  10px line on Result at `RESULT_HINT_Y` 456, centred in the measured 43px band between the enemy chips
  (bottom 434.4) and Rematch (top 477.6), pinned by test against those same layout fractions. The
  tappable-bar-rows idea (a) stays unbuilt and unneeded. Original entry: **How does a player DISCOVER
  the per-unit stats sheet? (a UX decision for Danilo.)** The battle-summary
  sheet used to carry a footer line — "Close, then hold a chip for its full sheet" — and story 5.8's device
  round 3 killed it on Danilo's verdict: *"the footer hint i dont understand it… it's not a link, clickable,
  so it's very confusing."* He is right, and the reason is structural, not wording: it is a line inside a
  MODAL, instructing a gesture that same modal is blocking, styled like text but read as a broken link. No
  rewrite fixes that shape. So the hint is gone and the drill-down (hold a Result comp chip) is now
  undiscoverable except by habit from Draft/Placement, where the same hold gesture already lives.
  Candidate fixes, none free: **(a)** make the summary's own bar rows tap targets, so tapping a unit row
  opens that unit's sheet — by far the most discoverable, but a row is 24px and FR30 wants 44, and ten rows
  at 44px is 440px on a 640px canvas, so it needs a scroll or a two-column re-lay; **(b)** a small ⓘ or ›
  affordance per row, which is honest about being tappable but adds chrome to a deliberately clean chart;
  **(c)** teach the gesture ONCE somewhere it can actually be performed (a first-run tip on Result, or a
  line in the Help/rules screen) instead of inside the modal; **(d)** accept it as a power-user shortcut and
  say nothing. Recommend (c) as the cheapest honest answer, or (a) if the summary sheet ever gets a re-lay
  for other reasons.

## Deferred from: code review of story-5-8-flow-corrections-and-the-board-code-decision (2026-08-01)

- **Guard at slot 0 brings the status row one icon closer to the element badge.** With the 5.8 fix the
  shield takes slot 0, so a guarding unit with 3 concurrent statuses puts a spell icon in slot 3 (x+22),
  grazing the element badge (x10–22, both at y≈−28..−34) — reachable one status earlier than before
  (3 statuses already grazed pre-change, so this is mostly pre-existing). Needs guard + poison + sleep +
  confusion on one unit to trigger, and the graze is a 10px glyph on a 12px dot. Same tile-chrome-budget
  family as the monster-aware Battle chrome re-lay logged above — fold them into one pass: the lane pitch
  (`ISO_BOARD.tileH / 2` = 18.5px today, NOT the 28 this entry first claimed — see the correction above)
  is the real constraint, and any re-lay should budget the status row's maximum width (guard + all
  spell kinds) against the badge and the sprite edge, for both sprite spans.

## Deferred from: story 5-10 device capture (2026-08-01) — PO decision — **THE PERFORMANCE STORY**

- **NFR1's 30fps in-battle floor FAILS on the current worst-case comp, and the fix is deferred to a dedicated
  performance story "at the very end" (Danilo's call, 2026-08-01).** This is the largest single piece of
  deferred work in the project and the only known NFR-level failure carried into link-play, so it gets its
  own entry rather than a bullet.

  **The measurement** (full record + tables in `docs/performance-verdict.md`, story-5.10 section): on the
  re-pointed benchmark — a mirrored **Emberdrake + 3 Knights** wipeout board, which measurement shows is the
  heaviest per-beat comp the roster can build (68 attacks / 82 target-instances / 110 events / the full
  10-engagement cap) — Battle 1× holds a **sustained 40fps median for its first half** and breaches the 30fps
  floor **275 times in 2,878 in-battle frames (9.56%)**. The 5.0 baseline recorded 4 breaches in 4,205 frames.
  ×2 is worse (median 40.16, 13.8% sub-30).

  **Why this evidence is unusually solid** (it should not be re-litigated, only re-measured after a fix): the
  device stayed at 60Hz for the whole session — zero samples above 100fps — and the values quantise exactly to
  vsync multiples (60.2 / 40.0 / 30.0 / 24.0) with the **50–58fps band completely empty**. The
  adaptive-refresh caveat that made 5.0's sub-60 samples ambiguous therefore does **not** apply here: a 40fps
  sample is a genuine 25ms frame.

  **The diagnosis, and the named fix:** median goes **40.00 → 59.88 between the first and second half** of the
  battle, monotonically across deciles, as units die and the board empties. Load tracks living units and
  *concurrent* row-AoE popups — a 3-target `breath` instantiates three popups in one beat where a `bolt`
  instantiates one. The lever is the one `performance-verdict.md` has named since story 3.4 and never pulled:
  **pooling / reuse for per-beat traces, popups and washes.**

  **Why it is a deviation and not a blocker:** Danilo watched the same battles and reported **"it felt smooth
  still. i didn't see performance downgrade."** Under the 5.0 precedent his felt-experience is the deciding
  input. Both facts stand together — the failure is measured AND imperceptible on the target device.

  **Sequencing input for whoever schedules this** (recorded, not decided): "at the very end" was the PO's
  framing. The counter-consideration is that **Epic 6 (link-play) adds network send/receive and state sync onto
  the same per-beat frame budget** this capture says has no headroom. If the performance story lands after
  link-play, PvP is built on a board already missing its floor; if it lands before, Epic 6 starts from a clean
  measurement. Worth one explicit decision at the Epic 5 retrospective or the link-play design pass rather
  than defaulting.

  **Two loose threads to pick up with it:**
  - The **scene-entry burst** read **2.61fps** (383ms) this session versus ~8fps at 5.0 and ~10.9fps at 5.2.
    Entry cost IS cross-comparable (same atlas, same load moment), so that is a real move in the wrong
    direction — but it is one session, so take a second reading before treating the depth as settled.
  - The **per-scenario reset was missed for the third consecutive capture** (5.0, 5.2, 5.10), each time
    producing a ×2 trace containing the 1× trace as an exact prefix that had to be sliced by hand. Three for
    three is a procedure problem, not user error: consider having `?perf=1` reset `__perfSamples` on Battle
    scene entry, or expose a one-tap "start new scenario" marker, so the capture cannot silently concatenate.

  **UPDATED 2026-08-01 (same day) — the diagnosis above is SUPERSEDED; read this before scoping the story.**
  Danilo captured `__perfSamples` across many real games (four sessions). Two things changed:

  1. **The metric was misread. The panel is 120Hz, not 60Hz.** Every sample value is an integer multiple of
     8.333 ms (mean residual 0.0067 against a 120Hz grid, 0.16 against 60Hz). The original "device stayed at
     60Hz" claim was inferred from the absence of >100fps samples — an invalid inference, because a
     60fps-targeting game never finishes a frame inside one 8.33 ms tick. **Read frame cost in TICKS:** 2t =
     16.7 ms (the 60fps target), 3t = 25 ms, 4t = 33.3 ms (exactly the 30fps line), ≥5t = past it. The "sub-30"
     counts in the entry above overstate the breach, because the 4-tick bucket sits *on* the line, not below it.
  2. **Real play is WORSE than the synthetic worst case, which reverses the diagnosis.** Real play (Draft +
     Placement + Battle, human-drafted boards): median **3 ticks**, **9.2–13.4%** of frames at ≥5 ticks, worst
     frames 83–167 ms, consistent across four sessions. The dragon fixture (Battle only, via Replay): median
     **2 ticks** — it holds the 60fps target — and only **5.75%** at ≥5 ticks. So **per-beat trace/popup/wash
     churn is NOT the main term**; the heaviest *battle* board is the better performer. The mechanism is real
     (the fixture's 40.00 → 59.88 first/second-half split stands) but it is not where the budget goes.

  **Revised first step — do this BEFORE any pooling work:** `perf.ts` samples Battle, Draft and Placement into
  one unlabelled array, so no existing capture can attribute cost per scene. **Add a scene tag to each sample**
  (cheap, `?perf=1`-gated like the rest) and re-capture real play. Optimise what that points at. Pooling stays a
  candidate, not the plan.

  **Still true and unchanged:** the floor IS breached in ordinary play (9–13% of frames over 33.3 ms); it is
  imperceptible to the PO across many real games ("it felt smooth still"); the deferral stands and is now
  supported by the *stronger* dataset. Also newly supported: **this is long-standing, not an Epic 5
  regression** — no prior capture ever measured real play, and every earlier one read raw fps on a 120Hz panel
  without the tick correction.

  **INSTRUMENT AUDIT 2026-08-01 — why captures "lose the measurement" (Danilo's observation, mechanism corrected).**
  His hypothesis was that a link drops the `?perf=1` parameter during navigation. **That is not possible: the app
  contains no navigation at all** — `grep` over `apps/web/src/` finds zero `location.href` assignments, zero
  anchors, zero `window.open`; every screen change is a Phaser scene transition, which never reloads the page, so
  `window.location.search` (and therefore the arming check) survives the entire session. The PWA is not the culprit
  either: `registerType: 'autoUpdate'` with `skipWaiting`/`clientsClaim` makes the new SW take control immediately,
  but the injected registration is a bare `navigator.serviceWorker.register('./sw.js')` with **no `location.reload()`**,
  so a deploy does not force-reload an open tab. Two real mechanisms, both confirmed:

  1. **Unwired scenes leave INVISIBLE GAPS — the important one.** `attachPerfSampler` is called in exactly three
     scenes: `DraftScene`, `PlacementScene`, `BattleScene` (the three AC1 names). **Home, Reveal, Result, History,
     Help and Credits contribute zero samples.** So a "real play" trace is not continuous gameplay — it is a
     concatenation of Draft/Placement/Battle windows with unmarked seams, and nothing in the array says where one
     ends. This is why the real-play numbers above cannot be attributed per scene, and it is a second, independent
     reason the scene-tag fix must come first: without it, a real-play median silently blends interactive-scene
     cost with battle cost.
  2. **Any page reload silently resets `__perfSamples` to empty.** The buffer is `window`-scoped, so a reload
     restarts the capture at zero while `?perf=1` still arms correctly — sampling resumes and looks healthy. On
     Android, Chrome discards and transparently reloads a backgrounded tab under memory pressure, which is the
     likely explanation for the fourth session file starting from sample 0 while phone and laptop were being
     switched between during remote debugging.

  **So the tooling fix is now three things, all `?perf=1`-gated and all cheap:** (a) tag every sample with its
  scene key; (b) stamp a session/epoch id so a silent reload is visible in the data instead of looking like a
  fresh clean capture; (c) reset-on-scenario-start (or an explicit marker), which also fixes the three-for-three
  missed-reset problem logged above. Do these BEFORE optimising anything — every capture in this document so far
  is less trustworthy than its numbers imply, and that is precisely the story-3.4 failure mode repeating.

## Logged from: story 5.10 felt-balance pass (2026-08-01) — **PO FIGHT-SYSTEM FINDINGS: 4 confirmed deviations, OB64 fidelity**

Danilo played many real games and reported four problems. **All four are confirmed in the code** — none is
perception. His OB64 targeting research (pasted in full in the session, reproduced in summary below) is treated as
authoritative per the standing rule that OB64 is the design north star and his sourced rule research wins.

**This is NOT a story-5.10 change.** 5.10 is a certification story and Epic 5's fence forbids new mechanics. It is
also **not** a simple wish list: items 2–4 are engine-behaviour changes that would invalidate 5.10's balance
certificate (see the sequencing problem at the end). Route via `correct-course`.

### 1. Archer action counts are un-OB64 (data only) — CONFIRMED

`balance.ts` gives the Archer `actions: { front: 1, mid: 2, back: 2 }`. Per Danilo: the OB64 basic Archer acts
**twice only from the BACK row** → should be `{ front: 1, mid: 1, back: 2 }`. Pure balance data, but it removes a
whole action from every mid-row archer, which is a real nerf to `longbows`/`talons`/`farshot`/`gale` — the
archer-heavy half of the pool. Needs `balanceVersion` bump + hash re-pin + golden re-records + a both-mode sweep.

### 2. Ranged targeting ignores OB64's SECTOR rule — CONFIRMED, and it explains what he felt

**His observation:** "we target someone on the extreme opposite side of the board when we have someone on the same
side (closer)."

**The code:** `legalTargets('ranged', …)` returns **every living enemy, any row, any column** — `if (mode ===
'ranged') return living;` (`targeting.ts`). FR9 was written as "global range" and that is exactly what shipped.
Melee, by contrast, already implements the sector rule correctly via `reachableEnemyCols` (facing column ± 1 → a
corner unit reaches two enemy columns, the centre unit reaches all three), which **matches OB64**.

**OB64 per his research:** Left column → may target {Left, Center}; Right → {Right, Center}; Center → all three.
The restriction is structural, not tactical. So an own-left archer can currently shoot the enemy's far column, and
under OB64 it must not.

### 3. Ranged row priority is REVERSED vs OB64 — CONFIRMED, the bigger of the two

**His observation:** "we target someone in the backline when there's someone in the front."

**The code:** `rangedCmp` sorts `b.rowIndex - a.rowIndex` — **REARMOST row first**, deliberately ("arrows arc over
the front to snipe the back line"). `meleeCmp` sorts `a.rowIndex - b.rowIndex` (front first).

**OB64 per his research:** the archer runs a *depth search from closest to furthest* — scan Front (same column,
then centre), then Middle, then Back; take the first occupied cell. Front-first, not back-first.

**Both fixes together** would make Autonomous ranged = sector-filtered + front-first, i.e. the same ordering melee
already uses, while **keeping the legal list row-unrestricted so target tactics still arc over the front** — which
his research explicitly preserves ("Leader … bypassing front-row shields"). That is the coherent shape: melee keeps
its FR8 nearest-row *blockade*; ranged keeps a full-depth legal list but prefers the front under Autonomous.

**Blast radius:** `selectRangedTarget` is shared by the Archer, the Cleric's staff fallback, **Witch casts**, and
(since 5.4) every `bolt`. Changing it moves the whole meta, not just archers. FR9's wording needs amending too.

### 4. Sleep lasts the WHOLE ENGAGEMENT, not one turn — CONFIRMED, and it is the most likely real OP

**His observation:** "I would like to confirm if the witch effects are lasting only 1 turn, because it feels very
OP, sometimes I feel my frontline is sleeping forever."

**The code:** it is not one turn. `sleep` is added to `unit.statuses` and **never removed anywhere inside an
engagement** (`grep` for `statuses.delete` across the engine returns nothing). Every turn the unit gets
`ActionSkipped { reason: 'asleep' }` and loses the action. The only removal is the between-engagement seam
(`resolve.ts` — sheds every status except poison). **In SINGLE mode there is no next engagement, so a sleep landed
in pass 1 disables that unit for the entire battle.** With Witch AGI 26 (she acts early) and 2 actions from the back
row, one witch can remove two enemy units from a single-mode battle before they ever act. "Sleeping forever" is
literally what the code does.

Note the sweep does *not* flag this — `hex-coven` (3 witches) converges at 47.6% single — because AI-vs-AI both
sides get to do it. It is a **human-experience** problem, which is exactly the class of thing the harness has never
been able to see (PRD Open Item 1).

**A design decision is needed, not just a tuning value:** a fixed duration in turns/passes, a wake-on-damage rule,
a resist roll (would need an ADR-0003 draw slot — the frozen table forbids a silent insert), or accept-and-nerf
elsewhere. OB64 source evidence should settle it before any code, per the epic-4 team agreement.

### 5. Guard with nobody behind it is a suicide loop — CONFIRMED as a design gap

**His observation:** "the guard command from Knight and Phalanx is useless when you have no one behind to guard …
in case it's the only unit left, it's super weak to guard no one until you die."

**The code:** `applyGuard` shields a cell when the target holds a live charge **or** a living ally directly in front
of it does — so a guarding unit does protect *itself*, but the Phalanx's front/mid rows are `guard-full` and
`raiseGuard` spends the action with **no attack and no `UnitAttacked`**. A lone Phalanx therefore raises one
one-shot charge per turn forever, negates one hit per raise, never deals damage, and loses on the HP-fraction
judgement or grinds to the cap. He is right that this is strictly dominated behaviour.

**Proposed shape (needs his ratification):** a Guard row falls through to its class's attack (the `attackMoveOf`
back-row fallback already exists for exactly this "no attack shape" case) when there is **no living ally behind it
in the same column** — or, more narrowly, when it is the last living unit on its side. The narrow version is safer
for balance; the broad version is what he described. Either way it changes `act()`'s guard branch and needs a sweep
(Phalanx/bulwark/wardens all shift).

### ⚠️ THE SEQUENCING PROBLEM — this is the decision that actually matters

**Story 5.10's balance certificate goes stale the moment items 1–3 or 5 land.** Its whole purpose is to certify the
game that link-play will be built on: converged both-mode sweep, floors, the 27-class coverage guard. Change ranged
targeting and every one of those numbers is re-rolled — `selectRangedTarget` is on the hot path of archers,
clerics, witches and all casters.

Two coherent orders, and it is a PO call:

- **(a) Close 5.10 now, re-certify later.** Epic 5 ends on schedule, but the "ready for link-play" certificate
  describes a targeting model we already know we intend to replace, and a second full certification pass is owed.
- **(b) Hold 5.10 open, do the fidelity work first, certify once.** Coherent — you certify what you ship — but it
  widens Epic 5 past its own no-new-mechanics fence and delays the epic close.

Recommendation: **(b) via `correct-course`**, because item 4 (sleep) is a live human-facing balance problem and
items 2–3 are fidelity to the project's stated north star, not polish. Certifying the current model and then
immediately replacing it spends the certification twice.

## Logged from: story 5.10 / correct-course research pass (2026-08-01) — PO WISH: the "super critical" knockback

- **OB64 pushes a critically-hit unit one row BACK in the formation** (unless the cell behind is occupied) — a real
  sourced mechanic we do not model. Found during the independent OB64 research pass, not in Danilo's supplied
  research. We have had crits since story 4.6 (`critMultiplier` ×3/2, ADR 0003 A4) but no positional consequence.

  **PO decision (Danilo, 2026-08-01): wanted, but NOT as a plain crit, and NOT a priority.** His framing: *"critical
  pushing unit behind is a mechanic I want in the future (not every critical pushes it, we could handle it as super
  critical) but let's handle it in the future, not priority."* So the design shape is a **second, rarer tier above
  the existing crit** — a "super critical" that both multiplies damage AND displaces the target — rather than
  attaching knockback to every crit.

  **Why this is not cheap, recorded so it is scoped honestly when it comes up:**
  - **It needs an ADR 0003 amendment.** A super-crit tier means either a new draw or a re-read of the existing A4
    crit draw against a second threshold. The frozen table forbids a silent insert; the cleanest form is probably
    partitioning the existing A4 0–99 range (e.g. crit below X, super-crit below Y < X) so **no new draw is added
    and the table's count stays intact** — that is the option to explore first.
  - **It mutates placement mid-battle**, which nothing currently does. `snapshot.placement` is treated as fixed for
    the whole battle: action counts, move kinds, Guard's in-front geometry, melee reach, `selectBlastRow` and the
    breath/blast row rules all read from it. A unit changing rows mid-fight touches every one of those.
  - **It needs a new event** (a displacement) and therefore a **`logVersion` bump** — the first since 4.2. That is an
    era-scale change, which is exactly why it is not a bolt-on.
  - Interacts with the E5-D19/E5-D20 targeting work: knockback changes who is in the front row, which changes who
    the new front-first ranged order picks.

  **Route:** an Epic 6+ mechanic, sequenced with (or after) link-play — not Epic 5. Needs its own design sitting with
  OB64 evidence on the trigger rate and the blocked-cell rule before any code.
