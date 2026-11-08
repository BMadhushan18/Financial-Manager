/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development run `npm run dev:api` (wrangler on :8788) in a second
// terminal; Vite proxies /api calls to it so the React app gets hot reload.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8788',
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 400,
  },
  test: {
    include: ['shared/**/*.test.ts'],
    environment: 'node',
  },
});
