---
story: 4-1-the-epic-4-design-dossier
status: signed-off # Danilo, 2026-07-17 — the decision set is final; ADR 0003 is frozen; story 4.2 is unlocked
sittings-completed: [1, 2, 3, 4]
created: 2026-07-17
updated: 2026-07-17
---

# Epic 4 Design Dossier — the squad era's rulebook

> The single authoritative record of every rules-era design decision (story 4.1). Everything here gates the implementing stories 4.2–4.12: story 4.2's single `logVersion` bump ships the COMPLETE union extension designed in §5 (AD-15); no monster story runs before §2 is decided (FR38); the UX extension in §6 is the implementation contract for every new surface. Sections marked **PROPOSED** await Danilo's decision; **DECIDED** sections are final and dated.

## Decision log

| # | Decision | Status | Date | Rationale |
|---|---|---|---|---|
| D-0a | Archmage-style promotion: postponed until AFTER link-play | DECIDED (carried) | 2026-07-17 | PO: promotion wants most/all classes present; this era fields first-level classes only |
| D-0b | FR39g pause control: dropped for wave 1 | DECIDED (carried) | 2026-07-17 | PO: speed/skip suffice; revisit post-wave |
| D-1a | 7-role vocabulary + relation model | DECIDED | 2026-07-17 | Reproduces shipped matchups as the degenerate case; new classes inherit by role |
| D-1b | Roster is Danilo's OB64-authentic gender-split list; **wave 1 ships GOLEM as the only monster** — dragons + beasts arrive in a later wave TOGETHER WITH their slayer classes | DECIDED | 2026-07-17 | PO: "don't go deep on monster mechanics right now"; deviation from PRD FR38's "dragon and golem" — flagged for the PRD follow-up |
| D-1c | Mercenary stays (roster = exactly 12: 11 smalls + Golem) | DECIDED | 2026-07-17 | Shipped class; history renders it; lands the PRD's 12 |
| D-1d | Mage → "Wizard" is a DISPLAY rename only (engine key stays `mage`; code MAG → WIZ shell-side) | DECIDED | 2026-07-17 | AD-11: display names are shell-side lookups (the Turn/pass pattern); full engine rename would orphan pre-era history rendering |
| D-1e | Golem's magic weakness is PURE STATS (low MEN), no Artillery→Brute relation | DECIDED | 2026-07-17 | The FR15 formula does it natively (magic = INT − MEN/2); nothing for the next monster wave to inherit unwanted |
| D-1f | Gender split (M: Knight/Wizard/Berserker/Phalanx/Ninja · F: Cleric/Witch/Valkyrie/Archer/Sorceress) is recorded product direction — flavor now, growth/promotion hooks post-link-play | DECIDED | 2026-07-17 | OB64-authentic; Sorceress = Wizard twin "differentiated by growth", so wave-1 stats are a close variant |
| D-2a | Guard = column BODYGUARD: engagement-long stance, redirects single-target PHYSICAL attacks aimed at the ally directly behind; magic/status bypass | DECIDED | 2026-07-17 | Danilo's design ("a knight in the middle guards a mage"); arrows MUST be interceptable or Guard protects nothing (melee already blocked by FR8, magic bypasses by rule) — **SUPERSEDED 2026-07-19 (Danilo, story 4.7): Guard is now a one-shot Full/Half damage SHIELD (self + the ally behind), not a redirect. No retarget: the attacked unit stays the target and takes the reduced/zero number; the guard takes nothing. See §4's amendment below for the full revision.** |
| D-2b | Move table minimal: Knight mid=Guard, Phalanx front+mid=Guard, Wizard/Sorceress front=Staff Attack; all else uniform | DECIDED | 2026-07-17 | "Start generic"; Guard rows are the rows with someone behind |
| D-2c | Blast under Attack Leader targets the leader's row; other tactics leave the blast autonomous | DECIDED | 2026-07-17 | Danilo + OB64 sourcing: AoE treats the leader as focal point; magic always reaches the leader |
| D-2d | Leader fall = sober package: plain-Autonomous reversion, dealt ×3/4 / taken ×5/4, no perks | DECIDED | 2026-07-17 | Deterministic — zero new stream draws; "panicked" variant rejected for this era |
| D-2e | Crit/dodge: always-2-draws [dodge, crit] per physical single-target hit; magic neither crits nor dodges; chances DEX/3, crit ×3/2 after RPS | DECIDED | 2026-07-17 | Fixed count = auditable forever → ADR 0003 (frozen) |
| D-2f | Golem semantics: targeted at either cell / blocks both rows / hit once by row effects / counts per occupied row; ACTS from its anchor | DECIDED | 2026-07-17 | One rule per direction, no special cases; PRD hit-once assumption confirmed |
| D-3a | The FR39b ledger = the OB64 move-name plate + economy pips over the acting unit | DECIDED | 2026-07-17 | Danilo's animation-off reference capture; transient, zero standing chrome, unifies FR32 move names + FR16 spell names |
| D-3b | 4.4→4.5 window: Attack Leader is GREYED OUT in the tactic picker until leader designation ships | DECIDED | 2026-07-17 | No invisible defaults (readiness minor #3) |
| D-3c | Golem body ≥48px spanning both cells; one HP bar + code at anchor | DECIDED | 2026-07-17 | AD-14 one-unit identity on screen (readiness minor #4) |

## §1 Roles & the 12-class roster (FR14/FR15) — DECIDED 2026-07-17

### Roles (7) and relations

Vanguard · Skirmisher · Sniper · Artillery · Support · Control · Brute.

Relations (versioned balance data; REPLACES `rpsBeats`/`rpsHunts` at story 4.3, AD-4):

| Relation | Kind | Reproduces |
|---|---|---|
| Artillery → Vanguard | symmetric ×1.5 / ×0.75 | mage→knight |
| Vanguard → Sniper | symmetric | knight→archer |
| Sniper → Artillery | symmetric | archer→mage |
| Sniper → Support | one-way ×1.5 | archer→cleric |
| Sniper → Control | one-way ×1.5 | archer→witch |

Skirmisher and Brute carry **no relations** (Mercenary stays fully neutral — continuity ✓; Brute's power is its stats, checked by focus-fire, tactics, and low MEN). **Continuity proof:** mapping the six shipped classes to their roles reproduces today's `rpsBeats`/`rpsHunts` maps exactly — the FR14 degenerate-case constraint holds.

### The wave-1 class table (12 classes — TUNING DRAFTS, sweep-policed per implementing story)

| Class (engine key) | Display | Code | Role | Sex | Slots | HP | STR | VIT | INT | MEN | AGI | DEX | Actions f/m/b |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| knight | Knight | KNI | Vanguard | M | 1 | 140 | 30 | 28 | 8 | 14 | 8 | 16 | 2/1/1 |
| mercenary | Mercenary | MER | Skirmisher | M | 1 | 110 | 26 | 20 | 10 | 14 | 14 | 18 | 2/1/1 |
| archer | Archer | ARC | Sniper | F | 1 | 90 | 24 | 12 | 10 | 12 | 22 | 24 | 1/2/2 |
| mage | **Wizard** | **WIZ** | Artillery | M | 1 | 80 | 6 | 8 | 30 | 22 | 12 | 14 | 1/1/2 |
| cleric | Cleric | CLE | Support | F | 1 | 90 | 8 | 12 | 24 | 24 | 10 | 12 | 1/1/2 |
| witch | Witch | WIT | Control | F | 1 | 85 | 6 | 10 | 26 | 20 | 26 | 16 | 1/1/2 |
| berserker | Berserker | BER | Vanguard | M | 1 | 120 | 34 | 14 | 6 | 10 | 12 | 18 | 2/1/1 |
| phalanx | Phalanx | PHA | Vanguard | M | 1 | 150 | 22 | 34 | 6 | 18 | 6 | 12 | 2/1/1 |
| ninja | Ninja | NIN | Skirmisher | M | 1 | 85 | 22 | 10 | 8 | 12 | 28 | 30 | 2/1/1 |
| valkyrie | Valkyrie | VAL | Skirmisher | F | 1 | 105 | 24 | 16 | 12 | 16 | 20 | 20 | 2/1/1 |
| sorceress | Sorceress | SOR | Artillery | F | 1 | 78 | 6 | 8 | 28 | 20 | 16 | 15 | 1/1/2 |
| golem | Golem | GOL | Brute | — | **2** | 300 | 28 | 36 | 4 | **8** | 4 | 10 | 2/1/1 |

Notes: shipped-six rows are UNCHANGED (continuity). Ninja is the crit/dodge showcase (AGI 28 now the fastest — overtaking Witch 26 is a deliberate tuning question for the sweep). Phalanx is the slowest small and the natural Guard (FR33) showcase. Sorceress ≈ Wizard with a faster/lighter spread (the "different growth" twin at fixed stats). Golem: physical wall (VIT 36, HP 300) that melts to magic (MEN 8 → Wizard hits it for 26/cast vs Knight's 12/swing — magic kills it ~2× faster); HP 300 is the first sweep target when monsters ship (4.8).

### Slot schema (replaces `armySize` at story 4.2 — AD-1)

`slotBudget: 5` (balance data) · per-class `sizeClass: 'small' | 'monster'` · `slotCost` = 1 for small, 2 for monster (derived from sizeClass, one source). Army legality = `slotTotal(army) === slotBudget`; max 2 monsters; monsters never share a column (FR38 — placement semantics in §2).

### Sweep-validation note (honest deviation from the story task)

A design-time sweep of the wave-1 roster is not executable against today's engine: the new classes don't exist in the `UnitClass` union, the harness drafts 3-unit armies, and Golem needs footprint semantics (§2) — building all that IS stories 4.2/4.3/4.8. Replaced at design time by the hit-count arithmetic audit above (3–5 neutral hits for smalls ✓); the BINDING ≤65 % sweeps run per implementing story exactly as their ACs already demand (4.3 for the 11 smalls, 4.8 for Golem comps).

## §2 Monster two-cell semantics (FR38, Golem-only wave) — DECIDED 2026-07-17

Two rules, one sentence each (AD-14: implemented once in the engine's targeting module, consumed everywhere):

- **TARGETED:** the Golem is a valid target wherever either of its two cells qualifies (melee nearest-row, ranged rearmost, blast row); it **blocks both rows of its column** for the melee blockade; **row-scoped effects hit it once** (PRD assumption CONFIRMED); for the blast's "row with most living enemies" count it counts in each row it occupies.
- **ACTS:** always **from its anchor row** (the front-most cell, AD-14) — action count, move-kind, and FR13's front-before-back tie-break all read the anchor. No special cases.

## §3 Crit & dodge + the frozen draw table (FR36, AD-10) — DECIDED 2026-07-17 → **ADR 0003**

Structure (frozen forever — see `docs/adr/0003-battle-stream-draw-order.md` for the full table):

- **Always exactly 2 draws per finalized physical single-target hit, order [dodge, crit]** — crit drawn even on a dodge, result discarded. Fixed count = auditable forever.
- **Magic neither crits nor is dodged** (OB64 rule): blast/heals/status = 0 draws. Confusion draws keep their shipped positions verbatim.
- Chances (tuning data): dodge% = defender DEX/3, crit% = attacker DEX/3, crit ×3/2 applied immediately after RPS in the FR15 fixed order. `missed` outcome reserved, unused wave 1 (one dodge draw, defender-attributed).
- Draws roll against the FINALIZED target — after tactics selection (Guard is no longer a redirect — see §4's amendment; the finalized target IS the actually-attacked unit, so A3/A4 resolve against it directly).

## §4 Moves, Guard, tactics, leader (FR32/FR33/FR34/FR35) — DECIDED 2026-07-17

### Guard (FR33) — the column bodyguard (Danilo's design) — SUPERSEDED, see amendment below

A unit whose row-move is Guard spends its action entering an **engagement-long guard stance**: while it stands, **single-target PHYSICAL attacks** (melee, arrows — including tactic-steered and misfire-redirected ones) aimed at **the ally directly behind it in its own column** are intercepted — **the attack redirects to the guard**, resolving against the guard's own defenses (dodge/crit roll vs the guard, per ADR 0003). **Magic and status bypass the guard entirely** — the Wizard's blast, the Witch's cast, and anything under Attack Leader that is magical reaches the protected unit ("magic always hits the leader"). Rationale: melee is already stopped by the FR8 blockade and magic bypasses by design — arrows are precisely what a bodyguard exists to stop; magic is the counter to turtling. Guarding with nobody behind = the stance does nothing (legal, wasted — the placement read is the player's).

#### Amendment (story 4.7, 2026-07-19, Danilo) — Guard is a Full/Half damage SHIELD, not a redirect

Danilo replaced the column-bodyguard redirect above with a cleaner two-tier shield, confirmed during 4.7's dev session ("one attack only" + "protects the ally behind too"):

- A Guard move (still one-shot, still engagement-scoped, still self + the ally directly behind) raises a charge that, on the NEXT landed single-target physical hit against either shielded cell, reduces the damage — **Full (Phalanx) → 0**, **Half (Knight) → floor(damage/2)**, re-clamped to `minDamage` — then the charge is spent (`GuardEnded`).
- **No redirect.** The attacked unit stays the target and takes the reduced/zero number; the guard itself takes nothing and is never retargeted onto. Because there's no retarget, story 4.6's A3 dodge (defender DEX) and A4 crit (attacker DEX) draws resolve against the ACTUAL target exactly as shipped — the frozen ADR 0003 draw order/count is completely untouched (the Guard reduction is the OUTERMOST post-pipeline step, after crit/Weaken/leader-fall, taking zero draws of its own).
- Magic/heals/status still bypass entirely (unchanged from the original design).
- `UnitAttacked.redirectedFrom` is repurposed (no union-structure change, comment-only) to carry the GUARDING unit's id — block attribution for the shell, not "the original target a bodyguard stepped in front of" (there is no such thing anymore).

This session's item 3 (re-read: "RPS recomputes against the guard") is GONE under the shield model — there is no retarget, so RPS/dodge/crit resolve against the real target as normal; there is nothing to recompute.

### The wave-1 move table (FR32 — minimal, "start generic")

| Class | Front | Middle | Back |
|---|---|---|---|
| Knight | 2× Sword Slash | **Guard (Half)** | 1× Sword Slash |
| Phalanx | **Guard (Full)** | **Guard (Full)** | 1× Shield Bash |
| Wizard / Sorceress | 1× weak Staff Attack (physical, melee targeting) | 1× blast | 2× blast |
| everyone else | unchanged — action COUNTS vary by row (FR15), move kind uniform | | |

Full vs Half tier is per-class balance data (`BALANCE.formulas.guardHalf` for the Half ratio; Full needs none — it sets damage to exactly 0).

### Tactics × non-standard actions (FR34 interactions, Open Item 3 closed)

- Single-target actions (melee, arrows, staff, Witch cast): the FR34 pipeline applies verbatim (Danilo's OB64 source re-validated it: Autonomous = global columns + row preference; target tactics dissolve rows too). **AMENDED 2026-07-18 (Danilo, story 4.4 device review):** "target tactics dissolve rows" holds ONLY for ranged/magic (they arc over the front). **MELEE is ALWAYS blocked by the front line** — a living front unit shields the rows behind it even under Attack Weakest/Strongest; a melee unit can never strike the back row through a front unit. Must-have mechanic.
- **Witch under a tactic:** prefer-unafflicted filters the legal list BEFORE the tactic sort; under Attack Leader she casts on the leader if unafflicted by her spell, else falls back to Autonomous.
- **Blast under Attack Leader: targets the leader's row** (Danilo, with OB64 sourcing — AoE treats the leader as the focal point); under every other tactic the blast keeps its own rule (most living, tie rearmost).
- Heals ignore tactics entirely. Last Stand precedes tactic application (pipeline unchanged).

### Leader fall (FR35) — the sober package

On a side's leader dying: tactic reverts to **plain Autonomous** (deterministic — zero new stream draws), the side's units deal **×3/4** physical damage and take **×5/4** for the rest of the battle (named versioned ratios, sweep-policed), **no initiative perks in wave 1**. The OB64-"panicked" random-targeting variant is explicitly rejected for this era (protects ADR 0003's simplicity).

## §5 The union extension & the render-surface walk (AD-12/AD-15) — DECIDED 2026-07-17

**The COMPLETE `logVersion` 3 → 4 extension (ships whole in story 4.2; AD-15 forbids a second bump):**

| Change | Carries | Emitted by story |
|---|---|---|
| `UnitAttacked.targets[].outcome: 'hit' \| 'crit' \| 'dodged'` (+ reserved `'missed'`, unused wave 1; damage 0 on dodge) | FR36 narration/animation | 4.6 |
| `UnitAttacked.kind: MoveKind` (`slash` / `arrow` / `blast` / `staff` / `bash`) | FR32 — the renderer's attackFlavor stops inferring from class (row-varied moves make class-inference WRONG) | 4.7 |
| `UnitAttacked.redirectedFrom?: UnitId` | REPURPOSED 2026-07-19 (comment-only, no union change): a Guard shield reduced this landed hit — carries the GUARDING unit's id (block attribution for the shell), not a retarget — the attacked unit stays `targets[].unit` | 4.7 |
| `GuardRaised { unit }` + `GuardEnded { unit }` | the stance beat + its engagement-end expiry as explicit events — NO shell-side lifecycle rule (the 2.2 StatusCleared lesson, applied from birth) | 4.7 |
| `StatusCleared { unit, spell }` | the story-2.2 deferral — between-engagement clears become log-driven; `clearStatusIconsExceptPoison()` dies | 4.2 |
| `LeaderFell { side, unit }` | FR35 penalty onset beat (ratios are static balance facts) | 4.5 |
| `PassStarted.actionsRemaining: Record<UnitId, number>` | the FR39b ledger's per-turn snapshot; per-beat decrements derive from observed action events | 4.2 (payload) / 4.11 (ledger UI) |

**Static-facts channel (AD-2 — in `MatchSetup`, NOT the log):** unit names (FR37), tactics, leader designations, Golem footprint (`footprintCells` helper), per-row action counts (balance). Reveal, History cards, and placement read these via engine helpers.

**The walk (every FR32–FR39 render surface × the extension):** battle-scene beats (crit emphasis / dodge whiff / interception step-in / guard stance marker / leader-fall banner / move-kind flavor) ✓ · action ledger (PassStarted snapshot + event decrements + static counts) ✓ · log-panel narration (every new event/payload has a one-line narration) ✓ · Reveal (tactic + leader crown from setup) ✓ · History cards (tactic/leader from stored setup) ✓ · Help/rules (static content) ✓ · wipeout seams (GuardEnded + StatusCleared at engagement end; poison persists unchanged) ✓. **No surface requires data the union + static channel cannot express — the AD-15 precondition for 4.2's bump HOLDS.**

## §7 Name generation (FR37) — DECIDED 2026-07-17 (flavor veto open at sign-off)

Curated per-sex name lists (~48 male, ~48 female — OB64-adjacent fantasy register), keyed to the roster's gender split (D-1f); the Golem draws from a small construct-designation list ("Bram", "Ogham", rune-flavored). Generator: ONE `names/X` stream draw per drafted unit (list index); if the name is already used by that army, advance deterministically to the next unused (no extra draws). Names are stored in `MatchSetup` (AD-9) — the table is engine data OUTSIDE the balance hash. Display surfaces: placement/reveal cards and the battle log-panel narration ("Kain (KNI) struck…"); the board keeps 3-letter codes (13px space); the ledger row carries the name (§6).

## §6 UX spine extension (UX-DR9) — DECIDED 2026-07-17 → written into the spines

The binding designs live IN `EXPERIENCE.md` ("Epic 4 extension" section) and `DESIGN.md` (Epic 4 component tokens) — dated, surgical, per the 4.0 amendment precedent. Decisions:

- **The action ledger IS the move-name plate (D-3a)** — sourced from Danilo's OB64 animation-off phone capture (`imports/OB64 references/images/screen_record_no_animation.mp4`, t≈40s: "Thunder Arrow" plate + damage-on-target + per-unit HP panels): a transient gold-framed plate over the ACTING unit naming its move and carrying its action pips (⚔ Sword Slash ●○). One element answers who/what/how-many-left; zero standing chrome; the FR16 spell names finally surface; the 2026-07-13 "move names/flavor" wish ships as a side effect. Fed by `UnitAttacked.kind` + `PassStarted.actionsRemaining` (§5).
- **Placement (D-3b):** tactic picker with **Attack Leader greyed out until story 4.5** (readiness minor #3 closed); tap-to-crown leader designation with visible clear-on-mutation; per-row action counts on the grid rows.
- **Golem renders ≥48px spanning both cells (D-3c)** — one body, one HP bar, one code at the anchor (readiness minor #4 closed).
- Reveal full disclosure, Guard shield marker + step-in interception animation, LeaderFell banner, names on cards + narration — all specified in the EXPERIENCE extension.

## §7 Name generation (FR37) — OPEN

## PRD follow-ups (flagged for the next bmad-prd touch, not done here)

- Open Item 3: fold the decided role table, class list, and mechanic answers into the PRD.
- Open Item 4: record "promotion postponed until after link-play" (closes the item).
- FR15: the wave-1 stat table (11 smalls + Golem; gender-split product direction).
- **FR38/FR15 deviation (D-1b): wave 1 ships Golem as the ONLY monster** — dragon moves to a later wave together with beasts and their slayer classes. Stories 4.8/4.9 scope shrinks accordingly (one monster class, same two-cell semantics).
