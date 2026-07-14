---
baseline_commit: d72f4af4a04cbcd174722d1c0fe23e96ff7566bf
---

# Story 2.1: Real units — sprite packs, atlases, and animations

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want every unit to look like a fantasy pixel-art character with real animation representations,
so that the game stops looking like a prototype.

This is the **first art and the first asset-loading path** in the codebase. Everything before this rendered units as colored rectangles with a 3-letter class code. This story acquires redistribution-safe free/CC pixel-art, packs it into atlases inside the ≤3 MB budget, records license attribution in the repo, and swaps the placeholders for real sprites in the **Draft, Placement, and Reveal** scenes.

## Acceptance Criteria

**AC1 — Sprite pack(s) selected, license-clean, zero custom art.**
Sprite art is sourced from a **CC0** pack fetched via CLI from a stable direct URL (decided: dev-fetches-CC0; Kenney Tiny Dungeon/Tiny Creatures lead candidates). **Every one of the 6 classes** (`knight, mercenary, archer, mage, cleric, witch`) gets a **visually distinct** sprite that reads as its archetype at a glance. Each class has, at minimum, **idle, attack/cast, hurt, and death representations available** — *frame animation OR tween-based* is acceptable (FR31). Sprites are **single-angle flat billboards** (front / three-quarter) — no multi-angle or true-3D art is required or used (the isometric look lives in the board geometry, decided in Story 2.2; see Dev Notes §"Camera coordination"). **Zero custom-commissioned art** — a hard product constraint. Any pack whose license does not permit redistribution in a public repo is **rejected**.

**AC2 — Attribution manifest in the repo (FR31, legal weight).**
The selection is recorded in a machine-readable attribution manifest committed to the repo, listing **per pack: author, pack name, source URL, license (SPDX-style id + human name), and which classes/assets it supplies**. The manifest is the single source the Story 2.4 Credits scene will render from — structure it for that. It must be readable in-repo without running the app. (⚠️ A plain `.json` file is NOT Prettier-ignored — see Dev Notes §"Lint gotcha".)

**AC3 — Atlas-packed, within the ≤3 MB compressed budget (NFR1).**
Sprites are packed into texture atlas(es) (not loaded as N loose PNGs). The **initial shipped bundle stays ≤ 3 MB compressed**. The dev **measures the actual built size** (`pnpm --filter web build`, then inspect `apps/web/dist`) and records the number in the Dev Agent Record — measured, not estimated. Current baseline is ≈365 KB gzip (JS only), leaving ~2.6 MB of headroom for atlas PNGs (PNG is already compressed, so budget the raw atlas PNG weight).

**AC4 — Asset-loading path + crisp pixel-art rendering.**
A Boot/Preload scene loads the atlas(es) before any scene that renders units, inserted at the **head** of the scene list in `apps/web/src/main.ts:32`. Pixel-art rendering is enabled in the Phaser `Game` config (nearest-neighbor / no smoothing) so sprites stay crisp under `Scale.FIT` upscaling. **Verify text stays crisp** — the Story 2.0 `crispText`/`TEXT_RESOLUTION` mechanism must still produce sharp labels after enabling pixel-art (see Dev Notes §"pixelArt vs crispText").

**AC5 — Real sprites replace placeholders in Draft, Placement, Reveal.**
The colored-rectangle-plus-initial placeholders are replaced by real sprites in exactly these three scenes:
- `DraftScene` — class-card sprite placeholder (`buildCard`, ~lines 78–87) and the army-tray unit glyph (`redraw`, ~lines 130–145).
- `PlacementScene` — the draggable unit container (`redraw`, ~lines 123–140). **The drag-and-drop hit-area MUST be preserved** (`container.setSize(72,60)` + `setInteractive` + `setDraggable`, and `getData('unitIndex')`); swap the sprite *inside* the existing container, do not replace the container.
- `RevealScene` — `drawUnit` (~lines 80–90), positioned via the existing `screenCellCenter(toScreenCell(side, placement))` transform (do not reinvent lane mapping — AD-11).
Draft/Placement/Reveal render the **idle** representation. Animated attack/hurt/death playback is Story 2.2's Battle scene — do NOT build combat animation here.

**AC6 — Element badge: consistent, reconciled, never encodes side (FR3).**
Element stays a **single 12 px solid filled dot**, rendered **identically in every scene** (Draft, Placement, Reveal, and Battle when 2.2 lands). `ELEMENT_COLORS` in `apps/web/src/config/constants.ts:135` is **reconciled to the UX-authoritative hexes** — one source, applied everywhere:

| element | current | → set to (DESIGN.md) |
|---|---|---|
| fire | `0xc0563a` | `0xd1603b` |
| water | `0x3a76c0` | `0x3f78c2` |
| wind | `0x6ab08a` | `0x6bae8c` |
| earth | `0xa98a52` | `0xb0904f` |

Element is **never** expressed as a card border or HP-bar fill (those are side-coded blue-you / red-enemy). Side identity remains the unit-card border/tint.

