# Story 2.2: The animated battle scene

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to watch my formation fight an OB64-style animated clash,
so that watching my plan succeed or collapse is the payoff of the match.

This is the epic's centerpiece. Story 2.1 delivered the sprites and the tween recipes; 2.2 builds the stage: two tilted isometric 3×3 checkerboards (pure geometry, zero art) in the `\` diagonal, every `BattleLog` event rendered as a distinct animated beat, floating combat numbers, per-unit HP bars and status icons, and a collapsible text-log panel. The Battle scene stays a **pure player of the log** (AD-2) — it evaluates no rule, ever.

## Acceptance Criteria

**AC1 — Two mirrored iso boards in the `\` diagonal (FR21, AD-11).**
The Battle scene renders two procedural tilted 3×3 checkerboards of diamond tiles: **enemy board upper-left (red tiles), player board lower-right (blue tiles)**, front rows meeting along the diagonal **clash gap**. Tiles alternate side-color with a neutral tile, stroked in gold-deep. A **front-row indicator** makes each clashing edge unmistakable: brighter front tiles + gold edge + a directional "FRONT" label per board. Board region labels (`▲ ENEMY` / `YOUR ARMY ▼`) anchor side identity positionally (non-color accessibility anchor). The board is always 3×3/9 slots; **front-to-front is engine truth; the tilt/diagonal is display-only** — all owner-local→screen mapping stays confined to the renderer (AD-11). [Source: EXPERIENCE.md#Battle; DESIGN.md#Components iso-board; .memlog line 28–29]

**AC2 — The orientation seam (cheap-seam decision, binding).**
`battleView`'s owner-local→screen mapping takes an **orientation parameter** (`'|' | '\\' | '/'`) from the start; **`'\\'` is the shipped default** and the only one that must be pixel-tuned. The projection is pure, Phaser-free, and unit-tested (per-side bijection, A/B disjointness, column mirroring for B, orientation invariants). A player-facing orientation toggle stays deferred (deferred-work.md). [Source: .memlog line 29; EXPERIENCE.md#Battle]

**AC3 — Every log event is a distinct animated beat, in order (FR21, AD-2, AD-12).**
The scene walks `log.events` 1:1 in array order, one beat per event, **each visible beat ≥ 300 ms at normal speed** (current `BATTLE_BEAT_MS = 600` satisfies this; silent-beat fast-skip and press-and-hold behaviors from 1.9 are preserved). The animation vocabulary, per event type:
- `UnitAttacked` — melee (knight/mercenary source) **steps into the clash gap and strikes** (lunge toward the target, mirrored per side); archer source fires an **arrow that crosses the diagonal**; mage source's **blast washes the struck row** (one beat, per-target numbers from `targets[]`). The class-based *flavor* is a shell-side lookup off the roster snapshot (AD-11) — damage values come ONLY from the payload.
- `UnitHealed` — the target **glows** briefly; `+amount` floats.
- `StatusApplied` — a **persistent status icon** appears on the target (see AC6).
- `ActionMisfired` / `ActionFizzled` / `ActionSkipped('asleep')` — **visibly distinct** treatments; keep 1.9's `↳` misfire→effect pairing (marker + redirected effect narrate as one connected moment).
- `UnitDied` — the death **plays out** (fade + topple per `UNIT_TWEENS.death`) and the **corpse leaves the lane** (removed/vacated tile — not the current lingering alpha-0.15 ghost).
- `PoisonTicked` — HP + number with a distinct poison treatment.
- `PassStarted` / `EngagementEnded` / `BattleEnded` — HUD label updates; keep 1.9/1.10's engagement-seam suppression (no "Engagement N ended" when `BattleEnded` is next) and the `Result` handoff.

**AC4 — Phone legibility floors on a 360×640 CSS-px viewport (FR21, FR30).**
Unit **sprites render ≥ 32 px** (the 2.1 sheet is 32px native — draw at ×1, integer scales only), floating **damage/heal numbers ≥ 14 px** (mono, weight 800, tabular), and **HP bars + status icons are distinguishable per unit** (HP bar 8px tall, side-colored fill, low-alpha track). [Source: EXPERIENCE.md#Accessibility Floor; DESIGN.md components.hp-bar/combat-number]

**AC5 — Numbers and bars come exclusively from event payloads (AD-2).**
HP bars are driven by `hpAfter` (authoritative, incl. the `EngagementEnded.hp` resync); popups show `damage` (full computed value — overkill semantics, OB64 style) and `amount` (effective heal). The scene derives no game state. **Combat-number color = the ACTING side** ("blue when you deal/heal, red for the enemy" — actor side via shell-side roster lookup of `source`); exception: `PoisonTicked` carries no actor in its payload, so poison numbers use a distinct neutral poison treatment instead of guessing a side. [Source: DESIGN.md#Components combat-number; types.ts AttackTarget/UnitHealed/PoisonTicked]

**AC6 — Persistent status icons, exactly log-derivable (FR16 rendering).**
`StatusApplied` puts a persistent icon on the target (text glyphs via `crispText` — e.g. `Zzz` sleep, `☠` poison, `↓` weaken, `?` confusion — no new art). Lifecycle is EXACTLY the engine's verified rule, rendered from log events only: statuses never expire mid-engagement (sleep voids all remaining actions — `resolve.ts:109`); on `EngagementEnded` clear every icon **except poison** (`resolve.ts:77-79` — poison persists the whole battle); a dead unit's icons leave with the corpse. Same spell never stacks (a duplicate `StatusApplied` for a borne spell never occurs — fizzles instead). Icons must be distinguishable per unit at phone size (AC4).

**AC7 — Collapsible Log panel (correct-course AC; FR21, AD-2).**
A `≡ Log` toggle in the pinned bottom control bar expands a collapsible panel **beneath the boards** showing a scrolling text narration of the SAME events already driving the animation (e.g. `"Knight A:0 struck Archer B:1 for 12 — 78→66 HP"`), collapsing on a second tap. It reads from the log the scene already holds — **no new data, no re-derivation** — and **never pauses or alters playback**. The narration builder is a pure, unit-tested function. [Source: epics.md#Story 2.2 lines 426–429; EXPERIENCE.md#Battle]

**AC8 — Camera-perspective ADR recorded (NFR3 convention).**
Create `docs/adr/` and record the decision as the repo's first ADR: **isometric tilted 3×3 checkerboard (procedural geometry, zero art) + flat single-angle billboard sprites + floating HP numbers/bars; two boards in the `\` diagonal (enemy upper-left / player lower-right); tile color-codes side (blue=player, red=enemy)** — made explicitly against the selected pack's angles (2.1's DCSS tiles are single-angle billboards; the iso lives in the board, so no multi-angle art is required), resolving reconcile-ogre-game Gap 2. Note the layout evolution: early "vertical stack" superseded by the `\` diagonal default with the orientation seam. [Source: .memlog lines 19, 21, 28–29; epics.md#Story 2.2 lines 418–420]

**AC9 — HUD + controls: 2.2's slice only.**
Slim top HUD: `‹ Home` left (existing `addHomeBack`), live pass/engagement label right. Pinned bottom control bar ships **only the `≡ Log` toggle** — the play/×2/skip speed buttons are **Story 2.3 (FR23)**; the interim press-and-hold ×4 fast-forward (with its `gameout` guard and mid-beat reschedule) is preserved unchanged. Battle unit rendering is normalized to the shared helpers: real sprite + 3-letter code + **the shared 12px element dot** (`addElementBadge` — closes the 2.1 deferred item for Battle; element word dropped here), side identity via `playerLine`/`enemyLine`.

**AC10 — Reveal adopts the shared iso board (UX component consistency).**
The iso-board component is shared: "Reveal and Battle show two stacked (enemy red top, you blue bottom)" [Source: EXPERIENCE.md#Component Patterns]. RevealScene positions through the same projection and draws the same tile boards (reusing the board-render helper); its unit cards keep their 2.1 treatment. Keep this adoption thin — Reveal's behavior (tap → Battle, guard, hint) is untouched.

**AC11 — Performance sanity (NFR1; full verdict is Epic 3).**
The busiest battle (wipeout, multi-engagement, poison comps) plays without visible jank on Danilo's phone — 60 fps target / 30 floor on a Pixel 6a class device. Practical bar for 2.2: tiles drawn once (not per frame), no per-frame allocations in the beat loop, popups destroyed on completion (existing pattern). Formal budget verification is story 3.4 — do not build profiling infrastructure here. Honor `prefers-reduced-motion` by damping non-essential travel (float distance, lunge amplitude) while preserving the beats themselves.

**AC12 — Quality gate + on-device sign-off.**
`pnpm -r typecheck && pnpm lint && pnpm coverage && pnpm --filter web build` green. New pure logic (iso projection, orientation mapping, narration builder, status-icon lifecycle reducer if extracted) unit-tested in `apps/web/test/`; scenes stay smoke-free (house convention). Wipeout multi-engagement playback re-verified (mode toggle on Home). **Final acceptance: Danilo watches a full battle on his Android phone** — boards read, beats read, numbers/icons legible.

## Tasks / Subtasks

- [ ] **Task 1 — The camera ADR (AC8)**
  - [ ] Create `docs/adr/0001-battle-camera-iso-board.md` with the decision, context (no-artist constraint, pack angles), the `\` diagonal evolution, and consequences (orientation seam, procedural tiles). Content is fully specified in AC8 + Dev Notes §"The camera decision".
- [ ] **Task 2 — Pure iso projection + orientation seam (AC1, AC2)**
  - [ ] Extend `apps/web/src/flow/battleView.ts`: owner-local `(side, placement)` → screen px through an **orientation-aware** projection (`'|' | '\\' | '/'`, default `'\\'`). Standard iso math: for board-local `(r, c)`: `x = ox + (c − r) · TILE_W/2`, `y = oy + (c + r) · TILE_H/2`; per-board origins (enemy upper-left, player lower-right); side B keeps its column mirror (own col `i` faces enemy col `2−i` — FR7). Preserve/adapt the exported surface so Reveal keeps compiling.
  - [ ] New geometry constants in `config/constants.ts` (replacing/extending `BATTLE_BOARD`): tile W/H (mock: 48×24 at 300-wide → scale to `BASE_WIDTH`; keep 2:1 diamond ratio), board origins, clash-gap placement. Metrics are DATA, not inline (house rule).
  - [ ] Unit tests: bijection per side, A/B tile-set disjointness, B column mirror, front rows adjacent to the clash gap, orientation param respected (at minimum `'\\'` fully verified; `'|'`/`'/'` mapped but untuned).
- [ ] **Task 3 — Board renderer (AC1, AC10)**
  - [ ] A shared helper (e.g. `config/board.ts` or in `ui.ts`) that draws one iso board: 9 diamond tiles (`add.polygon` or `Graphics.fillPoints` — verify against installed Phaser 4 types), alternating side/neutral fills, gold-deep stroke, **brighter front tiles + gold front edge + "FRONT" directional label**, drawn ONCE at create.
  - [ ] Battle draws both boards + `▲ ENEMY` / `YOUR ARMY ▼` labels + the clash-gap zone; Reveal swaps its floating rectangles for the same two boards (thin change, behavior untouched).
- [ ] **Task 4 — Battle unit views on the boards (AC4, AC9)**
  - [ ] Rebuild `buildUnit`: 32px sprite (`addUnitSprite`, ×1) standing on its tile (bottom-center anchored, e.g. `setOrigin(0.5, ~0.85)`), 3-letter class code (13px, side-colored text), **shared 12px element dot** (`addElementBadge`), HP bar **8px tall** side-colored fill over a low-alpha track, positioned via the new projection. HP numerals (`101/140`, 13px mono tabular) per DESIGN **if they fit the cell legibly** — attempt, judge on-device, fall back to bar-only with a note.
  - [ ] Keep the `views: Map<UnitId, …>` handle pattern; extend the view record for icons/anchors as needed.
- [ ] **Task 5 — Beat animation vocabulary (AC3)**
  - [ ] Wire `UNIT_TWEENS` (2.1's recipes — `attack` lunge with side-mirrored x-delta, `hurt` flash on struck targets, `death` fade+topple) via `this.tweens.add`; arrow/blast treatments for archer/mage sources (simple tweened projectile line/flash crossing the gap — procedural, no new art); heal glow (brief tint/scale pulse).
  - [ ] Class-flavor lookup keyed off the roster snapshot (`Record<UnitClass, 'melee'|'arrow'|'blast'|…>` in `config/` — compile-error on new class).
  - [ ] Corpse leaves the lane: after `death` completes, remove the container (destroy or fully hide + clear icons); tile reads vacated.
  - [ ] Preserve verbatim: beat loop order 1:1, silent-beat 50ms fast-skip, `↳` misfire pairing, holding mechanics (`pointerdown/up/gameout`, mid-beat reschedule), `EngagementEnded` HP resync + seam suppression, `BattleEnded` → Result.
- [ ] **Task 6 — Combat numbers (AC4, AC5)**
  - [ ] Upgrade `popup`: ≥14px mono weight-800 tabular via `crispText`, **actor-side color** (source's side → `playerText`/`enemyText`; poison = neutral distinct), rise+fade **within the beat**, destroyed on complete (existing pattern). Damage `-n` from `damage` (overkill as-is), heals `+n` from `amount`.
- [ ] **Task 7 — Status icon layer (AC6)**
  - [ ] Per-unit icon slots (text glyphs via `crispText`, ≥10px floor, positioned to stay distinguishable at phone size). Apply on `StatusApplied`; on `EngagementEnded` clear all but poison; remove with the corpse. Consider a pure reducer (`(iconsState, event) → iconsState`) in `flow/` so the lifecycle is unit-testable without Phaser.
- [ ] **Task 8 — Log panel (AC7)**
  - [ ] Pure narration builder (e.g. `flow/narration.ts`): `(event, roster) → string | null` — class names + `UnitId`s + numbers per the spec example; unit-tested across all 12 event types (silent ones → null).
  - [ ] Panel UI: `≡ Log` toggle in the bottom bar (≥44px tap target), collapsible panel beneath the boards, appends lines as beats render, scrolls (Phaser text region with simple masking/trim — keep it cheap, e.g. last N lines), second tap collapses. Never touches the beat timer.
- [ ] **Task 9 — HUD + bottom bar (AC9)**
  - [ ] Slim top bar: `addHomeBack` + pass/engagement label right-aligned. Bottom bar: Log toggle only; visual placeholders for 2.3's speed buttons are OPTIONAL and non-functional if included (prefer omitting). Press-and-hold FF hint retained.
- [ ] **Task 10 — Reduced motion (AC11)**
  - [ ] Read `prefers-reduced-motion` (`window.matchMedia`, guarded for tests); damp float travel/lunge amplitude while keeping beats and numbers. Document the exact mapping in code comments ([ASSUMPTION] resolved here per EXPERIENCE.md#Accessibility Floor).
- [ ] **Task 11 — Wipeout + Result regression guard (AC3, AC12)**
  - [ ] Play a Wipeout battle end-to-end: engagement seams read, poison persists visually, per-engagement icon clear correct, Result unchanged. Standard mode shows no engagement marker (1.10 patch behavior preserved).
- [ ] **Task 12 — Quality gate + on-device acceptance (AC12)**
  - [ ] Full gate green; new pure modules tested; headless drive of the full flow (pattern from 2.1: puppeteer-core scratchpad script exists).
  - [ ] On-device sign-off with Danilo: boards, beats, numbers, icons, log panel, wipeout. Perf sanity on the busiest battle.

## Dev Notes

### The load-bearing invariants (read first)
- **AD-2** — the scene is a pure player: every number/state change on screen comes from an event payload; the scene never re-derives. Anything you're tempted to compute — check the payload first; it's there (that's AD-12's whole point).
- **AD-11** — owner-local coords everywhere in data; mirroring/tilt is renderer math in `battleView`. Unit identity `side:index`; sprites/names are shell-side lookups.
- **AD-12** — the closed v3 event union is COMPLETE (12 types). No new event kinds, no `LOG_VERSION` bump — this story is presentation only. [Source: ARCHITECTURE-SPINE.md#Invariants; types.ts:117]
- **Scenes thin, helpers pure** — correctness lives in tested pure modules (`battleView`, new `narration`), scenes stay smoke-free. [Source: 1-9 story #Testing constraints; ARCHITECTURE-SPINE.md#Consistency Conventions]

### The complete event union you render from (types.ts, verified)
| Event | Payload fields the scene uses |
|---|---|
| `BattleStarted` | `units: UnitSnapshot[]` (id, side, class, element, placement, hp, maxHp) — silent beat, roster drawn in create |
| `PassStarted` | `pass` (restarts at 1 per engagement — 1.10 decision) |
| `UnitAttacked` | `source`, `targets: [{unit, damage, hpAfter}]` — blast fan-out is one event, per-target entries; `damage` may exceed HP removed (overkill — popup shows it; bar follows `hpAfter`) |
| `UnitHealed` | `source`, `target`, `amount` (effective, cap applied), `hpAfter` |
| `StatusApplied` | `source`, `target`, `spell: sleep\|poison\|weaken\|confusion` — same spell never stacks |
| `ActionMisfired` | `unit` — MARKER immediately followed by its redirected effect event (pair-narrate; 1.9's `↳`) |
| `ActionFizzled` | `unit` |
| `ActionSkipped` | `unit`, `reason: dead\|asleep\|idle` — `dead` renders silent |
| `PoisonTicked` | `unit`, `damage`, `hpAfter` — **no actor field** (hence the neutral number color) |
| `UnitDied` | `unit` |
| `EngagementEnded` | `engagement`, `hp: Record<UnitId, number>` (authoritative resync) |
| `BattleEnded` | `winner: Side\|'draw'`, `hpPct` |

### Engine status semantics (verified in resolve.ts — the AC6 lifecycle is exact, not guessed)
- Statuses **never expire mid-engagement**; sleep voids every remaining action, narrated turn-by-turn as `ActionSkipped('asleep')` [resolve.ts:109-113].
- Between engagements, **all statuses clear except poison** [resolve.ts:77-79]; poison persists the whole battle and ticks at every natural engagement end (skipped on instant wipe).
- Therefore the icon layer needs NO engine change and NO guesswork: apply on `StatusApplied`, clear-except-poison on `EngagementEnded`, remove on `UnitDied`.

### Current BattleScene — what is placeholder (replace) vs machinery (preserve)
`apps/web/src/scenes/BattleScene.ts` (253 lines, fully mapped):
- **Replace:** `buildUnit` (48×40 rect + element word + 8px square badge + 5px HP bar at :102-127), `popup` (12px Arial, always-red damage at :237-252), `kill` (alpha 0.15 ghost at :229-234), the flat 6-row `BATTLE_BOARD` stacked-grid look, the "Battle" title layout.
- **Preserve (behavioral contracts, several were review patches in 1.9/1.10):** beat loop `step/scheduleNext/render → boolean` with **silent beats advancing after 50 ms** (:130-145); `pendingMisfirePair` + `linked('↳ ')` (:52-53, :153-158, :216-218); `setHolding` with **mid-beat reschedule** + `gameout` guard (:77-98); `setHp` clamp + `maxHp===0` guard (:221-226); `EngagementEnded` resync + **seam suppression when next is `BattleEnded`** (:197-208); `BattleEnded` label → `Result` handoff (:132-134, :209-211); `resolve()` returns the cached log (AD-13 — resolved exactly once, in Reveal).
- `buildBeatSchedule`/`fastForwardMs` in battleView are the pacing contract — reuse as-is.

### 2.1's deliverables built FOR this story (use, don't reinvent)
- `config/sprites.ts`: `UNITS_SHEET_KEY`, `UNIT_FRAME_SIZE=32`, `UNIT_FRAMES: Record<UnitClass, number>`, **`UNIT_TWEENS`** — `attack {x:+10, 140ms, yoyo}` (mirror x for side B), `hurt {alpha:0.3, 90ms, yoyo, repeat:1}`, `death {alpha:0, angle:90, 320ms, one-way}`, `idle` (optional ambience — beats are the information).
- `config/ui.ts`: `addUnitSprite` (integer display sizes only — pixel art blurs at fractional scales), `addElementBadge` (the ONE 12px dot source — FR3), `crispText` (ALL text goes through it), `addHomeBack`.
- `PALETTE.playerLine/playerText` blue `#4a8fe0` / `enemyLine/enemyText` red — side identity everywhere (DESIGN's load-bearing rule). Element hexes already reconciled.

