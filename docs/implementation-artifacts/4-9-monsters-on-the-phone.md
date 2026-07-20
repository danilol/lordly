---
baseline_commit: db249d8
---

# Story 4.9: Monsters on the phone

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to draft the Golem and see it loom over its cell on my grid and in battle — visibly larger than a soldier, holding the ground around it — instead of looking like just another knight,
so that the squad era reads as real on the phone, not merely simulated in the engine.

> **Scope reconciliation (read first).** The epics.md AC for this story (lines 851–874) is written against the ORIGINAL two-cell monster design and names a **dragon**. Both are stale. Story 4.8 shipped — and Danilo approved on device — a **single-cell** monster model, **Golem only** (dragon deferred, dossier D-1b). This story is written against the SHIPPED model. See Dev Notes → "Scope" and "Binding UX conflicts to reconcile." The story's job is the Golem's **on-device rendering + art**, not new rules — the engine and placement legality are already done and gated in 4.8.

## Acceptance Criteria

Reconciled from epics.md Story 4.9 (the four Given/When/Then blocks) to the shipped single-cell / Golem-only model. Where a criterion corrects the stale epic text, it is marked **[reconciled]**.

1. **[reconciled] Draft.** When I compose an army, the Golem card shows it **costs 2 slots**, the running budget reads in slots (e.g. "3 / 5 slots"), and every FR1 combination is draftable and reads correctly: 5 smalls; 1 monster + 3 smalls; 2 monsters + 1 small. The 2-slot cost is visible on the card itself, not only enforced silently. (Engine cap + `canAddUnit` gating already ship from 4.8 — this AC is about the *display*.)

2. **[reconciled] Placement.** When I drag a Golem, placement legality comes live from the engine's `legalAnchors`/`canPlace` (AD-14): the 8 king-move neighbour cells it reserves are shown as blocked *before and after* the drop, an illegal drop is never silently accepted, and **no drop is ever lost** — an illegal drop snaps the unit back to where it was (honouring EXPERIENCE's "never rejects the drop — no dead-ends" principle), never dropping it into limbo. Leader designation and tactic selection work unchanged with a monster in the army, and the Golem can never be crowned (it shows no crown affordance / rejects the crown gesture with a toast). *(Most of this shipped as interim shell in 4.8; this AC is the confirm-and-polish gate, plus the "no drop lost" behaviour must be verified on device.)*

3. **[reconciled] Reveal, Battle, and History.** When the Golem renders in any scene, it appears as **ONE unit, visibly large** — a proportionally bigger sprite (≥48px on the boards, D-3c), one HP bar, one status track, one class code — never as two units and never the same size as a small beside it. Its size makes it read as "looming" over its cell and overhanging into the ring of cells it reserves. History cards render monster compositions (1- and 2-monster armies) correctly, without overflow.

