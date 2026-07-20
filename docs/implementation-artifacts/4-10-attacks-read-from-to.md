# Story 4.10: Attacks read from→to

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to see who attacks whom — melee steps in and returns, arrows and blasts cross the gap, heals and spells trace to their target,
so that battles read as cause and effect, not a series of numbers popping in place.

> **Scope in one line.** This is a **Battle-scene animation** story, pure shell. The engine, the event log, and the id→position lookups are all already in place; `attackFlavor` already branches on `UnitAttacked.kind` (story 4.7) and arrows already trace origin→target. 4.10 **finishes the from→to reading** for the action kinds that are still rendered in-place, driven entirely by existing event payloads (AD-2). **No engine change, no `logVersion` bump, no balance change.**

## Acceptance Criteria

Reconciled from epics.md Story 4.10 (lines 875–893). FR39d, UX-DR6, NFR1.

1. **Every action reads from→to.** When any beat plays in the Battle scene: **melee** units visibly **move to their target and return** (not the current 12px in-place nudge); **projectiles (arrow), blasts, heals, and spells** trace **origin→target across the clash gap**. All of it is driven **purely by event payloads** (AD-2 — the scene computes no combat state), branches on **`UnitAttacked.kind`** (never the class), and every beat stays **≥ 300 ms at normal speed**.
2. **Origin-less events stay on-unit (honest rendering).** Events that carry no actor/origin in their payload — **`PoisonTicked`** (victim only), `UnitDied`, `GuardRaised/Ended`, `StatusCleared`, `ActionSkipped/Fizzled`, `LeaderFell` — render as on-unit effects, **not** as a fabricated travel animation. A **confusion misfire** traces from→to on the *effect* event that follows the `ActionMisfired` marker (the marker itself is on-unit). A **Guard-blocked** hit still traces attacker→*original* target; `redirectedFrom` only flashes the guardian (no retarget — story 4.7).
3. **Reduced motion damps flourishes, preserves beats (UX-DR6).** Under `prefers-reduced-motion`, the *magnitude* of travel/flourish is damped (as melee lunge / arrow / popups already do today) but the **beats themselves, their ≥300 ms timing, and the information they carry are preserved** — the beats are the information, not decoration.
4. **NFR1 holds on the busiest battle.** On the busiest realistic battle on a Pixel 6a-class phone, playback sustains the **60 fps target / 30 fps floor** against the measured baseline in `docs/performance-verdict.md` (`?perf=1`, per-frame sampler). The story must **decide and justify** which comp is "busiest" in the squad/monster era and re-baseline if it changes the stress case.
5. **FR39g pause stays dropped (wave 1).** No pause control is added — speed (1×/2×) and skip-to-result remain the only pacing controls (PO decision 2026-07-16). Recorded, no work.

## Tasks / Subtasks

- [ ] **Task 1 — Melee: real step-to-target-and-return (AC: 1, 3)**
  - [ ] In `apps/web/src/scenes/BattleScene.ts` `attackFlavor` (the `melee` branch, ~lines 471–487), replace the fixed `LUNGE_PX = 12` directional nudge with a genuine step **toward the target's `(x,y)` and back** (yoyo) along the clash-gap diagonal — the sprite should visibly close distance on `targets[0]`, strike, and return to its rest pose (`resetSprite` restores `(0,-14)`). Keep the existing dead/unknown-target fallback (step toward the enemy board when the target view is gone).
  - [ ] The step distance is a **device-tuning constant** (like `LUNGE_PX`): far enough to read as "stepped in," not so far it fully occludes the target or overshoots the gap. Default to a fraction of the attacker→target vector (e.g. ~60–70%); confirm the exact feel on device (Task 7). Heed story 4.9: a **monster** attacker renders 1.5× larger, so its step must still look planted, not floaty.
  - [ ] Reduced motion damps the step magnitude (keep the existing `this.reduceMotion` pattern — smaller travel, same beat).
- [ ] **Task 2 — Origin→target traces for blast, heal, spell (AC: 1, 3)**
  - [ ] **Blast** (`attackFlavor` `blast` branch, ~505–511): today a target-local wash at each struck tile. Add an origin→target trace — `source` → each `targets[].unit` across the gap — before/with the row wash (the AC explicitly adds "blasts … trace origin→target across the clash gap"). The **arrow** branch (~489–503, a rotated sliver tweened attacker→target) is the working template; generalize it rather than duplicating.
  - [ ] **Heal** (`UnitHealed` case, ~353–357 → `healGlow`): trace `source` (healer) → `target` (ally) across the gap, then the existing target glow (`healGlow` stays as the arrival effect). Side/element-appropriate color, never a side-identity violation (blue=you/red=enemy is owned by tiles/HP, not the trace).
  - [ ] **Spell** (`StatusApplied` case, ~358–361): trace `source` (caster) → `target` before the persistent status icon + popup land. Uses the same generalized trace.
  - [ ] Extract one shared trace helper (attacker-view → target-view(s), with a per-kind visual) so arrow/blast/heal/spell share one origin→target implementation and can't drift — mirrors how `attackFlavor` already centralizes actor motion.
