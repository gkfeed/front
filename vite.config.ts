import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { readerFixturesPlugin } from './dev/readerFixturesPlugin';
import { readerDiagnosticsPlugin } from './dev/readerDiagnosticsPlugin';

export default defineConfig({
  plugins: [react(), readerFixturesPlugin(), readerDiagnosticsPlugin()],
  server: {
    allowedHosts: ['gkfeed.local'],
    proxy: {
      '/bff': {
        target: process.env.BFF_TARGET ?? 'http://127.0.0.1:3000',
      },
      '/api/v1': {
        target: 'https://feed.gws.freemyip.com',
        changeOrigin: true,
      },
      '/api/v2': {
        target: 'https://feed.gws.freemyip.com',
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'shared/**/*.test.ts'],
    setupFiles: ['./src/react/testSetup.ts'],
  },
});
