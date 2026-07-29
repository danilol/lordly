# Story 5.7: The battle-stats summary

Status: ready-for-dev

## Story

As a player,
I want the Result screen to show what actually happened — damage, blocks, dodges, crits, heals, statuses,
so that I can learn from the battle instead of just seeing who won.

## Acceptance Criteria

1. **The summary is a pure fold over the log.** Given the battle's `BattleLog` (AD-2 — the log already carries everything), when the Result screen renders, a summary shows per-unit and total: damage dealt/taken, blocks (`redirectedFrom`), dodges and crits (`outcome`), heals, statuses applied, and poison ticks — a pure fold over events, **no engine change, no version bump** (`balanceVersion` 11 and `logVersion` 4 untouched).
2. **Wipeout aggregates correctly.** Given Wipeout mode, when a multi-engagement battle ends, the summary aggregates across all engagements (poison persistence included), with unit identity held by `UnitId`.
3. **It fits, and it breaks nothing.** Given the 360-wide canvas and 5-unit armies, when the summary renders, the layout fits without overflow in every comp shape incl. monsters (the army-row coupling rule — comps run 3–5 units per side since 4.8), replay/history behavior is untouched, and Danilo's device pass accepts the read.

## Tasks / Subtasks

- [ ] Task 1: The pure fold — `apps/web/src/flow/battleStats.ts` (AC: 1, 2)
  - [ ] `battleStats(log)` folds `log.events` once into per-unit records (keyed `UnitId`, identity/names/classes from the `BattleStarted` roster snapshot) + per-side totals. **The semantics, stated here so the model never guesses:**
    - `dealt` — sum of `targets[].damage` over `UnitAttacked` where `source === me` (raw `damage`, the popup number — it can exceed HP removed on a killing blow, which is the OB64-honest read; `hpAfter` stays the bars' business). Misfire friendly-fire COUNTS as dealt — the marker+effect pair means the redirected `UnitAttacked` folds naturally, and hiding a confused unit's damage would lie.
    - `taken` — sum of `targets[].damage` where I am the target, from ANY attacker, plus my `PoisonTicked.damage`. Track `poisonTaken` separately too — the epic names poison ticks as their own read (and `PoisonTicked` carries no actor, so it can never be attributed as someone's `dealt`: the conservation invariant below is `Σtaken = Σdealt + Σpoison`).
    - `crits` — count of my `targets[]` entries with `outcome: 'crit'` (source = me). `dodges` — count of entries where I am the target with `outcome: 'dodged'` (the DODGER gets the credit; the attacker's whiff is the same event read from the other side — display one, not both).
    - `blocks` — count of `UnitAttacked` with `redirectedFrom === me`: the GUARDIAN gets the credit. **`redirectedFrom` is attribution, NOT a retarget** (Danilo's 2026-07-19 revision, types.ts:328–335 — the attacked unit stays `targets[].unit`); the recorded `damage` is already post-Guard (a full Guard reports 0 with outcome `'hit'`), so blocks are a counter, never a damage adjustment.
    - `healsGiven` — sum of `UnitHealed.amount` where `source === me`; `healsReceived` where `target === me`. `amount` is the EFFECTIVE restore (FR11 caps at max HP — types.ts:346-350), so give/receive conserve exactly.
    - `statusesApplied` — count of `StatusApplied` where `source === me` (the no-stack fizzle case emits `ActionFizzled`, not `StatusApplied`, so wasted casts never count).
  - [ ] Tests: (a) a hand-derived micro-battle pinning every counter (the roster.test fixture style — pick a seed, derive by hand); (b) invariants over several fixed seeds × BOTH modes: `Σdealt(all units) + Σpoison = Σtaken(all units)`, `ΣhealsGiven = ΣhealsReceived`, every stats key appears in the `BattleStarted` roster and vice versa; (c) a wipeout seed where poison ticks across ≥2 engagements and a unit dies mid-battle (its id keeps its accumulated stats — AC2's identity clause); (d) a blocks fixture (Phalanx guard consumed) crediting the guardian; (e) a misfire seed proving friendly-fire folds into `dealt`.
- [ ] Task 2: The presentation — DECIDE with Danilo at dev start (the 5.5/5.6 precedent), then build (AC: 1, 3)
  - [ ] **Recommendation: two layers, both reusing what exists.** (i) An inline per-side TOTALS strip on the Result screen — one compact line per side (dealt · taken · crits · dodges · blocks · heals), in the measured free band between the HP-count-up and "Your army" (pct line centre y≈173, comp heading y=256 — ~60px of real estate; geometry as arithmetic, pinned). (ii) Per-unit detail via **long-press on the existing Result comp chips** — the 5.6 gesture, same `LONG_PRESS_MS`, opening a stats sheet built on the 5.6 overlay mechanics. One gesture language across the whole game: hold a unit, learn about it.
  - [ ] Gesture audit (epic-4 retro agreement — LIGHT here, state it anyway): Result's only interactives today are the Rematch/Home buttons; the comp chips are display-only (no tap meaning to collide with). New state (pressed-chip timer, open sheet) resets in `create()` (singleton scenes); timer cancels on pointerout/release; no drag exists at Result.
- [ ] Task 3: Extract the modal-sheet SHELL from the 5.6 overlay, don't copy it (AC: 3)
  - [ ] `unitCardOverlay.ts`'s scrim + opaque plate + 9-slice frame + sheet blocker + ✕ + the ARMED down→up close handshake are card-agnostic — extract an `addModalSheet(scene, geometry, requestClose)` shell (new `apps/web/src/config/modalSheet.ts` or a ui.ts builder), re-point the unit card at it (pure refactor — the 5.6 review's close-handshake semantics must survive verbatim, comments included), and build the stats sheet as its second consumer.
  - [ ] The stats sheet content: the unit's chip identity (sprite, name, code) + its counters, laid out per a `STATS_CARD` geometry constant with derived worst-case tests (longest soldier name from the NAME tables, widest counter at 3 digits — the 5.6 discipline: measured budgets, no fiat strings).
- [ ] Task 4: Wire Result (AC: 1, 2, 3)
  - [ ] `ResultScene.create()` already holds the log (`this.flow.resolve()` at line ~46 — memoized in the flow, so calling for stats costs nothing) — fold ONCE, render the totals strip, arm the chips.
  - [ ] REPLAY integrity: Result renders after replays too (MatchFlow's `replay` flag makes `recordResult()` a no-op — the GUARD is MatchFlow.ts:399–400 `if (this.replay || this.historyWritten) return;`; the flag's lifecycle is :52/:89/:127); the summary reads the same log and must change NOTHING about that guard. Pin with the existing replay tests untouched + one assertion that `battleStats` is deterministic for a replayed log (same events in = same stats out, trivially, but it documents the contract).
  - [ ] Layout fits every comp shape: totals strip width at 360 with worst counters; chips already proven (4.2); the stats sheet is modal (fit proven by its own geometry test). The army-row coupling rule: grep the comp-rendering scenes ONLY if a size constant changes — this story adds none.
- [ ] Task 5: Docs + gate (AC: 3)
  - [ ] `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` + `EXPERIENCE.md`: dated amendment — the totals strip, the stats sheet, and the "hold a unit, learn about it" gesture generalization (full paths; never root-level files).
  - [ ] No engine changes (assert zero diff under packages/engine); no rules.md change expected (UI-only) — verify no drift guard trips.
  - [ ] Full gate: typecheck, lint, knip, coverage (engine ≥90%), web build. Device pass with Danilo: the totals read, a per-unit sheet on a dragon and on a witch, and a wipeout battle's bigger numbers.

## Dev Notes

### The log is the spec (AD-2)

Event shapes, all barrel-exported (packages/engine/src/index.ts:12–36). Three blocks in types.ts: the action events at :300–410, `UnitSnapshot`/`BattleStarted` (the identity table) at :251–267, and `EngagementEnded`/`BattleEnded` + the full `BattleEvent` union at :452–499 (the invariant test's union walk needs the whole set):
- `UnitAttacked { source, kind, redirectedFrom?, targets: [{ unit, damage, hpAfter, outcome: 'hit'|'crit'|'dodged'|'missed' }] }` — one event per action; AoE (blast/breath) carries one target entry per struck unit; `'missed'` is reserved and unused (fold it as zero-impact if ever seen, don't crash).
- `UnitHealed { source, target, amount, hpAfter }` — `amount` effective (capped). Heals never crit and are never dodged.
- `StatusApplied { source, target, spell }`; a wasted no-stack cast is `ActionFizzled` instead.
- `PoisonTicked { unit, damage, hpAfter }` — NO actor (the shell's `POISON_TEXT` neutral exists for this reason); ticks at every natural engagement end, persists across wipeout engagements (FR19), skipped entirely on an instant wipe (recorded decision — so a wipeout seed can end with zero ticks despite poison being cast; don't let a test assume otherwise).
- `ActionMisfired` is a MARKER immediately followed by its effect event (pair shape, types.ts:368–377) — the fold needs no special case, the effect events carry real sources/targets.
- `BattleStarted.units: UnitSnapshot[]` is the identity table (id, side, class, name, element, placement) — the same one ResultScene already uses for the comp chips.
- `EngagementEnded.hp` exists but is NOT this story's input — the fold derives everything from action events; don't cross-check against it (overkill damage makes them legitimately disagree).

### What ResultScene is today (read it before touching — 156 lines)

Banner y≈102 · HP count-up y≈173 (mono, tweened; instant under reduced motion) · "Your army" y=256 + chips centred y≈300 · "Enemy army" y=358 + chips y≈402 · Rematch y≈505 · Home y≈576. The free band for the totals strip is ≈190–250. `flow.resolve()` is memoized (safe to reuse); `flow.recordResult()` at line ~49 is the ONE live history write and is replay-guarded in the flow — do not move or wrap it. Chips are built in `drawComposition` — that's where the long-press arms (chip rects are already per-unit objects with the roster snapshot in hand).

### What 5.6 built for you (fresh, same session — reuse, don't rebuild)

- The overlay mechanics with the ARMED close handshake (`config/unitCardOverlay.ts`) — Task 3 extracts its shell; read its contract comment first, the review history in it is load-bearing (the stale-flag/fall-through compound bug is why the handshake exists).
- `LONG_PRESS_MS` + `TAP_DISTANCE_PX` (shared constants since the 5.6 review), `PALETTE.boneFill`, the geometry-token + derived-worst-case test discipline (`UNIT_CARD` + unit-card.test.ts are the templates).
- 5.6 review lessons that bite here too: timers cancel on any rebuild that destroys the pressed object; singleton scenes reset every new field in `create()`; never destroy the dispatching object (defer one tick); worst-case tests derive from live data, never fiat strings.

### Scope fences

NOT in this story: engine changes of any kind, kills/MVP-style derived awards (not in the epic AC), a battle timeline/graph, changes to what the log records, the Battle scene's log panel (its wrap-overflow item lives in deferred-work from 5.2), History screen changes (replays reach this summary through Result untouched).

### Project Structure Notes

NEW: `apps/web/src/flow/battleStats.ts`, `apps/web/test/battle-stats.test.ts`, the extracted modal-sheet shell (`apps/web/src/config/modalSheet.ts` or ui.ts). MODIFIED: `apps/web/src/scenes/ResultScene.ts`, `apps/web/src/config/constants.ts` (STATS_CARD + strip geometry), `apps/web/src/config/unitCardOverlay.ts` (re-pointed at the shell — behavior-identical), `…/ux-lordly-2026-07-13/DESIGN.md` + `EXPERIENCE.md` (dated), this story, `sprint-status.yaml`. NOT modified: `packages/engine/**`, `rules.md`, MatchFlow's replay guard.

### References

- [Source: docs/planning-artifacts/epics.md#Story-5.7 — the three AC blocks]
- [Source: packages/engine/src/types.ts:251–267 + :300–410 + :452–499 — snapshot, action events, union; :328–335 the redirectedFrom attribution revision]
- [Source: apps/web/src/scenes/ResultScene.ts — the layout map + the recordResult replay guard]
- [Source: docs/implementation-artifacts/5-6-the-unit-data-card.md#Dev-Agent-Record — the overlay mechanics, the review's close-handshake bug, the geometry discipline]
- [Source: docs/implementation-artifacts/epic-4-retro-2026-07-22.md — the gesture-audit agreement]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
