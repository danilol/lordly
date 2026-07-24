# Midjourney Prompts — Lordly (simple guide)

*Rewritten 2026-07-24 (simpler, per Danilo's ask). The old detailed version lives in git history if we ever need it.*

## The 4 rules (read once)

1. **Copy-paste the prompts below as they are.** Only change the words in `[brackets]`.
2. **Characters and icons must be on a plain white background.** It's already in the prompts — don't remove it. (I cut the white out later, like we did with your golem.)
3. **When you get ONE image you love, copy its Midjourney image URL.** Then add ` --sref PASTE-URL-HERE` to the end of every next prompt in the same family. This is what makes all 12 classes look like the same game. That's the only parameter you need to understand.
4. **When a batch is ready, just tell me where the files are.** I do all the resizing, cutting, and wiring.

**Folder convention (agreed 2026-07-24, tightened after the roster was completed):** samples land in `docs/planning-artifacts/ux-designs/midjourney/`. For each class/scene I rank a **top 5** (`archer-pick-1..5.png` etc. + game-size previews in `preview-32px/`) and delete the rest. Danilo picks the winner; it is **copied** into `selected/` (e.g. `selected/archer.png` + `selected/archer-at32px.png`). Once the winner is chosen, the pick files are deleted too — every original lives in the Midjourney account, and the side-by-side decision pages live as Claude artifacts. `selected/` = what's done; `*-pick-*` = waiting for a choice.

## Reference material

OB64 sprite and class references used while prompting:

- https://www.ogrebattle64archive.com/female-class-guide.html
- https://www.spriters-resource.com/nintendo_64/ogrebattle64personoflordlycaliber/asset/44189/
- https://www.spriters-resource.com/nintendo_64/ogrebattle64personoflordlycaliber/asset/44190/
- https://archive.rpgamer.com/games/ob/ob64/ob64class.html
- https://www.dropbox.com/scl/fo/ekg7akofnerfwmpxc7ioh/APulnsB-HvwPJiCNSAPMRqA?rlkey=vdt9rsjpyzmyc1ketkavw9de1&e=1&dl=0

## Suggested order

1. One battle background (easiest win, sets the mood)
2. One knight sprite → lock it with `--sref` → the other classes
3. Logo + app icon
4. Small icons (statuses, elements)
5. Portraits (needed later, for the unit-data card story)

---

## 1. Battle backgrounds

Make one per terrain. Change only the `[terrain part]`.

```
fantasy battlefield landscape, [green plains with wildflowers and old standing stones],
seen from slightly above, calm and open in the middle, mountains far away,
soft muted colors, no people, no creatures, painterly style like a classic tactical RPG,
--ar 9:16 --no text, watermark, characters
```

Other terrains to swap in: `[rocky mountain pass]` · `[ancient magical ruins]` · `[snowy field]` · `[dark forest clearing]`.

**The castle one needs its own prompt** (lesson from the first batch, 2026-07-24: the first try gave a beautiful bird's-eye courtyard full of towers and a pond — great art, but too busy behind small battle text; we kept it for the Home screen instead). For a castle BATTLE background, the camera must stay low and the middle must stay empty:

```
fantasy castle battleground, wide empty stone courtyard floor filling the middle of the image,
castle walls and towers only far in the distance, seen from ground level, slightly above,
soft muted colors, plain open ground with subtle worn stone texture, no pond, no garden, no people,
painterly style like a classic tactical RPG,
--ar 9:16 --no text, watermark, characters, towers in the middle
```

**Quality check (all backgrounds):** look at the image on your phone and imagine small gold text over the middle. If the middle is too busy, ask Midjourney for a variation or add `, extra calm and empty in the middle` to the prompt.

### The real prompts (verbatim — these produced the selected backgrounds, 2026-07-24)

**Home screen castle courtyard** (`selected/home-castle.png`):

```
fantasy battlefield landscape, castle courtyard seen from slightly above, calm and open in the middle, mountains far away, soft muted colors, no people, no creatures, painterly style like a classic tactical RPG, --no text, watermark, characters --ar 9:16 --v 8.1
```

**Castle battleground** (`selected/castle-battleground.png`):

```
fantasy medieval castle battleground, wide empty stone courtyard floor filling the middle of the image, dark worn grey stone floor, evening light, long soft shadows, castle walls and towers only far in the distance, seen from ground level, slightly above, soft muted colors, plain open ground, no pond, no garden, no people, painterly style like a classic tactical RPG, --no text, watermark, characters, towers in the middle, bright sunlight --ar 9:16 --v 8.1
```

## 2. Unit sprites (the 12 classes)

**Class, not hero (lesson from the first batch, 2026-07-24):** a board sprite must read as "a knight" — anyone's knight. A visible face and hair makes it read as one specific hero instead. So for sprites: **hide the face** — helmet visor down, hood up, mask on, or face in shadow. (The charming visible-face style is NOT wasted — it's exactly what we want for the portraits in section 5.)

**Refinement (second batch, 2026-07-24): hide the EYES, not the whole face.** A completely black empty face under a hood reads like a ghost — wrong for your own soldiers. A hidden-eyes-but-visible-chin character stays alive and friendly. Your bearded wizard is the perfect example: hat covers the eyes, beard and nose keep him human. If a generation looks spooky, add `, small friendly details visible below the hood, not a dark empty void` to the prompt.

Don't give them team colors on purpose (blue/red = you/enemy is done by the game, not the art).

### The real prompts (verbatim — these produced the selected roster, 2026-07-24)

The full 12-class roster in `ux-designs/midjourney/selected/` came from the prompts below, exactly as typed into Midjourney. Reuse them as the starting point for any regeneration or new class.

**Knight**

```
cute chibi fantasy knight, anyone's knight, not a hero, male, full body, standing pose, sword and shield, blue armor, full helmet with the visor down, face not visible, big head, small body, thick dark outline, simple flat colors, easy to read when small, one character centered on a plain solid white background, no shadow, retro tactical RPG style like Ogre Battle 64. --no text, watermark, background --ar 1:1 --raw --v 8.1
```

**Wizard (mage)**

```
chibi fantasy bearded mage, male, full body, standing pose, one hand holding the staff, the other holding the open book, long robe, deep dark hood pulled up, eyes not visible, big head, small body, thick dark outline, simple flat colors, easy to read when small, one character centered on a plain solid white background, no shadow, retro tactical RPG style like Ogre Battle 64. --no text, watermark, background --ar 1:1 --raw --v 8.1
```

**Archer**

```
chibi fantasy archer, anyone's archer, not a hero, female, full body, aiming pose drawing the bow, bow and a sharp arrow and quiver, looking deadly and dexterous sniper, green hood pulled up, face in shadow, face not visible, big head, small body, thick dark outline, simple flat colors, easy to read when small, one character centered on a plain solid white background, no shadow, retro tactical RPG style like Ogre Battle 64. --no text, watermark, background --ar 1:1 --raw --v 8.1
```

**Cleric**

```
chibi cute fantasy healer cleric, not a hero, blonde female, full body, staff, cerulean blue robes, religious and holy vibe, face in shadow, hood hiding the face, face not visible, big head, small body, thick dark outline, simple flat colors, easy to read when small, one character centered on a plain solid white background, no shadow, retro tactical RPG style like Ogre Battle 64. --no text, watermark, background --ar 1:1 --raw --v 8.1
```

**Berserker**

```
Ogre Battle 64 inspired cute chibi fantasy medieval berserker, full body, small head, chunky proportions, broad shoulders, small horned helmet with a deep visor, face completely hidden in solid black shadow, no visible eyes or mouth, large dark braided beard emerging from the darkness, muscular bare arms, simple leather harness, fur waistcloth, leather boots, oversized double-bladed battle axe held across the body with both hands, iconic silhouette, thick clean black outlines, simplified cartoon shapes, minimal details, flat colors, limited earthy palette, cute but intimidating, tactical RPG class artwork, highly readable at small sprite size, centered on a pure white background --no text, watermark, logo, scenery, background, extra weapons, visible eyes, visible mouth, glowing eyes --ar 1:1 --raw --stylize 75 --v 8.1
```

**Phalanx**

```
chibi heavy armored warrior, dark blue, bulky, large round shield and sharp spear, closed iron helmet with the visor down, face not visible, wide and stocky, big head, small body, thick dark outline, simple flat colors, easy to read when small, one character centered on a plain solid white background, retro tactical RPG style like Ogre Battle 64 --no text watermark background shadow --ar 1:1 --raw --v 8.1
```

**Witch**

```
chibi fantasy witch, full body, young and good looking red haired, standing pose, holding a magical staff, short dark turquoise dress in heels, deep dark pointy hat pulled up, eyes not visible, big head, small body, thick dark outline, simple flat colors, easy to read when small, one character centered on a plain solid white background, retro tactical RPG style like Ogre Battle 64, --no text, watermark, background shadow --ar 1:1 --raw --v 8.1
```

**Sorceress**

```
chibi fantasy sorceress, full body, standing pose, one hand holding the staff, golden pants, dark blue coat, long brown hair and fringe covering the eyes, eyes not visible, big head, small body, thick dark outline, simple flat colors, easy to read when small, one character centered on a plain solid white background, no shadow, retro tactical RPG style like Ogre Battle 64. --no text, watermark, background --ar 1:1 --raw --v 8.1
```

**Valkyrie**

```
cute chibi woman warrior norse valkyrie, full body, blonde long hair, half armored in dark blue, winged full helmet with the visor down, standing pose, magical spear and shield, face not visible, big head, small body, thick dark outline, simple flat colors, easy to read when small, one character centered on a plain solid white background, no shadow, retro tactical RPG style like Ogre Battle 64. --no text, watermark, background --ar 1:1 --raw --v 8.1
```

**Ninja**

```
chibi fantasy furtive and deadly ninja warrior, full body, dynamic low stance, wielding dual iron claw weapons - long curved metal punch daggers attached to the forearms, wearing a dark cyan-blue cloth cowl wrapping around the head and neck, matching dark ninja tunic and baggy pants, thick padded crimson-red wrist gauntlets and shin guards, burnt-orange waist sash, metallic iron headplate visor covering the forehead, eyes not visible, big head, small body, thick dark outline, simple flat colors, easy to read when small, one character centered on a plain solid white background, no shadow, retro tactical RPG style like Ogre Battle 64. --no text, watermark, background --ar 1:1 --raw --v 8.1
```

**Golem**

```
chibi fantasy clay golem, full body, standing front-three-quarter pose, body made entirely of rough chunky brown clay rocks, segmented muscular rock-like anatomy, wearing an oversized metallic iron barbuta helmet with a T-shaped visor slit, pitch black empty void inside helmet visor, thick metallic iron wrist bracers, heavy metallic belt with a hanging vibrant dark blue cloth loincloth, primitive dark red leather strap sandals, wide and stocky, big head, small body, thick dark outlines, simple flat colors, retro 90s tactical RPG style like Ogre Battle 64, centered on a plain solid white background --no text watermark background shadow --ar 1:1 --raw --v 8.1
```

**Mercenary**

```
cute chibi mercenary sellsword, full body, standing pose, wielding dual curved long cutlass swords, wearing a dark blue bandana head, face in shadow, face not visible, short thick rugged dark beard and mustache, wearing scuffed darkblue leather brigandine armor, belt with a leather coin pouch, big head, small body, thick dark outline, simple flat colors, easy to read when small, one character centered on a plain solid white background, retro tactical RPG style like Ogre Battle 64 --no text watermark background shadow --chaos 30 --ar 1:1 --raw --stylize 250 --weird 26 --v 8.1
```

## 3. Logo + app icon

**Home screen background: already done.** Your first castle-courtyard image (the bird's-eye one with the towers and pond) is perfect for the Home screen — no gameplay text sits there, so busy-and-beautiful is exactly right. No new prompt needed.

Logo (Midjourney often misspells words — retry a few times, or we use just the emblem and I add real text):

```
medieval fantasy game logo, the word "LORDLY" in elegant gothic gold letters,
small crown on top, dark plain background, centered,
--ar 3:1 --style raw --no watermark, extra words
```

App icon (keep the drawing in the middle, lots of empty margin around it):

```
game app icon, gold crown over a blue shield, dark navy background,
bold simple shapes, thick outlines, readable when tiny, big empty margins,
medieval fantasy style, --ar 1:1 --style raw --no text, watermark
```

## 4. Small icons

One prompt, many subjects. Change only the `[subject]`:

```
tiny game icon, [orange flame], pixel art style, thick black outline, bright flat colors,
very simple, one object centered on a plain solid white background,
retro RPG inventory icon style, --ar 1:1 --style raw --no text, watermark
```

Subjects we need:

- **Elements:** `[orange flame]` · `[blue water drop]` · `[light green wind swirl]` · `[brown rock]`
- **Statuses:** `[purple sleeping Z cloud]` · `[green poison drop with tiny skull]` · `[grey cracked sword]` (weaken) · `[yellow dizzy spiral stars]` (confusion)
- **Tactics:** `[crossed swords]` · `[gold crown in a target crosshair]` · `[strong arm in a crosshair]` · `[cracked heart in a crosshair]`
- **Other:** `[small gold crown]` (leader) · `[round wooden shield]` (guard) · `[steel sword]` (physical) · `[sparkling magic staff]` (magic)

## 5. Portraits (later — for the unit-data card)

**This is where faces belong.** The "specific hero" look from your first knight batch (the blond boy) is exactly right here — the portrait gives the class its personality; the board sprite stays anonymous. Same idea as sprites: do one, lock with `--sref`, then the rest. Change only `[who]`:

```
fantasy RPG character portrait, [young knight, male, determined face, blue armor],
head and shoulders, painted style, rich colors, simple dark background,
classic 90s tactical RPG portrait like Tactics Ogre,
--ar 1:1 --no text, watermark, frame
```

---

## Before choosing a winner: the glitch check

AI images often carry small generation mistakes that you only see when you look closely (found on a cleric candidate, 2026-07-24: a malformed cross and a second necklace appearing from nowhere). Before picking a winner, zoom in and check: **hands** (finger count, grip), **accessories** (necklaces/belts that start or end nowhere), **weapons** (blade attached correctly), **symmetry** (two different boots/pauldrons). Small glitches hide at 32px on the board — but the same image is reused big in the unit-data card later, where they show.

## When you're stuck

- **Image too detailed/noisy?** Add `, simpler, fewer details` to the prompt.
- **Wrong style?** Make sure the `--sref YOUR-URL` is at the end (after you have your anchor image).
- **Text looks wrong in the logo?** Normal — retry, or generate only the crown emblem and I'll set the text with a font.
- Anything else — paste me the image and the prompt, I'll fix the prompt.
