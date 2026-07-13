import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Repo-wide lint gate (story 2.0): mechanizes the epic-1 recurring review
 * findings where a machine rule is honest — unused/dead code, import hygiene,
 * and the engine purity contract (AD-1). Hardcoded-value and boundary-guard
 * discipline remain REVIEW responsibilities: no clean lint rule expresses them
 * without noise (recorded limit, story 2.0 AC1).
 */
export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'docs/**', '_bmad/**', '.claude/**', '**/*.snap'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Test/sim files legitimately use dev-only patterns the app code shouldn't.
    files: ['**/test/**', '**/sim/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Build/config scripts (vite configs, this file) run under node.
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', __dirname: 'readonly' },
    },
  },
  {
    // ENGINE PURITY (AD-1), AST layer: complements the regex sieve in
    // packages/engine/test/purity.test.ts (which also locks the dependency
    // list and the source-file census — keep both). The engine imports
    // nothing but pure-rand and its own modules, and touches no ambient
    // platform state.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser', 'phaser/*', 'node:*', 'fs', 'path', 'os', 'http', 'https', 'child_process', 'worker_threads'],
              message: 'The engine is pure (AD-1): no platform, no framework — pure-rand and relative imports only.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'localStorage',
          'fetch',
          'crypto',
          'performance',
          'process',
          'globalThis',
          'XMLHttpRequest',
          'WebSocket',
          'Intl',
          'setTimeout',
          'setInterval',
        ].map((name) => ({ name, message: `'${name}' is ambient platform state — the engine is pure (AD-1).` })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the named rng streams (AD-10) — Math.random breaks determinism (FR20).' },
        { object: 'Date', property: 'now', message: 'No wall clock in the engine (AD-1/FR20).' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'No wall clock in the engine (AD-1/FR20).' },
        { selector: "CallExpression[callee.name='Date']", message: 'No wall clock in the engine (AD-1/FR20).' },
      ],
    },
  },
  prettier,
);
