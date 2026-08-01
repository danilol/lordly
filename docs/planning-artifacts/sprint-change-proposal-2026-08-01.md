# Sprint Change Proposal — 2026-08-01

**Trigger:** story 5.10's AC5 felt-balance pass returned findings instead of a sign-off.
**Decision:** Danilo, 2026-08-01 — option (b): hold 5.10 open, land the fidelity work, certify once.
**Scope classification:** **MODERATE** — backlog reorganisation inside Epic 5, no fundamental replan. Two new stories, one epic-fence amendment, four requirement amendments. No architecture change (AD-1/AD-4/AD-8 all hold; no new RNG stream, no `logVersion` bump).

---

## 1. Issue summary

Story 5.10 (the pre-PvP verdict) is the epic-closing certification gate. Its AC5 is Danilo's on-device felt-balance sign-off, which is the "ready for link-play" certificate. He played many real games and **did not sign off** — he reported four fight-system problems plus a design gap. **All five were then confirmed in the code**; none was perception.

Issue type: **misunderstanding of original requirements** (FR9's "global range" was implemented exactly as written, but the written requirement itself diverges from OB64) compounded by **a requirement never specified** (FR16 never stated a status duration).

### Evidence (code-confirmed 2026-08-01)

| # | Finding | Code evidence | OB64 (per Danilo's sourced research) |
|---|---|---|---|
| 1 | Archer acts twice from the mid row | `balance.ts` — `archer.actions = { front: 1, mid: 2, back: 2 }` | Basic Archer acts ×2 **only from the back row** → `1/1/2` |
| 2 | Ranged ignores column sectors | `legalTargets` — `if (mode === 'ranged') return living;` (every living enemy, any column) | Left → {Left, Center}; Right → {Right, Center}; Center → all three. **Melee already does this correctly** via `reachableEnemyCols` |
| 3 | Ranged row order is reversed | `rangedCmp` sorts `b.rowIndex - a.rowIndex` — **rearmost first**, by design ("arrows arc over the front") | Depth search **closest → furthest**: Front (same column, then centre) → Middle → Back, first occupied wins |
| 4 | Sleep lasts the whole engagement | `sleep` is added to `unit.statuses` and **never removed inside an engagement** — `grep statuses.delete` over the engine returns nothing. Only the between-engagement seam sheds it. **In single mode there is no next engagement**, so a pass-1 sleep disables the unit for the entire battle | Unspecified in our docs; needs source evidence |
| 5 | A Guard row with nobody behind is dominated | `raiseGuard` spends the action with no attack and no `UnitAttacked`; Phalanx front/mid are `guard-full`. A lone Phalanx raises a one-shot charge forever, deals zero damage, loses on HP fraction | Design gap, not a fidelity claim |

**Why the sweep never caught any of it:** the NFR4 harness is AI-vs-AI, so both sides exploit the same asymmetries (`hex-coven`, 3 witches, converges at a mild 47.6% single). These are **human-experience** problems — exactly the blind spot PRD Open Item 1 names. The felt-balance gate did its job; it is the only instrument that could have found these.

---

## 2. Impact analysis

### Epic impact

**Epic 5 can still complete, with an amended fence.** Its breakdown decision reads *"fence: no new systems — no new mechanics, tactics, or link-play work; content on existing systems only."* Items 2, 3 and 5 change engine behaviour and therefore **breach that fence as written**. The fence is amended by dated PO decision rather than quietly ignored.

**Epic 6 (link-play) is unaffected in content and better served in sequence** — it inherits a certified, OB64-faithful targeting model instead of one already scheduled for replacement. No Epic 6 story exists yet, so nothing is invalidated.

No epic becomes obsolete; no new epic is needed.

### Story impact

| Story | Impact |
|---|---|
| **5.10** (in-progress) | **Held open.** Tasks 1, 5, 6, 7 survive. **Task 2 (convergence sweep) is invalidated** and must re-run. Task 3's derived floor guard survives but its recorded numbers change. Task 4 (conditional tuning) must be re-evaluated. The `balance-verdict.md` epic-5 addendum must be rewritten against the new model. AC4 (perf) stays satisfied-with-deviation — unaffected. |
| **5.11** (NEW) | The mechanics pass: targeting sector + depth order, archer actions, guard fall-through. |
| **5.12** (NEW) | The status pass: sleep duration, gated on an OB64 evidence sitting. |
| **5.9** (backlog, art) | Unaffected — still floats on Midjourney batch arrival. |
| 5.0–5.8 (done) | No re-work. Goldens will re-record (below), which is expected and audited, not a regression. |

### Artifact conflicts

- **PRD FR9** ("ranged global range") — contradicts the sector rule. Must be amended, not silently overridden.
- **PRD FR15** — archer action row. Already amended today to point at `BALANCE.classes` as normative, so the row change needs no PRD edit beyond a note.
- **PRD FR16** — never specified a status duration. The gap that produced finding 4.
- **PRD FR33 / dossier §4** — Guard's "spends the action, no attack" contract gains the fall-through condition.
- **`epics.md`** — Epic 5 fence amendment + two new story entries + FR-coverage list.
- **`docs/rules.md`** — the player-facing Melee/Ranged/Guard/Status text, drift-guarded by `rules-doc.test.ts`.
- **ADR 0003** — **untouched if no new draw is introduced.** A sleep *resist roll* would need a declared-extensible position; the frozen table forbids a silent insert. Prefer a deterministic sleep rule to keep the table frozen.

### Technical impact

- **`targeting.ts`** is the blast radius. `selectRangedTarget` is shared by the Archer, the Cleric's staff fallback, **Witch casts**, and — since 5.4 — **every `bolt`**. This moves the whole meta, not just archers.
- **Expect broad golden re-records.** Any golden containing an archer, a cleric staff fallback, a witch or a caster is affected — likely most of the 11. Audited event-by-event per the 4.4 method; a golden with none of those must stay byte-identical as the regression pin.
- **Known test casualty, flagged so it is expected:** 5.10's new cap-length **poison** pin asserts exact tick counts (4 → … → 10) on a witch fixture, and witches cast through `selectRangedTarget`. Those numbers will move. The **breath** attenuation pin is safe (row-AoE goes through `selectBlastRow`, not the ranged path).
- **One `balanceVersion` bump for the whole train** (11 → 12), hash re-pinned once. `logVersion` stays **4** — no event shape changes.
- Engine purity, AD-4 barrel discipline and AD-11 owner-local coordinates all unaffected.

---

## 3. Recommended approach

**Direct adjustment — insert two stories before the certification, then re-certify.** No rollback (nothing built is wrong; FR9 was implemented faithfully to a requirement that was itself wrong). No MVP reduction.

**Sequence:** `5.11` → `5.12` → `5.10` completes → `5.9` floats on art → epic-5 retrospective.

**Rationale:** 5.10's certificate exists to describe the game link-play is built on. Certifying the current targeting and then replacing it spends the certification twice and hands Epic 6 a number that was never true of the shipped game. Item 4 is also a live human-facing balance problem, not polish.

**Risk / effort:** 5.11 is a medium engine change with a wide test surface (targeting is on every attack path) and a mandatory both-mode convergence sweep — the meta will move and re-tuning is likely, not optional. 5.12 is small in code but **gated on evidence Danilo must supply**. Timeline: Epic 5 closes later; Epic 6 starts from a clean, once-certified base.

---

## 4. Detailed change proposals

### 4.1 `epics.md` — Epic 5 fence amendment

> **OLD:** `**fence: no new systems** — no new mechanics, tactics, or link-play work; content on existing systems only.`
>
> **NEW:** append — *Amended 2026-08-01 (PO decision, Danilo, after story 5.10's felt-balance pass): the fence is WIDENED, once and explicitly, to admit the **OB64 fight-system fidelity pass** (stories 5.11–5.12). The felt-balance gate returned five code-confirmed deviations — ranged targeting ignoring OB64's column sectors and reversing its front-to-back depth order, the Archer's mid-row action, whole-engagement sleep, and a dominated Guard row. These are corrections to mechanics that were built to a requirement (FR9) that itself diverged from the north star, not new features, and they must land BEFORE the pre-PvP certification so the era is certified once against the model that ships to link-play. `logVersion` still holds at 4 all epic; the era takes ONE additional `balanceVersion` bump (11 → 12), carried by story 5.11.*
>
> **Rationale:** the fence is a real constraint that this change breaches. Amending it with a dated PO decision keeps the epic's own record honest — the alternative is a fence everyone silently ignores, which is worse than no fence.

### 4.2 `epics.md` — NEW Story 5.11

**Story 5.11: OB64 targeting fidelity and the dominated-Guard fix**

> As a player,
> I want units to pick targets the way Ogre Battle 64 does,
> So that positioning is a real strategic decision instead of a lottery.
>
> **Acceptance Criteria:**
>
> **Given** Danilo's sourced OB64 targeting research (session record 2026-08-01, reproduced in `deferred-work.md`)
> **When** ranged targeting lands
> **Then** the **sector rule** applies to ranged as it already does to melee — a corner unit may target its facing column and the centre only, a centre unit all three — and the Autonomous **depth order is front → middle → back** (same column before centre within a row), while the legal list stays row-unrestricted so a target tactic still arcs over the front line (OB64's own Leader behaviour); FR9 is amended in place with a dated note, and `docs/rules.md` follows with `rules-doc.test.ts` green.
>
> **Given** the OB64 basic Archer
> **When** the roster row changes
> **Then** `archer.actions` is `{ front: 1, mid: 1, back: 2 }`.
>
> **Given** a Guard row (Knight mid, Phalanx front/mid) with **no living ally behind it in the same column**
> **When** the unit acts
> **Then** it performs its class's attack instead of raising a shield (the `attackMoveOf` back-row fallback is the existing seam), so guarding is never strictly dominated; FR33 and dossier §4 gain the condition.
>
> **Given** AD-8 discipline
> **When** the pass ships
> **Then** it carries **one** `balanceVersion` bump (11 → 12) with the hash re-pinned, goldens re-recorded and **audited event-by-event** (expect most of the 11 to change — archers, cleric staff, witches and bolts all route through the changed path; a golden containing none of them must be byte-identical), the both-mode convergence sweep re-runs at `runs=500` across seeds, and any out-of-band archetype is tuned or recorded — never silent.
>
> **Given** the shell
> **When** the pass ships
> **Then** `logVersion` stays 4 and no event shape changes; the Draft/Placement card copy that teaches targeting is checked for accuracy.

### 4.3 `epics.md` — NEW Story 5.12

**Story 5.12: Status duration — the sleep rework**

> As a player,
> I want a slept unit to lose a bounded amount of the fight, not all of it,
> So that a single Witch cast cannot remove a unit from the battle before it acts.
>
> **Acceptance Criteria:**
>
> **Given** the epic-4 team agreement (*source evidence before engine code*)
> **When** this story starts
> **Then** its FIRST task is an **OB64 evidence sitting with Danilo** on status semantics — duration, wake conditions, stacking — producing dated dossier decisions; **no engine code before that.** This is the 4.8 monster-saga lesson applied.
>
> **Given** the confirmed behaviour (sleep never clears inside an engagement, so in single mode a pass-1 cast disables a unit for the whole battle)
> **When** the rework lands
> **Then** sleep has a **bounded, specified duration**, FR16 is amended in place with a dated note, `docs/rules.md` follows, and the `ActionSkipped { reason: 'asleep' }` narration still reads correctly turn by turn.
>
> **Given** ADR 0003's frozen draw table
> **When** the rule is chosen
> **Then** a **deterministic** rule is preferred so the table stays frozen; if a resist roll is chosen instead it requires an ADR amendment inserting a declared-extensible position — **never a silent insert**.
>
> **Given** AD-8
> **When** the rework ships
> **Then** it rides story 5.11's `balanceVersion` 12 if landed together, or takes 12 → 13 if separate; goldens containing a Witch re-record and are audited; the both-mode sweep stays in band.

### 4.4 PRD amendments (executed by the implementing stories, not this proposal)

- **FR9** — dated note: ranged is **sector-restricted**, not global; corner → facing + centre, centre → all three; Autonomous depth order front → middle → back; the legal list stays row-unrestricted so target tactics arc over the front. Records that "global range" as originally written diverged from OB64 and was corrected at story 5.11.
- **FR15** — note only: the Archer row moves to `1/1/2`; `BALANCE.classes` remains normative (per today's amendment).
- **FR16** — dated note: statuses gain an explicit **duration** contract; records that the original text never specified one and that whole-engagement sleep was the consequence.
- **FR33** — dated note: a Guard row with no living ally behind it falls through to its class's attack.

### 4.5 `sprint-status.yaml`

- `5-11-…` and `5-12-…` added as `backlog`, sequenced before 5.10's completion.
- 5.10's entry records: held open by this proposal; Tasks 2/3 results invalidated; the verdict addendum to be rewritten.
- Epic-5 sequencing note updated: **5.11 → 5.12 → 5.10 → 5.9 (floats) → retrospective.**

---

## 5. Implementation handoff

**Scope: MODERATE** → Product Owner + Developer.

| Recipient | Deliverable |
|---|---|
| **PO (Danilo)** | Ratify this proposal. Supply **OB64 status/sleep evidence** — story 5.12 is gated on it and cannot start without it. |
| **Dev** | Apply §4.1–4.5 edits, then `create-story` for 5.11 and implement. 5.12 follows once evidence exists. |
| **Dev (5.10)** | After 5.11/5.12 land: re-run the convergence sweep, re-derive the floor, rewrite the `balance-verdict.md` addendum, re-verify the FR19 pins (the poison fixture's exact tick counts will move), then close AC5 on a fresh felt-balance pass. |

### Success criteria

1. Ranged targeting matches the OB64 spec — sector-restricted, front-first depth order — with tests that pin each rule independently, including an asymmetric fixture that would fail under the old rearmost-first order (the chirality lesson: symmetric fixtures pass mirror bugs).
2. Archer is `1/1/2`; a Guard row with nothing behind it attacks.
3. Sleep has a bounded, source-evidenced duration; ADR 0003 stays frozen unless formally amended.
4. One `balanceVersion` train, hash re-pinned, goldens audited, both-mode sweep in band at `runs=500`.
5. **5.10 re-certifies against the shipped model and Danilo signs off** — the certificate then describes the game link-play is actually built on.

### Explicitly out of scope

The deferred **performance story** (NFR1 floor, instrumentation-first) stays deferred and unchanged. Mid-battle tactics, the tactics-roster extension and team-PvP remain post-link-play north-stars.
