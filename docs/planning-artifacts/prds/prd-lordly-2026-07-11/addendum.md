---
title: "Addendum: PRD Lord Battle Tactics"
status: final
created: 2026-07-11
updated: 2026-07-12
---

# Addendum — PRD: Lord Battle Tactics

Depth that grounds the PRD but belongs in downstream documents (architecture, UX spec, balancing docs). The brief's addendum (`docs/planning-artifacts/briefs/brief-lordly-2026-07-11/addendum.md`) remains valid; this file adds PRD-phase material only.

## 1. OB64 reference: how the original 3×3 grid actually worked

Compiled from the research digest (ogrebattle64archive.com, lparchive.org Update 02, GameFAQs/CyricZ) and the user's own notes. This is the source material behind the PRD's "Battle Grid & Targeting" section — our game simplifies that model, but deviations should be deliberate.

### Attack counts by row (front / middle / back)

| OB64 class | Front | Middle | Back |
|---|---|---|---|
| Fighter / Knight | Melee ×2 | ×1 | ×1 |
| Archer | Shoot ×1 | Shoot ×2 | Shoot ×2 |
| Wizard / Sorceress | Magic ×1 | ×1 | ×2 |
| Cleric / Priest | Heal ×1 | ×1 | Heal ×2 |
| Witch | Status ×1 | ×1 | ×2 |

Advanced tiers for later calibration: Paladin 3/2/2, Archmage 1/2/2, Diana 1/2/3, Black Knight 2/2/2. Physical damage also scaled up the further forward the unit stood — the Archer's OB64 sweet spot was the **middle** row (2 shots + row damage bonus). Our FR15 table keeps the OB64 counts unchanged (Archer 1/2/2): the brief's "archer in the back attacks 2x" holds, and the middle row is an equally valid sniper post — the trade-off is exposure, not shot count.

### Targeting in OB64

- **Column adjacency:** a melee unit could target the enemy column directly opposite or one column to either side; a corner unit could never reach the far column. Center-column units reached everything.
- **Front-to-back blockade:** melee could not bypass a living unit in a nearer reachable row — the front Knight had to die before the back Mage was reachable.
- **Ranged and magic** targeted rear-most first ("if there is anyone in your column behind you, ranged attacks have to get rid of them first"). Attacks biased toward the center of a row; a leader in a front corner absorbed ~2/3 of potential hits.
- **AoE magic** was not row-locked: spells were single-target, "corner" (target + adjacent splash), or "wide range" blobs around a rear-priority primary target. Our row-AoE Mage is a deliberate simplification.

### The four tactics orders (post-MVP parking-lot item)

1. **Autonomous** (default) — units pick the easiest/closest valid target.
2. **Attack Strongest** — prioritize the enemy with the highest remaining HP.
3. **Attack Weakest** — focus-fire the lowest-HP enemy (fastest kills).
4. **Attack Leader** — everyone targets the enemy squad leader; a dead leader crippled and routed the squad.

Any implemented tactic still respected reach: an order only redirected choice *within* a unit's valid targets.

### Initiative in OB64 (user-contributed, 2026-07-12)

- **Turn order** was an initiative timeline driven by **AGI**, not grid position: the timeline weaves between both squads by individual speed.
- **Multihit split:** multi-attack units did not swing back-to-back — a 2-attack Knight took its first swing at its AGI slot, the rest of the field acted, and its second swing came when the timeline cycled back.
- **The six attributes:** STR (physical damage), VIT (physical defense), INT (magic damage), MEN (magic defense), AGI (initiative + evasion), DEX (accuracy + crit).
- **Archetype spreads:** heavy melee = high STR/VIT, lowest AGI (acts last, survives); skirmishers (Ninja) = sky-high AGI/DEX, thin VIT; casters = high INT/MEN, terrible STR/VIT, mid AGI.
- **Grooming:** class-driven level-up gains made leveling in one class and switching to another a core mechanic — the long-term reason the PRD keeps attributes as a first-class model.

### Clash end and judging in OB64

Each character had a fixed action count (row tables above); when both sides exhausted all actions the clash ended unconditionally. Winner = side that dealt more total damage; wiping the enemy was an instant win; the loser gave ground on the overworld. Endgame reference ratios: elite HP ~250–280 vs ~56–73 damage per hit → a unit survived roughly 4 neutral hits. Magic always dealt chip damage even when blocked; magic could not crit. Exact damage/heal formulas and elemental multipliers were never published — free design parameters for us.

### OB64 Witch reference