4. **Art + attribution (FR31, NFR1).** The Golem uses a **dedicated free/CC pixel-art tile** (not the interim Knight frame) with idle/attack/hurt/death representations (tween-based per the existing `UNIT_TWEENS` recipe, which FR31 allows for single-frame tiles). The attribution manifest and Credits screen list its source and license, no `(INTERIM: ...)` note remains for the Golem, the bundle stays within the NFR1 budget, and the full loop with monsters on **both** sides is played on device (Danilo's acceptance gate) at the NFR1 frame-rate floor.

## Tasks / Subtasks

- [ ] **Task 1 — Source & composite a dedicated Golem sprite (AC: 4)**
  - [ ] Pick a CC0 (or CC-BY-3.0/4.0) Golem/construct tile. **Default: the SAME Dungeon Crawl Stone Soup CC0 pack already vendored** (it ships golem/statue tiles, e.g. `dc-mon/` golems) — this keeps the licence trivial (CC0, already in `REDISTRIBUTABLE_LICENSES`) and the bundle impact to one 32×32 tile. Only add a NEW pack object to `ART_ATTRIBUTIONS` if a non-DCSS tile is chosen.
  - [ ] Composite the tile into `apps/web/src/assets/units.png` as a new frame (sheet grows 192×32 → 224×32 for a 7th frame), keeping every existing frame index stable.
  - [ ] `apps/web/src/config/sprites.ts`: point `UNIT_FRAMES.golem` at the new index; rewrite the interim comment (lines 33–35) to the shipped single-cell wording. (`BootScene`'s `requiredFrames` guard auto-tightens — verify it passes.)
  - [ ] `apps/web/src/assets/attribution.ts`: update `classSources.golem` to the real source tile path, remove the `(INTERIM: shares the Knight tile)` suffix; add `units.png` note if the sheet dimensions are recorded anywhere.
- [x] **Task 2 — Make rendering size-aware so the monster looms (AC: 3)**
  - [x] Introduce a single source of truth for a unit's on-screen display size by `sizeClass` (monster renders larger than small), so no scene hand-branches on `golem`. → `MONSTER_LOOM_SCALE = 1.5` + pure `unitDisplaySize(cls, baseSize)` in `constants.ts` (keyed off `BALANCE.classes[cls].sizeClass`); baked into `addUnitSprite` (`ui.ts`).
  - [x] Apply across every scene that draws a unit: Reveal, Battle, History, Draft (grid tile + detail + tray), Placement. → done automatically: `addUnitSprite` is the single picker every scene uses, so a small stays at its scene base (26/28/32/48) and a monster looms 1.5× (39/42/48/72) with zero call-site changes.
  - [x] Verify the larger sprite does not collide with HP bar / code / element badge / status glyph / crown anchors, and does not overflow `HistoryScene`'s card or `PlacementScene`'s container. → verified analytically against every scene's dims: no container OVERFLOW anywhere (e.g. 72px Draft-detail preview right edge x+80 clears text start x+92; Battle HP bar at y+14 clears the taller sprite). Cosmetic overlaps of the Battle code (0,4) / badge (16,-28) with the bigger sprite body are FLAGGED for the device pass (Task 6) — best judged on the phone, not moved blind; the monster wears no crown so that anchor is free.
- [x] **Task 3 — Draft slot-cost display (AC: 1)**
  - [x] Confirm the running budget already reads "N / 5 slots". → confirmed slot-based (`YOUR ARMY (${slotTotal(army)}/${BALANCE.slotBudget})`, `DraftScene.ts:281`; `slotTotal` counts monster=2, story 4.2). No change needed.
  - [x] Add a visible **"2 slots"** cost indicator to the Golem's Draft card. → added `slotCost` to `RulesCard`/`classRulesCard` (from `SLOT_COST[sizeClass]`) and rendered it on the DETAIL panel role line: `{role} · {n} slot(s) · act …`. Fits within `BASE_WIDTH` (short prefix; no `chip()` involved).
- [x] **Task 4 — Fix stale two-cell copy (AC: 1, 3)**
  - [x] Rewrote `draftModel.ts` `CLASS_TEXT.golem` to the single-cell rule ("Melee brute: huge HP, hits hard, weak to magic; so large no unit may stand beside it"); updated the `docs/rules.md` class-table golem row to match (the `rules-doc.test.ts` AC6 drift guard couples them).
  - [x] Swept `apps/web/src`: rewrote the "two-cell CC0 body" comments in `sprites.ts` + `attribution.ts` to single-cell + loom wording; fixed `PlacementScene.firstFreeCell`'s stale "derived rear cell" doc comment. (The remaining "two-cell" hits are new comments that explicitly say "NOT a two-cell body".)
- [ ] **Task 5 — Tests (AC: 1–4)**
  - [ ] `sprites.test.ts` — bump `SHEET_FRAMES = 6` + assert `UNIT_FRAMES.golem` is the dedicated index. **DEFERRED with the real tile** (sheet is still 6 frames; golem still frame 0 interim — bumping now would fail).
  - [ ] `attribution.test.ts` — Golem `classSources` carries no `(INTERIM…)` suffix. **DEFERRED with the real tile** (still interim).
  - [ ] `credits.test.ts` — Golem in the "Supplies" line. **DEFERRED with the real tile** (golem is already in `classSources`, so it already renders; a dedicated assertion pairs with the real-tile swap).
  - [x] Draft slot-cost display test → `draft-model.test.ts`: "reports each class's slot cost from SLOT_COST — 1 small / 2 monster." Plus the loom-sizing suite in `constants.test.ts` (`unitDisplaySize`: small = base, golem ≥48 at base 32, > small at same base).
  - [x] No golden-pixel layout tests — kept the house pattern; the DATA/manifest + sizing rule are unit-tested, the visual is Task 6.
- [ ] **Task 6 — Device session + NFR1 (AC: 2, 3, 4)** *(Danilo's acceptance gate)*
  - [ ] Play the full loop (Draft → Placement → Reveal → Battle → Result → History) with monsters on BOTH sides on Danilo's Android phone.
  - [ ] Confirm the loom reads right, placement feedback + "no drop lost" behave, Battle animations (idle/attack/hurt/death, corpse-leaves-lane) work at the larger size, and the frame rate holds the NFR1 floor (`?perf=1` against `docs/performance-verdict.md`).

## Dev Notes

### Scope — GOLEM ONLY, single-cell; the dragon and the two-cell model are BOTH gone
This is the **on-device rendering + art** counterpart to 4.8's pure-engine work. The engine, placement legality, AI comps, and the balance sweep are DONE and gated in 4.8 — do not re-open them. What ships here is: a real Golem sprite, size-aware "loom" rendering across scenes, the Draft slot-cost display, stale-copy cleanup, the attribution/Credits update, and the device pass.

- **Dragon: deferred** (dossier D-1b) — wave 1 is Golem only. The epics.md AC ("draft a dragon and watch it loom") is stale on this point.
- **Single-cell model** (device-approved 2026-07-20, story 4.8): a monster occupies ONE grid cell, costs 2 of the 5-slot budget, reserves all 8 king-move neighbours at placement, and can never be leader. This SUPERSEDES the dossier's two-cell footprint (§2, D-2f) and the epics.md "occupies both its cells" wording. `footprintCells(_cls, anchor)` already returns `[{...anchor}]` for every class (`packages/engine/src/targeting.ts:34-45`).

### What 4.8 already shipped as interim shell (do NOT rebuild — extend/confirm)
4.8 was "pure engine" by charter, but widening `Record<UnitClass, …>` tables made the Golem a real draftable/placeable class, so 4.8 added a deliberately minimal functional shell. It is live today:
- **Draftable** — `DraftScene` builds its picker from `ALL_CLASSES`; `draftModel.canAddUnit(army, cls)` enforces `SLOT_COST` + `MAX_MONSTERS_PER_ARMY` (`draftModel.ts:77-85`).
- **Placeable** — `flow/placement.ts` computes king-move reservations via the engine's own `footprintCells`/`legalAnchors`; `PlacementScene` renders a **red "blocked" tint + "blocked" label** on every reserved empty neighbour (`PlacementScene.ts:312-327`) and toasts illegal drops / crown attempts / commit errors. `toAnchor` is now identity (single-cell). The old blue "GOL body" second-cell marker is GONE (single-cell — `PlacementScene.ts:308-310`).
- **Renders everywhere, but wrong** — every scene draws the Golem through the shared `addUnitSprite(scene, x, y, cls, size)` picker (`ui.ts:124-128`) using **`UNIT_FRAMES.golem = 0` (the interim Knight frame)** at the **same display size as a small unit**. There is **no** size-aware or monster-aware rendering anywhere (code map §7). That identical-size, borrowed-tile rendering is precisely the gap this story closes.

### The render contract (what survives the single-cell revision)
The dossier (D-3c line 33; §6 lines 163-164) and both UX specs state the monster render invariant against AD-14 — **"one body ≥48px, one HP bar, one code, one unit, never two."** Under the single-cell model the two-tile geometry drops away but the invariant stands, and it maps cleanly:
- **One unit** — the Golem is already one `UnitState` / one `UnitView`, so one HP bar and one status track come free (`BattleScene.buildUnit`). Nothing to split.
- **≥48px loom** — the mechanism that makes it read as large. Render the sprite oversized, centred on its single cell, so it **overhangs into the reserved neighbour ring** — which is *why* nothing may stand beside it. This is the single-cell reading of "spanning both cells."
- **One code, FR39f outline** — keep the class code on the board tile with the FR39f light-tint-over-dark-outline treatment (`unitCodeStyle`), per the golem-body token and the deferred "board keeps one code at the anchor" note (deferred-work.md, D-3c).
- **blue = you / red = enemy** — load-bearing everywhere (DESIGN Colors). The Golem sprite/tile is side-neutral art; side identity comes from the card border / board tile / HP-bar fill exactly like any unit. A monster never wears the gold crown (can't lead).

### Binding UX conflicts to reconcile — DO NOT silently override
The UX specs are a binding contract (see memory: UX spec is binding). Three points where the shipped model diverges from the spec text — raise each with Danilo/UX, land the render, and amend the spec token so app and contract agree:
1. **"spans BOTH cells / across two tiles"** — DESIGN `{components.golem-body}` and EXPERIENCE "Epic 4 extension" both describe the two-tile body with a code "at the anchor cell." Proposed reconciliation: single cell + oversized loom that overhangs the reserved ring (above). This is a UX-spine amendment to both tokens, not a silent change.
2. **2-of-5 slot-cost display** — unspecified in the UX spec (it defines "N / 5 slots" but not a per-unit multi-cost badge). This story defines it (Task 3); fold the decision back into EXPERIENCE's Draft/State patterns.
3. **Illegal-drop feedback** — MVP placement had "never rejects the drop — no dead-ends." Monsters introduce the first illegal cell. Reconciliation: reject-with-snap-back so **the unit is never lost** (honours "no drop lost"); 4.8's interim returns the same board reference (a no-op the scene detects), which satisfies this — confirm on device and record it in EXPERIENCE's Placement interaction notes.

### The Golem sprite & the art pipeline (AC 4)
- One texture picker feeds every scene: `addUnitSprite` → `scene.add.sprite(x, y, UNITS_SHEET_KEY, UNIT_FRAMES[cls]).setDisplaySize(size, size)` (`ui.ts:124-128`). Change the frame data + size logic there and every scene follows.
- Assets load ONLY in `BootScene` (`preload` loads the spritesheet at `frameWidth/Height = UNIT_FRAME_SIZE = 32`; `create` runs a frame-count guard `requiredFrames = max(UNIT_FRAMES)+1` and applies **per-texture NEAREST** to the units sheet alone — `BootScene.ts:34-63`). **Never set global `pixelArt: true`** (tried and rejected — it wrecks `crispText`; `main.ts:47-52`; memory: pixelArt flag breaks text). Adding a frame just grows the sheet + tightens the guard automatically.
- FR31 animations are **tween recipes on single-frame tiles** (`UNIT_TWEENS`, `sprites.ts:56-65`), which FR31 explicitly permits — so the Golem needs **one static tile**, not four animation frames. idle/attack/hurt/death come free from the shared recipes (only `BattleScene` plays them).
- Attribution + Credits are data-driven: add the Golem's real source to `ART_ATTRIBUTIONS[].classSources` and it appears automatically in the Credits "Supplies" line (`credits.ts:19`) — zero scene changes. `attribution.test.ts` gates that every listed asset exists and every licence is redistributable (public repo, FR31).
- **NFR1 bundle:** one extra 32×32 CC0 tile is negligible; `units.png` is inlined as a data-URI by Vite. No new dependency. Keep it to the one tile (or one small pack) so the ≤5s-on-4G load budget is untouched.

### Per-scene rendering map (current → change → preserve)
- **RevealScene** `drawUnit` (`RevealScene.ts:108-138`): sprite at `y-12`, size 32, `setDepth(y)`; crown/code/name/element badge; **no HP bar**. *Change:* monster size-up + depth still by y. *Preserve:* pre-fight face-off has no HP bar.
- **BattleScene** `buildUnit` (`BattleScene.ts:228-265`): container at (x,y) `setDepth(y)`; sprite at (0,-14) size 32; code (0,4); badge (16,-28); **HP bar** `BAR_W=36 × BAR_H=8` at y=14, side-fill `hpBarPlayer`/`hpBarEnemy`, updated by `hpFill.width = barWidth * ratio` from `hpAfter` (AD-2); status glyphs at y=-34 laid out left of sprite; optional crown top-left. *Change:* monster size-up; re-check every anchor clears the bigger sprite; keep the bar one-per-unit. *Preserve:* HP depletes only from `BattleLog` payloads (AD-2 — never guess); tween animations via `resetSprite`/lunge/hurt/death; corpse-leaves-lane on death.
- **HistoryScene** `renderUnitCard` (`HistoryScene.ts:258-278`): side-washed card, sprite at `y+20` size 32, code/badge/crown; scrollable content. *Change:* monster size-up within the card; verify 1- and 2-monster comps don't overflow the card or row (memory: army-row scenes are coupling sites — check against `BASE_WIDTH=360`). *Preserve:* display-only.
- **DraftScene**: grid tile sprite size 28 (`:118`), detail-panel size 48 (`:207`, the app's current largest), tray size 26 (`:299`). *Change:* Golem steps up in each; add the 2-slot cost badge; the role/behaviour copy fix (Task 4). *Watch:* `chip()` has no right-edge bounds check (4.3 review).
- **PlacementScene**: 64px unit container, sprite at (0,-12) size 28; banned-cell tint + toasts already built. *Change:* monster size-up inside the 64px container (or accept controlled overhang — it visually mirrors the reserved ring); confirm the drag hit area still works. *Preserve:* the red "blocked" tint + `bannedCells` reservation display; single-cell (no second-cell marker).

### Testing standards
- Engine has a 90% line gate; this story is almost entirely `apps/web`, so focus web tests on DATA/manifest correctness (frames, attribution, credits, slot-cost), not pixels. The visual loom is **device-accepted**, matching every prior render story (2.1/2.2/4.x) — the codebase deliberately does not golden-pixel layout (deferred-work.md).
- Full gate before "review": `pnpm typecheck`, `pnpm lint` (+ prettier), `pnpm coverage` (engine ≥90%), `pnpm --filter web build`. No `balanceVersion`/`logVersion` change (this is pure rendering — no engine/balance/event edits). If nothing in `packages/engine` changes, the sweep and balance-hash need no re-run.

### Previous-story intelligence (4.8, shipped `db249d8` on branch `story/4-8-monsters-in-the-engine`)
- The single-cell model converged over ~8 device rounds; the authority is Danilo's pasted OB64 research + annotated screenshots, NOT inference from one screenshot (memory: danilo-ob64-fidelity). Present OB64-faithful behaviour; flag deviations.
- 4.8's Change Log + `deferred-work.md` (lines 3-6) hold the full model-revision trail and the FR38/dossier §2 rewrite flag. The Golem's engine move-kind defaulted to `slash` (open question — confirm at this device pass; it's cosmetic, STR-based either way).
- `MAX_MONSTERS_PER_ARMY` is the one exported cap the engine and Draft shell both read — never re-hardcode it.

### Project Structure Notes
- Touch (web): `src/assets/units.png` (+ a new frame), `src/assets/attribution.ts`, `src/config/sprites.ts`, `src/config/ui.ts` (size-aware picker), `src/scenes/{Reveal,Battle,History,Draft,Placement}Scene.ts` (size-up), `src/flow/draftModel.ts` (copy fix + confirm slot-cost), possibly `src/scenes/BootScene.ts` (guard is auto, but verify). Tests: `test/{sprites,attribution,credits,draft-model}.test.ts`.
- Touch (docs): `docs/rules.md` only if the Golem copy pin changes; the UX-spec amendments (DESIGN/EXPERIENCE golem-body token) are a reconciliation deliverable, not silent edits.
- No engine files. No `balanceVersion`/`logVersion` bump. No new runtime dependency.

### References
- [Source: docs/planning-artifacts/epics.md#Story-4.9 (lines 851-874)] — the four AC blocks (STALE: names a dragon, says "occupies both its cells"; reconciled above).
- [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md#D-3c (line 33), #§6 (lines 163-164)] — the render contract (≥48px, one body/HP bar/code, AD-14); [#D-1b (line 20)] Golem-only, dragon deferred. (Everything in the dossier assumes the 2-cell model — superseded.)
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md] — `{components.golem-body}` (spans-both-cells wording to reconcile), `{components.unit-card}` (side border, FR39f code tints), `{components.hp-bar}` (8px, side fill, `hpAfter`), Colors (blue-you/red-enemy load-bearing), Brand & Style (FR31 zero custom art).
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md] — "Epic 4 extension" (Golem ≥48px; "5 slots"), "Credits" (FR31 manifest), "Accessibility Floor" (≥32px sprite floor; HP bars/status distinguishable per unit), "Interaction Primitives" (drag, "no dead-ends").
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#FR31] art direction (free/CC packs, idle/attack/hurt/death, attribution + Credits); [#NFR1] perf floor + bundle; [#FR1/#FR38] 2-slot monster, max 2; [#FR4] placement (STALE two-cell wording).
- [Source: ARCHITECTURE-SPINE.md#AD-14] one unit / one id / derived footprint; [#AD-11] owner-local cells, shell-side display lookups; [#AD-2] static facts + HP from `hpAfter`, never guessed.
- [Source: docs/implementation-artifacts/4-8-monsters-in-the-engine.md] — the shipped engine + interim shell, model-revision trail, open questions.
- [Source: docs/implementation-artifacts/deferred-work.md] — D-3c "one code at anchor" (board-code-removal interaction), the 5 wave-1 newcomer INTERIM sprites (4.3 review), `sprites.test.ts` `SHEET_FRAMES=6` bump, `DraftScene.chip()` bounds (4.3 review), FR38/dossier §2 rewrite flag.
- Code map (verified this session): `sprites.ts:9-65`, `constants.ts:8-9,13-62`, `attribution.ts:9-67`, `ui.ts:124-128`, `BootScene.ts:34-63`, `main.ts:47-52`, `credits.ts:17-31`, `CreditsScene.ts:22-75`, `RevealScene.ts:108-138`, `BattleScene.ts:61-62,228-265,439,544-593`, `HistoryScene.ts:258-278`, `DraftScene.ts:118,207,299`, `PlacementScene.ts:23,196-327`, `draftModel.ts:46-47,77-85`, `flow/placement.ts:32,46-104`, `MatchFlow.ts:244-250`.

## Open questions for Danilo (not blockers; sensible defaults chosen — confirm during dev / at the device pass)
1. **The "spans both cells" UX conflict (binding contract).** Default: render the Golem as ONE oversized sprite (≥48px) looming over its single cell and overhanging its reserved neighbour ring, then amend the DESIGN/EXPERIENCE golem-body token to the single-cell wording. OK to reconcile this way, or do you want a different visual for the reserved ring?
2. **Bundle the 5 wave-1 newcomer sprites?** Berserker/Phalanx/Ninja/Valkyrie/Sorceress still borrow interim frames (4.3-review deferred item). Sourcing dedicated tiles is the SAME sheet-extension operation as the Golem's. Default: **Golem only** (stay in 4.9's scope); say the word if you'd rather I source all six dedicated tiles in one pass.
3. **Golem move-kind:** default `slash` (carried from 4.8's open question — cosmetic, STR-based). Confirm at the device pass, or pick `bash` for the heavy-brute feel.
4. **How large is "loom"?** Default ≥48px on the iso boards (1.5× a small's 32px, matching the app's existing largest sprite). Tune on device if it reads too big/small in the 56×28 iso tiles.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (1M context) — dev-story workflow.

### Debug Log References

- **Gate after Tasks 2–4 (partial story):** `pnpm typecheck` clean (both packages); `pnpm lint` + prettier clean; `pnpm test` = **539 passed** (40 files; +5 over 4.8's 534 — 4 loom-sizing + 1 slot-cost); `pnpm --filter web build` succeeds (the >500kB chunk warning is pre-existing Phaser bulk — no asset added this pass, so the NFR1 bundle is unchanged). Engine untouched → no coverage/sweep/balance-hash re-run needed.
- **`rules-doc.test.ts` AC6 drift guard caught the copy change:** the doc's class-table behaviour column is asserted `.toBe(classRulesCard(cls).behavior)`, so rewriting `CLASS_TEXT.golem` required the matching `docs/rules.md` golem-row edit in the same pass. Expected coupling, not a surprise.

### Completion Notes List

- **Loom rendering (Task 2) — the core.** One rule, one place: `MONSTER_LOOM_SCALE = 1.5` + pure `unitDisplaySize(cls, baseSize)` in `constants.ts`, baked into the shared `addUnitSprite` picker (`ui.ts`). Because every scene draws units through that one picker, all of Reveal/Battle/History/Draft/Placement now loom the Golem 1.5× with **zero per-scene branching** and zero call-site edits. On the 32px iso boards that's 48px (the dossier D-3c floor), overhanging the small tile exactly as the OB64 reference shows — a single-cell sprite drawn large, never a two-tile body.
- **Draft slot-cost (Task 3).** `RulesCard.slotCost` (from `SLOT_COST[sizeClass]`, data-derived) now renders on the DETAIL panel: "{role} · 2 slots · act 2/1/1" for the Golem, "· 1 slot ·" for smalls. The running budget was already slot-based (4.2), confirmed no change.
- **Stale copy (Task 4).** The last "two-cell body" prose (`CLASS_TEXT.golem` + the `docs/rules.md` table row) and the "two-cell CC0 body" comments (`sprites.ts`, `attribution.ts`) and `PlacementScene.firstFreeCell`'s "derived rear cell" note are all rewritten to the shipped single-cell model.
- **Binding-UX reconciliation confirmed by Danilo (device reference image).** "Spans both cells" was always the *adjacency* rule, never a two-tile sprite; the OB64 monster sits on one tile drawn oversized. Rendering approach = single oversized loom (Option A). **Still TODO (Danilo):** amend the DESIGN `{components.golem-body}` + EXPERIENCE "Epic 4 extension" tokens to drop the "spans both cells / at the anchor cell" wording so the binding spec matches the shipped app.
- **Art deferred by Danilo's decision ("code now, art + device later").** The Golem still uses the interim Knight frame (`UNIT_FRAMES.golem = 0`) — so it looms as a *big knight* in the browser today. Swapping the real tile is small and mechanical: composite one CC0 golem tile into `units.png`, bump the frame index, update `attribution.ts` (drop the INTERIM note), bump `sprites.test.ts` `SHEET_FRAMES`. Task 5's three manifest/frame tests are deferred to land WITH that tile (they'd fail against the still-interim state).
- **NOT device-verified (Task 6, Danilo's gate).** The loom size, the Battle code/badge anchor overlaps under the bigger sprite, placement "no drop lost", and the NFR1 frame rate all need the phone. Story stays **in-progress** until the real tile + device pass land — it is deliberately NOT marked "review," because its headline (real art + device acceptance) is genuinely Danilo's half.

### File List

**Web (`apps/web`)**
- `src/config/constants.ts` — new `MONSTER_LOOM_SCALE` + `unitDisplaySize(cls, baseSize)`; added runtime `BALANCE` import.
- `src/config/ui.ts` — `addUnitSprite` now looms monsters via `unitDisplaySize` (import added); doc comment updated.
- `src/flow/draftModel.ts` — `RulesCard.slotCost` + populated in `classRulesCard`; `CLASS_TEXT.golem` rewritten to single-cell.
- `src/scenes/DraftScene.ts` — DETAIL panel role line shows the slot cost.
- `src/config/sprites.ts` — `UNIT_FRAMES.golem` interim comment rewritten (still frame 0; loom noted).
- `src/assets/attribution.ts` — `classSources.golem` comment rewritten to single-cell + loom (source path still interim).
- `src/scenes/PlacementScene.ts` — `firstFreeCell` doc comment de-staled (no "derived rear cell").
- `test/constants.test.ts` — new "monster loom sizing" suite (4 tests).
- `test/draft-model.test.ts` — new slot-cost test; `SLOT_COST` import.

**Docs**
- `docs/rules.md` — golem class-table behaviour row updated to match `CLASS_TEXT.golem` (AC6 drift guard).

### Change Log

- 2026-07-20 — Story created (baseline `db249d8`). Written against the SHIPPED single-cell / Golem-only model, reconciling the stale epics.md AC (dragon + two-cell) explicitly. Scope: on-device Golem rendering + art (dedicated CC0 tile, size-aware "loom", Draft slot-cost display, stale two-cell copy cleanup, attribution/Credits, device pass). Engine/legality/sweep already done in 4.8 — untouched here. Three binding-UX conflicts flagged for reconciliation (spans-both-cells token, 2-of-5 slot-cost display, illegal-drop feedback). No `balanceVersion`/`logVersion` change. 4 non-blocking open questions for Danilo.
- 2026-07-20 — dev-story (partial): Tasks 2–4 done, gate GREEN (539 tests, typecheck/lint/prettier clean, web build OK). **Loom rendering** via one `MONSTER_LOOM_SCALE=1.5` + `unitDisplaySize` in `constants.ts`, baked into the shared `addUnitSprite` picker so every scene looms the Golem 1.5× (48px on the 32px boards, D-3c) with no per-scene branching. **Draft slot-cost** shown on the DETAIL panel via a data-derived `RulesCard.slotCost`. **Stale two-cell copy** fully cleaned (`CLASS_TEXT.golem` + `docs/rules.md` row + `sprites.ts`/`attribution.ts`/`PlacementScene` comments). Loom visual = Option A (single oversized sprite on one tile, overhanging), confirmed by Danilo against the OB64 reference image — "two cells" was always the adjacency rule, never a two-tile sprite. Golem still renders on the INTERIM Knight frame (looms as a big knight) per Danilo's "code now, art + device later" call. **Story stays in-progress:** Task 1 (real CC0 tile swap + its 3 manifest/frame tests) and Task 6 (device pass, NFR1) are Danilo's half; the DESIGN/EXPERIENCE golem-body token amendment is also still TODO. Engine untouched — no sweep/hash re-run.
