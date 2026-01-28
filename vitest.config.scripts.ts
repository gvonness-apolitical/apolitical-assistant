import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/credentials/__tests__/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['scripts/credentials/**/*.ts'],
      exclude: ['**/__tests__/**', 'scripts/credentials/index.ts', 'scripts/credentials/oauth.ts'],
    },
  },
});
