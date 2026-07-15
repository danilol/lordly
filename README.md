# Lordly — Lord Battle Tactics

A pass-and-play tactics game: draft a warband, place it on the field, then watch a fully deterministic battle unfold. The rules live in a pure TypeScript engine (`packages/engine`); the Phaser 4 web app (`apps/web`) is only the shell that renders it. See the [PRD](docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md) and the [architecture spine](docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md) for the full picture.

## Prerequisites

- Node 24 (`.nvmrc` provided — `nvm use`; check with `node --version`)
- pnpm 11 (`npm install -g pnpm@11.12.0`, or `corepack enable`)

## Install

```sh
pnpm install
```

## Test

```sh
pnpm test          # run all tests (engine + web) once from the root
pnpm coverage      # same, with a coverage report
pnpm typecheck     # typecheck every workspace package
```

## Run locally

```sh
pnpm --filter web dev
```

Then open http://localhost:8080. **Play vs AI** now leads through the playable
draft → placement flow: tap class cards to draft three units (each rolls its
element), continue to the grid, drag units into your 3×3 formation, and submit
to lock in your board against the AI's hidden commit. Reveal, battle, and
result arrive in a later story.

## Balancing harness

A headless AI-vs-AI sweep over the engine's curated `STRATEGY_POOL` (NFR4) —
the tool for spotting a dominant *AI archetype* after any balance or pool
change. It only sweeps the boards the AI can pick; it says nothing about
compositions a human player could draft but the AI pool doesn't cover — that
broader balance question is a playtesting concern (PRD Open Item 1), not
something this band certifies:

```sh
pnpm --filter @lordly/engine sim                       # defaults: --runs=20 --seed=1 --threshold=0.65 --mode=single
pnpm --filter @lordly/engine sim -- --runs=100         # bigger sample
pnpm --filter @lordly/engine sim -- --mode=wipeout     # the until-wipeout meta (story 3.0)
```

It plays every archetype pairing `runs` times on deterministic seeds (each
side on its own RNG stream) and prints win rates per archetype and per
composition — win rate counts draws as half. Any archetype above the
threshold is flagged and the command exits non-zero. The same 65% acceptance
band runs in CI as a test (`packages/engine/test/sim.test.ts`) in BOTH battle
modes, so a pool or balance edit that creates a dominant strategy fails the
build. (Flags use the `--name=value` form; anything else is rejected rather
than silently ignored.)

## Deploy

Production runs as static assets on Cloudflare Workers at **https://lordly.lol-gaming.workers.dev**. Every push to `main` deploys automatically from CI once these one-time secrets exist:

**Install / offline (FR29):** the production URL is an installable PWA — Android Chrome offers "Add to Home screen", and after one fully-completed online load the whole game (draft → battle → result, History and Replay included) works with no connection. A new deploy's service worker activates as soon as it precaches (`autoUpdate` + skipWaiting/clientsClaim), so the next launch serves the new build (ADR 0002).

**Performance (NFR1):** initial bundle ≈0.36 MiB gzip (12% of the 3 MiB budget); cold load on throttled 4G ≈2.5s to interactive. Full methodology and the frame-rate verdict: [`docs/performance-verdict.md`](docs/performance-verdict.md).

1. Create a free [Cloudflare](https://dash.cloudflare.com) account.
2. Create an API token from the **"Edit Cloudflare Workers"** template (My Profile → API Tokens).
3. Find your **Account ID** (Workers & Pages → right sidebar, or the dashboard URL path).
4. Set both as repo secrets:

```sh
gh secret set CLOUDFLARE_API_TOKEN   # paste the token when prompted
gh secret set CLOUDFLARE_ACCOUNT_ID  # paste the account id
```

Manual deploy from your machine (note the `run` — bare `pnpm deploy` is a pnpm builtin):

```sh
pnpm --filter web exec wrangler login
pnpm --filter web run deploy
```

## Workspace layout

```text
packages/engine/   # @lordly/engine — pure TS rules engine, no I/O (ADR-001)
apps/web/          # Phaser 4 + Vite shell (src/scenes/, deployed via wrangler)
docs/adr/          # architecture decision records
docs/              # planning + implementation artifacts (BMad)
```