- [ ] **Task 3 — Honest rendering of origin-less + marker events (AC: 2)**
  - [ ] Confirm `PoisonTicked` (payload = `unit` + `damage`/`hpAfter`, **no source**) renders as an on-unit effect only (the existing `setHp` + `POISON_TEXT` popup) — do NOT invent an origin. Same for `UnitDied`, `GuardRaised/Ended`, `StatusCleared`, `ActionSkipped/Fizzled`, `LeaderFell`.
  - [ ] Confusion: the `ActionMisfired` marker stays on-unit (`confusionWiggle`); the redirected effect event that immediately follows carries its own `source`+target and traces normally via Tasks 1–2.
  - [ ] Guard block: keep attacker→original-target trace; `redirectedFrom` flashes the guardian only (`guardFlash`) — no retarget onto the guard (story 4.7 superseded the bodyguard step-in).
- [ ] **Task 4 — A pure, testable from→to seam (AC: 1, 2)**
  - [ ] The animation itself is device-verified (house pattern — no golden-pixel tests), but the **endpoint derivation** is pure and MUST be tested: extract a pure function that maps a `BattleEvent` → its `{ fromId, toIds, kind }` (or `null`/on-unit for origin-less events), and unit-test it against fixtures for every action kind — melee/arrow/blast (fan-out → multiple `toIds`)/heal/spell yield a from→to pair; poison and the self-events yield no origin. This pins AC2's "honest rendering" rule in code, and guards against a future event-shape change silently fabricating or dropping an origin.
  - [ ] Reuse the engine's `unitTileCenter`/`battleView` geometry for position lookup (already tested) — don't re-derive coordinates.
- [ ] **Task 5 — NFR1 perf: decide the busiest case + verify (AC: 4)**
  - [ ] **Decide the busiest-battle stress case for the squad/monster era.** The current `performance-verdict.md` baseline is `three-mages` vs `three-mages` wipeout (all-mage blast fan-out — the most *simultaneous* struck targets/beat). A monster comp (`twin-golems` vs `twin-golems`) is only 3 units/side, so it likely produces *fewer* simultaneous targets — verify whether it's actually heavier before switching the stress case. If `three-mages` stays the heaviest, keep it and note the AC's "busiest monster battle" is satisfied by the heavier all-mage case; if a monster comp is heavier, re-baseline.
  - [ ] The new travels add moving objects, but only **one beat animates at a time** (sequential scheduler) — the added per-frame draw is small. Still measure: the known hotspot is unpooled `popup`/blast-wash/heal-glow GameObjects (`performance-verdict.md:111-118`) — if traces regress the floor, pool/reuse them.
  - [ ] Capture `?perf=1` numbers on device and compare to `performance-verdict.md`'s post-4.0 baseline (Battle 1× min ~30, 0 frames below floor); update that doc with the 4.10 numbers + the chosen stress case.
