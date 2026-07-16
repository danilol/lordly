# Cross-Document Consistency Review — Epic 4 PRD Amendment

**Reviewed:** 2026-07-16
**Scope:** `prd.md` (amended 2026-07-16), `addendum.md`, `epic-4-design-pass-input-2026-07-16.md`
**Verdict:** The amendment is largely coherent and traceable, but it is **not internally closed**: the determinism contract (FR20) was not extended to the new battle inputs, one input item ("more magic") and two carried-in items (wardens melee floor, text-ceiling decision) are silently dropped, and several untouched sections (glossary RPS, exec summary, match journey, Feature 3 preamble) still describe the pre-Epic-4 game as if it were current.

Severity scale: **HIGH** = a downstream team following the letter of the PRD will build the wrong thing or miss committed scope. **MEDIUM** = ambiguity or stale text that will cost a clarification round. **LOW** = cosmetic/historical, fix opportunistically.

---

## 1. Internal contradictions (amended vs. untouched sections)

### C1. HIGH — FR20's determinism input tuple omits tactic and leader (prd.md line 105)

FR20 (untouched): "A battle is a pure function of (both compositions with their rolled elements, both placements, one random seed)." Epic 4 adds two new player choices that alter battle outcomes: the army **tactic** (FR34, "stored in `MatchSetup`") and the **leader designation** (FR35, whose death triggers a stat-penalty state). Neither is in FR20's enumerated tuple. The input doc itself flagged this ("tactics enter `MatchSetup` (new player choice = new stored data)") but the amendment only carried the draw-ORDER constraint into Feature 6b, not the input-set extension.

Knock-on effects of the same omission:

- **FR28** (untouched): history persists "winner, both compositions, date, seed" and the assumption claims this "makes past battles replayable via FR20". Post-Epic-4 replay also needs each side's tactic and leader (leader is arguably part of "placement" per FR4; tactic is not). Note FR28 already never mentions storing placements — a pre-existing looseness that the new inputs make untenable.
- **NFR6** (untouched): "two submitted boards + seed → battle log" — "boards" must be re-stated as MatchSetup (board + tactic + leader) or the link-play contract is under-specified.

**Fix:** re-state FR20's tuple (and FR28's stored fields, and NFR6's contract phrase) to include the full `MatchSetup` — placements incl. leader, tactic, rolled elements, seed.

### C2. MEDIUM — Feature 3 claims to be "the definitive description of targeting" but is now only the Autonomous tactic (prd.md lines 55, 60–61 vs. FR34)

The Feature 3 preamble: "This section is the definitive description of targeting." FR8/FR9's column-priority rules (① facing column, ② closer to center, ③ left over right) are, per FR34, only the **Autonomous** default — Attack Weakest/Strongest/Leader override the *choice among* eligible targets. FR34 correctly says reach/blockade/rearmost still constrain eligibility, but FR8/FR9 carry no forward reference to FR34 and still read as unconditional. A reader (or test author — NFR2 says "the FR text is the test spec") implementing from Feature 3 alone will hard-code the priority order. **Fix:** one sentence in the preamble or FR8/FR9: column priority applies under the Autonomous tactic; other tactics redirect selection within the same eligible set (FR34).

### C3. MEDIUM — FR13 initiative tie-breaking is undefined for a two-cell monster, and this gap is not in the open-semantics list (prd.md line 65 vs. FR38, line 124)

