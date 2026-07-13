# Sprint Change Proposal — 2026-07-13

*Workflow: `bmad-correct-course`. Triggered by: Danilo, during the story-1.9 Android Chrome production confirmation.*

## 1. Issue Summary

While confirming story 1.9's deployed build ("Reveal, battle playback, and result — the loop closes") on his Android phone, Danilo volunteered five pieces of forward-looking product feedback, plus reaffirmed two standing wishes already logged in `docs/implementation-artifacts/deferred-work.md`:

1. **Position-dependent move variety per class** — today a class's row (front/mid/back) only varies its *action count* (FR15); the wish is for the row to also vary the *kind* of move, including a wholly new defensive "Shield Cover"/"Guard" move type not in the current ruleset.
2. **Move flavor text** ("Sword Slash", "{element} Cast", "Sniper Arrow") surfaced more prominently in the Draft scene's class-selection UI.
3. **A visible, collapsible battle log** under the board in the Battle scene.
4. **Wipeout mode as a real player-facing choice** ("endless... or the one we have today with limited turns/rounds") rather than the dev/debug-only toggle story 1.10 currently specifies.
5. **Text still reads blurry on his actual Android device**, despite story 1.8's `crispText`/`TEXT_RESOLUTION = 3` fix.

Standing wishes (Round 1, from story-1.5 planning): a dedicated tech-debt story before Epic 2, and richer project documentation beyond NFR3's baseline.

This is stakeholder feedback surfacing organically at a milestone demo, not a technical failure or a misunderstanding of existing requirements — category "new requirement emerged" per the change-navigation checklist.

## 2. Impact Analysis

### Epic impact

| Item | Epic impact |
|---|---|
| Position-dependent moves | Epic 1's engine (stories 1.5/1.6) is already `done` and deployed to production. This is not a same-epic tweak — it changes what "class" means (move *type*, not just count, varies by row) and introduces a genuinely new move category. Cannot be retrofitted into shipped stories; needs a new epic. |
| Move flavor text | Rides along with the above once scoped — value depends on row-dependent moves existing first. |
| Battle log panel | Pure UI, reads the existing `BattleLog` the Battle scene already holds. Fits as a new AC on an existing Epic 2 story. |
| Wipeout as player choice | Story 1.10 (`backlog`, unstarted) already builds the engine mechanic (`MatchSetup.mode: 'wipeout'`) — this only changes its UI exposure. Clean amendment to an unstarted story. |
| Blurry font | Bug report, not a scope/epic conflict — contradicts a prior review's dismissal of device-DPI scaling. |
| Tech-debt story / docs (Round 1) | No epic conflict — pure scope/sequencing additions already anticipated in `deferred-work.md`. |

### Artifact conflicts

- **PRD:** position-dependent moves needs new FRs (no existing FR covers a defensive/mitigation move); wipeout-mode exposure needs Open Item 2 updated to reflect the now-made UI decision. Everything else: no PRD conflict.
- **Architecture:** position-dependent moves touches **AD-4** (new domain vocabulary), **AD-12** (`BattleEvent` union extension → `logVersion` bump), and **AD-8** (balance-table schema → `balanceVersion` bump) — real, multi-AD architecture work. Wipeout-mode exposure touches nothing new (`MatchSetup.mode` already exists per AD-9). Battle log panel touches nothing (exactly what AD-2 anticipates).
- **UX:** no UX spec exists yet (confirmed unchanged). Move-selection highlighting and log-panel placement are exactly the class of decision `epics.md` already flagged as open ("consider running `bmad-ux` before the presentation-layer epic").
- **Other:** position-dependent moves needs new engine unit/property/golden tests (NFR2) and will need `docs/rules.md` (arriving with story 2.4) to reflect the new moves once designed — a sequencing note, not a blocker now since Epic 4 lands after Epic 3.

## 3. Recommended Approach

