import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { createJiti } from 'jiti';
import { defaultConfig } from './defaults.js';
import { serverConfigSchema } from './schema.js';
import type { ServerConfig } from './types.js';

const CONFIG_FILENAMES = [
  'commongrants-mcp.config.ts',
  'commongrants-mcp.config.mjs',
  'commongrants-mcp.config.js',
];

export interface LoadConfigOptions {
  /** Explicit path to a config file. Overrides discovery. */
  configPath?: string;
  /** Directory to search for a config file. Defaults to process.cwd(). */
  cwd?: string;
  /** Environment source for defaults / env-var interpolation. */
  env?: Record<string, string | undefined>;
}

function findConfigFile(cwd: string): string | undefined {
  for (const name of CONFIG_FILENAMES) {
    const candidate = resolve(cwd, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Resolves the server configuration.
 *
 * Precedence:
 *   1. An explicit `configPath` (or the `CG_MCP_CONFIG` env var).
 *   2. A `commongrants-mcp.config.{ts,mjs,js}` discovered in `cwd`.
 *   3. The built-in three-source default (federal/pa/ca), with the federal key
 *      read from `FEDERAL_API_TOKEN`.
 *
 * A discovered config is loaded with jiti (so `.ts` works at runtime with no
 * build step) and validated against the Zod schema; invalid config throws.
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<ServerConfig> {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const explicit = options.configPath ?? env.CG_MCP_CONFIG;
  const configPath = explicit
    ? isAbsolute(explicit)
      ? explicit
      : resolve(cwd, explicit)
    : findConfigFile(cwd);

  if (!configPath) {
    return serverConfigSchema.parse(defaultConfig(env));
  }

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const jiti = createJiti(import.meta.url);
  const loaded = await jiti.import<ServerConfig | { default: ServerConfig }>(configPath);
  const config = 'default' in loaded ? loaded.default : loaded;

  return serverConfigSchema.parse(config);
}