FR13 ties: "equal AGI → front row before back, then left before right." A monster occupies two rows (Front+Middle or Middle+Back) — which row is it "in" for the tie-break? FR38 enumerates the open two-cell semantics as "row-blast, melee nearest-row blockade, ranged rearmost eligibility, and reach" — the initiative tie-break row is missing from that list, and from Open Item 3, and from addendum §4's matching list. As written, the gap is not even acknowledged. (Same question applies to FR8's "left before right" for any future horizontal footprint — explicitly excluded today, fine.) **Fix:** add the tie-break row (and FR10's "row with the most living enemies" *count* — does a monster count in both rows?) to FR38's open-semantics list and Open Item 3.

### C4. MEDIUM — FR10's Archmage parking cites Feature 6b, but Feature 6b omits it and Open Item 4 says it's undecided (prd.md lines 62, 116, 176)

Three statements disagree: FR10 says Archmage blast-gating is "explicitly parked as an Epic 4 design item (Feature 6b)"; Feature 6b's delivery list does not mention it; Open Item 4 says "confirm in or out of Epic 4 wave 1 at story breakdown — the PO's 2026-07-16 priority list did not name it." So is it an Epic 4 design item or an open in/out question? **Fix:** change FR10's parenthetical to point at Open Item 4 (status: undecided), or add it to Feature 6b — pick one authority.

### C5. MEDIUM — Glossary "RPS" still defines the class triangle as the system, contradicting amended FR14 (prd.md line 189 vs. line 69)

Glossary: "**RPS** — the class triangle Mage > Knight > Archer > Mage and its damage multipliers (FR14)." Amended FR14 says relations are defined **between roles, not classes**, and the triangle is only the degenerate/continuity case. The glossary entry cites FR14 for a definition FR14 no longer gives, and sits three lines above the new **Role** entry that says the opposite. Related staleness: Goal 2's heading "**The triangle matters**" (line 23) — the goal's substance (picks + placement decide, no dominant comp, counter-picking counter-metric) survives role relations, but the name now points at a mechanism the PRD says "falls apart." **Fix:** re-word the RPS glossary entry ("the role-based advantage relations (FR14); shipped as the class triangle Mage>Knight>Archer>Mage, preserved as the degenerate case") and consider renaming Goal 2 ("Advantage matters" / "Counters matter").

### C6. MEDIUM — Executive summary and match journey still describe the 3-from-6 game as current (prd.md lines 14, 35)

- Line 14: "Each player secretly drafts 3 units from 6 classes" — presented as the game's standing definition, one sentence before the Epic 4 commitment. Post-amendment this is stale 3-unit arithmetic in the document's most-read paragraph.
- §3 match journey (line 35): "the draft screen shows six class cards; he taps Knight, Knight, Mage" — 3 units, 6 classes, no tactic, no leader, no unit names, no monsters. Fine as a shipped-MVP vignette, but nothing labels it as era-bound the way FR1 labels itself ("the original MVP shipped with exactly 3 units").

**Fix:** either re-cut both to the 5-slot era or add an explicit "(MVP-era journey; Epic 4 adds tactic/leader/monster steps at placement)" marker.

### C7. LOW — FR5/FR6 hidden-information and reveal don't cover tactic and leader (prd.md lines 50–51)

FR5 hides "composition nor placement"; tactic and leader are also secret pre-commit choices (FR24 confirms the AI commits them blind). FR6's reveal doesn't say whether tactic/leader are shown at reveal or discovered during battle — an information-design decision with gameplay consequences (an "Attack Leader" read depends on it). Not in Open Items. **Fix:** extend FR5's hidden set; add reveal-visibility of tactic/leader to Open Item 3 or FR39's UX scope.

### C8. LOW — FR3 elements on monsters unaddressed (prd.md line 45 vs. FR38)

FR3 (untouched): "As each unit is added to the army, it is assigned a random element." Monsters are units, so a dragon rolls Fire/Water/Wind/Earth with "no combat effect" — plausibly intended, but element-vs-monster (e.g. elemental breath as a later signature mechanic per the "start generic, iterate to unique" strategy) is nowhere acknowledged. Also note FR3's roll order ("as each unit is added") now interleaves with name-stream draws (FR37) — draw-order determinism across streams is covered by AD-10's named streams, so no contradiction, just worth an architecture glance.

### C9. LOW — DEX's "3-unit battles are too swingy" rationale recurs inside Epic 4's own scope (prd.md line 76)

FR15's DEX note: reserved because "misses are too swingy in a 3-unit battle; Epic 4's 5-unit squads lift that condition." Per FR1, a 2-monster army **is** a 3-unit army (and "5-unit squads" is itself imprecise — armies are 3–5 units on a 5-slot budget). The swinginess argument was never re-examined for monster-heavy armies; the NFR4 sweep will police it in practice, but the stated rationale is self-inconsistent. **Fix:** re-word to "5-slot armies" and let the sweep clause carry the balance claim.

### C10. LOW — FR18 judging vs. leader penalty: checked, no contradiction — but "degraded Autonomous" is undefined

FR18's HP-percentage judging is untouched by leader death (the design pass explicitly chose penalty-state over rout/judging-modifier — addendum §4 confirms). Judging symmetry (NFR2 property test) survives since both sides can enter the penalty state. One loose end: FR35's "tactic reverts to a **degraded** Autonomous" — "degraded" is undefined anywhere (addendum says only "degraded autonomous behavior"); Open Item 3 covers penalty *numbers* but not the degraded-targeting behavior itself. Add it to Open Item 3.

### C11. LOW — Goal 5 still calls link-play "the second epic" (prd.md line 26)

"(gate for the second epic, not the MVP)" — Epic 4 is now sequenced before link-play (exec summary, Out of Scope line 160), so link-play is not "the second epic." **Fix:** "the link-play epic."

### C12. LOW — Untouched spec surfaces that enumerate rules by Feature number exclude Feature 6b

- FR27 (line 135): help screen "content = Features 3 & 4 rules" — post-Epic-4 the rules a first-timer needs include tactics, leaders, monsters, crits (Feature 6b).
- NFR2 (line 147): engine test mandate covers "every battle rule in Features 3–5" — Feature 6b now contains battle rules (FR32–FR36, FR38).
- NFR3 (line 151): rules document "aligned with Features 3–5."

**Fix:** change the three enumerations to "Features 3–5 and 6b" (or fold 6b's stabilized rules back into Features 3–5 at story breakdown).

### C13. LOW — FR25's AI archetype definition lacks the new decision dimensions (prd.md line 130)

FR24 (amended) makes the AI commit tactic + leader, but FR25's strategy pool is still "(composition + formation archetypes)." Open Item 5 acknowledges tactics/leaders as new *sweep* dimensions; the AI archetype definition should name them too. Also trivial: Open Item 5 says the pool grows "from 6 classes/10 archetypes" while FR25 says "~8–12 archetypes."

---

## 2. Coverage — epic-4-design-pass-input items 1–19, design questions, carried-in items

| Input item | Disposition | Where |
|---|---|---|
| 1. 5-unit squads | Represented | FR1 (5-slot budget — more precise than the input's "5-unit") |
| 2. Monsters, exact OB64 rule | Represented | FR38, FR4; open semantics in FR38 + Open Item 3; addendum §4 |
| 3. Roster growth, generic→unique | Represented | FR15 amendment (12 classes, wave strategy) |
| 4. Triangle falls apart | Represented | FR14 role relations |
| 5. Tactics NOW | Represented | FR34; addendum §1 header updated |
| 6. Leader (+ named chars later) | Represented | FR35; named heroes in Out of Scope |
| 7. Crit + dodge | Represented | FR36 |
| 8. Guard | Represented | FR33 (pre-existing) |
| **9. "More magic"** | **DROPPED — see G1** | — |
| 10. Class spec cards improved | Represented | FR15 amendment last sentence → FR2 |
| 11. Generated names | Represented | FR37 |
| 12. Label contrast bug | Represented | FR39(f) |
| 13. From→to attack reads | Represented | FR39(d) |
| 14. Remove "front" label | Represented | FR39(e) |
| 15. Action-economy clarity (placement + battle) | Represented | FR39(b)(c); Open Item 3 flags ledger as UX-owned |
| 16. Pass→Turn | Represented | FR39(a) + glossary "Turn" |
| 17. Pause button | Represented | FR39(g), wave-1-optional |
| 18. Wipeout cap 5→10, rides combined bump | Represented | FR19 amendment; Feature 6b single-bump rule |
| 19. Elemental wheel delayed | Parked | Out of Scope with PO quote |

Design questions: RPS at scale → FR14 (+ addendum §4 rejected alternatives). Monster mechanics → FR38 + Open Item 3 (see C3 for the missing initiative facet; the question's "reveal/placement UX" facet is only implicitly covered by FR4/FR6 — acceptable). Leader-death meaning → FR35 (penalty state; rout rejected in addendum §4). Sequencing → Feature 6b mega-epic + addendum §4 "Epic shape" row. Determinism constraints → Feature 6b (draw order), FR37 (AD-10 stream), FR34 (MatchSetup) — but see C1: the MatchSetup consequence never reached FR20.

### G1. HIGH — Input item 9, "More magic," is silently dropped

"Broader spell/ability variety (design pass scopes what this means concretely)" appears nowhere: not an FR, not in Feature 6b, not in Out of Scope, not in Open Items, not in addendum §4. The nearest neighbors (FR15's "earn their signature mechanics in later iterations," FR10's Archmage parking) cover different things. Since the input doc's contract is that every item is shaped or explicitly parked, this needs a line — most likely in Out of Scope ("broader spell variety — folded into later class-uniqueness waves") or Open Items.

### G2. MEDIUM — Carried-in item "Wardens-33% melee floor" is dropped

"Tactics should fix wasted swings" — the expectation that FR34 remediates the 3.0-sweep melee-floor finding is a validation criterion for the epic, but no FR, Open Item, or addendum note carries it. Cheapest fix: one clause in FR34 or Open Item 3 ("sweep must confirm tactics lift the melee floor observed in the 3.0 sweep").

### G3. MEDIUM — Carried-in item "Winston's text-ceiling scheduling decision (hard deadline: this pass)" is dropped

The input doc says this decision was due at this pass; neither the PRD nor addendum §4 records a decision or a deferral. It may belong in architecture rather than the PRD, but the pass output must say *where* it went — currently it vanished. (Fourth carried-in item, non-replayable-history UX confirmation, is adequately carried by Feature 6b's "the 3.2 UX marks stale entries non-replayable"; StatusCleared is explicitly carried in Feature 6b.)

---

## 3. Cross-reference audit

**FR citations in amended text — all resolve, all say what's claimed:** FR1↔FR38 (2-slot cost, both directions), FR4→FR34/FR35/FR38, FR14→NFR4 sweep band, FR15(DEX)→FR36, FR24→FR34/FR35, Feature 6b→FR1/4/14/15/19/32–39 (all exist), FR34→FR7/FR8/FR9/FR35, FR35→NFR4, FR36→FR20 draw-order constraint, FR37→FR28-style zero-storage claim (consistent), FR38→FR1/FR14/FR15, FR19→FR18. AD-2/AD-10/AD-12 citations are architecture-side, out of this review's corpus, but used consistently between prd.md and addendum §4. Exception: FR10's "(Feature 6b)" citation — see C4.

**Glossary vs. FR definitions:** Slot↔FR1 ✓, Monster↔FR38 ✓ (incl. "a zombie is small"), Role↔FR14 ✓, Leader↔FR35 ✓, Tactic↔FR34 ✓ (four values match), Turn↔FR39(a) ✓ (engine keeps "pass" — matches addendum §4 rejected-alternatives row). Exception: **RPS** — see C5.

**Addendum §4 vs. PRD text:** monster deployment paragraph matches FR38 verbatim-in-substance, including the same four open-semantics items (so C3's missing initiative facet is missing in both); leader rules match FR35 (penalty state, mid-battle switching rejected → Out of Scope, initiative perks = wave-1 decision → Open Item 3, Tamer/Master parked → Out of Scope; addendum's "Beast Master → beasts" not echoed in the PRD's Out of Scope examples — trivial); rejected-alternatives table consistent with FR14 (role relations), FR38 (exact OB64 over "1.5 spaces" — matches the input doc's CORRECTED note), FR35 (penalty over rout), Feature 6b (mega-epic), FR39(a)/glossary (display rename).

**Addendum staleness (LOW):**
- Front-matter `updated: 2026-07-12` despite §4 dated 2026-07-16 (addendum.md line 5).
- §2 line 68: "AI vs AI over all 56 compositions" — stale 3-from-6 arithmetic (56 = C(8,3)); the 5-slot/12-class space is orders of magnitude larger. Open Item 5 supersedes it, but §2 reads as current architecture input; add a dated strike-through or pointer.
- §3 "Targeting model" row: "tactics orders deferred to parking lot" — now committed (FR34). §1's tactics section got an update marker; this row didn't. Historical-table convention arguably covers it, but the inconsistency between the two markers is noticeable.
- §1 line 26: "Our FR15 table keeps the OB64 counts unchanged" — still true for the shipped 6; wave-1 additions will need this paragraph revisited (no action now).

---

## 4. Summary of required fixes, ranked

1. **C1 (HIGH):** extend FR20/FR28/NFR6 to the full MatchSetup input set (tactic, leader).
2. **G1 (HIGH):** disposition input item 9 "more magic" somewhere explicit.
3. **G2/G3 (MEDIUM):** record the wardens-melee-floor validation hook and the text-ceiling decision's destination.
4. **C2/C3/C4/C5/C6 (MEDIUM):** Feature-3 preamble forward-ref to FR34; add initiative tie-break to the monster open-semantics lists; reconcile FR10↔Feature 6b↔Open Item 4 on Archmage; update glossary RPS (+ Goal 2 heading); refresh/mark the exec summary and match journey.
5. **C7–C13 + addendum staleness (LOW):** opportunistic.
