---
name: Lordly
description: Visual identity for Lord Battle Tactics — an OB64-inspired, deterministic tactical fantasy duel. Two switchable themes (Heritage Parchment / Night Tactics) over one procedural, zero-custom-art system. Blue = you, red = enemy, everywhere.
status: final
updated: 2026-07-13
colors:
  # ---- Heritage Parchment (LIGHT + DEFAULT theme) ----
  ground: '#e8dcc0'          # parchment — primary canvas
  ground-2: '#dccba3'        # aged parchment — secondary surface, neutral iso tile
  panel-body: '#f4ecd8'      # inside face of a framed panel (lighter than canvas)
  gold: '#c9a227'            # frame bevel, enabled/selected fills, title accent
  gold-deep: '#8a6d1c'       # bevel shadow edge, hairlines, iso tile stroke
  blue-you: '#2f5fb0'        # YOUR side — units, tiles, HP fill, win (load-bearing)
  red-enemy: '#b03a3a'       # ENEMY side — units, tiles, HP fill, lose (load-bearing)
  ink: '#2a2119'             # primary text on parchment
  ink-soft: '#5c4f3d'        # secondary / muted text on parchment
  # ---- Night Tactics (DARK + ALTERNATE theme) ----
  ground-night: '#161a2e'          # night slate — primary canvas
  ground-2-night: '#1f2438'        # slate raise — secondary surface
  tile-b-night: '#26304a'          # neutral iso tile (the non-side tile)
  panel-body-night: '#10131f'      # inside face of a framed panel (darker than canvas)
  gold-night: '#e3b64b'            # glowing gold — frame, selected fills, title
  gold-deep-night: '#9c7c26'       # bevel shadow edge of the gold frame
  blue-you-night: '#4a8fe0'        # YOUR side (load-bearing)
  red-enemy-night: '#e0533f'       # ENEMY side (load-bearing)
  bone: '#e8e4d8'                  # primary text on slate
  bone-soft: '#9a9db0'             # secondary / muted text on slate
  # ---- Element badges (SHARED across both themes — FR3) ----
  element-fire: '#d1603b'
  element-water: '#3f78c2'
  element-wind: '#6bae8c'
  element-earth: '#b0904f'
typography:
  title:
    fontFamily: '{font.serif}'
    fontSize: 26px
    fontWeight: '700'
    lineHeight: '1.0'
  heading:
    fontFamily: '{font.sans}'
    fontSize: 18px
    fontWeight: '700'
    lineHeight: '1.25'
  body:
    fontFamily: '{font.sans}'
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: '{font.sans}'
    fontSize: 15px
    fontWeight: '600'
    letterSpacing: 0.02em
    note: 'Class codes (KNI/MER/ARC/MAG/CLE/WIT) are labels rendered at fontWeight 800 in the unit-card treatment.'
  data:
    fontFamily: '{font.mono}'
    fontSize: 13px
    fontWeight: '400'
    note: 'font-variant-numeric: tabular-nums — HP, percentages, damage always monospaced.'
font:
  serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif'
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  mono: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, monospace'
rounded:
  sm: 6px
  DEFAULT: 8px
  md: 8px
  lg: 10px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  bevel-frame: 3px          # thickness of the gold bevel around a framed panel
  screen-margin: 20px       # portrait side gutter
