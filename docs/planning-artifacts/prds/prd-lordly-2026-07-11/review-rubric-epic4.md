# PRD Quality Review — Lord Battle Tactics (Epic 4 amendment, 2026-07-16)

*Scope of this review: the Epic 4 amendment (FR1/FR4/FR14/FR15/FR19/FR24 amendments, new FR34–FR39, Feature 6b, Out of Scope re-cut, Open Items, Glossary additions) and its integration with the untouched sections. Long-settled MVP sections that passed the creation-gate rubric (`review-rubric.md`) are not re-litigated. Stakes: hobby, solo, but chain-top — this PRD feeds architecture deltas, UX, and story creation for Epic 4.*

## Overall verdict

The Epic 4 amendment is a genuinely well-made PRD update: decisions are stated as decisions with owners and dates, deviations from OB64 are recorded rather than smuggled, the Out of Scope re-cut is explicit, and the honest device of parking design deliverables in Open Items #3 (gated: "monster targeting semantics must be defined before any monster story") keeps the PRD truthful about what it doesn't know yet. The risk concentrates in two places: a handful of undefined behaviors escaped the Open Items net (how a two-row monster *acts*, what "degraded Autonomous" means, tactic tie-breaks under FR20 determinism), and several untouched sections still speak the language the amendment just dissolved — Goal 2 and the Glossary still define the game by "the triangle" that FR14 now demotes to a degenerate case. None of this blocks handoff for a hobby-stakes project, but the escaped-the-net items will surface as mid-story design questions if not swept into Open Items now.

## Decision-readiness — strong

The amendment is unusually decision-dense and honest about it. The mega-epic shape is a stated PO decision with the trade-off named ("one history invalidation, not several" — Feature 6b intro), and the addendum's Epic-4-pass rejected-alternatives table (§4) records what was given up (two-epic split, "1.5 spaces" monsters, instant-rout leader death) with reasons. Deviations from the OB64 source are flagged as deviations where they occur: FR34's "Deviation from OB64, recorded: tactics are fixed at placement" names the constraint (AD-2 resolve-once) and the escape hatch (future re-architecture, explicitly out of scope). The continuity constraint in FR14 ("today's 6 classes keep their effective matchups until the sweep says otherwise") is exactly the kind of pushback-anticipating clause this dimension looks for. The determinism constraint on crit/dodge draw order (Feature 6b, "fixed forever once shipped") shows the amendment absorbed the story-3.2 replay lesson rather than re-learning it.

No findings.

## Substance over theater — strong

