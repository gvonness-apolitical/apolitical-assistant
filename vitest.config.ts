import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@apolitical-assistant/shared': resolve(__dirname, 'packages/shared/src/index.ts'),
      '@apolitical-assistant/context-store': resolve(__dirname, 'packages/context-store/src/index.ts'),
    },
  },
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
      include: [
        'packages/shared/src/keychain.ts',
        'packages/shared/src/workflow-utils.ts',
        'packages/shared/src/todo-utils.ts',
        'packages/context-store/src/models.ts',
        'packages/context-store/src/store.ts',
      ],
      exclude: ['**/__tests__/**', '**/node_modules/**'],
      thresholds: {
        // Global thresholds
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
