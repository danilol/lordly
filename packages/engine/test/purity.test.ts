import { describe, expect, it } from 'vitest';
import packageJsonRaw from '../package.json?raw';

/**
 * AD-1 enforced by CI, not discipline: engine source must stay pure — no
 * ambient randomness, no clock, no DOM/Phaser/Node effects. Sources are read
 * via Vitest's raw imports so the engine needs no node/vite type deps.
 */
const FORBIDDEN: RegExp[] = [
  /Math\.random/,
  /Date\.now/,
  /new Date\(/,
  /from ['"]phaser['"]/,
  /from ['"]node:/,
  /process\./,
  /localStorage/,
  /\bfetch\(/,
  /window\./,
  /document\./,
];

const sources = import.meta.glob('../src/*.ts', { query: '?raw', import: 'default', eager: true });

describe('engine purity guard (AD-1)', () => {
  it('covers every source module', () => {
    const files = Object.keys(sources).map((p) => p.split('/').pop());
    expect(files.sort()).toEqual(['balance.ts', 'hash.ts', 'index.ts', 'rng.ts', 'types.ts']);
  });

  it('src/ contains no effectful or nondeterministic constructs', () => {
    for (const [file, content] of Object.entries(sources)) {
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(content), `${file} matches forbidden ${pattern}`).toBe(false);
      }
    }
  });

  it('the only runtime dependency is pure-rand', () => {
    const pkg = JSON.parse(packageJsonRaw) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies)).toEqual(['pure-rand']);
  });
});
