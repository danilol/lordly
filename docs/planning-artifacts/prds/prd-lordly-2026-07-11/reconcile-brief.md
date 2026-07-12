---
title: "Reconciliation: Brief → PRD (Lord Battle Tactics)"
status: draft
created: 2026-07-12
---

# Brief → PRD Reconciliation — Lord Battle Tactics

Inputs: `briefs/brief-lordly-2026-07-11/brief.md` (approved) + `addendum.md`.
Targets: `prds/prd-lordly-2026-07-11/prd.md` (draft) + `addendum.md`.

Known deliberate changes, excluded from findings: Zombie → Mercenary rename; Witch spell keyed to a random per-unit element rolled at draft; six-attribute (STR/VIT/INT/MEN/AGI/DEX) stat model; AGI-timeline initiative with multihit split. All four are recorded with rationale in the PRD addendum §3 — good provenance.

## Gaps (brief promised, PRD dropped or contradicts)

### GAP-1 — Art direction dropped entirely (dropped scope item)
Brief MVP scope, explicitly in the **In (MVP)** list: "Free/CC fantasy pixel-art sprite packs (itch.io, OpenGameArt, Kenney) — no custom art production." The brief addendum §1 also records it as a decision with rejected alternatives (AI-generated sprites, geometric placeholders) and the rationale "looks like a real game from sprint 1 at zero production cost."
The PRD contains **no requirement about art source, style, or licensing** — not in the FRs (FR2 mentions "sprite", FR21 mentions "OB64-style scene" without an art requirement), not in the NFRs, not in Out of Scope, not in the PRD addendum. Without it, "no custom art / CC-licensed pixel packs" is unstated and the sprint-1 look commitment is lost. Suggest an FR or NFR (art sourced from free/CC pixel packs; license attribution requirement is a natural NFR5 companion).

### GAP-2 — Success criterion 4 "The link works cold" not represented
Brief lists five success criteria; #4: "A friend with no explanation completes a 1v1 match from just a shared URL (post-MVP epic)." The PRD's Goals & Success Criteria has five goals, but #4 was replaced by the match-length goal; the link criterion appears nowhere as a success measure. Link-play does appear as scope framing (exec summary "second epic", NFR6 forward compatibility, Out of Scope), so the *feature* isn't lost — but the measurable *criterion* (cold-start comprehension from a bare URL) is, and the PRD claims to state requirements "so the link-play epic needs no rework." Either restore it as a marked post-MVP success criterion or note explicitly that it transfers to the link-play epic's own PRD.

### GAP-3 — Win metric contradiction: absolute HP vs percentage of starting HP
Brief ("Battle resolution"): single engagement winner = "the side with **more total HP remaining**." Brief addendum §2 open question only asked about a kills tiebreaker. PRD FR18: winner = "the side with the **higher percentage of its total starting HP remaining**."
These are materially different rules: class HP pools differ widely (Knight 140 vs Mage 80 per FR15), so absolute-HP judging favors high-HP compositions while percentage judging normalizes for them. Percentage is arguably the better rule, but the change is **undocumented** — the PRD addendum §3 win-metric row records only the rejected kills-first tiebreak, not the absolute→percentage switch. Should be confirmed as deliberate and recorded, or reverted.

## Verified as carried over (no action)

- **Brief addendum open questions** — all answered: Witch casts/targeting/duration/stacking (FR12, FR15, FR16); tiebreaker (FR18: draw + rematch, PRD addendum §3); wipeout anti-stalemate (FR19: 5-engagement cap); attack targeting incl. empty-row behavior (FR7–FR12); middle-row semantics (FR15 per-row action counts, PRD addendum §3); Zombie placeholder (Mercenary — known change).
- **Success criteria 1, 2, 3, 5** map to Goals 1, 2, 3, 5, with counter-metrics added (an improvement, not a gap). The brief's under-5-minute `[ASSUMPTION]` was promoted to Goal 4.
- **MVP scope list**: 6 classes / pick 3 / duplicates (FR1); hidden simultaneous 3×3 (FR4–FR6); animated auto-battle + single engagement (FR17, FR21); AI opponent + instant rematch (FR22, FR24–FR26); local history of last 10 with winner + both compositions (FR28, extended with date + seed); PWA mobile-first Android (FR29–FR30). Phaser 3 + TypeScript is implied (NFR2 "Phaser-free engine", PRD addendum §2) rather than stated as the stack requirement — acceptable, stack belongs to architecture.
- **Qualitative tone / OB64 fantasy** preserved: "all skill spent before the clash" (exec summary), "indirect control is the fantasy — the player watches their plan work" (FR21), "balance the stats, not the rules" (FR38 preamble note + data-file NFR4), no-shop/no-economy-RNG (NFR5, no monetization). The bus-stop match journey narrative in §3 carries the feel.
- **Post-MVP ordering** preserved: link-play second epic; class roster expansion flagged "top post-MVP priority" (Out of Scope), matching the brief's "a priority, not a maybe"; 5-slot squads, tactics orders, point budgets parked (Open Items 4).
- **RPS triangle direction** consistent across all four documents (Mage > Knight > Archer > Mage).

## Minor observations (internal to PRD, not brief gaps)

- FR19 says "statuses cleared between rounds" while FR16/FR19 also say poison ticks "per engagement" — if poison clears with other statuses, it ticks once per application. Wording should disambiguate (poison persists, or must be reapplied).
- PRD addendum §1 claims "Our MVP puts the Archer's 2-shot row in the back **instead**" of OB64's middle, but the FR15 table gives Archer 1/2/2 — identical to the OB64 reference table above it. The prose overstates the deviation.
