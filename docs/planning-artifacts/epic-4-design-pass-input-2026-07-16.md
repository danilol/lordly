# Epic 4 design-pass input — Danilo's vision dump (2026-07-16)

Captured verbatim-in-intent from Danilo immediately after the epic-3 retro, with three reference screenshots (two OB64 battle scenes, one current-build board). This is the PO input the epic-3 retro's action item 1 ("Epic 4 design pass — bring the full idea list") called for. **Danilo: "It's a lot. But I think it's my priority."** The pass (John + Winston + Danilo) shapes this into PRD amendments, epics, and sequencing — nothing here is scoped or committed until then.

## A. The squad era — "work on the game I target"

1. **5-unit squads, OB64-style.** Army size moves from 3 to 5. (Landing zone already exists: army size is `MatchSetup` data per AD-1, "5-slot era" was parked in the PRD from day one.)
2. **Monsters / big units** — dragon, golem, etc. **CORRECTED at the pass (2026-07-16) to the exact OB64 rule** (initially approximated as "1.5 spaces"; Danilo's unit-count examples already matched the real rule): a monster occupies **2 slots of the 5-slot budget** — `1 monster + 3 smalls = 5 slots (4 units)`, `2 monsters + 1 small = 5 slots (3 units)`, max 2 monsters per squad. **Physical footprint: vertical, one column** — a monster fills Front+Middle or Middle+Back of a single column, never horizontal across columns, and two monsters can never share a column (different columns required). "Big" is about size-class, not theme — a zombie or fairy is monster-themed but SMALL (1 slot). (OB64 reference images 1–2: large sprites sharing formation grids with small units.) Engine design consequences to resolve downstream: how a two-cell unit interacts with row-blast (hit once or per-row?), melee nearest-row blockade, ranged rearmost-row eligibility, and reach — the footprint rule is set; the targeting semantics are the architecture/design work.
3. **Roster growth toward OB64 breadth.** Many more classes. Strategy: **start generic, iterate into unique** — ship them as stat/role variants first, give each its special mechanic in later iterations.
4. **The triangle falls apart at scale** — Danilo's own call: with many classes, Mage>Knight>Archer>Mage stops carrying the meta. NEEDS DISCUSSION (see design questions below).

## B. Combat depth (Epic 4's existing index, priorities updated)

5. **Target-selection tactics implemented NOW** — autonomous / attack-weakest / attack-strongest / **leader** — "so the combat is like OB64". (Was already Epic 4; PO raises it to the non-negotiable core.)
6. **Leader designation.** A designated leader unit (interacts with the leader tactic). LATER evolution: special characters with names and stories.
7. **Critical strike + dodge** (already indexed — DEX's reserved purpose).
8. **Attack blocks / shielding units** (FR33 "Guard" — already indexed).
9. **"More magic"** — broader spell/ability variety (design pass scopes what this means concretely).
10. **Class spec cards improved** — with more mechanics, the draft-card descriptions must carry the added depth.

## C. Identity

11. **Random generated unit names** (OB64 has them). Feasibility answered at capture time: CHEAP — a pure seeded function over a syllable/name table, drawn from a named RNG stream, deterministic per seed so replays keep identical names, zero dependencies. Real costs are only: the name-table content, an AD-10 stream addition (closed set — engine API change), and UI space to show names.

## D. Presentation & battle clarity

12. **Label contrast bug (image 3, current build):** the class label is tinted the side color and sits on the side-colored board — red "WIT/KNI" on red tiles, blue on blue — barely readable. Contrast fix needed. *(Small, could ship before/alongside Epic 4 — it's a legibility defect, not a feature.)*
13. **Attacks must read as from→to:** melee attacker should MOVE to the target (approach animation) instead of damage just popping on the defender's head; projectiles (arrow), magic, and heals need clear origin→target visuals.
14. **Remove the "front" word** on the battle board — self-evident now.
15. **Action-economy clarity — placement AND battle:**
    - At placement/draft: surface the per-row action counts ("Mage on the back has 2×, on the front 1×") so positioning is an informed choice — better than today's presentation.
    - During battle: a live action ledger — "Mage has 2× per turn → attacked → 1× left … next turn resets" — so new players can follow who acts, how often, and why. **Display design is the hard part** (Danilo: "the way we are going to display it is very important").
16. **Reword "Pass" → "Turn"** (player-facing). Design decision: display-layer rename vs. engine-vocabulary change (PRD glossary "pass", `PassStarted` event — a display rename costs nothing; an engine rename is a logVersion concern).
17. **Maybe a pause button** in vs-AI battles.

## E. Balance / modes

18. **Wipeout engagement cap 5 → 10** — "5 engagements is too few". ⚠️ Constraint: this is FR19 balance data → `balanceVersion` bump + NFR4 both-mode sweep re-run (poison and blast-attenuation compound differently over 10 engagements). Should ride Epic 4's single combined bump — never ship alone as a second history-invalidating bump.

## F. Explicitly deprioritized by the PO

19. **Elemental affinity / status-affinity damage wheel — DELAYED.** "We can delay it, since I consider it less priority." (Stays parked; FR3's rolls remain the landing zone.)

## Design-pass questions (the discussions Danilo asked for)

- **RPS at scale:** what replaces/extends the triangle with a large roster? Candidate directions: multi-ring triangles, a data-driven affinity matrix (AD-4 balance data), or OB64's approach (no hard RPS — niches from stats/mechanics + the existing one-way `rpsHunts` pattern generalized). Must keep the NFR4 sweep meaningful as the roster grows.
- **Monster mechanics:** space cost 1.5 — how does it interact with the 3×3 grid (footprint? one cell but budget-weighted?), targeting (bigger target?), stats budget, blast/row interactions, reveal/placement UX.
- **Leader:** what does leader-death mean (OB64 rout? judging modifier?) — scope the mechanic now, the named-character fantasy later.
- **Sequencing:** this list is bigger than one epic. Likely shape: combat-depth core (tactics, crits/dodge, guard, action-ledger UX) vs. squad-era (5 slots, monsters, roster growth) vs. clarity quick-wins (items 12, 14, 16-display) — John/Winston propose the cut; **at most one combined logVersion+balanceVersion bump per epic**, each bump marking stored history non-replayable (3.2 UX handles it).
- **Determinism constraints carried from the retro:** crit-vs-miss draw ORDER fixed forever (FR20); name-stream addition is a closed-set AD-10 change; tactics enter `MatchSetup` (new player choice = new stored data).

## Carried-in items that must not be forgotten at the pass

- Wardens-33% melee floor (3.0 sweep) — tactics should fix wasted swings.
- StatusCleared events ride the single combined bump (epic-2 retro item).
- Winston's text-ceiling scheduling decision (hard deadline: this pass).
- Non-replayable-history UX confirmation once the bump lands.
