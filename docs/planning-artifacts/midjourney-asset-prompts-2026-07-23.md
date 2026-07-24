# Midjourney Prompts — Lordly (simple guide)

*Rewritten 2026-07-24 (simpler, per Danilo's ask). The old detailed version lives in git history if we ever need it.*

## The 4 rules (read once)

1. **Copy-paste the prompts below as they are.** Only change the words in `[brackets]`.
2. **Characters and icons must be on a plain white background.** It's already in the prompts — don't remove it. (I cut the white out later, like we did with your golem.)
3. **When you get ONE image you love, copy its Midjourney image URL.** Then add ` --sref PASTE-URL-HERE` to the end of every next prompt in the same family. This is what makes all 12 classes look like the same game. That's the only parameter you need to understand.
4. **When a batch is ready, just tell me where the files are.** I do all the resizing, cutting, and wiring.

**Folder convention (agreed 2026-07-24):** samples land in `docs/planning-artifacts/ux-designs/midjourney/`. For each class/scene I rank a **top 5** (`archer-pick-1..5.png` etc. + game-size previews in `preview-32px/`) and delete the rest (they live in the Midjourney profile). Danilo picks the winner; it is **copied** into `selected/` (e.g. `selected/archer.png`) — the top-5 candidates are always kept. `selected/` = what's done; `*-pick-*` = waiting for a choice.

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

## 2. Unit sprites (the 12 classes)

**Class, not hero (lesson from the first batch, 2026-07-24):** a board sprite must read as "a knight" — anyone's knight. A visible face and hair makes it read as one specific hero instead. So for sprites: **hide the face** — helmet visor down, hood up, mask on, or face in shadow. (The charming visible-face style is NOT wasted — it's exactly what we want for the portraits in section 5.)

**Refinement (second batch, 2026-07-24): hide the EYES, not the whole face.** A completely black empty face under a hood reads like a ghost — wrong for your own soldiers. A hidden-eyes-but-visible-chin character stays alive and friendly. Your bearded wizard is the perfect example: hat covers the eyes, beard and nose keep him human. If a generation looks spooky, add `, small friendly details visible below the hood, not a dark empty void` to the prompt.

Do the Knight first. When one looks right, add its URL with `--sref` to all the others.

```
cute chibi fantasy knight, male, full body, standing pose,
sword and shield, blue armor, full helmet with the visor down, face not visible,
big head, small body, thick dark outline, simple flat colors, easy to read when small,
one character centered on a plain solid white background, no shadow,
retro tactical RPG style like Ogre Battle 64,
--ar 1:1 --style raw --no text, watermark, background
```

For each other class, change only the **first two lines** (who they are + what they carry/wear):

Each swap line now includes how that class hides its face:

| Class | Swap in |
|---|---|
| Mercenary | `chibi fantasy mercenary, male, ... , axe and light leather armor, red-brown colors, closed helmet, face not visible` |
| Archer | `chibi fantasy archer, female, ... , bow and quiver, green hood pulled up, face in shadow` |
| Wizard | `chibi fantasy bearded wizard, wise, male, ... , staff and long robe, deep blue hat covering the eyes, big grey beard and nose visible` *(the proven winner — 2026-07-24 batch)* |
| Cleric | `chibi fantasy cleric, female, ... , holy staff, white and gold robes with a deep cowl, face in shadow` |
| Witch | `chibi fantasy witch, female, ... , crooked staff, big pointed hat tilted down hiding the face, purple dress` |
| Berserker | `chibi fantasy berserker, male, ... , huge two-handed axe, bare arms, fearsome war mask covering the face` |
| Phalanx | `chibi fantasy heavy guard, male, ... , tower shield and spear, grey heavy armor, full closed helmet, face not visible` |
| Ninja | `chibi fantasy ninja, male, ... , twin daggers, dark clothes, mask and hood, only shadow where the face is` |
| Valkyrie | `chibi fantasy valkyrie, female, ... , winged helmet with the visor down, lance, silver and sky blue, face not visible` |
| Sorceress | `chibi fantasy sorceress, female, ... , crystal staff, violet and midnight blue, deep hood pulled up, face in shadow` |
| Golem | `chibi fantasy stone golem, huge and wide, ... , cracked rock body with glowing runes, moss green and grey` (no face problem — it's a rock) |

Don't give them team colors on purpose (blue/red = you/enemy is done by the game, not the art).

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

## When you're stuck

- **Image too detailed/noisy?** Add `, simpler, fewer details` to the prompt.
- **Wrong style?** Make sure the `--sref YOUR-URL` is at the end (after you have your anchor image).
- **Text looks wrong in the logo?** Normal — retry, or generate only the crown emblem and I'll set the text with a font.
- Anything else — paste me the image and the prompt, I'll fix the prompt.
