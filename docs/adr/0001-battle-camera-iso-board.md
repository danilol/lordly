# ADR 0001: Battle camera — isometric board, billboard units

Date: 2026-07-14 (decision confirmed 2026-07-13, UX phase)
Status: Accepted
Story: 2.2 (epics.md requires the side-on vs isometric choice "recorded as an ADR" — NFR3 convention)

## Context

FR21 wants an OB64-style animated battle scene, and OB64's trademark look is
isometric. The project carries a hard constraint: **zero custom-commissioned
art** — free/CC packs plus procedural UI only. True isometric units would need
multi-angle sprites, which free/CC packs do not ship; this tension (the
"iso dream vs no-artist" risk) was flagged as reconcile-ogre-game **Gap 2**,
at risk of dying silently. The camera choice also had to be made explicitly
against the selected sprite pack's available angles (epics.md, Story 2.2).

Study of the OB64 reference material resolved the tension: OB64's isometric
look comes from a **tilted checkerboard board** (blue + tan/gold diamond
tiles) while the units themselves are **flat, single-angle 2D billboard
sprites** — exactly what free/CC pixel packs provide. The iso lives in the
board, not the units. Story 2.1's selected pack (CC0 Dungeon Crawl Stone Soup
tiles) is single-angle billboards, fitting this exactly.

## Decision

Battle-scene camera = **isometric tilted 3×3 checkerboard board (procedural
geometry, zero art) + flat single-angle billboard sprites (free/CC packs) +
floating HP numbers/bars**. Tile color codes the side: **blue = player,
red = enemy** (the DESIGN.md load-bearing side rule).

**Layout:** an early "two boards stacked vertically" sketch was superseded
(UX, 2026-07-13) by the shipped default: the **`\` diagonal** — enemy board
upper-left, player board lower-right, front rows meeting along the diagonal
**clash gap**, with a front-row indicator (brighter front tiles + gold edge +
"FRONT" label) making each clashing edge unmistakable.

**The orientation seam:** the renderer's owner-local→screen mapping
(`battleView`, AD-11) takes an orientation parameter (`'|' | '\' | '/'`)
from the start; `'\'` is the shipped, pixel-tuned default. A player-facing
orientation toggle is deferred (deferred-work.md). The board is always
3×3 / 9 slots; **front-to-front is engine truth — the tilt and diagonal are
display-only** and never enter data (AD-11).

## Consequences

- No multi-angle or true-3D art is ever required; the zero-custom-art
  constraint holds. Sprite packs are evaluated on archetype distinctness
  only, not available angles.
- The iso board is pure geometry (diamond polygons) drawn procedurally —
  shared by the Reveal and Battle scenes as one component.
- Lane mirroring and the iso projection are presentation math confined to
  `battleView` (pure, unit-tested); the engine and `MatchSetup`/`BattleLog`
  stay coordinate-frame-agnostic (owner-local only).
- Resolves reconcile-ogre-game Gap 2.
