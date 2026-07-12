# Story 1.5: Melee combat, damage, and judging

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want two armies of Knights and Mercenaries to fight a complete engagement with a decided winner,
so that the battle core exists end to end before the full roster arrives.

## Acceptance Criteria

1. **Given** a `MatchSetup` with Knight/Mercenary armies, **when** the battle resolves, **then** melee targeting obeys reach (FR7: facing + adjacent columns) and nearest-occupied-row-no-bypass with facing → center → left priority, re-evaluated per attack (FR8).
2. **Given** an attack resolves, **when** damage is computed, **then** physical damage = STR − VIT/2 (integer math, floor rounding in fixed order, minimum 1) with RPS ×1.5/×0.75 per FR14–FR15, **and** the emitted `UnitAttacked` event carries source, target, damage, and HP-after (AD-12); deaths emit `UnitDied` and dead units lose unspent actions.
3. **Given** all actions are spent, **when** the engagement ends (FR17), **then** judging follows FR18: wipe = instant win, else higher team-HP-%, exact tie = `winner: 'draw'`, ending with `BattleEnded { winner, hpPct }`.
4. **Given** the engine test suite, **when** CI runs, **then** each FR7/FR8/FR14/FR17/FR18 rule has unit tests, a property test proves judging symmetry (swapping sides swaps the result), and at least 3 golden-battle snapshots guard regressions (NFR2).

## Tasks / Subtasks

- [ ] Task 1: Extend the event union — `UnitAttacked` + `UnitDied`, `LOG_VERSION` 2 (AC: 2)
  - [ ] `UnitAttacked` designed multi-target NOW to avoid a 1.6 breaking change (AD-12 names Mage blasts multi-target): `{ type: 'UnitAttacked', source: UnitId, targets: [{ unit: UnitId, damage: number, hpAfter: number }] }` — melee always emits a single-element `targets` array, one event per swing
  - [ ] `UnitDied { unit: UnitId }` — emitted immediately after the killing `UnitAttacked`
  - [ ] Bump `LOG_VERSION` to 2 (union extended — AD-12); union is now 7 members; update the `@ts-expect-error` closed-union test if needed
