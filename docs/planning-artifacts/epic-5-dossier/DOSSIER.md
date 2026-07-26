---
story: 5-1-the-roster-and-moves-dossier
status: signed-off # Danilo, 2026-07-27 — "i love it. im excited to proceed"; the decision set is final; 5.4/5.5/5.6 are unlocked
sittings-completed: [1, 2, 3]
created: 2026-07-25
updated: 2026-07-27
---

# Epic 5 Design Dossier — the roster and moves rulebook

> The single authoritative design record for Epic 5's content wave (story 5.1). Stories 5.4 (human roster wave), 5.5 (monster wave), and 5.6 (the unit-data card) implement THIS table — nothing here is discovered on the phone. Sections marked **PROPOSED** await Danilo's decision; **DECIDED** sections are final and dated. Every decision carries its OB64 evidence beside it (the epic-4 retro team agreement: source evidence BEFORE engine code).

## Constraint header — the fence this dossier designs inside

- **No new systems** (the Epic 5 fence): new content = new rows in existing tables. No new mechanics, statuses, targeting rules, or tactics. Mid-battle tactics and the tactic-roster extension stay deferred (deferred-work.md, Epic 6+).
- **`logVersion` 4 untouched all era.** New classes are new `UnitClass` values in setup/balance data (the 4.8 Golem precedent); new move verbs are `MoveKind` union values riding the balance hash (the 4.7 `bash` precedent). No event-shape change is on the table; §4 walks the confirmation.
- **ADR 0003 is frozen** (`docs/adr/0003-battle-stream-draw-order.md`): always-2-draws [dodge, crit] per finalized physical single-target hit; magic takes zero draws. **No new class or move may add a `battle`-stream draw site.** A proposed move that would is out of this era — redesign or defer.
- **Guard = Full/Half one-shot damage SHIELD** (epic-4 dossier §4, as amended 2026-07-19 in story 4.7): outermost post-pipeline reduction covering the guard and the ally directly behind, no redirect, zero draws. The superseded column-bodyguard text ABOVE that amendment is not a design input.
- **Monsters are single-cell + 8-neighbor king-move reservation** (epic-4 dossier §2, as amended 2026-07-20 in story 4.8; PRD FR38 amended at 5.0). New monsters reuse this model — per-monster DATA only, no new placement semantics.
- **`balanceVersion` is 9 today and stays 9 through this story** (zero code, zero bumps). Tick points this dossier feeds: 5.4 (humans + shipped-12 revision), 5.5 (monsters), conditionally 5.10 (verdict tuning).
- **ONE theme** (PO 2026-07-23) binds any UX note made here.

Era decisions that survive from Epic 4 are REFERENCED against `docs/planning-artifacts/epic-4-dossier/DOSSIER.md` — never copied, never edited there.

## Decision log

The normative class/move tables live in `ROSTER.md` (companion file, same folder) — this log holds the decisions and their evidence; the roster holds the current shape.

