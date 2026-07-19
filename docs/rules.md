# How to Play

Lord Battle Tactics is a duel of small armies. You draft a five-slot army of named soldiers, place them on your 3×3 board, and watch the battle resolve itself — your plan does the fighting.

A match: **Draft → Place → Reveal → Battle → Result**. Win, rematch, repeat.

## The Classes

Draft to fill your five slots (duplicates allowed). Each unit also rolls one of four elements when drafted.

| Class | Role | HP | Actions (front/mid/back) | Behavior |
| --- | --- | --- | --- | --- |
| Knight | Front-line tank | 140 | 2/1/1 | Melee: nearest reachable row. Mid row Guards instead of attacking |
| Mercenary | Neutral sellsword | 110 | 2/1/1 | Melee: nearest reachable enemy row, no class advantage |
| Archer | Back-row sniper | 90 | 1/2/2 | Ranged: arcs over the front to hit the rearmost enemy row |
| Wizard | Row artillery | 80 | 1/1/2 | Front: a weak staff jab. Mid/back: blasts the fullest enemy row |
| Cleric | Support | 90 | 1/1/2 | Heals the most-hurt ally; a weak staff attack if none is hurt |
| Witch | Control | 85 | 1/1/2 | Casts an element-keyed status on a rear enemy; deals no damage |
| Berserker | Vanguard bruiser | 120 | 2/1/1 | Melee: nearest reachable enemy row; hits hard, lightly armored |
| Phalanx | Vanguard wall | 150 | 2/1/1 | Melee: nearest reachable row. Front/mid Guard instead of attacking |
| Ninja | Skirmisher | 85 | 2/1/1 | Melee: nearest reachable enemy row; very fast, no class advantage |
| Valkyrie | Skirmisher | 105 | 2/1/1 | Melee: nearest reachable enemy row; no class advantage |
| Sorceress | Row artillery | 78 | 1/1/2 | Front: a weak staff jab. Mid/back: blasts the fullest enemy row |

### Roles and matchups

Damage bonuses ride on a unit's **role**, not its class — so new soldiers slot into a matchup you already understand:

- **Vanguard** — Knight, Berserker, Phalanx
- **Skirmisher** — Mercenary, Ninja, Valkyrie
- **Sniper** — Archer
- **Artillery** — Wizard, Sorceress
- **Support** — Cleric
- **Control** — Witch

The triangle: **Artillery beats Vanguard**, **Vanguard beats Sniper**, **Sniper beats Artillery**. An attack with the advantage deals ×1.5 damage; against its counter, ×0.75. And the archer's specialty — **Sniper hunts Support** and **Sniper hunts Control**: arrows deal ×1.5 to Cleric and Witch, one-way, with no bonus back. Skirmishers stand outside every relation — steady, never favored, never countered.

### Rows matter

Where a unit stands decides how often it acts — the numbers above are actions per engagement by row. Front-line fighters swing twice from the front rank; archers, casters, and the witch do their best work from the middle and back.

For most classes, row only changes that count. Four classes' row also changes **what they do**:

- **Knight** — front and back rows slash as normal; the **mid row raises a Guard shield instead of attacking**.
- **Phalanx** — front and mid rows raise a Guard shield instead of attacking; the **back row bashes** as normal.
- **Wizard and Sorceress** — mid and back rows blast the row as normal; the **front row swings a weak, melee-targeted staff jab** instead of blasting (a real physical hit, not the row-wide spell).

## How Units Fight

The two boards face each other, front rows nearest. Your left column faces the enemy's right — one straight lane.

- **Reach — melee only.** A melee unit can strike its facing enemy column and the columns beside it: a corner unit reaches two enemy columns, a center unit all three. When several targets in a row qualify, it favors its facing column, then the column nearer the center. **Last Stand:** if nothing is in reach, a melee unit strikes an out-of-reach enemy instead — a soldier never stands idle while an enemy lives.
- **Ranged and magic reach the whole board.** Archers, the Cleric's staff, the Witch's curse, and the Wizard's blast are not bound by columns — they choose across the entire enemy grid.
- **Melee (Knight, Berserker, Phalanx, Mercenary, Ninja, Valkyrie).** Strikes the **nearest occupied enemy row** it can reach — a living front unit shields the rows behind it. No bypassing the wall.
- **Ranged (Archer).** Arrows arc over the front line and strike the **rearmost occupied enemy row** — the counter to artillery hiding in the back.
- **Blast (Wizard, Sorceress).** Each cast strikes **every unit in one enemy row** — the row with the most living enemies (ties go rearward). In **Wipeout**, each struck unit takes only ×0.75 of the damage — over a long war, the artillery spreads thin.
- **Heal (Cleric).** Restores the **living ally with the lowest HP share** (herself included). If nobody is hurt, she pokes with her staff instead — feebly.
- **Curse (Witch).** Applies her prepared spell to the rearmost enemy, preferring one not yet afflicted. She deals no damage; she doesn't need to.

