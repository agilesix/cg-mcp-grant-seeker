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
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
      },
    },
  },
  // Portability zone: hosting-specific types stay outside the shared core.
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@cloudflare/workers-types',
              message: 'Workers-specific types belong in a hosting adapter, not shared code.',
            },
          ],
        },
      ],
    },
  },
  // Skybridge is a replaceable MCP Apps host. App logic and shared components
  // must remain framework-neutral; only the host adapter may import it.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/app/hosts/skybridge/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?:skybridge(?:/|$)|@skybridge/)',
              message: 'Skybridge imports belong in src/app/hosts/skybridge/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/{tools,models,components}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)hosts/',
              message: 'Host-neutral app code may not depend on a host adapter.',
            },
          ],
        },
      ],
    },
  },
  // src/core/ is the hosting- and transport-agnostic heart of the server and a
  // candidate for future extraction to its own package. It may depend on
  // protocol and validation libraries, but never on app/hosting adapters or
  // other src/** directories.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'skybridge/server',
              message: 'Skybridge belongs in src/app/, not the shared MCP core.',
            },
          ],
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