Dealt no damage; ailments lasted only the current clash. Cast counts matched other casters (1/1/2). Spell families: paralyze (Shock Bolt / Ray of Paralysis / Bind Flare), sleep (Deep Sleep / Slumber Mist / Black Breeze), poison (Poison Cloud), Nightmare, charm (~50% cap). Rear-first targeting — her classic role was stunning the enemy back-row caster before it acted.

### User-supplied OB64 reference links

From the original brain dump (`ogre_game.txt`) — mined for this digest; keep at hand for the leveling/promotion era: [Wikipedia](https://en.wikipedia.org/wiki/Ogre_Battle_64) · [ogrebattle64.net](https://ogrebattle64.net/) · [ogrebattle64archive.com](https://www.ogrebattle64archive.com/) · [GameFAQs guides](https://gamefaqs.gamespot.com/n64/198230-ogre-battle-64-person-of-lordly-caliber/faqs) · [LP Archive playthrough](https://lparchive.org/Ogre-Battle-64/) · [Prima guide scan](https://archive.org/details/OgreBattle64PersonOfLordlyCaliberPrimasGuide/mode/2up) · [character stat mechanics](http://nickexamples.atspace.cc/Ogre/) — the last one is the primary source for post-MVP attribute growth curves (FR15's landing zone).

## 2. Technical notes captured during PRD discovery (architecture input)

- **Deterministic seeded battle engine.** Same (compositions + placements + seed) → identical battle, bit for bit. Motivations: unit-testable combat, replayable battles, and server-authoritative verification in the link-play epic (server re-runs the sim; clients just animate). This makes the engine a pure TypeScript module with no Phaser dependency — Phaser is presentation only.
- **Quality bar (user directive, 2026-07-11):** automated tests are very important, as are high documentation standards. Test strategy sketch: exhaustive unit tests on the battle engine (targeting matrix, row counts, RPS multipliers, status effects, seeded RNG stability), property-style tests for "battle always terminates" and "winner judging is symmetric", golden-battle snapshot tests for regression, lighter integration tests on scenes. Rules documentation doubles as the in-game help content.
- **Balancing workspace:** initial stat table lives in the PRD as tuning input; expect a `balance.ts`/JSON data file so numbers change without touching engine code, and a headless simulation harness (AI vs AI over all 56 compositions) to detect dominant strategies — cheap because the engine is deterministic.

## 3. PRD-phase rejected alternatives

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Win metric (single engagement) | Team HP **%** remaining; tie = draw + rematch | Kills-first with HP tiebreak; absolute total HP (the brief's looser wording) | One metric, readable at a glance; kills already matter (dead unit = 0 HP). Percentage over absolute: with class HP spans of 80–140, absolute HP would bias judging toward drafting fat units regardless of play |
| Targeting model | Column-first, then nearest; deterministic | OB64 "Attack Weakest" default; class-specific instinct table | Placement decides who fights whom — the chess-like read is the game's core skill; tactics orders deferred to parking lot |
| Middle row | Full three-tier per-class row behavior | Neutral flex row | OB64-faithful; middle as a real trade-off tier |
| 6th class name | Mercenary | Golem (save for 2-slot large-monster era), keep Zombie | Human sellsword reads instantly as "neutral, no allegiance"; Golem reserved for the large-monster mechanic |
| Witch spell selection | Rolled element (Fire/Water/Wind/Earth) fixes her spell | Player picks the spell at draft (round-1 choice, superseded 2026-07-12); autonomous spell AI | User direction: every unit rolls an element at draft; Witch spell keys off it — adds draft variance and elemental identity, still deterministic |
| Element scope in MVP | Element visible on all units; combat effect only via Witch spell | Elemental damage wheel in MVP (Fire↔Water, Earth↔Wind) | Keeps MVP balance surface small; wheel parked post-MVP on top of the same rolls |
| Stat model | Six OB64 attributes (STR/VIT/INT/MEN/AGI/DEX), fixed per class, no leveling in MVP | Flat HP+damage numbers (round-1 draft); full leveling in MVP | User's end goal is attributes; freezing them per class costs ~nothing now and avoids a double rebalance later — growth/leveling stays post-MVP |
| Initiative | AGI-driven timeline with OB64 multihit split | Fixed class order (round-1 draft); grid-position order | OB64-faithful, user-confirmed; AGI values recreate the intended class order while staying attribute-driven |
| Accuracy/crits | None in MVP (DEX reserved) | DEX-based miss/evade/crit from day one | Misses are too swingy in a 3-unit battle; crits/evasion return post-MVP with more units on the board |
