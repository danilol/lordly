# Story 1.6: Full class roster — Archer, Mage, Cleric, and Witch

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want all six classes fighting by their real rules,
so that the rock-paper-scissors mind-game is complete.

## Acceptance Criteria

1. **Given** armies containing Archers, **when** they act, **then** they target the rearmost occupied reachable row with FR8's column priority, 1/2/2 actions by row (FR9, FR15).
2. **Given** armies containing Mages, **when** they cast, **then** the blast hits every unit in the enemy row with most living units (tie → rearmost), ignoring reach, magic damage INT − MEN/2 with per-target RPS (FR10).
3. **Given** armies containing Clerics, **when** they act, **then** they heal the lowest-HP-% living ally (self included, capped at max HP, heal = INT × 1.25); with no damaged ally they make the weak STR staff attack using magic targeting (FR11).
4. **Given** a Witch with each element, **when** she casts (magic targeting, prefers unaffected targets, no damage — FR12), **then** Water→Sleep voids the target's remaining actions; Earth→Poison deals 15 at engagement end before judging; Fire→Weaken halves the target's damage; Wind→Confusion gives each target action a 50% seeded misfire onto its own side, fully specified per class: a confused melee/ranged attack strikes a uniformly random (seeded, `battle` stream) living ally of the confused unit; a confused Mage blasts its own fullest row; a confused Cleric heals a random living enemy; a confused Witch applies her spell to a random living ally; any action with no valid misfire target fizzles and is spent; same spell never stacks (FR16), **and** the `BattleEvent` union now covers the full closed set: `BattleStarted`, `PassStarted`, `UnitAttacked`, `UnitHealed`, `StatusApplied`, `ActionMisfired`, `ActionFizzled`, `ActionSkipped`, `PoisonTicked`, `UnitDied`, `EngagementEnded`, `BattleEnded` (AD-12).
5. **Given** the full roster, **when** CI runs, **then** every FR9–FR12/FR16 rule has unit tests, property tests still hold over all-class armies, and golden battles cover at least one battle per class (NFR2, ≥90% engine line coverage gate now enforced in CI — AD-7).

## Tasks / Subtasks

- [ ] Task 1: Complete the event union — `LOG_VERSION` 3 (AC: 4)
  - [ ] `UnitHealed { source, target, amount, hpAfter }` — `amount` is the EFFECTIVE hp restored (post-cap — FR11 states the cap explicitly, unlike damage's overkill semantics; document the asymmetry next to AttackTarget's overkill note)
  - [ ] `StatusApplied { source, target, spell: SpellKind }`
  - [ ] `ActionMisfired { unit }` — SPEC DECISION (record): a marker event immediately FOLLOWED by the redirected effect event(s) (`UnitAttacked`/`UnitHealed`/`StatusApplied` with the confused unit as source). AD-12's "one event per (actor, action)" reads as "don't split a blast per-target"; the marker+effect pair is the most renderable narration of a redirect
  - [ ] `ActionFizzled { unit }` — a spent action with no valid effect (confusion with no misfire target; witch cast whose final target is already affected — see Task 6)
  - [ ] `PoisonTicked { unit, damage, hpAfter }` — can kill (emit `UnitDied` after)
  - [ ] Bump `LOG_VERSION` to 3; union = the full closed 12; update events.test (version + shapes + `@ts-expect-error`)
