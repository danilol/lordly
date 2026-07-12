# Deferred Work

## Product wishes (PO, 2026-07-12) — to scope in a future planning pass

- **"Nice documentation about the project"** (Danilo, during epic 1). The plan already carries NFR3's artifacts (README, `docs/rules.md` arriving with story 2.4's Help screen, ADRs, engine doc comments) — but the PO wants to go beyond that baseline. Candidate scope to discuss when planned (e.g. via `correct-course` or when epic 2 closes): a proper docs site or polished docs/ index, architecture walkthrough for outsiders, gameplay/rules showcase, screenshots/GIFs in the README, contributor guide. Not a current-sprint concern.

## Deferred from: code review of story-1.1 (2026-07-12)

- No lint/format step in the CI quality gate — only typecheck/test/coverage run today; adding ESLint/Prettier (or equivalent) is a scope decision for a future story, not required by story 1.1's ACs.
- `pnpm-workspace.yaml`'s `allowBuilds` allowlist is hand-maintained (esbuild, sharp, workerd — currently all legitimately required by wrangler's dependency tree). A future dependency bump that introduces a new native postinstall script not yet listed will hard-fail `pnpm install --frozen-lockfile` in CI with `ERR_PNPM_IGNORED_BUILDS`, unrelated to any code change in that PR.
- `apps/web/src/main.ts`'s `StartGame('game-container')` call has no try/catch or fallback UI if Phaser/WebGL initialization throws. This is pre-existing vendored template code (phaserjs/template-vite-ts), out of scope per story 1.1's scope fence ("keep the template's demo scene as-is for now... do NOT start building game scenes here").
- `packages/engine/tsconfig.json` and `apps/web/tsconfig.json` differ in strictness flags (`noUnusedLocals`/`noUnusedParameters` only in web, `noUncheckedIndexedAccess` only in engine) with no documented rationale for the asymmetry. Low urgency; revisit if it causes friction.

## Deferred from: code review of story-1.1, second pass (2026-07-12)

- CI's corepack bootstrap depends on the runner image's preinstalled Node still bundling corepack; corepack has been removed from newer Node distributions, so a future ubuntu-latest image bump could break the `corepack enable` step. Revisit if/when CI fails with "corepack: command not found".
- `pnpm -r typecheck` silently skips any workspace package that lacks a `typecheck` script (it only hard-fails when no package has it). No clean guard exists; recheck when a third workspace package is added.
- Template cruft in apps/web: `phasermsg` marketing banner in the prod Vite config (also prints its success banner even when the build fails), `Game.ts` demo text containing a phaser.io address, and duplicated dev/prod Vite configs carrying dead keys (`manualChunks` unused by the dev server, `server.port` unused by `vite build`). The demo scene and template structure are replaced in stories 1.2/2.x.

## Deferred from: code review of story-1.3 (2026-07-12)

- The engine purity guard is regex-based and inherently bypassable (e.g. computed member access, aliased imports). An ESLint `no-restricted-globals`/`no-restricted-imports` config or AST-based import-graph check would be categorically stronger; fold into the lint-tooling decision already deferred from story 1.1's review.

## Deferred from: code review of story-1.4 (2026-07-12)

- Chassis `BattleEnded`/`hpPct`/`EngagementEnded.hp` are hardcoded stubs (all-full-HP draw) type-indistinguishable from real judged output. Story 1.5 makes them real; no shell consumes the log until 1.9. Revisit only if a consumer appears before 1.5.
- Seed-range bound `0xffffffff` is duplicated in `validate.ts` and `rng.ts` with divergent error types (InvalidMatchSetupError vs RangeError). Validate-first ordering makes it correct today; fold into a shared constant when rng.ts is next touched.
