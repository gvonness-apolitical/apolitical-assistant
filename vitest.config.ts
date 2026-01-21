import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/__tests__/**/*.test.ts',
      'scripts/**/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts', 'scripts/**/*.ts'],
      exclude: ['**/__tests__/**', '**/node_modules/**'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
