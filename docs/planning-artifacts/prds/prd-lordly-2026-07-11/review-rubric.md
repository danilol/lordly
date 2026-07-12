# PRD Quality Review — Lord Battle Tactics (prd-lordly-2026-07-11)

## Overall verdict

A genuinely strong hobby PRD: the rules spec (Features 3–5) is precise enough to serve as the test spec it claims to be, the thesis ("all skill is spent *before* the clash") visibly drives every feature, and scope omissions are explicit rather than implied. The risks are concentrated where the PRD's own quality bar is highest — a few determinism-relevant underspecifications (arithmetic rounding, Confusion edge cases) that will surface as blocking questions during engine story writing, and the absence of a glossary/assumptions index that a chain-top PRD feeding UX + architecture + epics would benefit from. Nothing here blocks proceeding to architecture.

## Decision-readiness — strong

Decisions are stated as decisions, and the addendum's rejected-alternatives table (§3, addendum) is exemplary for the stakes: eight decisions with the chosen option, the rejected one, and a *why* that names what was given up (e.g., win metric: "Kills-first with HP tiebreak" rejected for "one metric, readable at a glance"; initiative: "fixed class order (round-1 draft)" superseded by the AGI timeline, "user-confirmed"). Goals carry real counter-metrics — Goal 2's "the game must not become pure counter-picking either" and Goal 4's "the battle animation must be long enough to *watch and enjoy*" are honest tensions, not smoothing. §7 Open Items are actually open (balance numbers, until-wipeout timing, speed default) with an honest triage ("not a phase blocker"). No `[NOTE FOR PM]` callouts exist, but for a solo creator who is the PM, the `[ASSUMPTION]` tags carry that function adequately.

### Findings

*(none — nothing would add information)*

## Substance over theater — strong