- [ ] Task 2: Reach and melee targeting in `packages/engine/src/targeting.ts` (AC: 1)
  - [ ] FR7 reach with owner-local coords (AD-11): the lanes are MIRRORED — own col index `i` faces enemy owner-local col index `2 − i`. Reachable enemy columns (owner-local enemy indices): own `left`→ enemy {right, center}; own `center` → all three; own `right` → enemy {left, center}
  - [ ] FR8 eligibility: among enemies in reachable columns ONLY, find the NEAREST occupied enemy row (enemy owner-local `front` is nearest to the attacker; scan front→mid→back); eligible = living reachable enemies in that row — a living front unit shields reachable units behind it, but an unreachable front unit shields nothing (no-bypass applies within reach)
  - [ ] FR8 priority among eligible: ① facing column (enemy col `2 − ownColIdx`) → ② column closer to center (enemy `center` next) → ③ ATTACKER'S-VIEW left over right — SPEC DECISION (record in code + story): "left" is the attacker's lane view; attacker-view index of enemy col = `2 − enemyColIdx`, so lower attacker-view index wins, i.e. HIGHER enemy owner-local col index first. Rationale: FR8 describes the attacker choosing; only matters for center attackers picking between two adjacent columns
  - [ ] Targeting re-evaluated PER ATTACK (each swing recomputes; a kill changes the next swing's target — FR8)
  - [ ] Melee unit with NO living reachable enemy: the action is spent and emits `ActionSkipped { reason: 'idle' }` (no bypass, no free retarget — real case: a corner unit whose two reachable columns are empty while enemies live in the far column)
  - [ ] Unit tests per rule: reach per column (corner=2, center=3), nearest-row shielding, unreachable-front-doesn't-shield, facing/center/left priority chain, per-attack re-evaluation after a kill, no-target action spent
- [ ] Task 3: Damage, deaths, and instant-wipe in `resolve.ts` (AC: 2, 3)
  - [ ] Damage formula (FR14/FR15, integer math in FIXED order): `base = STR − floor(VIT/2)` → `rps = floor(base × num/den)` (advantage 3/2 if `BALANCE.rpsBeats[attacker] === targetClass`, disadvantage 3/4 if `BALANCE.rpsBeats[target] === attackerClass`, else ×1) → (1.6 inserts status halving here) → `damage = max(minDamage, rps)`. The min-1 clamp is the FINAL step; a negative base (e.g. Mage STR 6 vs Knight VIT 28 → −8) still lands 1
  - [ ] Melee actors (knight, mercenary): each turn = one attack → `UnitAttacked` with damage + hpAfter; target hp hits 0 → `alive = false`, emit `UnitDied`; the 1.4 chassis already voids queued turns of mid-pass deaths via `ActionSkipped { reason: 'dead' }` and re-filters per pass — do NOT change that mechanism
  - [ ] Non-melee classes (archer, mage, cleric, witch) remain `ActionSkipped { reason: 'idle' }` this story — their rules are 1.6
  - [ ] INSTANT WIPE (FR18): after each death, if every unit of a side is dead, the engagement ends immediately (remaining turns unspent) → `EngagementEnded` (real hp snapshot) → `BattleEnded { winner: survivorSide }`
  - [ ] STREAM-ORDERING INVARIANT (1.4 review carryover): melee damage is fully deterministic — this story adds ZERO battle-stream draws; the tie coin flip REMAINS the first and only draw. Do not touch rng.ts
- [ ] Task 4: Judging (AC: 3)
  - [ ] No wipe → higher percentage of total starting team HP remaining wins. CRITICAL: compare EXACTLY with integer cross-multiplication — `remainingA × totalStartB` vs `remainingB × totalStartA` — NEVER compare floored percentages (flooring manufactures false ties, e.g. 100/300 vs 33/100 would both floor to 33)
  - [ ] Exact tie → `winner: 'draw'`
  - [ ] `hpPct` in `BattleEnded` is REPORTING data (floored integer percent, `floor(remaining × 100 / totalStart)`); the winner decision never reads it. Wipe: loser reports 0
  - [ ] `EngagementEnded.hp` now carries real end-of-engagement HP per unit
- [ ] Task 5: Test-suite migration + new tests (AC: 4)
  - [ ] MIGRATION (1.4 tests WILL break, by design): `turnsByPass` reads only `ActionSkipped` — extend it to count any per-actor turn event (`ActionSkipped` | `UnitAttacked`); the 1.4 ordering/multihit tests used knights/mercs that now attack. The 1.4 pinned event-trace anchor changes (knights/mercs emit `UnitAttacked`) — re-pin DELIBERATELY with a comment; `LOG_VERSION` in events.test updates to 2; purity guard file list gains `targeting.ts`
  - [ ] FR14 RPS units tests: knight→archer ×3/2, archer→... (melee only: knight attacks archer = advantage; knight attacks mage = disadvantage — mage beats knight; mercenary always ×1); exact damage values from balance v1 (e.g. knight→knight: 30 − 14 = 16; knight→archer: floor(24 × 3/2)... compute per table), min-1 clamp case
  - [ ] FR17/FR18 tests: wipe = instant win mid-engagement (unspent actions lost); HP-% judging with asymmetric armies; exact-tie draw via a symmetric no-death setup (e.g. 3 knights vs 3 knights, mirrored placements → symmetric totals → draw)
  - [ ] Judging-symmetry property (FR18/NFR2): swapping armies+placements A↔B (same seed) flips the winner (draw stays draw). NUANCE: the tie coin flip is NOT side-symmetric — filter the arbitrary to setups with no exact cross-side AGI tie (no same class on the same owner-local cell on both sides), where the battle is a perfect mirror; document the filter's reason
  - [ ] ≥3 golden-battle snapshots (vitest snapshots of the full `BattleLog`): (1) a wipe, (2) an HP-% decision, (3) an exact-tie draw — knight/mercenary armies, fixed seeds, committed snapshot files
  - [ ] Termination/seed-identity/non-mutation properties keep passing over the shared arbitrary (all classes — non-melee stay idle)
  - [ ] Full gate green: `pnpm -r typecheck`, `pnpm coverage`, `pnpm --filter web build`

## Dev Notes

### Architecture constraints that bind THIS story

- **AD-1/AD-2/AD-12:** unchanged from 1.4 — pure resolution, log carries ALL render data (damage + hpAfter in the event; the shell never recomputes), extending the union bumps `LOG_VERSION`.
- **Deep-freeze (1.4 review):** `deepFreeze` already covers new event shapes automatically — nothing to do, but the deep-frozen test should touch a `UnitAttacked.targets[0]` field.
- **Wipeout (1.4 review):** `mode: 'wipeout'` is REJECTED by validation until 1.10 — nothing in this story changes that.
- **Errors convention:** still no mid-battle throws. Wipe ends the engagement as a normal outcome.

### FR7/FR8 worked examples (owner-local coords — verify tests against these)

- Mirror mapping: own col idx `i` faces enemy owner-local col idx `2 − i` (left↔right, center↔center).
- A attacker at own `center` reaches enemy {left, center, right}. At own `left`: enemy {center, right}. At own `right`: enemy {left, center}.
- Shielding: attacker at own `right` (reaches enemy left+center); enemy has front/left alive and back/center alive → nearest occupied reachable row = front → only front/left eligible. If enemy front row instead has only front/RIGHT alive (unreachable), it shields nothing: nearest occupied REACHABLE row is wherever the reachable enemies are.
- Priority for attacker at own `center`, enemy row has left+center+right alive: facing = center → hit center. Enemy row has left+right only: neither is facing/center → attacker-view left = enemy owner-local RIGHT wins (spec decision above).

### Damage worked examples (balance v1 — pin these exact numbers in tests)

| Attack | base = STR − floor(VIT/2) | RPS | damage |
|---|---|---|---|
| knight → knight | 30 − 14 = 16 | ×1 | 16 |
| knight → archer | 30 − 6 = 24 | ×3/2 (knight beats archer) | 36 |
| knight → mage | 30 − 4 = 26 | ×3/4 (mage beats knight) | 19 (floor 19.5) |
| mercenary → knight | 26 − 14 = 12 | ×1 | 12 |
| mercenary → mercenary | 26 − 10 = 16 | ×1 | 16 |

- Order is FIXED: base (floor the VIT half) → RPS (floor) → [status, 1.6] → min-1 clamp last.
- 3 mirrored front knights (2 actions each): 6 swings × 16 = 96 total damage per side, nobody dies (140 hp) → exact tie → draw. That's golden battle #3.

### Judging exactness (the subtle bug this story must not have)

Compare `remainingA × totalStartB` vs `remainingB × totalStartA` (safe integers: max ~660 HP × 100). Floored percentages are for the `hpPct` REPORT only. A wipe decided the battle earlier and never reaches this comparison; simultaneous wipes are impossible in 1.5 (deaths are sequential; poison in 1.6+ revisits this).

### Previous story intelligence (1.4 + its review — critical)

- **Purity guard:** expected file list must gain `targeting.ts` (exact sorted list assert). All FORBIDDEN patterns apply to the new file.
- **1.4 tests that MUST be migrated, not deleted:** `turnsByPass` helper (extend to `UnitAttacked`), the pinned event-trace anchor (re-pin with comment — this IS an engine behavior change, that's why the anchor exists), the events.test LOG_VERSION assertion (→ 2), the deep-freeze probe (extend to a UnitAttacked field).
- **Stream ordering:** the tie flip is the first battle-stream draw and stays that way (prominent comment already in resolve.ts) — melee adds no draws, so 1.4 seeds produce the same ORDER; only event contents change.
- **Toolchain:** PATH prefix `$HOME/.nvm/versions/node/v24.16.0/bin`; run pnpm from repo root; no CI changes needed.
- **TDD conventions:** honest red proofs; pins computed then hand-verified against the rules (the 1.4 coin-flip pin lesson: verify WHICH unit should act, not just that the test passes).

### Scope fences (things this story must NOT do)

- NO archer/mage/cleric/witch behaviors (1.6) — they stay `idle`. NO statuses, NO magic targeting, NO healing.
- NO coverage-threshold activation (1.6), NO AI (1.7), NO wipeout loop (1.10), NO web changes, NO new deps, NO CI changes, NO balance data changes (formulas are already data — `BALANCE.version` stays 1, hash `bfce425a` stays valid).
- NO rng.ts changes; NO new battle-stream draws.

### Project Structure Notes

- New: `src/targeting.ts` (FR7 reach + FR8 selection — pure functions over unit positions), `test/targeting.test.ts`, `test/golden.test.ts` (+ committed `__snapshots__`). Modified: `src/types.ts` (2 events, LOG_VERSION 2), `src/resolve.ts` (melee turns, deaths, wipe, judging), `src/index.ts` (new event type exports), tests per migration list.
- Damage math may live in `targeting.ts` or a small helper in `resolve.ts` — dev's call; keep it pure and unit-tested either way.

### References

- [Source: docs/planning-artifacts/epics.md#Story-1.5] — ACs (verbatim source of truth)
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#FR7, #FR8, #FR14, #FR15, #FR17, #FR18, #NFR2] — incl. the Feature 3 preamble ("your left column faces the enemy's right")
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-1, #AD-2, #AD-11, #AD-12]
- [Source: docs/implementation-artifacts/1-4-battle-timeline-and-the-battlelog-chassis.md#Review-Findings] — deep-freeze, stream-ordering invariant, wipeout rejection, ActionSkipped 'dead' seam

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
