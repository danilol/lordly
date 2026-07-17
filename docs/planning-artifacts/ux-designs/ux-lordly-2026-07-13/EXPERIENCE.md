---
name: Lordly
status: final
updated: 2026-07-13
sources:
  - docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md
  - docs/planning-artifacts/epics.md
  - docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md
---

# Lordly — Experience Spine (EXPERIENCE.md)

> This is the experience spine for Lord Battle Tactics ("Lordly"): foundation, information architecture, behavior, state, interaction, accessibility, and flows. Visual identity — colors, type, shape, components' *appearance* — lives in `DESIGN.md`, referenced here by `{token}`. This spine does not duplicate visual values.
>
> **Both spines win on conflict with any mock or import.** Where a mockup, the visual-directions specimen, or the current code disagrees with this file, this file is the authority for behavior — mocks illustrate, the spine decides.

## Foundation

**Portrait mobile is the target surface.** The design canvas is a taller portrait safe-area (~9:19.5), scaling down gracefully to a **360×640 CSS-px minimum** (FR30). The extra vertical room is a deliberate call for the mobile-only target — it eases readability and lets the two battle boards stack vertically. Bigger screens (laptop/desktop) get a functional, centered layout with no extra effort — a nice-to-have, never a design driver.

**Touch-native.** Every interaction is tap or drag; there is no hover state to depend on, no keyboard, no right-click. Tap targets are ≥ 44px (see `DESIGN.md` `{components.button}`).

**The game is a Phaser scene-FSM (AD-5).** Each screen is a Phaser Scene; match progress lives in one serializable `MatchState` owned by the `MatchFlow` controller and passed on every transition (AD-13). There is no web-DOM chrome around the game — the whole experience renders inside the Phaser canvas. Two themes (Heritage Parchment default / Night Tactics) are switchable and persist via `lordly.v1.settings` (AD-8); every screen must be designed in both.

**The battle engine is upstream of everything shown (AD-1, AD-2).** The engine resolves the entire battle into an immutable `BattleLog` before playback begins. The Battle scene is a *pure player* of that log — it renders events, it never computes combat. Anything the UI shows must already be an event in the log (AD-12).

## Information Architecture

Nine Phaser scenes (AD-5), organized as the match loop plus a Home hub. The screen *set* is fixed by architecture; this spine designs their behavior.

| Screen | Reached from | Purpose |
|---|---|---|
| **Home** | App open (cold) | Hub. Play vs AI, the Standard/Wipeout mode toggle, and entry to Help, Credits, History, Settings. |
| **Draft** | Home → Play | Pick 3 units from 6 classes; each shows its rolled element immediately (FR1–FR3). |
| **Placement** | Draft → Continue | Drag the 3 units onto your own 3×3 grid (FR4). |
| **Reveal** | Placement → Ready | Both boards flip face-up, face to face, before combat (FR6). |
| **Battle** *(HERO)* | Reveal → Fight! | Watch the resolved `BattleLog` play out as an animated OB64-style clash (FR21). |
| **Result** | Battle end | Winner/draw verdict, both final HP %, both compositions; Rematch / Home (FR22). |
| **History** | Home → History | Last 10 match results, on-device (FR28). *(Epic 3.)* |
| **Help / Rules** | Home or Draft | Player-worded rules — classes, RPS, targeting, elements, judging (FR27). |
| **Credits** | Home | Art-pack attributions from the manifest (FR31). |

**The FR27 match loop:** `Home → Draft → Placement → Reveal → Battle → Result → (Rematch | Home)`. Rematch returns straight to a fresh Draft with a new seed, one tap. The loop must complete end-to-end in under five minutes, with no account and no tutorial gate.

**Home spurs:** `Home → Help`, `Home → Credits`, `Home → History`, `Home → Settings`. Every post-Home scene carries a `‹ Home` affordance so no screen is a dead-end.

`[ASSUMPTION]` **Settings** hosts the theme toggle and battle-speed default (Story 2.3, AD-8), but AD-5's scene list is closed at the nine above and does not name a Settings *scene*. Settings is therefore specified here behaviorally but its realization — a lightweight modal/overlay from Home vs. a tenth FSM scene — is undecided; needs Danilo's call. Either way it touches storage only through the `web/storage` gateway.

