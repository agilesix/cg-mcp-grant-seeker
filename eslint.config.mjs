// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.skybridge/**',
      '.vercel/**',
      '.wrangler/**',
      'node_modules/**',
      'coverage/**',
      'worker-configuration.d.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },
  // Portability zone: Cloudflare Workers types may only be imported from the
  // Worker entrypoint. Every other module stays hosting-agnostic so the same
  // core runs under stdio (local), a Node host, or Cloudflare Workers.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/worker.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@cloudflare/workers-types',
              message: 'Workers-specific types may only be imported from src/worker.ts.',
            },
          ],
        },
      ],
    },
  },
  // src/core/ is the hosting- and transport-agnostic heart of the server and a
  // candidate for future extraction to its own package. It may only depend on
  // zod, @common-grants/sdk, and @modelcontextprotocol/sdk — never on other
  // src/** directories, which would create a cycle and block extraction.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*', '../../*', '../../../*'],
              message:
                'src/core/ may not import from any other src/** directory. It only depends on zod, @common-grants/sdk, and @modelcontextprotocol/sdk.',
            },
          ],
        },
      ],
    },
  },
);
