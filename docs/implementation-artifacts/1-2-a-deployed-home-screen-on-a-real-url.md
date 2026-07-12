---
baseline_commit: fb45ff6f94ec56c0f114848da2abc66a793ce017
---

# Story 1.2: A deployed home screen on a real URL

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want the game's URL to load a home screen on my Android phone,
so that from day one there is a real, reachable game to grow.

## Acceptance Criteria

1. **Given** a merge to `main`, **when** the deploy workflow runs, **then** `apps/web` static assets deploy to Cloudflare Workers via wrangler (AD-7).
2. **Given** the production URL, **when** opened in Android Chrome, **then** a portrait-oriented Home scene shows the game title and a disabled "Play vs AI" button (FR30 layout baseline).
3. **Given** the repo, **when** the README's deploy section is followed, **then** a stranger can deploy in documented steps (NFR3).

## Tasks / Subtasks

- [x] Task 1: Replace the template demo with the real Home scene (AC: 2)
  - [x] Restructure to the spine layout (AD-5 seed): create `apps/web/src/scenes/HomeScene.ts`; DELETE the template's `src/game/` tree entirely (`src/game/main.ts`, `src/game/scenes/Boot.ts`, `Preloader.ts`, `MainMenu.ts`, `Game.ts`, `GameOver.ts`) — story 1.1 deliberately kept it as boot-proof; this story retires it
  - [x] Extract UI strings/dimensions into a pure module `apps/web/src/config/constants.ts` (extend the existing file): `GAME_NAME` (exists), plus `HOME_PLAY_LABEL = 'Play vs AI'`, `BASE_WIDTH = 360`, `BASE_HEIGHT = 640` — tests assert on this module, never on Phaser objects
  - [x] New Phaser game config in `src/main.ts`: `Phaser.Scale.FIT` + `autoCenter: CENTER_BOTH` with 360×640 base resolution (FR30: portrait phone-first, desktop gets a centered functional layout for free), scene list = `[HomeScene]` only
  - [x] HomeScene renders: game title text (from `GAME_NAME`) and a visually-disabled "Play vs AI" button (greyed, non-interactive — it does NOTHING this story; enabling it is story 1.8) — plain Phaser text/rectangle, no sprites, no assets
  - [x] Remove now-unused template assets from `public/assets/` (bg.png, logo.png) and the template's `screenshot.png`; keep `favicon.png` and `style.css`
  - [x] `pnpm --filter web dev` shows the Home scene; `pnpm --filter web build` stays green (the manualChunks fix from 1.1 review must not regress — build runs in CI)
- [x] Task 2: Wrangler config for assets-only Workers deploy (AC: 1)
  - [x] `apps/web/wrangler.jsonc`: `name: "lordly"`, `compatibility_date` = today, `assets: { directory: "./dist", not_found_handling: "single-page-application" }` — NO `main` field (assets-only Worker, no server code; verified supported July 2026) — validated via `wrangler deploy --dry-run` (6 asset files read, no bindings)
  - [x] Add script `"deploy": "wrangler deploy"` to `apps/web/package.json` (wrangler 4.110.0 already installed as devDep by story 1.1 — do NOT reinstall or bump). GOTCHA: `pnpm deploy` is a pnpm BUILT-IN command — `pnpm --filter web deploy` invokes the builtin, not the script. Always call it as `pnpm --filter web run deploy` (everywhere: CI, README, local)
  - [x] The deployed URL will be `https://lordly.<account-subdomain>.workers.dev` — record the actual URL in this story's Dev Agent Record and the README once known — LIVE: https://lordly.lol-gaming.workers.dev
