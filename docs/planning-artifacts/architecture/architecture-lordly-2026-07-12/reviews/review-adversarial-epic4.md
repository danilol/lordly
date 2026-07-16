---
type: adversarial-review
target: ../ARCHITECTURE-SPINE.md (Epic 4 amendments of 2026-07-16)
reviewer: adversarial-lens
created: '2026-07-16'
verdict: CONDITIONALLY BUILD-READY — 8 compliant-but-incompatible pairs; 2 critical must close before the first Epic 4 story merges
---

# Adversarial Review — Architecture Spine, Epic 4 Amendments

**Method:** same game as the 2026-07-12 review — I play two independent dev sessions, each handed one Epic 4 story and this spine. Both obey every AD and convention *to the letter*. If their outputs cannot link, agree on data shapes, or agree on who mutates what, the spine has a hole. This round has a new weapon the first review didn't: **shipped code**. Epic 4 stories land on top of `packages/engine/src/{types,balance}.ts` and `apps/web/src/flow/{MatchFlow,placement}.ts`, so any amendment that contradicts what a dev will actually read in those files is a hole even if the prose is self-consistent.

**Verdict up front:** the amendments are good. AD-14 (one unit, one anchor), AD-15 (one bump per era), and the AD-9/AD-10 extensions each close exactly the kind of hole the first review hunted. I could not break monster *identity*, the stream *set*, or the version *choreography* as stated. What I broke lives in three places: (1) shipped fields the amendments forgot to retire (`armySize`, `rpsBeats`, shell-side `placement.ts`), (2) the gap between AD-12's "at minimum" list and AD-15's frozen single bump, and (3) words the amendments use but never define ("anchor", "per-attack draw"). Eight holes: 2 critical, 3 high, 3 medium. Fixes proposed inline; every fix is a tightening of an existing AD, none requires a new architecture.

---

## Finding 1 — CRITICAL: `armySize` still exists, so "5 slots" has two compliant unit-counts and `commit()` rejects a legal dragon army

**The pair:** *engine slot-budget validation* (packages/engine) vs *draft-scene budget UI* (apps/web).

AD-1 (amended): *"a slot budget plus per-class slot costs live in the balance data (budget 5, small = 1 slot, monster = 2) — never a hardcoded constant outside the balance data."* Both my devs comply: nobody hardcodes anything, everybody reads the balance file. And they still collide, because the spine amends the *prose* but not the *shipped field*:

- `balance.ts` ships `armySize: number` with the doc comment *"Army size is data, never a hardcoded constant elsewhere (AD-1)"* — the exact AD citation a dev greps for.
- `MatchFlow.ts` gates on it in three places: `draftUnit` (`playerArmy.length >= BALANCE.armySize` → "army is full"), and `commit()` (`playerArmy.length !== BALANCE.armySize || placedCount() !== BALANCE.armySize` → `"cannot commit: place all ${BALANCE.armySize} units first"`).
- NFR6 reinforces the wrong reading in writing: *"army size is a parameter (3 through the MVP; the 5-slot budget from Epic 4)"* — as if budget were the same axis as size.

**Build A (engine story):** adds `slotBudget: 5` and per-class `slotCost` (via size class) to the balance data; `validateMatchSetup` accepts any army whose slot costs sum to 5 — including the FR1-legal 2-monsters-+-1-small army of **three units**. Fully compliant with amended AD-1.

**Build B (draft UI story):** reads `BALANCE.armySize` — the existing, typed, AD-1-annotated field — sets it to 5, and gates draft/commit on **unit count**, exactly as the shipped `MatchFlow` does today. Also fully compliant: the value is data, not a constant.

**The collision:** the player drafts dragon + golem + knight (5 slots, 3 units). The engine validator would bless it; `commit()` throws `"cannot commit: place all 5 units first"` and the match is unplayable. Or Build B's dev "fixes" `armySize` to mean slots while `draftUnit`'s length check still counts units — now a 5-small army drafts fine but a monster army can overshoot or undershoot depending on which check fires first. Under FR1 the identity `unit count == budget` that the whole MVP relied on is *gone*, and no AD says which shipped comparisons die with it.

