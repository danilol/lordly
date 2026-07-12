---
title: "Addendum: Lord Battle Tactics"
status: draft
created: 2026-07-11
updated: 2026-07-11
---

# Addendum — Lord Battle Tactics

Depth that supports the brief but belongs in downstream documents (PRD, architecture, UX). The brief stays 2 pages; this is the parking lot with provenance.

## 1. Decisions with rejected alternatives

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Tech stack | Phaser 3 + TypeScript, Node/WebSocket later | React+Canvas (weak for battle animation); Godot 4 (heavier web export, moves the project out of ~/projects/js) | Battle-scene animation is the heart of the game; web-native fits link-play and the user's folder convention |
| Strategic layer | Battle-only: 3×3 formation vs 3×3, no map | OB64-style real-time map (much bigger MVP, hard netcode); turn-based tactical grid with moving squads (chosen in round 1, then cut in round 2) | User's explicit scope cut: "The focus is on the battle only. Whoever wins the battle wins, GG" |
| Placement | Hidden simultaneous (Battleship-style) | Alternating visible draft (adds turn logic + last-place advantage); reveal-classes-hide-positions | Pure mind-game, simplest netcode (one submit each) |
| Army picking | Any 3 of 6, duplicates allowed | No-duplicates rule; point budget | "Balance the stats, not the rules"; point budget parked for 5-unit era |
| Grid | Square 3×3 per player | Hex | Simpler math/rendering/touch on phone |
| Multiplayer order | AI first, link-play second epic | Live link from day one; async correspondence | Playable on phone fastest; rules proven before netcode |
| Art | Free/CC pixel packs | AI-generated sprites (consistency/animation risk); geometric placeholders | Looks like a real game from sprint 1 at zero production cost |
| Name | Display: "Lord Battle Tactics"; slug: `lordly` | "Lordly" as display name | User choice — double homage (Ogre Battle + Tactics Ogre); slug stays short for repo/domain |

## 2. Combat mechanics detail (PRD input)

Captured from brainstorm; **bold** items are open questions for the PRD.

- Formation grid is 3 rows × 3 columns per player (OB64 board style). MVP: 3 units placed; mid/late-game vision: 5-slot limit where large monsters occupy 2 slots.
- Row semantics: front row tanks/melee, back row ranged. Class behavior sketch from the user: "Archer in the back attacks 2x, Mage does area damage, knights tank and attack 2 in the front."
- RPS triangle: Mage > Knight > Archer > Mage. Cleric heals (weak attack). Witch: no damage, status only. Zombie: neutral stats, no strengths/weaknesses — **placeholder name/class pending user decision**.
- Witch kit: sleep/stun (skip attacks this engagement), poison (DoT per engagement — synergizes with wipeout mode), weaken (reduced damage), confusion (unit may attack an ally or heal an enemy). **How many casts per engagement, targeting rules, effect durations, stacking — all PRD.**
- Single-engagement mode: each unit spends its class attack count once; **winner = more total remaining HP (kills as tiebreaker?)**.
- Wipeout mode: engagements repeat until a side is eliminated; **needs an anti-stalemate rule (e.g. double-cleric out-healing) — engagement cap or healing decay**.
- **Attack targeting rules** (does a knight hit the nearest front unit? column-locked? what happens when a row is empty?) — PRD.
- **Middle row semantics** on a 3-row grid (OB64 had front/mid/back) — PRD.

## 3. Landscape research digest (2026-07-11)

Full digest from web research; grounds "What Makes This Different."

**Closest comparables:** Teamfight Tactics (8-player, shop RNG, mobile+PC); Super Auto Pets (async ghost opponents, browser — the low-commitment benchmark); Hearthstone Battlegrounds (8-player, long sessions); Backpack Battles (Steam, ~90% positive, async + friend lobbies, no formation grid); The Bazaar (review crash to ~48% over monetization — cautionary tale); **Mechabellum** (closest mechanical cousin: 1v1 simultaneous placement + auto-resolve, but visible boards, PC-only, 20–40 min matches); Symphony of War / Unicorn Overlord (OB64-style squads, single-player campaigns only).

**Niche check:** no title found that combines (a) hidden simultaneous formation placement, (b) strict 1v1, (c) browser/PWA no-install, (d) chess.com-style challenge link. Each nearest neighbor misses at least one.

**Hook/churn consensus:** hook = "build, then watch it pop off" + low session commitment; churn = shop/economy RNG, solved metas without content patches (Dota Underlords: 200k → ~1k concurrent), monetization resentment, matches too long for their decision density.

**OB64 demand signals:** CBR on Unicorn Overlord ("the successor fans waited 25 years for"); 2025 ResetEra thread "this generation is sorely missing Ogre Battle"; active fan sites (ogrebattle64.net) maintaining games-like-OB64 lists. Nobody has taken the formula to quick PvP.

Sources: Steam Charts (Mechabellum), ResetEra, Engadget, CBR, Mobalytics, FandomWire, Steam community (Backpack Battles).

## 4. Reference material (from user's brain dump)

- Wikipedia: https://en.wikipedia.org/wiki/Ogre_Battle_64
- Fan sites: https://ogrebattle64.net/ · https://www.ogrebattle64archive.com/
- GameFAQs guides: https://gamefaqs.gamespot.com/n64/198230-ogre-battle-64-person-of-lordly-caliber/faqs
- LP Archive playthrough: https://lparchive.org/Ogre-Battle-64/
- Prima guide scan: https://archive.org/details/OgreBattle64PersonOfLordlyCaliberPrimasGuide/mode/2up
- Character stat mechanics: http://nickexamples.atspace.cc/Ogre/

Key OB64 mechanics worth mining later: leader-based squads, tactics orders (Attack Leader / Weakest / Strongest), class promotion trees, front/mid/back attack counts per class, critical hits and parries.

## 5. Post-MVP parking lot

- **Class roster expansion — top priority per user ("very important")**; class promotions; replace/decide the Zombie placeholder
- Size-based squads: armies grow to a 5-**slot** limit on the 3×3 grid — standard units occupy 1 slot, large monsters occupy 2 (OB64-faithful); point-budget army building may layer on top
- Tactics orders (Attack Leader / Weakest / Strongest) as a pre-battle choice
- Async correspondence mode; rankings/ladder; drafts and bans
- Strategic map with moving squads and strongholds (the full OB64 dream)
- Native Android packaging (TWA) if PWA friction ever matters
