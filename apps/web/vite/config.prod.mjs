import { defineConfig } from 'vite';
import { base, phaserChunks } from './config.base.mjs';

export default defineConfig({
  ...base,
  logLevel: 'warn',
  build: {
    rollupOptions: {
      output: {
        manualChunks: phaserChunks,
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 2,
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
  },
});
