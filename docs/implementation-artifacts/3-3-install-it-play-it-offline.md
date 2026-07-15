# Story 3.3: Install it, play it offline

Status: ready-for-dev

## Story

As a player,
I want the game on my home screen working without a connection,
so that a bus-stop match needs nothing but my phone.

## Acceptance Criteria

1. **Installable PWA (FR29).** The production URL in Android Chrome is installable — valid web manifest, icons, HTTPS — and appears on the home screen with the game's name and icon.
2. **Fully offline (FR29, FR26).** After one online load, a complete vs-AI match — draft through result, History included — works with no connectivity (airplane mode), via a service worker.
3. **Update strategy decided + ADR (NFR3).** The spine's deferred decision (prompt vs auto-update) is made in this story and recorded as `docs/adr/0002-*.md` (Context/Decision/Consequences, the story-2.2 ADR convention).

## Tasks / Subtasks

- [ ] Task 1: PWA icons from the CC0 art (AC: 1)
  - [ ] Derive the app icon from the CC0-1.0 knight frame in `apps/web/src/assets/units.png` (32×32 → NEAREST-kernel integer upscale: ×6 = 192, ×16 = 512 — both perfect integer multiples, honoring the pixel-art fractional-scale ban in sprites.ts:11). Generate once with a scratch script (e.g. `npm i --no-save sharp` in a temp dir, `kernel: 'nearest'`), COMMIT the PNGs — no new repo dependency
  - [ ] Ship in `apps/web/public/`: `icon-192.png`, `icon-512.png` (purpose `any`), plus `icon-512-maskable.png` (sprite centered at ~60% on a `PALETTE.background`-filled square — maskable safe zone) and `apple-touch-icon.png` — **180 is NOT an integer multiple of 32** (180/32 = 5.625): upscale ×5 = 160 and center it on a 180×180 `PALETTE.background` canvas (same padding technique as the maskable), never fractional-scale the pixels
  - [ ] Record the derived icon files in `ART_ATTRIBUTIONS[0].assets` (attribution.ts:28-46 — the Dungeon Crawl pack; CC0 needs no attribution but the manifest lists every redistributed derived file; `attribution.test.ts` rules stay green since CC0-1.0 is allowlisted)
- [ ] Task 2: VitePWA + manifest + registration (AC: 1, 2)
  - [ ] Add `VitePWA` to a `plugins` array in **`config.base.mjs`** (shared, NOT prod-only — see Dev Notes: the `virtual:pwa-register` import must resolve in dev too or `pnpm dev` breaks); `devOptions` stays disabled (dev remains SW-free)
  - [ ] Manifest: `name: 'Lord Battle Tactics'`, `short_name: 'Lordly'`, `display: 'standalone'`, `orientation: 'portrait'` (FR30), `start_url: './'` + `scope: './'` (the config's `base: './'` is load-bearing for Cloudflare — keep everything relative), `theme_color`/`background_color` from the ACTUAL `PALETTE.background` hex (read constants.ts, don't guess), icons array incl. the maskable
  - [ ] `registerType: 'autoUpdate'` (the Task 3 decision); workbox `globPatterns: ['**/*.{js,css,html,png,ico,svg}']` so the public/ icons + favicon precache alongside the bundle. The phaser manual chunk is MEASURED at ~1.31 MiB uncompressed (dist/assets/phaser-*.js, 1,374,303 B) — under workbox's 2 MiB `maximumFileSizeToCacheInBytes` default, so no knob needed today; re-measure only if the build changes
  - [ ] `apps/web/src/main.ts`: `import { registerSW } from 'virtual:pwa-register'; registerSW({ immediate: true })` — the shell's job (AD-5); add `/// <reference types="vite-plugin-pwa/client" />` to `apps/web/src/vite-env.d.ts` (typecheck needs it — tsc can't resolve virtual modules otherwise)
  - [ ] `apps/web/index.html`: add `<meta name="theme-color">` + a `description` meta + the `apple-touch-icon` link (VitePWA injects the manifest link at build)
