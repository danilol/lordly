import { defineConfig } from 'vite';
import { base } from './config.base.mjs';

export default defineConfig({
  ...base,
  server: {
    port: 8080,
  },
});