**AC7 — Player side reconciled green→blue (side semantics only; FR7, AD-11).**
DESIGN.md's load-bearing rule is *"blue = you, red = enemy, everywhere"* with an explicit Don't: *"never use green-for-player… ship the legacy green-player palette."* The player side (side A) flips from the legacy green family to blue. **Critical decoupling:** the current green in `PALETTE` is conflated between *player-side identity* and *enabled-button UI accent*. Only the **side meaning** flips to blue:
- Flip to blue: `playerText`, `hpBarPlayer`, `winText`, and add a `playerLine`/`playerStroke` blue constant for RevealScene's side-A stroke (currently it borrows `buttonStrokeEnabled` — decouple it). The Draft/Placement/Reveal unit-card border/wash + name tint read blue.
- Leave green (for now): `buttonFillEnabled` / `buttonStrokeEnabled` as the **enabled-button** accent — DESIGN wants these gold, but button theming is deferred (below). Don't turn buttons blue.
- Use the blue that reads on the current dark ground (the build is ≈Night Tactics): **`#4a8fe0`** (`blue-you-night`). Use `#2f5fb0` only if a lighter ground is later adopted.
- Enemy red already matches (`enemyLine`/`enemyText`) — leave it.
Because colors live in one `PALETTE` (constants.ts), flipping these constants propagates consistently to every scene at once (including the Battle/Result placeholders 2.1 doesn't touch) — no transient green/blue split.
**Deferred (NOT this story), logged to `deferred-work.md`:** the full Heritage/Night two-theme system, gold button/frame accents, parchment grounds, and the bundled blackletter title font.

**AC8 — Quality gate green + on-device sign-off.**
`pnpm -r typecheck`, `pnpm lint` (ESLint + Prettier `--check`, 2-space, printWidth 160), `pnpm coverage` (engine `lines ≥ 90`), and `pnpm --filter web build` all pass. Any new *pure* logic (class→atlas/animation key mapping, manifest shape validation, element→tint) has a unit test in `apps/web/test/`; scene rendering itself stays untested (house convention). **Final acceptance is Danilo reading it on his own Android phone** — sprites legible, elements distinguishable, classes distinct at arm's length. Schedule the on-device pause before marking done.

## Tasks / Subtasks

- [x] **Task 1 — Select redistribution-safe sprite pack(s) (AC1)**
  - [x] Survey Kenney / OpenGameArt / itch.io for CC0 or CC-BY (redistribution-permitted) pixel-art with clearly-readable fantasy archetypes covering all 6 classes as single-angle billboards. **Prefer CC0** (Kenney) — it trivially satisfies "permits redistribution" and needs no share-alike propagation. Reject anything NC/ND or "no redistribution".
  - [x] Confirm each of the 6 classes maps to a distinct, recognizable sprite (tank/knight, sellsword/mercenary, bow/archer, caster/mage, staff-healer/cleric, hooded-spellcaster/witch). One pack covering all six is ideal; if mixing packs, track each in the manifest.
  - [x] Decide the animation approach per the pack: if the pack ships frames → frame animations; if static (common for Kenney) → **tween-based** idle(bob) / attack(lunge) / hurt(shake+flash) / death(fade+topple). FR31 allows either.
  - [x] **Acquisition path (DECIDED): dev fetches CC0 via CLI.** Download a known **CC0** pack from a stable direct URL (`curl`/`wget`) — Kenney Tiny Dungeon / Tiny Creatures are the lead candidates (`https://kenney.nl/assets/...` or the itch.io direct-zip). **Constrain the choice to CC0** (not just any redistribution-permitting license) so acquisition needs no human license judgment and no attribution/share-alike obligation is missed. Verify the bundled `License.txt`/CC0 text before committing; if no clean CC0 pack covers all 6 archetypes distinctly, STOP and flag Danilo rather than settling for a non-CC0 or poorly-distinct pack. Do not proceed to packing until the raw assets are on disk and their CC0 license text is verified and committed.
- [x] **Task 2 — Author the attribution manifest (AC2, FR31)**
  - [x] Create the manifest alongside the assets (e.g. `apps/web/src/assets/attribution.jsonc` or `attribution.ts`). Structure per pack: `{ pack, author, url, license, licenseUrl, classes: [...] }`. Make it importable/renderable by the future Credits scene (Story 2.4).
  - [x] Handle the Prettier gotcha (Dev Notes §"Lint gotcha") — use `.jsonc`, or a typed `.ts` module, or add a `.json` path to `.prettierignore`.
- [x] **Task 3 — Establish the asset pipeline & atlas (AC3)**
  - [x] Pack sprites into a texture atlas. **Do NOT add a native-postinstall packer as a workspace dependency** (breaks CI `--frozen-lockfile` via `allowBuilds`; see Dev Notes §"allowBuilds trap"). Pack offline and check in the atlas output, or use a pure-JS/no-native-build packer run as a one-shot script. Phaser 4 supports the compact **PCT** atlas format as well as classic JSON atlases (Dev Notes §"Phaser 4 atlas").
  - [x] Place atlas + source assets under `apps/web/src/assets/` (spine-declared home) — or `apps/web/public/assets/` if loading via plain URL. Pick one, document it.
  - [x] Run `pnpm --filter web build`, inspect `apps/web/dist`, record compressed total. Confirm ≤ 3 MB.
- [x] **Task 4 — Boot/Preload scene + pixel-art config (AC4)**
  - [x] Add a `BootScene` (or `PreloadScene`) that `this.load.atlas(...)`/`load.spritesheet(...)` the assets and defines animations, then starts `HomeScene`. Insert it first in the `scene:` array (`main.ts:32`).
  - [x] Enable pixel-art in the `Game` config (`pixelArt: true` and/or `roundPixels`). Verify against `crispText` — text must stay sharp (Dev Notes §"pixelArt vs crispText"). _On-device check FAILED with global `pixelArt: true` (Danilo: text "bad and difficult to read", `?textres=4` no help) — applied the documented fallback: flag removed, NEAREST set on the units TEXTURE alone in BootScene. Sprites stay pixel-crisp; text returns to the 2.0-accepted LINEAR path._
  - [x] Reuse the existing `showInitFallback` backstop — a throwing `preload()`/`create()` must still surface the fallback, not a blank page.
- [x] **Task 5 — Create the shared class→sprite lookup (AC5)**
  - [x] Add a pure, typed lookup module (e.g. `apps/web/src/config/sprites.ts`) keyed `Record<UnitClass, …>` giving atlas key / idle frame / animation keys per class. Keyed by the engine union so a missing class is a compile error (mirror `CLASS_ABBREVIATIONS`/`ELEMENT_COLORS`). Unit-test it in `apps/web/test/`.
- [x] **Task 6 — Swap placeholders in the three scenes (AC5, AC6)**
  - [x] `DraftScene`: replace the class-card rectangle glyph and the army-tray glyph with sprites; keep the class name/code and the element dot.
  - [x] `PlacementScene`: replace the `body` rectangle with a sprite *inside the existing draggable container*; keep `setSize(72,60)`, `setInteractive`, `setDraggable`, `getData('unitIndex')`. Verify drag → drop → occupied-cell swap still works. _Verified headlessly: puppeteer drag of all 3 units onto cells + Ready → Reveal._
  - [x] `RevealScene`: replace the rectangle in `drawUnit` with a sprite at the same `screenCellCenter(...)` position; keep side tint (A vs B) and the element dot (normalized to the shared 12px dot per AC6).
  - [x] Sprites created/destroyed within the existing destroy-and-rebuild-on-`redraw` lifecycle (`dynamic[]` pattern) — no leaked game objects across redraws.
- [x] **Task 7 — Reconcile colors: element hexes + player side green→blue (AC6, AC7)**
  - [x] Update the four `ELEMENT_COLORS` values in `constants.ts:135` to the DESIGN.md hexes (table in AC6). One source; all scenes read from it already.
  - [x] Flip player-side identity to blue (`#4a8fe0`): `playerText`, `hpBarPlayer`, `winText`; add a blue `playerLine`/`playerStroke` and switch RevealScene's side-A stroke to it (decouple from `buttonStrokeEnabled`). Leave `buttonFillEnabled`/`buttonStrokeEnabled` green (button theming deferred). Verify enemy red untouched. See AC7 for the decoupling rationale. _Also decoupled the same borrowed `buttonStrokeEnabled` in BattleScene's side-A stroke (color constant only — AC7's "no transient green/blue split")._
  - [x] Add the deferral note (two-theme system, gold accents, parchment grounds, blackletter font) to `docs/implementation-artifacts/deferred-work.md`.
- [x] **Task 8 — Do not regress Battle (AC8, regression guard)**
  - [x] `BattleScene` is OUT of this story's render scope (Story 2.2 animates it). Confirm the new Boot scene + pixelArt config + reconciled colors do NOT break the current Battle placeholder rendering. Battle may keep rectangles for now. _Verified headlessly: full flow into Battle, engagement passes advance, HP bars deplete, side-A cards read blue._
- [x] **Task 9 — Quality gate + on-device acceptance (AC8)**
  - [x] `pnpm -r typecheck && pnpm lint && pnpm coverage && pnpm --filter web build` all green.
  - [x] On-device sign-off with Danilo on a real Android phone before status → review. _Danilo on device: "it works, i like the changes… sprites looks good" — sprites legible, classes distinct, elements distinguishable ✓. Text softness raised → diagnosed as the PRE-EXISTING 360px-backing-store ceiling (Danilo's own prod comparison: "both read the same" → zero 2.1 regression; AC4/AC8's regression bar met). Reopened with full measured diagnosis in deferred-work.md._

### Review Findings (code review 2026-07-13)

_3 review layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor), full mode against this spec. Severities re-rated for real reachability (the spritesheet ships INLINED as a data-URI in the JS bundle, so the load-failure path fails only if the whole bundle fails). 4 patch, 1 defer, 2 dismissed._

- [x] [Review][Patch] BootScene boots the game even after a load error [apps/web/src/scenes/BootScene.ts:27] — `create()` runs unconditionally after `loaderror`; the fallback message shows AND Home starts, so a failed sheet yields "failed to start" text beside a running game full of missing-texture placeholders. The file comment promises the opposite. Reachability LOW (sheet is inlined), fix is a 3-line guard. (blind+edge) _FIXED: `loadFailed` flag set in the loaderror handler; `create()` early-returns; class comment corrected (incl. the stale "content-hashed URL" claim — the sheet is data-URI-inlined)._
- [x] [Review][Patch] Sheet frame-count never validated post-load [apps/web/src/scenes/BootScene.ts:24] — a wrong-sized `units.png` loads with NO `loaderror` (so the fallback never fires) and slices a wrong frame count; classes then silently render duplicate/wrong sprites. Assert `frameTotal - 1 === ALL_CLASSES.length` after load. (Pixel *ordering* inside the PNG stays a human/visual check — can't decode in node; done on-device.) (edge) _FIXED: create() validates the slice against ALL_CLASSES.length and routes to the fallback on mismatch; verified no false-trip on the real sheet (game boots, sprites render)._
- [x] [Review][Patch] Attribution license gate doesn't assert `assets` non-empty [apps/web/test/attribution.test.ts] — a pack with `assets: []` passes the "FR31 gate". Add the assertion. NOTE: license *classification* (CC0 provenance of the DCSS tiles) is a human/legal judgment for a public repo in a regulated context — a passing test is not legal validation. (blind) _FIXED: assertion added with a rationale comment._
- [x] [Review][Patch] Misleading comments in changed code [apps/web/src/config/sprites.ts, apps/web/src/scenes/RevealScene.ts] — sprites.ts says the idle bob is what Draft/Placement/Reveal "show" but no scene plays the tween (static frame; AC5 is still met by a static idle). RevealScene says the element-word is dropped "exactly as in Battle/History" but Battle still shows the word. Correct both to match reality. (auditor + blind) _FIXED: both comments now state the actual behavior (static idle frame; Reveal first to adopt the dot-only card, rest deferred)._
- [x] [Review][Defer] Element-word not normalized to DESIGN dot-only compact card [apps/web/src/scenes/{Draft,Placement,Reveal}Scene.ts] — shown in Draft tray + Placement + Battle, dropped in Reveal; DESIGN's compact unit-card is code + dot only. Deferred: normalizing now makes Draft/Placement/Reveal consistent but leaves Battle (out of 2.1 scope) inconsistent — the right time is when Battle's/History's card is (re)built in 2.2 / epic 3. Danilo approved the current screens on-device (words aid first-time legibility on the roomy cards). (blind)

Dismissed (2): setFilter/setDisplaySize no-op on the `__MISSING` texture (subsumed by the BootScene guard patch); Draft picker sprites not tracked in `this.dynamic` (correct today — built once in `create()`, cleared on scene shutdown, never rebuilt in redraw; no real leak).

## Dev Notes

### The governing constraint: procedural heritage, zero custom art
The UX north star is **Ogre Battle 64 reconstructed with zero drawn assets**: ornate gold-framed panels + a tilted isometric checkerboard board (pure geometry) + **flat single-angle billboard unit sprites** — "exactly what free/CC packs ship." The creator is not an artist and will not commission one — this is a **hard constraint**, not a preference. Do not select art that needs multi-angle sprites, and do not design around bespoke artwork. [Source: DESIGN.md#Brand & Style; DESIGN.md#Do's and Don'ts]

### Camera coordination (why single-angle is enough)
The isometric look is resolved to live in the **board geometry**, not the units — units are front/three-quarter billboards. The formal side-on-vs-isometric **camera ADR is Story 2.2's deliverable**, but 2.1's pack choice must supply the single angle 2.2 will need. Pick accordingly; you do not write the ADR here. [Source: DESIGN.md#Components; epics.md#Story 2.2 line 420; architecture .memlog camera decision]

### Class / element model (how many distinct assets)
Owned by the engine (AD-4), imported via `@lordly/engine`. Never redeclare these.
- **6 classes** — `ALL_CLASSES` [packages/engine/src/types.ts:16]: `knight, mercenary, archer, mage, cleric, witch`. → 6 distinct sprites, each with idle/attack-cast/hurt/death representations.
- **4 elements** — `ALL_ELEMENTS` [types.ts:26]: `fire, water, wind, earth`. Cosmetic for all classes except Witch (whose spell keys off element — FR16). → element is a **tint/badge overlay**, NOT 24 distinct sprites.
- Scenes render from `UnitSnapshot` (`id, side, class, element, placement, hp, maxHp`) [types.ts:123]. Unit identity is `side:index` (e.g. `A:0`) assigned by the engine; **sprites are a shell-side lookup keyed off `class`** (AD-11). [Source: ARCHITECTURE-SPINE.md#Invariants AD-11]

### Exact current placeholder code to replace
All in `apps/web/src/scenes/`. Units are colored rectangles + text today; there are **no images anywhere** in the codebase yet.
- **DraftScene** `buildCard` lines 78–87: `this.add.rectangle(… PALETTE.unitFill).setStrokeStyle(1, PALETTE.unitStroke)` (26px) + class initial in Arial Black 15px. The comment at 76–77 literally reads *"Sprite placeholder (FR2 / story 2.1 replaces with real art)"* — that's this task. Army-tray glyph in `redraw` lines 130–145: slot rect + `ELEMENT_COLORS` badge + `CLASS_ABBREVIATIONS` at `CARD_CLASS_FONT_PX` (13px).
- **PlacementScene** `redraw` lines 123–140: a `Container` of `rectangle(72×60, unitFill)` + `crispText` name (`CLASS_ABBREVIATIONS`) + element text + `rectangle(12×12, ELEMENT_COLORS[element])` badge. Container gets `setSize(72,60)`, `setData('unitIndex', i)`, `setInteractive`, `setDraggable`. Drag/drop handlers at 85–99. **Preserve the container contract.**
- **RevealScene** `drawUnit` lines 80–90: `rectangle(48×40, unitFill)` at `screenCellCenter(toScreenCell(unit.side, unit.placement))`, side-tinted stroke (`buttonStrokeEnabled` for A, `enemyLine` for B), `CLASS_ABBREVIATIONS` + element word + 8px `ELEMENT_COLORS` badge.
- **BattleScene** `buildUnit` lines 102–124 (same placeholder + HP bar) — **out of scope**, Story 2.2. Don't regress it.

### Shared visual encodings that already exist (reuse, don't reinvent)
- `CLASS_ABBREVIATIONS: Record<UnitClass,string>` [constants.ts:64] — KNI/MER/ARC/MAG/CLE/WIT, 13px. Keep the code alongside the sprite; 2.0 established the word is secondary once sprites land.
- `ELEMENT_COLORS: Record<Element,number>` [constants.ts:135] — the element dot color source. Reconcile per AC6.
- `PALETTE` [constants.ts:13] — all side/HP/UI colors.
- `crispText(scene,x,y,text,style)` [config/ui.ts:47] — the ONLY text factory; never bypass it (Story 2.0 blur fix).
- `battleView.toScreenCell` / `screenCellCenter` [apps/web/src/flow/battleView.ts] — the pure lane-mirror transform over `BATTLE_BOARD` geometry [constants.ts:124]. Reveal/Battle project through it. AD-11: mirroring is renderer-only presentation math — do not push it into data.

### Element badge rule (FR3) — non-negotiable
Element = one **solid dot, 12px, radius full**, **identical in Draft/Placement/Reveal/Battle/History**. Colors are shared across both UX themes (Heritage + Night). Element **never** becomes a card border or HP fill — those are side-coded (blue-you / red-enemy). [Source: DESIGN.md#Components element-badge; DESIGN.md#Colors; DESIGN.md#Do's and Don'ts]

### Attribution manifest & the license bar (FR31)
Repo is **public** and this is a Raketech (regulated) context — license hygiene has weight. Only redistribution-permitting licenses are allowed; **CC0 is safest** (no attribution or share-alike obligation, though we still credit). CC-BY is fine (credit required — the manifest + Credits scene satisfy it). Reject CC-BY-NC, -ND, and "no redistribution" packs. The manifest is the FR31-critical deliverable of this story; the **Credits scene that renders it is Story 2.4** (do not build the scene here — record the data). [Source: epics.md#Story 2.1 line 397, #Story 2.4 line 468; ARCHITECTURE-SPINE.md#Structural Seed line 182]

### Camera/pack/font: what this story does and does NOT own
- **Owns:** pack selection, atlas pipeline, manifest, Boot scene, pixelArt config, sprite swap in 3 scenes, element-hex reconcile.
- **Does NOT own:** the camera ADR (2.2), the animated Battle scene (2.2), the Credits scene (2.4), the full two-theme (Heritage/Night) palette system, and the bundled blackletter title font (paired with this decision but a separate track — see open decisions). Keep scope tight; log any new product wishes to `docs/implementation-artifacts/deferred-work.md` rather than self-scoping.

### Testing standards
- Vitest 4; `apps/web` tests live in `apps/web/test/` and **never boot Phaser** — they test pure modules (`flow/*`, `config/*`). Scenes are intentionally untested thin renderers. Push any testable logic (class→atlas/anim key, manifest validation, element→tint) into a pure module and test that. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions "Tests" row; existing apps/web/test/*]
- Engine coverage gate: `packages/engine/** lines ≥ 90`. No coverage threshold on `apps/web` — but new pure helpers should still get a test (house habit; epic-1 retro "untested-claims" finding).
- **Empirical over reasoned** (house rule): measure the bundle, don't estimate it; drive the three scenes and see the sprites, don't assert from code.

### pixelArt vs crispText (verify, don't assume)
Story 2.0's blur fix set text resolution to `min(8, max(TEXT_RESOLUTION=3, fitZoom×devicePixelRatio))`, memoized on first `crispText` call [config/ui.ts:25–39]. Enabling `pixelArt: true` sets nearest-neighbor filtering globally, which is what retro sprites want but can interact with text rendering. After enabling it, **look at the labels on a real device** — if text softens, prefer per-texture nearest filtering on the sprite atlas over a global flag, or reconcile the two. This is exactly the class of bug 2.0 fought; don't reintroduce it.

### Lint gotcha (will fail CI if missed)
`pnpm lint` = `eslint . && prettier --check .` (2-space, printWidth 160). `.prettierignore` ignores `**/*.md, **/*.html, **/*.css, **/*.yml/.yaml, **/*.jsonc, docs, …` — but **NOT `**/*.json`**. A `.json` attribution manifest WILL be Prettier-checked and can fail CI. Use `.jsonc`, a typed `.ts` module, or add the specific `.json` path to `.prettierignore`. [Source: /.prettierignore; /package.json scripts]

### allowBuilds trap (will fail CI if missed)
`pnpm-workspace.yaml` has a hand-maintained `allowBuilds` allowlist (`esbuild, sharp, workerd`). Adding a dependency with a **native postinstall build** (many atlas packers) that isn't on the list hard-fails CI's `--frozen-lockfile` install with `ERR_PNPM_IGNORED_BUILDS`. **Prefer packing atlases offline and checking in the output**, or a pure-JS packer with no native build. [Source: /pnpm-workspace.yaml; deferred-work.md]

### File structure & boundaries (MUST follow)
- All sprite/atlas/loading code is **shell** → `apps/web` only. The engine (`packages/engine`) imports nothing from `apps/*` and must never see Phaser or an asset API — enforced by ESLint (`eslint.config.mjs:43–51`) AND `packages/engine/test/purity.test.ts`. Putting asset code in the engine turns CI red. [Source: ARCHITECTURE-SPINE.md#Design Paradigm, AD-3]
- Assets under `apps/web/src/assets/` (spine seed) or `apps/web/public/assets/` (plain-URL serving). Constants/metrics (sprite dims, atlas keys, frame names) live in `src/config/`, not inline in scenes (established pattern).
- `apps/web` tsconfig is strict: `noUncheckedIndexedAccess` (use `Record<UnitClass,…>`-typed maps for compile-time exhaustiveness), `noUnusedLocals/Parameters`. `strictPropertyInitialization:false` is intentional for Phaser scene fields.

### Latest tech (verified July 2026)
- **Phaser `^4.2.1`** (installed; `apps/web/package.json`). Phaser 4 keeps `this.load.atlas(key, textureURL, atlasURL)`, `this.load.spritesheet(key, url, {frameWidth,frameHeight})`, `this.anims.create(...)` with `generateFrameNames`/`generateFrameNumbers`, and `sprite.play(animKey)` — same surface as Phaser 3 for these. Phaser 4 adds the **PCT (Phaser Compact Texture)** atlas format: ~90–95% smaller descriptor than JSON atlases — worth using for the ≤3 MB budget. [Phaser 4 release notes / phaser.io news]
- Pixel-art: `pixelArt: true` in the `Game` config (equivalent to `render:{pixelArt:true}` — nearest-neighbor + `roundPixels`). [Phaser docs]
- **Kenney Tiny Dungeon** (and **Tiny Creatures** expansion) are **CC0 1.0** — free for any use, redistribution allowed, attribution appreciated not required. A viable license-clean candidate (fantasy pixel characters, tilesheet + separate sprites). Note: Kenney sprites are largely **single-frame** → plan tween-based animation. Evaluate against the archetype-distinctness bar for all 6 classes before committing. [kenney.nl / itch.io; verify license text at download time]
- Vite `^8.1.4`, base `./`; TypeScript `~5.9.3` (pinned — never bare-install); Node 24; pnpm `11.12.0`; Vitest `^4.1.10`. `vite-plugin-pwa ^1.3.0` is installed but NOT wired into any config yet (asset precaching is a later concern — do not depend on it here).

### Project Structure Notes
- No `apps/web/src/assets/` dir exists yet — this story creates it (or `public/assets/`). No Boot/Preload scene and no `preload()` anywhere yet — this story introduces the loading path (insert first in `main.ts:32`).
- `docs/adr/` does not exist. A load-bearing choice (atlas format/packer, asset-load location) warrants an ADR per the spine's "one ADR per load-bearing choice" convention — a short ADR here is reasonable, but the formal camera ADR is Story 2.2.
- No bundle-size CI gate exists (deliberately deferred). Adding one is optional; the ≤3 MB budget is checked at review. If you add a gate, keep it out of the critical path unless the budget is actually threatened.
- Palette scope (DECIDED): this story does the **element-hex reconcile (AC6)** AND the **player-side green→blue reconcile (AC7)** — because DESIGN.md assigns "blue = you" to the badge/sprite pass and lists shipping green-for-player as an explicit Don't, and 2.1 rebuilds the exact scenes (Draft/Placement/Reveal) where side identity reads. Scoped to **side semantics only** (decouple from the button accent — see AC7). **Deferred to a dedicated theming story:** the full Heritage/Night two-theme system, gold button/frame accents, parchment grounds, and the bundled blackletter title font — log in `deferred-work.md`.

### References
- [Source: docs/planning-artifacts/epics.md#Story 2.1] — user story + BDD acceptance criteria (lines 386–402).
- [Source: docs/planning-artifacts/epics.md#Story 2.2 / 2.4] — camera ADR (2.2), Credits scene (2.4) — scope boundaries.
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md] — FR3 (element badge), FR15 (class table), FR16 (witch/element), FR31 (CC assets + attribution), FR30 (portrait), NFR1 (perf/bundle), NFR2 (engine coverage).
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md] — AD-2 (log-driven render), AD-3 (dep direction / engine purity), AD-4 (engine owns domain types), AD-5 (scene FSM), AD-11 (owner-local coords, sprites are shell-side lookups), AD-12 (BattleLog event union); Stack table; Structural Seed (`src/assets/`); Consistency Conventions (perf budget, tests, ADR rule); Deferred (pack selection, bundle tooling).
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md] — Brand & Style (procedural heritage, zero custom art), Components (element-badge 12px dot, unit-card border), Colors (element hexes, side-color rule), Typography, Do's/Don'ts.
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md] — Draft/Placement/Reveal layouts, iso-board component pattern, accessibility floor.
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/imports/OB64 references/] — image2/3 (class-sprite rosters = billboard target look), image4/8 (two-board tile coding), image1 (blackletter logo).
- Code: `apps/web/src/main.ts:22` (Game config), `apps/web/src/config/constants.ts` (PALETTE, ELEMENT_COLORS:135, CLASS_ABBREVIATIONS:64), `apps/web/src/config/ui.ts:47` (crispText), `apps/web/src/flow/battleView.ts` (lane transform), `apps/web/src/scenes/{Draft,Placement,Reveal}Scene.ts` (placeholders), `packages/engine/src/types.ts:16,26,123` (classes/elements/UnitSnapshot).
- Prior stories: `docs/implementation-artifacts/2-0-pre-epic-2-tech-debt.md` (crispText, lint gate, accessibility floor), `1-8-...md` (Draft/Placement, thin-renderer pattern), `1-9-...md` (Reveal/battleView), `deferred-work.md` (allowBuilds, resize-resolution), `epic-1-retro-2026-07-13.md` (empirical-over-reasoned).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8[1m]) via Claude Code

### Implementation Plan

1. **Pack selection (empirical, per house rule):** downloaded and visually inspected three CC0 candidates. **Kenney Tiny Dungeon** (CC0 verified in bundled License.txt) — rejected: strong knight/mage but no distinct cleric or witch (one caster in the pack; princess-as-witch fails the at-a-glance bar). **Kenney Roguelike Characters** (CC0) — viable via paper-doll compositing but caster distinctness would lean on color alone at 16px, plus a compositing pipeline. **Dungeon Crawl Stone Soup 32×32 tiles** (CC0 1.0, OpenGameArt `crawl-tiles Oct-5-2010.zip`) — selected: ready-made distinct humanoid archetypes at native 32px (2.2's ≥32px floor at ×1, no upscaling), single-angle billboards, detail level closest to the OB64 reference sprites.
2. **Atlas:** 6 tiles composed into one 192×32 spritesheet (`ffmpeg hstack`, offline — nothing enters CI; checked-in output) in `ALL_CLASSES` order. Uniform 32px frames → `load.spritesheet` needs no descriptor file at all (simpler than JSON/PCT atlases at this scale).
3. **Pipeline:** Vite-imported from `src/assets/` (spine seed) — at 3,923 B the PNG lands under Vite's 4 KB `assetsInlineLimit` and ships inlined as a base64 data-URI inside the JS bundle (verified in dist; Phaser's loader accepts data-URIs). Zero extra requests; revisit the inline limit only if the sheet ever grows past 4 KB.
4. **TDD:** failing tests first for `config/sprites.ts` (frame lookup completeness/uniqueness/bounds, FR31 representations) and `assets/attribution.ts` (record completeness, license ∈ redistributable allowlist — the FR31 gate as an executable test, per-class source traceability); then implementations to green.
5. **Scenes:** shared `addUnitSprite` + `addElementBadge` helpers in `config/ui.ts` (one source, no per-scene drift), then the three scene swaps + BootScene + `pixelArt: true`, then the palette reconcile.

### Sprite roster (all CC0, Dungeon Crawl Stone Soup tiles)

| class | source tile | reads as |
|---|---|---|
| knight | `dc-mon/vault_guard.png` | silver full plate + horned helm + cape |
| mercenary | `dc-mon/deep_elf_fighter.png` | leather + sword + gear, rugged sellsword |
| archer | `dc-mon/deep_elf_master_archer.png` | green hood, bow drawn |
| mage | `dc-mon/wizard.png` | purple robe + wide-brim hat + staff |
| cleric | `dc-mon/deep_elf_high_priest.png` | ornate blue-gold vestments + staff |
| witch | `dc-mon/unique/psyche.png` | pink-robed spellcaster + orb staff |

### Debug Log References

- RED run: both new test files fail on missing modules (expected), then 9/9 green after implementation.
- One Prettier violation (DraftScene import block) auto-fixed with `--write`; lint green after.
- ffmpeg emits "Invalid PNG signature 0x49454E44" warnings on the 2010-era DCSS tiles (trailing data after IEND); first frames decode correctly — composed sheet visually verified at 6× before commit.
- Headless Chrome + puppeteer-core (scratchpad-only tooling, NOT a repo dependency) drove the full flow twice: Home → Draft (3 drafts) → Continue → Placement (3 drags) → Ready → Reveal → Fight → Battle passes 1–2. Zero pageerrors; screenshots confirm sprites, blue/red side coding, and consistent element dots in all three scenes, and Battle placeholder rendering unregressed.
- **On-device iteration (Danilo's phone):** sprites and side coding approved on first pass, but global `pixelArt: true` made text "bad and difficult to read" — `?textres=4` couldn't fix it (nearest-neighbor's fractional-phase sampling of the supersampled glyph textures is resolution-independent). Fix: removed the global flag; `BootScene.create()` now sets `Textures.FilterMode.NEAREST` on the units texture only. Full gate re-run green; flow re-driven headlessly clean. Awaiting Danilo's re-check.

### Completion Notes List

- **AC1 ✅** 6 visually distinct CC0 archetype sprites, single-angle billboards, zero custom art. Kenney lead candidates were *evaluated and rejected on the distinctness bar* (License.txt verified before rejection); DCSS tiles chosen instead — same CC0 cleanliness, better archetypes. Idle/attack/hurt/death ship as shared tween recipes (`UNIT_TWEENS`) — FR31's "frame animation or tween-based", tween chosen because the tiles are single-frame.
- **AC2 ✅** `apps/web/src/assets/attribution.ts` — typed, importable by the 2.4 Credits scene, readable in-repo, Prettier-clean (it's code, sidestepping the `.json` lint gotcha). The redistribution gate is an executable test.
- **AC3 ✅** Measured (not estimated): **total dist compressed = 371,440 B ≈ 0.35 MB ≤ 3 MB** (gzip of every dist file; sheet inlined as data-URI, 3,923 B raw). Baseline before story ≈ 365 KB — the entire art payload cost ~6 KB.
- **AC4 ✅** `BootScene` first in the FSM loads the sheet before any unit-rendering scene; loader errors route to `showInitFallback` (no silent blank page). Pixel-art rendering: global `pixelArt: true` was tried first and **failed the on-device text check** (the exact interaction the story flagged) — replaced with per-texture NEAREST on the units sheet in BootScene (the documented fallback). Nearest-neighbor is scoped to the sprites; `crispText` labels keep the device-accepted 2.0 rendering path. Rationale comment lives in main.ts.
- **AC5 ✅** All three scenes render real sprites at 32px (×1 integer scale). Placement drag contract untouched (sprite swapped inside the container; drag/drop/swap verified headlessly). Reveal keeps `screenCellCenter(toScreenCell(...))`. Idle representation only — no combat animation built.
- **AC6 ✅** Element badge normalized to ONE 12px solid dot via shared `addElementBadge` in Draft/Placement/Reveal (was 16/12/8px rectangles); hexes reconciled to DESIGN values in the single `ELEMENT_COLORS` source. Reveal's redundant element *word* dropped per DESIGN's compact unit-card (code + dot). Battle (8px square) and Result (10px square) badges get the new hexes automatically; their shape normalization is logged in deferred-work.md for stories 2.2/2.3.
- **AC7 ✅** Side A is blue (`#4a8fe0`) everywhere side identity appears: `playerText`/`playerLine`(new)/`hpBarPlayer`/`winText`; Reveal AND Battle side-A strokes decoupled from `buttonStrokeEnabled` (Battle change is a color constant only — its rendering is untouched, story 2.2's scope). Buttons stay green (theming deferred, logged). Enemy red untouched. Unit-cards in Draft/Placement/Reveal now carry the DESIGN side-border + ~15% wash treatment.
- **AC8 ✅** typecheck/lint/coverage(239 tests, engine 99.7% lines)/build all green. On-device sign-off complete: sprites approved ("i like the changes… sprites looks good"). Text: two device iterations — global `pixelArt: true` failed (ragged text) → per-texture NEAREST fallback applied; remaining softness then **measured to be the pre-existing 360×640 canvas-backing ceiling** (headless probe at DPR 3: backing stays 360 while CSS scales ~×3.5; Danilo's prod-vs-dev comparison confirmed identical text → no 2.1 regression). Reopened as a first-class deferred item with the full diagnosis and candidate fixes (DPR backing + camera zoom / 720-grid redesign / DOM overlay, all needing NFR1 perf verification).
- Scope discipline: Credits scene NOT built (2.4), camera ADR NOT written (2.2), Battle rendering NOT touched beyond the AC7 color constant, no bundle-size CI gate added (budget at 12% utilization).

### File List

- `apps/web/src/assets/units.png` — NEW: 192×32 spritesheet, 6× 32×32 CC0 sprites in ALL_CLASSES order
- `apps/web/src/assets/attribution.ts` — NEW: FR31 attribution manifest (typed, Credits-scene-ready)
- `apps/web/src/config/sprites.ts` — NEW: sheet key/frame lookup (`Record<UnitClass, number>`) + FR31 tween recipes
- `apps/web/src/scenes/BootScene.ts` — NEW: first asset-loading path; loads sheet, hands off to Home, loader errors → init fallback
- `apps/web/src/main.ts` — MODIFIED: BootScene first in scene list; `pixelArt: true` (+ rationale comment)
- `apps/web/src/config/constants.ts` — MODIFIED: ELEMENT_COLORS → DESIGN hexes; player side → blue (`playerText`/`playerLine`/`hpBarPlayer`/`winText`); `ELEMENT_BADGE_RADIUS`
- `apps/web/src/config/ui.ts` — MODIFIED: `addElementBadge` + `addUnitSprite` shared helpers
- `apps/web/src/scenes/DraftScene.ts` — MODIFIED: card glyph + army-tray glyph → sprites; tray unit-cards blue border/wash; shared badge
- `apps/web/src/scenes/PlacementScene.ts` — MODIFIED: sprite inside draggable container (contract preserved); blue unit-card; shared badge
- `apps/web/src/scenes/RevealScene.ts` — MODIFIED: drawUnit → side-colored unit-card + sprite + code + shared badge; element word dropped
- `apps/web/src/scenes/BattleScene.ts` — MODIFIED: side-A stroke `buttonStrokeEnabled` → `playerLine` (AC7 decouple; nothing else)
- `apps/web/test/sprites.test.ts` — NEW: 5 tests (lookup completeness/uniqueness/bounds, FR31 representations, idle/death semantics)
- `apps/web/test/attribution.test.ts` — NEW: 4 tests (manifest presence/completeness, license gate, per-class traceability)
- `docs/implementation-artifacts/deferred-work.md` — MODIFIED: story-2.1 deferral section (two-theme system, gold accents, blackletter font, Battle/Result badge shape)
- `docs/implementation-artifacts/sprint-status.yaml` — MODIFIED: story 2-1 status tracking
- `docs/implementation-artifacts/2-1-real-units-sprite-packs-atlases-and-animations.md` — MODIFIED: this story file

### Change Log

- 2026-07-13: Story 2.1 implemented — CC0 DCSS sprite roster (6 classes), 192×32 spritesheet (offline ffmpeg pack, checked in), typed attribution manifest with executable license gate, BootScene + pixelArt config, sprite swap in Draft/Placement/Reveal with DESIGN unit-card treatment, element-badge normalization to shared 12px dot with reconciled hexes, player-side green→blue (side semantics only). Bundle measured 0.35 MB compressed (≤3 MB). 239 tests green; full flow verified headlessly. Pending: Danilo's on-device sign-off (AC8).
- 2026-07-13 (on-device iteration): sprites/side-coding approved; global `pixelArt: true` failed the text check on Danilo's device → replaced with per-texture NEAREST on the units sheet (BootScene), restoring the 2.0-accepted text path. Gate re-run green.
- 2026-07-13 (acceptance): AC8 signed off — sprites approved on device. Remaining text softness measured to the pre-existing 360px canvas-backing ceiling (prod-identical, DPR-invariant, textres-insensitive) — NOT a 2.1 regression; reopened in deferred-work.md with diagnosis + candidate fixes. Status → review.
- 2026-07-14 (code review): 3-layer adversarial review (Blind Hunter, Edge Case Hunter, Acceptance Auditor) — substantially compliant, all hard contracts verified. 4 patches applied (BootScene loaderror guard + frame-count validation, attribution assets assertion, 2 comment corrections), 1 deferred (element-word normalization → 2.2/epic-3 card passes), 2 dismissed. Gate re-run green (239 tests); boot path re-driven headlessly clean. Status → done.
```
