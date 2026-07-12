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

Then open http://localhost:8080.

## Deploy

Production runs as static assets on Cloudflare Workers at **https://lordly.lol-gaming.workers.dev**. Every push to `main` deploys automatically from CI once these one-time secrets exist:

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
