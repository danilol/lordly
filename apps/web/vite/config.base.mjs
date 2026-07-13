/**
 * Shared vite config base (story 2.0 AC3): everything common to dev and prod
 * lives here once. The overlays add ONLY what their mode actually uses —
 * the epic-1 template shipped both configs with each other's dead keys
 * (manualChunks in dev, server.port in prod) and a phaser.io marketing
 * banner; all removed.
 */
export const base = {
  base: './',
};

/** Splits phaser into its own chunk — a BUILD concern, used by prod only. */
export function phaserChunks(id) {
  if (id.includes('node_modules/phaser/')) return 'phaser';
}
