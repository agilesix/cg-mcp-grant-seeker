import type { ServerConfig, SourceConfig } from './types.js';
import { CaliforniaPlugin } from '../plugins/california.js';
import { FederalPlugin } from '../plugins/federal.js';
import { MarylandPlugin } from '../plugins/maryland.js';
import { PennsylvaniaPlugin } from '../plugins/pennsylvania.js';
import { WashingtonPlugin } from '../plugins/washington.js';

/**
 * The five sources the server ships with. `federalApiToken` is optional: the
 * federal source is included either way, but without a key its calls will fail
 * with an auth error (surfaced per-source, not fatal). PA, CA, WA, and MD are public.
 */
export function defaultSources(federalApiToken?: string): SourceConfig[] {
  return [
    {
      name: 'federal',
      label: 'Federal (Simpler.Grants.gov)',
      baseUrl: 'https://api.simpler.grants.gov',
      opportunityPageBaseUrl: 'https://simpler.grants.gov/opportunity/',
      auth: { type: 'apiKey', key: federalApiToken },
      isDefault: true,
      plugin: FederalPlugin,
    },
    {
      name: 'pa',
      label: 'Pennsylvania',
      baseUrl: 'https://pa.api.cg.a6lab.ai',
      plugin: PennsylvaniaPlugin,
    },
    {
      name: 'ca',
      label: 'California',
      baseUrl: 'https://ca.api.cg.a6lab.ai',
      plugin: CaliforniaPlugin,
    },
    {
      name: 'wa',
      label: 'Washington',
      baseUrl: 'https://wa.api.cg.a6lab.ai',
      plugin: WashingtonPlugin,
    },
    {
      name: 'md',
      label: 'Maryland Community Compass',
      baseUrl: 'https://md.api.cg.a6lab.ai',
      plugin: MarylandPlugin,
    },
  ];
}

/** The built-in default config, reading the federal key from the environment. */
export function defaultConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  return { sources: defaultSources(env.FEDERAL_API_TOKEN) };
}