**Fix — tighten AD-1:**
> The balance fields are `slotBudget` and per-size-class `slotCost`; the field `armySize` is **deleted in the same change** (a compile break, not drift — every shipped call site must be revisited). The engine exports `slotTotal(units): number`; all gating anywhere — draft-full, commit, `validateMatchSetup` — is `slotTotal === slotBudget`. **No code may compare `army.length` to the budget.** Unit count is variable (3–5) and always derived. `placements` stays parallel-indexed to `armies` per unit (variable length is fine; AD-14's one-anchor-per-unit already guarantees one entry per unit).

---

## Finding 2 — CRITICAL: AD-12's "at minimum" list + AD-15's one-bump freeze + AD-2's everything-in-the-log = the Epic 4 shell cannot legally render the epic's own features

**The pair:** *engine log-extension story* vs *battle-scene renderer + FR39b action-ledger story*.

AD-12 enumerates Epic 4's single extension "at minimum": crit/missed/dodged on the attack event, `StatusCleared`, a leader-death/penalty event. AD-15 freezes it: *one* `logVersion` bump per era, designed complete up front. AD-2 binds the other side: *"anything the UI needs to show must be an event in the log"*; the battle scene *"never evaluates a combat rule"*; AD-13 hands the scene *"the `BattleLog` read-only."* Now walk what Epic 4's shell must actually show, against the shipped `UnitSnapshot` (`id, side, class, element, placement, hp, maxHp`):

- **FR37 names** — "names show at minimum on placement/reveal cards **and battle**." Not in the snapshot, not in the listed extension. (AD-11's "display names are shell-side lookups" covers *class* names keyed by class — a generated per-unit name is match data, not a lookup.)
- **FR35/FR6 leader marking** — the reveal and battle must mark each side's leader; the penalty display must persist after leader death. Not in the snapshot, and the stored `setup.tactics` stays saying `'leader'` after the engine's penalty event reverts the effective tactic — a tactic HUD drawn from setup lies from the leader's death onward unless the log narrates the reversion *with its effect*, not just the death.
- **FR38 monster footprint** — the renderer must draw a two-cell sprite from a one-cell `placement`. Deriving the second cell is footprint reasoning (see Finding 3).
- **FR39b/c action ledger** — "Mage has 2 actions this turn → used 1 → 1 left." Actions-per-row is a combat rule (`balance.classes[c].actions[row]`, plus FR32 row move-kinds) — re-deriving it is exactly what AD-2 forbids; and for a monster, *which row's action count a Front+Middle body uses* is a semantic AD-14 explicitly reserves to the engine's targeting module. The shell **cannot** legally compute the ledger. There is no event carrying it.

**The collision:** the engine dev ships exactly the enumerated minimum and bumps `logVersion` — once, frozen, per AD-15. The scene dev now has two compliant-looking outs, both poisoned: smuggle `MatchSetup`/balance data into the battle scene and re-derive (violates AD-2/AD-13, and is *impossible* for the monster ledger without duplicating AD-14 semantics), or request a snapshot/event extension — a **second bump inside the era**, which AD-15 forbids. The spine's own freeze converts an enumeration gap into a dead end.

**Fix — amend AD-12's Epic 4 extension clause:**
> The extension's design story derives the payload by **walking every render surface of FR35, FR37, FR38 and FR39a–g** and naming the log field that feeds it — the enumerated events are a floor, not the design. Concretely, at minimum beyond the current list: `UnitSnapshot` grows `name`, `isLeader`, size class + resolved footprint cells; `BattleStarted` (or a header event) carries each side's placement-time tactic; the leader-penalty event carries the side and the effective-tactic reversion; the action economy is log-carried (e.g. `PassStarted` carries per-unit planned action counts, or acted events carry `actionsRemaining`). **Gate: the `logVersion` bump may not ship until every FR39 surface names its field.** (This is the same discipline the first review's Finding 4 bought for FR16 — re-apply it to FR39 before, not after, the bump freezes.)

---

## Finding 3 — HIGH: "anchor" is undefined — a Middle+Back golem fights in one pair of cells and renders in another

**The pair:** *engine monster-placement validation* vs *placement-scene drag logic / history-card renderer*.

AD-14: placements store *"a single anchor cell; the second occupied cell is derived from its size class."* Derived **in which direction**? FR4 allows two footprints per column: Front+Middle and Middle+Back. So `anchor: mid` is ambiguous by construction:

- **Build A (engine validator):** anchor = the footprint's **front-most** cell; derivation extends one row *back*. `front → {front, mid}`, `mid → {mid, back}`; `back` is an invalid anchor.
- **Build B (drag/render):** the scene stores the cell the finger dropped on, and the history card / reveal renderer draws the sprite extending *forward* from the stored cell: `mid → {front, mid}`, `back → {mid, back}`.

Both store one anchor. Both derive the second cell from the size class. Integrate them: the player drops a golem intending Middle+Back; the stored anchor means Mid+Back to the engine and Front+Mid to the card — the battle you watch and the formation the history card swears you placed disagree by a row, and the blockade/rearmost math (all engine-side, correct!) looks like a bug to every eyeball. This is precisely the chirality class of bug the project has already been burned by (mirror bugs pass symmetric tests — the memory note exists for a reason): both derivations pass every "footprint has two vertically adjacent cells in one column" invariant test.

**Second hole in the same AD:** AD-14 says placement validation is "the only code that reasons about the footprint's legality" and targeting semantics are engine-only — but the *renderer* must still know both cells to draw a sprite, and the *placement scene* must know them to occupy grid slots. If the derivation function isn't exported, every one of those call sites re-implements it — a second owner of the exact truth AD-14 was written to single-own.

**Fix — tighten AD-14:**
> The anchor is the footprint's **front-most cell** (nearest the enemy), stated in the AD; valid monster anchors are `front` and `mid`, and `validateMatchSetup` rejects `back`. The engine exports one derivation, `footprintCells(sizeClass, anchor): Placement[]`, used by the validator, the targeting module, and every shell consumer — and per Finding 2, `UnitSnapshot` carries the resolved cells so the battle scene never even calls it. Drag UX may *display* whichever cell the finger is on; what it **stores** is the anchor as defined here.

---

## Finding 4 — HIGH: AD-14's legality monopoly vs. live drag feedback — and the shell already owns a placement model

**The pair:** *engine placement-validation story* vs *placement-scene drag story*.

AD-14: *"Placement validation (engine-owned, with FR4's column/verticality rules) is the only code that reasons about the footprint's legality."* The engine dev complies: FR4's rules (vertical adjacency, no horizontal, two monsters never share a column) live in `validateMatchSetup`, which takes a **complete `MatchSetup`** and throws typed errors (spine errors convention: "the shell validates all user input before calling the engine" — at commit).

The drag dev has a shipped precedent staring at them: `apps/web/src/flow/placement.ts` — a shell-side *"pure placement model"* that has owned move/swap mechanics since FR4 v1 (when "any arrangement is legal" made shell ownership harmless). Their story needs **per-drag** legality: highlight legal cells while a dragon hovers, reject a drop that would put two monsters in one column, *before* commit. `validateMatchSetup` is unusable mid-drag (partial boards, unplaced units, no `MatchSetup` yet). So the compliant-looking move is to extend `placement.ts` with the column/verticality rules — which violates AD-14's letter, except AD-14 offers **no legal path** to live feedback at all. The alternative compliant build (let illegal drops sit and surface the engine throw at commit) obeys every AD and is unshippable UX. Whichever copy of the rules the drag dev writes *will* drift from the engine's the first time the Epic 4 design story settles an edge case (may a monster anchor sit in a column whose other cells are occupied by a small unit mid-swap? etc.).

**Fix — amend AD-14:**
> The engine exports an **incremental legality query** — `canPlace(board, unit, anchor): boolean` / `legalAnchors(board, unit): Placement[]` — sharing one implementation with `validateMatchSetup` (the batch validator is a fold over the incremental check). `web/flow/placement.ts` delegates every legality question to it and keeps only move/swap/selection mechanics. "Only code that reasons about legality" then means *only implementation*, with an exported query — not *only call site*.

---

## Finding 5 — HIGH: `leaders` is an index into a list two other stories are still allowed to reorder

**The pair:** *placement-scene leader/tactic story* vs *draft-scene budget/swap story* (with the *engine validator* as the helpless bystander).

AD-9 fixes `leaders: { A, B } // unit index into that side's army`. AD-13 says only `MatchFlow` mutates `MatchState`. Both my devs comply — every mutation goes through a `MatchFlow` method — and still corrupt the entity, because **two compliant mutation paths share one referent and no invariant ties them**:

- The placement story adds `setLeader(unitIndex)` and `setTactic(t)`, stored in `MatchState` (FR4: placement designates both).
- The draft/budget story keeps — and under FR1 *needs more than ever* — `removeUnit(index)`, which splices `playerArmy`/`playerPlacements` and shifts every subsequent index. Swapping a monster in/out to re-spend slots is the epic's core draft interaction, and `removeUnit` is legal in any phase except `committed`.

`setLeader(3)` → back to draft → `removeUnit(1)` → the crown silently lands on a different soldier. No error, no AD violated; `validateMatchSetup` can only check the index is in range — it *is* in range, on the wrong unit. The same shape hits **tactic defaulting**: one compliant `commit()` requires an explicit tactic; another defaults an unset tactic to `'autonomous'` — two compliant assembly shapes for the same field, and the AI-vs-player symmetry (FR24: the AI *must* commit a tactic) breaks silently if the player side may default.

**Fix — amend AD-13 (with a note on AD-9):**
> `MatchState` carries the leader designation and tactic; **any army mutation (add, remove, reorder) clears the leader designation**, and `MatchFlow` surfaces that so the UI re-prompts. `commit()` refuses to assemble a `MatchSetup` without an explicit tactic and a currently-valid leader — no defaults on the player side. `validateMatchSetup` checks both leaders in range; whether a monster may be leader is an Epic 4 design decision that gets **pinned into AD-9's shape comment once made** (an unstated answer here is Finding-3-grade ambiguity for the AI story, which must construct a leader index over a mixed-size composition).

---

## Finding 6 — MEDIUM: the continuity constraint invites two matchup truths in one balance file

**The pair:** *engine role-relation data story* vs *draft-card matchup display story*.

FR14's continuity constraint — *"the shipped triangle and the archer's caster-hunt MUST be reproducible as the degenerate case of the role data"* — has two compliant readings, and the shipped file bribes the wrong one: `balance.ts` ships `rpsBeats` and `rpsHunts`, typed, documented, resolver-integrated.

- **Build A (engine):** adds `roles: Record<UnitClass, Role>` + a role-relation table; keeps `rpsBeats`/`rpsHunts` in the file as the continuity reference (or worse: still live as a fallback for classes without roles). Compliant — AD-4's amendment says the new data is added "in the same versioned data file"; it never says the class-level maps are retired.
- **Build B (draft card):** renders each class's matchups from `rpsBeats`/`rpsHunts` — the existing, typed fields. Compliant with AD-4 (imports the engine's data, redeclares nothing).

**The collision:** the six new classes have roles but no `rpsBeats` entries — the card shows them matchup-less while the resolver applies role relations; the card teaches a different game than the engine plays, in the exact feature (FR14: "the draft card teaches the role") the role model exists to serve. And if Build B instead computes effective multipliers from the role table itself, it re-implements relation resolution (symmetric vs one-way precedence, multiple applicable relations) — a second owner of combat math.

**Fix — tighten AD-4:**
> Role relations **replace** `rpsBeats`/`rpsHunts`, which are deleted in the same change (compile break). Continuity is enforced by a **test** — the role-derived class-vs-class matrix for the six shipped classes equals the shipped effective matchups — not by keeping the old data alive. The engine exports the single query `advantage(attackerClass, defenderClass): Ratio`, used by the resolver, the sim harness, and every card/tooltip; no shell code walks the relation table.

---

## Finding 7 — MEDIUM: "fixed per-attack draw order" fixes the order — not the count, the conditionality, or the fan-out

**The pair:** *engine targeting-pipeline story* vs *engine crit/dodge story* (two independent sessions inside the same package — AD-10's own text says the order is "designed once, frozen forever," so getting it half-specified is maximally expensive).

AD-10's Epic 4 note pins that crit and dodge ride the `battle` stream in a fixed per-attack order. Three questions it does not pin, each with two compliant answers that consume **different numbers of draws** — and every draw consumed shifts every subsequent random event in the battle, so the divergence isn't a wrong number, it's a *different battle* from the same seed:

1. **Fan-out:** is a Mage row blast one attack (one dodge draw) or per-target (one draw per living target, list-order)? "Per-attack" reads both ways when one action has three targets.
2. **Conditionality:** does a magic attack — which "never crits" per the FR36 assumption — still *consume* a crit draw? Draw-when-applicable vs unconditional-schedule both satisfy a "fixed order."
3. **Interception:** does an FR33 Guard-negated attack consume its draws before or after (or at all)?

Two compliant engine builds resolve the same `MatchSetup` to different logs; worse, the *first* one to ship freezes its accidental answer forever (every stored seed depends on it), and any later targeting change that alters how many targets an attack has silently re-randomizes shipped history.

**Fix — tighten AD-10's Epic 4 note:**
> The schedule is **unconditional and per-target**: every attack action consumes exactly N draws per entry in its target list, in list order (dodge, then crit — drawn and discarded even when the outcome cannot apply, e.g. the magic crit draw). Guard resolves *after* the draws. The schedule is pinned by golden battles in the same story that lands the first crit — before any second engine story touches resolve.

---

## Finding 8 — MEDIUM: nobody owns the AI's name roll — the shipped precedent and AD-9's wording point at different homes

**The pair:** *name-roll-at-draft story* vs *AI-setup-construction story*.

AD-9: rolls happen *"via the engine-exported roll functions on that side's streams, at the moment the unit is added"* by *"the draft flow."* Side B has no draft flow. The shipped precedent (`MatchFlow.commit()`) rolls `elements/B` during setup assembly, in the shell. So:

- **Build A (name story):** mirrors elements exactly — `commit()` rolls `names/B` per AI unit during assembly. Compliant (it's where `elements/B` already happens).
- **Build B (AI story):** AD-6 now has the AI emit composition, placement, tactic, leader — and the units it "adds" need names "at the moment added," so `chooseSetup` returns named `Unit`s, rolling `names/B` inside the engine AI module (pure, side-B stream — reads as compliant).

**The collision:** merged, either `names/B` is consumed twice (the AI's internal rolls *and* commit's — the committed names are whichever code ran last, and the reveal shows names the battle didn't store), or the two stories fight over `chooseSetup`'s return shape (today `classes: UnitClass[]`) in a way both sides believe the spine sanctions. There's also a quiet AD-6 smell in Build B: the AI's declared input is *its own* stream `ai/B`; `names/B` is side B's but not the *AI's* — the AD's blindness argument never contemplated the AI module holding a second stream at all.

**Fix — amend AD-6 and AD-9 jointly:**
> The AI module's inputs remain exactly (strategy pool, `ai/<side>` stream); its outputs are classes, placements, tactic, leader — **it never touches `elements/*` or `names/*`**. For both sides, the flow's setup assembly (`commit()` for live play; the sim harness's setup builder for NFR4) is the **sole caller** of `rollElement`/`rollName`. AD-9's phrase "the draft flow rolls" becomes "the setup assembler rolls" with the player-side timing rule (at the moment the unit is added) kept as the FR3 UX requirement it is.

---

## Summary table

| # | Severity | Seam | One-line hole | Fix target |
|---|----------|------|---------------|-----------|
| 1 | CRITICAL | engine validation ↔ draft UI | `armySize` (unit count) vs slot budget — `commit()` rejects a legal 3-unit monster army | AD-1 |
| 2 | CRITICAL | engine log extension ↔ battle scene/ledger | frozen single bump omits names, leader, footprint, action economy the shell may not re-derive | AD-12 (+AD-15 gate) |
| 3 | HIGH | engine placement ↔ drag/render | "anchor" direction undefined — Mid+Back fights as stored, renders as Front+Mid | AD-14 |
| 4 | HIGH | engine validator ↔ drag feedback | legality monopoly offers no live-query path; shell `placement.ts` precedent invites a rule fork | AD-14 |
| 5 | HIGH | placement scene ↔ draft mutations | leader index goes stale under `removeUnit`; tactic defaulting unowned | AD-13/AD-9 |
| 6 | MEDIUM | balance data ↔ draft card | `rpsBeats`/`rpsHunts` survive beside role relations — two matchup truths | AD-4 |
| 7 | MEDIUM | targeting story ↔ crit/dodge story | draw count/conditionality/fan-out unpinned — same seed, different battles, frozen forever | AD-10 |
| 8 | MEDIUM | name roll ↔ AI construction | two compliant homes for `names/B` — double consumption or return-shape clash | AD-6/AD-9 |

**Gate recommendation:** close Findings 1 and 2 (both are AD-text amendments plus one design-story acceptance rule) before the first Epic 4 story merges; Findings 3–5 before their respective placement/draft stories; 6–8 are one-paragraph tightenings that should ride the same spine edit while it's open. Nothing here re-litigates the paradigm — every hole closes by naming an owner or a direction the amendments already implied but never wrote down.
