# Review: Stack Versions & Reality Check — Epic 4 Amendment (2026-07-16)

- **Target:** `ARCHITECTURE-SPINE.md` (updated 2026-07-16 for Epic 4) — Stack table, AD-3 dependency claims, AD-7 CI claims, structural seed, Epic 4 amendment's implicit dependency needs
- **Method (2026-07-16):** (a) repo reality — root/`packages/engine`/`apps/web` `package.json`, `pnpm-lock.yaml` resolved versions, `.nvmrc`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `eslint.config.mjs`, actual `src/` layout; (b) live web — npm registry dist-tags for all 10 stack packages + `@fast-check/vitest`, endoflife.date Node schedule
- **Prior art:** `reviews/review-versions.md` (2026-07-12) verified the table against live sources and flagged 3 stale rows (Node, pnpm, TypeScript); **all three fixes were applied** — the current table matches what that review recommended.
- **Verdict:** **Pass.** Every stack row ratifies shipped reality exactly and every line is still current on npm as of today. The Epic 4 amendment introduces no silent dependency need. Two non-version gaps noted: the spine doesn't ratify the shipped lint/purity CI gate, and Node 24's active-LTS window closes mid-Epic-4 horizon.

---

## Findings

### F1 — MEDIUM — AD-7 and the stack table don't ratify the shipped lint gate (which enforces AD-1)

**Spine says (AD-7):** "Every push runs typecheck + full test suite + the engine coverage gate (≥90% lines, NFR2)."

**Repo reality:** `.github/workflows/ci.yml` also runs `pnpm lint` (story 2.0) — ESLint 10 + Prettier, including an **engine AST purity layer** (`eslint.config.mjs`: `no-restricted-imports` allowing only `pure-rand` + relative imports in `packages/engine/src`, bans on `Date.now`, `Math['random']`, ambient platform globals) paired with `packages/engine/test/purity.test.ts`, which also **locks the engine's dependency list**. This is the mechanical enforcement of AD-1/AD-3 — load-bearing, not cosmetic. The root toolchain (`eslint ^10.7.0`, `typescript-eslint ^8.63.0`, `prettier ^3.9.5`, `@vitest/coverage-v8 ^4.1.10`) appears nowhere in the spine.