min-font-px: 10px           # hard accessibility floor (Story 2.0); the scale keeps labels well above it
components:
  framed-panel:
    frame: '{colors.gold}'                 # gold bevel border (gradient, light top → shadow bottom)
    frame-shadow: '{colors.gold-deep}'
    frame-thickness: '{spacing.bevel-frame}'
    body: '{colors.panel-body}'
    radius: '{rounded.DEFAULT}'
    elevation: 'heritage = drop-shadow · night = soft gold glow'
  button:
    frame: '{colors.gold}'
    fill-default: '{colors.panel-body}'
    fill-enabled: '{colors.gold}'          # enabled/selected = gold fill
    text-enabled: '{colors.ink}'
    text-disabled: '{colors.ink-soft}'     # muted, no gold fill
    radius: '{rounded.sm}'
    min-height: 44px                        # tap-target floor
  mode-toggle:
    note: 'Standard / Wipeout — two beveled buttons; selected = {components.button.fill-enabled}. Home only (Story 1.10).'
    button-height: 44px
  theme-toggle:
    note: 'Heritage / Night — two beveled buttons in Settings; selected = gold fill. Persisted via lordly.v1.settings (AD-8, Story 2.3).'
  unit-card:
    border-you: '{colors.blue-you}'         # side-colored BORDER, never a gold frame
    border-enemy: '{colors.red-enemy}'
    border-width: 2px
    fill-you: 'blue-you @ ~14–16% alpha'
    fill-enemy: 'red-enemy @ ~14–16% alpha'
    code: '{typography.label}'              # 3-letter class code, weight 800
    # FR39f contrast treatment (story 4.0, 2026-07-17): codes standing ON
    # side-colored board tiles use LIGHT side tints over a dark outline —
    # the outline carries the letterform on any ground (incl. future
    # landscape backdrops). Side-hue text on a same-hue tile is forbidden.
    code-fill-you: '#d6e8fa'                # light blue-family tint
    code-fill-enemy: '#f8d9d2'              # light red-family tint
    code-stroke: '#10131f'                  # dark outline, 3px @ 13px code
    radius: '{rounded.sm}'
  hp-bar:
    track: 'ink @ ~18% (heritage) · white @ ~10% (night)'
    fill-you: '{colors.blue-you}'
    fill-enemy: '{colors.red-enemy}'
    numerals: '{typography.data}'           # tabular, e.g. "101/140"
    height: 8px
    radius: '{rounded.sm}'
  element-badge:
    shape: solid filled dot
    size: 12px
    radius: '{rounded.full}'
    colors: '{colors.element-fire} · {colors.element-water} · {colors.element-wind} · {colors.element-earth}'
    note: 'Identical in every scene (Draft, Placement, Reveal, Battle, History) — FR3.'
  combat-number:
    fontFamily: '{font.mono}'
    fontWeight: '800'
    color-you: '{colors.blue-you}'
    color-enemy: '{colors.red-enemy}'
    note: 'Floating, bold, side-colored, tabular. Damage/heal ≥ 14px on a 360px viewport (Story 2.2).'
  iso-board:
    note: 'Ungframed procedural geometry — a tilted 3×3 checkerboard. ZERO art.'
    tile-you: '{colors.blue-you}'           # player board tiles
    tile-enemy: '{colors.red-enemy}'        # enemy board tiles
    tile-neutral: '{colors.ground-2}'       # heritage · {colors.tile-b-night} in night
    tile-stroke: '{colors.gold-deep}'
---

# Lordly — Visual Identity (DESIGN.md)

> This is the visual-identity spine for Lord Battle Tactics ("Lordly"). It owns colors, type, shape, elevation, and per-component appearance. Behavior, flows, and information architecture live in `EXPERIENCE.md`, which references the tokens here by `{name}`.
>
> **Both spines win on conflict with any mock or import.** Where the visual-directions specimen (`.working/visual-directions.html`), the OB64 reference screenshots, or the current `apps/web/src/config/constants.ts` palette disagree with this file, this file is the authority — mocks illustrate, the spine decides.

## Brand & Style

Lordly is a five-minute tactical duel that wears its heart on its sleeve: it wants to feel like *Ogre Battle 64* — heroic, medieval-fantasy, dragons-and-magic — read at arm's length on a phone at a bus stop. The whole match is decided *before* the clash, in class picks and placement reads; the visuals exist to make that plan legible and then to make watching it pay off a genuine show.

The aesthetic is **procedural heritage**: ornate gold-framed "picture-frame" panels, a tilted isometric checkerboard board, and flat billboard unit sprites — the OB64 look reconstructed entirely from geometry, CSS bevels, and free/CC pixel packs, with **zero custom-commissioned art** (a hard constraint — the creator is not an artist and will not pay one, per Epic 2 / FR31). The isometric dream is achieved by putting the iso in the *board* (pure geometry, free) and keeping units single-angle billboards (what free packs ship). Nothing here requires a drawn asset.

Two themes carry the same bones. **Heritage Parchment** (LIGHT, the default) is warm, sunlit, storybook — aged parchment and gold, box-art bright, highest text contrast. **Night Tactics** (DARK, the alternate) is moody and cinematic — night slate and glowing gold, closest to the current build. The player switches themes in Settings; the choice persists alongside battle speed via `lordly.v1.settings` (AD-8, Story 2.3). Both themes are first-class: design every screen in both.

One rule outranks taste in either theme: **blue = you, red = enemy, everywhere.** This is game legibility, not decoration — it is how a player instantly reads which units, tiles, HP bars, and combat numbers are theirs in the heat of an auto-battle.

## Colors

Colors split three ways: a per-theme **ground + ink** pair, the load-bearing **side pair**, and a **shared element set**.

**The grounds (theme-specific).**
- **Heritage:** `{colors.ground}` parchment is the canvas; `{colors.ground-2}` is the aged-parchment secondary surface and the neutral iso tile; `{colors.panel-body}` is the lighter inner face of a framed panel; `{colors.ink}` / `{colors.ink-soft}` carry text.
- **Night:** `{colors.ground-night}` slate is the canvas; `{colors.ground-2-night}` raises secondary surfaces; `{colors.panel-body-night}` is the *darker* inner panel face; `{colors.bone}` / `{colors.bone-soft}` carry text.

