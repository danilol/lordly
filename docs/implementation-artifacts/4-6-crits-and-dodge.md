---
baseline_commit: 43374c5
context:
  - docs/adr/0003-battle-stream-draw-order.md
  - docs/planning-artifacts/epic-4-dossier/DOSSIER.md
  - docs/planning-artifacts/epics.md
  - docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md
  - docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md
  - docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/EXPERIENCE.md
---

# Story 4.6: Crits and dodge

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want attacks that can crit, miss, or be dodged,
so that DEX matters and battles carry earned drama.

## Acceptance Criteria

1. **The two new draws land in the frozen order, physical single-target only (FR20, FR36, AD-10, ADR 0003).** When a finalized action is a **physical single-target hit** (melee slash, arrow, Staff bonk — *including a misfired physical attack onto an ally*), the engine draws **exactly two** values on the `battle` stream in this exact order: **A3 = dodge (defender DEX)**, then **A4 = crit (attacker DEX)**. A4 is **always drawn even when A3 dodged** (result discarded on a dodge) — the fixed count is the auditable property. Draws roll against the **finalized** target (after tactics selection and Guard redirect, both deterministic). Magic (row blast, heals, Witch status casts), Guard interception, the leader-fall penalty, Golem resolution, and tactics selection take **zero** new draws — **magic neither crits nor is dodged** (OB64 rule). The confusion draws A1/A2 keep their shipped positions verbatim.

2. **Chances are DEX-keyed balance data; crit slots into the FR15 order after RPS (FR36, FR15).** `dodge% = floor(defender DEX / 3)`, `crit% = floor(attacker DEX / 3)`, crit multiplier **×3/2**, applied in the FR15 fixed order **immediately after RPS and before status modifiers (Weaken)** — the new order is `base → blast attenuation → RPS → crit → weaken → min-clamp`. Every step is integer `Math.floor`; the min-damage clamp stays last. These chances + multiplier are **new versioned balance data** (`balanceVersion` bumps 6→7, hash re-pinned). A **dodge yields `damage: 0`** (no HP change, no death).

