# Lordly Roster & Moves — the source of truth

> Companion table to `DOSSIER.md` (story 5.1). The DOSSIER holds the dated decisions and
> evidence; THIS file is the living table you visit and re-visit. Evidence:
> `lordly-original-ob64-class-list-and-more.csv` (OB64 reference),
> `lordly-my-mvp-wish-wip.csv` (Danilo's endgoal roadmap), `attack-names-and-more.csv`
> (move catalog). OB64 is the reference, not the target — names and descriptions here are
> deliberately original.
>
> **Status legend:** ✅ decided · 🟡 proposed (awaiting Danilo) · ⏳ deferred (this era's fence
> or missing mechanic) · 🔮 future roadmap (endgoal, post-era).
>
> Stats are OB64-style GROWTH values (2–7 scale) — design intent. Engine numbers
> (HP 80–300 scale) are derived from these in stories 5.4/5.5 and sweep-policed there.

## The move catalog (engine mapping)

| Display name(s) | Engine kind | Damage | Targeting | Draws (ADR 0003) | Status |
| --- | --- | --- | --- | --- | --- |
| Slash, Cut Throat, Cleave, Rend, Lunge, Skewer, Strike, Bite, Claw, Smash… | `slash` | physical | melee single | dodge+crit | ✅ display names over one kind |
| Shoot, Wind Shot, Thunder Arrow | `arrow` | physical | ranged single (rearmost) | dodge+crit | ✅ shipped kind — Wind Shot/Thunder Arrow are physical Skills riding it as display names (E5-D14) |
| Staff Attack | `staff` | physical | melee single | dodge+crit | ✅ shipped — casters' front-row fallback stays (E5-D5) |
| Shield Bash / Pierce | `bash` | physical | melee single | dodge+crit | ✅ shipped kind, 🟡 Pierce display |
| Magic Bolt (Wizard/Sorceress), Lightning (Valkyrie) | `bolt` **NEW** | magic | ranged single | ZERO (magic never draws) | ✅ new kind, rides balanceVersion (4.7 bash precedent); users scoped by E5-D14 |
| Blast | `blast` | magic | row AoE (fullest row) | zero | ✅ kind stays in engine for replay; NO class uses it this era — reserved for future Archmage (E5-D4) |
| Ember/Frost/Storm/Acid/Dread/Radiant Breath | `breath` **NEW** | **physical** (E5-D7) | row AoE (blast rule) | ZERO — draws exist only on single-target physical hits; pin with a test | ✅ new kind |
| Guard (Full) / Guard (Half) | `guard-full` / `guard-half` | — | one-shot shield: self + ally behind | zero | ✅ shipped (4.7) |
| Heal, Witch's cast | — | — | FR16 spell system | zero | ✅ NOT move-table rows |

Per-class display names need the shell's move-plate map to key on (class, kind), not kind
alone — small 5.4 shell task, noted for create-story.

## Humans — wave 5.4

| Class | Code | Sex | Role | Front | Mid | Back | Growth HP/STR/VIT/INT/MEN/AGI/DEX | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Knight | KNI | M | Vanguard | Slash ×2 | Guard-Half ×1 | Slash ×1 | 5/5/4/3/4/4/3 | ✅ unchanged from shipped |
| Mercenary | MER | M | Skirmisher | Cut Throat ×2 | Cut Throat ×1 | Cut Throat ×1 | 4/4/4/4/4/4/4 | ✅ E5-D9 (display rename only; kind `slash`) |
| Berserker | BER | M | Vanguard | Cleave ×2 | Cleave ×1 | Cleave ×1 | 5/5/5/3/4/4/5 | ✅ display "Cleave" (axe) — E5-D10 |
| Phalanx | PHA | M | Vanguard | Guard-Full ×1 | Guard-Full ×1 | Pierce ×1 | 5/4/5/3/4/3/3 | ✅ E5-P2 accepted: shipped front+mid wall kept; guard rows 1 action (re-records: YES); back displays "Pierce" over `bash` |
| Ninja | NIN | M | Skirmisher | Rend ×2 | Rend ×1 | Rend ×1 | 4/5/3/4/4/6/4 | ✅ display "Rend" (claws) — E5-D10 |
| Fencer | FEN | M | Skirmisher | Lunge ×2 | Lunge ×1 | Lunge ×1 | 5/5/4/3/4/5/5 | ✅ NEW — E5-D10 |
| Dragon Hunter | DRH | F | Dragonslayer | Skewer ×2 | Skewer ×1 | Skewer ×1 | 4/4/4/3/4/5/5 | ✅ NEW — E5-P1 accepted (made-up class, ×1.5 vs Dragon role) |
| Wizard | WIZ | M | Artillery | Staff ×1 | Magic Bolt ×1 | Magic Bolt ×2 | 3/3/3/6/4/3/3 | ✅ E5-D4 — NO MORE SPLASH (re-records: YES) |
| Sorceress | SOR | F | Artillery | Staff ×1 | Magic Bolt ×1 | Magic Bolt ×2 | 3/3/3/5/5/3/3 | ✅ E5-D4 (re-records: YES) |
| Cleric | CLE | F | Support | Heal/Staff | Heal/Staff | Heal ×2 | 4/3/4/5/5/3/3 | ✅ unchanged (FR16 heal) |
| Witch | WIT | F | Control | Cast | Cast | Cast ×2 | 4/3/3/6/5/4/4 | ✅ unchanged (FR16 status) |
| Archer | ARC | F | Sniper | Shoot ×1 | Shoot ×2 | Shoot ×2 | 4/4/4/3/4/4/5 | ✅ unchanged |
| Valkyrie | VAL | F | Skirmisher | Pierce ×2 | Pierce ×1 | Lightning ×2 | 4/4/4/4/4/4/4 | ✅ E5-D10: back-row `bolt` "Lightning" (re-records: YES); melee display "Pierce" (spear); INT 12→18 approved ✅ |
| Hawkman | HAW | M | Skirmisher | Talon Strike ×2 | Talon Strike ×1 | Talon Strike ×1 | 4/4/4/3/3/4/3 | ✅ NEW — E5-D10; flying is FLAVOR only |
| Vultan | VUL | M | Skirmisher | Talon Strike ×2 | Talon Strike ×1 | Wind Shot ×2 | 5/5/4/3/4/6/4 | ✅ NEW — back-row shot rides `arrow`, physical (E5-D14) |
| Raven | RAV | M | Skirmisher | Talon Strike ×2 | Talon Strike ×1 | Thunder Arrow ×2 | 5/5/4/3/4/5/5 | ✅ NEW — back-row shot rides `arrow`, physical (E5-D14) |

### Descriptions (original — not OB64's)

- **Knight** — Steel from boot to brow. He promised someone he'd hold the line, and he intends to keep the promise.
- **Mercenary** — Average sword, average armor, immaculate invoice. Loyal to the coin, reliable to the letter.
- **Berserker** — He doesn't block. He has never needed to learn how.
- **Phalanx** — A one-man shield wall. Getting past him is a career, not a move.
- **Ninja** — You'll hear the wind. That's all you'll hear.
- **Fencer** — A greatsword is supposed to be slow. Nobody told him.
- **Dragon Hunter** — She has studied scales, wings and fire — and concluded that dragons are just big lizards with a reputation.
- **Wizard** — He read every forbidden book twice. The second time for pleasure.
- **Sorceress** — Magic runs in her blood; she just signs her name to it.
- **Cleric** — She mends what battle breaks. Her faith has never lost a patient it could reach.
- **Witch** — One flick of her hat, and your battle plan belongs to her.
- **Archer** — She doesn't miss. The others call it luck; she calls it practice.
- **Valkyrie** — A spear from the halls of the gods, with the storm still on it.
- **Hawkman** — Born where the cliffs meet the sky. He fights like the air is his birthright.
- **Vultan** — Noble wing of an ancient line; the wind itself keeps his oaths.
- **Raven** — A hawkman who traded the sky's honor for the night's appetite.

## Monsters — wave 5.5 (2 slots + king-move ring unless noted)

| Class | Code | Role | Element (flavor only, E5-D6) | Front | Mid | Back | Growth | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Golem | GOL | Brute | — | Smash ×2 | Smash ×1 | Smash ×1 | 5/5/6/3/3/3/4 | ✅ shipped · display "Smash" (E5-D10); ONE Golem this era, tiers parked (E5-P4 accepted) |
| Gryphon | GRY | Beast | wind | Claw ×2 | Claw ×1 | Wind Shot ×2 | 4/4/4/3/4/6/4 | ✅ NEW — back-row shot rides `arrow`, physical (E5-D14) |
| Wyrm | WYR | Beast | — | Bite ×2 | Bite ×2 | Bite ×1 | 4/5/5/3/3/5/4 | ✅ NEW ("not a dragon" — OB64 agrees) |
| Hellhound | HEL | Beast | fire | Bite ×3 | Bite ×2 | Bite ×1 | 4/5/5/4/3/4/3 | ✅ NEW — first ×3 row in the game |
| Whelp | WHP | Dragon | — | Bite ×2 | Bite ×1 | Bite ×1 | 5/4/4/2/3/3/3 | ✅ NEW — **1 slot, small**: no reservation ring (E5-P3 accepted) |
| Emberdrake | EMB | Dragon | fire | Bite ×2 | Bite ×1 | Ember Breath ×1 | 6/6/5/3/4/4/4 | ✅ NEW |
| Frostfang | FRF | Dragon | ice | Bite ×2 | Bite ×1 | Frost Breath ×1 | 6/5/5/3/5/3/5 | ✅ NEW |
| Stormscale | STM | Dragon | storm | Bite ×2 | Bite ×1 | Storm Breath ×1 | 6/5/5/3/4/4/5 | ✅ NEW |
| Cragmaw | CRG | Dragon | earth | Bite ×2 | Bite ×1 | Acid Breath ×1 | 7/5/6/3/4/3/4 | ✅ NEW |
| Nightwing | NGT | Dragon | dark | Bite ×2 | Bite ×1 | Dread Breath ×1 | 6/6/5/4/4/3/5 | 🟡 NEW (was Duskwing — Danilo's rename) |
| Halowing | HAL | Dragon | light | Bite ×2 | Bite ×1 | Radiant Breath ×1 | 6/5/6/4/4/3/4 | ✅ NEW (name confirmed 2026-07-26) |

### Descriptions

- **Golem** — Clay given a heartbeat of magic. It knows one order: stand.
- **Gryphon** — Half lion, half eagle, all territory.
- **Wyrm** — Not yet a dragon, no longer a lizard. Big enough that the difference is academic.
- **Hellhound** — Two heads, one appetite. It bites faster than you can regret.
- **Whelp** — A dragon the size of a horse. Give it a year and it will be the size of a problem.
- **Emberdrake** — Where it sleeps, the ground forgets how to be cold.
- **Frostfang** — Its breath ends conversations, rivers, and campaigns.
- **Stormscale** — Thunder is just its heartbeat leaving the room.
- **Cragmaw** — Old as the mountains, and twice as opinionated about who crosses them.
- **Nightwing** — It flies only where the light has given up.
- **Halowing** — Dawn, wearing scales.

### Monster rules (E5-D13, decided 2026-07-27)

- **Leadership: only HUMANS can be crowned.** Monsters and the Whelp are leader-ineligible —
  every army needs at least one human. Golem+Emberdrake+Whelp is INVALID (no possible leader);
  Golem+Emberdrake+Knight ✓; Golem+Whelp+Knight+Cleric ✓. Eligibility is per-class data
  (race: human/golem/beast/dragon), not sizeClass — the race field lands in 5.5.
- **Caps confirmed as shipped:** max 2 sizeClass-monsters per army; monsters never share a
  column. The Whelp is a small — it does NOT count toward the 2-monster cap (Danilo-confirmed
  consequence: a 2-monster + Whelp army is legal, if a human leader is aboard).
- **Loom treatment:** every 2-slot monster reuses the Golem loom (dedicated frame,
  ≥48px-equivalent presence, one HP bar + code at the cell). The Whelp renders as a normal
  small — no loom, no reservation ring.

## Role vocabulary (E5-P1 — ACCEPTED 2026-07-26)

Shipped 7: Vanguard · Skirmisher · Sniper · Artillery · Support · Control · Brute.
Accepted +3: **Dragon** (all dragonkind), **Beast** (gryphon/wyrm/hellhound), **Dragonslayer**
(Dragon Hunter). New relation: Dragonslayer → Dragon, one-way ×1.5 (the Sniper→Support
pattern). Golem stays Brute (constructs). Future twin: Beastslayer → Beast, when a beast
slayer class lands (parked). All relations are versioned balance data.

## Engine stat rows — ✅ APPROVED by Danilo 2026-07-27 ("im happy with the values for now"; sweep-policed in 5.4/5.5 as always)

Growth values (2–7) are the intent; these are the real engine numbers, calibrated against the
shipped anchors: Knight 140/30/28/8/14/8/16 · Mercenary 110/26/20/10/14/14/18 ·
Ninja 85/22/10/8/12/28/30 · Golem 300/28/36/4/8/4/10. Shipped-12 rows are UNCHANGED except
the one amendment below. "Kill audit" = neutral Knight swings (damage 30 − VIT/2) to kill —
the 3–5-hit small band, with justified exceptions. All values sweep-policed (≤65%) in 5.4/5.5.

### New humans (5.4)

| Class | HP | STR | VIT | INT | MEN | AGI | DEX | Kill audit | Showcase (feeds the AI pool) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fencer | 100 | 27 | 16 | 8 | 13 | 20 | 24 | 22/hit → 5 | The duelist: wins 1v1s via crit/dodge (DEX 24); dies to focus fire |
| Dragon Hunter | 100 | 24 | 16 | 8 | 14 | 18 | 22 | 5 | Anti-dragon: Skewer ×1.5 vs Dragon role; ordinary vs everyone else |
| Hawkman | 105 | 24 | 18 | 8 | 12 | 16 | 16 | 5 | Reliable filler skirmisher — the budget mercenary |
| Vultan | 110 | 26 | 18 | 8 | 14 | 24 | 18 | 5–6 | Hybrid: melee front / Wind Shot (physical ranged) back |
| Raven | 105 | 26 | 16 | 8 | 13 | 22 | 20 | 5 | Aggressive hybrid: hits harder-crits more than Vultan, thinner |

**Valkyrie amendment ✅ (approved 2026-07-27):** INT 12 → 18 (rest of her shipped row unchanged) so back-row
Lightning (magic: INT − MEN/2 ≈ 11 vs MEN 14) lands as a real side gun ×2 casts, not a
nerf-trap. Without it her Lightning would do ~5/cast — strictly worse than her old slash row.

### New monsters (5.5)

| Class | HP | STR | VIT | INT | MEN | AGI | DEX | Kill audit | Showcase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Whelp | 130 | 26 | 22 | 4 | 10 | 8 | 10 | 7 | The budget dragon: 1-slot mini-bruiser; Dragon role = hunter counterplay |
| Gryphon | 220 | 26 | 24 | 6 | 14 | 26 | 18 | 13 | Fast monster: acts early (AGI 26), Wind Shot from back |
| Wyrm | 240 | 30 | 28 | 4 | 10 | 20 | 14 | 15 | All-row pressure (2/2/1 bites) — the mid-row monster |
| Hellhound | 220 | 28 | 24 | 6 | 10 | 18 | 12 | 13 | Glass-cannon monster: front Bite ×3 — highest melee burst in the game |
| Emberdrake | 270 | 34 | 26 | 6 | 14 | 16 | 16 | 16 | The damage dragon (STR 34; Ember Breath row-AoE from back) |
| Frostfang | 265 | 30 | 26 | 6 | 18 | 12 | 18 | 16 | The magic-resistant dragon (MEN 18 — casters struggle) |
| Stormscale | 260 | 30 | 25 | 6 | 14 | 18 | 20 | 15 | The fast dragon: early action + crit-leaning DEX |
| Cragmaw | 290 | 30 | 30 | 6 | 14 | 10 | 14 | 20 | The wall dragon — closest to Golem, but bites back harder |
| Nightwing | 265 | 32 | 26 | 8 | 14 | 12 | 18 | 16 | The assassin dragon: high STR + DEX lean |
| Halowing | 270 | 30 | 28 | 8 | 16 | 10 | 14 | 17 | The balanced holy dragon — no weakness, no spike |

Audit exceptions (justified): the Whelp sits at 7 hits — above the small band on purpose, it's
a mini-monster (the shipped Phalanx already sits far above the band at ~12). Monsters have no
hit band; magic is their clock (Wizard bolt at INT 30: ~22–23/cast vs dragons — ~12 casts,
same pace as the shipped Golem) plus the Dragon Hunter (~23/hit ×1.5 vs dragons — twice a
Knight's pace). Breath check: Emberdrake's back-row breath ≈ 24 to a whole row of
VIT-20 smalls, 1 action — strong but it costs the dragon's melee presence; wipeout
cross-engagement attenuation (the blast rule) must apply to `breath` too — 5.5 carry.

## Deferred and future (the endgoal roadmap — work recorded once, shipped when ready)

| Group | Classes | Why deferred | Unlocks when |
| --- | --- | --- | --- |
| Boosters ⏳ | Beast Tamer/Beast Master, Doll Master/Enchanter, Dragon Tamer/Dragon Master, Faerie | "Makes X stronger" needs a buff mechanic that doesn't exist | A future buffs era (E5-D2) |
| Status casters ⏳ | Gremlin (sleep kiss), Cockatrice (petrify), Vampire (life drain), Sphinx | Sleep/petrify/drain are new statuses (E5-D3) | The status era |
| Undead ⏳ | Zombie (M), Zombie (F), Skeleton, Ghost, Angel Knight, Goblin | Identity depends on status-immunity + sleep | The status era; Zombie M/F merge question parked (E5-P5) |
| Promoted humans 🔮 | Paladin, Black Knight, Cataphract, Ninja Master, Archmage (inherits SPLASH, E5-D4), Priest, Sword Master, Diana, Freya, Siren, Dragoon (superseded by Dragon Hunter?) | Promotion postponed post-link-play (D-0a, epic-4 dossier) | The promotion era |
| Advanced monsters 🔮 | Opinicus, Wyvern, Cerberus, Pumpkinhead, divine dragons (Quetzalcoatl, Flarebrass, Ahzi Dahaka, Hydra, Bahamut, Tiamat) | Advanced tiers + status mechanics | Later monster waves |

## Parked ideas (good ones, wrong era)

- **Sucker Punch** (Mercenary mid-row counter: struck unit attacks first, denies the damage) — a reactive/interrupt mechanic, new system → parked for a future combat era (E5-D9).
- OB64 "skill" damage formula research (skills ship as plain physical for now, E5-D7).
- Elements as real mechanics (weakness/resistance) — flavor-only this era (E5-D6).
- Golem material tiers (Clay→Stone→Mithril; OB64 ties them to transformation triggers).
- Beast Slayer class (the Beast-role counterpart of the Dragon Hunter).

## Downstream notes for 5.4/5.5 create-story

- `names.ts`: new M list entries (Fencer, Hawkman, Vultan, Raven), F (Dragon Hunter), and
  designation lists for Beasts and Dragons (Golem construct-list precedent).
- Leader eligibility becomes per-class data (race: human/golem/beast/dragon — E5-D13);
  validate + AI leader draw + Placement crown gesture all key on it (5.5, with the Whelp).
- Back-row Guard is forbidden as DATA (E5-D12a) — worth a cheap balance-data invariant test.
- Wipeout cross-engagement attenuation must cover `breath` like `blast` (5.5).
- Every new `UnitClass`/`MoveKind`/role value: union + every `Record` extension — typecheck early.
- Art shopping list (MJ pipeline): Fencer, Dragon Hunter, Hawkman, Vultan, Raven + 10 monsters.
- AI pool: single-unit substitutions first; caster archetypes (three-mages) re-tuned for bolt.
- Wizard/Sorceress/Valkyrie changes re-record goldens; both waves are sweep-policed (≤65%).
