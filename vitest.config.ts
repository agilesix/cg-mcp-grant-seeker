import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '.wrangler/**',
        'coverage/**',
        'examples/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.*',
      ],
    },
  },
});
