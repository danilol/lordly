import { GAME_NAME, PALETTE } from '../config/constants';

/**
 * Renders the plain-DOM "failed to start" message when Phaser init fails
 * (story 2.0 AC5). Phaser-FREE by design: it must survive a Phaser that
 * failed to load, and staying framework-free keeps it unit-testable in the
 * node env (like `MatchFlow`/`battleView` — no scene ever imports Phaser
 * into a test). Idempotent via the module-level guard (both the sync catch
 * and the async `error` backstop may fire); container-agnostic (falls back to
 * `document.body` if `#game-container` is gone) so the player never gets a
 * silent blank page.
 */
let fallbackShown = false;

export function showInitFallback(doc: Document, error: unknown): void {
  console.error('[lordly] game init failed', error);
  if (fallbackShown) return;
  fallbackShown = true;
  const host = doc.getElementById('game-container') ?? doc.body;
  const message = doc.createElement('p');
  message.textContent = `${GAME_NAME} failed to start — your browser may not support it. Try a different or updated browser.`;
  message.style.cssText = `color: ${PALETTE.bodyText}; background: ${PALETTE.background}; font: 16px Arial, sans-serif; padding: 24px; text-align: center; margin: 0;`;
  host.appendChild(message);
}

/** Test-only: reset the once-guard so each case starts clean. */
export function resetInitFallbackForTest(): void {
  fallbackShown = false;
}