Almost nothing here is furniture. Personas are two sentences (§3: "the creator and his friends... zero tolerance for installs or accounts") and they drive real requirements (no accounts → NFR5; bus-stop → FR27's 5-minute loop). NFRs are product-specific throughout: NFR1 names "Pixel 6a class," "60 fps, floor 30," "≤ 5 s on 4G"; NFR2 names the exact property tests ("every battle terminates; judging is symmetric; same seed → identical battle log") and a coverage gate. The Executive Summary could not swap into another PRD — "distills Ogre Battle 64's automated squad combat into a five-minute match" is a specific bet.

### Findings

- **low** One adjectival clause in a first-class NFR (§5 NFR3) — "code documented to the standard of a maintained open-source project" is the only unmeasurable clause in an otherwise concrete NFR (README, rules doc, ADRs are all named artifacts), and documentation is one of the two user-elevated concerns. *Fix:* replace with 1–2 checkable conditions (e.g., "every exported engine function carries a doc comment; module-level README per package"), or explicitly delegate the bar to the architecture doc.

## Strategic coherence — strong

The PRD has a clear thesis stated in the first paragraph — "all skill is spent *before* the clash, in class picks and placement reads" — and the feature set serves it: hidden simultaneous placement (FR5), the reveal as a payoff beat (FR6, and the §3 journey's "the reveal already tells him he's ahead"), deterministic resolution (FR20), and the rejected-alternatives entry that names it outright ("placement decides who fights whom — the chess-like read is the game's core skill"). Success criteria validate the thesis rather than measuring activity (Goal 2 "class picks and placement visibly decide outcomes" instead of session counts), and counter-metrics are present. The second agenda (BMAD proof, Goal 5) is declared openly and cleanly explains why NFR2/NFR3 are elevated. MVP scope kind is coherent: an experience MVP ("a complete, fun match against an AI opponent"), with forward-compatibility requirements (FR20, NFR6) justified by the named second epic rather than speculative generality.

### Findings

*(none)*

## Done-ness clarity — strong

Judged unforgivingly, as the rubric demands, this still holds up: Features 3–5 are written as an executable rules reference — targeting priorities are total orders ("① facing column, ② column closer to center, ③ left over right", FR8), tie-breaks are specified down to "a seeded coin flip" (FR13), formulas are given (FR15), and internal consistency checks out (the FR13 assumption's intended initiative order Witch → Archer → Mercenary → Mage → Cleric → Knight matches the FR15 AGI column exactly; FR1's "56 possible compositions" is arithmetically correct). The findings below are the residue, and they matter more than usual because NFR2 declares "the FR text is the test spec" and FR20 demands tick-for-tick identity.

### Findings

- **medium** Arithmetic conventions unspecified (§4 FR15, FR16, FR18) — the formulas involve non-integer intermediate values (`VIT(target)/2`, `INT × 1.25`, Weaken's "damage is halved", FR18's HP-percentage comparison) with no rounding/precision rule. Under FR20's "identical battle, tick for tick" and NFR2's test-spec claim, two correct implementations could disagree. *Fix:* one sentence declaring the convention (e.g., "all damage/heal values floor to integers after all multipliers; HP percentages compare exactly as rationals").
- **medium** Confusion misfire edge cases unhandled (§4 FR16, Wind) — "attacks strike a random ally of the target" doesn't say what happens when the target has no living ally; only the Cleric misfire is specified ("may heal a random enemy"), leaving a confused Witch's spell and a confused Mage's row blast undefined. *Fix:* add a misfire rule per action type plus a no-valid-misfire-target fallback (e.g., "action is wasted" or "self-hit").
- **medium** AI strategy pool undefined (§4 FR25) — "a pool of curated strategies (composition + formation archetypes) with seeded variation" gives the story writer no pool size, archetype list, or selection rule, and unlike other deferred design it isn't tagged as an open item (the adjacent `[ASSUMPTION]` covers difficulty, not the pool). *Fix:* either tag it (`[ASSUMPTION: pool contents are epic-phase design]`) or bound it (e.g., "≥ 6 archetypes, at least one back-row-sniper punisher").
- **low** FR2's consequence is untestable (§4 FR2) — "enough that a first-time player can draft without a tutorial" is a UX aspiration, not a verifiable condition. *Fix:* hand it off explicitly ("card content and comprehension bar defined in the UX spec") or state the observable proxy (a friend completes a first draft unassisted).
- **low** Bundle-size bound is derivative (§5 NFR1) — "total bundle small enough to make that true" defers to the 5 s / 4G load bound, which is workable, but a numeric budget would make the check local. *Fix:* optional — name a budget (e.g., ≤ 3 MB compressed).

## Scope honesty — strong

Omissions are explicit and load-bearing. §6 Out of Scope does real work — it doesn't just list cuts, it names the landing zones ("**attribute growth** — ... the FR15 attribute model is their landing zone"; "elemental-affinity wheel ... building on FR3's rolls"), which is what keeps the forward-compatibility requirements honest rather than speculative. Fourteen inline `[ASSUMPTION]` tags sit at genuine inferences (multipliers, AGI ordering, coverage gate, element re-rolls), and the open-items density is appropriate for hobby stakes — high tag count, but every tag is a tuning value or playtest question, not a load-bearing unknown. De-scoping is done in the open (FR19 "stretch, ship only if cheap"; DEX "reserved" with the reason stated).

### Findings

- **low** No Assumptions Index (§7 / end of PRD) — the ~14 inline `[ASSUMPTION]` tags are never rolled up, so the epics phase has no single sweep-list of what playtesting must confirm. The tags are findable by grep, hence low, but the index is nearly free. *Fix:* append an Assumptions Index table (tag → location → what confirms it).

## Downstream usability — adequate

This is a chain-top PRD (architecture, UX spec, epics/stories all consume it), so the dimension carries full weight. The good news: FR IDs are contiguous FR1–FR30 with no gaps or duplicates, NFR1–NFR6 likewise, cross-references are dense and (with one exception, see Mechanical notes) resolve, and Feature 3's preamble explicitly nominates itself as "the definitive description of targeting... for players, tests, and the AI" — a section that extracts cleanly. Terminology is consistent in practice: "engagement," "pass," "action," "reach" are each defined at first use and used identically after.

What's missing is the formal layer: there is no Glossary, so the vocabulary lives only in-place inside FRs — a UX-spec or story extraction that pulls FR12 alone gets "magic targeting (rearmost reachable, as FR9)" where FR9 titles itself "*Ranged* targeting," and must chase the chain to reconstruct the term. The §3 "match journey" has a named protagonist (Danilo) carrying context inline, which satisfies the UJ intent for this shape; there are simply no UJ/SM IDs to reference, which downstream tooling should be told is deliberate.

### Findings

- **medium** No Glossary despite chain-top role (whole document) — domain nouns (engagement, pass, reach, lane, element, prepared spell, "magic targeting") are defined only where they first appear, so each downstream consumer re-derives the vocabulary; the "magic targeting" vs "Ranged targeting" naming (FR9/FR11/FR12) is exactly the kind of drift a glossary would pin. *Fix:* add a ~10-entry glossary; define "magic targeting" once and have FR9/FR11/FR12 share the term.

## Shape fit — strong

The shape matches the product and the stakes precisely. Hobby/solo calibration is applied where it should be — two-sentence personas, one narrative journey instead of a UJ inventory, no ceremony sections — while rigor is spent exactly where the user elevated it: NFR2/NFR3 are the most detailed NFRs in the document, and Features 3–5 are deliberately over-specified *with the justification stated* ("deliberately exhaustive — it doubles as the rules reference for players, tests, and the AI"). The addendum split is also correct shape discipline: OB64 research, rejected alternatives, and architecture input are kept out of the requirements body but preserved for the architecture doc. Nothing is over-formalized; nothing consumer-shaped is missing.

### Findings

*(none)*

## Mechanical notes

- **Broken cross-reference:** FR5 cites "(FR26)" for "the AI opponent must commit its choices without reading the player's" — the hidden-information rule is **FR24**; FR26 is decision-time/offline. Low blast radius (FR24 is adjacent and obvious) but worth fixing before story extraction.
- **Assumptions Index roundtrip:** fails trivially — no index exists (see Scope honesty finding). All inline tags are well-formed.
- **Glossary drift:** no glossary (see Downstream usability). Specific instances: "magic targeting" (FR11, FR12) vs FR9's self-description "Ranged targeting"; "blockade" appears in NFR2's test list and the addendum but the rule itself (FR8) never uses the word — a test named "blockade" won't grep to its FR.
- **ID continuity:** FR1–FR30 and NFR1–NFR6 contiguous, unique. No UJ/SM IDs exist (deliberate, per shape).
- **Internal consistency spot-checks passed:** FR15 AGI column reproduces FR13's assumed initiative order exactly; FR1's "56 possible compositions" = C(8,3), correct; addendum's OB64 row tables are consistent with the FR15 actions column (with the Archer back-row deviation explicitly flagged as deliberate in addendum §1).
- **Protagonist naming:** the single journey (§3) names Danilo and carries context inline. Satisfied.
- **Required sections for stakes/type:** present — goals with counter-metrics, FRs, NFRs, out-of-scope, open items; addendum carries research and rejected alternatives.
