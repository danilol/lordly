# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm install                          # install (Node >=24, pnpm >=11 — .nvmrc pins 24)
pnpm test                             # run all tests (engine + web) once, from root
pnpm coverage                         # same, instrumented — engine has a 90% line gate (AD-7/NFR2)
pnpm typecheck                        # tsc --noEmit in every workspace package
pnpm lint / pnpm lint:fix             # eslint (incl. engine purity AST rules) + prettier --check
pnpm exec vitest run <path>           # run a single test file, e.g. packages/engine/test/rng.test.ts
pnpm exec vitest run <path> -t "name" # run a single test by name
pnpm --filter web dev                 # dev server at http://localhost:8080
pnpm --filter web build               # production build
pnpm --filter @lordly/engine sim -- --runs=100 --seed=1 --threshold=0.65 --mode=single|wipeout
                                       # AI-vs-AI balance sweep over STRATEGY_POOL (NFR4)
```

CI (`.github/workflows/ci.yml`) runs, in order: `typecheck` → `lint` → `coverage` → `web build` → deploy (main only). `pnpm coverage` already runs the full suite, so CI doesn't also run `pnpm test`.

## Architecture

pnpm workspace, two packages:

- **`packages/engine`** (`@lordly/engine`) — the functional core (AD-1): pure TypeScript, no I/O, no clock, no DOM, no Phaser. Only runtime dependency is `pure-rand`. Consumed as raw TS source with no build step (ADR-001: `moduleResolution: bundler` lets `exports` point straight at `src/index.ts`, carrying types with it).
- **`apps/web`** — Phaser 4 + Vite shell that renders the engine's output. Deployed as static assets to Cloudflare Workers via `wrangler` (production: https://lordly.lol-gaming.workers.dev).

### Engine purity (AD-1) — enforced twice, not by discipline

1. `eslint.config.mjs` restricts `packages/engine/src/**` via `no-restricted-imports` / `no-restricted-globals` / `no-restricted-properties` / `no-restricted-syntax`: no `Math.random`, no `Date`/wall clock, no platform/framework imports (`phaser`, `node:*`), no ambient globals.
2. `packages/engine/test/purity.test.ts` re-checks the same contract with a regex sieve over the raw source (`import.meta.glob(..., { query: '?raw' })`) — a second, independent gate, not a duplicate of the lint rule.

Any change to what counts as "impure" must update **both** the eslint config and the `FORBIDDEN` list in `purity.test.ts`.

Determinism follows from purity: `resolveBattle` is a pure function of `MatchSetup` + seed. RNG is per-side seeded streams (`packages/engine/src/rng.ts`: `createStreams`, `STREAM_LABELS`, `nextInt`) — never a single shared stream, since that would let one side's draws perturb the other's.

Apps must import all domain types and balance data through the engine's `src/index.ts` barrel (AD-4) — never reach into engine internals from `apps/web`.

### Balance harness

`pnpm --filter @lordly/engine sim` sweeps every `STRATEGY_POOL` archetype pairing on deterministic seeds and flags any archetype whose win rate crosses the threshold (default 65%). The identical 65% band runs in CI as `packages/engine/test/sim.test.ts` in both battle modes — a pool or balance edit that creates a dominant strategy fails the build. The sweep only covers boards the AI pool can pick; it says nothing about human-only compositions (PRD Open Item 1).

### Web app structure

- `apps/web/src/scenes/*.ts` — Phaser `Scene` classes: Boot → Home → Draft → Placement → Reveal → Battle → Result, plus History/Help/Credits. **Phaser scenes are singletons** reused across a session — reset every transient field in `create()`, or state leaks between plays.
- `apps/web/src/flow/*.ts` — bridges engine and Phaser: `MatchFlow` orchestrates the match lifecycle, `MatchState` holds shared runtime state, `draftModel`/`placement`/`historyModel` adapt engine types for the UI, `storage.ts` persists to `localStorage`.
- `apps/web/src/config/constants.ts` — `BASE_WIDTH = 360` is the fixed logical canvas width every scene renders against; any change to an army-size/slot constant needs checking against every comp-rendering scene, not just the obvious ones.

## Docs map

- `docs/rules.md` — the game's "how to play" design rules (not code)
- `docs/adr/` — architecture decision records (currently ADR-001, engine-as-source)
- `docs/planning-artifacts/` — PRD, architecture spine, UX designs, epic dossiers (BMad)
- `docs/implementation-artifacts/` — `sprint-status.yaml`, per-story files, `deferred-work.md`
- `docs/performance-verdict.md` — NFR1 methodology and frame-rate verdict

## BMad workflow

This repo uses BMad project skills (`.claude/skills/`, the `bmad-*` family) for the dev loop: `create-story` → `dev-story` → `code-review` per story; `retrospective` at epic close; `correct-course` for a formal mid-sprint scope change; `sprint-status` to check where things stand.
