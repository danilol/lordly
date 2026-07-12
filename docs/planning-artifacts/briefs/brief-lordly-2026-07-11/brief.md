---
title: "Product Brief: Lord Battle Tactics"
status: approved
created: 2026-07-11
updated: 2026-07-11
---

# Product Brief: Lord Battle Tactics

*Working handle: `lordly` (repo, slug, domain). Display title: **Lord Battle Tactics** — a double homage to Ogre Battle 64 and Tactics Ogre.*

## Executive Summary

Lord Battle Tactics is a browser-based 1v1 strategy duel that distills the soul of Ogre Battle 64 — automated squad combat decided by class composition and formation — into a five-minute match you can play on your phone. Each player secretly picks 3 units from 6 classes and places them on a 3×3 formation grid. Both boards reveal, and an animated auto-battle resolves the match. You never control an attack directly: as in OB64, all your skill is spent *before* the clash. Whoever reads their opponent better, wins.

The 2026 auto-battler landscape is crowded, but this specific niche is empty: no existing game combines hidden simultaneous formation placement, strict 1v1, install-free browser play, and chess.com-style challenge links. The closest cousin (Mechabellum) is PC-only with visible boards; the OB64 community's hunger is proven (Unicorn Overlord was hailed as "the successor fans waited 25 years for"), but nobody has translated the formula to quick PvP.

This is a passion project, built AI-first with the BMAD method: the MVP is a complete, fun match against an AI on an Android phone, followed by "send a friend a link" 1v1 as its own epic.

## Why This Game

Ogre Battle 64's magic was indirect control: you composed squads, chose formations, and then *watched* your plan succeed or collapse. Nothing today delivers that feeling in a quick, competitive, phone-friendly package:

- Modern auto-battlers (TFT, Super Auto Pets, Hearthstone Battlegrounds) are 8-player, shop-RNG-driven, and session-heavy — the genre's own players cite shop RNG and solved metas as the top churn drivers.
- OB64's spiritual successors (Symphony of War, Unicorn Overlord) are hours-long single-player campaigns with no PvP and no browser play.
- The share-a-link duel UX is proven by chess.com and Lichess but has never been applied to formation auto-battles.

And personally: OB64 is the creator's favorite game of all time, and this project doubles as the proving ground for building a complete game through AI-driven development without writing the code by hand.

## The Solution: The Battle Is the Game

The MVP deliberately cuts everything around the battle — no world map, no unit movement, no strongholds. One OB64 *clash*, elevated to a full game:

1. **Draft** — pick any 3 units from 6 classes; duplicates allowed. Degenerate combos get balanced with stats, not rules.
2. **Position** — place them secretly on your 3×3 grid (Battleship-style hidden simultaneous placement). Rows matter: tanks up front, ranged in back.
3. **Reveal & battle** — an animated, OB64-style auto-battle plays out. Units act by class rules and position; the player watches.
4. **GG** — winner declared. Rematch is one tap away.

### The six classes

A rock-paper-scissors triangle plus three twists:

| Class | Role | Signature |
|---|---|---|
| **Knight** | Front-line tank | 2 melee attacks; beats Archer |
| **Archer** | Back-row sniper | 2 shots, reaches the enemy back row; beats Mage |
| **Mage** | Row artillery | Area damage hits a whole row; beats Knight |
| **Cleric** | Support | Heals own squad; weak attack |
| **Witch** | Control (no damage) | Inflicts sleep, poison, weaken, or confusion (a confused unit may strike an ally or heal an enemy) |
| **Zombie** | Neutral | Average everything; no strengths, no weaknesses *(placeholder name)* |

Exact stats, attack counts per row, and the Witch's per-engagement casting rules are settled in the PRD.

### Battle resolution

Two modes, in delivery order:

- **Single engagement** — every unit spends its class attack count once; the side with more total HP remaining wins. Fast, decisive, faithful to a single OB64 clash.
- **Until wipeout** — engagements repeat until one side is eliminated. Gives Cleric and Witch room to shine. May ship after the MVP if needed.

## What Makes This Different

- **Empty niche, proven parts.** Hidden-formation 1v1 browser dueling with challenge links exists nowhere today; each ingredient is proven elsewhere.
- **No shop, no economy RNG.** The two biggest auto-battler churn drivers are absent by design — every loss is a read you got wrong, not a roll you didn't hit.
- **Five minutes, full strategic arc.** Draft → mind-game → payoff, at bus-stop length. `[ASSUMPTION: target match length under 5 minutes — validated during MVP playtesting]`
- **The moat is honest:** there isn't one beyond taste and execution. This is a passion project chasing a feeling, not a market position.

## Who This Serves

**Primary:** the creator and his friends — strategy fans with phones, an appetite for "one more round," and zero tolerance for installs or accounts. Success for them: click a link, understand the game without a tutorial, feel clever when a read pays off.

**Secondary (if it ever goes public):** the OB64 nostalgia community — active, underserved, and easy to find (r/ogrebattle64, fan sites) — and lapsed auto-battler players burned out on RNG and 30-minute lobbies.

## Success Criteria

1. **It's fun on the phone.** A complete match (draft → placement → animated battle → result) plays smoothly in a mobile browser, and the creator genuinely enjoys it. The gold signal: *a friend asks for a rematch unprompted.*
2. **The triangle matters.** Class picks and placement visibly decide outcomes; no single composition dominates casual play.
3. **The AI is worth beating.** It punishes lazy formations but is beatable with a good read. `[ASSUMPTION: a reasonable player wins roughly half their matches against it]`
4. **The link works cold.** A friend with no explanation completes a 1v1 match from just a shared URL (post-MVP epic).
5. **BMAD proves out.** The game ships through brief → PRD → architecture → sprints, with no hand-written code.

## Scope

**In (MVP):**
- Phaser 3 + TypeScript web game, PWA, mobile-first for Android browsers
- 6 classes, pick 3 (duplicates allowed), hidden simultaneous placement on 3×3
- Animated auto-battle scene; single-engagement resolution
- AI opponent; instant rematch
- Local battle history — the last 10 match results (winner, both compositions), stored on-device
- Free/CC fantasy pixel-art sprite packs (itch.io, OpenGameArt, Kenney) — no custom art production

**Next epics (post-MVP, in rough order):**
- 1v1 via shareable link — Node.js + WebSocket backend, room codes, server-authoritative resolution
- Class roster expansion — a priority, not a maybe: new classes are the game's main growth axis
- Size-based squads — armies grow to 5 slots, where standard units cost 1 slot and large monsters cost 2 (OB64-faithful)

**Stretch within MVP if cheap, otherwise deferred:**
- Until-wipeout battle mode

**Explicitly out (for now):**
- World map, unit movement, stronghold capture
- Leveling, items, equipment
- Accounts, rankings, matchmaking, monetization
- Native Android app / app store distribution

## Vision

If the duel is fun, it grows the way OB64 taught us: a steadily deepening class roster, 5-slot squads where a big monster is worth two soldiers, promotions, drafts and bans, async challenge play — and maybe, one day, the strategic map where squads march between strongholds. The long-term dream is simple: **the game OB64 fans reach for when they have five minutes and a friend.**