**Gold is the metal, not an accent-on-everything.** `{colors.gold}` (warm in Heritage, glowing `{colors.gold-night}` in Night) is reserved for the beveled frame, enabled/selected button fills, and the display title. `{colors.gold-deep}` / `{colors.gold-deep-night}` is always the *shadow* edge of a bevel and the iso-tile stroke — never a fill on its own. Gold never denotes a side; sides are blue/red only.

**The side pair is load-bearing (FR7, AD-11).** `{colors.blue-you}` is always the human player (side A — AD-11); `{colors.red-enemy}` is always the opponent. It colors unit-card borders, iso-board tiles, HP-bar fills, and floating combat numbers. Semantic outcomes inherit it: **win = blue-side, lose = red-side, draw = neutral ink/bone.** Never invert it, never theme it away, never use green-for-player (the current `constants.ts` uses a legacy green player family — superseded by blue here).

**Elements are shared and consistent (FR3).** The four element badges are the same hues in both themes: `{colors.element-fire}` fire, `{colors.element-water}` water, `{colors.element-wind}` wind, `{colors.element-earth}` earth. They read as *element*, never as *side* — always a small solid dot, never a card border or HP fill (which are side-coded). `[ASSUMPTION]` The engine `Element` palette in `constants.ts` (fire `#c0563a`, water `#3a76c0`, wind `#6ab08a`, earth `#a98a52`) is close but not identical to these UX values; reconcile to these on the Story 2.1 sprite/badge pass — one source, applied everywhere.

## Typography

Three families, one scale, shared across both themes. The scale **replaces the per-scene font guesswork from Story 2.0** — it is the single ramp every scene draws from.

- **Display / title — ornate serif.** `{typography.title}` at 26px. Georgia is the web/stand-in face. `[ASSUMPTION]` The eventual in-game display face is a **bundled ornate/blackletter bitmap font** evoking the OB64 logo — pack selection deferred (paired with the Story 2.1 sprite decision); until then Georgia stands in. Used only for the wordmark and scene titles ("Reveal", "Victory!").
- **UI headings / body / labels — humanist system sans.** `{typography.heading}` 18px bold for scene headings; `{typography.body}` 15px regular for instructions and rules prose; `{typography.label}` 15px semibold for controls and the **3-letter class codes** (KNI / MER / ARC / MAG / CLE / WIT), which render at weight 800 in the side-colored unit-card treatment.
- **Data — tabular monospace.** `{typography.data}` 13px with `tabular-nums` for all HP values, percentages, and floating damage/heal numbers, so digits never shimmy as they count.

**The floor.** `{min-font-px}` (10px) is a hard accessibility floor carried from Story 2.0, but the scale keeps every label well above it. **Readability history (why codes, not words):** full class *words* ("mercenary") overflow a ~48px compact card at a readable size, so compact cards show 3-letter **codes** at the 15px label size — bigger *and* they fit. Full class names survive only where space allows (the Draft class picker). On the Battle scene, per Story 2.2, floating damage/heal numbers stay ≥ 14px on a 360px viewport regardless of theme.

## Layout & Spacing

An 8px-derived scale: `{spacing.1}`–`{spacing.6}` = 4 / 8 / 12 / 16 / 20 / 24px, plus two named tokens: `{spacing.bevel-frame}` (3px, the gold frame thickness that produces the raised-metal read) and `{spacing.screen-margin}` (20px, the portrait side gutter).

Layout is **single-column portrait**, always. The design surface is a **taller portrait safe-area (~9:19.5)**, scaling down gracefully to a **360×640 minimum** — the extra vertical room is a deliberate decision (mobile-only target) that eases readability and lets the two battle boards stack vertically. Board *width* stays 360-class; the canvas adds *height*. Bigger screens get a functional centered layout with no extra effort — an explicit nice-to-have, not a design target (FR30).

