import { describe, expect, it } from 'vitest';
import { definePlugin } from '@common-grants/sdk/extensions';
import { loadConfig, serverConfigSchema } from '../../src/config/index.js';
import { CaliforniaPlugin } from '../../src/plugins/california.js';
import { PennsylvaniaPlugin } from '../../src/plugins/pennsylvania.js';

const valid = {
  sources: [
    {
      name: 'federal',
      label: 'Federal',
      baseUrl: 'https://api.simpler.grants.gov',
      isDefault: true,
    },
    { name: 'ca', label: 'California', baseUrl: 'https://ca.api.cg.a6lab.ai' },
  ],
};

describe('serverConfigSchema', () => {
  it('accepts a valid config', () => {
    expect(() => serverConfigSchema.parse(valid)).not.toThrow();
  });

  it('rejects an empty source list', () => {
    expect(() => serverConfigSchema.parse({ sources: [] })).toThrow();
  });

  it('rejects duplicate source names', () => {
    expect(() =>
      serverConfigSchema.parse({
        sources: [
          { name: 'ca', label: 'A', baseUrl: 'https://a.example.com' },
          { name: 'ca', label: 'B', baseUrl: 'https://b.example.com' },
        ],
      }),
    ).toThrow(/duplicate source names/);
  });

  it('rejects more than one default source', () => {
    expect(() =>
      serverConfigSchema.parse({
        sources: [
          { name: 'a', label: 'A', baseUrl: 'https://a.example.com', isDefault: true },
          { name: 'b', label: 'B', baseUrl: 'https://b.example.com', isDefault: true },
        ],
      }),
    ).toThrow(/isDefault/);
  });

  it('rejects an invalid base URL', () => {
    expect(() =>
      serverConfigSchema.parse({ sources: [{ name: 'a', label: 'A', baseUrl: 'not-a-url' }] }),
    ).toThrow();
  });

  it('rejects a source name with illegal characters', () => {
    expect(() =>
      serverConfigSchema.parse({
        sources: [{ name: 'Fed Eral', label: 'A', baseUrl: 'https://a.example.com' }],
      }),
    ).toThrow();
  });

  it('preserves a plugin created with definePlugin', () => {
    const plugin = definePlugin({});
    const parsed = serverConfigSchema.parse({
      sources: [{ name: 'ca', label: 'California', baseUrl: 'https://ca.example.com', plugin }],
    });

    expect(parsed.sources[0]!.plugin).toBe(plugin);
  });

  it('rejects a plugin without a client factory', () => {
    expect(() =>
      serverConfigSchema.parse({
        sources: [
          {
            name: 'ca',
            label: 'California',
            baseUrl: 'https://ca.example.com',
            plugin: { schemas: {} },
          },
        ],
      }),
    ).toThrow(/definePlugin/);
  });
});

describe('loadConfig defaults', () => {
  it('falls back to the three built-in sources when no config file exists', async () => {
    const config = await loadConfig({ env: {}, cwd: '/nonexistent-dir-xyz' });
    expect(config.sources.map((s) => s.name)).toEqual(['federal', 'pa', 'ca']);
  });

  it('threads FEDERAL_API_TOKEN into the federal source auth', async () => {
    const config = await loadConfig({
      env: { FEDERAL_API_TOKEN: 'test-key' },
      cwd: '/nonexistent-dir-xyz',
    });
    const federal = config.sources.find((s) => s.name === 'federal');
    expect(federal?.auth).toEqual({ type: 'apiKey', key: 'test-key' });
  });

  it('leaves the federal key undefined when the env var is absent', async () => {
    const config = await loadConfig({ env: {}, cwd: '/nonexistent-dir-xyz' });
    const federal = config.sources.find((s) => s.name === 'federal');
    expect(federal?.auth).toEqual({ type: 'apiKey', key: undefined });
  });

  it('binds built-in state sources to their consumer plugins', async () => {
    const config = await loadConfig({ env: {}, cwd: '/nonexistent-dir-xyz' });
    const byName = new Map(config.sources.map((source) => [source.name, source]));

    expect(byName.get('ca')?.plugin).toBe(CaliforniaPlugin);
    expect(byName.get('pa')?.plugin).toBe(PennsylvaniaPlugin);
    expect(byName.get('federal')?.plugin).toBeUndefined();
  });
});
