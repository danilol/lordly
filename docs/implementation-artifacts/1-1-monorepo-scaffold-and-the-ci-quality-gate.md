---
baseline_commit: NO_VCS
---

# Story 1.1: Monorepo scaffold and the CI quality gate

Status: ready-for-dev

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
- [ ] Task 5: GitHub Actions CI gate (AC: 2)
  - [ ] `.github/workflows/ci.yml` on `push` + `pull_request`: `actions/checkout@v6` → `pnpm/action-setup@8912a9102ac27614460f54aedde9e1e7f9aec20d # v6.0.5` with NO `version` input (the action reads `packageManager` from root package.json; supplying both errors with "Multiple versions of pnpm specified") → `actions/setup-node@v6` with `node-version: 24`, `cache: "pnpm"` (action-setup MUST precede setup-node for the cache) → `pnpm install --frozen-lockfile` (pnpm defaults to frozen in CI; be explicit) → `pnpm -r typecheck` → `pnpm test` → `pnpm coverage`
  - [ ] Create the GitHub repo and push (`gh repo create lordly` — if `gh` is unauthenticated, pause and ask the user to run `gh auth login`)
  - [ ] "Red blocks merge" = branch-protection/ruleset on `main` requiring the CI check — a GitHub SETTINGS step (`gh api` or manual). If the token can't set it, PAUSE and ask the user to enable it (Settings → Rules) before Task 7 — the red-test verification below depends on protection being active; do not silently defer it to documentation
- [ ] Task 6: README + ADR-001 (AC: 3)
  - [ ] Project intro (one paragraph, link to PRD/spine paths), prerequisites (Node 24, pnpm 11), then exactly: install → test → run-locally steps; note that deploy arrives in story 1.2
  - [ ] Seed `docs/adr/ADR-001-engine-consumed-as-source.md`: engine exported as raw TS source (`exports` → `src/index.ts`), no composite/project references, `tsc --noEmit` per package — with the TS6304 rationale from Task 2 (also solves git's inability to track an empty `docs/adr/`)
  - [ ] Verify by following your own README from a clean checkout state
- [ ] Task 7: Verify everything end-to-end (AC: 1, 2, 3)
  - [ ] Fresh `pnpm install` → `pnpm -r typecheck` → `pnpm test` → `pnpm coverage` all green locally
  - [ ] `pnpm --filter web dev` serves the template game on :8080 (template default) in a browser
  - [ ] Push a commit and confirm the GitHub Actions run goes green; confirm a deliberately red test blocks merge (requires Task 5's branch protection active — pause for the user if it isn't), then remove the red test

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

### Debug Log References

### Completion Notes List

### File List
