import { describe, expect, it, vi } from 'vitest';
import type { Plugin } from '@common-grants/sdk/extensions';
import { SdkCommonGrantsClient } from '../../src/core/client.js';
import type { Opportunity, SearchResult } from '../../src/core/types.js';

describe('SdkCommonGrantsClient', () => {
  it('uses the plugin-bound SDK client when a source provides a plugin', async () => {
    const result = {
      items: [],
      paginationInfo: { page: 1, pageSize: 5 },
    } as unknown as SearchResult;
    const opportunity = { id: 'ca-1' } as Opportunity;
    const search = vi.fn(async () => result);
    const get = vi.fn(async () => opportunity);
    const getClient = vi.fn(() => ({ opportunities: { search, get } }));
    const plugin = { schemas: {}, getClient } as unknown as Plugin;

    const client = new SdkCommonGrantsClient({
      name: 'ca',
      label: 'California',
      baseUrl: 'https://ca.example.com',
      plugin,
    });

    await expect(client.searchOpportunities({ query: 'water', pageSize: 5 })).resolves.toBe(result);
    await expect(client.getOpportunity('ca-1')).resolves.toBe(opportunity);
    expect(getClient).toHaveBeenCalledWith({
      baseUrl: 'https://ca.example.com',
      auth: undefined,
    });
    expect(search).toHaveBeenCalledWith({
      query: 'water',
      statuses: undefined,
      page: 1,
      pageSize: 5,
      onParseError: 'throw',
    });
    expect(get).toHaveBeenCalledWith('ca-1');
  });
});