→ Composition reference: `.working/visual-directions.html` (specimen only — palettes, type scale, components). This spine wins on conflict.

## Voice and Tone

Microcopy is medieval-fantasy but **plain and legible** — a first-timer reads it cold. Controls are active-voice verbs. Brand posture and aesthetic voice live in `DESIGN.md`.

| Do | Don't |
|---|---|
| "Draft your army" · "Place your units" · "Ready" · "Fight!" | "Commence thy conscription, brave liege" |
| "Both armies face off. Tap to begin the battle." | "Loading battle…" |
| "Victory!" / "Defeat" / "Draw" | "You Win!!!" / "GAME OVER" |
| "Standard — one engagement, highest HP % wins" | "Mode: 0" |
| "Wipeout — fight until a side falls (max 5 engagements)" | "Extended combat resolution protocol" |
| "No battles yet — play your first match." | "History empty (0 records)" |
| Active-voice controls: "Rematch", "Home", "Skip to result" | Passive labels: "Rematching…", "Home button" |

Existing labels in `constants.ts` already follow this (`DRAFT_TITLE`, `REVEAL_HINT`, `RESULT_WIN_LABEL`, etc.) — keep them as the source of truth; new copy matches their register.

## Component Patterns

Behavioral rules. Visual specs live in `DESIGN.md.Components`, referenced by token.

| Component | `DESIGN.md` token | Behavioral rules |
|---|---|---|
| Framed panel | `{components.framed-panel}` | Container for rosters, unit-detail, result summary. Static; not itself interactive. |
| Button | `{components.button}` | Tap to act. Disabled state is visibly muted and ignores taps (e.g. Ready until 3 placed). ≥ 44px. |
| Mode toggle | `{components.mode-toggle}` | Home only. Two mutually-exclusive buttons (Standard default / Wipeout); tap selects, selected takes gold fill. Writes `MatchState.mode` for the next match (Story 1.10). |
| Theme toggle | `{components.theme-toggle}` | Settings. Switches Heritage/Night live; persists via `lordly.v1.settings` (AD-8). |
| Unit card / tile | `{components.unit-card}` | Side-colored border (blue you / red enemy). In Draft: tap to add. In Placement: drag to grid. Elsewhere: display only. Always shows class code + element badge. |
| HP bar | `{components.hp-bar}` | Depletes only from `BattleLog` event payloads (`hpAfter`) — never animated by guesswork (AD-2). |
| Element badge | `{components.element-badge}` | Identical dot in every scene (FR3). Owner sees own rolls at Draft; opponent's elements appear only at Reveal (FR3). |
| Combat number | `{components.combat-number}` | Battle scene only. One float per damage/heal event, side-colored, rises and fades within the event's beat. |
| Iso board | `{components.iso-board}` | Procedural tilted 3×3. Placement uses one board (yours, blue); Reveal and Battle show two stacked (enemy red top, you blue bottom). |
| Battle control bar | — (see Battle screen) | Pinned bottom bar: play/normal, fast-forward, skip-to-result, ≡ Log toggle. Controls playback only; never rules. |

## State Patterns

