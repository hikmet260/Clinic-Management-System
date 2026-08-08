import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './src/test/test-db';

export default defineConfig({
  test: {
    include: ['src/**/*.e2e-spec.ts'],
    globalSetup: './src/test/global-setup.ts',
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      LOGIN_RATE_LIMIT: '10000',
      RATE_LIMIT_MAX: '100000',
      JWT_SECRET: 'test-secret-key-not-for-production',
    },
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
