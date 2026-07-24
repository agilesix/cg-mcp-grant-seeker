import type { ServerConfig, SourceConfig } from './types.js';
import { CaliforniaPlugin } from '../plugins/california.js';

/**
 * The three sources the server ships with. `federalApiToken` is optional: the
 * federal source is included either way, but without a key its calls will fail
 * with an auth error (surfaced per-source, not fatal). PA and CA are public.
 */
export function defaultSources(federalApiToken?: string): SourceConfig[] {
  return [
    {
      name: 'federal',
      label: 'Federal (Simpler.Grants.gov)',
      baseUrl: 'https://api.simpler.grants.gov',
      auth: { type: 'apiKey', key: federalApiToken },
      isDefault: true,
    },
    {
      name: 'pa',
      label: 'Pennsylvania',
      baseUrl: 'https://pa.api.cg.a6lab.ai',
    },
    {
      name: 'ca',
      label: 'California',
      baseUrl: 'https://ca.api.cg.a6lab.ai',
      plugin: CaliforniaPlugin,
    },
  ];
}

/** The built-in default config, reading the federal key from the environment. */
export function defaultConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  return { sources: defaultSources(env.FEDERAL_API_TOKEN) };
}
