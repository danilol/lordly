# Deferred Work

## Deferred from: code review of story-1.1 (2026-07-12)

- No lint/format step in the CI quality gate — only typecheck/test/coverage run today; adding ESLint/Prettier (or equivalent) is a scope decision for a future story, not required by story 1.1's ACs.
- `pnpm-workspace.yaml`'s `allowBuilds` allowlist is hand-maintained (esbuild, sharp, workerd — currently all legitimately required by wrangler's dependency tree). A future dependency bump that introduces a new native postinstall script not yet listed will hard-fail `pnpm install --frozen-lockfile` in CI with `ERR_PNPM_IGNORED_BUILDS`, unrelated to any code change in that PR.
- `apps/web/src/main.ts`'s `StartGame('game-container')` call has no try/catch or fallback UI if Phaser/WebGL initialization throws. This is pre-existing vendored template code (phaserjs/template-vite-ts), out of scope per story 1.1's scope fence ("keep the template's demo scene as-is for now... do NOT start building game scenes here").
- `packages/engine/tsconfig.json` and `apps/web/tsconfig.json` differ in strictness flags (`noUnusedLocals`/`noUnusedParameters` only in web, `noUncheckedIndexedAccess` only in engine) with no documented rationale for the asymmetry. Low urgency; revisit if it causes friction.

## Deferred from: code review of story-1.1, second pass (2026-07-12)

- CI's corepack bootstrap depends on the runner image's preinstalled Node still bundling corepack; corepack has been removed from newer Node distributions, so a future ubuntu-latest image bump could break the `corepack enable` step. Revisit if/when CI fails with "corepack: command not found".
- `pnpm -r typecheck` silently skips any workspace package that lacks a `typecheck` script (it only hard-fails when no package has it). No clean guard exists; recheck when a third workspace package is added.
- Template cruft in apps/web: `phasermsg` marketing banner in the prod Vite config (also prints its success banner even when the build fails), `Game.ts` demo text containing a phaser.io address, and duplicated dev/prod Vite configs carrying dead keys (`manualChunks` unused by the dev server, `server.port` unused by `vite build`). The demo scene and template structure are replaced in stories 1.2/2.x.