Nothing in the new material reads as furniture. Every new FR earns its place by naming a mechanic, a constraint, or an owner; the `[ASSUMPTION]` tags carry real content (e.g. FR38's "a monster is hit once, not per-cell — to be confirmed") rather than hedging. The "start generic, iterate to unique" roster strategy (FR15 amendment) is an actual strategy with a rationale, not roadmap decoration. FR39's legibility list is grounded in specifics — a screenshot-evidenced shipped defect (f), a PO-flagged presentation problem (b) — not "the UI must be intuitive" boilerplate.

No findings.

## Strategic coherence — adequate

The amendment has a clear thesis — "the squad era + combat depth" as one coherent transformation, sequenced deliberately before link-play — and the features serve it: monsters force the slot budget, the bigger roster forces role-based relations, 5-unit squads unlock DEX. The NFR4 sweep with its ≤65% dominance band is a real validating metric, invoked consistently (FR10, FR14, FR19, FR35, FR36). But the amendment did not reach back into §2 Goals: Goal 2 is still titled "The triangle matters" with a triangle-shaped counter-metric, while FR14's own justification is Danilo's "with a large roster the triangle falls apart." The strategic bet changed from *triangle* to *role relations + tactics reads*, and the Goals section doesn't know it. There is also no stated success criterion for the squad era itself beyond the balance sweep — Goal 1's "fun on the phone" presumably extends, but the epic that doubles the game's complexity inherits its goals only by implication.

### Findings

- **medium** Goal 2 still bets on the triangle FR14 dissolved (§2 Goal 2, §8 Glossary "RPS") — Goal 2 reads "The triangle matters… no composition dominates" and the Glossary defines RPS as "the class triangle Mage > Knight > Archer > Mage," while amended FR14 makes the triangle "the degenerate case of the role data." The strategy sections and the requirement now describe different games. *Fix:* reword Goal 2 to "the matchup layer matters" (roles + tactics + placement), keep the triangle as the wave-0 instance; update the Glossary RPS entry to point at role relations with the triangle as the shipped degenerate case.

## Done-ness clarity — adequate

The amendment's strongest done-ness move is procedural: Open Items #3 enumerates the design deliverables and gates the hardest one ("monster two-cell targeting semantics… must be defined before any monster story is implemented"). Where behaviors are defined, they are testable — FR34's "a tactic only redirects choice *within* a unit's valid targets," FR38's footprint rule ("Front+Middle or Middle+Back, never horizontal, max 2, never share a column"), FR19's cap of 10, FR39's itemized (a)–(g). But several behaviors are neither defined nor flagged, and on a determinism-mandatory engine (FR20) "the design will sort it out" is only safe if the open question is *written down*. This is the dimension story creation leans on hardest; the findings below are the escaped items.

### Findings

- **high** FR38's open-semantics list covers how monsters are *targeted*, not how they *act* (§ FR38, § FR13, § FR15) — the gated list enumerates "row-blast, melee nearest-row blockade, ranged rearmost eligibility, and reach," all incoming. Unlisted: which row's FR15 action count a Front+Middle monster uses, which per-row move (FR32) applies, and how FR13's "front row before back" AGI tie-break resolves for a unit occupying two rows. Because FR38 presents its list as *the* core engine design task, an implementer can reasonably treat it as complete and discover the acting-side gap mid-story. *Fix:* extend FR38's open-semantics sentence (and Open Items #3) with "…and the monster's own row-dependent behavior: action count, per-row move, initiative tie-break."
- **medium** "Degraded Autonomous" is undefined and not in Open Items (§ FR35) — the leader-killed penalty "reverts to a degraded Autonomous," but FR34 defines Autonomous as today's fully deterministic targeting; what "degraded" adds is stated nowhere, and Open Items #3 lists only "leader penalty-state numbers," not the degraded-tactic semantics. *Fix:* either define it (e.g. "Autonomous with the center/left priorities randomized per action from the battle stream") or add "degraded-Autonomous semantics" to Open Items #3.
- **medium** Attack Weakest/Strongest: metric and tie-break unstated (§ FR34) — "lowest current HP" doesn't say absolute or percentage, and the PRD has deliberately chosen percentage elsewhere for exactly the fat-unit bias reason (FR11 heals by "lowest HP percentage"; the addendum §3 rejected absolute HP for judging because "class HP spans of 80–140" — spans that monsters will widen). And no tie-break is given when two enemies share the HP value; FR20 requires one. *Fix:* state the metric (recommend absolute HP for OB64 fidelity, with the bias trade-off noted) and the tie-break (fall through to FR8's column priority).
- **medium** FR36 doesn't scope which action kinds can crit/miss/be dodged (§ FR36) — "an attack may crit… or be dodged" leaves open whether a Mage row blast rolls per-target, whether a Witch status cast (FR12) can miss, and whether heals can crit; the lone assumption ("magic never crits") covers crits only. Each unanswered case is a seeded-draw-count question, and Feature 6b says every future seed depends on the draw order. *Fix:* one sentence scoping FR36 to physical attacks in wave 1 (OB64-faithful) or adding the scope question to Open Items #3.
- **medium** Reveal/hidden-info rules not extended to tactic and leader (§ FR5, FR6 vs FR34, FR35) — FR5 hides "composition nor placement"; FR6 reveals "the two boards." Whether the enemy's tactic and leader designation are revealed (at reveal? at battle? never?) is unstated — yet watching an Attack Leader battle without knowing who the leader is defeats FR39's legibility goal, and FR37 already implies reveal-card changes. *Fix:* amend FR6 (or FR39) to state that reveal shows both leaders (badge) and both tactics — or explicitly keep tactics hidden as a read-denial decision.

## Scope honesty — strong

This is the amendment's best dimension. The Out of Scope section header records the re-cut date; promoted items are listed by name with their new FR homes ("Promoted into Epic 4 scope… and no longer listed here"); the elemental wheel's re-deprioritization quotes the PO ("we can delay it"); Tamer/Master synergies and mid-battle tactic switching are parked with reasons rather than dropped. New assumptions are tagged inline throughout FR34–FR39 and each names what would resolve it. Open Items #4 even records a known ambiguity honestly (Archmage gating: "the PO's 2026-07-16 priority list did not name it" — confirm at story breakdown). The open-items density is high, but appropriately so for a committed-not-designed epic at hobby stakes, and the deliverables are owner-assigned.

No findings.

## Downstream usability — adequate

Cross-references resolve: AD-2/AD-10/AD-12 exist in the architecture spine, `sprint-change-proposal-2026-07-14.md` and `epic-4-design-pass-input-2026-07-16.md` exist at the cited paths, FR IDs are unique and contiguous (1–39). The Glossary was extended for the new vocabulary (Turn, Slot, Monster, Role, Leader, Tactic) — good discipline. Two integration seams remain where amended and untouched material meet.

### Findings

- **medium** "Role" now means two things (§ FR15 table vs § FR14, § Glossary) — FR14 makes "role" a load-bearing advantage-system term ("heavy melee, skirmisher, sniper…"), and the Glossary defines Role as "a class's advantage-system tag." But the pre-existing FR15 table has a column literally headed **Role** containing descriptive labels ("Neutral sellsword," "Back-row sniper") that are *not* that vocabulary — and "no RPS relation" in the Behavior column deepens the collision. A story author extracting the class table will read the wrong roles. *Fix:* rename the FR15 column to "Archetype" (or note it will be replaced by FR14 role tags at the Epic 4 design pass).
- **low** NFR6's contract sentence is stale (§ NFR6) — "army size is a parameter (3 now, 5-slot era later)" pre-dates both the MVP shipping and the FR1 amendment: the parameter is now a slot budget with footprint rules, and `MatchSetup` gains tactic (FR34) and leader (FR35). NFR6 is the forward-compatibility contract link-play will be built against; it should describe the post-Epic-4 shape. *Fix:* reword to "…the engine contract takes two submitted boards (slot-budget armies with tactic and leader) + seed."

## Shape fit — strong

Hobby/solo, chain-top, brownfield-by-now — and the amendment behaves accordingly on all three axes. Rigor is light where it should be (one match journey, no persona apparatus, no ceremony) while the substance bar holds; determinism, versioning, and sweep gates are treated as the load-bearing spine they are for an AI-built codebase; and the brownfield references are accurate and specific (story-3.0 sweep numbers in FR10, the story-3.2 replay lesson in Feature 6b, the screenshot-evidenced label defect in FR39f). The single mega-epic with incremental story acceptance is the right shape for a one-person cadence, and the PRD says why.

### Findings

- **low** DEX-carries-evasion is a silent OB64 deviation (§ FR15 vs addendum §1) — the addendum's OB64 notes record "AGI (initiative + evasion), DEX (accuracy + crit)," but FR15 assigns "accuracy, evasion, and critical hits" all to DEX. Probably a fine simplification, but the PRD's own habit (FR34, Out of Scope) is to *record* deviations, and FR36's design work will trip over it. *Fix:* one parenthetical in FR15 or FR36: "(deviation: OB64 put evasion on AGI; we consolidate on DEX)."
- **low** The ≤65% dominance band has no home in NFR4 (§ FR14, FR19 vs § NFR4) — the band is now the epic's recurring acceptance gate, but it appears only inside FR amendments; NFR4 itself still says the harness "can flag dominant strategies" with no threshold. Downstream extraction of "what does the sweep enforce" starts at NFR4 and finds nothing. *Fix:* state the band (and the both-modes requirement) in NFR4 as the canonical location.

## Mechanical notes

- **Addendum front-matter is stale:** `addendum.md` says `updated: 2026-07-12` but contains §4 "Epic 4 design-pass additions (2026-07-16)." Bump the date.
- **No Assumptions Index:** all `[ASSUMPTION]` tags are inline-only. This is the PRD's pre-existing pattern (passed the creation gate), and the new FR34–FR39 assumptions follow it consistently — noted, not penalized; the rubric's roundtrip check is n/a.
- **ID continuity:** FR1–FR39 unique, no gaps. FR31 sits out of numeric order under Feature 6 (pre-existing, harmless).
- **Cross-refs verified:** AD-2/AD-10/AD-12 (architecture spine), `sprint-change-proposal-2026-07-14.md`, `epic-4-design-pass-input-2026-07-16.md`, brief path — all resolve.
- **Glossary drift:** "RPS" entry vs amended FR14 (raised as a medium finding under Strategic coherence); otherwise the new entries (Turn/Slot/Monster/Role/Leader/Tactic) match FR usage.
