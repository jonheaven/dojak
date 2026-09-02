import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'dojakweb',
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    setupFiles: ['./src/lib/browser-wallet.test-setup.ts'],
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
