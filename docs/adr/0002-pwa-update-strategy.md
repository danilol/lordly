# ADR 0002: PWA service-worker update strategy — silent auto-update

Date: 2026-07-15
Status: Accepted
Story: 3.3 (epics.md: "the service-worker update strategy (prompt vs auto-update — the spine's deferred decision) is decided in this story and recorded as an ADR" — NFR3 convention; ARCHITECTURE-SPINE.md Deferred list)

## Context

FR29 makes the game an installable, offline-capable PWA. vite-plugin-pwa offers two `registerType` strategies:

- **`prompt`** — a waiting service worker parks until the app shows "update available" UI and the player accepts. Precise control, but requires an update-toast surface the game does not have (AD-5's scene FSM has no notification layer), plus new copy, new state, and a player decision that means nothing to them ("reload for… what, exactly?").
- **`autoUpdate`** — the new service worker activates immediately (skipWaiting + clientsClaim) and refreshed assets apply on the next launch. Zero UI, zero player interaction.

What makes auto-update SAFE here, specifically:

1. **An in-flight session cannot break.** The running page keeps its already-parsed JS; a mid-battle player is untouched by an activation happening underneath. New assets serve on the *next* navigation/launch.
2. **There is no server state to version-skew against.** The app is fully client-side (NFR5); the only persisted data is `lordly.v1.*` localStorage, which is version-guarded independently and by design (AD-8: `balanceVersion` gates replay; unknown namespaces are ignored).
3. **The whole app is one small precache** (~0.4 MB compressed) — updates are cheap, and a stale-until-next-launch window costs nothing (no multiplayer, no time-sensitive content until the link-play epic).

There is no runtime app-version constant today; the service worker's build-revision hashing IS the app's version identity.

## Decision

`registerType: 'autoUpdate'` with **explicit `workbox.skipWaiting: true` + `clientsClaim: true`** — so a freshly-installed service worker activates immediately and claims open clients, rather than parking in "waiting" until every tab closes.

Registration is **injected inline into `index.html` at build** (`injectRegister: 'inline'`), NOT called from `main.ts`. This is a deliberate deviation from the obvious `registerSW()` in the shell entry: the `virtual:pwa-register` module statically imports `workbox-window`, which is a dependency of the plugin, not of `apps/web` — pnpm's strict isolation rejects that transitive reach at bundle time. Inline injection needs no import and no new dependency. (One consequence of `injectRegister: 'inline'`: vite-plugin-pwa does NOT auto-derive `skipWaiting`/`clientsClaim` from `registerType` — hence they are set explicitly above; without them `autoUpdate` is inert. Verified in `dist/sw.js`.)

Dev builds inject nothing (`devOptions` disabled — dev stays SW-free); prod builds generate the service worker + `manifest.webmanifest` into `dist/`, deployed as ordinary static assets by the existing wrangler pipeline (AD-7 — no new environment, no pipeline change).

## Consequences

- A new deploy's service worker activates as soon as it finishes precaching; the player's next navigation/launch serves the new build. Nobody is ever asked about updates.
- An in-flight session is safe: the running page keeps its already-parsed JS and — because the app has **zero dynamic imports** (every scene ships in the up-front chunks) — never fetches a chunk that the new precache may have renamed. New assets apply on the next launch.
- No update UI exists or needs maintaining. If the link-play epic later demands synchronized client/server versions, THIS is the decision to revisit — a `prompt`-style flow with a version handshake would replace silent activation. **The single seam is the `VitePWA(...)` config in `apps/web/vite/config.base.mjs`** (registerType + the workbox flags + injectRegister), not `main.ts`.
