---
title: "Input Reconciliation: ogre_game.txt vs PRD Lord Battle Tactics"
status: draft
created: 2026-07-12
---

# Input Reconciliation — `ogre_game.txt` → PRD + Addendum

Compares the user's original idea dump (`/Users/danilo/projects/js/lordly/ogre_game.txt`) against
`prd.md` and `addendum.md` in this folder. Goal: find anything the original asked for that the PRD
silently dropped or contradicts.

**Known deliberate scope decisions, excluded as gaps by instruction:** "1 vs 1 friend with a link"
moved to a post-MVP epic (AI-first MVP); "simple turn-based combat" evolved into OB64-style
auto-battle engagements; no world map.

## Coverage map (original ask → where it landed)

| Original text | Status | Where |
|---|---|---|
| No hand-written code; Claude Code + BMAD generates everything | Covered | Exec summary, Goal 5, NFR2 |
| Playable on his Android phone | Covered | FR29–FR30, NFR1 (PWA, portrait, mid-range Android) |
| `~/projects/{language}/{name}` convention; brainstorm the tech together | Covered in practice | Repo lives at `~/projects/js/lordly`; TypeScript/Phaser decided (NFR2, addendum §2) |
| Strategy game like Ogre Battle 64, favorite game | Covered | Whole PRD framing; addendum §1 OB64 research |
| MVP playable board, 1 vs AI | Covered | Feature 7, FR24–FR26 |
| 1 vs 1 friend with a link | Known scope decision | Second epic; FR20/NFR6 keep it rework-free |
| Focus on strategic board positioning + class choices | Covered | Goal 2, Features 1–3 |
| Simple turn-based combat | Known evolution | Auto-battle engagement (Features 3–5); user-confirmed initiative model (addendum §1) |
| Few simple but engaging classes | Covered | 6 classes, FR15 |
| Pokemon / rock-paper-scissors: Mage>Knight>Archer>Mage | Covered | FR14, exact same triangle |
| Archer in the back attacks 2x | Covered | FR15 table (back row 2 actions); addendum notes the deliberate deviation from OB64's middle-row sweet spot |
| Mage does area damage | Covered | FR10 row blast |
| Knights tank and attack 2 in the front | Covered | FR15 (Knight front 2, highest HP/VIT) |
| "Both players have same amount of units to position" | Covered explicitly | FR1 ("Both players always field the same army size"), NFR6 keeps size a parameter |
| Squads of up to 5, formations front/back | Parked | 3-unit MVP; "additional classes and 5-slot squads (top post-MVP priority)" in Out of Scope |
| Tactics orders ("Attack Leader", "Attack Weakest"…) | Parked | Out of Scope + addendum §1 four-tactics table |
| Class changes / promotions, equipment, items | Parked | Out of Scope (promotions, items, equipment) |
| Critical hits | Parked | DEX reserved, crits post-MVP (FR15, Out of Scope) |
| The OB64 *feeling*: watch your plan work, indirect control | Covered | FR21 ("Indirect control is the fantasy"), Goal 4 counter-metric |

## Gaps found

### Gap 1 — User-supplied references not all carried into the research digest (moderate)
The original lists six OB64 sources. The addendum's digest cites ogrebattle64archive.com,
lparchive.org, and GameFAQs/CyricZ, but three user-supplied links appear nowhere in PRD or
addendum:
- `http://nickexamples.atspace.cc/Ogre/` — **character stats building**. Directly relevant: FR15's
  six-attribute model exists precisely as the landing zone for post-MVP leveling/growth, and this
  is the one source the user gave specifically about stat growth. It should be cited in addendum
  §1 (initiative/attributes section) or at least in the post-MVP leveling parking-lot note so it
  isn't lost by the time leveling is designed.
- `https://ogrebattle64.net/` (fan page) and the archive.org **Prima's Official Guide** — lower
  stakes, but they were handed over as research inputs and are now referenced nowhere.

**Suggested fix:** add the three links to addendum §1 sources, flagging nickexamples as the
reference for the future attribute-growth epic.

### Gap 2 — Isometric battle view is underspecified (soft/qualitative, moderate)
The original quotes the isometric battle scene twice as *the* trademark moment ("the screen view
switches to an isometric view of a pre-rendered battlefield"; "transitions to an isometric view,
where characters execute semi-real-time attacks"). FR21 commits only to "an animated OB64-style
scene: the two formations face off in lanes" — it never says isometric (or any perspective). A
flat side-view or top-down scene would satisfy FR21's letter while missing the visual fantasy the
user's source material emphasizes. This is exactly the kind of soft desire that dies silently in
UX phase.

**Suggested fix:** either name the perspective aspiration in FR21 (e.g. "isometric or
pseudo-isometric presentation preferred, per OB64") or record the perspective question as an
explicit UX-phase decision in Open Items, so dropping isometric becomes a deliberate call rather
than a drift.

### Gap 3 — Parries never mentioned or parked (minor)
The pasted Wikipedia text calls out "a vast array of attacks, critical hits, and **parries**."
The PRD parks crits and evasion under reserved DEX (FR15, Out of Scope) but parries appear in
neither document — not implemented, not rejected, not parked. Almost certainly the same post-MVP
bucket as evasion, but today it is silently dropped.

**Suggested fix:** add "parries" to the DEX-reserved list in FR15 / Out of Scope so the bucket is
complete.

### Gap 4 — Squad-leader mechanic only appears as descriptive reference (minor)
The original reference text makes leaders load-bearing: every unit must contain a leader, leader
choice is restricted, and (per addendum's own research) a dead leader crippled and routed the
squad; Magnus dying was game over. The PRD has no leader concept, which is defensible for 3-unit
armies — but unlike tactics orders or 5-slot squads, the leader mechanic itself is not parked
anywhere (it survives only inside the parked "Attack Leader" *tactic name* and addendum prose).
When the 5-slot era arrives, "does a squad have a leader, and does killing it matter?" will need
an answer, and nothing currently queues that question.

**Suggested fix:** one line in Out of Scope or the addendum parking lot: "squad-leader slot and
leader-death rout — evaluate with the 5-slot era."

### Noted, not counted as gaps
- **Mid-clash influence** (original quote: "swap formations or use items while the tactical map is
  paused"): the PRD's battle is fully hands-off after Ready. This is pasted OB64 description, not
  an explicit ask — the user's stated focus was pre-battle positioning — and items/tactics are
  parked. Recorded here only so the omission is visibly deliberate.
- **"Semi-real-time / multiple characters act at once"** vs the PRD's strictly sequential AGI
  passes (FR13): resolved — the addendum records the user's own 2026-07-12 correction that OB64's
  real mechanic is an AGI timeline with the multihit split, which FR13 implements faithfully.
  Simultaneity can still be faked visually in FR21 animation if desired.
- **Technology choice**: the user asked to "brainstorm and decide together"; the decision
  (TS/Phaser/PWA, `~/projects/js/`) is reflected in NFR2/addendum §2 and the repo location.

## Verdict

No contradictions with the original ask; the explicit mechanical requests (RPS triangle, archer
2x back, mage AoE, knight front tank 2x, equal army sizes, hidden simultaneous placement) are all
present with stable FR IDs. Four gaps, all recoverable with small edits: three user-supplied
references dropped (one relevant to the planned leveling epic), the isometric-view desire
unstated in FR21, parries unparked, and the squad-leader mechanic unparked.
