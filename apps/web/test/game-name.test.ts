import { describe, expect, it } from 'vitest';
import { GAME_NAME, GAME_SUBTITLE, HOME_WORDMARK } from '../src/config/constants';

/**
 * Name-drift guard (story 5.2 code review, 2026-07-27).
 *
 * The game's full name lives in THREE independent places — `GAME_NAME`
 * (rendered into `document.title` at boot), the static `<title>` in
 * index.html (what shows during the pre-boot flash), and the PWA manifest
 * `name` in vite/config.base.mjs (the installed app's label). The 5.2 rename
 * updated all three by hand, and still missed `docs/rules.md`, which the Help
 * screen renders verbatim — so the app shipped its new wordmark while telling
 * players the old name two taps away.
 *
 * Raw-text reads via `import.meta.glob` (the rules-doc/attribution precedent —
 * apps/web is browser-pure with no node:fs).
 */
const RAW = import.meta.glob('../{index.html,vite/config.base.mjs}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const DOCS = import.meta.glob('../../../docs/rules.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const read = (bag: Record<string, string>, suffix: string) => {
  const hit = Object.entries(bag).find(([path]) => path.endsWith(suffix));
  if (!hit) throw new Error(`could not load ${suffix} (globs: ${Object.keys(bag).join(', ')})`);
  return hit[1];
};

describe('game-name drift guard (story 5.2 review)', () => {
  it('the constants agree with each other', () => {
    // GAME_NAME is the wordmark + the epithet; Home renders them as separate
    // objects (image plaque + text line), so the pieces must compose.
    expect(GAME_NAME).toBe(`${HOME_WORDMARK}: ${GAME_SUBTITLE}`);
  });

  it("index.html's pre-boot <title> carries the same name main.ts sets at runtime", () => {
    expect(read(RAW, 'index.html')).toContain(`<title>${GAME_NAME}</title>`);
  });

  it("the PWA manifest's installed-app name matches", () => {
    expect(read(RAW, 'vite/config.base.mjs')).toContain(`name: '${GAME_NAME}'`);
  });

  it('the player-facing rules doc (rendered verbatim in Help) uses the current name, not a stale one', () => {
    const rules = read(DOCS, 'docs/rules.md');
    expect(rules).toContain(HOME_WORDMARK);
    expect(rules, 'rules.md still names the pre-5.2 game').not.toContain('Lord Battle Tactics');
  });
});