| State | Screen | Treatment |
|---|---|---|
| Cold open | Home | Title, Play vs AI, mode toggle, and Help/Credits/History/Settings entries. No spinner — the game is offline-first (FR29). |
| Draft incomplete | Draft | Continue disabled until exactly 3 units drafted; running count shown ("2 / 3"). |
| Ready disabled | Placement | Ready is disabled until all 3 units are placed (hint: "place all 3 units"); enables on the third drop. |
| Simultaneous hidden commit | Placement → Reveal | The AI commits its board with no knowledge of yours (FR5, FR24); the enemy board stays hidden until Reveal. |
| Reveal hold | Reveal | Both boards shown face-to-face; enemy composition + elements now visible. Waits for a tap to start (no auto-advance — the read is the payoff). |
| Battle playback beats | Battle | One `BattleLog` event = one distinct beat, ≥ 300 ms at normal speed (Story 2.2). Events render strictly in initiative order; the scene derives no state. |
| Fast-forward / skip | Battle | Same log, played faster or resolved instantly to Result — no rule divergence (FR23, AD-2). |
| Win / lose / draw | Result | Full-screen banner: Victory (blue-side), Defeat (red-side), Draw (neutral). Animated count-up of both final HP %. Both compositions with sprites + elements. |
| Empty history | History | "No battles yet — play your first match." Link back to Home / Play. |
| Stale replay | History | An entry whose `balanceVersion` no longer matches the engine still displays fully but is marked non-replayable; Replay is disabled for it (AD-8). *(Epic 3.)* |
| Draw offered | Result | Exact HP-% tie declares Draw and still offers Rematch (FR18, FR22). |

## Interaction Primitives

- **Tap to act.** Buttons, class cards (Draft), tile selection, and "tap to advance" (Reveal → Battle start; Battle "tap to begin").
- **Drag-and-drop placement (FR4).** In Placement, drag a unit onto any cell of your 3×3 grid. Dropping onto an **occupied cell swaps** the two units (never rejects the drop — no dead-ends). Any arrangement of the 3 units is legal.
- **Press-hold / controls for speed.** Interim (Epic 1) fast-forward is **press-and-hold** to speed up (`BATTLE_FAST_FORWARD` ×4 while held); the Epic 2 Battle control bar replaces this with explicit, tappable speed buttons (normal / fast ×2+) per FR23 and Story 2.3.
- **Tap-to-advance** gates the two moments where the player should choose *when* to proceed: starting the battle from Reveal, and (optionally) dismissing the Result banner.
- **Skip-to-result** jumps straight to Result at any point during Battle.
- **Banned:** hover-dependent affordances (touch surface), long-press for app actions (reserve for none in MVP), any control that pauses to make a *rules* decision (the battle is pre-resolved — AD-2).

## Accessibility Floor

Behavioral floors. Visual contrast lives in `DESIGN.md`.