The 2026-07-16 amendment ratified other shipped facts (e.g. `storage.ts`'s home in `flow/`, "shipped home ratified 2026-07-16") but not this one. Since the spine's stated posture is "the code owns these once it exists," this is a ratification gap, not an error — but AD-7's CI enumeration is now falsified by the workflow it binds. **Fix:** add "+ lint (incl. the engine purity layer enforcing AD-1)" to AD-7's rule; optionally one stack row for ESLint 10 / typescript-eslint 8.

### F2 — LOW — Node 24 "Active LTS" is true today but expires inside the plausible Epic 4+link-play horizon

**Reality (endoflife.date, 2026-07-16):** Node 24 is Active LTS, **active support ends 2026-10-20** (security to 2028-04-30); Node 26 (Current, 26.5.0) becomes LTS **2026-10-28**. The row is correct as written; in ~3 months it stops being the *Active* LTS. Nothing to change now — worth a Deferred-list note ("bump to Node 26 LTS after 2026-10-28") so the link-play epic doesn't inherit a maintenance-line pin the way the original spine draft did with Node 22.

### F3 — INFO — Structural seed's engine listing is a strict subset of shipped `src/`

`packages/engine/src/` also contains `judging.ts`, `validate.ts`, `hash.ts`, `index.ts` beyond the seed's six files. The seed is labeled a seed, and none of the extra modules violates any AD (validate = AD-9/AD-14 placement validation; hash = AD-8 balance-hash check). No action; noting so nobody reads the seed as a census — the census lives in `purity.test.ts`.

### F4 — INFO — pnpm pinned 11.12.0; npm `latest` is 11.13.1

`packageManager: pnpm@11.12.0` is within the spine's 11.x line; a patch-level lag is normal for a corepack pin. No action.

---

## Verified: spine ↔ repo reality (lockfile-resolved versions)

| Spine row | Repo reality | Match |
| --- | --- | --- |
| TypeScript 5.9.x explicit pin | `~5.9.3` in both workspaces → 5.9.3 | ✅ |
| Node 24 (Active LTS) | `.nvmrc` = 24; `engines.node >=24` | ✅ |
| pnpm 11.x workspaces | `packageManager pnpm@11.12.0`; `pnpm-workspace.yaml` packages/* + apps/* | ✅ |
| Phaser 4.2.x | `^4.2.1` → 4.2.1 | ✅ |
| Vite 8.x | `^8.1.4` → 8.1.4 | ✅ |
| Vitest 4.1.x | `^4.1.10` → 4.1.10 (+ coverage-v8 4.1.10) | ✅ |
| fast-check 4.x + @fast-check/vitest 0.4.x | 4.9.0 / 0.4.1 | ✅ |
| pure-rand 8.x | **exact pin 8.4.2** | ✅ |
| vite-plugin-pwa (Workbox) 1.x | 1.3.0 (workbox-build 7.4.1) | ✅ |
| wrangler 4.x | `^4` → 4.110.0 | ✅ |
| AD-3 "engine's only runtime dep is pure-rand" | `engine/package.json` dependencies = `pure-rand` only (tsx/fast-check/TS are devDeps; sim runs via tsx as a dev CLI — consistent with "dev CLI" framing) | ✅ |
| Structural seed: `flow/storage.ts` sole gateway | `apps/web/src/flow/storage.ts` exists | ✅ |

## Verified: live web, 2026-07-16 (4 days after the table's verification stamp)

| Claim | npm/endoflife reality today | Holds |
| --- | --- | --- |
| Phaser 4.2.x still current line | `latest` = 4.2.1 (no 4.3) | ✅ |
| TS 5.9 pin still right; TS 7 deferral condition unmet | `latest` = **7.0.2**; 6.0 still `beta` (6.0.0-beta); 7.1 only `next` (7.1.0-dev.20260715) — the "stable programmatic API in 7.1" trigger has not fired; the explicit-pin warning remains load-bearing | ✅ |
| Vite 8.x | `latest` = 8.1.5 (`^8.1.4` satisfies) | ✅ |
| Vitest 4.1.x stable | `latest` = 4.1.10; 5.0 still `beta` | ✅ |
| pnpm 11.x | `latest` = 11.13.1; 12 still alpha | ✅ |
| wrangler 4.x | `latest` = 4.111.0 | ✅ |
| vite-plugin-pwa 1.x | `latest` = 1.3.0 | ✅ |
| pure-rand 8.x / fast-check 4.x / @fast-check/vitest 0.4.x | 8.4.2 / 4.9.0 / 0.4.1 | ✅ |
| Node 24 Active LTS | Active until 2026-10-20 (see F2) | ✅ |

## Verified: Epic 4 amendment needs no undeclared dependency

The amendment's new surface — unit names (FR37), roles/role-relations, tactics, leaders (FR34/FR35), crit/dodge (FR36), slot budgets/size classes and two-cell monsters (FR38, AD-14) — is entirely (a) balance **data** in the versioned data file (AD-4), (b) pure TS over the **existing** `pure-rand` named-stream infrastructure (`names/A|B` derive through the same label-keyed mechanism; crit/dodge ride the existing `battle` stream). No name-generation, geometry, or data library is implied anywhere in the amended text, and the engine's dependency list is mechanically locked by `purity.test.ts` — a silent addition would fail CI. **No hidden package need found.** The scaffold-seed paragraph is now historical (the template was consumed and deps bumped, matching the lockfile) and remains accurate as history.

## Bottom line

The stack section is genuinely ratified against shipped reality — every row corresponds to an exact lockfile resolution, and none of the ten lines has moved on npm in the four days since verification. The 2026-07-12 review's three fixes all landed. The only substantive gap is F1: the spine's CI enumeration (AD-7) predates the shipped lint gate whose engine-purity layer is the mechanical enforcement of AD-1 — one sentence ratifies it. F2 is a calendar note for the Deferred list.