- [x] Task 3: Deploy job in CI (AC: 1)
  - [x] Extend `.github/workflows/ci.yml` with a `deploy` job: `needs: ci`, `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`, `timeout-minutes: 10`, same corepack bootstrap + setup-node steps as the `ci` job (each job needs its own copies) → `pnpm install --frozen-lockfile` → `pnpm --filter web build` → `pnpm --filter web run deploy` (note `run` — see Task 2 gotcha) with `env: CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}` and `CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`
  - [x] Use the repo's pinned wrangler via pnpm (NOT `cloudflare/wrangler-action` — it installs its own wrangler, drifting from the devDep pin; recorded choice)
  - [x] Keep `permissions: contents: read` (secrets are not permissions; no change needed); do not widen triggers
  - [x] PAUSE FOR USER (one-time Cloudflare setup — like 1.1's `gh auth login`): user creates a free Cloudflare account, then an API token from the **"Edit Cloudflare Workers"** template (dash.cloudflare.com → My Profile → API Tokens), and provides token + Account ID; set repo secrets via `gh secret set CLOUDFLARE_API_TOKEN` and `gh secret set CLOUDFLARE_ACCOUNT_ID`. Do not proceed to Task 5 verification until secrets exist — RESOLVED after three iterations (see Debug Log): custom token needed Workers Scripts:Edit added, a clean re-paste of the value, and a one-time workers.dev subdomain registration (`lol-gaming`)
- [x] Task 4: README deploy section (AC: 3)
  - [x] Add a "Deploy" section: prerequisites (free Cloudflare account, API token from the Edit-Workers template, Account ID), the two `gh secret set` commands, "merge to main deploys automatically", local alternative (`pnpm --filter web exec wrangler login` then `pnpm --filter web run deploy`), and the production URL
  - [x] Update the workspace-layout snippet if paths changed (src/scenes/ replaces src/game/scenes/)
- [ ] Task 5: Verify end-to-end (AC: 1, 2, 3)
  - [x] Full local gate green: `pnpm -r typecheck`, `pnpm coverage`, `pnpm --filter web build`
  - [x] Push to main → CI green → deploy job green → `curl` the production URL returns the Home page HTML with the game title — run 29199599778 (`ci` + `deploy` both success); `curl` returned HTTP 200 with `<title>Lord Battle Tactics</title>` (initial SSL failures were the new subdomain's cert provisioning, resolved within minutes)
  - [ ] ASK USER to open the URL in Android Chrome and confirm: portrait layout, title visible, greyed "Play vs AI" button (agent cannot operate a phone — user confirmation is the AC2 evidence; a desktop-browser screenshot is supporting evidence only)
  - [x] Record the production URL + deploy run link in Dev Agent Record

## Dev Notes

### Architecture constraints that bind THIS story (from ARCHITECTURE-SPINE.md)

- **AD-7 (the core of this story):** static assets on Cloudflare Workers, deployed by wrangler from GitHub Actions on `main`. Environments: local dev + production ONLY — no staging, no preview deployments this story.
- **AD-5 (baseline established here):** scene-per-screen FSM begins — Home is the first real scene at the spine's `apps/web/src/scenes/` path. NO MatchFlow, NO MatchState yet (they arrive with story 1.8); Home has no state to manage.
- **Paradigm check:** HomeScene is shell code (Phaser, DOM) — fine. But tests must not boot Phaser/WebGL (1.1 convention): assert on the pure `src/config/constants.ts` module only.
- **FR30 baseline:** portrait ~360×640 CSS px and up, touch-native; desktop gets a functional centered layout. `Phaser.Scale.FIT` + `autoCenter` on a 360×640 base delivers exactly this without media queries.
- **NFR5:** no tracking, no analytics — deploy adds no beacons; Cloudflare's own edge logs are outside app scope.

### Verified deployment facts (web-verified 2026-07-12 — do NOT trust training data)

- **Assets-only Workers are first-class:** `wrangler.jsonc` with `assets.directory` and NO `main`/worker script deploys pure static sites. `not_found_handling: "single-page-application"` serves `index.html` with 200 for unmatched paths.
- **`compatibility_date` is required** even for assets-only configs — set to the story's implementation date.
- **URL model:** `https://<worker-name>.<account-subdomain>.workers.dev`. The account subdomain is chosen/shown in the Cloudflare dash on first Workers use. HTTPS is automatic (matters later for FR29 PWA installability — but PWA config itself is story 3.3, NOT now).
- **CI auth:** non-interactive wrangler needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` env vars. Token template: "Edit Cloudflare Workers". Store as GitHub repo secrets — never in the repo.
- **`cloudflare/wrangler-action@v3` exists but is NOT used here:** it installs its own wrangler version; we already pin wrangler 4.110.0 as a devDep. Running `pnpm --filter web deploy` uses the pinned one. (Also: 1.1's experience with `pnpm/action-setup` shipping broken bundled tools justifies skepticism of wrapper actions.)

### Previous story intelligence (story 1.1 — read its Dev Agent Record for full detail)

- **Local toolchain:** system Node is v20 — EVERY agent shell command needs `export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"` prefix. User shells need `nvm use` (`.nvmrc` exists). pnpm 11.12.0 lives in the nvm Node 24 install; `gh` is installed and authenticated as `danilol`.
- **CI bootstrap pattern (REUSE VERBATIM in the deploy job):** `mkdir -p "$RUNNER_TEMP/corepack-bin" && corepack enable --install-directory "$RUNNER_TEMP/corepack-bin" && echo "$RUNNER_TEMP/corepack-bin" >> "$GITHUB_PATH"` BEFORE `actions/setup-node` (SHA-pinned) with `cache: "pnpm"`. Do NOT use `pnpm/action-setup` — its bootstrap is broken for pinned versions (see 1.1 Debug Log).
- **SHA-pin new actions** (1.1 review convention): any new action reference must be pinned to a commit SHA with a `# vN` comment.
- **CI triggers (recorded accepted deviation):** `push` filtered to `branches: [main]`, `pull_request` unfiltered, concurrency group with main exempt from cancel-in-progress. The deploy job's `if:` guard is belt-and-braces on top of this.
- **Branch protection:** `main` requires the `ci` check for PR merges; the owner pushes directly to main (enforce_admins=false, recorded decision). The deploy job runs on push to main AFTER the `ci` job passes (`needs: ci`).
- **`pnpm --filter web build` works** (Vite 8/Rolldown manualChunks was fixed in 1.1 review — function form, `node_modules/phaser/` match). CI runs the build; don't break it.
- **Known template leftovers** (deliberately deferred, in `deferred-work.md`): `phasermsg` banner in `vite/config.prod.mjs`. Deleting `src/game/` this story removes the Game.ts phaser.io demo text; the vite-config banner may stay (cosmetic, stdout-only).
- **Web tests live in `apps/web/test/`**, typechecked (tsconfig `include: ["src", "test"]`, target ES2022, extends root `tsconfig.base.json`). Existing tests: `constants.test.ts`, `engine-resolution.test.ts` — must stay green; `main.ts` imports `GAME_NAME` and sets `document.title` — preserve that wiring.

### Scope fences (things this story must NOT do)

- NO PWA/service-worker config (`vite-plugin-pwa` stays installed-unconfigured — story 3.3). NO custom domain. NO staging environment. NO preview deploys.
- NO Draft scene, NO MatchFlow/MatchState, NO storage gateway, NO engine changes at all. The Play button is dead weight by design until 1.8.
- NO new dependencies — everything needed (wrangler, phaser, vite) is already installed and pinned.
- Do NOT touch branch protection, secrets handling beyond the two documented, or CI triggers.

### Testing standards for this story

- Shell tests stay smoke-level and Phaser-free: extend `apps/web/test/constants.test.ts` (or add a sibling) asserting the new constants (`HOME_PLAY_LABEL`, base dimensions). The `engine-resolution.test.ts` must keep passing.
- The real verification is operational: green deploy run + production URL serving the Home scene + user's phone confirmation (AC2). Record evidence links in Dev Agent Record.

### Project Structure Notes

- This story establishes `apps/web/src/scenes/` (spine seed) — later stories add Draft, Placement, etc. beside `HomeScene.ts`. The template's `src/game/` tree is deleted, not migrated.
- `wrangler.jsonc` lives in `apps/web/` (deploy runs with that cwd via `pnpm --filter web`).
- Worker name `lordly` matches the repo/brief slug convention.

### References

- [Source: docs/planning-artifacts/epics.md#Story-1.2] — ACs (verbatim source of truth)
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-5, #AD-7, #Structural-Seed, #Stack]
- [Source: docs/planning-artifacts/prds/prd-lordly-2026-07-11/prd.md#FR30, #NFR3, #NFR5]
- [Source: docs/implementation-artifacts/1-1-monorepo-scaffold-and-the-ci-quality-gate.md#Dev-Agent-Record] — toolchain, CI patterns, review conventions
- Verified externally (2026-07-12): developers.cloudflare.com/workers/static-assets (assets-only config, not_found_handling), developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions (API token + account ID auth), cloudflare/wrangler-action repo (evaluated, not adopted)

## Dev Agent Record

### Agent Model Used

claude-fable-5 (Claude Fable 5)

### Debug Log References

- Red-green: constants test for `HOME_PLAY_LABEL`/`BASE_WIDTH`/`BASE_HEIGHT` written first and confirmed failing (1 failed / 3 passed), then constants + HomeScene implemented → 4/4 green.
- `wrangler deploy --dry-run` validated the assets-only config offline before any push (6 files, no bindings).
- SECURITY NOTE: the user pasted the first Cloudflare API token directly into the chat (against org policy); it was used to set the initial secret and MUST be deleted in the Cloudflare dash — it is exposed in the conversation transcript. The replacement token was set via the GitHub web UI and never touched the chat.
- Cloudflare auth saga (three deploy failures before green): (1) the user's token was a custom "Workers AI" token lacking `Workers Scripts:Edit` → API error 10000 on `/workers/services/lordly` (diagnosed by probing the API directly: token verify OK, services call denied); (2) the replacement token was pasted into the GitHub secret with a formatting problem → error 9109 "Invalid access token"; clean re-paste fixed it; (3) the fresh account had no workers.dev subdomain registered — wrangler prompts interactively for this but CI auto-answers "no"; user registered `lol-gaming` in the dash.
- Post-deploy, the URL returned SSL errors (curl exit 35) for a few minutes — normal TLS cert provisioning for a brand-new workers.dev subdomain; resolved on its own.
- `pnpm --filter web deploy` (without `run`) invokes pnpm's BUILT-IN deploy command — the story's gotcha held; `run` is used everywhere.

### Implementation Plan

- HomeScene at `src/scenes/` (spine AD-5 seed); template `src/game/` tree deleted wholesale, template assets (bg/logo/screenshot) removed; favicon + style.css kept.
- Pure `src/config/constants.ts` carries all testable UI facts; tests never import Phaser (1.1 convention).
- `Phaser.Scale.FIT` + `CENTER_BOTH` on a 360×640 base = FR30 portrait baseline + free centered desktop layout.
- Assets-only `wrangler.jsonc` (no `main`); deploy job reuses the 1.1 corepack bootstrap verbatim, `needs: ci`, main-push-only guard.

### Completion Notes List

- All tasks complete except the final user phone confirmation (AC2 evidence) — pending Danilo opening https://lordly.lol-gaming.workers.dev on Android Chrome.
- Production URL: **https://lordly.lol-gaming.workers.dev** — deploy run 29199599778 (jobs `ci` and `deploy` both green); curl verification: HTTP 200, `<title>Lord Battle Tactics</title>`.
- ACTION ITEM for user: delete the first (exposed) API token in Cloudflare dash → My Profile → API Tokens; the active secret uses the replacement token.

### File List

- apps/web/src/scenes/HomeScene.ts (new)
- apps/web/src/config/constants.ts (modified — HOME_PLAY_LABEL, BASE_WIDTH, BASE_HEIGHT added)
- apps/web/src/main.ts (modified — Phaser game config, FIT scale, HomeScene)
- apps/web/test/constants.test.ts (modified — new smoke assertions)
- apps/web/wrangler.jsonc (new)
- apps/web/package.json (modified — deploy script)
- apps/web/src/game/main.ts (deleted)
- apps/web/src/game/scenes/Boot.ts, Game.ts, GameOver.ts, MainMenu.ts, Preloader.ts (deleted)
- apps/web/public/assets/bg.png, apps/web/public/assets/logo.png, apps/web/screenshot.png (deleted)
- .github/workflows/ci.yml (modified — deploy job)
- README.md (modified — Deploy section, layout snippet, production URL)
- docs/implementation-artifacts/1-2-a-deployed-home-screen-on-a-real-url.md (story tracking)
- docs/implementation-artifacts/sprint-status.yaml (status tracking)

## Change Log

- 2026-07-12: Story 1.2 implemented. Template demo replaced by portrait HomeScene (title + disabled Play vs AI); assets-only Cloudflare Workers deploy via wrangler from CI on main; README deploy docs. First deploy live at https://lordly.lol-gaming.workers.dev after resolving token scope (Workers Scripts:Edit), secret paste formatting, and one-time workers.dev subdomain registration. Awaiting user phone confirmation for AC2.
