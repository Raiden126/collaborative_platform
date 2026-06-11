import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      // Socket.IO uses the /socket.io path (the namespace is `/realtime`).
      // This MUST be /socket.io, not /realtime, or the WebSocket never connects.
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Unit tests only — Playwright owns tests/e2e (run via `pnpm test:e2e`).
    include: ['tests/unit/**/*.spec.ts', 'src/**/*.spec.ts'],
  },
});