Panels breathe: 14–15px inner padding, 8–18px gaps between grouped elements. Related data (a unit's code + element + HP) sits tight; distinct panels get the larger gaps.

## Elevation & Depth

The signature elevation device is the **beveled gold framed panel** — the "picture frame" that is Lordly's entire depth language, built with **zero art**. A CSS gradient runs light along the top edge and shadow along the bottom of the gold frame, reading as raised, tooled metal around a recessed panel body. The frame is `{spacing.bevel-frame}` thick around a `{rounded.DEFAULT}` inner body.

Theme changes only the *ambient* treatment, not the bevel:
- **Heritage:** a soft drop-shadow below the frame (sunlit object on parchment).
- **Night:** a soft gold **glow** around the frame (metal catching torchlight on slate).

Depth otherwise comes from tone and the frame, not from stacked shadows. The iso board is the one element that is *not* framed — procedural geometry sitting directly on the ground (see Shapes).

## Shapes

Small, restrained radii: `{rounded.sm}` (6px) for buttons, unit cards, HP tracks; `{rounded.DEFAULT}` (8px) for panel bodies; `{rounded.lg}` (10px) for the outermost frame. Nothing fully rounded except the element badge dot (`{rounded.full}`). No pills for surfaces — the read is tooled-metal-and-parchment, not soft app-chrome.

The one non-rectilinear shape is the **isometric tile: a diamond**, produced by the board's tilt geometry, not a corner radius. The board is a tilted 3×3 checkerboard of these diamonds. Geometry — free of cost and free of art.

## Components

Behavioral rules for these live in `EXPERIENCE.md`; this section is appearance only.

- **Framed panel** (`{components.framed-panel}`) — the OB64 picture frame. Gold bevel (`{colors.gold}` → `{colors.gold-deep}` gradient) around a `{colors.panel-body}` body. The default container for menus, rosters, unit-detail, and result summaries. Heritage = drop-shadow; Night = gold glow.
- **Button** (`{components.button}`) — a smaller beveled-gold frame. **Default:** panel-body fill, gold frame, ink text. **Enabled / selected:** gold *fill*, ink text. **Disabled:** muted, no gold fill, `{colors.ink-soft}` text. Minimum 44px tall (tap target).
- **Mode toggle** (`{components.mode-toggle}`) — Standard / Wipeout, two beveled buttons; the selected one takes the gold fill. Lives on **Home** only (Story 1.10, FR17/FR19).
- **Theme toggle** (`{components.theme-toggle}`) — Heritage / Night, two beveled buttons in Settings, selected = gold fill; sits beside the battle-speed control (Story 2.3, AD-8).
- **Unit card / tile** (`{components.unit-card}`) — a **side-colored BORDER**, never a gold frame: `{colors.blue-you}` for your units, `{colors.red-enemy}` for the enemy, with a matching ~15%-alpha wash. Shows the 3-letter class code (weight 800) and an element badge. This is what makes side identity instant across Draft, Placement, Reveal, Battle, and History.
- **HP bar** (`{components.hp-bar}`) — a flat track (`{colors.ink}` / white at low alpha) with a **side-colored fill** and tabular numerals (`101/140`). 8px tall.
- **Element badge** (`{components.element-badge}`) — a single solid colored dot, 12px, identical in every scene. Element only; never encodes side.
- **Floating combat numbers** (`{components.combat-number}`) — bold tabular monospace, **side-colored** (blue when you deal/heal, red for the enemy), floating up from the struck unit. ≥ 14px on a 360px viewport.
- **Iso board** (`{components.iso-board}`) — ungframed procedural geometry: a tilted 3×3 checkerboard. Tiles **color-code the side** — `{colors.blue-you}` on the player board, `{colors.red-enemy}` on the enemy board, alternating with a neutral tile and stroked in gold-deep. Flat billboard sprites stand on the tiles. The OB64 iso look, zero art.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep **blue = you / red = enemy** on every unit, tile, HP bar, and combat number, in both themes | Invert or re-theme the side colors; use gold to denote a side; ship the legacy green-player palette |
| Derive the isometric look from **board geometry** (free, procedural) | Require multi-angle unit sprites or any true-3D art |
| Reserve gold for the **frame, selected/enabled fills, and title** | Flood UI with gold as a generic accent, or fill with `gold-deep` (it is a shadow edge only) |
| Use the shared **element dot** for element, consistently across all scenes | Encode element as a card border or HP fill (those are side-coded) |
| Hold labels to the type scale (class codes at 15px, weight 800) | Drop any label below the `{min-font-px}` 10px floor, or resurrect full class words on compact cards |
| Commission **zero custom art** — free/CC packs + procedural UI only | Commission, require, or design around bespoke artwork (hard constraint) |
| Design every screen in **both** Heritage and Night | Treat Night as the only theme (it's the current build, not the default) |
| Keep lane-mirroring in the renderer | Push lane-mirroring or side-flipping into the data (AD-11 — renderer-only) |

---

## Reference mockups

- [Visual directions — both themes, palette + type scale](mockups/visual-directions.html)
- [Battle screen — Fixed-HUD layout, theme-toggleable](mockups/battle-screen-mock.html)

_HTML mockups illustrate the tokens in context. The spine tables above win on conflict._
