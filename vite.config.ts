import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { readerFixturesPlugin } from './dev/readerFixturesPlugin';
import { createDevApiProxy } from './dev/apiProxy';

export default defineConfig({
  plugins: [react(), readerFixturesPlugin()],
  server: {
    allowedHosts: ['gkfeed.local'],
    proxy: {
      '/bff': {
        target: process.env.BFF_TARGET ?? 'http://127.0.0.1:3000',
      },
      '/api/v1': createDevApiProxy(),
      '/api/v2': createDevApiProxy(),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'shared/**/*.test.ts', 'dev/**/*.test.ts'],
    setupFiles: ['./src/react/testSetup.ts'],
  },
});