### Exact UX values (binding; Night-variant — the current build's dark ground)
- **Diamond tiles**: 2:1 ratio, mock 48×24 in a 300-wide frame → scale to 360 (≈56×28; keep integers). Adjacent tile step: +half-width/+quarter-height... (mock steps +24x/+12y = half-W/half-H — follow the mock's step math). Enemy board region ≈ upper-left third, player ≈ lower-right, clash label between [Source: battle-screen-mock.html viewBox geometry].
- **Night tile palette** [Source: battle-screen-mock.html :root[data-sk="night"]]: `--tile-you:#2c4d80`, `--tile-foe:#7d2f2c`, `--tile-empty:#2a3050`, fronts `#4a8fe0` / `#c8483a`, stroke gold-deep-night `#9c7c26`, front gold edge `gold-lite #f4d074`, stroke-width ~1 (fronts ~1.6). Full two-theme system is DEFERRED — these land as constants; don't build theming.
- **FRONT labels**: mono ~9-10px, weight 700, letter-spacing, side-colored (`FRONT ↘` enemy / `↖ FRONT` player) — respect `MIN_FONT_PX=10` (mock's 9px is mock-scale; use ≥10).
- **HP bar**: 8px tall, side fill, track white @ ~10% (night), numerals 13px mono tabular if they fit.
- **Combat numbers**: ≥14px, mono, 800, actor-side-colored, rise+fade within the beat. (Mock colors one −18 by struck side; DESIGN prose says actor side — **spine wins on conflict** [Source: DESIGN.md#Reference mockups rule].)
- **Non-color anchor**: enemy always top/upper-left, you always bottom/lower-right + text labels — load-bearing for color-vision accessibility [Source: EXPERIENCE.md#Accessibility Floor].
- **Banned**: gold as a side color; element as border/HP fill; any control that pauses for a rules decision; hover-dependent affordances.

### Scope fences (must NOT)
- **No speed/skip controls** — FR23 is Story 2.3 (the bar ships the Log toggle only; press-and-hold interim FF stays).
- **No settings/persistence** (`lordly.v1.settings` is 2.3's gateway), **no theme system** (deferred), **no engine changes** (no events, no LOG_VERSION bump, no balance), **no Result scene changes** (2.3 polishes it), **no History** (epic 3), **no profiling infra** (3.4).
- **No new art** — tiles/arrows/glows/icons are procedural geometry + text glyphs. Zero custom art is a hard product constraint.
- Log any new product wishes to `deferred-work.md`; don't self-scope.

### Hard-won device lessons (project memory — do not re-trip)
- **Never global `pixelArt: true`** — it wrecked crispText on Danilo's device (2.1). Per-texture NEAREST on sprite sheets only (BootScene does this; any new texture gets the same treatment — but prefer procedural/text, needing none).
- **Text softness ceiling**: the canvas backing store is fixed 360×640 (measured; DPR-invariant). The ≥14px floats will read as soft as all other text — that is the KNOWN deferred ceiling (deferred-work.md), NOT a 2.2 bug. Don't chase it here; don't regress it either (everything through `crispText`).
- **Empirical over reasoned**: drive the scene and look; measure, don't estimate. The 2.1 headless-drive scratchpad pattern (puppeteer-core + installed Chrome) is available for flow verification.
- **Phaser API notes**: `this.tweens.add({targets, …props, duration, yoyo, repeat, onComplete})` is proven in-repo (1.9 popup/kill). For diamonds, `this.add.polygon(x, y, points, fill, alpha)` + `setStrokeStyle` or `Graphics` — **verify against installed Phaser 4.2 types** before leaning on either (house habit from 1.9).

### Project Structure Notes
- New files expected: `docs/adr/0001-battle-camera-iso-board.md`, `apps/web/src/flow/narration.ts` (+ test), possibly `apps/web/src/config/board.ts`; extended: `battleView.ts` (+ tests), `constants.ts` (iso geometry, night tile palette), `BattleScene.ts` (the rewrite), `RevealScene.ts` (board adoption), `sprites.ts` only if flavor map lives there.
- `docs/adr/` does not exist yet — this story creates it (spine: "one ADR per load-bearing choice").
- Uncommitted-work note: 2.1 landed as working-tree changes; ensure it's committed before/with this story's work so the baseline is clean.

### References
- [Source: docs/planning-artifacts/epics.md#Story 2.2 (lines 404–429)] — user story + all five BDD ACs incl. the correct-course Log-panel AC.
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md#Battle, #Component Patterns, #State Patterns, #Accessibility Floor, #Interaction Primitives] — locked layout, beats, log panel, floors, banned interactions.
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md#Components (iso-board, hp-bar, combat-number, element-badge), #Colors, #Shapes, #Do's and Don'ts] — binding tokens/values.
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/mockups/battle-screen-mock.html] — concrete geometry (48×24 diamonds, board regions, night palette) — spine wins on conflict.
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/.memlog.md lines 19–29] — the camera decision verbatim (ADR content) + `\` diagonal resolution + orientation seam.
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md] — AD-2/AD-11/AD-12/AD-13, ADR convention, NFR1 budget.
- Code: `packages/engine/src/types.ts` (event union, verified), `packages/engine/src/resolve.ts:77-79,109-113` (status semantics, verified), `apps/web/src/scenes/BattleScene.ts` (full map above), `apps/web/src/flow/battleView.ts`, `apps/web/src/config/{constants,sprites,ui}.ts`.
- Prior stories: `1-9-…md` (beat-loop review patches — the preserved behaviors), `1-10-…md` (wipeout seams, engagement-marker suppression), `2-1-…md` (sprites, helpers, device lessons), `deferred-work.md` (text ceiling, theming, badge normalization → Battle's happens HERE).

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
