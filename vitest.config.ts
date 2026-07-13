import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      // Coverage reports from story 1.1 on; the engine ≥90% line gate
      // activated in story 1.6 (AD-7/NFR2).
      thresholds: {
        'packages/engine/**': { lines: 90 },
      },
    },
  },
});
