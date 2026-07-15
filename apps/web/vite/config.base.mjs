import { VitePWA } from 'vite-plugin-pwa';

/**
 * Shared vite config base (story 2.0 AC3): everything common to dev and prod
 * lives here once. The overlays add ONLY what their mode actually uses —
 * the epic-1 template shipped both configs with each other's dead keys
 * (manualChunks in dev, server.port in prod) and a phaser.io marketing
 * banner; all removed.
 *
 * Story 3.3 (FR29): the PWA plugin lives HERE (shared) with registration
 * INJECTED at build (`injectRegister: 'inline'`) rather than imported via
 * `virtual:pwa-register` — the virtual module statically imports
 * `workbox-window`, which is not a declared dependency of this app (pnpm
 * strict isolation rejects the transitive reach). The inline snippet needs
 * no import, no extra dependency, and no dev-resolution care; dev stays
 * SW-free (devOptions disabled), prod builds emit sw.js + manifest into dist/.
 */
export const base = {
  base: './', // relative — load-bearing for Cloudflare assets serving AND the SW scope
  plugins: [
    VitePWA({
      // ADR 0002: autoUpdate — no update UI exists; skipWaiting+clientsClaim
      // is safe because an in-flight session keeps its already-parsed JS and
      // lordly.v1.* storage is version-guarded independently (AD-8).
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      // vite-plugin-pwa only auto-sets skipWaiting/clientsClaim when
      // injectRegister is 'auto'/null; with 'inline' they must be set
      // EXPLICITLY or `autoUpdate` is inert (the new SW parks in "waiting"
      // until every tab closes — a warm reload keeps serving the old build).
      // Safe here (ADR 0002): no dynamic imports, so a running page keeps its
      // parsed JS; the new build applies on the next navigation/launch.
      workbox: {
        // Precache EVERYTHING the app is (fully self-contained — zero runtime
        // fetches; the sprite sheet ships inlined). png covers the public/
        // icons + favicon. Phaser chunk ~1.31 MiB — under workbox's 2 MiB cap.
        globPatterns: ['**/*.{js,css,html,png,ico,svg}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      // globPatterns already precaches every png; don't ALSO inject the
      // manifest icons (they'd be precached twice — harmless dedupe, but noise).
      includeManifestIcons: false,
      manifest: {
        name: 'Lord Battle Tactics',
        short_name: 'Lordly',
        description: 'Draft three units, place them in secret, and watch your plan fight — an OB64-style auto-battler. Fully offline.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        // PALETTE.background (config/constants.ts) — the game's canvas color.
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
};

/** Splits phaser into its own chunk — a BUILD concern, used by prod only. */
export function phaserChunks(id) {
  if (id.includes('node_modules/phaser/')) return 'phaser';
}
