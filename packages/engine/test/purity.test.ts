import { describe, expect, it } from 'vitest';
import packageJsonRaw from '../package.json?raw';

/**
 * AD-1 enforced by CI, not discipline: engine source must stay pure — no
 * ambient randomness, no clock, no DOM/Phaser/Node effects, no locale-
 * dependent behavior (a cross-device determinism hazard). Sources are read
 * via Vitest's raw imports so the engine needs no node/vite type deps.
 * This is a pragmatic sieve, not a proof — the stronger AST/lint-based
 * check is tracked in deferred-work.md.
 */
const FORBIDDEN: RegExp[] = [
  /Math\.random/,
  /Math\[/,
  /Date\.now/,
  /new Date/,
  /\bDate\(/,
  /from ['"]phaser['"]/,
  /from ['"]node:/,
  /import ['"]/, // side-effect imports
  /\bimport\(/, // dynamic imports
  /\brequire\(/,
  /process\./,
  /localStorage/,
  /\bfetch\(/,
  /window\./,
  /document\./,
  /globalThis/,
  /performance\./,
  /crypto\./,
  /setTimeout/,
  /setInterval/,
  /XMLHttpRequest/,
  /WebSocket/,
  /localeCompare/,
  /\bIntl\b/,
];

const sources = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });

describe('engine purity guard (AD-1)', () => {
  it('covers every source module (recursive)', () => {
    const files = Object.keys(sources).map((p) => p.replace('../src/', ''));
    expect(files.sort()).toEqual([
      'ai.ts',
      'balance.ts',
      'hash.ts',
      'index.ts',
      'judging.ts',
      'resolve.ts',
      'rng.ts',
      'targeting.ts',
      'types.ts',
      'validate.ts',
    ]);
  });

  it('src/ contains no effectful or nondeterministic constructs', () => {
    for (const [file, content] of Object.entries(sources)) {
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(content as string), `${file} matches forbidden ${pattern}`).toBe(false);
      }
    }
  });

  it('the only runtime dependency is pure-rand, pinned exactly', () => {
    const pkg = JSON.parse(packageJsonRaw) as { dependencies: Record<string, string> };
    expect(pkg.dependencies).toEqual({ 'pure-rand': '8.4.2' });
  });
});