- **Concrete px floors on a 360px-wide viewport (Story 2.2):** unit sprites render **≥ 32px**; floating damage/heal numbers **≥ 14px**; HP bars and status icons are **distinguishable per unit** (each unit's HP/status readable independently, not merged into a blur).
- **The MIN_FONT_PX floor** is 10px (`{min-font-px}`), but the type scale keeps every label well above it. **Readability history:** full class words don't fit ~48px compact cards, so compact cards show 3-letter codes at the 15px label size — this is a legibility fix, not an abbreviation for its own sake (Story 2.0).
- **DPR / zoom-aware text (Story 2.0).** The game renders at the 360-base and Phaser `Scale.FIT` upscales the canvas, which softens text; glyphs render to a higher-resolution texture (`TEXT_RESOLUTION`) so labels stay crisp when scaled up. New text inherits this via the shared `crispText` path.
- **Side legibility is an accessibility feature, not only aesthetics:** blue = you / red = enemy plus the shared element dots let a player track their side under motion. Because side and outcome both lean on the blue/red hue pair, pair every side/outcome cue with a **non-color** anchor (label text, board position — enemy always top, you always bottom) so it survives color-vision differences.
- **Reduced motion.** `[ASSUMPTION]` Honor a reduce-motion preference by damping non-essential animation — banner flourishes and float travel — while preserving the event beats themselves (the beats *are* the information). Exact mapping deferred to Story 2.2/2.3 implementation.
- Distinct beats ≥ 300 ms give players time to read each action; fast-forward is opt-in, never the default first watch.

## Key Flows

### Flow 1 — Danilo plays a match to Victory (bus stop, first watch)

Danilo is the one guaranteed player; design for his delight.

1. Danilo opens Lordly. **Home** shows the title, **Play vs AI**, and the mode toggle resting on **Standard**.
2. He taps **Play vs AI** → **Draft**. Six class cards. He taps Knight, Knight, Mage; each card shows its rolled element badge the instant it's added (FR3). Count reads "3 / 3"; **Continue** enables.
3. **Placement.** He drags both Knights to the front row (left, center) and tucks the Mage back-center — betting the AI leads with Archers. The third drop enables **Ready**.
4. He taps **Ready.** The AI has already committed blind (FR5). **Reveal**: both boards flip face-up, face to face — the AI brought Archer / Archer / Cleric. His read holds; the reveal already tells him he's ahead. He taps to begin.
5. **Battle.** Enemy board (red tiles) sits top, his (blue tiles) bottom, a clash gap between. His Knights step into the gap and strike; arrows arc; his Mage's blast washes the enemy back row. Blue combat numbers pop over enemy units, red ones over his; HP bars deplete per event; a corpse leaves its lane. Each beat is its own readable moment.
6. **Climax:** the last enemy falls. **Result** slams up a full-screen **Victory!** banner (blue-side), both HP % counting up — **61% vs 18%** — with both compositions shown, sprites and elements.
7. He taps **Rematch** before the count-up finishes. Straight to a fresh **Draft**, new seed. Total elapsed: under five minutes.

Failure branch: if his read were wrong and the AI wiped him, the same beats play to a **Defeat** banner (red-side); Rematch is still one tap away.

### Flow 2 — Rematch grind with fast-forward (later, chasing a composition)

1. From a **Result**, Danilo taps **Rematch** → fresh **Draft**.
2. He drafts and places quickly — he's testing whether a double-Archer back line beats the AI's melee lead.
3. **Reveal**, tap to start, **Battle**. This time he doesn't savor it: he taps **fast-forward (×2)** on the control bar, and the same log plays at speed with no rule change (FR23, AD-2). When the outcome is obvious he taps **skip-to-result**.
4. **Result** resolves instantly. He reads the HP %, taps **Rematch**, and goes again. His speed preference persists via `lordly.v1.settings`, so the next battle opens already fast (Story 2.3, AD-8).
5. Between watches he taps **≡ Log** once mid-battle to read the exact numbers ("Knight A:0 struck Archer B:1 for 12 — 78→66 HP") without pausing playback, confirming his read, then collapses it.

---

## Per-Screen Behavior

Each screen inherits the DESIGN system (themes, framed panels, type scale, blue/red sides). Only behavior, layout, and state are specified here.

### Home
The hub and the only cold-open surface. Contents: the wordmark (`{typography.title}`), a primary **Play vs AI** button (`{components.button}`), the **Standard / Wipeout mode toggle** (`{components.mode-toggle}`; Standard default, FR17), and entries to **Help**, **Credits**, **History**, and **Settings**. The mode toggle writes `MatchState.mode` for the next match; Wipeout carries its cap hint ("fight until a side falls (max 5 engagements)"). No network, no spinner — Home is instantly interactive offline (FR29).

### Draft
Title "Draft your army" (`{typography.heading}`). Six class cards, each with class name, sprite, and a compact rules card (role, RPS relation, per-row behavior) — enough to draft cold (FR2). Tapping a card adds a unit (duplicates allowed, up to 3); each added unit **immediately shows its rolled element badge** (FR3, owner-visible only). A running "N / 3" count; **Continue** stays disabled until exactly 3 are drafted. Help is reachable here too (FR27). Full class *words* are allowed on these picker cards (space permits); compact contexts use the 3-letter code.

### Placement
Title "Place your units". A single **iso board** — *yours*, blue-tiled — plus your 3 drafted units to drag on (FR4). Drag-and-drop onto any of the 9 cells; dropping onto an occupied cell **swaps**. An enemy-army marker orients the player to which edge faces the foe. **Ready** is disabled with the hint "place all 3 units" until all three are placed, then enables. Placement is hidden and simultaneous — the AI commits blind (FR5, FR24). On Ready → Reveal.

### Reveal
Title "Reveal" with the hint "Both armies face off. Tap to begin the battle." Both boards shown face-to-face — enemy composition and elements now visible for the first time (FR6). The moment holds on a tap ("Fight!") rather than auto-advancing, because reading the matchup is where the player's skill pays off. Tap → Battle.

### Battle *(HERO — locked layout)*
The Battle scene is a **pure `BattleLog` player** (AD-2): it renders events in initiative order and computes no combat. Layout is fixed:

- **Slim top HUD bar.** `‹ Home` on the left; a live **pass / engagement label** on the right (e.g. "Engagement 1" — in Wipeout, "Engagement 2 ended" markers delimit engagements, driven by `EngagementEnded` events, FR19). Slim so it never crowds the boards.
- **Two 3×3 iso boards, `\` diagonal offset.** **Enemy board (red tiles) upper-left, player board (blue tiles) lower-right** (`{components.iso-board}`) — echoing the two corner formation boards of OB64 (reference image4). The board never changes shape: always **9 slots**, and the units fight **straight front-to-front** — the diagonal is a display twist only. **Front ranks face the centre (each other):** the player's front rank is its **top-left (inner) edge** facing up-left toward the enemy, back rank the bottom-right corner; the enemy's front rank is its **bottom-right (inner) edge** facing down toward the player, back rank the top-left corner. A **front-row indicator** — brighter front tiles + gold edge, deliberately non-verbal — makes each clashing edge unmistakable *(amended 2026-07-17, story 4.0: FR39e removed the redundant "FRONT" text arrow; the tile treatment alone is the indicator — UX-DR8 reconciliation)*. Between the two boards, along the diagonal, is the **clash gap** where cross-lane attacks animate (melee steps in, arrows and blasts cross it). Lane mirroring (your left column faces the enemy's right, FR7) is renderer-only math confined here (AD-11); never pushed into the data.
- **Orientation seam (cheap-seam decision).** The owner-local→screen projection (`battleView.toScreenCell`) takes an **orientation parameter** (`|` vertical / `\` / `/`) from the start; `\` is the shipped default. A player-facing view toggle over the other orientations is deferred to a later Settings addition (deferred-work.md) — building the seam now keeps it engine-safe and cheap, not a rewrite. [AD-11]
- **Per-unit HP bars and floating combat numbers** update strictly from event payloads (`{components.hp-bar}`, `{components.combat-number}`). Damage/heal ≥ 14px, sprites ≥ 32px (Story 2.2).
- **Pinned bottom control bar.** Play/normal, **fast-forward (×2+)**, **skip-to-result**, and a **collapsible ≡ Log panel** toggle (FR23, Story 2.3). The Log panel expands beneath the boards to show a scrolling text narration of the *same* events already animating — it reads from the log the scene already holds, adds no data, and does not pause playback (Story 2.2). A second tap collapses it.

Each event is a distinct beat ≥ 300 ms at normal speed; deaths play out and the corpse leaves the lane. Skip resolves straight to Result with no rule change.

### Result
The verdict (FR22). A full-screen **banner** — **Victory!** (blue-side), **Defeat** (red-side), or **Draw** (neutral). An **animated count-up** of both final HP percentages. Both compositions shown with sprites and elements. Two one-tap buttons: **Rematch** (fresh Draft, new seed, single tap — FR27) and **Home**. On a live match this is where the single `HistoryEntry` gets written (AD-13); replays write nothing.

### History *(Epic 3)*
Reachable from Home. The last 10 match results persisted on-device (FR28): each row shows date, winner, **battle mode (Standard / Wipeout — PO addition 2026-07-15, read from the stored setup)**, and both compositions with class sprites and elements. *(Opponent type — vs AI / PvP — is deliberately absent until the link-play epic: every pre-link-play entry is provably vs AI, so "field absent = AI" backfills correctly forever.)* Empty state: "No battles yet — play your first match." An entry whose `balanceVersion` still matches offers **Replay** (re-resolves via the engine, plays with full presentation — Story 3.2); a mismatched entry displays fully but is marked non-replayable with Replay disabled (AD-8). Entries from unknown/older namespaces are ignored, never crashed on.

### Help / Rules
Reachable from Home and Draft (FR27). A phone-readable rules screen, content aligned to PRD Features 3–5 as the single source of truth: the class table with the RPS triangle, per-row behaviors, elements and Witch spells, targeting basics, and judging. Rendered from the standalone `docs/rules.md` artifact (Story 2.4, NFR3). Medieval-fantasy but plain; scrollable; dismissible by touch back to its origin.

### Credits
Reachable from Home. Every art pack renders from the attribution manifest with author, pack name, and license (FR31). Read-only; dismissible by touch. This is the license-honoring surface for the free/CC assets that make the zero-custom-art constraint work.

### Settings `[ASSUMPTION — realization undecided; see IA]`
Hosts the **theme toggle** (Heritage / Night, `{components.theme-toggle}`) and the **battle-speed default** (Story 2.3), both persisted via `lordly.v1.settings` through the `web/storage` gateway (AD-8). Theme switches live across the whole game. Whether Settings is a modal overlay from Home or a tenth FSM scene is an open call for Danilo (AD-5's scene list is closed at nine).

---

## Epic 4 extension (added 2026-07-17, story 4.1 — the design dossier is the rationale record)

*Extends the spine for the squad era (FR32–FR39). The MVP sections above stay authoritative for shipped behavior; where this section speaks, it wins for Epic 4 surfaces. Unit counts and copy above that say "3 units" read "5 slots" from story 4.2 (FR1); the Wipeout hint's cap reads from balance data (10 from 4.2).*

- **Placement gains three duties (FR4):** a **tactic picker** — four `{components.mode-toggle}`-style beveled options (Autonomous default · Weakest · Strongest · Leader; **Attack Leader renders disabled until story 4.5 ships leader designation** — no invisible defaults); **leader designation** — tap a placed unit to crown it (`{components.leader-crown}`), exactly one crown required to Ready; any army mutation clears the crown WITH a visible notice (AD-9's invariant, surfaced honestly); **per-row action counts** (FR39c) — each grid row shows the selected/dragged unit's count for that row ("back 2×") so positioning is an informed choice.
- **Reveal discloses everything (FR6):** both tactics as labels, both leader crowns. The read is the payoff.
- **Battle — the move-name plate (FR39b/d, Danilo's OB64 animation-off reference):** every beat, a small gold-framed plate (`{components.move-plate}`) appears over the ACTING unit naming its move ("Sword Slash", "Arrow", "Ice Blast", the FR16 spell names) and carrying its action pips (●○ = 1 of 2 left). The plate is the actor identifier, the beat namer, and the action-economy ledger in one transient element — no standing chrome; boards stay clean. Damage keeps popping on the TARGET. Fed by `UnitAttacked.kind` + `PassStarted.actionsRemaining` (log-driven, AD-2).
- **Guard reads on the board:** `GuardRaised` shows a persistent shield marker on the guarding unit (`{components.guard-marker}`) until `GuardEnded`; an intercepted attack animates its from→to INTO the guard (the bodyguard visibly steps in — `redirectedFrom` payload).
- **Leader fall:** `LeaderFell` gets a full-beat banner ("The leader has fallen!") + a persistent penalty tint on that side's HUD label.
- **Golem (FR38):** renders ≥48px spanning BOTH its cells (one body across two tiles), ONE HP bar + ONE code at its anchor cell — one unit, never two (AD-14).
- **Names (FR37):** on placement/reveal cards (under the code) and in the Log-panel narration ("Kain (KNI) struck…"); the board keeps codes.
- **History cards** gain tactic + leader per side (from the stored setup, story 4.5).

## Explicitly Deferred (not designed here)

These are loved but out of scope for this UX phase — noted only so no one designs them by accident:

- **Unit evolution** (units that change under conditions) — "waaaay ahead future."
- **Equipment reflected on the sprite** (OB64 weapon-swap-changes-the-model) — gated by the no-artist constraint.
- **Challenge-a-friend / play-vs-human** — a product feature (link-play epic), not Epic 2 presentation UX.
- Elemental-affinity wheel, DEX mechanics, leveling, tactics orders — PRD Out of Scope.

---

## Reference mockups

- [Battle screen — Fixed-HUD hero layout](mockups/battle-screen-mock.html) (theme-toggleable)
- [Visual directions — palette + type scale](mockups/visual-directions.html)
