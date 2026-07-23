# Midjourney Asset Prompts — Lordly (2026-07-23)

Prompt pack for generating the game's art with Midjourney, by asset type. Owner: Danilo (runs MJ in parallel; nothing here blocks sprint work). Author: Amelia, from the Epic 5 scoping session.

**Style canon (Danilo's list):** Ogre Battle 64: Person of Lordly Caliber (primary), Ogre Battle: The March of the Black Queen, Tactics Ogre: Reborn, Final Fantasy Tactics, Unicorn Overlord, Octopath Traveler I/II, Symphony of War: The Nephilim Saga, Grand Knights History, Soul Nomad & the World Eaters, Triangle Strategy, Brigandine: The Legend of Runersia, Hoshigami: Ruining Blue Earth.

**Reference images (already in the repo, upload these to Midjourney and use their URLs):**
- `docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/imports/OB64 references/images/Nintendo 64 - Ogre Battle 64_ Person of Lordly Caliber - Miscellaneous - Organize Screen.png` — the unit-sprite style anchor (chibi proportions, dark outlines, saturated palettes)
- `…/Nintendo 64 - Ogre Battle 64_ Person of Lordly Caliber - Miscellaneous - Item Icons.png` — the icon style anchor (tiny, bold black outline, bright flat shading)

---

## 0. How to work (read once, applies to every section)

1. **Style consistency:** generate ONE image you love first (suggestion: the Knight sprite or a battle background). Then reuse it in every later prompt as a style reference: `--sref <URL-of-that-image> <URL-of-OB64-reference>`. You can stack 2–3 sref URLs. Keep `--sref` stable across a whole asset family — that is what makes 12 class sprites look like one game.
2. **No transparency in MJ.** Always ask for a **plain solid white background** (or flat magenta `#FF00FF` if the subject has white in it). We already have the keying pipeline from the Golem (`sharp` white-key → crop → downscale) — I do that part; you just deliver the raw PNGs.
3. **Parameters cheat-sheet:**
   - `--ar 1:1` sprites/icons/portraits · `--ar 9:16` phone backgrounds · `--ar 3:1` wordmark/logo strips
   - `--style raw` for UI, icons, and sprites (less MJ "beautification"); omit for backgrounds/portraits where painterliness helps
   - `--stylize 50` for icons/UI (obedient), `--stylize 250` for backgrounds/portraits (prettier)
   - `--no text, watermark, signature, frame, border` on everything (MJ loves adding fake UI text)
4. **Pixel-art reality check:** MJ cannot output true 32×32 pixel art. Two proven paths:
   - **Path A (the Golem path, recommended for sprites):** generate a clean high-res chibi on white → I downscale to 32×32 with NEAREST. Crisp silhouettes and flat shading survive; fine detail doesn't — so the prompts below ask for bold shapes.
   - **Path B (for icons):** "pixel art style" in the prompt gets the *look* at display size; we ship them at 2–3× logical size anyway, so faux-pixel is fine there.
5. **Delivery convention:** drop finished picks into a folder per section (`backgrounds/`, `sprites/`, `icons/`…), keep MJ's job URL or seed in the filename or a sidecar note if you can — we'll want it to regenerate matching variants later. Tell me when a batch is ready and I'll key/scale/wire them.
6. **Licensing note for the record:** Midjourney's paid plans grant you commercial usage rights of your generations. When assets land I'll update `attribution.ts`/Credits from the CC packs to your generated set (and we retire the DCSS entries the new art replaces).

**Reusable style suffix** — paste at the end of prompts where indicated:

> `in the style of 1990s Japanese tactical RPG concept art, Ogre Battle 64, Tactics Ogre, Final Fantasy Tactics, Unicorn Overlord, Octopath Traveler, painterly fantasy, medieval magic kingdom aesthetic`

---

## 1. Unit battle sprites (the roster — highest volume, do with `--sref` locked)

**Used at:** 32×32 board sprites (Path A downscale). One frame per class today; if a set comes out great we can talk poses later.
**Current roster (12):** Knight, Mercenary, Archer, Wizard, Cleric, Witch, Berserker, Phalanx, Ninja, Valkyrie, Sorceress, Golem — plus every class on your coming full-roster list (humans AND monsters), so generate with the template as the list firms up.

**Template** (swap the {…} parts):

```
chibi fantasy {class name}, {gender}, full body, standing idle pose facing slightly left,
{weapon and armor description}, {dominant color} color scheme,
super-deformed proportions, big head, bold dark outline, flat cel shading, simple bold shapes readable at small size,
single character centered on a plain solid white background, no shadow,
16-bit tactical JRPG unit sprite style, Ogre Battle 64 organize screen,
--ar 1:1 --style raw --stylize 50 --sref <organize-screen-URL> --no text, watermark, background scenery
```

**Filled examples:**

```
chibi fantasy knight, male, full body, standing idle pose facing slightly left,
longsword and kite shield, full plate armor with gold trim, royal blue color scheme,
super-deformed proportions, big head, bold dark outline, flat cel shading, simple bold shapes readable at small size,
single character centered on a plain solid white background, no shadow,
16-bit tactical JRPG unit sprite style, Ogre Battle 64 organize screen,
--ar 1:1 --style raw --stylize 50 --sref <organize-screen-URL> --no text, watermark, background scenery
```

```
chibi fantasy sorceress, female, full body, standing idle pose facing slightly left,
ornate staff with glowing crystal, elegant dark robes with arcane embroidery, violet and midnight blue color scheme,
super-deformed proportions, big head, bold dark outline, flat cel shading, simple bold shapes readable at small size,
single character centered on a plain solid white background, no shadow,
16-bit tactical JRPG unit sprite style, Ogre Battle 64 organize screen,
--ar 1:1 --style raw --stylize 50 --sref <organize-screen-URL> --no text, watermark, background scenery
```

**Monster variant** (Golem now; dragons/beasts when the full roster lands). Monsters loom 1.5× on the board, so they can carry a bit more mass:

```
chibi fantasy stone golem, hulking massive body, cracked rock skin with glowing runes, moss and earth tones,
super-deformed proportions, bold dark outline, flat cel shading, imposing wide silhouette,
single creature centered on a plain solid white background, no shadow,
16-bit tactical JRPG monster sprite style, Ogre Battle 64,
--ar 1:1 --style raw --stylize 50 --sref <organize-screen-URL> --no text, watermark, background scenery
```

**Side-color note:** don't bake team colors in — blue-you/red-enemy is a UI rule (tint/plate), not a sprite rule. Pick each class's *identity* palette freely.

---

## 2. Unit portraits (for the coming OB64 unit-data card)

**Used at:** the Placement unit-detail modal (Epic 5) — roughly 96–128px square at display. MJ's sweet spot; no downscale tricks needed.

```
fantasy tactical RPG character portrait, {class name}, {gender}, bust shot, three-quarter view,
{short face/armor description}, determined expression,
painted illustration, soft painterly shading, rich colors, dark simple background vignette,
1990s Japanese tactical RPG portrait art, Tactics Ogre, Ogre Battle 64 character portraits, Unicorn Overlord,
--ar 1:1 --stylize 250 --sref <chosen-style-anchor-URL> --no text, watermark, frame, border
```

Generate the full roster with the SAME `--sref` + similar seeds so the card gallery reads as one artist's work.

---

## 3. Battle backgrounds (the Epic 5 centerpiece)

**Used at:** full-canvas backdrop under the floating formation grids, portrait phone (360×640 logical). **Hard constraint from the UX spine:** white/gold unit labels, damage numbers, and the move plate must stay readable — so we want *muted, low-contrast midtones* with detail concentrated low, calmer upper two-thirds where the boards sit.

**Biome list to cover** (one great pick each; we'll rotate or match by mode later): grassy battlefield · rocky mountain pass · castle courtyard · ancient mystic ruins · snowy field · dark forest clearing.

```
fantasy battlefield landscape, {biome description}, viewed from slightly above,
open middle ground with gentle depth, distant mountains and sky on the horizon,
muted desaturated midtones, soft atmospheric haze, subdued painterly texture, no characters, no buildings in the center,
darker soft vignette at top and bottom edges, calm composition with low visual noise in the upper half,
HD-2D tactical JRPG battle backdrop, Octopath Traveler, Ogre Battle 64 battle scenes, Unicorn Overlord war maps,
--ar 9:16 --stylize 250 --no text, watermark, characters, creatures, UI
```

Filled biome example: `{biome description}` → `windswept green plains with scattered ancient standing stones, wildflowers in the foreground`.

**Acceptance test before you fall in love with one:** squint at it on your phone — if you can't imagine reading a small gold "Sword Slash ●○" plate over the middle of it, it's too busy. (I'll also put a translucent scrim behind labels if needed, but the art should meet us halfway.)

---

## 4. Home screen art + the "Lordly" logo

**Hero/menu background** (portrait, can be more dramatic than battle backdrops since no gameplay text sits on it):

```
epic fantasy kingdom vista at golden hour, castle on a distant hill, banners in the wind,
dramatic painted sky, rich warm light, sense of a grand campaign about to begin,
painterly key art, 1990s Japanese tactical RPG box art mood, Ogre Battle 64, Tactics Ogre, Triangle Strategy,
--ar 9:16 --stylize 400 --no text, watermark, characters in foreground, logo
```

**Wordmark** (MJ is bad at spelling — expect retries; alternatively generate the ornament only and I set the type):

```
ornate medieval fantasy game logo, the word "LORDLY" in elegant blackletter-inspired lettering,
gold metallic letters with dark outline, subtle crown ornament above, small flourishes,
clean vector-like rendering on a plain solid dark background, centered, symmetrical,
SNES tactical JRPG title screen logotype style,
--ar 3:1 --style raw --stylize 100 --no photorealism, watermark, extra words
```

Fallback that always works: `ornate gold crown and crossed-swords heraldic emblem, …same style lines… --ar 1:1` and we pair it with a real font (retiring the Georgia stand-in — the bundled display font is an old deferred wish this closes).

---

## 5. App icon (PWA)

**Used at:** 512×512, 192×192, and a maskable variant (keep the subject inside the central ~80% — safe zone for the round mask).

```
game app icon, ornate gold crown over a blue heraldic shield, dark navy background,
bold simple shapes, thick clean outlines, high contrast, readable at tiny size, centered composition with generous margins,
flat painted style, medieval fantasy tactical RPG,
--ar 1:1 --style raw --stylize 50 --no text, watermark, photorealism, fine detail
```

Generate once at high quality; I derive all three sizes + maskable from the single master.

---

## 6. UI chrome — buttons, panels, frames (the Heritage/Night theme dream)

**Used at:** button fills/strokes, panel frames, modal backgrounds. Today these are flat Phaser rectangles; the goal is 9-slice-able textures (corners + edges that tile). Ask for **flat, straight-on, symmetrical** renders — perspective kills 9-slicing.

**Ornate frame (gold, for panels/modals/unit card):**

```
ornamental rectangular frame for a fantasy game UI panel, gold filigree corners and slim engraved edges,
flat straight-on view, perfectly symmetrical, empty dark center, clean edges,
subtle medieval scrollwork, restrained elegant detail,
on a plain solid dark background, 16-bit tactical JRPG menu style, Ogre Battle 64 menus, Octopath Traveler UI,
--ar 3:2 --style raw --stylize 50 --sref <item-icons-URL> --no text, watermark, perspective, contents inside frame
```

**Button (generate the pair — enabled and pressed/disabled):**

```
fantasy game UI button, wide rounded rectangle, {variant},
flat straight-on view, symmetrical, clean bold border, empty center for label text,
medieval gold-and-parchment style, tactile beveled edge, subtle texture,
on a plain solid dark background, tactical JRPG menu style,
--ar 3:1 --style raw --stylize 50 --no text, watermark, icons, perspective
```

`{variant}`: `polished gold surface with warm highlight, engraved border` (enabled) · `desaturated stone-grey surface, flat, unlit` (disabled).

**Theme ground textures** (seamless-ish; I'll tile/blur as needed): `aged parchment paper texture, warm cream, subtle fibers, soft even lighting, flat, no writing` (Heritage) and `dark blue-grey stone texture, faint arcane runes barely visible, moody, flat, even` (Night). Both `--ar 1:1 --style raw --stylize 50 --no text, watermark, objects`.

---

## 7. Small icon set (status, elements, tactics, glyphs)

**Used at:** 12–24px on-screen — this is Path B (faux-pixel look, shipped bigger than logical size). Bold silhouette beats detail. Use the **item-icons sheet as `--sref`** for all of these. One template, many fills; batch 4 per grid and pick.

```
tiny game icon, {subject}, pixel art style, bold black outline, bright flat colors, minimal detail,
single icon centered on a plain solid white background, readable at very small size,
16-bit tactical JRPG inventory icon, Ogre Battle 64 item icons,
--ar 1:1 --style raw --stylize 50 --sref <item-icons-URL> --no text, watermark, multiple objects
```

**Fill list (the game's real vocabulary):**

| Family | `{subject}` fills |
|---|---|
| Status (4) | `purple sleeping Z cloud` · `green poison droplet with skull` · `cracked grey broken-sword (weaken)` · `dizzy yellow spiral stars (confusion)` |
| Elements (4) | `orange flame (fire)` · `blue water droplet wave (water)` · `pale green wind gust swirl (wind)` · `brown rock crag (earth)` |
| Tactics (4) | `crossed swords (autonomous)` · `gold crown in crosshair (attack leader)` · `flexed arm in crosshair (attack strongest)` · `cracked heart in crosshair (attack weakest)` |
| Damage type (2, for the unit card) | `steel sword blade (physical)` · `sparkling magic staff head (magic)` |
| Mode (2) | `single banner pennant (standard)` · `burning twin banners (wipeout)` |
| Leader & Guard | `small gold crown` · `round wooden shield with iron boss` |
| Controls (5) | `double-arrow fast-forward` · `skip-to-end arrow with bar` · `circular replay arrow` · `open scroll (history)` · `question-mark shield (help)` |

---

## 8. Item icons (future-proofing — no item system exists yet)

You found the OB64 item sheet; when items become a real feature (post-link-play at the earliest) we'll want the set to match everything above. Nothing to generate NOW unless you're having fun — if so, use the section-7 template with subjects like `healing potion in round glass bottle`, `iron longsword`, `leather-bound spellbook`, and bank them. Same `--sref`, same white background.

---

## 9. Suggested run order

1. **Battle backgrounds** (section 3) — the Epic 5 centerpiece; also produces your best `--sref` anchor for everything painterly.
2. **One sprite you love** (section 1, Knight) → lock `--sref` → batch the other 11 classes.
3. **UI chrome + wordmark** (sections 6, 4) — unblocks the theme/polish stories.
4. **Icon set** (section 7) — quick wins, batch-friendly.
5. **Portraits** (section 2) — needed by the unit-data card story, so mid-epic is fine.
6. Full-roster sprites/portraits — as your class list firms up.

When a batch is ready, just tell me which folder — I'll key, scale, wire, test, and swap the attribution entries.