## Crits and Dodges

A unit's **DEX** governs the drama of a physical blow. Every melee strike, arrow, and cleric staff-poke rolls two chances:

- **Crit.** The attacker may land a critical hit for **×1.5** damage — the chance is the attacker's **DEX ÷ 3** (as a percent), applied after the role matchup.
- **Dodge.** The defender may slip the blow entirely and take **no damage** — the chance is the defender's **DEX ÷ 3** (as a percent).

Higher-DEX units — the Ninja above all — both crit more and dodge more. **Magic and healing never crit and can never be dodged** (a Wizard's blast, a Witch's curse, and a Cleric's heal always land as cast). Like everything else, both rolls come from the battle's seed, so the same battle always replays the same crits and dodges.

## Guard

A Knight in the mid row, or a Phalanx in the front or mid row, spends its action raising a **Guard shield** instead of attacking. The shield covers two cells: the guarding unit's own, and the ally's directly behind it.

The next single-target physical hit that lands on either shielded cell is cut down before it's counted — a **Phalanx's shield negates it completely** (zero damage), a **Knight's halves it**. Either way, the shield is then spent: the guard has to raise it again on a later action to protect anyone a second time. Magic, healing, and status effects pass straight through a shield untouched, and a dodged blow never spends the charge — only a landed hit does.

## Your Army's Tactic

Before battle you set one **tactic** for your whole army — how every unit chooses whom to hit. It is a second plan layered over your picks and placement, set at placement and hidden until the reveal (the enemy commits one too, unseen). It never changes *where* a unit can reach, only *which* legal target it prefers.

- **Autonomous** — each unit targets by its own instinct: melee the nearest enemy row, ranged the rearmost.
- **Attack Weakest** — the whole army focuses the enemy with the least HP left, to finish wounded units before they act again.
- **Attack Strongest** — the whole army focuses the enemy with the most HP left, to break the toughest threat first.
- **Attack Leader** — the whole army hunts the *enemy's* crowned leader. When that enemy leader can't be reached — or once it has fallen — each unit reverts to Autonomous for that action. (This tactic unlocks only after you crown your own leader; see "The Leader" below for what happens when **your own** leader falls.)

When two enemies are tied for weakest or strongest, the unit falls back to its Autonomous preference — the battle stays perfectly repeatable.

## The Leader

At placement you **crown one unit as your leader** (♛) — and the enemy crowns one too. Both crowns stay hidden until the reveal, where each army's leader is marked on the board: protecting your own leader, and hunting theirs, becomes part of the read.

A crown is a risk as much as an honor. **When a side's OWN leader falls — regardless of tactic, and regardless of what happens to the enemy's leader — that whole army loses heart** for the rest of the battle — the *sober package*:

- Its target tactic collapses back to **Autonomous** — no more coordinated focus-fire.
- Its units **deal only ×0.75** of their physical damage (melee, arrows, and the cleric's staff) …
- … and **take ×1.25** physical damage in return.

Magic and healing are unaffected — only physical blows carry the penalty. The leader's fall is permanent: there is no re-crowning mid-battle, and the malus never lifts.

## Elements and the Witch's Spells

Every unit rolls an element at draft. For most classes it is a banner color — but the **Witch's spell is keyed to her element**:

- **Water → Sleep** — the target loses all remaining actions this engagement.
- **Earth → Poison** — the target takes 15 damage at the end of the engagement (and of every later engagement in Wipeout — poison never washes off).
- **Fire → Weaken** — the target's damage is halved.
- **Wind → Confusion** — each of the target's actions has a 50% chance to misfire onto its own side.

The same spell never stacks on one target.

## The Timeline

Combat runs in **turns**. Each turn, every unit with actions left acts once, fastest first — the order weaves between both armies. The natural speed order: **Ninja, Witch, Archer, Valkyrie, Sorceress, Mercenary, Wizard, Berserker, Cleric, Knight, Phalanx** — disruptors and skirmishers strike first; the heavy wall hits last, but survives to do it. Sleeping and fallen units forfeit their remaining actions.

## Judging

Wipe out the enemy army and you win on the spot. Otherwise, when all actions are spent, the side with the **higher percentage of its starting HP remaining** takes the day. An exact tie is a draw — honor demands a rematch.

## Battle Modes

- **Standard** — one engagement; judged when every action is spent.
- **Wipeout** — engagements repeat until one side falls. Between engagements, units recover their actions and shed every status **except poison**. If nobody has fallen after 10 engagements, the judges rule as in Standard.
