# Lordly — Lord Battle Tactics

A pass-and-play tactics game: draft a warband, place it on the field, then watch a fully deterministic battle unfold. The rules live in a pure TypeScript engine (`packages/engine`); the Phaser 4 web app (`apps/web`) is only the shell that renders it. See the [PRD](docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md) and the [architecture spine](docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md) for the full picture.

## Prerequisites

- Node 24 (`.nvmrc`-free; check with `node --version`)
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

> Deployment to a real URL arrives in story 1.2 (Cloudflare, via wrangler).

## Workspace layout

```text
packages/engine/   # @lordly/engine — pure TS rules engine, no I/O (ADR-001)
apps/web/          # Phaser 4 + Vite shell, telemetry stripped
docs/adr/          # architecture decision records
docs/              # planning + implementation artifacts (BMad)
```