**Position-dependent move variety → new post-MVP Epic 4**, not folded into Epic 2/3, not left unrecorded. Rationale: it's real combat-rules scope growth against already-shipped engine code, with genuine architecture weight (three ADs touched, a `logVersion` and `balanceVersion` bump). Treating it like the already-established link-play epic pattern — engine seam noted now, full story breakdown deferred to when it's scheduled — keeps the current MVP (Epics 1-3) intact and gives this idea a proper design pass instead of rushing it into epics already mid-flight. Effort: **High**. Risk: **Medium** (well-isolated by the engine's existing data-driven design, but reopens tested/shipped combat code). Classification: **Major** — needs a PM/Architect-level pass (PRD FR definition + architecture amendment) before `create-epics-and-stories` can break it into stories.

**Everything else is a Direct Adjustment** to stories not yet started (1.10) or not yet built (2.2, the tech-debt story): low effort, low risk, no rollback, no MVP redefinition.

## 4. Detailed Change Proposals

### 4.1 PRD (`docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md`)

**New subsection after Feature 6 ("Battle Presentation"), before Feature 7:**

```
### Feature 6b — Position-dependent move variety (post-MVP, Epic 4)

- **FR32. Per-row move variety.** For a class whose row already varies its *action
  count* (FR15), the row may also vary the *kind* of action taken, not just how
  many. Illustrative examples volunteered by the creator (not exhaustive — the
  full per-class table is an Epic 4 design task): a Knight in the front row
  throws 2× a melee "Sword Slash" (today's FR8 behavior); in the back row it
  instead performs a defensive move ("Shield Cover") in place of attacking. A
  Mage in the front row makes a weak physical "Staff Attack" instead of its row
  blast (mirroring the Cleric's existing no-target fallback, FR11); in the back
  row it casts its full row blast (FR10) at increased frequency.
  `[ASSUMPTION: the complete per-class, per-row move table — including
  Archer/Cleric/Witch variants — is undesigned; Epic 4 scoping defines it]`
- **FR33. Defensive move type ("Guard").** At least one class/row combination
  (e.g. back-row Knight) substitutes an attack action for a new defensive
  action category not present in the MVP ruleset: raising the unit's damage
  mitigation for the remainder of the engagement, *or* negating one incoming
  attack outright. `[ASSUMPTION: which of the two mechanics — or both — is
  undecided; this is the core new-mechanic design question for Epic 4,
  including its interaction with RPS (FR14) and the engine's closed
  BattleEvent union (AD-12)]`
```

**Section 6, Out of Scope (MVP) — new bullet:**
> - **Position-dependent move variety (FR32/FR33)** — per-row move-*kind* variation building on FR15's per-row action *counts*; landing zone: Epic 4 (post-MVP).

**Section 7, Open Items:**
- New item 5: *Position-dependent move variety (FR32/FR33): the full per-class per-row move table and the exact Guard mechanic are undesigned — a design pass at Epic 4 scoping, not a current-epic concern.*
- Item 2 amended:
  - OLD: *Until-wipeout mode (FR19): decide during epic planning whether it makes MVP or ships after; single-engagement is the committed mode.*
  - NEW: *Until-wipeout mode (FR19): the UI-exposure decision is made — when story 1.10 ships, mode is a real player-facing choice (Standard vs. Wipeout), not a dev-only toggle. Whether 1.10 itself lands in MVP scope or ships after remains the epic-planning call; single-engagement stays the default either way.*

### 4.2 Epics (`docs/planning-artifacts/epics.md`)

**"Future (outside MVP breakdown)" note — add Epic 4:**

```
OLD:
**Future (outside MVP breakdown):** Link-play 1v1 via shareable URL — its
engine seam (AD-1/AD-3/AD-11) is already fixed; broken down when the epic is
scheduled.

NEW:
**Future (outside MVP breakdown):**
- Link-play 1v1 via shareable URL — its engine seam (AD-1/AD-3/AD-11) is
  already fixed; broken down when the epic is scheduled.
- **Epic 4: Position-dependent move variety** — per-row move-*kind* variation
  per class (FR32/FR33), including a new defensive "Guard" move type. Touches
  AD-4 (new domain vocabulary), AD-12 (BattleEvent union extension →
  logVersion bump), and AD-8 (balance-table schema → balanceVersion bump) — a
  PM/Architect design pass at scoping time, not a Direct Adjustment to Epic
  1-3's shipped/planned stories. Broken down into stories when scheduled.
```

**Story 1.10, AC2 — wipeout mode becomes player-facing:**

```
OLD:
**Given** the MVP UI
**When** mode is selected
**Then** single-engagement remains the default; wipeout is reachable behind a
dev/debug toggle only — surfacing it as a player-facing option is a product
decision deferred past this epic.

NEW:
**Given** the MVP UI
**When** a player starts a match
**Then** they can choose between two modes before drafting — **Standard**
(single engagement, FR17, the default) and **Wipeout** (engagements repeat
until one side falls, FR19, capped at 5 engagements) — surfaced as a real,
player-facing toggle (e.g. on Home or Draft), not a dev/debug-only affordance.
(Product decision made — see PRD Open Item 2.)
```

**Story 2.2 ("The animated battle scene") — new 4th AC:**

```
NEW (appended):
**Given** the Battle scene is playing
**When** the player taps a "Log" toggle
**Then** a collapsible panel beneath the board expands to show a scrolling
text narration of the same `BattleLog` events already driving the animation
(e.g. "Knight A:0 struck Archer B:1 for 12 — 78→66 HP"), collapsing again on
a second tap
**And** the panel reads directly from the log the scene already holds — no
new data, no re-derivation (AD-2) — and does not pause or alter the animated
playback.
```

### 4.3 Deferred work (`docs/implementation-artifacts/deferred-work.md`)

**Tech-debt-story bullet — cross-link the font investigation:**

```
OLD:
- **Tech-debt story before epic 2** (Danilo, during story 1.5 planning):
  before the first epic-2 story starts, insert a dedicated refactoring /
  cleanup / performance-improvement story. Natural scope inputs when it's
  created: everything in this file's deferred sections (lint tooling + AST
  purity guard, vite-config consolidation, template cruft, seed-bound
  constant dedup, chassis-stub notes), plus any hotspots the epic-1
  retrospective surfaces. Formalize via `correct-course` or at the epic-1
  retrospective so it lands in sprint-status ahead of story 2.1.

NEW:
- **Tech-debt story before epic 2** (Danilo, during story 1.5 planning):
  before the first epic-2 story starts, insert a dedicated refactoring /
  cleanup / performance-improvement story. Natural scope inputs when it's
  created: everything in this file's deferred sections (lint tooling + AST
  purity guard, vite-config consolidation, template cruft, seed-bound
  constant dedup, chassis-stub notes), **the blurry-font investigation
  below**, plus any hotspots the epic-1 retrospective surfaces. Formalize
  via `correct-course` or at the epic-1 retrospective so it lands in
  sprint-status ahead of story 2.1.
```

### 4.4 Sprint tracking (`docs/implementation-artifacts/sprint-status.yaml`)

Add a new epic entry (backlog, no stories yet — pending a future `create-epics-and-stories` pass once Epic 4 is scoped):

```
epic-4: backlog  # Position-dependent move variety — FR32/FR33; stories pending design pass (see sprint-change-proposal-2026-07-13.md)
```

## 5. Implementation Handoff

| Item | Scope | Route to | Deliverable |
|---|---|---|---|
| Position-dependent moves (Epic 4) | **Major** | PM / Architect | A dedicated PRD-addendum + architecture-amendment pass (new ADR for the `BattleEvent`/balance-schema changes) before `create-epics-and-stories` breaks Epic 4 into stories. This proposal's FR32/FR33 are the starting brief, not the final spec. |
| Wipeout mode as player choice (story 1.10) | **Minor** | Developer agent | Fully scoped AC above — implement directly whenever story 1.10 is picked up (still `backlog`). |
| Battle log panel (story 2.2) | **Minor** | Developer agent | Fully scoped AC above — implement directly whenever story 2.2 is picked up. |
| Blurry-font investigation | **Moderate** | Product Owner / Developer | Folds into the standing tech-debt story; needs backlog reorganization (the tech-debt story itself must be created and sequenced before 2.1, per the Round-1 wish). |
| Tech-debt story + docs wishes (Round 1) | **Moderate** | Product Owner / Developer | Formalize the tech-debt story into `sprint-status.yaml` ahead of story 2.1, scoping in all named inputs (this file's deferred sections + the font investigation). Docs-beyond-NFR3 scope is a separate discussion, likely at the epic-1 retrospective. |

**Success criteria:** PRD/epics edits land as written above; `sprint-status.yaml` carries the new `epic-4: backlog` entry; the tech-debt story is created and sequenced before story 2.1 in a follow-up planning pass (this proposal does not create that story itself — it only re-affirms the standing wish with the font item folded in).