- [ ] Task 3: The update-strategy ADR (AC: 3)
  - [ ] `docs/adr/0002-pwa-update-strategy.md` — Decision: **autoUpdate** (recommended; final call is the dev's with rationale). Context to weigh: `prompt` needs update-toast UI the game doesn't have; `autoUpdate` (skipWaiting + clientsClaim) is safe here because an in-flight session keeps its already-parsed JS (a mid-battle player is untouched; new assets apply on next launch), the game holds no server state, and `lordly.v1.*` localStorage is version-guarded independently (AD-8). Note there is no runtime app-version constant today — the SW's revision hashing IS the version
  - [ ] README: one short "Install / offline" note in the existing deploy section (production URL is installable; offline after first load)
- [ ] Task 4: Build + offline drive (AC: 1, 2)
  - [ ] `pnpm --filter web build` green (CI runs this — the SW/manifest generation is exercised on every push); then `vite preview --config vite/config.prod.mjs` to serve `dist/` WITH the SW (the dev server never registers one)
  - [ ] Headless-Chrome drive against the preview: load once online → await `navigator.serviceWorker.ready` + controller; assert `manifest.webmanifest` fetches and parses (name/icons/display). **CRITICAL — do NOT trust `page.setOfflineMode(true)` for the offline proof:** CDP network emulation does not apply to service-worker fetches (Chromium bug 852127), so an SW that silently hits the network would still "pass". The REAL offline test: **kill the `vite preview` server**, then reload the already-open page — with no server at all, only precache can serve it. Home renders; tap into Draft, Help, History; screenshots per state
  - [ ] Assert the precache manifest by reading `dist/sw.js` contents (the load-bearing check — note prod builds run `logLevel: 'warn'`, so don't rely on workbox console output): icons, index.html, css, and ALL js chunks incl. the phaser chunk present
- [ ] Task 5: Gate + deploy + device (all ACs)
  - [ ] Full gate green (typecheck incl. the new virtual-module reference, lint, all tests, engine coverage untouched)
  - [ ] Push → CI build + deploy → on prod: confirm `manifest.webmanifest` + `sw.js` serve correctly from the Workers static assets (wrangler.jsonc `assets.directory: ./dist` picks them up automatically; `not_found_handling: single-page-application` must NOT swallow them — verify both URLs return their real content-type, not index.html)
  - [ ] On-device (Danilo): Android Chrome shows the install prompt / "Add to Home screen"; installed app opens standalone with name+icon; airplane mode → a COMPLETE match (draft → placement → battle → result) + History — the AC2 acceptance

## Dev Notes

### The one config trap that breaks dev (read first)

`main.ts` will import `virtual:pwa-register`. That virtual module only exists when the VitePWA plugin is loaded — if the plugin sits only in `config.prod.mjs`, **`pnpm dev` fails to resolve the import**. Put the plugin in `config.base.mjs`'s shared shape (a `plugins` array both dev and prod spread) with `devOptions` disabled: dev resolves the module as a no-op, prod generates the real SW. Current configs have NO `plugins` key at all (config.base.mjs is just `{ base: './' }` + the `phaserChunks` helper; dev adds `server.port: 8080`; prod adds terser/manualChunks) — spreading a shared `plugins` array is a clean addition, but mind that `{ ...base }` spread composition means the array must live IN the base object.

### Why offline is nearly free here (recon findings, verified)

- Every asset is already bundled: the units spritesheet is Vite-imported and ships **inlined as a data-URI** (BootScene.ts:3,33 + comment at :11-13 — note it's 3,923 B against Vite's 4,096 B `assetsInlineLimit`, only 173 B of headroom; if a future sprite addition tips it into a separate file, the SW globs already cover `.png`); `docs/rules.md` is a `?raw` compile-time import (HelpScene.ts:2); there are **zero runtime `fetch()` calls** and zero external requests in `apps/web/src`. localStorage (settings + history) is offline-native. The SW's entire job is precaching `dist/` — index.html, css, favicon, icons, and the js chunks.
- `wrangler.jsonc`: assets-only Worker, `assets.directory: ./dist`, `not_found_handling: single-page-application`. New files in `dist/` (sw.js, manifest.webmanifest, workbox runtime) deploy automatically — no wrangler change expected.
- CI already builds (`pnpm --filter web build` in the ci job, artifact `web-dist` consumed by the deploy job) — SW generation gets CI coverage for free.

### Facts you'd otherwise have to dig for

- `vite-plugin-pwa` is `^1.3.0` in devDependencies (apps/web/package.json:20), imported NOWHERE yet — this story is its first use. Vite is 8.x, plugin 1.x supports it (the spine pinned this pairing).
- `index.html` currently has: 16×16 `favicon.png` link, viewport, style.css, title — NO theme-color/manifest/description/apple-touch-icon.
- `apps/web/public/` = `favicon.png` (16×16 — too small for PWA icons, keep it as favicon) + `style.css`.
- Icon license chain: `units.png` is composed from **Dungeon Crawl Stone Soup 32×32 tiles, CC0-1.0** (attribution.ts:28-46) — public domain, so an icon derived from it is unambiguously redistributable; list the derived files in the pack's `assets` anyway (manifest completeness; the license gate test allowlists CC0-1.0).
- ADR convention: TWO patterns exist in docs/adr/ — follow the NEWER one (`0001-battle-camera-iso-board.md`): filename `0002-<slug>.md`, header `Date / Status / Story` lines, sections `## Context` / `## Decision` / `## Consequences`.
- No `import.meta.env` usage exists anywhere in src — don't introduce DEV/PROD behavior forks beyond what the plugin itself does.
- Root `package.json` has NO build script — build is `pnpm --filter web build` (vite/config.prod.mjs). There is no bundle-size test to trip.

### Architecture compliance

- AD-7: environments stay local-dev + production; the SW is a build artifact of the existing pipeline, not a new environment. CI gate unchanged (typecheck/lint/coverage/build).
- AD-8: the SW caches the APP SHELL only — it must never cache or interact with localStorage semantics; `lordly.v1.*` versioning is orthogonal and already guarded. Storing a BattleLog remains forbidden (nothing here touches it).
- AD-5/shell purity: `registerSW` lives in `main.ts` (the effectful shell entry) — not in flow/, not in scenes.
- NFR1: precaching adds no runtime cost; the SW's cache-first serving typically IMPROVES reload time. Bundle budget untouched (icons are a few KB of public/ assets; measure the maskable at 512 — pixel-art PNGs compress tiny).
- Zero engine changes; zero scene changes (Boot/Home/etc. untouched).

### Testing standards summary

Vitest from the root as usual; this story's correctness lives mostly in BUILD outputs, so the weight shifts to the drive: build + `vite preview` + puppeteer offline verification (the recipe from 3.1/3.2: `npm i --no-save puppeteer-core` in a temp dir, system Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, viewport 360×640; NEW bits: `page.setOfflineMode(true)` after `navigator.serviceWorker.ready`, and fetch-and-parse `manifest.webmanifest`). Keep `attribution.test.ts` green after the assets-list addition. RED→GREEN where unit-testable (attribution list); the SW itself is verified empirically (empirical-over-reasoned doctrine). Node 24 via nvm PATH prefix.

### Previous story intelligence (3.0-3.2, same sprint)

- The headless-drive harness pattern is established and battle-tested; this story adds the offline/SW dimensions to it.
- Review themes to pre-empt: no silent coercion (fail loudly if the icon script's input frame is missing); singleton-scene discipline is untouched (no scene changes); 44px/copy rules don't apply (no UI).
- The 3.0 wipeout sim test now carries a 20s timeout — if the gate runs slow under load, that's expected, not a regression.
- Epic-3 retro note (from the 2.4/epic-2 retro): the deferred text-ceiling investigation and formal fps check point at story 3.4, NOT here — resist bundling performance work into this story.

### Project Structure Notes

- New: `apps/web/public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`; `docs/adr/0002-pwa-update-strategy.md`. Modified: `apps/web/vite/config.base.mjs` (plugins), possibly `config.prod.mjs` (only if a workbox knob is prod-specific), `apps/web/src/main.ts`, `apps/web/src/vite-env.d.ts`, `apps/web/index.html`, `apps/web/src/assets/attribution.ts`, `README.md`. NO wrangler/CI changes expected.
- The scratch icon-generation script stays OUT of the repo (session temp dir) — only its committed PNG outputs land.

### References

- [Source: docs/planning-artifacts/epics.md#Story-3.3] — BDD ACs (FR29/FR26/NFR3)
- [Source: docs/planning-artifacts/architecture/architecture-lordly-2026-07-12/ARCHITECTURE-SPINE.md#AD-7,AD-8 + Deferred] — "PWA service-worker update strategy (prompt vs auto-update) — decide at first deploy"
- [Source: apps/web/vite/config.base.mjs, config.dev.mjs, config.prod.mjs] — the three-file config split (story 2.0), no plugins key yet
- [Source: apps/web/index.html; apps/web/public/] — current head links, the 16×16 favicon
- [Source: apps/web/src/scenes/BootScene.ts:3,11-13,33; apps/web/src/scenes/HelpScene.ts:2] — everything bundles/inlines; no runtime fetches
- [Source: apps/web/wrangler.jsonc; .github/workflows/ci.yml] — assets-only Worker, CI build + artifact deploy
- [Source: apps/web/src/assets/attribution.ts:9-46; apps/web/test/attribution.test.ts] — CC0-1.0 pack, license gate, assets-list rules
- [Source: docs/adr/0001-battle-camera-iso-board.md] — the ADR convention to follow
- [Source: docs/rules.md → EXPERIENCE.md:89] — "the game is offline-first (FR29)" Home expectation

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
