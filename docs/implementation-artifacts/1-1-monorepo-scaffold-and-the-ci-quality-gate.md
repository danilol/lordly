---
baseline_commit: NO_VCS
---

# Story 1.1: Monorepo scaffold and the CI quality gate

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the game's developer,
I want a scaffolded workspace where every push is typechecked and tested,
so that all later work lands on rails from the first commit.

## Acceptance Criteria

1. **Given** an empty repository, **when** the scaffold story is complete, **then** a pnpm-workspaces monorepo exists with `packages/engine` (plain TS, only runtime dependency `pure-rand`) and `apps/web` (scaffolded from the official Phaser Vite + TypeScript template), **and** dependencies are bumped to the pinned stack: Phaser 4.2.x, Vite 8.x, TypeScript 5.9.x (explicit pin), Vitest 4.1.x, fast-check 4.x + @fast-check/vitest, vite-plugin-pwa 1.x, wrangler 4.x, Node 24, pnpm 11.
2. **Given** the monorepo, **when** any commit is pushed, **then** GitHub Actions runs typecheck and all tests and a red run blocks merge (AD-7), **and** a placeholder engine unit test and a web smoke test prove both packages are wired into the runner, **and** the coverage step runs from the start (the ≥90% engine-line threshold activates with story 1.6 — accepted, recorded sequencing of AD-7's gate).
3. **Given** the repo, **when** a stranger reads `README.md`, **then** they can install, test, and run locally in documented steps (NFR3).

## Tasks / Subtasks

- [x] Task 1: Initialize repo + workspace skeleton (AC: 1)
  - [x] `git init -b main` in `/Users/danilo/projects/js/lordly` (currently NOT a git repo; `-b main` because plain init may default to `master` and branch protection targets `main`); add `.gitignore` (node_modules, dist, coverage, .DS_Store)
  - [x] Root `package.json`: `"private": true`, `"packageManager": "pnpm@11.12.0"`, `"engines": {"node": ">=24"}`. Root scripts: `"typecheck"` fans out via `pnpm -r typecheck`; `"test": "vitest run"` and `"coverage": "vitest run --coverage"` run vitest ONCE at the root — never `pnpm -r test`, which would bypass the root `test.projects` config and the root-only coverage design (Task 4)
  - [x] `pnpm-workspace.yaml` with `packages: ["packages/*", "apps/*"]`
- [x] Task 2: Create `packages/engine` (AC: 1, 2)
  - [x] Hand-rolled plain TS package named `@lordly/engine`; runtime dep: `pure-rand@^8.4.2` ONLY; devDeps: `typescript@~5.9.3`, `fast-check@^4`, `@fast-check/vitest@^0.4` (first used in stories 1.3/1.4; they live here, not in web)
  - [x] `package.json` `"main"`/`"exports"` point at `src/index.ts` (source consumed directly by Vite/Vitest — no build step) and script `"typecheck": "tsc --noEmit"`
  - [x] `tsconfig.json` strict mode, `"moduleResolution": "bundler"`, NO `composite`, NO project references — the exports→`src/index.ts` entry already carries types for bundler resolution, and `composite: true` would break `tsc --noEmit` (TS6304). This choice is recorded as ADR-001 (Task 6)
  - [x] `src/index.ts` exporting a trivial placeholder (e.g. `export const ENGINE_NAME = 'lordly-engine'`) — NO game logic in this story
  - [x] `test/placeholder.test.ts` — one real assertion importing from `src/index.ts`
- [x] Task 3: Scaffold `apps/web` from the official template (AC: 1)
  - [x] `npx degit phaserjs/template-vite-ts apps/web` — the `npm create @phaserjs/game` CLI named in the epic AC is INTERACTIVE-ONLY (verified July 2026); degit of the same official template repo is the automation path (recorded deviation from the epics.md wording, same artifact)
  - [x] Rename the scaffolded package: set `"name": "web"` in `apps/web/package.json` (template ships as `template-vite-ts`; the `pnpm --filter web` commands in Task 7 depend on this) and add script `"typecheck": "tsc --noEmit"`
  - [x] **Strip the template's telemetry**: delete `log.js` / any `phaser.io` beacon call from scripts and `src/main.ts`; keep plain `dev`/`build` scripts (NFR5: no tracking, ever)
  - [x] Bump template deps (ships stale: Vite 6.3.1, TS 5.7.2): `phaser@^4.2.1`, `vite@^8.1.4`, `typescript@~5.9.3`
  - [x] Add `"@lordly/engine": "workspace:*"` dependency (no tsconfig references — see Task 2's ADR-001 choice)
  - [x] Add web devDeps: `vite-plugin-pwa@^1.3.0` (installed, NOT configured — config is story 3.3) and `wrangler@^4` (installed, NOT configured — config is story 1.2)
  - [x] Web smoke test: create `src/config/constants.ts` exporting a plain constant (e.g. `GAME_NAME = 'Lord Battle Tactics'`), used by the app, and assert on it — the module under test must NOT import Phaser (Phaser misbehaves in Vitest's node environment) and never boot WebGL in tests (spine convention: shell tests are smoke-level)
- [x] Task 4: Vitest wiring (AC: 2)
  - [x] Root `vitest.config.ts` with `test.projects: ['packages/*', 'apps/*']` (the old `vitest.workspace` file is DEPRECATED since 3.2)
  - [x] Coverage: `@vitest/coverage-v8@^4.1.10` at root. GOTCHA (verified): the `coverage` block is ROOT-ONLY — never valid inside project configs. Configure `coverage.thresholds` at root with a commented placeholder for the engine glob threshold, e.g. `// activates in story 1.6: 'packages/engine/**': { lines: 90 }`
  - [x] `pnpm test` and `pnpm coverage` green from the repo root
- [x] Task 5: GitHub Actions CI gate (AC: 2)
  - [x] `.github/workflows/ci.yml` on `push` + `pull_request`: `actions/checkout@v6` → `pnpm/action-setup@8912a9102ac27614460f54aedde9e1e7f9aec20d # v6.0.5` with NO `version` input (the action reads `packageManager` from root package.json; supplying both errors with "Multiple versions of pnpm specified") → `actions/setup-node@v6` with `node-version: 24`, `cache: "pnpm"` (action-setup MUST precede setup-node for the cache) → `pnpm install --frozen-lockfile` (pnpm defaults to frozen in CI; be explicit) → `pnpm -r typecheck` → `pnpm test` → `pnpm coverage` — DEVIATION (recorded): pnpm/action-setup v6 is broken for packageManager-pinned versions newer than its bundled pnpm (bootstrap crash / broken @pnpm/exe stub — see Debug Log); replaced with `corepack enable`, which reads the SAME `packageManager` field. All other steps as specified.
  - [x] Create the GitHub repo and push (`gh repo create lordly` — if `gh` is unauthenticated, pause and ask the user to run `gh auth login`) — created as private (user choice), then made public (user choice) to enable branch protection on the free plan
  - [x] "Red blocks merge" = branch-protection/ruleset on `main` requiring the CI check — a GitHub SETTINGS step (`gh api` or manual). If the token can't set it, PAUSE and ask the user to enable it (Settings → Rules) before Task 7 — the red-test verification below depends on protection being active; do not silently defer it to documentation — set via `gh api`: required status check `ci`, `enforce_admins: true`
- [x] Task 6: README + ADR-001 (AC: 3)
  - [x] Project intro (one paragraph, link to PRD/spine paths), prerequisites (Node 24, pnpm 11), then exactly: install → test → run-locally steps; note that deploy arrives in story 1.2
  - [x] Seed `docs/adr/ADR-001-engine-consumed-as-source.md`: engine exported as raw TS source (`exports` → `src/index.ts`), no composite/project references, `tsc --noEmit` per package — with the TS6304 rationale from Task 2 (also solves git's inability to track an empty `docs/adr/`)
  - [x] Verify by following your own README from a clean checkout state
- [x] Task 7: Verify everything end-to-end (AC: 1, 2, 3)
  - [x] Fresh `pnpm install` → `pnpm -r typecheck` → `pnpm test` → `pnpm coverage` all green locally
  - [x] `pnpm --filter web dev` serves the template game on :8080 (template default) in a browser
  - [x] Push a commit and confirm the GitHub Actions run goes green; confirm a deliberately red test blocks merge (requires Task 5's branch protection active — pause for the user if it isn't), then remove the red test — green run 29178059820; red-test PR #1 reported `mergeStateStatus: BLOCKED`; PR closed unmerged and branch deleted

### Review Findings

_Reviewed 2026-07-12 via `bmad-code-review` (Blind Hunter + Edge Case Hunter + Acceptance Auditor, diff scoped to the 16 authored/modified files, empty-tree baseline)._

- [x] [Review][Patch] Production build is broken under the pinned Vite 8.x stack — `manualChunks` legacy object syntax rejected by Rolldown [apps/web/vite/config.prod.mjs:25] — fixed: converted to function form in both vite configs; verified `pnpm --filter web build` succeeds locally and in CI (run 29195604738)
- [x] [Review][Patch] CI runs twice per PR push — `push`/`pull_request` triggers have no branch filter or concurrency group [.github/workflows/ci.yml:3] — fixed: `push` filtered to `branches: [main]`, added a `concurrency` group with `cancel-in-progress`
- [x] [Review][Patch] ci.yml has no `permissions:` block (default, broader `GITHUB_TOKEN` scope) [.github/workflows/ci.yml:7] — fixed: added `permissions: contents: read`
- [x] [Review][Patch] Node version is enforced only by README prose — no `.npmrc` `engine-strict` or `.nvmrc` [package.json] — fixed: added `.npmrc` (`engine-strict=true`) and `.nvmrc` (`24`)
- [x] [Review][Patch] `terser` is listed under `dependencies` instead of `devDependencies` (it's a build-time-only minifier) [apps/web/package.json:14] — fixed: moved to devDependencies
- [x] [Review][Patch] `.gitignore` has no secret-related patterns (`.env*`, `*.pem`, etc.) [.gitignore] — fixed: added `.env`, `.env.*`, `*.pem`, `*.key`
- [x] [Review][Patch] Static `<title>Phaser - Template</title>` in index.html was never updated to match the dynamic `document.title = GAME_NAME` set in main.ts [apps/web/index.html:8] — fixed: static title now reads "Lord Battle Tactics"
- [x] [Review][Patch] `@lordly/engine` is declared as a dependency but never imported anywhere in apps/web — the riskiest cross-package resolution path in ADR-001 is unexercised by any test [apps/web/package.json:12] — fixed: added `apps/web/test/engine-resolution.test.ts` importing `ENGINE_NAME` from `@lordly/engine`, proving the exports-map/bundler-resolution path works
- [x] [Review][Patch] `packages/engine/tsconfig.json` and `apps/web/tsconfig.json` duplicate identical compiler options with no shared base config [packages/engine/tsconfig.json:1] — fixed: extracted `tsconfig.base.json` (module, moduleResolution, strict, skipLibCheck); both packages now `extends` it, package-specific options (target, lib, noUnusedLocals, etc.) left as-is
- [x] [Review][Defer] No lint/format step in the CI quality gate — real gap, not required by this story's ACs [.github/workflows/ci.yml] — deferred, out of scope for this story
- [x] [Review][Defer] `allowBuilds` in pnpm-workspace.yaml is a hand-maintained allowlist; a future dependency bump could introduce an unlisted native postinstall script and hard-fail CI [pnpm-workspace.yaml:4] — deferred, pre-existing risk pattern, not a current defect (verified `sharp`/`workerd` are legitimately required today by wrangler's dependency tree)
- [x] [Review][Defer] `StartGame()` in main.ts has no try/catch or fallback UI if Phaser/WebGL init throws [apps/web/src/main.ts:8] — deferred, pre-existing vendored template code, explicitly out of scope per this story's scope fence ("keep the template's demo scene as-is")
- [x] [Review][Defer] tsconfig strictness flags differ between packages (`noUnusedLocals`/`noUnusedParameters` only in web, `noUncheckedIndexedAccess` only in engine) with no documented rationale [packages/engine/tsconfig.json, apps/web/tsconfig.json] — deferred, stylistic asymmetry, low urgency

#### Re-review (2026-07-12, second pass after patches)

- [x] [Review][Decision] CI `push` trigger narrowed to `branches: [main]` deviates from AC2's literal "when any commit is pushed" and AD-7's "CI gate on every push" — a feature-branch push with no open PR now triggers no CI at all. Either restore the unfiltered `push` trigger (accepting duplicate runs on PR branches) or record the narrowing as an accepted deviation. — RESOLVED (user decision): keep the filter; ACCEPTED DEVIATION from AC2/AD-7 literal wording. Rationale: branches get CI as soon as a PR is opened (the only path to merge), no commit can reach main unverified, and unfiltered push would double-run CI on every PR-branch push.
- [x] [Review][Patch] README states the repo is "`.nvmrc`-free" but the previous review pass added `.nvmrc` — the prose is now false [README.md:7] — fixed: reads "`.nvmrc` provided — `nvm use`"
- [x] [Review][Patch] `manualChunks(id)` matches 'phaser' as a bare substring — a checkout path or dependency containing "phaser" would drag unrelated modules into the phaser chunk [apps/web/vite/config.prod.mjs:25, config.dev.mjs:8] — fixed: tightened to `node_modules/phaser/`; verified the phaser chunk still splits in the built output
- [x] [Review][Patch] `logLevel: 'warning'` is not a valid Vite log level (valid: silent|error|warn|info) — verified against installed Vite source; suppresses build warnings/errors. Inherited template bug [apps/web/vite/config.prod.mjs:21] — fixed: `'warn'`; the previously-suppressed chunk-size warning now surfaces in build output, confirming the fix
- [x] [Review][Patch] `cancel-in-progress: true` applies to main too — rapid successive pushes to main leave superseded commits with no completed CI verdict [.github/workflows/ci.yml:10] — fixed: `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`
- [x] [Review][Patch] CI job has no `timeout-minutes` — a hung step runs 6 hours at the default [.github/workflows/ci.yml:16] — fixed: `timeout-minutes: 15`
- [x] [Review][Patch] `engines` has no `pnpm` entry, so `engine-strict` never guards against an old standalone pnpm regenerating an incompatible lockfile [package.json:5] — fixed: added `"pnpm": ">=11"`
- [x] [Review][Patch] Web target/lib is ES2020 while engine target is ES2022 — engine source using an ES2021+ API would typecheck in the engine but fail `tsc --noEmit` in apps/web, an ADR-001 hazard [apps/web/tsconfig.json:4] — fixed: web target/lib aligned to ES2022
- [x] [Review][Patch] CI runs the full test suite twice — `pnpm test` then `pnpm coverage` execute the identical suite; the plain test step adds no signal [.github/workflows/ci.yml:42] — fixed: dropped the standalone `pnpm test` step; `pnpm coverage` runs the full suite (AC2's "runs all tests" still satisfied)
- [x] [Review][Patch] `.gitignore`'s `.env.*` pattern also ignores the conventional `.env.example` — add a `!.env.example` negation [.gitignore:6] — fixed
- [x] [Review][Patch] `apps/web/README.md` is the untouched stock Phaser template README — advertises Vite 6.3.1/TS 5.7.2 and `npm run` commands that don't apply to this pnpm workspace [apps/web/README.md] — fixed: deleted; the root README is the single source of usage docs
- [x] [Review][Patch] `actions/checkout@v6` and `actions/setup-node@v6` are pinned to mutable major tags while the story's own convention (action-setup) was SHA-pinning [.github/workflows/ci.yml:19,31] — fixed: both SHA-pinned with `# v6` tag comments
- [x] [Review][Defer] Runner images may drop corepack (removed from newer Node distributions) — the CI bootstrap depends on the runner's preinstalled corepack [.github/workflows/ci.yml:25] — deferred, future-platform risk, revisit if runners break
- [x] [Review][Defer] `pnpm -r typecheck` silently skips any future package lacking the script (only hard-fails when NO package has it) [package.json:9] — deferred, no clean guard exists today; recheck when a third workspace package is added
- [x] [Review][Defer] Template cruft: `phasermsg` marketing banner in prod builds (prints success banner even on failed builds), `Game.ts` demo text with phaser.io address, duplicated dev/prod vite configs with dead keys (manualChunks unused in dev, server.port unused in prod) — deferred, demo scene and template structure are replaced in stories 1.2/2.x per scope fence

**Re-review dismissed (10):** review-scope meta-finding about lockfile/scene files being outside the diff (deliberate scoping; scenes are vendored template code, lockfile is generated); README duplicating the pnpm version already in `packageManager` (a README must state prerequisites); "speculative" deps pwa/wrangler/fast-check/pure-rand (spec-mandated forward-installs per Dev Notes); missing lint step (already deferred in pass 1); missing per-package `test` scripts (deliberate per Task 1's root-only vitest design); `constants.test.ts` being trivial (spec-scoped smoke placeholder); coverage report including web boilerplate (report-only by design, 1.6 threshold scopes engine only); `passWithNoTests` for future empty packages (premature, would weaken the gate); DOMContentLoaded-already-fired edge (unreachable — module scripts execute before DOMContentLoaded fires in this app's loading model); dead `#app` div / missing `strictPort` (cosmetic; `#app` may be referenced by the template stylesheet).

**Dismissed as noise / false positive / already handled by spec intent (11):** empty coverage thresholds (by design, activates story 1.6 per AC2); corepack-workaround rationale "unverifiable" (it's documented in this story's own Debug Log, just outside the reviewed file scope); "local onboarding will hit the same corepack bug" (premise wrong — `corepack enable` is the working fix, not the broken path); `fast-check`/`@fast-check/vitest`/`wrangler` as "speculative" deps (explicitly specified as deliberate forward-installs in this story's own Dev Notes); missing trailing newline in apps/web/tsconfig.json (cosmetic, no formatter configured); main.ts blank-line formatting (cosmetic); corepack step lacking custom error handling (already fails loudly with corepack's own stderr, observed directly during Task 5 debugging); `@lordly/engine` not importable from plain Node (by design per ADR-001 — bundler-only resolution is the intended architecture); missing per-package `test` scripts in apps/web/packages/engine (deliberately omitted per Task 1's explicit "never `pnpm -r test`" instruction); "dead" `allowBuilds` entries for sharp/workerd (refuted — `pnpm why` confirms both are required by wrangler); `enforce_admins` relaxed to `false` post-verification (already a deliberate, twice-confirmed user decision with rationale recorded in this story's Debug Log; re-verified empirically just now — a fresh red-test PR still reports `mergeStateStatus: BLOCKED` under the current setting).

## Dev Notes

### Architecture constraints that bind THIS story (from ARCHITECTURE-SPINE.md)

- **Paradigm — functional core / imperative shell:** `packages/engine` = pure (no I/O, no clock, no `Math.random()`, no DOM, no Phaser, no Node APIs). `apps/web` = all effects. Every file must answer "core or shell?"
- **AD-3 dependency direction:** web → engine, never sideways or back. Engine's ONLY runtime dep is `pure-rand`. Do not add lodash/utility packages to the engine — its purity is physically enforced by having no other deps.
- **AD-7:** CI gate on every push; red blocks merge. Environments = local dev + production only.
- **Structural seed (target layout):**

```text
lordly/
  pnpm-workspace.yaml
  packages/engine/        # @lordly/engine — pure TS, src/ + test/
  apps/web/               # Phaser 4 + Vite template, telemetry stripped
  docs/adr/               # exists from this story on (empty is fine)
  .github/workflows/      # ci.yml
```

- **Naming:** this story establishes conventions later stories inherit — package name `@lordly/engine`, root scripts `typecheck`/`test`/`coverage`, kebab-case file names as in the template.

### Pinned versions (web-verified 2026-07-12 — do NOT trust training data)

| Dep | Pin | Note |
|---|---|---|
| typescript | `~5.9.3` | ⚠️ npm `latest` is now TS **7.0.2** — a bare install gets 7; the tilde-pin is mandatory (TS 7 deferred by spine) |
| phaser | `^4.2.1` | template ships older 4.0.x |
| vite | `^8.1.4` | template ships 6.3.1 |
| vitest / @vitest/coverage-v8 | `^4.1.10` | versions track each other; do NOT use vitest 5 beta |
| fast-check / @fast-check/vitest | `^4` / `^0.4` | @fast-check/vitest is 0.4.x — NOT "4.x" |
| pure-rand | `^8.4.2` | engine's only runtime dep |
| vite-plugin-pwa | `^1.3.0` | install only; configured in 3.3 |
| wrangler | `^4` | install only; configured in 1.2 |
| node / pnpm | 24 / 11.12.0 | `engines` + `packageManager` fields; CI uses the same |

### Scaffold facts (verified against phaserjs/template-vite-ts)

- Template layout: root `index.html`, `public/assets/`, `src/main.ts` (bootstrap), `src/game/main.ts` (Phaser config), `src/game/scenes/`. Dev server port 8080. Scripts include `dev-nolog`/`build-nolog` — the plain variants run a telemetry `log.js`; **remove the telemetry entirely** rather than relying on the -nolog variants (NFR5).
- Keep the template's demo scene as-is for now — it proves Phaser boots; story 1.2 replaces it with the real Home scene. Do NOT start building game scenes here.
- Engine consumed as source: `exports` → `src/index.ts`, no engine build step, no composite/project references (`tsc --noEmit` per package with `moduleResolution: bundler` — see Task 2 and ADR-001). This is community consensus for Vite 8 + pnpm monorepos, not an official spec — if Vite balks at raw TS from the workspace package, the fallback is a `resolve.alias` entry; record any change in ADR-001.

### Scope fences (things this story must NOT do)

- NO game logic, NO domain types, NO balance data (story 1.3), NO deploy (1.2), NO PWA/service-worker config (3.3), NO state libraries ever (AD-5), NO extra engine deps (AD-3).
- Do not attempt to boot Phaser or WebGL inside Vitest — web tests stay smoke-level (import pure modules only). The engine carries the correctness burden from 1.3 onward.

### Testing standards for this story

- Placeholder tests must be REAL tests (import real code, assert real values) so the CI wiring is proven honestly — not `expect(true).toBe(true)`.
- Coverage runs from this story (report only); thresholds stay off until story 1.6 — leave the commented glob-threshold placeholder in the root config so 1.6 just uncomments it.

### Project Structure Notes

- Greenfield: `/Users/danilo/projects/js/lordly` currently contains only `docs/`, `_bmad/`, `.claude/`, `ogre_game.txt` — no `src`, no git. The planning artifacts stay where they are; the monorepo grows around them. Add `_bmad/` and `.claude/` to the repo (they're the method's config), but exclude any local temp dirs via `.gitignore`.
- GitHub repo name: `lordly` (matches slug convention from the brief).

### References

- [Source: docs/planning-artifacts/epics.md#Story-1.1] — ACs (verbatim source of truth)
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#Design-Paradigm, #AD-1, #AD-3, #AD-7, #Stack, #Structural-Seed]
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#NFR2, #NFR3, #NFR5]
- Verified externally (2026-07-12): phaserjs/create-game CLI source (interactive-only), phaserjs/template-vite-ts repo, vitest.dev/guide/projects + /config/coverage (root-only coverage, projects field), pnpm.io/continuous-integration (official CI YAML), npm dist-tags for every pin above

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Fable 5)

### Debug Log References

- Local toolchain: system Node was v20; used nvm's Node v24.16.0 and installed pnpm 11.12.0 into it. `gh` was absent; installed via `brew install gh` (v2.96.0).
- pnpm 11 `allowBuilds` prompt appeared in `pnpm-workspace.yaml` on first install; approved esbuild, sharp, workerd postinstall scripts.
- Red-phase proof: with `ENGINE_NAME` deliberately set to `'broken'`, `pnpm test` failed 1/2 — confirms the engine test is real and both projects are wired into the root runner. Restored → 2/2 green.
- Clean-checkout verification: wiped all `node_modules`, `pnpm install --frozen-lockfile` → typecheck, test, coverage all green; `pnpm --filter web dev` served the template game on :8080 (verified via curl).
- CI failure saga (pnpm/action-setup v6 is broken for pinned versions): (1) v6.0.5 bundles a pnpm 11.0.0-rc.5 bootstrap that crashes on ANY command with "Cannot use 'in' operator to search for 'integrity' in undefined" before self-updating to the packageManager-pinned 11.12.0 (upstream fix landed in v6.0.7). (2) v6.0.9's bootstrap (11.7.0) crashes in `lockfileToDepGraph` during the self-update install of 11.12.0. (3) v6.0.9 with `standalone: true` leaves a broken text-stub at `@pnpm/exe/pnpm`, killing setup-node's `pnpm store path` cache probe. Resolution: replaced the action with `corepack enable` (+ `mkdir -p` for its install dir — corepack errors on a missing `--install-directory`), which reads the same `packageManager` field and fetched exactly 11.12.0. CI green in run 29178160242's predecessor (run 29178059820).
- Red-blocks-merge verification: PR #1 with a deliberately failing engine test → CI red → GitHub API `mergeStateStatus: BLOCKED` (the field the merge button consults; `enforce_admins: true` so no bypass). PR closed unmerged, branch deleted.
- Post-verification, `enforce_admins` was relaxed to `false` (user decision): with it on, the required check blocks even direct owner pushes to main, forcing a PR per commit. Now the owner can push directly (CI still runs on every push) while the required `ci` check still blocks PR merges when red.

### Implementation Plan

- Engine test dirs resolve `vitest` types via Node-style walk-up to the root `node_modules` (vitest is a root devDep); no per-package vitest devDep needed.
- Web smoke-test module `src/config/constants.ts` is imported by `src/main.ts` (sets `document.title`), satisfying "used by the app" without touching Phaser in tests.
- Coverage config at root only, report-only; commented threshold glob left for story 1.6 to uncomment.

### Completion Notes List

- All 7 tasks complete. Repo: https://github.com/danilol/lordly (public — user's choice, made after learning branch protection needs GitHub Pro on private repos). Branch protection on `main` requires the `ci` check with `enforce_admins: true`; verified end-to-end with a red-test PR that GitHub reported as BLOCKED.
- Recorded deviation from Task 5's prescribed tooling: `pnpm/action-setup` v6 replaced with `corepack enable` in ci.yml — the action's bootstrap/self-update mechanism is broken when `packageManager` pins a version newer than its bundled pnpm (three distinct failure modes documented in Debug Log). corepack preserves the single-source-of-truth intent (reads the same `packageManager` field).
- Telemetry fully stripped: `log.js` deleted, plain `dev`/`build` scripts kept; remaining `phaser.io` strings are a doc-comment, demo-scene text, and a local stdout build message — no network calls.
- All pinned versions verified installed: phaser 4.2.1, vite 8.1.4, typescript 5.9.3, vitest/@vitest/coverage-v8 4.1.10, fast-check 4.9.0, @fast-check/vitest 0.4.1, pure-rand 8.4.2, vite-plugin-pwa 1.3.0, wrangler 4.110.0.

### File List

- .gitignore
- package.json
- pnpm-workspace.yaml
- pnpm-lock.yaml
- vitest.config.ts
- README.md
- .github/workflows/ci.yml
- docs/adr/ADR-001-engine-consumed-as-source.md
- packages/engine/package.json
- packages/engine/tsconfig.json
- packages/engine/src/index.ts
- packages/engine/test/placeholder.test.ts
- apps/web/package.json (template, modified)
- apps/web/tsconfig.json (template, modified)
- apps/web/src/main.ts (template, modified)
- apps/web/src/config/constants.ts
- apps/web/test/constants.test.ts
- apps/web/log.js (deleted)
- apps/web/package-lock.json (deleted)
- apps/web/* (remaining files scaffolded verbatim from phaserjs/template-vite-ts)
- docs/implementation-artifacts/1-1-monorepo-scaffold-and-the-ci-quality-gate.md (story tracking)
- docs/implementation-artifacts/sprint-status.yaml (status tracking)

## Change Log

- 2026-07-12: Story 1.1 implemented end-to-end. Monorepo scaffold (pnpm workspace, `@lordly/engine`, `apps/web` from phaserjs/template-vite-ts with telemetry stripped), root Vitest projects + report-only coverage, README + ADR-001, GitHub Actions CI gate. Deviation: ci.yml uses `corepack enable` instead of the broken `pnpm/action-setup` v6 (see Debug Log). Repo made public (user decision) to enable branch protection; red-run-blocks-merge verified via PR #1 (BLOCKED, closed unmerged). All tasks complete; status → review.
- 2026-07-12: `bmad-code-review` run (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Found the production build was actually broken (Vite 8/Rolldown rejects the template's `manualChunks` syntax) — not caught by Task 7 since only `dev` was verified, never `build`. 9 patch findings applied and verified (build fix + CI build step, CI double-trigger, `permissions:` block, Node version enforcement, `terser` placement, `.gitignore` secrets, stale index.html title, engine cross-package resolution test, shared tsconfig base); 4 low-severity items deferred to `docs/implementation-artifacts/deferred-work.md`; 11 findings dismissed as noise or already matching spec intent. Full regression (typecheck/test/coverage/build) green locally and in CI (run 29195604738). Status → done.
- 2026-07-12: Product Owner (Danilo) accepted the story after a local demo (dev server on :8080, CI gate walkthrough). Status confirmed done.
- 2026-07-12: `bmad-code-review` re-run (second pass, post-patch). Validated all 9 first-pass patches as genuinely applied; caught 2 regressions introduced by the fix pass itself (README "`.nvmrc`-free" falsehood; CI push-trigger narrowing vs AC2 — resolved as an ACCEPTED DEVIATION by user decision) plus a verified pre-existing template bug (`logLevel: 'warning'` is not a valid Vite level and suppressed build warnings). 11 patches applied (README fix, manualChunks tightened to `node_modules/phaser/`, logLevel `warn`, main-exempt cancel-in-progress, `timeout-minutes: 15`, `engines.pnpm`, web tsconfig ES2022 alignment, redundant `pnpm test` CI step dropped, `!.env.example`, stock template README deleted, checkout/setup-node SHA-pinned); 3 items deferred; 10 dismissed. Full regression green. Status remains done.
