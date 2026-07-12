import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      // Coverage reports from story 1.1 on; the engine threshold
      // activates in story 1.6 by uncommenting the glob below.
      thresholds: {
        // 'packages/engine/**': { lines: 90 },
      },
    },
  },
});
