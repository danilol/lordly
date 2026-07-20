# Story 4.11: The action ledger and informed placement

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new player,
I want to see who acts, how often, and why — during battle and before it,
so that action economy is understandable without ever having seen OB64.

> **Scope in one line.** Two UI surfaces, pure shell, no engine change: **(1)** the FR39b action ledger in Battle — which per the dossier's D-3a decision **IS the OB64 move-name plate** (`{components.move-plate}`): a transient gold-framed plate over the ACTING unit naming its move and carrying its action pips (⚔ Sword Slash ●○); **(2)** FR39c per-row action counts at Placement ("back 2×") so positioning is an informed choice. Fed strictly by `PassStarted.actionsRemaining` + `UnitAttacked.kind`/`StatusApplied.spell` (all in the v4 union since 4.2) + AD-2's static-facts channel (`BALANCE.classes[cls].actions`, roster element). **No `logVersion` bump, no `balanceVersion` change.**

## Acceptance Criteria

Reconciled from epics.md Story 4.11 (lines 895–911). FR39b, FR39c, UX-DR2/3/5.

1. **Placement surfaces per-row action counts (FR39c).** While positioning a unit, each grid row shows that unit's action count for that row — the "Mage: back row 2×, front row 1×" read — per the spine-extension design (EXPERIENCE.md:195: "each grid row shows the selected/dragged unit's count for that row"). The counts come from `BALANCE.classes[cls].actions` (AD-2 static facts — the shell derives nothing), so positioning is an informed choice before the first battle is ever watched.
2. **The Battle action ledger renders per the 4.1 spine-extension design (FR39b — the PO-flagged key display problem).** Each acting beat shows the actor's actions this Turn — used and remaining — resetting on `PassStarted` *(precisely: the SNAPSHOT refreshes each pass; the pip BUDGET is per engagement (`balance.ts:31` "actions per engagement") and visibly depletes across passes — a 2-action unit reads ●○ in pass 1, ○○ in pass 2 — refilling only at the engagement seam, `resolve.ts:96-99`)*. Per D-3a the ledger IS the move-name plate: a transient `{components.move-plate}` over the ACTING unit naming the move ("Sword Slash", "Arrow", "Ice Blast", the FR16 spell names, "Heal", the Guard tiers) with gold action pips (● remaining / ○ spent). Fed **strictly** from the union's ledger payload (`PassStarted.actionsRemaining`) plus AD-2's static facts — the scene derives no combat state. Zero standing chrome: the plate lives one beat and leaves the boards clean.
3. **It fits the locked HERO layout without crowding (UX-DR5), in both themes at the type floors (UX-DR2/3).** The plate must not collide with the unit's existing chrome (HP bar, status icons, crown, guard marker, the 1.5× monster loom) or the damage popups on the TARGET; text ≥ the floors (move name at `{typography.label}`, nothing below MIN_FONT_PX); gold stays the plate frame/pips accent (UX-DR2 — gold = attention, never side identity).
4. **Danilo signs off on-device (the epic's readability gate).** A new player can follow who acts, how often, and why — plate + pips at 1× and 2×, per-row counts at placement — on his Android phone. *(This device pass should also glance the two review-decided 4.10 changes not yet seen on device — arrival-timed effects and the guardian ring — and, if the build is deployed, run the deferred `?perf=1` capture from `deferred-work.md`.)*

## Tasks / Subtasks

- [ ] **Task 1 — The pure ledger seam (AC: 2)**
  - [ ] New pure function (house pattern — `flow/battleView.ts` alongside `eventTrace`, or a sibling `flow/ledger.ts`): `movePlate(event, actionsRemaining, linkedToMisfire) → { unitId, label, remaining, max? } | null` — the `linkedToMisfire` flag is REQUIRED in the signature: a misfire pair's effect event is a plain `UnitAttacked`/`UnitHealed`/`StatusApplied`/`ActionFizzled`, indistinguishable from a standalone one by payload alone; only the scene's one-shot `pendingMisfirePair` flag knows (it's already threaded to `popup()` the same way). A stateless seam without it would double-plate the pair. — maps one `BattleEvent` to the plate it shows, or `null` for beats with no acting unit (framing events, deaths, poison ticks, `StatusCleared`, `GuardEnded`, `LeaderFell`). Acting events: `UnitAttacked` (label from `kind`), `UnitHealed` ("Heal"), `StatusApplied` (the FR16 spell name), `GuardRaised` (the Guard tier — read the tier from BALANCE `moves[row]` via the roster, or label plain "Guard"; decide and record), `ActionFizzled` ("Fizzle"), `ActionSkipped` — asleep/idle consume the action but default to **no plate** (the Zzz/waits popup already reads; a plate would add chrome to a non-act — open Q3).
  - [ ] **The misfire pair decrements ONCE.** `ActionMisfired` + its immediately-following effect event are ONE action (types.ts pairing, scene already tracks `pendingMisfirePair`). Default: the plate rides the **marker** beat ("Confused!" label + pips); the paired effect beat shows no second plate (its popup already carries the ↳ link). Pin this single-decrement in the seam's tests.
  - [ ] **Pips math from the payload, not derived combat state:** `remaining` for the actor's beat = `actionsRemaining[unit]` from the CURRENT pass's `PassStarted` snapshot **minus 1** (each unit acts at most once per pass — FR13 multihit splits across passes; dead units read 0; verified at `resolve.ts:126-160`). `max` (total pips) = `BALANCE.classes[cls].actions[row]` via the roster snapshot (AD-2 static channel). E.g. a back-row Mage's first action: snapshot 2 → rendering **●●** (remaining = snapshot, unshifted) is WRONG — it's 1 remaining AFTER this act → **●○** reads "1 of 2 left" (dossier D-3a example). Get this exactly right in fixtures.
  - [ ] Unit-test the seam against fixtures for every event type (the `eventTrace` test block is the template): attack/heal/spell/guard-raise/fizzle produce a plate with correct label + pips; misfire pair = one plate; skip/asleep and every no-actor event → `null`; a 2-action unit's two passes show 1-left then 0-left.
- [ ] **Task 2 — Move display names (AC: 2)**
  - [ ] A `Record<MoveKind, string>` display-name map in `config/constants.ts` (house one-source color/label convention; keyed by the engine union per AD-4 so a future MoveKind is a compile error): slash → "Sword Slash", arrow → "Arrow", bash → "Bash", staff → "Staff" (draft's `moveLabel` in `draftModel.ts` stays — it's the placement-card wording; don't force one label set across both surfaces if the plate wants richer names, but do consider reusing if they converge).
  - [ ] **Blast is element-flavored** (EXPERIENCE.md:197 names "Ice Blast" explicitly): compose from the actor's roster `element` (static fact — `UnitSnapshot.element`) + "Blast" → "Fire Blast"/"Ice Blast"(water)/"Wind Blast"/"Stone Blast"(earth). Decide the exact element→word mapping and pin it in a test (open Q2 — default shown).
  - [ ] Spell names: reuse/extend the FR16 vocabulary — sleep/poison/weaken/confusion Title-Cased ("Sleep", "Poison", "Weaken", "Confusion") — one source shared with `STATUS_GLYPHS`/`STATUS_COLORS` keying (AD-4).
- [ ] **Task 3 — The plate in BattleScene (AC: 2, 3)**
  - [ ] Store the latest `PassStarted.actionsRemaining` in a scene field (reset in `create()` — **Phaser scenes are singletons**; stale snapshots must not leak between battles).
  - [ ] Render the plate on each acting beat via the Task-1 seam: a small gold-framed strip (`{components.move-plate}` tokens: frame `{colors.gold}`/`ISO_TILES.stroke` family, dark body, bone text, gold pips ●○) positioned over the ACTING unit — above its status-icon row (y ≈ −44 and up), clamped inside the canvas for edge columns, depth **between the popups (1000) and the log panel (1500)** — never ≥1500, which would ride over the log panel / tie the leader banner (1600). Lives exactly one beat: destroy on the next `step()` or fade within the beat (match the popup pattern — construct only when a plate exists, destroy on complete; no pooling unless the perf capture says otherwise).
  - [ ] The plate appears at beat START (it names the actor — the cause), coexisting with 4.10's arrival-delayed impact effects on the target (the effect). It must read at 2× (300ms beat) — keep any fade inside the beat at both speeds; reduced motion: the plate is information, not flourish — it appears/disappears without drift (UX-DR6 pattern).
  - [ ] Monster loom: the plate's y-offset must clear the 1.5× Golem sprite (story 4.9 `unitDisplaySize`) — same size-aware treatment the code/badge anchors got.
  - [ ] Regression guard: crown, guard marker, status icons, popups, captions, banners all still render un-collided (they share the over-unit airspace — check a unit with crown + guard + 2 statuses + plate). **Deliberate duplication check:** the misfire-marker beat already pops "confused!" and the fizzle beat pops "fizzle" over the SAME unit the plate covers — review the pairing on device (see open Q1); don't let plate + same-word popup read as stutter.
- [ ] **Task 4 — Placement per-row action counts (AC: 1)**
  - [ ] Pure helper (in `flow/placement.ts`): `rowActionCounts(cls) → { front, mid, back }` from `BALANCE.classes[cls].actions` (trivial, but the seam keeps the scene dumb and testable — house pattern).
  - [ ] `PlacementScene`: while a unit is being dragged (dragstart→drop/dragend), each grid ROW shows that unit's count for that row — a small badge at the row's edge ("2×" / "1×"), replacing nothing (the `row/col` cell labels stay). Clear on drop/dragend. Also show for the double-tap-place flow if cheap (the unit is known at tap); otherwise drag-only is acceptable — record the choice.
  - [ ] Wording per FR39c ("back 2×"): count + "×", ≥ MIN_FONT_PX, muted-text tone (informational, not gold — UX-DR2).
  - [ ] Test via the pure helper (per-class table pins against BALANCE — the `rules-doc.test.ts` drift-guard spirit); the badge rendering itself is device-verified (house pattern).
- [ ] **Task 5 — Gate + docs (AC: 1–3)**
  - [ ] Full gate: `pnpm typecheck`, `pnpm lint`, `pnpm coverage` (engine ≥90% untouched), `pnpm --filter web build`. No engine files change; no golden/sweep re-runs needed.
  - [ ] `docs/rules.md`: if it describes action economy, add the "how you see it" line (plate + placement counts) only if the rules doc already covers presentation — otherwise skip (rules.md is game rules, not UI).
- [ ] **Task 6 — Device session (AC: 4)** *(Danilo's acceptance gate — the epic's readability gate)*
  - [ ] On the phone: a full battle at 1× and 2× — every acting beat names the actor's move with correct pips; a fresh player can answer "who acts, how often, why". Placement: drag each class and watch the row counts.
  - [ ] Fold in the pending 4.10 looks: arrival-timed effects + guardian ring (review-decided 2026-07-20, not yet device-seen).
  - [ ] If on the deployed build: run the deferred `?perf=1` capture (deferred-work.md) and fill the perf-verdict 4.10 table — the plate adds one more transient GameObject per acting beat, so the capture now covers both stories' churn.

## Dev Notes

### The design is DECIDED — D-3a: the ledger IS the move-name plate

The dossier settled the PO-flagged "key display problem" (D-3a, 2026-07-17, from Danilo's OB64 animation-off capture): **no standing panel, no per-unit rows** — a transient plate over the acting unit unifies who/what/how-many-left in one element. Do not design a new ledger; implement the plate. [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md §6 + decision log D-3a; EXPERIENCE.md:197; DESIGN.md:147-152 `{components.move-plate}` tokens]

### Everything the plate needs already exists in the log + statics (verified)

- `PassStarted.actionsRemaining: Record<UnitId, number>` — per-pass snapshot, dead units 0 (`types.ts:231-235`, emitted at `resolve.ts:130-132`). **In the union since 4.2 — no `logVersion` bump.**
- `UnitAttacked.kind: MoveKind` (`slash|arrow|blast|staff|bash`) — the move identity; NEVER infer from class (per-row moves, story 4.7).
- `StatusApplied.spell: SpellKind` — the FR16 spell names surface at last (a 2026-07-13 PO wish ships as a side effect, per the dossier).
- Static facts (AD-2's sanctioned channel): `BALANCE.classes[cls].actions: {front,mid,back}` for max pips; `UnitSnapshot.element` (roster) for the element-flavored blast name; `UnitSnapshot.placement.row` for the row lookup. All reachable from the `BattleStarted` roster the scene already keys `views` from.
- **Pass structure (FR13):** each unit acts at most ONCE per pass; multihit splits across passes ("Multihit units act once per pass" — `types.ts:225-230`). So within a pass, the actor's remaining-after-this-act = snapshot − 1; no running decrement bookkeeping is needed. The next `PassStarted` refreshes the snapshot.
- **Misfire pairing:** `ActionMisfired` is immediately followed by its redirected effect event(s) — one action, two events (`types.ts` marker+effect pair; the scene's `pendingMisfirePair` already tracks it for popup linking). The seam must not show two plates / decrement twice.

### Previous-story intelligence (4.10, done `6e1eceb`)

- **The pure-seam pattern to copy:** `eventTrace(event)` in `flow/battleView.ts` + its exhaustive fixture block in `battle-view.test.ts` — 4.11's `movePlate` seam should sit beside it with the same all-16-union-members coverage discipline. The 4.10 review specifically rewarded exhaustive `Record`/union guards (`TRACE_TRAVEL`, the discriminated `EventTrace`) over stringly checks — key new maps by the engine unions (AD-4).
- **Arrival timing (review-decided 2026-07-20):** impact effects (popups/washes/glows) now land when the travel arrives (~180ms) via `afterTravel`; beats are 600/300ms. The plate is the CAUSE side — show it at beat start over the actor; don't couple it to `afterTravel`.
- **Over-unit airspace is crowded:** popup floats start at y−34 (+caption above), status icons at y−34 row, crown/badge at y−28, monster sprites are 1.5×. The 4.9 review accepted "loom overlaps" as the look, but the plate is NEW chrome — position deliberately and check the crowded-unit case (Task 3).
- **Not yet device-seen:** 4.10's arrival delay + guardian ring — fold into this story's device pass (Task 6). The deferred post-deploy `?perf=1` capture (deferred-work.md) is also still owed.
- **Scene-singleton rule** (standing): reset the new plate/snapshot fields in `create()`.
- **`popup()` churn precedent:** captions are built only when needed to avoid canvas-text churn on the hottest path — the plate fires on EVERY acting beat, so build it lean (one container, destroy on beat end); the perf doc's known hotspot is unpooled text objects.

### FR39c — placement counts are static and tiny

`rowActionCounts` is a straight BALANCE read. The interesting part is presentation: EXPERIENCE.md:195 says "each grid row shows the selected/dragged unit's count for that row." PlacementScene has drag (`wireDragAndDrop`) and double-tap-place, but no persistent "selected unit" state — tap means crown (leader). So DRAG is the natural trigger; showing counts during drag matches "informed choice at positioning" without inventing a selection model. The grid rows are built in `buildGrid()` (`PlacementScene.ts:156-166`); `cellCenter` gives row geometry for badge placement.

### What this story is NOT

- **No engine change** — the payload shipped in 4.2; `logVersion` 4 and `balanceVersion` stay. No golden re-records, no sweep re-run.
- **No standing ledger panel** — D-3a killed it; the Log panel (narration) already carries the history.
- **No pause control** — FR39g stays dropped (PO 2026-07-16, re-confirmed at 4.10).
- **Names on the plate** — `UnitSnapshot.name` exists (FR37, 4.2), but D-3a's plate carries move + pips only; the name already lives in narration and cards. Don't add it (chrome budget); flag at device pass if Danilo wants it. **Note a stale dossier line:** §7 (`DOSSIER.md:155`) says "the ledger row carries the name (§6)" — that's the pre-D-3a row-based ledger concept D-3a killed; §6's plate spec (no name) governs. Don't treat §7's sentence as a requirement.

### Testing standards

Pure seams unit-tested (`movePlate`, `rowActionCounts`, the name maps — keyed-by-union drift guards); plate/badge rendering device-accepted (house pattern — no golden-pixel tests). Full gate before review: `pnpm typecheck`, `pnpm lint`, `pnpm coverage` (engine ≥90%), `pnpm --filter web build`.

### Project Structure Notes

- Touch (web only): `apps/web/src/flow/battleView.ts` (or sibling `ledger.ts`) + `apps/web/src/flow/placement.ts` (pure seams), `apps/web/src/scenes/BattleScene.ts` (plate render + snapshot field), `apps/web/src/scenes/PlacementScene.ts` (row badges), `apps/web/src/config/constants.ts` (move/spell display names, plate tokens), tests in `apps/web/test/`.
- No new dependency. No new RNG stream. Engine untouched.

### References

- [Source: docs/planning-artifacts/epics.md#Story-4.11 (895-911)] — the 3 AC blocks; [#98] AD-12 ledger payload; [#110] UX-DR5 HERO-layout constraint; [#114] UX-DR9.
- [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md] — D-3a decision (:31, :161); §5 `PassStarted.actionsRemaining` row (:147) + render-surface walk (:151); §6 spine extension (:157-165).
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md:147-152] — `{components.move-plate}` tokens (frame/body/text/pips); [EXPERIENCE.md:195] placement duties incl. FR39c; [EXPERIENCE.md:197] the plate spec.
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#FR39 (127)] — (b) ledger, (c) per-row counts; FR13 multihit; FR16 spell names.
- [Source: packages/engine/src/types.ts:225-246] — `PassStarted.actionsRemaining` + pass semantics; [resolve.ts:130-132] emission; [balance.ts:31] `actions` shape.
- [Source: apps/web/src/flow/battleView.ts] — `eventTrace` seam + test pattern; [apps/web/src/scenes/BattleScene.ts] — beat scheduler, `views`, popup airspace, `afterTravel`; [apps/web/src/scenes/PlacementScene.ts:156-215] — grid build + drag wiring; [apps/web/src/flow/draftModel.ts:66-70] — existing `moveLabel`.
- [Source: docs/implementation-artifacts/4-10-attacks-read-from-to.md] — previous-story intelligence incl. the review round; [deferred-work.md] — the pending `?perf=1` capture.

## Open questions for Danilo (not blockers; sensible defaults chosen — confirm at the device pass)

1. **Plate on the misfire marker** — default: the plate rides the `ActionMisfired` beat, but should it say "Confused!" (duplicating the existing "confused!" popup on the same unit — reads as stutter) or name the misfired move? Suggested default: the plate names the MOVE that misfires (the popup already says confused); the redirected effect beat shows no second plate either way.
2. **Element-flavored blast names** — default: "Fire/Ice/Wind/Stone Blast" from the actor's element (EXPERIENCE names "Ice Blast"). Alternative: plain "Blast" everywhere.
3. **Plate for skipped turns** — default: NO plate on asleep/idle skips (the Zzz/waits popup suffices; less chrome). Alternative: an "Asleep" plate with pips, since the skip does consume the action.
4. **Guard plate label** — default: the tier ("Guard (full)"/"Guard (half)" — matches the Draft card wording). Alternative: plain "Guard".

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log

- 2026-07-20 — Story created (baseline `6e1eceb`). Pure shell, no engine change: FR39b action ledger = the D-3a move-name plate (transient, over the acting unit, name + gold pips, fed by `PassStarted.actionsRemaining` + `kind`/`spell` + BALANCE statics) and FR39c per-row action counts at Placement (drag-triggered row badges). Pure seams (`movePlate`, `rowActionCounts`) + union-keyed display-name maps, exhaustively tested per the 4.10 `eventTrace` pattern. Device pass doubles as the pending 4.10 look-check (arrival timing, guardian ring) and, if deployed, the deferred `?perf=1` capture. `logVersion` 4 / `balanceVersion` unchanged. 4 non-blocking open questions.