- [ ] **Task 6 — FR39g pause stays dropped (AC: 5)** — no code; a one-line note in Dev Notes that pause remains out for wave 1 (speed/skip suffice).
- [ ] **Task 7 — Device session (AC: 1–4)** *(Danilo's acceptance gate)*
  - [ ] On Danilo's Android phone: watch a full battle (ideally including a monster comp via the Replay path) and confirm every action reads as cause→effect — melee steps in and back, arrows/blasts cross the gap, heals/spells trace to their target, poison stays on the victim — at both 1× and 2×, with the frame rate holding.

## Dev Notes

### The from→to reading is already half-built — this story finishes it
`attackFlavor(source, moveKind, targetIds)` (`BattleScene.ts:463-512`) already looks up attacker/target `UnitView`s by id and branches on `kind`. Positions are precomputed per unit in `create()` via `unitTileCenter` (`BattleScene.ts:230`, cached as `UnitView.x/y`). So "read from→to purely from payload" is architecturally in place; the gaps are behavioral:
- **melee** (`~471-487`): computes the attacker→target vector but only nudges `LUNGE_PX = 12` px in place (the docstring *claims* "step into the clash gap and strike" — the impl doesn't). **This is the headline fix.**
- **arrow** (`~489-503`): the ONE working origin→target trace today (a rotated gold sliver tweened attacker→target). The **template** for Task 2.
- **blast** (`~505-511`): target-local wash only — needs a trace.
- **heal** (`UnitHealed` → `healGlow`, `~353-357/528-533`): target glow only — needs a trace.
- **spell** (`StatusApplied`, `~358-361`): persistent icon + popup on target only — needs a trace.

### Event payloads — what carries an origin (AD-2), verified
`LOG_VERSION = 4` (`types.ts:184`), union at `types.ts:429-445`. From→to is derivable for:
- `UnitAttacked` — `source` → `targets[].unit` (array; blast fans out to many), `kind: MoveKind` (`slash|arrow|blast|staff|bash`, `types.ts:191`), per-target `outcome: 'hit'|'crit'|'dodged'|'missed'`, `redirectedFrom?` = guardian for block attribution only (`types.ts:278-292`). **Branch the visual on `kind`, never on class** (row-varied moves make class inference wrong — story 4.7; `DOSSIER.md:142`).
- `UnitHealed` — `source` → `target` (`types.ts:306-312`).
- `StatusApplied` — `source` → `target`, `spell: SpellKind` (`types.ts:315-320`).
- **Origin-less (crux — AC2):** `PoisonTicked` carries only `unit` (victim) + `damage`/`hpAfter`, **no source** (`types.ts:353-358`; `narration.ts:100-108` confirms — "Poison sears …", victim only). Likewise `UnitDied`, `GuardRaised/Ended`, `StatusCleared`, `ActionSkipped/Fizzled`, `LeaderFell` are single-`unit` self events. These MUST render on-unit; there is no origin to trace, and fabricating one would be a lie about what happened.
- **Guard note:** Guard is a damage SHIELD with **no redirect** since story 4.7 (`DOSSIER.md:104-109`) — the attacked unit stays the target; `redirectedFrom` names the guardian to flash, nothing more.

### Geometry & the clash gap
`unitTileCenter(side, placement, orientation='\\')` (`battleView.ts:63-69`) yields each unit's screen center; the two boards sit on the `\` diagonal — enemy upper-left (`ISO_BOARD.enemy {ox:120,oy:100}`), player lower-right (`{ox:240,oy:224}`), `tileW:56 tileH:28` (`constants.ts:327-334`). The **clash gap** is the diagonal between them where cross-lane attacks animate (`EXPERIENCE.md:167`). A from→to trace's endpoints are the cached `UnitView.x/y` of `source` and each target — no new geometry needed.

### Beats, speed, reduced motion (all patterns already exist)
- One event = one beat; scheduler in `step()`/`scheduleNext()` (`BattleScene.ts:268-283`). `BATTLE_BEAT_MS = 600` (1×) → `beatDurationMs` gives 300 ms at 2× (`battleView.ts:121-123`) — 2× is exactly the ≥300 ms floor. Do NOT shorten beats; per-event motion must fit inside the beat at 1×, and simply scale with speed like the existing tweens.
- `this.reduceMotion` (from `prefersReducedMotion()`, `ui.ts:114-116`, read once in `create()`) already damps magnitude across melee (12→4px), arrow (180→80ms), blast/heal/guard scale, popup float (22→8px), banner drift — **preserving beats**. Every new travel follows the same split (UX-DR6): damp the distance/duration flourish, never the beat.

### Move-plate is NOT this story
EXPERIENCE.md:197 describes a per-beat gold "move-plate" naming the move ("Sword Slash"/"Arrow"/"Ice Blast") + action pips (`{components.move-plate}`, DESIGN.md:146-152), fed by `UnitAttacked.kind` + `PassStarted.actionsRemaining`. That is **naming the move + action economy** — story 4.11 ("the action ledger") territory, not 4.10's from→to *motion*. The 4.10 AC does not mention it. Flag it for 4.11; do not build it here (avoid scope creep).

### NFR1 baseline (the number to beat)
`docs/performance-verdict.md` — patched per-frame sampler (not Phaser's EMA `actualFps`). Post-4.0 re-confirm: Battle 1× min ~30.03 / median 59.88 / **0 frames below the 30 floor**, ×2 min 59.52, Placement min 59.17 (`performance-verdict.md:62-73, 166-174`). Current stress case = `three-mages` vs `three-mages` wipeout (all-mage blast fan-out). Device-class caveat: captured on a Pixel 9 Pro XL, not a 6a — an accepted deviation (`performance-verdict.md:22`). Perf harness: `?perf=1` → `attachPerfSampler` (`perf.ts:72-85`), `summarizePerfSamples` → `{min, median, p1Low}`. No headless bench script exists; on-device via Chrome remote debugging is the method. Pin a specific monster battle through the **Replay path** (`MatchFlow.startReplay(setup)`, `MatchFlow.ts:103-127`) or a seeded `HistoryEntry` in `localStorage` (`lordly.v1.history`).

### Previous-story intelligence (4.9, done `ee936d9`)
- Monsters now render 1.5× via `unitDisplaySize`/`addUnitSprite` (story 4.9) — a monster's melee step must look right at the larger size (it also overhangs its tile). The Battle code/badge anchor overlap under the bigger sprite was accepted on device; the step-in motion shouldn't worsen it (the sprite returns to rest each beat).
- Coexisting Battle-render features 4.10 must not break: crit/dodge popups + captions (4.6), Guard marker + block flash (4.7), leader crown on board + `LeaderFell` banner (4.5). All ride the same `UnitAttacked`/beat path — regression-check them.

### Testing standards
- Pure `from→to` endpoint mapping is unit-tested (Task 4) — the one honest, non-Phaser seam. Animation visuals stay device-accepted (house pattern; `narration.test.ts` / `battle-view.test.ts` already cover the text + geometry). No `balanceVersion`/`logVersion` change → engine sweep/hash untouched. Full gate before review: `pnpm typecheck`, `pnpm lint`, `pnpm coverage` (engine ≥90%), `pnpm --filter web build`.

### Project Structure Notes
- Touch (web only): `apps/web/src/scenes/BattleScene.ts` (melee step, blast/heal/spell traces, shared trace helper), possibly a small pure module for the from→to mapping (e.g. `apps/web/src/flow/` alongside `battleView`/`narration`), its test, and `docs/performance-verdict.md` (4.10 numbers + stress-case note). No engine files.
- No new dependency. No new RNG stream. `logVersion` stays 4; `balanceVersion` unchanged.

### References
- [Source: docs/planning-artifacts/epics.md#Story-4.10 (875-893)] — the 3 AC blocks; [#line 61] FR39d "(d) attacks read from→to"; [#line 111] UX-DR6; [#line 631, 158] FR39g pause dropped wave 1.
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#FR39 (127)] from→to wording; [#NFR1 (147)] 60/30 on Pixel 6a; [#FR23 (113)] speed/skip control the same log, no rule divergence.
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md] — Key Flow 1 (131) beat vocabulary; clash gap (167); one-event-one-beat ≥300ms (94, 119, 172); reduced-motion (118); move-plate (197 — 4.11); leader crown (200).
- [Source: DESIGN.md] `{components.move-plate}` (146-152, 4.11); crit/dodge caption (164-167); combat-number float (134-139).
- [Source: epic-4-dossier/DOSSIER.md:142] `UnitAttacked.kind` — attackFlavor reads kind, not class; [:104-109] Guard = shield, no redirect.
- [Source: packages/engine/src/types.ts:184,191,278-358,429-445] — `LOG_VERSION`, `MoveKind`, the event payloads + which carry source/target.
- [Source: apps/web/src/scenes/BattleScene.ts:268-283,308-421,463-512] — scheduler, render switch, `attackFlavor` (melee lunge / arrow trace / blast wash).
- [Source: apps/web/src/flow/battleView.ts:44-69,106-123] — `projection`/`unitTileCenter`/`buildBeatSchedule`/`beatDurationMs`.
- [Source: apps/web/src/config/perf.ts + docs/performance-verdict.md] — `?perf=1` sampler + the NFR1 baseline and busiest-battle methodology.

## Open questions for Danilo (not blockers; sensible defaults chosen — confirm at the device pass)
1. **Melee step distance** — default ~60–70% of the way to the target (reads as "stepped in" without fully occluding it). Tune on device; tell me if you want a full step-to-tile like OB64 or a shorter jab.
2. **Blast trace shape** — default: a single actor→row trace across the gap, then the existing per-tile wash blooms on arrival (so a row blast doesn't fire 3 identical slivers at once). OK, or do you want a sliver per struck unit?
3. **Busiest-battle stress case** — I'll verify whether `twin-golems` (3 units, monster comp) or `three-mages` (all-mage fan-out, current baseline) is actually heavier and baseline against the heavier one. Flagging in case you want the monster comp measured regardless of which is heavier.
4. **Heal/spell trace color** — default: element/neutral-tinted, never a side color (sides own tiles/HP). Confirm at device.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Change Log

- 2026-07-20 — Story created (baseline `ee936d9`). Pure Battle-scene animation, no engine change. Scope: finish the from→to reading — melee step-to-target-and-return (replacing the 12px in-place lunge), origin→target traces for blast/heal/spell (arrow already traces), honest on-unit rendering for origin-less events (poison etc.), reduced-motion damping (UX-DR6), NFR1 device perf pass (decide busiest case). Move-plate flagged as 4.11, not built. FR39g pause stays dropped (wave 1). `logVersion`/`balanceVersion` unchanged. 4 non-blocking open questions.
