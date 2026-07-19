# ADR 0003 — The battle-stream draw order and count table (frozen)

- **Status:** accepted (story 4.1 design dossier, 2026-07-17)
- **Binds:** FR20, FR36, AD-10; `packages/engine` resolve/targeting from story 4.2 on
- **Freeze rule:** once story 4.6 ships, this table NEVER changes. Every stored seed's replay depends on the exact sequence and count of `battle`-stream draws; a reordering or count change silently corrupts every replay of every era battle (the seed IS the recording). Additions for future mechanics may only APPEND draws at positions this table declares extensible.

## The table

Draws on the `battle` stream, in resolution order:

**Per engagement, at initiative-schedule build:**

| # | Draw | Condition | Range | Position status |
|---|---|---|---|---|
| E1 | Initiative tie coin (A/B) | equal-AGI cross-side tie exists (FR13) | 0–1 | SHIPPED (resolve.ts:90) — unchanged |

**Per action, in this exact order:**

| # | Draw | Condition | Range | Position status |
|---|---|---|---|---|
| A1 | Confusion misfire check | actor is confused (FR16) | 0–(den−1) | SHIPPED (resolve.ts:181) — unchanged |
| A2 | Misfire redirect target | A1 misfired AND a valid redirect target exists | 0–(n−1) | SHIPPED (resolve.ts:262/276/283) — unchanged |
| A3 | **Dodge** (defender DEX) | the finalized action is a PHYSICAL SINGLE-TARGET hit (melee slash, arrow, staff bonk — including a misfired physical attack onto an ally) | 0–99 | SHIPPED (resolve.ts `rollHit`, story 4.6) |
| A4 | **Crit** (attacker DEX) | same condition as A3 — **always drawn, even when A3 dodged** (result discarded on a dodge) | 0–99 | SHIPPED (resolve.ts `rollHit`, story 4.6) |

**Zero draws, by design:** the Wizard/Sorceress row blast (magic — neither dodges nor crits, per target or otherwise), heals, Witch status casts, Guard interception (deterministic redirect — target finalization happens BEFORE A3/A4, so the dodge/crit roll against the GUARD as defender), leader-fall penalty (sober package — deterministic reversion, no "panicked" draws), Golem two-cell resolution (deterministic), tactics target selection (ties fall back to Autonomous priority — FR34, no new randomness).

## Why always-two draws (A3+A4 unconditional)

A conditional crit draw (skipped on dodge) would make an action's draw COUNT depend on its outcome. Determinism would survive (same seed → same outcomes → same count), but the fixed-count property is what keeps this table auditable forever: any physical single-target hit is exactly 2 draws, full stop. The wasted draw on a dodge costs nothing.

## Chances (tuning values — the RULES above are frozen, these numbers are sweep-policed balance data)

- dodge% = floor(defender DEX / `dexChanceDivisor`); crit% = floor(attacker DEX / `dexChanceDivisor`) — shipped as a plain divisor (`BALANCE.formulas.dexChanceDivisor: number`, currently 3), each drawn against the frozen 0–99 percent range
- crit multiplier ×3/2 (`BALANCE.formulas.critMultiplier`, a `Ratio`), applied in the FR15 fixed order immediately AFTER RPS (base → blast attenuation → RPS → **crit** → status modifiers)
- `missed` (attacker-attributed accuracy) exists in the event payload but is UNUSED in wave 1 — reserved, no draw allocated; adding it later means an ADR amendment inserting a declared-extensible position, not a reorder.

## Verification contract (story 4.2/4.6)

The implementing stories pin this table with seed-identity tests: a golden battle per draw-consuming path (confused+dodge+crit in one battle), and a property test asserting draw-count invariance per action type. resolve.ts's existing STREAM-ORDERING INVARIANT comment block gains a pointer to this ADR.