- [ ] Task 2: Ranged & magic targeting in `targeting.ts` (AC: 1, 3, 4)
  - [ ] `selectRearmostTarget(attackerColIdx, candidates)` — FR9: same FR7 reach, eligible = living reachable enemies in the REARMOST occupied row (scan back→mid→front), then the ratified FR8 column chain (facing → center → attacker's-view left), same positional-index contract as `selectMeleeTarget`. Used by: Archer attacks, Cleric staff fallback, Witch casts ("magic targeting")
  - [ ] `selectBlastRow(candidates)` — FR10: the row with MOST living units, tie → rearmost (highest rowIndex); reach ignored entirely; returns rowIndex or undefined if none alive. Reused with own-side candidates for the confused Mage ("its own fullest row")
  - [ ] Unit tests: rearmost mirrors of the melee suite (rear shielding — a living BACK unit shields mid/front here? No: rearmost = only that row eligible; "arrows arc over the front line"), reach still applies (unreachable rear column doesn't extend eligibility), blast-row counts + rearmost tie, per-attack re-evaluation
- [ ] Task 3: Damage/heal formulas + the Weaken hook (AC: 2, 3, 4)
  - [ ] Export `magicDamage(attackerClass, defenderClass)` beside `physicalDamage`: `INT − floor(MEN/2)` → RPS floor → status → min-1 (worked values in Dev Notes)
  - [ ] Weaken (FR16) hooks the FIXED order for EVERY damage the weakened unit deals (melee, ranged, staff, blast per-target, misfired attacks): base → RPS → `floor(x/2)` if source weakened → min-1 clamp LAST. Extend the damage helpers with a `weakened: boolean` arg (still pure, table-testable)
  - [ ] `healAmount(clericClass)` = `floor(INT × 5/4)` (cleric: 30); effective restore capped at maxHp
  - [ ] Extend `test/damage.test.ts`: magic table (mage→knight 34, mage→archer 18, mage→mage 19, mage→cleric 18, mage→witch 20, mage→mercenary 23), weakened halving cases (incl. weakened+advantage), staff bonk clamps (cleric STR 8 vs most VIT → 1), heal 30
- [ ] Task 4: Status infrastructure in `resolve.ts` (AC: 4)
  - [ ] Per-unit status set (sleep/poison/weaken/confusion), engagement-scoped (single mode: whole battle); `StatusApplied` emitted on application; NO-STACK: a repeat application of the same spell to the same unit is wasted
  - [ ] Sleep: the unit KEEPS its queued turns but each emits `ActionSkipped { reason: 'asleep' }` and is spent (mirrors the 'dead' handling; narrates FR13's "sleeping units lose unspent actions" visibly)
  - [ ] Poison: at NATURAL engagement end only (all actions spent) — SPEC DECISION (record): an instant wipe short-circuits judging per FR18 ("instant win") and skips poison ticks; FR19's wipeout mode revisits in 1.10. Tick order: unit order A:0→B:2, living poisoned units only, 15 damage each (`PoisonTicked` + `UnitDied` on kill), THEN judging — a poison mutual wipe hits the `WipeState 'both'` → draw path built in 1.5's review
  - [ ] Weaken: consulted by every damage computation (Task 3 arg)
- [ ] Task 5: Class turns — Archer, Mage, Cleric (AC: 1, 2, 3)
  - [ ] Archer: one attack per action via `selectRearmostTarget`, physical damage with RPS (archer beats mage; knight beats archer); no target → `ActionSkipped 'idle'`
  - [ ] Mage: blast via `selectBlastRow` over ALL living enemies (reach ignored); ONE `UnitAttacked` with a `targets[]` entry per living unit in the row (per-target RPS + per-target weaken? — weaken is the SOURCE's status: one halving applies to all targets); each target's hp updated in unit order; `UnitDied` per kill AFTER the single `UnitAttacked` (in target order); wipe check after the turn (the existing UnitDied-gated scan covers it)
  - [ ] Cleric: heal target = living ally (self included) with LOWEST exact HP fraction — compare `hp_i × maxHp_j` vs `hp_j × maxHp_i` cross-multiplied, NEVER floored percents (same lesson as judging); tie → lowest unit index (SPEC DECISION: deterministic, documented); only if the chosen ally is DAMAGED (hp < maxHp) — else staff attack via `selectRearmostTarget` with physical damage (clamps to 1 vs nearly everything); heal emits `UnitHealed` with effective amount
- [ ] Task 6: Witch casts + Confusion (AC: 4)
  - [ ] Witch cast: eligible pool = living reachable enemies NOT yet affected by her spell → magic targeting over that pool; if none unaffected → magic targeting over the full reachable pool and the cast FIZZLES (`ActionFizzled` — SPEC DECISION: no-stack means a second application is wasted; fizzle is the honest narration); no reachable enemy at all → `ActionSkipped 'idle'`; successful cast → `StatusApplied` (spell from `BALANCE.elementSpells[witch.element]`), no damage
  - [ ] Confusion (FR16, wind): at the START of each action of a confused unit, draw `nextInt(battle, 0, 1)`: 0 → act normally; 1 → misfire. Misfire redirects (each preceded by `ActionMisfired { unit }`): knight/mercenary/archer → attack a uniformly random living ALLY (self excluded; pick via `nextInt(battle, 0, n-1)` over allies in unit order) with the normal damage pipeline; mage → blast its OWN fullest row (`selectBlastRow` over living allies incl. self? — SPEC DECISION: own row selection counts ALL living own-side units including the mage; the blast hits every living unit in that row, possibly the mage itself); cleric → heal a random living ENEMY (uniform pick, same draw pattern); witch → apply her spell to a random living ALLY (self excluded; if that ally already affected → `ActionFizzled` after the `ActionMisfired`, no stack); NO valid misfire target (e.g. no living allies) → `ActionMisfired` then `ActionFizzled`, action spent
  - [ ] STREAM-ORDERING (FR20 — extend the invariant comment): battle-stream draw order is: ① the engagement tie flip (FIRST, unchanged), then ② per confused action in timeline order: one misfire draw, then (only if misfiring AND a uniform pick is needed) one target draw. Nothing else draws. Friendly-fire deaths make mutual wipes reachable — `'both'` → draw already handled
  - [ ] Sleep/dead interaction: a misfire can kill an ally → normal `UnitDied` + wipe check; a confused SLEEPING unit never acts (asleep skip wins — sleep voided its actions)
- [ ] Task 7: Tests, goldens, migrations (AC: 5)
  - [ ] MIGRATION (1.5 tests WILL break, by design): `turnsByPass` must count a turn's FIRST event only — turn-starting events are `ActionSkipped | ActionFizzled | ActionMisfired | UnitAttacked | UnitHealed | StatusApplied`, but an effect event immediately following an `ActionMisfired` for the same actor is NOT a new turn (document in the helper); the 0xbeef anchor re-pins AGAIN (mage/cleric/witch now act — deliberate, comment it); events.test LOG_VERSION → 3; the "1.4 ordering" tests' expected sequences survive (same actors, different event types via the extended helper)
  - [ ] Per-FR unit tests: FR9 rearmost + reach + column chain + re-evaluation; FR10 row choice, tie→rearmost, per-target RPS, multi-kill event order, reach ignored; FR11 lowest-exact-fraction choice (incl. a floored-percent-tie case), self-heal, cap, undamaged→staff, staff clamp; FR12 magic targeting + prefer-unaffected + fizzle-on-all-affected; FR16 each spell (sleep voids visibly, poison ticks/kills/skipped-on-wipe, weaken halving order, confusion both branches per class incl. fizzle); no-stack for every spell
  - [ ] Properties over the full roster (all classes now act): termination (new ceiling — statuses/misfires add events; compute it), seed identity, non-mutation, damage ≥ 1 / hpAfter ≥ 0 / heal amount ≥ 0 and hp ≤ maxHp invariants
  - [ ] Goldens: extend so every class ACTS in at least one golden — add (4) archer showcase, (5) mage blast with a multi-kill, (6) cleric save + staff bonk, (7) witch battle per element where feasible (sleep + poison in one, weaken + confusion in another is fine); keep 1.5's three
  - [ ] Coverage: existing suites keep passing; new src lines covered
- [ ] Task 8: Activate the ≥90% engine coverage gate (AC: 5, AD-7)
  - [ ] Uncomment the prepared glob in root `vitest.config.ts` → `'packages/engine/**': { lines: 90 }` (the 1.1 placeholder exists for exactly this moment); verify `pnpm coverage` enforces it (engine sits ~95%)
  - [ ] Full gate green: `pnpm -r typecheck`, `pnpm coverage`, `pnpm --filter web build`

## Dev Notes

### Magic damage worked examples (balance v1 — mage INT 30; pin in tests)

| Target | MEN → floor/2 | base | RPS | damage |
|---|---|---|---|---|
| knight | 14 → 7 | 23 | ×3/2 (mage beats knight) | 34 (floor 34.5) |
| archer | 12 → 6 | 24 | ×3/4 (archer beats mage) | 18 |
| mage | 22 → 11 | 19 | ×1 | 19 |
| cleric | 24 → 12 | 18 | ×1 | 18 |
| witch | 20 → 10 | 20 | ×1 | 20 |
| mercenary | 14 → 7 | 23 | ×1 | 23 |

- Weaken order example: weakened mage vs knight → base 23 → ×3/2 = 34 → floor(34/2) = 17 → min-1 → 17.
- Cleric heal = floor(24 × 5/4) = 30. Cleric staff: STR 8 − floor(VIT/2) → 1 vs knight/merc (clamp), 2 vs archer/cleric... compute per table; mostly the clamp's living showcase.
- Archer physical: vs mage 24 − 4 = 20 ×3/2 = 30; vs knight 10 ×3/4 = 7 (already in damage.test).

### Spec decisions this story RECORDS (each also goes in a code comment)

1. **ActionMisfired = marker + effect pair** (Task 1) — AD-12 interpretation.
2. **Poison skipped on instant wipe** (Task 4) — FR18 "instant win" short-circuits; 1.10 revisits for wipeout mode.
3. **Cleric heal tie → lowest unit index**, fractions compared exactly (Task 5).
4. **Witch fizzle when every reachable enemy already affected** (Task 6) — no-stack narration.
5. **Confused mage's own-row selection includes the mage itself** as a countable/hittable unit (Task 6).
6. **Misfire ally picks exclude self** (knight/merc/archer attacks, witch spell); cleric's enemy pick is any living enemy.
7. **UnitHealed.amount is effective (post-cap)** while AttackTarget.damage stays computed (overkill) — asymmetry documented on both types.

### Previous story intelligence (1.5 + its review — critical)

- **`WipeState 'both'` → draw is ALREADY BUILT** (1.5 review) precisely for this story's poison/friendly-fire mutual wipes — do not reinvent; just route poison/misfire deaths through the existing UnitDied-gated wipe scan.
- **Overkill semantics documented on `AttackTarget`** — blast targets inherit it (damage computed, hpAfter authoritative). Heals differ (see decision 7).
- **The damage pipeline lives in exported pure helpers** (`physicalDamage` — extend, don't fork; add `magicDamage` beside it). The weaken arg keeps them table-testable; the 11-case damage.test grows.
- **`selectMeleeTarget`'s positional-index CONTRACT** (documented in targeting.ts) applies to the new selectors: projections must stay parallel.
- **Priority-② inertness note** (targeting.ts) applies to rearmost targeting identically — same geometry.
- **Purity guard**: no new src FILES are strictly required (extend targeting.ts/resolve.ts), but if the dev splits (e.g. `statuses.ts`), the exact file list in purity.test.ts must grow — the guard WILL fail otherwise (by design).
- **Stream ordering:** tie flip FIRST, confusion draws after, in timeline order — extend the prominent comment in resolve.ts; the determinism anchors are the tripwire (re-pin deliberately, hand-verify like 1.4's coin-flip lesson: verify WHICH unit acts, not just that tests pass).
- **Toolchain:** PATH prefix `$HOME/.nvm/versions/node/v24.16.0/bin`; pnpm from repo root; goldens re-record ONLY via deliberate `vitest -u` with the diff reviewed.

### Scope fences (things this story must NOT do)

- NO AI (1.7), NO sim harness (1.7), NO wipeout loop (1.10 — `mode: 'wipeout'` stays REJECTED by validation), NO web changes, NO new deps, NO CI workflow changes (the coverage gate is a vitest.config.ts edit, not a ci.yml edit), NO balance data changes (every constant this story needs is already in BALANCE — version stays 1, hash `bfce425a` valid).
- Elements stay cosmetic for non-witch classes (FR3) — no elemental damage interactions (post-MVP wheel).
- DEX stays reserved — no miss/crit anywhere (confusion's misfire is NOT a miss mechanic; every executed attack hits).

### Project Structure Notes

- Extend `targeting.ts` (rearmost + blast-row selectors), `resolve.ts` (class turns, statuses, poison, confusion), `types.ts` (5 events, LOG_VERSION 3), `index.ts` (exports). New tests beside the existing suites; goldens grow in `golden.test.ts` + snapshots. Root `vitest.config.ts` threshold uncomment (Task 8).
- If resolve.ts grows unwieldy, a `statuses.ts` or `turns.ts` split is acceptable — remember the purity list.

### References

- [Source: docs/planning-artifacts/epics.md#Story-1.6] — ACs (verbatim source of truth)
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#FR9, #FR10, #FR11, #FR12, #FR13, #FR14, #FR15, #FR16, #NFR2]
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-7 (coverage gate), #AD-10 (battle stream), #AD-12 (full union)]
- [Source: docs/implementation-artifacts/1-5-melee-combat-damage-and-judging.md#Review-Findings] — WipeState 'both', overkill semantics, exported damage helpers, index contract, ratified FR8 tiebreak

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
