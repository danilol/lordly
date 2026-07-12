# ADR-001: Engine consumed as raw TypeScript source

Status: Accepted (story 1.1, 2026-07-12)

## Decision

`@lordly/engine` ships no build step. Its `package.json` `main`/`exports` point
directly at `src/index.ts`, and consumers (Vite, Vitest) compile the source
themselves. Each package typechecks independently with `tsc --noEmit`.

- No `composite: true`, no TypeScript project references anywhere.
- Both packages use `"moduleResolution": "bundler"`, so the `exports` →
  `src/index.ts` entry carries the types as well — no `.d.ts` emit needed.

## Rationale

- `composite: true` requires declaration emit and breaks plain `tsc --noEmit`
  (error TS6304), which is the per-package typecheck this repo standardizes on.
- A build step for the engine would add watch/orchestration complexity for zero
  benefit: Vite 8 and Vitest 4 consume workspace TS sources directly. This is
  community consensus for Vite + pnpm monorepos, not an official spec.

## Fallback

If Vite ever balks at raw TS from the workspace package, add a `resolve.alias`
entry in the web Vite configs mapping `@lordly/engine` → `../../packages/engine/src`
and record the change here.
