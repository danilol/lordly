---
baseline_commit: e21e7b13d40832ab8b304b45a71f76e2c402769d
---

# Story 2.2: The animated battle scene

Status: done

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

- [x] **Task 1 — The camera ADR (AC8)**
  - [x] Create `docs/adr/0001-battle-camera-iso-board.md` with the decision, context (no-artist constraint, pack angles), the `\` diagonal evolution, and consequences (orientation seam, procedural tiles). Content is fully specified in AC8 + Dev Notes §"The camera decision".
- [x] **Task 2 — Pure iso projection + orientation seam (AC1, AC2)**
  - [x] Extend `apps/web/src/flow/battleView.ts`: owner-local `(side, placement)` → screen px through an **orientation-aware** projection (`'|' | '\\' | '/'`, default `'\\'`). Standard iso math: for board-local `(r, c)`: `x = ox + (c − r) · TILE_W/2`, `y = oy + (c + r) · TILE_H/2`; per-board origins (enemy upper-left, player lower-right); side B keeps its column mirror (own col `i` faces enemy col `2−i` — FR7). _Shipped as `unitTileCenter` + `boardTiles` (the old `toScreenCell`/`screenCellCenter` retired with their call sites)._
  - [x] New geometry constants in `config/constants.ts` (replacing/extending `BATTLE_BOARD`): tile W/H 56×28 (2:1), board origins, stacked origins for `'|'`. Metrics are DATA, not inline (house rule).
  - [x] Unit tests: bijection per side, A/B disjointness, B column mirror (facing-lane proximity), front rows adjacent to the clash gap, all 3 orientations invariant-tested, `'\\'` pixel-verified (canvas bounds, 2:1 ratio, checker alternation).
- [x] **Task 3 — Board renderer (AC1, AC10)**
  - [x] `config/board.ts` → `drawIsoBoard`: one static Graphics object per board, 9 diamonds, alternating side/neutral fills, gold-deep stroke, brighter front tiles + gold-lite front edge (drawn last so never overdrawn), drawn once at create. _Empirical finding: Phaser 4's `add.polygon` rendered the quads as TRIANGLES (both object-point and flat-array forms — screenshot-verified); Graphics path calls are the reliable route._
  - [x] Battle draws both boards + `▲ ENEMY` / `YOUR ARMY ▼` positional labels + FRONT arrows beside each clashing edge; Reveal swapped its floating rectangles for the same two boards (behavior untouched, ENEMY label repositioned above the board).
- [x] **Task 4 — Battle unit views on the boards (AC4, AC9)**
  - [x] `buildUnit` rebuilt: 32px sprite on the tile, side-colored 3-letter code, shared 12px element dot, 8px HP bar (36w, low-alpha white track, side fill) — all in ONE container (depth = screen y for iso layering; chrome hugs the sprite since same-lane diagonal units sit 28px apart). _HP numerals NOT shipped: `101/140` at 13px mono ≈ 50px exceeds the 28px lane pitch — guaranteed collisions; bar-only per the story's sanctioned fallback._
  - [x] `views: Map<UnitId, …>` kept; extended with sprite handle, class, statuses map, dead flag.
- [x] **Task 5 — Beat animation vocabulary (AC3)**
  - [x] `UNIT_TWEENS` wired: melee lunge along the attacker→target vector (yoyo, 140ms), `hurt` alpha flash on every struck target, `death` fade+topple then **container destroyed — corpse leaves the lane** and the tile vacates.
  - [x] Class flavor (shell-side lookup off the roster): archer → gold arrow sliver tweened across the gap; mage → translucent blast wash on struck tiles; others → lunge. Heal → soft white glow pulse. Confusion → sprite wiggle + `confused!`; fizzle/sleep popups distinct (sleep uses `Zzz…` in the sleep status color).
  - [x] Preserved verbatim: 1:1 beat order, silent-beat 50ms fast-skip, `↳` misfire pairing, holding mechanics (pointerdown/up/gameout + mid-beat reschedule), `EngagementEnded` HP resync + seam suppression, `BattleEnded` → Result.
- [x] **Task 6 — Combat numbers (AC4, AC5)**
  - [x] `popup` upgraded: 14px Courier bold via `crispText`, **actor-side color** (`actorColor(source)` roster lookup; poison → `POISON_TEXT` neutral), rise+fade within the beat, destroyed on complete.
- [x] **Task 7 — Status icon layer (AC6)**
  - [x] Per-unit glyph icons (`STATUS_GLYPHS`/`STATUS_COLORS`, 10px floor) in the unit container; applied on `StatusApplied` (no-stack guard), cleared-except-poison on `EngagementEnded` (mirroring resolve.ts:77-79), destroyed with the corpse. _Kept in the scene (a Map on the view record) rather than a separate reducer — the lifecycle is 3 one-line rules riding existing events; the narration ledger covers the pure-logic testing surface._
- [x] **Task 8 — Log panel (AC7)**
  - [x] Pure `flow/narration.ts`: `createNarrationState` + `narrateEvent` ledger (classes + running HP so before→after is TRUE even on overkill; `EngagementEnded` resyncs). 9 tests incl. the spec example verbatim, overkill, blast fan-out, resync, purity.
  - [x] Panel UI: `≡ Log`/`× Log` toggle (80×44 target), panel beneath the boards (keep-last-14 window, newest at bottom), lines appended per beat whether open or closed, catch-up on open, second tap collapses, **beat timer untouched** — verified live in a headless drive (screenshot: playback advanced while the panel accumulated lines).
- [x] **Task 9 — HUD + bottom bar (AC9)**
  - [x] Slim top bar (`‹ Home` + right-aligned pass/engagement label, big title dropped); bottom bar = FF hint + Log toggle only (2.3's speed buttons omitted per the story's preference); press-and-hold FF retained.
- [x] **Task 10 — Reduced motion (AC11)**
  - [x] `prefers-reduced-motion` via `window.matchMedia` (guarded): float 22→8px, lunge 12→4px, arrow flight 180→80ms, glow/blast scale pulses off — beats and numbers preserved (they ARE the information). Mapping documented at the `reduceMotion` const.
- [x] **Task 11 — Wipeout + Result regression guard (AC3, AC12)**
  - [x] Wipeout driven headlessly end-to-end under fast-forward: Pass 2 HUD, `weaken` popup + ↓ icon rendered, wipe verdict reached, Result unchanged (`Victory!` now blue via 2.1's palette). Standard-mode seam suppression logic preserved (1.10 patch). Multi-engagement seam/icon-clear paths are unit-covered (narration EngagementEnded test) — on-device wipeout run is the final eyes-on.
- [x] **Task 12 — Quality gate + on-device acceptance (AC12)**
  - [x] Full gate green (typecheck, lint, 259 tests incl. 23 new, build); bundle re-measured 373,734 B ≈ 0.36 MB (≤3 MB); full flow + Log-panel + wipeout drives headless-verified with screenshots.
  - [x] On-device sign-off with Danilo: boards, beats, numbers, icons, log panel, wipeout. Perf sanity on the busiest battle. _Danilo on device (2026-07-14): "everything looks great, besides the font. I love it." Font = the KNOWN pre-existing 360px canvas-backing ceiling (diagnosed and deferred in 2.1 — prod-identical, not a 2.2 regression); no new findings._

### Review Findings (code review 2026-07-14)

_3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor), full mode vs this spec, diff vs baseline `e21e7b1`. All beat-loop contracts, projection invariants, narration math, and scope fences independently verified clean. 8 patch findings (several merged from multi-layer convergence), 1 defer, 2 dismissed._

- [x] [Review][Patch] Stale scene state across battles — Phaser scenes are singletons, `create()` re-runs but fields persist [apps/web/src/scenes/BattleScene.ts:80-93] — `holding` survives holding-through-the-ending (input listeners torn down before pointerup) so the NEXT battle auto-plays at ×4; `logLines` bleeds battle 1's narration into battle 2's panel; a stale `logOpen=true` makes the first Log tap a no-op; `views` retains destroyed containers (safe only by id-stability). Fix: reset all transient fields (`holding`, `logLines`, `logOpen`, `narration`, `pendingMisfirePair`, `currentSilent`, `views.clear()`) at the top of `create()`. (blind+edge, merged)
- [x] [Review][Patch] Overlapping recipe tweens corrupt sprite state under fast-forward [apps/web/src/scenes/BattleScene.ts:327-370,412] — hurt flash totals 360ms vs a 150ms FF beat; a second tween on the same sprite captures the mid-dip alpha as its yoyo base → sprite stuck semi-transparent; same mechanism can strand a lunge off-tile and lets the hurt yoyo flash a dying sprite back to opaque mid-topple. Fix: `tweens.killTweensOf(sprite)` + reset alpha/x/y/angle to rest pose before each recipe tween, and in `kill()`. (blind+edge)
- [x] [Review][Patch] Status-icon slot collision after the engagement clear [apps/web/src/scenes/BattleScene.ts:391] — slot x uses `statuses.size`; survivors aren't re-laid-out, so post-clear additions land on the persisting poison glyph (wipeout + multi-status scenario; all three layers found it). Fix: re-layout icons by index after any add/remove. (blind+edge+auditor)
- [x] [Review][Patch] Blast wash: only `targets[0]`, hardcoded enemy-red; arrow color literal [apps/web/src/scenes/BattleScene.ts:315,354-356] — AC3 says "washes the struck row"; the wash must cover EVERY target tile and take the ACTING side's color (a player mage currently paints enemy red — against the side rule this diff itself enforces). Arrow's `0xf4d074` should reference `ISO_TILES.frontStroke`. (blind+edge+auditor)
- [x] [Review][Patch] Log panel: Standard-mode seam line + overflow risk [apps/web/src/flow/narration.ts + BattleScene.ts:463-491] — the panel prints "— Engagement 1 ended —" in Standard mode, contradicting the 1.10 product rule the HUD honors (suppress when `BattleEnded` is next — the scene has the lookahead; filter the line there, keep narration pure); and 14 logical lines + wraps can exceed the panel bg (drop window to 11). (blind+edge+auditor, merged)
- [x] [Review][Patch] Log-button taps stall beat progression [apps/web/src/scenes/BattleScene.ts:145-152] — every tap fires pointerdown+up through the global FF handler; `setHolding` restarts the current beat's wait at FULL duration on release, so repeated taps postpone the beat indefinitely. Fix: fast-reschedule only when ENGAGING hold (release takes effect from the next beat — imperceptible). (blind)
- [x] [Review][Patch] Small AC conformance nits [BattleScene.ts:262,398; battleView.ts docstring] — `'idle'` skip popup shows the raw enum (narration says "waits" — align); combat-number weight `bold`=700 vs the binding 800 (`fontStyle: '800'`); the "rendered as one straight lane" FR7 docstring overclaims for the `\` layout (facing pairs are gap-offset like the UX mock's own corner boards — soften the wording, geometry unchanged). (blind+auditor, merged)
- [x] [Review][Patch] `reduceMotion` resolved at module load, comment claims per-battle [apps/web/src/scenes/BattleScene.ts:58-64] — move the matchMedia read into `create()` so an OS preference change applies from the next battle, making the comment true. (blind+auditor)
- [x] [Review][Defer] Status-icon lifecycle duplicates an engine rule in the shell (AD-2 exception) [BattleScene.ts clearStatusIconsExceptPoison] — no `StatusCleared` event exists in the union, so the "clear-except-poison at engagement end" rule lives in both resolve.ts and the scene; a future engine rule change would silently desync icons. The spec explicitly sanctioned this design (AC6) and an engine event is fenced off (LOG_VERSION bump). Deferred: consider `StatusExpired`/`StatusCleared` events at the next LOG_VERSION bump — logged in deferred-work.md. (blind)

Dismissed (2): Map deletion during `for…of` iteration in `clearStatusIconsExceptPoison` — well-defined per the ES spec; FR7 lane-collinearity as a LAYOUT defect — the shipped geometry matches the binding UX mock's own non-collinear corner boards (only the comment overclaim is patched, above).

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

Claude Fable 5 (claude-fable-5) via Claude Code

### Implementation Plan

TDD on the pure modules first (RED: 23 new tests across projection + narration, confirmed failing), then GREEN (battleView iso projection with the orientation seam; narration ledger), then the renderers (board.ts, BattleScene rewrite, Reveal adoption), each visually verified by headless-driving the real game and reading screenshots (empirical-over-reasoned). Iso math: board-local `(r,c)` from owner-local via per-side edge mapping (A fronts its NW edge `c=0`, B fronts SE `c=2` with columns mirrored per FR7), then `x = ox + (c−r)·tileW/2`, `y = oy + (c+r)·tileH/2`.

### Debug Log References

- RED: 19 failing (missing modules/constants) → GREEN 32/32 for the two pure suites; full suite 259/259.
- **Phaser 4 `add.polygon` renders these diamond quads as TRIANGLES** — with object points AND with a flat number array (both screenshot-verified). Fix: `Graphics` path calls (moveTo/lineTo/closePath/fillPath/strokePath), one static Graphics per board — also the cheaper draw. Recorded in board.ts.
- Iteration on unit chrome: initial code/bar offsets stacked ~50px tall vs the 28px same-lane pitch — tightened (code y+4, bar y+14) after the first battle screenshot showed pile-ups on an anti-diagonal placement.
- Log-panel toggle initially showed stale text when opened (lines accumulate while closed) — caught in self-review, catch-up added on open.
- One transient full-suite failure (1/259) traced to machine load from zombie headless-Chrome instances spawned by the drive scripts — two consecutive clean re-runs after cleanup; not a code issue.
- Headless drives (puppeteer-core, scratchpad-only): standard flow → Battle → Result; Log-panel open mid-battle (narration lines exactly per spec format, playback not paused); wipeout under press-and-hold FF → Pass 2, weaken icon, wipe verdict → Result. Zero pageerrors across all drives.

### Completion Notes List

- **AC1/AC2 ✅** Two procedural iso checkerboards (Graphics, drawn once), `\` diagonal, enemy upper-left red / player lower-right blue, alternating neutral tiles, gold-deep strokes, front-row indicator (brighter tiles + gold-lite edge + FRONT arrows), positional side labels. Orientation-aware projection (`'|' | '\' | '/'`, default `'\'`) — pure, 13 projection tests, `'\'` pixel-verified, others invariant-tested (untuned by design).
- **AC3 ✅** Every event an animated beat in 1:1 order: class-flavored attacks (lunge / arrow / blast wash), heal glow, distinct misfire (wiggle) / fizzle / sleep treatments with the `↳` pairing preserved, death fade+topple with the **corpse leaving the lane**, HUD pass/engagement labels. All 1.9/1.10 beat-loop review patches preserved verbatim.
- **AC4 ⚠️→✅** Sprites 32px ×1; combat numbers 14px mono bold; HP bars 8px side-colored over low-alpha track. **HP numerals dropped** (sanctioned fallback: 13px mono `101/140` ≈ 50px vs 28px lane pitch = guaranteed collision); "distinguishable per unit" rides depth-sorting + on-device judgment.
- **AC5 ✅** Bars from `hpAfter` (+`EngagementEnded` resync), popups from `damage`/`amount`; numbers actor-side-colored via roster lookup; `PoisonTicked` (no actor in payload) uses the neutral poison color — documented in constants.
- **AC6 ✅** Persistent glyph icons (Zzz/☠/↓/?), exact log-derivable lifecycle (apply → clear-except-poison at engagement end → leave with corpse), colors/glyphs keyed by the engine `SpellKind` union.
- **AC7 ✅** Pure narration ledger (9 tests; spec example verbatim; TRUE before→after incl. overkill via running HP; resync). Panel: toggle, keep-last-14, appends while closed, catch-up on open, never touches the timer — live-verified.
- **AC8 ✅** `docs/adr/0001-battle-camera-iso-board.md` — the repo's first ADR; decision + context + `\`-diagonal evolution + orientation-seam consequences.
- **AC9 ✅** Slim HUD; bottom bar = hint + Log toggle only (speed buttons deferred to 2.3); Battle units normalized to shared helpers (sprite, 12px dot — closes 2.1's deferred Battle-badge item; element word gone from Battle).
- **AC10 ✅** Reveal renders the same two boards through the same projection + helper; units stand on tiles (2.1's card wash retired — side identity = tile color + code color + position); behavior untouched.
- **AC11 ✅** Static boards (2 Graphics), no scene `update()` loop (timer/tween-driven), transient popups destroyed on complete, reduced-motion damping implemented. Real fps check = on-device.
- **AC12 ✅** Gate green (259 tests, engine coverage unchanged, build ✓, bundle 0.36 MB). On-device sign-off complete ("everything looks great… I love it"); the font remark is the known 2.1-diagnosed backing-store ceiling, not a 2.2 finding.
- Scope fences honored: no speed/skip controls, no settings/theme, no engine changes (LOG_VERSION untouched), no Result changes, no new art (boards/effects/icons all procedural or text), no profiling infra.

### File List

- `docs/adr/0001-battle-camera-iso-board.md` — NEW: the camera ADR (AC8)
- `apps/web/src/flow/battleView.ts` — REWRITTEN: orientation-aware iso projection (`unitTileCenter`, `boardTiles`); beat schedule unchanged; old rectangular transform retired
- `apps/web/src/flow/narration.ts` — NEW: pure narration ledger for the Log panel
- `apps/web/src/config/board.ts` — NEW: `drawIsoBoard` shared Graphics renderer
- `apps/web/src/config/constants.ts` — MODIFIED: `ISO_BOARD`/`ISO_TILES` geometry+palette (night variant), status glyphs/colors, battle labels, `POISON_TEXT`; `BATTLE_BOARD` removed
- `apps/web/src/scenes/BattleScene.ts` — REWRITTEN: iso stage, animated beat vocabulary, actor-colored numbers, status icons, Log panel, slim HUD (all 1.9/1.10 beat-loop contracts preserved)
- `apps/web/src/scenes/RevealScene.ts` — MODIFIED: shared iso boards + units-on-tiles (card wash retired); label repositioned
- `apps/web/test/battle-view.test.ts` — REWRITTEN: 14 projection/pacing tests (3 orientations)
- `apps/web/test/narration.test.ts` — NEW: 9 narration tests
- `docs/implementation-artifacts/sprint-status.yaml` — MODIFIED: story tracking
- `docs/implementation-artifacts/2-2-the-animated-battle-scene.md` — MODIFIED: this story file

### Change Log

- 2026-07-14: Story 2.2 implemented — iso two-board battle stage (procedural Graphics, ADR-0001 recorded), orientation-seam projection (pure, tested), animated beat vocabulary per event type with 1.9/1.10 contracts preserved, actor-side combat numbers (poison neutral), exact log-derivable status icons, pure-tested narration Log panel (never pauses playback), Reveal board adoption, reduced-motion damping. 259 tests green; bundle 0.36 MB; standard + wipeout flows headless-verified with screenshots. Pending: on-device sign-off (AC12).
- 2026-07-14 (acceptance): AC12 signed off on device ("everything looks great… I love it"); font remark = the known 2.1-diagnosed backing-store ceiling, not a 2.2 finding. Status → review.
- 2026-07-14 (code review): 3-layer adversarial review vs baseline e21e7b1 — architecture verified clean (beat contracts, projection invariants, narration math, AD-2 purity, scope fences). 8 patches applied: singleton-scene state reset in create() (stale holding/log/views), tween kill+rest-pose reset (FF corruption), status-icon relayout (slot collision), blast washes every struck tile in actor color + arrow color token, Log-panel Standard-seam suppression + 11-line window, engage-only FF reschedule (tap-stall), 'waits'/weight-800/lane-docstring nits, reduceMotion per-battle. 1 deferred (StatusCleared engine events at next LOG_VERSION bump — deferred-work.md), 2 dismissed. Gate re-run green (259 tests); flow re-driven clean. Status → done.
