---
baseline_commit: 048ab7131f1bb379ce6ebdda9039238aeee06839
---

# Story 5.7: The battle-stats summary

Status: done

## Story

As a player,
I want the Result screen to show what actually happened — damage, blocks, dodges, crits, heals, statuses,
so that I can learn from the battle instead of just seeing who won.

## Acceptance Criteria

1. **The summary is a pure fold over the log.** Given the battle's `BattleLog` (AD-2 — the log already carries everything), when the Result screen renders, a summary shows per-unit and total: damage dealt/taken, blocks (`redirectedFrom`), dodges and crits (`outcome`), heals, statuses applied, and poison ticks — a pure fold over events, **no engine change, no version bump** (`balanceVersion` 11 and `logVersion` 4 untouched).
2. **Wipeout aggregates correctly.** Given Wipeout mode, when a multi-engagement battle ends, the summary aggregates across all engagements (poison persistence included), with unit identity held by `UnitId`.
3. **It fits, and it breaks nothing.** Given the 360-wide canvas and 5-unit armies, when the summary renders, the layout fits without overflow in every comp shape incl. monsters (the army-row coupling rule — comps run 3–5 units per side since 4.8), replay/history behavior is untouched, and Danilo's device pass accepts the read.

**AC1 deviation (dated 2026-07-29, device-accepted — recorded per the 5.6 precedent):** AC1
asks for "per-unit **and total**" across all nine counters. All nine ARE computed per unit AND
per side, and all nine are test-pinned at both levels — but only six reach the SIDE-TOTAL
lines (`▲dealt ▼taken · CRIT · DGE · BLK · HEAL`). Poison, heals RECEIVED, and statuses cast
are rendered per unit only (the chip-hold sheet's nine-row table). Two reasons, in this order:
the de-clutter is what Danilo accepted on device — round 2 made the whole summary optional
precisely because the always-on read was too much — and the full line does not fit the sheet's
inner 316px at worst wipeout widths anyway (the width pin caught exactly that overflow and
forced the `DMG ` prefix out). The counters are not missing, only not duplicated in the
totals; if the totals ever need them, the sheet needs a second line, not a longer one.

## Tasks / Subtasks

- [x] Task 1: The pure fold — `apps/web/src/flow/battleStats.ts` (AC: 1, 2)
  - [x] `battleStats(log)` folds `log.events` once into per-unit records (keyed `UnitId`, identity/names/classes from the `BattleStarted` roster snapshot) + per-side totals. **The semantics, stated here so the model never guesses:**
    - `dealt` — sum of `targets[].damage` over `UnitAttacked` where `source === me` (raw `damage`, the popup number — it can exceed HP removed on a killing blow, which is the OB64-honest read; `hpAfter` stays the bars' business). Misfire friendly-fire COUNTS as dealt — the marker+effect pair means the redirected `UnitAttacked` folds naturally, and hiding a confused unit's damage would lie.
    - `taken` — sum of `targets[].damage` where I am the target, from ANY attacker, plus my `PoisonTicked.damage`. Track `poisonTaken` separately too — the epic names poison ticks as their own read (and `PoisonTicked` carries no actor, so it can never be attributed as someone's `dealt`: the conservation invariant below is `Σtaken = Σdealt + Σpoison`).
    - `crits` — count of my `targets[]` entries with `outcome: 'crit'` (source = me). `dodges` — count of entries where I am the target with `outcome: 'dodged'` (the DODGER gets the credit; the attacker's whiff is the same event read from the other side — display one, not both).
    - `blocks` — count of `UnitAttacked` with `redirectedFrom === me`: the GUARDIAN gets the credit. **`redirectedFrom` is attribution, NOT a retarget** (Danilo's 2026-07-19 revision, types.ts:328–335 — the attacked unit stays `targets[].unit`); the recorded `damage` is already post-Guard (a full Guard reports 0 with outcome `'hit'`), so blocks are a counter, never a damage adjustment.
    - `healsGiven` — sum of `UnitHealed.amount` where `source === me`; `healsReceived` where `target === me`. `amount` is the EFFECTIVE restore (FR11 caps at max HP — types.ts:346-350), so give/receive conserve exactly.
    - `statusesApplied` — count of `StatusApplied` where `source === me` (the no-stack fizzle case emits `ActionFizzled`, not `StatusApplied`, so wasted casts never count).
  - [x] Tests: (a) a hand-derived micro-battle pinning every counter (the roster.test fixture style — pick a seed, derive by hand); (b) invariants over several fixed seeds × BOTH modes: `Σdealt(all units) + Σpoison = Σtaken(all units)`, `ΣhealsGiven = ΣhealsReceived`, every stats key appears in the `BattleStarted` roster and vice versa; (c) a wipeout seed where poison ticks across ≥2 engagements and a unit dies mid-battle (its id keeps its accumulated stats — AC2's identity clause); (d) a blocks fixture (Phalanx guard consumed) crediting the guardian; (e) a misfire seed proving friendly-fire folds into `dealt`.
- [x] Task 2: The presentation — DECIDE with Danilo at dev start (the 5.5/5.6 precedent), then build (AC: 1, 3)
  - **SUPERSEDED IN PART at device round 2 (2026-07-29)** — the sub-item below is kept as
    written (the plan of record at dev start), but layer (i) SHIPPED AND WAS THEN RETIRED: the
    always-on totals strip lasted one round. Danilo asked for the summary to be OPTIONAL ("you
    click and see; otherwise you don't click and ignore"), so the free band now holds a
    `▸ BATTLE SUMMARY` link and the totals lines moved INSIDE the sheet it opens, above his
    LoL-style per-unit damage bars. Layer (ii) — chip long-press → per-unit sheet — shipped
    exactly as planned. Nothing named `STATS_STRIP` exists in the tree.
  - [x] **Recommendation: two layers, both reusing what exists.** (i) An inline per-side TOTALS strip on the Result screen — one compact line per side (dealt · taken · crits · dodges · blocks · heals), in the measured free band between the HP-count-up and "Your army" (pct line centre y≈173, comp heading y=256 — ~60px of real estate; geometry as arithmetic, pinned). (ii) Per-unit detail via **long-press on the existing Result comp chips** — the 5.6 gesture, same `LONG_PRESS_MS`, opening a stats sheet built on the 5.6 overlay mechanics. One gesture language across the whole game: hold a unit, learn about it.
  - [x] Gesture audit (epic-4 retro agreement — LIGHT here, state it anyway): Result's only interactives today are the Rematch/Home buttons; the comp chips are display-only (no tap meaning to collide with). New state (pressed-chip timer, open sheet) resets in `create()` (singleton scenes); timer cancels on pointerout/release; no drag exists at Result.
- [x] Task 3: Extract the modal-sheet SHELL from the 5.6 overlay, don't copy it (AC: 3)
  - [x] `unitCardOverlay.ts`'s scrim + opaque plate + 9-slice frame + sheet blocker + ✕ + the ARMED down→up close handshake are card-agnostic — extract an `addModalSheet(scene, geometry, requestClose)` shell (new `apps/web/src/config/modalSheet.ts` or a ui.ts builder), re-point the unit card at it (pure refactor — the 5.6 review's close-handshake semantics must survive verbatim, comments included), and build the stats sheet as its second consumer.
  - [x] The stats sheet content: the unit's chip identity (sprite, name, code) + its counters, laid out per a `STATS_CARD` geometry constant with derived worst-case tests (longest soldier name from the NAME tables, widest counter at 3 digits — the 5.6 discipline: measured budgets, no fiat strings).
- [x] Task 4: Wire Result (AC: 1, 2, 3)
  - [x] `ResultScene.create()` already holds the log (`this.flow.resolve()` at line ~46 — memoized in the flow, so calling for stats costs nothing) — fold ONCE, render the summary LINK (the strip per Task 2's supersession note), arm the chips.
  - [x] REPLAY integrity: Result renders after replays too (MatchFlow's `replay` flag makes `recordResult()` a no-op — the GUARD is MatchFlow.ts:399–400 `if (this.replay || this.historyWritten) return;`; the flag's lifecycle is :52/:89/:127); the summary reads the same log and must change NOTHING about that guard. Pin with the existing replay tests untouched + one assertion that `battleStats` is deterministic for a replayed log (same events in = same stats out, trivially, but it documents the contract).
  - [x] Layout fits every comp shape: the summary link's tap zone inside Result's derived free band and both sheets' budgets proven by their own geometry tests (the totals lines' width pin now sits at the sheet's inner 316px, where they actually render); chips already proven (4.2). The army-row coupling rule: grep the comp-rendering scenes ONLY if a size constant changes — this story adds none.
- [x] Task 5: Docs + gate (AC: 3)
  - [x] `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` + `EXPERIENCE.md`: dated amendment — the totals strip, the stats sheet, and the "hold a unit, learn about it" gesture generalization (full paths; never root-level files).
  - [x] No engine changes (assert zero diff under packages/engine); no rules.md change expected (UI-only) — verify no drift guard trips.
  - [x] Full gate: typecheck, lint, knip, coverage (engine ≥90%), web build.
  - [x] Device pass with Danilo — **ACCEPTED 2026-07-29 after two rounds ("very good. i like it")**: the optional ▸ BATTLE SUMMARY link, the LoL-style damage bars, the ▲▼ totals, and the chip-hold drill-down.

### Review Findings (senior code review 2026-07-29 — Fable 5, 3 adversarial layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor)

- [x] [Review][Patch] HIGH: `addButton` fires on a bare pointerup — a sheet-dismiss tap whose DOWN lands in the one-frame deferred-destroy window releases onto Rematch/Home and FIRES it; add down-on-this-button tracking to the builder [config/ui.ts + modalSheet interplay]
- [x] [Review][Patch] MEDIUM: the shell's `armed` flag goes stale on non-closing paths (down on scrim, release on the sheet blocker) — a LATER sheet-to-scrim drag release then closes unexpectedly; consume the flag on read + disarm on blocker pointerdown [config/modalSheet.ts]
- [x] [Review][Patch] MEDIUM: a pending chip long-press can fire UNDER an open summary scrim (armed before the sheet; scrim blocks its cancel events) — cancel before building any sheet + guard the timer callback [ResultScene]
- [x] [Review][Patch] MEDIUM: the deferred close races a same-tick open — it destroys whatever `sheetObjects` holds WHEN IT FIRES, killing a just-opened sheet; capture identity [ResultScene.closeSheet]
- [x] [Review][Patch] MEDIUM: `battleStats` casts `events[0] as BattleStarted` unchecked while selling itself as provenance-agnostic — an empty/foreign log crashes Result; fail soft to empty stats + test [flow/battleStats.ts]
- [x] [Review][Patch] MEDIUM: AC1's "and total" is only two-thirds met — poison/statuses/heals-received totals are computed and test-pinned but rendered nowhere; record the dated AC deviation (device-accepted de-clutter; the per-unit table carries them) [story AC1]
- [x] [Review][Patch] MEDIUM: the AC2 "death keeps its stats" test is tautological (row exists + taken>0 proves nothing about retention) — fold the log truncated at the death and require the dead unit's row IDENTICAL to the full fold's, with a later engagement proving "mid-battle" [battle-stats.test.ts]
- [x] [Review][Patch] LOW: `'missed'` (reserved outcome) folds silently — make the nothing-counted decision explicit with a comment + a synthetic-log pin [flow/battleStats.ts + test]
- [x] [Review][Patch] LOW: 5-digit values would overrun the pinned 40px column and the sheet width — clamp at `9999+` in the formatter and the bar value [battleStats/statsStripLine + summarySheetOverlay]
- [x] [Review][Patch] LOW: the shell's depth band (scrim 300 / chrome 301 / CONTENT 302 / ✕ 303) is load-bearing and undocumented — state it in the CALLER CONTRACT and export SHEET_CONTENT_DEPTH for the three consumers' magic 302s [modalSheet.ts + consumers]
- [x] [Review][Patch] LOW: the shell's own comments are stale about its consumers ("second consumer", "UNIT_CARD and STATS_CARD both satisfy it") — three consumers exist [modalSheet.ts]
- [x] [Review][Patch] LOW: `statsStripLine`'s headline says it feeds "the Result strip" (dead UI); `LONG_PRESS_MS`'s comment says "the unit-data card" and "BOTH scenes" (it's three scenes and two sheet kinds now) [battleStats.ts + constants.ts]
- [x] [Review][Patch] LOW: the summary link fires on a bare pointerup with no wander check — the only tap in the scene family without one [ResultScene link handler]
- [x] [Review][Patch] LOW: the stale strip-era width test pins the retired 344px canvas budget (the line lives in the sheet's 316px now, pinned separately) — delete it, keep the exactness pin [battle-stats.test.ts]
- [x] [Review][Patch] LOW: STATS_CARD's comment says "246 exactly" but the test is ≤ — pin equality [battle-stats.test.ts]
- [x] [Review][Patch] LOW: three fiat numbers where the house rule says derive: the link band's 190/250 (derive from ResultScene's 0.27/0.4 fractions), the 10-row worst case (derive from 2×slotBudget/min SLOT_COST), and one of the two digit metrics (7.5px at both 10px and 11px is not a measurement) [battle-stats.test.ts]
- [x] [Review][Patch] LOW: SUMMARY_CARD lacks its sibling's clearance pins — title vs ✕ zone, footer width, totals-line spacing (the `i*18+8` magic lives in the overlay where the budget test can't see it: move `totalsLineH` into the constant) [constants + summarySheetOverlay + test]
- [x] [Review][Patch] LOW: the ▲▼ width pins assume 6px monospace arrows — geometric glyphs fall back to platform fonts; add a fallback allowance to the width assertions [battle-stats.test.ts]
- [x] [Review][Patch] LOW: the sheet's hint strands the reader ("Hold an army unit" — inside a modal that blocks the chips, without saying close first, and nothing on Result is called an army unit) — reword to name the chips and the dismissal [summarySheetOverlay.ts]
- [x] [Review][Patch] LOW: `openSheet(id: string)` weakens `UnitId` [ResultScene]
- [x] [Review][Patch] LOW: Tasks 2/4 are checked against the retired strip ("render the totals strip") with no supersession note; the Gate paragraph's "+17" arithmetic matches no state (712→726 is +14) and its REMAINING line still names the strip; File List: summarySheetOverlay.ts missing, ghost STATS_STRIP, "12 tests" stale, "totals strip" wording [story record]
- [x] [Review][Patch] LOW: DESIGN.md's amendment heading registers `{components.stats-strip}` (retired, defined nowhere) and omits the two components that shipped [DESIGN.md]
- [x] [Review][Defer] Multi-touch: Result adds a third single-pointer gesture surface — the 5.6 deferral explicitly extended to cover it (second finger clobbers the shared timer; chip-hold + link-tap interleave) [deferred-work.md]
- [x] [Review][Defer] The poison-witch teaching read: `PoisonTicked` has no actor, so a match-winning poisoner bars as a near-pacifist while her victims' taken swells — semantically correct and documented, but the summary never says it; logged for Danilo as a UX decision (e.g. a ☠ annotation) rather than patched unilaterally [deferred-work.md]

**Dismissed as noise (1):** the story-vs-sprint device-pass contradiction — an artifact of the review diff predating the acceptance recording; the tree already agrees (verified by the Auditor's own regeneration).

**Independently re-verified by the Acceptance Auditor:** engine 0 lines; versions untouched; the replay guard 0-diff; fold semantics exactly matching the engine event shapes; conservation + heal-conservation over 5 seeds × both modes; the 5.6 armed handshake preserved verbatim through the extraction; all geometry budgets arithmetic-checked; 726/726 green.

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

Claude Fable 5 — via the BMad `dev-story` workflow.

### Debug Log References

Two probe scripts (job tmp, not committed): a wipeout scenario inventory over the invariant
fixture (every seed 1–25 carries poison-across-engagements, deaths, and blocks — seed 1 chosen)
and a misfire hunt over the confusion-test fixture shape (seed 1: a confused B archer arrows
its own side for 14 — the friendly-fire pin).

### Completion Notes List

**AC1 — the fold.** NEW pure `flow/battleStats.ts`: one pass over `log.events` into per-unit
counters + per-side totals, id-keyed off the `BattleStarted` roster. The story's semantics
table shipped verbatim (dealt = raw popup damage incl. misfire friendly-fire; taken adds
actor-less poison, tracked separately as `poisonTaken`; blocks credit the GUARDIAN via the
`redirectedFrom` attribution; dodges credit the dodger; heals conserve exactly; fizzled casts
never count). Proven two ways: a SYNTHETIC hand-written log pinning every counter's exact
semantics (the fold is provenance-agnostic, so a constructed log is the sharpest fixture) and
REAL battles — conservation `Σdealt + Σpoison = Σtaken` and `ΣhealsGiven = ΣhealsReceived`
over 5 seeds × both modes, plus the three probed scenario pins: wipeout poison across ≥2
engagements with a mid-battle death keeping its stats (AC2), per-guardian block counts equal
to the log's `redirectedFrom` appearances, and the friendly-fire misfire folding into dealt.

**The presentation (the recommendation shipped; Danilo judges the read at the device pass).**
(i) The TOTALS STRIP: two side-colored Courier-800 lines in Result's measured 190–250 free
band — `DMG dealt/taken · CRIT n · DGE n · BLK n · HEAL n` via the pure `statsStripLine`
(string pinned by test; worst 4-digit wipeout width fits 360). (ii) Per-unit detail behind a
LONG-PRESS on the existing comp chips — "hold a unit, learn about it", the 5.6 gesture now
covering the whole loop. The chips were display-only, so the gesture audit is light (recorded
in the code comment); the timer carries the full 5.6 hygiene: cancel on release/pointer-out,
movement check at fire (Result has no drag to cancel it for free), reset in `create()`.

**Task 3 — the shell extraction.** The 5.6 overlay's chrome + ARMED close handshake moved to
`config/modalSheet.ts` (`addModalSheet(scene, geometry, requestClose)`), with the 5.6 review
history preserved in ITS doc comment (the stale-flag/fall-through compound bug is why the
handshake exists — the warning against "simplifying" it travels with the code).
`unitCardOverlay.ts` re-pointed at the shell — behavior-identical, all 23 unit-card tests
green untouched. The stats sheet (`config/statsSheetOverlay.ts`) is the shell's second
consumer: header sprite (RAW frame at 40 — the 5.6 de-loom lesson) + soldier name in the
side colour + class, then nine label/value rows driven by `STATS_SHEET_ROWS` in constants —
typed `keyof SideTotals` (type-only import, no cycle), so a renamed counter is a compile
error and the completeness test proves every counter is surfaced exactly once.

**AC3 — fit + replay.** Geometry pinned: STATS_CARD's vertical budget is exact
(14+56+9×18+14 = 246), the strip lines sit inside the free band and never touch, worst
label + 4-digit value derived, longest soldier name from the LIVE name tables fits the
header. Replay integrity: `recordResult()`'s guard untouched (the fold reads the same
memoized log); determinism pinned (same events in = same stats out). Engine diff: 0 lines;
`balanceVersion` 11 / `logVersion` 4 untouched.

**Device pass ROUND 2 (2026-07-29) — "my main point is that it could be something optional…
you click and see; otherwise you don't click and ignore", plus the LoL-history bars idea
("if it's too much we keep numbers" — it was not too much: bars are three rectangles per
row).** Shipped: the strip is gone; a ▸ BATTLE SUMMARY link opens the sheet — totals lines +
per-unit dealt/taken bars on one shared scale + the drill-down hint. New files:
`config/summarySheetOverlay.ts` (the shell's third consumer), `SUMMARY_LINK`/`SUMMARY_CARD`
geometry (budgets pinned; the width pin earned its keep immediately — the totals line
overflowed the sheet's inner width at worst wipeout numbers until the redundant `DMG ` prefix
dropped). `statsBarMax` in the model (shared scale, floored at 1 so an all-guard battle can't
NaN a bar width). Crits/heals per unit stay in the chip-hold sheet — the bars answer "who
carried, who tanked", the table answers everything else.

**Device pass ROUND 1 (2026-07-29): Danilo read `633/198` on the strip and asked what it
meant — the slash paired two numbers without saying which was which.** Fixed: `DMG ▲633 ▼198`
(▲ sent out, ▼ received) — full DEALT/TAKEN words measurably exceed the 10px line's 344px
budget at worst wipeout widths, so the arrows carry the labels. Format re-pinned; DESIGN.md
amendment updated. His question also surfaced a good teaching read the record should keep:
the cross-pairs legitimately DON'T match (you dealt 633, the enemy took 621; they dealt 186,
you took 198) because taken includes actor-less poison and dealt includes friendly-fire
misfires — the fold being honest, exactly as the conservation invariant predicts.

**Gate (final, after the review patches):** typecheck, lint, knip, coverage — **729 tests**,
engine **99.06% lines** — and the web build, all green. Arithmetic: the tree stood at 712
tests at 5.6 close; this story added 17 (16 battle-stats through device round 2, +1 summary
clearance pin from the review) and the shell extraction left unit-card's 23 green untouched.
Engine diff: 0 lines; `balanceVersion` 11 / `logVersion` 4 untouched.

### File List

- `apps/web/src/flow/battleStats.ts` — NEW: the pure fold (UnitStats/SideTotals/battleStats) + statsStripLine, statsBarMax, clampStat
- `apps/web/test/battle-stats.test.ts` — NEW: 17 tests (synthetic-log semantics incl. the reserved `'missed'` pin, real-battle invariants, the three probed scenarios, the presentation/geometry contracts)
- `apps/web/src/config/modalSheet.ts` — NEW: the shared modal-sheet shell (extracted from the 5.6 overlay; the armed-close history lives here now) + SHEET_CONTENT_DEPTH
- `apps/web/src/config/statsSheetOverlay.ts` — NEW: the per-unit stats sheet (the shell's second consumer)
- `apps/web/src/config/summarySheetOverlay.ts` — NEW: the battle-summary sheet — totals lines + the per-unit damage bars (the shell's third consumer, device round 2)
- `apps/web/src/config/unitCardOverlay.ts` — re-pointed at the shell (pure refactor; unit-card tests untouched and green)
- `apps/web/src/config/constants.ts` — STATS_CARD, STATS_SHEET_ROWS (typed keyof SideTotals), SUMMARY_LINK, SUMMARY_CARD, SUMMARY_TITLE/SUMMARY_HINT
- `apps/web/src/config/ui.ts` — `addButton` now requires a down→up pair on the SAME button (the review's HIGH: a bare pointerup could fire Rematch/Home from a sheet-dismiss release)
- `apps/web/src/scenes/ResultScene.ts` — the fold, the ▸ BATTLE SUMMARY link, the chip long-press + sheet lifecycle
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md` + `EXPERIENCE.md` — dated 5.7 amendments
- `docs/implementation-artifacts/5-7-the-battle-stats-summary.md`, `docs/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-07-29: Story implemented end-to-end — pure battleStats fold (semantics table shipped
  verbatim, conservation invariants + three probed scenario pins), totals strip + chip
  long-press per the recommendation, the 5.6 modal shell EXTRACTED to config/modalSheet.ts
  with its review history preserved, UX spine amended (dated). Engine untouched; gate green
  (724 tests, engine 99.06% lines). Status -> review. REMAINING: Danilo's device pass.
- 2026-07-29: Device round 1 — the strip's `dealt/taken` slash didn't read ("what does 633/198
  mean"); re-cut as `DMG ▲dealt ▼taken`, format re-pinned, DESIGN.md updated. Awaiting the
  re-pass.
- 2026-07-29: Device round 2 — two directions from Danilo, both shipped: (1) the summary is
  OPTIONAL ("you click and see; otherwise you don't click and ignore") — the always-on strip
  is gone, replaced by a gold ▸ BATTLE SUMMARY link (44px zone in the same measured band)
  opening a sheet; (2) his LoL-history reference — the sheet leads with per-unit DAMAGE BARS
  (side-colored dealt over thin neutral taken, one shared statsBarMax scale so bars compare
  across units/sides/metrics, avatars leading, dealt value at the row end), with the ▲▼
  totals lines above and a drill-down hint below (chip hold = the full per-unit table, which
  covers his "crits and heal?" without crowding the bars). The sheet is the modal shell's
  THIRD consumer. En route the sheet's width pin caught the totals line overflowing the inner
  316px at worst wipeout widths — the now-redundant `DMG ` prefix dropped (the arrows carry
  the label). Gate re-green (726 tests). Awaiting the round-2 re-pass.
- 2026-07-29: Device pass ACCEPTED ("very good. i like it") — all tasks closed; story stays in
  review awaiting the code-review pass.
- 2026-07-29: SENIOR CODE REVIEW PATCHES — all 22 applied, 2 deferred, 1 dismissed. The HIGH:
  `addButton` now demands a down→up pair on the SAME button (a sheet-dismiss release could
  otherwise fire Rematch/Home through the one-frame deferred-destroy window). Three more
  input-lifecycle fixes: the shell's `armed` flag is consume-on-read and the sheet blocker
  disarms (no stale flag closing a LATER drag), a pending chip long-press is cancelled before
  any sheet is built and re-checked at fire, and the deferred close captures its sheet's
  identity so it cannot kill a same-tick replacement. `battleStats` fails soft on a log that
  does not open with `BattleStarted` (it sells itself as provenance-agnostic; now it is), and
  `clampStat` caps every width-budgeted value at `9999+`. Tests: the AC2 retention pin is no
  longer tautological (the dead unit's row must be IDENTICAL to a fold of the log truncated at
  its death), the reserved `'missed'` outcome is pinned as counting nothing, the retired
  strip's canvas-width pin is gone (the line's width is pinned where it renders — the sheet's
  inner 316px), STATS_CARD's budget is an equality, and three fiat numbers became derivations:
  the link band from Result's own 0.27/0.4 fractions, the ten-row worst case from
  `BALANCE.slotBudget / min(SLOT_COST)`, and every digit width from one advance ratio per font
  family — with a fallback allowance for the ▲▼ geometric glyphs, which Courier does not have.
  New SUMMARY_CARD clearance pins (title vs the ✕ zone, totals-line spacing, footer width),
  with the sheet's title and hint moved into constants so a width test can read them; the hint
  now names the chips AND the dismissal. Docs: the AC1 totals deviation recorded, Task 2's
  retired-strip supersession noted, DESIGN.md's amendment registers the three components that
  shipped instead of the retired `stats-strip`, and the File List / gate arithmetic match the
  tree. Gate re-green: 729 tests, engine 99.06% lines, typecheck/lint/knip/coverage/build.
  Engine still 0 diff lines.
