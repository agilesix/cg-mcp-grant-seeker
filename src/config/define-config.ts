import type { ServerConfig } from './types.js';

/**
 * Identity helper that exists purely for its TypeScript type, so a
 * `commongrants-mcp.config.ts` file gets autocomplete and type-checking:
 *
 * ```ts
 * import { defineConfig } from '@common-grants/mcp-grant-seeker/config';
 *
 * export default defineConfig({
 *   sources: [{ name: 'ca', label: 'California', baseUrl: 'https://ca.api.cg.a6lab.ai' }],
 * });
 * ```
 */
export function defineConfig(config: ServerConfig): ServerConfig {
  return config;
}