3. **Attack events carry `crit`/`dodged`, narrated distinctly; `missed` stays reserved (AD-2, AD-12, UX-DR3/6).** `UnitAttacked.targets[].outcome` — already a union member since story 4.2 (`'hit' | 'crit' | 'dodged' | 'missed'`), emitted unconditionally as `'hit'` today — now reports the resolved outcome (`'crit'`, `'dodged'`, or `'hit'`). **`'missed'` is RESERVED and UNUSED in wave 1** — no draw is allocated to it. The battle scene and the Log panel read `outcome` from the payload (the scene derives nothing — AD-2) and render **crit emphasis** and a **dodge whiff** distinctly, floating numbers ≥ 14px, both themes, reduced-motion damped but the beats preserved. **No logVersion bump** — the union slot already exists (AD-15's single era bump was spent in 4.2).

4. **It replays from the seed alone, and the band holds (FR20, NFR4, AD-8).** Crits and dodges reproduce from the seed with **zero per-hit storage**. A **property test pins draw-count invariance** (every physical single-target hit consumes exactly 2 `battle` draws, regardless of outcome). A **new golden** exercises a `confused + dodge + crit` battle on one seed (ADR 0003's verification contract). Existing goldens are **re-recorded** (physical-hit logs now carry outcomes and crit-boosted damage). The **both-mode sweep (single + wipeout) confirms no archetype exceeds the ≤65% band** — dodge/crit are live once emitted; re-tune the pool / DEX values only if a comp breaks out. `resolve.ts`'s STREAM-ORDERING INVARIANT comment gains a pointer to ADR 0003, and ADR 0003's A3/A4 rows flip from "NEW (story 4.6)" to shipped.

## Tasks / Subtasks

- [x] **Task 1: Engine — draw A3 (dodge) + A4 (crit) in the frozen order, physical single-target only (AC: 1, 2)**
  - [x] Roll the two draws in ADR order **A3 dodge → A4 crit**, gated to a **physical single-target** finalized action. Draw both **always** when the gate is open (crit result discarded on a dodge) — never make the count conditional. The natural seam is the `act()`/`misfire()` layer (where A1/A2 already draw and where physical-vs-blast is already distinguished), passing a per-hit `{ dodged, crit }` result into `strike()`; `strike()` is stream-free today, so do **not** hand it the raw stream unless you also move A1/A2's pattern — keep the "draws live in the turn/act layer, `strike` just emits" convention.
  - [x] Chance model: `dodge success ⇔ nextInt(battle, 0, den−1) < floor(defenderDex / divisor)`; `crit success ⇔ nextInt(battle, 0, den−1) < floor(attackerDex / divisor)`. DEX is **not** on `UnitState` (only `agi` is copied in `buildUnits`) — read `BALANCE.classes[unit.class].dex` at the draw site (or add `dex` to `UnitState`; dev's call). Divisor = 3.
  - [x] Physical single-target set = melee slash, archer arrow, cleric/Wizard/Sorceress Staff bonk, **and a misfired physical attack onto an ally** (ADR A3 condition). NOT the Mage/Wizard/Sorceress **row blast** (magic, zero draws even if it happens to strike one unit), NOT heals, NOT Witch status casts.
  - [x] On dodge: `outcome: 'dodged'`, `damage: 0`, `hpAfter` unchanged, no `UnitDied`. On crit (and not dodged): `outcome: 'crit'` with the ×3/2-boosted damage. Else `outcome: 'hit'`. Replace the hard-coded `outcome: 'hit'` at `resolve.ts:422`.
  - [x] Apply the crit ×3/2 **inside `damagePipeline`** between the RPS step (`resolve.ts:550`) and the Weaken step (`resolve.ts:551`) — thread a `crit?: Ratio` param that only the physical path passes. **Do NOT** apply crit as an outer wrapper on the formula result (the `leaderPenaltyPhysical` shape) — that lands after Weaken + after the clamp, violating the ADR order (see Dev Notes: *The crit-order trap*).
  - [x] Compose with the leader-fall penalty: both are physical multipliers. Pick ONE composed order, document it in the pipeline docstring, and freeze it via goldens. Recommended default: leave `leaderPenaltyPhysical` outermost (as shipped in 4.5) and put crit inside the pipeline — deterministic either way, only the frozen goldens matter.

- [x] **Task 2: Engine — new balance data + version bump + hash pin (AC: 2, 4)**
  - [x] Add to `BALANCE.formulas` (`balance.ts:160-170`): a `critMultiplier: { num: 3, den: 2 }` (`Ratio`) and the DEX divisor (e.g. `dexChanceDivisor: 3`) and, if you model chance as a `Ratio`, its denominator (percent → `den: 100`). Keep them as tuning-transparent constants — chances are sweep-policed, only the draw order/count is frozen.
  - [x] `balance.ts` `version: 6` → `7`. Add the `7: '<hash>'` line to `test/balance-hash.test.ts` `EXPECTED_HASHES` (compute via a one-off `contentHash(BALANCE)`); the structural test enforces contiguity + newest-is-`BALANCE.version`.
  - [x] **No `logVersion` change** — `LOG_VERSION` stays 4; the `outcome` union field already exists (`types.ts:239`). Getting this backwards is the easiest mistake in this story.

- [x] **Task 3: Engine — determinism tests (AC: 1, 4)**
  - [x] Property test (`@fast-check/vitest`, `arbitraries.ts#matchSetupArb` + `seedArb`): **draw-count invariance** — every physical single-target hit consumes exactly 2 `battle` draws whatever the outcome; same seed → bit-identical outcomes (extend `rng.test.ts`'s seed-identity pattern).
  - [x] Direct arithmetic table rows in `test/damage.test.ts`: crit ×3/2 applied after RPS, before Weaken (verify flooring order differs from an outer multiply), min-clamp still last; combined with leader-penalty; magic/heal never crit.
  - [x] Edge cases: dodge → `damage 0` / no death / A4 still consumed; a crit that would kill reports full `damage` with `hpAfter: 0` (overkill semantics, `types.ts:224-228`); misfired physical onto ally draws A3/A4; blast striking a single unit draws nothing.

- [x] **Task 4: Engine — goldens (AC: 4)**
  - [x] Add a NEW golden: a `confused + dodge + crit` battle on one seed (ADR 0003 verification contract) — one battle that traverses every draw-consuming path.
  - [x] Re-record existing goldens (`pnpm --filter @lordly/engine test -u`) and **audit every diff event-by-event**: physical-hit `UnitAttacked` entries now carry real `outcome` values and crit-boosted damage; magic/heal entries must be **byte-unchanged** (they take no draws). Any magic-log change means a draw leaked into the magic path — a bug, not an expected re-record.

- [x] **Task 5: Engine — the sweep confirms the band (AC: 4)**
  - [x] Re-run `pnpm --filter @lordly/engine sim -- --runs=100` in **both** modes (`--mode=single`, `--mode=wipeout`); confirm ≤0.65 for every archetype. Dodge/crit enter the sweep automatically once emitted (they draw on `battle` during `resolveBattle`) — no new sweep dimension. Ninja (DEX 30) / archer (DEX 24) gain the most evasion+crit; watch high-DEX comps. Re-tune `STRATEGY_POOL` or the DEX values only if a comp breaks the band; record the converged numbers.
  - [x] Update `test/sim.test.ts` anchors if the band's worst-case moved; keep the wardens-viability assertion honest.

- [x] **Task 6: Shell — battle scene renders crit emphasis + dodge whiff (AC: 3)**
  - [x] `apps/web/src/scenes/BattleScene.ts` `UnitAttacked` case (~line 306): branch on `t.outcome`. `'dodged'` → a "Dodge!"/whiff beat (no damage number, or a struck-through 0), no hurt-flash, HP bar unchanged. `'crit'` → emphasize the floating number (larger / punchier than a plain hit) + a crit flash. `'hit'` → unchanged. Read `outcome` from the payload only (AD-2) — never recompute.
  - [x] `apps/web/src/flow/narration.ts` `UnitAttacked` case (~line 59): distinct one-line narration per outcome in the shipped register (`"Kain (KNI) struck …"`). E.g. crit: `"… CRIT! struck … for 18"`; dodge: `"… — <target> dodged"`. Keep numbers/format tabular; dodge shows no damage.
  - [x] Honor reduced-motion (UX-DR6): damp the crit/whiff flourish, preserve the beat. Numbers ≥ 14px (UX-DR3), both themes (UX-DR2), tokens only from `DESIGN.md` (`{components.combat-number}` is the anchor; add a crit/dodge treatment note to DESIGN.md if you introduce a token).

- [x] **Task 7: Docs (AC: 1, 4)**
  - [x] `docs/adr/0003-battle-stream-draw-order.md`: flip A3/A4 "Position status" from `NEW (story 4.6)` to `SHIPPED (resolve.ts:<line>)`; leave the freeze rule intact.
  - [x] `resolve.ts` STREAM-ORDERING INVARIANT comment block (`resolve.ts:99-104`): add the ADR 0003 pointer (the ADR explicitly asks for this).
  - [x] `docs/rules.md`: a short "Crits & dodge" note (DEX → crit/dodge, ×3/2, magic never crits/dodges); extend `rules-doc.test.ts`'s drift guard to pin the ratio/divisor to `BALANCE.formulas` (the 4.5 leader-ratio precedent).

- [x] **Task 8: Gate + device sign-off (all ACs)**
  - [x] Full gate GREEN: typecheck (both packages), eslint + prettier clean, all tests (engine + web), engine line coverage ≥ 90% (keep the new branches — dodge, crit-on-hit, discarded-crit-on-dodge, magic-no-draw — covered), re-recorded goldens audited, both-mode sweep in band.
  - [x] Danilo device session: crit reads as drama, dodge reads clearly, numbers legible at 360px in both themes.

## Dev Notes

### The binding source is ADR 0003 — the frozen draw table
`docs/adr/0003-battle-stream-draw-order.md` is authoritative for the draw order/count. It is **frozen**: once this story ships, the table NEVER changes, because the seed IS the recording (a reorder/count change silently corrupts every stored replay). The full per-`battle`-stream order is: **E1** (per-engagement initiative tie coin, `resolve.ts:105`, shipped) → per action **A1** (confusion misfire check, `resolve.ts:208`, shipped) → **A2** (misfire redirect target, `resolve.ts:344/359/366`, shipped) → **A3 dodge (NEW)** → **A4 crit (NEW)**. [Source: docs/adr/0003-battle-stream-draw-order.md#The-table]

### `outcome` already exists in the v4 union — do NOT bump logVersion
`AttackTarget.outcome: 'hit' | 'crit' | 'dodged' | 'missed'` was added in story 4.2 (`types.ts:239`) and is emitted as `'hit'` unconditionally today. `LOG_VERSION` is 4 and **stays 4** — AD-15's single era bump was spent in 4.2. Only `balanceVersion` bumps (6→7, for the new chances/multiplier). [Source: types.ts:230-240; ARCHITECTURE-SPINE.md#AD-15; DOSSIER.md#§5]

### The crit-order trap — crit goes INSIDE the pipeline, not as an outer wrapper
ADR 0003 pins crit "immediately AFTER RPS ... (base → blast attenuation → RPS → **crit** → status modifiers)". In the code, **Weaken IS the status modifier** and lives *inside* `damagePipeline` at `resolve.ts:551`, right after the RPS step at `:550`. So crit must be applied **between lines 550 and 551**, inside the pipeline, via a threaded `crit?: Ratio` param that only the physical path passes. The `leaderPenaltyPhysical` wrapper (`resolve.ts:465-477`) applies its multipliers on the pipeline's *returned* value and re-clamps — that shape is **wrong for crit**: it would land crit after Weaken and after the min-clamp, changing the floored result and breaking the ADR order. Because flooring is not associative, `floor(floor(x·3/2)/2) ≠ floor(floor(x/2)·3/2)` — the position genuinely matters. [Source: resolve.ts:545-553, 465-477; docs/adr/0003-battle-stream-draw-order.md#Chances]

### `strike()` is shared by physical AND blast — gate the draws
`strike()` (`resolve.ts:409-439`) is called for both physical single-target attacks and the magic row-blast; today it has no flag and hard-codes `outcome: 'hit'` (`:422`). ADR draws are physical-single-target ONLY. A blast that happens to strike one unit is still magic → **zero draws**. Add an explicit signal (a per-hit `{ dodged, crit }` computed by the caller, or a `physicalSingleTarget` flag) — never infer "single-target" from `targets.length === 1`. [Source: resolve.ts:409-439; engine research report]

### DEX is not carried in resolution state
`buildUnits` copies `agi` into `UnitState` but not `dex` (`resolve.ts:566`). Read `BALANCE.classes[unit.class].dex` at the draw site, or add `dex` to `UnitState`. All 11 shipped classes already have DEX values (`balance.ts:125-147`): ninja 30 and archer 24 are the high-evasion/crit units; cleric/phalanx 12 the lowest. At divisor 3 that's crit/dodge ≈ 10% (ninja) down to 4% (cleric/phalanx). [Source: balance.ts:22-29, 125-147]

### Dodge vs miss — only dodge ships in wave 1
`'dodged'` is **defender-attributed** (keyed to defender DEX, the single A3 draw) and reports `damage: 0`. `'missed'` is **attacker-attributed accuracy** — it exists in the type union but is **reserved and unused in wave 1, with no draw allocated**. Do not implement a miss roll. Adding `missed` later is an ADR amendment appending a declared-extensible position — never a reorder. (Ignore the PRD addendum's loose "AGI = evasion" line; FR15 + ADR 0003 are authoritative — **dodge is keyed to DEX**.) [Source: docs/adr/0003-battle-stream-draw-order.md#Chances; DOSSIER.md#§3, §5; prd.md#FR36]

### Interactions — everything else is deterministic (zero new draws)
Draws roll against the **finalized** target, after these deterministic steps: **Guard interception** (FR33, story 4.7 — not yet shipped) redirects first, so the dodge/crit roll is vs the **guard** as defender; **Last Stand** and all **tactics** selection precede the roll (legal-list building); the **leader-fall penalty** (FR35, shipped 4.5) is a deterministic reversion + physical multiplier, no "panicked" random targeting. RPS/role-relations feed the pre-crit damage step (crit multiplies the post-RPS value). None of these add a `battle` draw. [Source: docs/adr/0003-battle-stream-draw-order.md#The-table (Zero draws, by design); DOSSIER.md#§3, §4]

### The UX crit/dodge treatment is UNDERSPECIFIED — author it, confirm on device
Grep-confirmed: **DESIGN.md and EXPERIENCE.md contain no crit/dodge visual spec.** The dossier §5 walk only ticks "crit emphasis / dodge whiff" as words in a checklist; no token, size, or animation is authored. This is the same undersupplied-UI situation stories 4.3–4.5 handled: pick a sensible default anchored on the existing `{components.combat-number}` token (bold tabular mono, side-colored, ≥14px), keep it within UX-DR3/6, and confirm on Danilo's device rather than blocking on a PM session. If you add a token (e.g. a crit color/size or a dodge label), record it in DESIGN.md so the spine stays the source of truth. [Source: DESIGN.md#components (combat-number); EXPERIENCE.md (Epic 4 extension — no crit/dodge entry); epics.md:805; DOSSIER.md#§5]

### "Fan-out per target in target order" (AD-10/epics wording) is moot in wave 1
AD-10 and the epics.md AC say "multi-target blasts fan out per target in target order." The final frozen ADR **overrode** the adversarial-review recommendation that magic consume discarded per-target draws: **magic takes zero draws**, and there is **no physical multi-target attack in wave 1**, so no physical fan-out occurs. Cite ADR 0003 + DOSSIER §3 as binding; the fan-out ordering rule only matters for future extensible mechanics. [Source: ARCHITECTURE-SPINE.md#AD-10; docs/adr/0003-battle-stream-draw-order.md; review-adversarial-epic4.md#Finding-7 (overridden)]

### Previous-story intelligence (4.5, shipped 43374c5)
4.5 established the exact patterns this story reuses: **exported pure damage helpers for direct table tests** (`physicalDamage`/`blastDamage`/`leaderPenaltyPhysical` — put crit arithmetic in `damage.test.ts` the same way); the **physical-only-at-the-call-site** discipline (crit, like the leader penalty, must not leak into blast/magic); the **re-clamp-to-`minDamage`-last** convention; **goldens re-recorded only where a real state is reached** (a crit/dodge changes far more logs than the leader penalty did — expect broad physical re-records, but magic logs must stay byte-identical); and the **rules-doc drift guard** pinning ratios to `BALANCE.formulas`. Note the AI's tactic/leader draws are on the `ai/A`/`ai/B` streams, NOT `battle` — so A3/A4 are the first new `battle`-stream draws since the era began, and the sim's `chooseSetup`/archetype anchors are unaffected by them. [Source: 4-5-the-squad-leader.md Dev Notes + File List]

### What's explicitly OUT of scope
No `missed`/accuracy mechanic (reserved only). No magic crits or magic dodges (OB64 rule, frozen). No Guard (that's story 4.7 — but the ADR already reserves "roll vs the guard as defender" for when it lands; don't build Guard here). No new RNG stream. No `logVersion` bump. [Source: docs/adr/0003-battle-stream-draw-order.md; DOSSIER.md#§3]

### Project Structure Notes
- Engine (`packages/engine`): `src/resolve.ts` (draws + `damagePipeline` crit param + `strike` outcome), `src/balance.ts` (`formulas` + `version` 6→7). Tests: `test/{damage,resolve,combat,rng,sim,balance-hash,golden}.test.ts`, `test/arbitraries.ts`, new/updated golden snapshot. `sim/` unchanged (dodge/crit ride the existing `battle` stream).
- Shell (`apps/web`): `src/scenes/BattleScene.ts` (`UnitAttacked` outcome branch), `src/flow/narration.ts` (per-outcome lines), possibly `src/config/constants.ts` (crit/dodge label/color) + `DESIGN.md` if a token is added.
- Docs: `docs/adr/0003-battle-stream-draw-order.md`, `docs/rules.md`.
- `logVersion` stays 4; single `balanceVersion` bump 6→7; no new dependencies; no new RNG stream.

### References
- [Source: docs/adr/0003-battle-stream-draw-order.md] — the frozen draw table (The-table, Why-always-two-draws, Chances, Verification-contract). **Binding.**
- [Source: docs/planning-artifacts/epic-4-dossier/DOSSIER.md#§3] — crit/dodge design; §5 union table (`outcome`, damage 0 on dodge); §4 (Guard/tactics/leader interactions); Decision-log D-2e.
- [Source: docs/planning-artifacts/epics.md#Story-4.6] — the BDD ACs.
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md] — AD-2 (scene derives nothing), AD-8 (balanceVersion/hash), AD-10 (streams/draw order), AD-15 (one logVersion per era).
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md] — FR15 (integer math order + attribute table), FR20 (determinism), FR36 (crit/dodge), FR14 (≤65% band).
- [Source: packages/engine/src/resolve.ts] — `strike()` (409-439, `outcome:'hit'` at 422), `damagePipeline()` (545-553; RPS 550, Weaken 551), `leaderPenaltyPhysical()` (465-477), `physicalDamage`/`blastDamage`, `buildUnits` (566), STREAM-ORDERING INVARIANT (99-104), `battle` draws (105/208/344/359/366).
- [Source: packages/engine/src/types.ts] — `AttackTarget`/`outcome` (230-240), `LOG_VERSION` 4.
- [Source: packages/engine/src/balance.ts] — `formulas` (160-170), `version` (121), `ClassStats.dex` (29), per-class DEX (125-147).
- [Source: packages/engine/src/rng.ts] — `STREAM_LABELS` incl. `battle`, `nextInt` inclusive draw.
- [Source: docs/planning-artifacts/ux-designs/ux-lordly-2026-07-13/DESIGN.md] — `{components.combat-number}` (the crit/dodge visual anchor; no crit/dodge token exists yet).

## Open questions for Danilo (raised at story creation — not blockers; sensible defaults chosen)

1. **Crit emphasis & dodge whiff visuals** are unspecified in the UX spines. Defaulting to: crit = a larger, punchier floating number + a brief flash (built on `{components.combat-number}`); dodge = a "Dodge!" whiff beat with no damage number, no hurt-flash. Confirm on device; both stay reduced-motion-safe and ≥14px.
2. **Crit ↔ leader-penalty composed order.** Defaulting to: leader penalty stays outermost (as shipped 4.5), crit inside the pipeline after RPS. Deterministic either way — only the frozen goldens differ. Flagging so the choice is a conscious freeze, not an accident.
3. **DEX chance representation.** Defaulting to a percent `Ratio` (`den: 100`, `num = floor(dex/3)`), drawn `nextInt(battle, 0, 99)`, success if `< num`. The exact denominator is frozen once shipped — confirm the model before goldens are recorded.
4. **Dodge/crit chance magnitudes.** `floor(DEX/3)` is the ADR's current tuning value (sweep-policed, not frozen). If the both-mode sweep shows high-DEX comps (ninja/archer) breaking the band, the divisor or per-class DEX is the tuning lever — expect to report the converged numbers.

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M context) — dev-story workflow.

### Debug Log References

- **Balance hash (AD-8):** `balanceVersion` 6 → 7, new content hash `dd4a7f6c` pinned in `balance-hash.test.ts` (computed via a one-off `contentHash(BALANCE)`). New data: `critMultiplier {3,2}` + `dexChanceDivisor 3`.
- **Draw order (ADR 0003):** A3 dodge → A4 crit appended per physical single-target hit, in `act()`/`misfire()` at the four physical strike sites (melee/archer/cleric-staff + misfired-physical-on-ally), via the new exported `rollHit()`. `battle` stream threaded into `act()` (previously stream-free). Frozen percent range `DEX_CHANCE_DEN = 100` (a rule constant, not balance data). No new RNG stream, no `logVersion` bump.
- **Crit-order trap:** crit ×3/2 applied INSIDE `damagePipeline` between RPS and Weaken (threaded `crit?: Ratio` param, physical path only) — NOT an outer wrapper. `leaderPenaltyPhysical` composes outside (unchanged 4.5 position); composed order documented in its docstring.
- **Downstream re-derivation (the 2 new draws shift every seeded battle — expected per ADR):**
  - `combat.test.ts` mirror-tie → seed 7→**10** (zero crit/dodge → true mirror draw); min-damage property now exempts dodges (damage 0).
  - `confusion.test.ts` probed seeds → mage/cleric **3**, witch **20** (melee test held on seed 1).
  - `leader.test.ts` poison-leader seed 5→**2**.
  - `sim.test.ts` anchor 10%/93%→**10%/96%** (A:4's swing dodged on seed 42).
  - `wipeout.test.ts` knights-vs-mercs 66%→**65%** (one crit landed).
- **Goldens (`vitest -u`, audited event-by-event):** #3 seed 0xfeed→**0xfef4** (zero crit/dodge → draw preserved); #6 A66→**A65**; #8 5→**4** engagements / 14→**15** ticks / A35→**A36** (crit/dodge accelerated B's collapse, cost A:4). #5/#7 inline values UNCHANGED (crit/dodge netted out under heal-capping/rounding) — snapshots only. #1/#2/#4 snapshots byte-unchanged (no crit/dodge fired, no downstream shift). **NEW golden #9** — confused+dodge+crit in one battle (seed 1), the ADR verification-contract anchor. Magic/heal/poison values never corrupted (audit: 0 heals removed).
- **Both-mode sweep (100 runs):** single max 59.6% (bulwark), wipeout max 61.1% (bulwark) — inside the ≤65% band, NO re-tune. Wardens (melee floor) viable + non-dominant: 37.0% single / 55.4% wipeout.
- **Gate:** 465 tests (all packages), typecheck clean (both), eslint + prettier clean, `resolve.ts` line coverage 99.49%.

### Completion Notes List

- **Engine (Tasks 1–2):** `rollHit()` (exported) draws A3 dodge (defender DEX) then A4 crit (attacker DEX), always both, only at physical single-target strike sites; `strike()` gained a `roll?: {dodged, crit}` param — dodge → `damage 0`/`outcome 'dodged'`/no death, crit → ×3/2 via the pipeline + `outcome 'crit'`, else `'hit'`. `damagePipeline`/`physicalDamage`/`leaderPenaltyPhysical` thread the crit flag; magic/blast/heal never crit or dodge. `balance.ts` version 6→7 (+critMultiplier, +dexChanceDivisor). `logVersion` UNCHANGED (v4 union already has `outcome`). `missed` reserved, never emitted.
- **Tests (Tasks 3–4):** new `crit-dodge.test.ts` — draw order/count pin (the "two streams agree after 2 manual draws" idiom), DEX-keying (property, any seed), crit-order discriminator (`archer→knight` weakened+crit = 5, after-Weaken order would be 4), leader-penalty composition, in-battle emission (crits + dodges fire, dodge = 0, magic never crits, seed-identity replay). `events.test.ts`/`combat.test.ts` updated for the dodge-deals-0 reality. New golden #9.
- **Shell (Task 6):** `BattleScene` `UnitAttacked` branches on `outcome` — crit = bigger (20px) side-colored number + `!` + a scale "punch" (damped under reduced motion); dodge = muted "dodge" whiff, no hurt-flash, HP unchanged. `narration.ts` = distinct Log lines per outcome ("CRIT … for N", "struck at … — dodged!"). Gold reserved (UX-DR2) — emphasis is size + motion, both ≥14px (UX-DR3). Two new narration tests.
- **Docs (Task 7):** ADR 0003 A3/A4 rows flipped to SHIPPED; `resolve.ts` STREAM-ORDERING comment points to the ADR; `docs/rules.md` "Crits and Dodges" section (×1.5 crit, DEX ÷ 3, magic exempt) + `rules-doc.test.ts` drift guard pinning both to `BALANCE.formulas`.
- **DEVICE-ACCEPTED 2026-07-19 (Danilo: "it looks great now! i am happy with it").** One device follow-up applied: a small **"CRITICAL" / "DODGE" caption stacked over the number** in `BattleScene` (the plain bigger-number-only read was ambiguous at full speed — there is no 0.5× speed). This resolves Open Question 1 (the UX crit/dodge treatment). Open questions 2–4 left at their defaults (no concern raised on device).

### File List

**Engine (`packages/engine`)**
- `src/resolve.ts` — `DEX_CHANCE_DEN` const + `rollHit()` (exported); `strike()` gains `roll?` param + dodge/crit outcome; `damagePipeline`/`physicalDamage`/`leaderPenaltyPhysical` thread `crit`; `battle` threaded into `act()`; rollHit at the 4 physical strike sites; STREAM-ORDERING comment → ADR 0003 pointer.
- `src/balance.ts` — `formulas.critMultiplier` (3/2) + `formulas.dexChanceDivisor` (3); `BalanceData.formulas` type extended; `version` 6 → 7.
- `test/crit-dodge.test.ts` — NEW: draw order/count, DEX-keying, crit arithmetic order, in-battle emission, replay.
- `test/balance-hash.test.ts` — pinned `7: 'dd4a7f6c'`.
- `test/events.test.ts` — 4.2 outcome test updated for emitted crit/dodged.
- `test/combat.test.ts` — min-damage property exempts dodges; mirror-tie seed 7→10.
- `test/confusion.test.ts` — re-probed seeds (3, 20).
- `test/leader.test.ts` — poison-leader seed 5→2.
- `test/sim.test.ts` — anchor 10%/96% (dodged swing).
- `test/wipeout.test.ts` — knights-vs-mercs verdict 65%.
- `test/golden.test.ts` + `test/__snapshots__/golden.test.ts.snap` — #3 (seed 0xfef4), #6, #8 inline updates; #5/#7 snapshot-only; NEW golden #9 (confused+dodge+crit); snapshots re-recorded.

**Web (`apps/web`)**
- `src/scenes/BattleScene.ts` — `CRIT_FONT_PX`; `popup()` `emphatic` flag (bigger + punch); `UnitAttacked` outcome branch (crit emphasis, dodge whiff).
- `src/flow/narration.ts` — per-outcome Log lines.
- `test/narration.test.ts` — crit + dodge line tests.
- `test/rules-doc.test.ts` — crit-multiplier + DEX-divisor drift guard.

**Docs**
- `docs/adr/0003-battle-stream-draw-order.md` — A3/A4 rows → SHIPPED.
- `docs/rules.md` — "Crits and Dodges" section.

### Change Log

- 2026-07-19 — Story 4.6 implemented: FR36 crit & dodge as the two ADR-0003 battle-stream draws (A3 dodge/defender DEX, A4 crit/attacker DEX) per physical single-target hit; crit ×3/2 inside the FR15 pipeline (after RPS, before Weaken); magic never crits/dodges; `missed` reserved. `balanceVersion` 6→7 (+critMultiplier, +dexChanceDivisor), `logVersion` unchanged. Shell renders crit emphasis + dodge whiff (BattleScene + Log). Every seeded downstream anchor/golden re-derived + audited; new golden #9 (confused+dodge+crit). Both-mode sweep in band, no re-tune. Gate green (465 tests).
- 2026-07-19 — Device follow-up (Danilo: "it looks great now! i am happy with it"): added a small **"CRITICAL" / "DODGE" caption** stacked over the floating number in `BattleScene.popup()` (the number-size-only read was ambiguous at full speed — no 0.5× speed exists). Caption 11px, floats + punches with the number, side-coloured (gold still reserved). Resolves Open Question 1. Typecheck + lint clean.
