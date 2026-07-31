import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/bff': {
        target: process.env.BFF_TARGET ?? 'http://localhost:3000',
      },
      '/api/v1': {
        target: 'https://feed.gws.freemyip.com',
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    setupFiles: ['./src/react/testSetup.ts'],
  },
});