| # | Decision | Status | Date | Rationale / evidence |
|---|---|---|---|---|
| E5-D1 | The MVP CSV is the ENDGOAL roadmap (July 2026 target), not this era's shipping list; waves stay as agreed at the epic breakdown (5.4 humans, 5.5 monsters), with ship/defer markers in ROSTER.md | DECIDED | 2026-07-26 | Danilo: "keep what we agreed before … a full characters roadmap, my target goal" |
| E5-D2 | Booster classes (Beast Tamer, Doll Master, Dragon Tamer, Faerie + their advanced tiers) are DEFERRED entirely — "makes X stronger" is a buff mechanic that doesn't exist | DECIDED | 2026-07-26 | The epic fence (no new systems); Danilo picked defer over ship-stripped |
| E5-D3 | Status-dependent classes (undead, Gremlin, Cockatrice, Vampire, Sphinx) DEFERRED — sleep/petrify/life-drain/immunities are new statuses, "we do it later" | DECIDED | 2026-07-26 | Same fence; parked for a future status era |
| E5-D4 | **Wizard and Sorceress lose SPLASH: single-target casters from now on** (new `bolt` MoveKind — magic, ranged-single, zero draws). Row-AoE magic is reserved for the future Archmage tier and monsters. Re-records goldens; re-tunes caster archetypes (5.4) | DECIDED | 2026-07-26 | Danilo's OB64 research: base Wizard/Sorceress cast single-target Basic Magic; splash belongs to advanced tiers (`lordly-original-ob64-class-list-and-more.csv` rows 11–12, 28–29) |
| E5-D5 | Casters KEEP the physical staff front-row fallback (Danilo's wish-sheet front-row magic rewritten) | DECIDED | 2026-07-26 | Shipped, device-proven; keeps melee-blockade pressure meaningful vs casters |
| E5-D6 | Dragon elements KEPT as identity but FLAVOR-ONLY this era (display + art; no weakness/resistance math) | DECIDED | 2026-07-26 | "Keep simple for now, implement full mechanic in the future" |
| E5-D7 | OB64 "Skill"-type moves ship as PHYSICAL damage (incl. dragon breaths → new `breath` MoveKind: physical row-AoE, zero draws — ADR 0003 draws exist only on single-target physical). OB64 skill-formula research parked | DECIDED | 2026-07-26 | Danilo; low-INT dragon stat rows corroborate physical breaths |
| E5-D8 | Dragon names: Emberdrake (fire), Frostfang (ice), Stormscale (storm), Cragmaw (earth), Nightwing (dark), **Halowing (light)**, Whelp (young) | DECIDED | 2026-07-26 | Original-flavor direction — deliberate deviation from OB64's "Color + Dragon" naming; Halowing confirmed same day |
| E5-D9 | Mercenary: flat-4 growth profile ("average at everything, fights for money") + display move "Cut Throat" over kind `slash`. The Sucker Punch counter idea is PARKED — a reactive/interrupt mechanic is a new system (fence) | DECIDED | 2026-07-26 | Danilo's made-up class; theme-first stats; counter idea recorded in ROSTER.md parking lot |
| E5-P1 | Dragon Hunter: new made-up human class ("good vs dragons, not amazing") via role growth: +Dragon, +Beast, +Dragonslayer roles and a Dragonslayer→Dragon ×1.5 one-way relation. The role-vocabulary growth (7→10) is the flagged "bigger call", accepted | DECIDED | 2026-07-26 | Danilo's idea replacing OB64's OP Dragoon; relation model needs roles, not races — see ROSTER.md §Role vocabulary. Accepted by Danilo 2026-07-26 |
| E5-P2 | Guard fine-tune: Knight unchanged (slash/guard-half/slash); Phalanx KEEPS the shipped front+mid Guard-Full wall (wish-sheet mid-only withdrawn), back displays "Pierce" over `bash`; guard rows carry 1 action (a second same-turn raise is provably redundant — actions run back-to-back). Phalanx actions 2/1/1 → 1/1/1: re-records goldens in 5.4 | DECIDED | 2026-07-26 | Consecutive-action analysis; accepted by Danilo 2026-07-26 |
| E5-P3 | Whelp: 1-slot SMALL dragon (no king-move ring), melee-only, Dragon role (hunter + magic counterplay applies) — the "budget dragon" niche | DECIDED | 2026-07-26 | Accepted by Danilo 2026-07-26; stat row finalized in Sitting 2 |
| E5-P4 | ONE Golem class this era; Clay/Stone/Mithril material tiers parked (OB64 ties tiers to transformation triggers we don't have) | DECIDED | 2026-07-27 | Avoids 3 near-identical rows + 2 more art batches for little variety. Accepted by Danilo 2026-07-27 |
| E5-D10 | Flavor pack accepted: Berserker "Cleave", Ninja "Rend", Golem "Smash", Valkyrie melee "Pierce" + back-row Lightning (`bolt` ×2, actions 2/1/2); Fencer ("Lunge"), Dragon Hunter ("Skewer"), Hawkman/Vultan/Raven as tabled; codes FEN DRH HAW VUL RAV GRY WYR HEL WHP EMB FRF STM CRG NGT HAL | DECIDED | 2026-07-27 | Danilo: "ok" to the pack as tabled in ROSTER.md |
| E5-D11 | BROWSER battle history is expendable, golden TESTS are not (PO clarified same day): pre-era player history simply displays non-replayable per the shipped 3.2 version-gate — replay compatibility is never a reason to avoid a design change. Golden tests stay and re-record with each balance tick (5.4/5.5) as usual — the "re-records: YES" flags are their audit input | DECIDED | 2026-07-27 | Danilo: "if you mean tests records, ok i care about them. I dont care about the records in my browser" |
| E5-D12 | The two 4.7 rulings closed: (a) **back-row Guard is FORBIDDEN as a data rule** — no table row may set it; a future era wanting it must FIRST land the `attackMoveOf` scan-for-first-real-MoveKind fix; (b) **overlapping guards KEEP shipped behavior** (target's own charge spent first) — spending the weaker charge preserves the Full negate for the next hit, and goldens stay stable | DECIDED | 2026-07-27 | resolve.ts:451-455 / :466-473 read against source; deferred-work.md entries marked resolved-by-ruling |
| E5-D13 | Monster caps CONFIRMED as shipped (max 2 sizeClass-monsters per army; never same column) + NEW rule: **only HUMANS can be crowned leader** — monsters AND the Whelp are leader-ineligible, so every army needs ≥1 human. Eligibility becomes per-class data (race), not sizeClass. Carrier: 5.5 (with the race field) | DECIDED | 2026-07-27 | Danilo's examples: Golem+Emberdrake+Whelp INVALID (no leader); Golem+Emberdrake+Knight ✓; Golem+Whelp+Knight+Cleric ✓ |
| E5-D14 | Consistency ruling under E5-D7: Wind Shot & Thunder Arrow are SKILLS → physical → they ride the existing `arrow` kind as display names (Vultan, Raven, Gryphon). The magic `bolt` kind's only users: Wizard, Sorceress, Valkyrie's Lightning | DECIDED | 2026-07-27 | Skills-are-physical (E5-D7); also spares the hybrid fliers from needing caster INT for their back-row shot |
| E5-D15 | Engine-scale stat rows APPROVED for all 16 new/amended classes (ROSTER.md §Engine stat rows), incl. the Valkyrie INT 12→18 amendment; kill-audits recorded with justified exceptions (Whelp 7 hits — mini-monster niche; monsters clocked by magic + Dragon Hunter, not the small band) | DECIDED | 2026-07-27 | Danilo: "im happy with the values for now"; binding ≤65% sweeps stay with 5.4/5.5 per their ACs |
| E5-P5 | Zombie M/F: parked with the undead deferral; ruling for when they land = ONE class with an undead designation name list (Golem precedent), unless art/flavor demands two | DECIDED | 2026-07-26 | Engine sex is per-class (name streams); two near-identical classes cost codes/art/rows. Accepted by Danilo 2026-07-26 |

## §1 The class list and the source evidence (Sitting 1 — AC 1) — DECIDED 2026-07-26

**Evidence corpus received 2026-07-26** (Danilo's two-spreadsheet research, beside this file):

- `lordly-original-ob64-class-list-and-more.csv` — the OB64 reference extract (classes, per-row moves, descriptions, growth stats). The AC-1 source-evidence document.
- `lordly-my-mvp-wish-wip.csv` — Danilo's MVP wish list (WIP): the candidate roster with his readings. Advanced/promoted tiers are LISTED in the reference but out of this era (base classes only — promotion stays postponed, D-0a).
- `attack-names-and-more.csv` — the move catalog: name, damage type, element, description.

PO direction (2026-07-26): OB64 is the reference, NOT the target — deviations for fun/originality are welcome (class names, move names, elements). Deviations still get recorded per the OB64-fidelity convention.

**Sitting 1 outcome:** the era's class list is SETTLED in `ROSTER.md` — wave 5.4 humans (shipped 11 revised + Fencer, Dragon Hunter, Hawkman, Vultan, Raven), wave 5.5 monsters (Golem + Gryphon, Wyrm, Hellhound, Whelp + 6 named dragons), everything else deferred/future per E5-D1..D-3. Remaining 🟡 items are display-name flavor + E5-P4, closed in Sitting 2.

### OB64 reference material (the evidence sources)

From `docs/planning-artifacts/midjourney-asset-prompts-2026-07-23.md#Reference-material`:

- <https://www.ogrebattle64archive.com/female-class-guide.html> (and the male class guide on the same site)
- <https://www.spriters-resource.com/nintendo_64/ogrebattle64personoflordlycaliber/asset/44189/>
- <https://www.spriters-resource.com/nintendo_64/ogrebattle64personoflordlycaliber/asset/44190/>
- <https://archive.rpgamer.com/games/ob/ob64/ob64class.html>
- Danilo's Dropbox reference folder (guide link #5)

Evidence convention: each decided row/mechanic below carries a quote or `evidence-*.png` capture reference + link NEXT TO the decision. Where OB64 has no answer or Danilo deviates on purpose, the deviation is recorded explicitly with rationale.

### Role check (the 7-role vocabulary — GROWN to 10, E5-P1 accepted)

Every new class maps into Vanguard / Skirmisher / Sniper / Artillery / Support / Control / Brute (epic-4 dossier §1) **plus the three accepted additions: Dragon, Beast, Dragonslayer** (E5-P1 — the flagged "bigger call", decided 2026-07-26). One new relation: Dragonslayer → Dragon, one-way ×1.5 (the Sniper→Support pattern). Golem stays Brute. Future twin (parked): Beastslayer → Beast.

### Art shopping list

The dossier's settled class list doubles as the Midjourney shopping list for 5.9 (pipeline: prompt → batch → pick, per `midjourney-asset-prompts-2026-07-23.md`; the current 12 are complete in `ux-designs/midjourney/selected/`). Hand the list to Danilo's pipeline as soon as it settles.

## §2 Stat rows, codes, and the move table (Sitting 2 — AC 2) — DECIDED 2026-07-27

The complete class rows (stats, roles, sex, codes, slots, per-row moves+counts, engine-scale values, kill-audits, showcases) live in `ROSTER.md` — approved E5-D10/D15. Below: the shipped baseline the fine-tune revised, the walked keep-or-change table, and the two closed rulings.

### The shipped-12 baseline (recon-verified against `packages/engine/src/balance.ts` version 9, 2026-07-25)

Stats/roles/actions: epic-4 dossier §1 table (engine values match). The move table as SHIPPED (start-generic, 4.7):

| Class (engine key) | Code | Front | Mid | Back | Actions f/m/b |
|---|---|---|---|---|---|
| knight | KNI | slash | **guard-half** | slash | 2/1/1 |
| mercenary | MER | slash | slash | slash | 2/1/1 |
| archer | ARC | arrow | arrow | arrow | 1/2/2 |
| mage (Wizard) | WIZ | staff | blast | blast | 1/1/2 |
| cleric | CLE | staff | staff | staff | 1/1/2 |
| witch | WIT | staff | staff | staff | 1/1/2 |
| berserker | BER | slash | slash | slash | 2/1/1 |
| phalanx | PHA | **guard-full** | **guard-full** | bash | 2/1/1 |
| ninja | NIN | slash | slash | slash | 2/1/1 |
| valkyrie | VAL | slash | slash | slash | 2/1/1 |
| sorceress | SOR | staff | blast | blast | 1/1/2 |
| golem | GOL | slash | slash | slash | 2/1/1 |

(The Witch's cast and Cleric's heal are the FR16 spell system, not move-table rows — only their action counts and melee-fallback rows are in play here.)

### The owed 4.7 fine-tune (walked 2026-07-26, keep-or-change per class)

Display-name-only changes are SHELL work (the move-plate map keys on (class, kind) in 5.4) — balance data untouched, so they never re-record.

| Class | Ruling | Re-records existing battles (5.4 audit input) |
|---|---|---|
| knight | KEEP shipped (slash / guard-half / slash, 2/1/1) — E5-P2 | no |
| mercenary | display "Cut Throat" over kind `slash` (E5-D9); data unchanged | no |
| archer | KEEP shipped | no |
| mage (Wizard) | mid/back `blast` → `bolt` (E5-D4); staff front stays (E5-D5) | **YES** |
| cleric | KEEP shipped | no |
| witch | KEEP shipped | no |
| berserker | display "Cleave" (E5-D10) | no |
| phalanx | guard rows 1 action (actions 2/1/1 → 1/1/1); back displays "Pierce" over `bash` (E5-P2) | **YES** |
| ninja | display "Rend" (E5-D10) | no |
| valkyrie | back row → `bolt` "Lightning" (actions 2/1/1 → 2/1/2), melee display "Pierce" (E5-D10); INT 12→18 proposed in the Sitting-2 stat pass so Lightning lands | **YES** |
| sorceress | mid/back `blast` → `bolt` (E5-D4) | **YES** |
| golem | display "Smash" (E5-D10); ONE Golem this era (E5-P4) | no |

### New class rows

Template per class: HP / STR / VIT / INT / MEN / AGI / DEX · role · sex (name-stream key, D-1f) · UNIQUE 3-letter code (taken: KNI MER ARC WIZ CLE WIT BER PHA NIN VAL SOR GOL) · slot cost via `sizeClass` · actions f/m/b · moves f/m/b. Paper sanity audit per row: 3–5 neutral melee hits to kill a small + the class's intended showcase comp (feeds the 5.4/5.5 AI-pool work; binding ≤65% sweeps stay with 5.4/5.5).

### New move kinds (if any)

Each new attack verb = a `MoveKind` union extension riding `balanceVersion` only (the 4.7 `bash` precedent), stating its damage type for the 5.6 card glyph rule (blast/spell = magic; slash/arrow/bash/staff = physical). A move needing new mechanics (extra draws, statuses, targeting rules) violates the fence — redesign or defer.

### The two 4.7 deferred rulings — DECIDED 2026-07-27 (E5-D12; read against source)

1. **`attackMoveOf` back-row Guard fallback** (`packages/engine/src/resolve.ts:451-455`): **back-row Guard is FORBIDDEN as a data rule this era** — no move-table row may set `guard-full`/`guard-half` in the back row (our decided table has none). A future era that wants back-row Guard must FIRST land the scan-for-first-real-`MoveKind` fix. No 5.4 code change needed.
2. **Overlapping guards tie-break** (`packages/engine/src/resolve.ts:466-473`, `applyGuard`): **KEEP the shipped behavior** — the target's own charge is spent before a front ally's. Rationale: spending the weaker Half charge preserves the Full negate for the NEXT hit (efficient, not a bug), and recorded battles stay stable.

## §3 Monsters (Sitting 3 — AC 3) — DECIDED 2026-07-27

All satisfied in `ROSTER.md` §Monsters + §Monster rules + §Engine stat rows:

- Every monster reuses the shipped single-cell + 8-neighbor king-move reservation — per-monster DATA only (slot cost 2; the Whelp is deliberately a 1-slot small with no ring, E5-P3). Loom treatment stated: Golem-loom for every 2-slot monster; Whelp renders as a normal small.
- Dragons land WITH their counterplay in the same table (D-1b honored): the Dragon Hunter + the Dragonslayer→Dragon ×1.5 relation (E5-P1). Elements are flavor-only (E5-D6); breaths are physical row-AoE on the new `breath` kind, zero draws (E5-D7).
- Max-monsters (2) + never-same-column CONFIRMED as shipped, plus the new humans-only leader rule (E5-D13 — the Whelp doesn't count toward the monster cap, and no monster nor the Whelp can be crowned).

## §4 Versioning, downstream carries, and hand-off (AC 4) — CONFIRMED 2026-07-27 (awaiting whole-dossier sign-off)

### Versioning walk (walked against the SETTLED table)

- **NO `logVersion` bump this era — CONFIRMED.** The settled design adds: 15 new `UnitClass` values (setup/balance data — the 4.8 Golem precedent), 2 new `MoveKind` values (`bolt`, `breath` — ride `UnitAttacked.kind`'s existing field exactly as 4.7's `bash` did, hash-only), a per-class `race` field (static balance data, like `sizeClass`), 1 new relation + 3 new role values (versioned `roleRelations` data), and display-name maps (shell-side). NO new event type, NO payload change, NO shape change anywhere — `logVersion` 4 holds.
- `balanceVersion` (now 9) tick points: **5.4** (humans + any shipped-12 revision), **5.5** (monsters), **conditionally 5.10** (verdict tuning).

### Downstream carries (for the 5.4/5.5/5.6 create-story passes)

- Name-table growth per new class+sex (`names.ts`) — `rollName`'s exhaustion fallback must stay unreachable (the 4.2 forward-note).
- Draft grid + every army-row scene vs `BASE_WIDTH = 360` (the standing coupling-site rule — grep every comp-rendering scene).
- AI-pool newcomer representation: single-unit substitutions first (the 4.3 method); each class's showcase note in §2 feeds it.
- The 5.6 card reads everything live from `BALANCE` — the table's shape IS the card's content.
- New-class `UnitClass` union widening forces a row in every `Record<UnitClass, …>` (typecheck early — the 4.8 lesson); surface list sized for 5.4/5.5 at sign-off.

### PRD follow-ups (flagged, not edited here)

- FR38 wave wording (monster waves beyond Golem: beasts + dragons + the Whelp small-dragon).
- FR15 table growth (the settled roster; engine rows in ROSTER.md).
- FR14 role vocabulary growth 7→10 (Dragon/Beast/Dragonslayer + the Dragonslayer relation).
- Leader rule (humans-only, E5-D13) — wherever the PRD states leader designation (FR35 area).

## Sign-off

**SIGNED OFF by Danilo (PO), 2026-07-27** — "i love it. im excited to proceed." The decision set (E5-D1–D15) is final; `ROSTER.md` is the normative table. THE GATE IS OPEN: stories 5.4, 5.5, and 5.6 may now be created against this dossier. (The 4.1 precedent: a design story's review IS the PO sign-off; no code-review pass applies.)
