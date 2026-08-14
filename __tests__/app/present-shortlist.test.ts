import { OpportunityBaseSchema } from '@common-grants/sdk/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
  presentOpportunityShortlist,
  safeProviderPageUrl,
} from '../../src/app/tools/present-shortlist.js';
import type { ICommonGrantsClient, Opportunity, SearchResult } from '../../src/core/types.js';
import type { WireOpportunity } from '../../src/core/wire.js';

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
}

function opportunity(id: string, overrides: Record<string, unknown> = {}): Opportunity {
  return OpportunityBaseSchema.parse({
    id,
    title: `Opportunity ${id}`,
    status: { value: 'open' },
    description: 'Complete opportunity description.',
    customFields: {
      providerField: {
        name: 'providerField',
        fieldType: 'string',
        value: 'preserved',
      },
    },
    createdAt: '2026-07-01T12:00:00Z',
    lastModifiedAt: '2026-07-02T12:00:00Z',
    ...overrides,
  }) as Opportunity;
}

function client(
  name: string,
  getOpportunity: (id: string) => Promise<Opportunity>,
  opportunityPageBaseUrl?: string,
): ICommonGrantsClient {
  return {
    name,
    label: `${name.toUpperCase()} grants`,
    opportunityPageBaseUrl,
    searchOpportunities: vi.fn(async () => ({}) as SearchResult),
    getOpportunity: vi.fn(getOpportunity),
  };
}

describe('presentOpportunityShortlist', () => {
  it('deduplicates source-scoped references, preserves rank, and returns complete data', async () => {
    const federal = client(
      'federal',
      async (id) => opportunity(id),
      'https://simpler.grants.gov/opportunity/',
    );
    const california = client('ca', async (id) =>
      opportunity(id, { source: 'https://grants.ca.gov/opportunity/example' }),
    );
    const californiaId = uuid(1);
    const federalId = uuid(2);

    const result = await presentOpportunityShortlist(
      {
        opportunities: [
          { source: 'ca', id: californiaId },
          { source: 'federal', id: federalId },
          { source: 'ca', id: californiaId },
        ],
        researchContext: {
          searchCount: 4,
          queries: [' "housing" ', 'housing', 'youth services'],
          filters: [' Open opportunities ', 'Posted in the last 7 days', 'Open opportunities'],
          sort: ' Nearest close date first ',
        },
      },
      [federal, california],
      { presentationId: () => '11111111-1111-4111-8111-111111111111' },
    );

    expect(result.presentationId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.items.map(({ rank, source, id }) => [rank, source.name, id])).toEqual([
      [1, 'ca', californiaId],
      [2, 'federal', federalId],
    ]);
    expect(result.items[0]?.opportunity?.customFields?.providerField?.value).toBe('preserved');
    expect(result.items[0]?.providerPageUrl).toBe('https://grants.ca.gov/opportunity/example');
    expect(result.items[1]?.providerPageUrl).toBe(
      `https://simpler.grants.gov/opportunity/${federalId}`,
    );
    expect(result.researchContext).toEqual({
      provenance: 'assistant_supplied',
      searchCount: 4,
      queries: ['housing', 'youth services'],
      filters: ['Open opportunities', 'Posted in the last 7 days'],
      sort: 'Nearest close date first',
    });
  });

  it('returns safe partial failures and never exposes raw upstream errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const federal = client('federal', async () => {
      throw new Error('token=super-secret upstream exploded');
    });

    const result = await presentOpportunityShortlist(
      { opportunities: [{ source: 'federal', id: uuid(1) }] },
      [federal],
      { presentationId: () => '11111111-1111-4111-8111-111111111111' },
    );

    expect(result.items[0]).toMatchObject({
      status: 'error',
      error: {
        code: 'unavailable',
        message: 'This opportunity could not be loaded from FEDERAL grants.',
      },
    });
    expect(JSON.stringify(result)).not.toContain('super-secret');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('advances after a batch deadline and reports timeouts', async () => {
    const stalled = client('stalled', () => new Promise<Opportunity>(() => undefined));
    const quick = client('quick', async (id) => opportunity(id));
    const started = Date.now();

    const result = await presentOpportunityShortlist(
      {
        opportunities: [
          { source: 'stalled', id: uuid(1) },
          { source: 'quick', id: uuid(2) },
        ],
      },
      [stalled, quick],
      {
        batchSize: 1,
        batchTimeoutMs: 15,
        presentationId: () => '11111111-1111-4111-8111-111111111111',
      },
    );

    expect(Date.now() - started).toBeLessThan(200);
    expect(result.items[0]?.error?.code).toBe('timeout');
    expect(result.items[1]?.status).toBe('success');
  });

  it('keeps a rich eight-item structured result under the prototype soft budget', async () => {
    const providerNames = ['federal', 'pa', 'ca', 'wa'];
    const clients = providerNames.map((name) =>
      client(name, async (id) =>
        opportunity(id, {
          description: 'Detailed program guidance. '.repeat(1_000),
          customFields: {
            providerField: {
              name: 'providerField',
              fieldType: 'string',
              value: 'Provider-specific data '.repeat(200),
            },
          },
        }),
      ),
    );
    const references = Array.from({ length: 8 }, (_, index) => ({
      source: providerNames[index % providerNames.length]!,
      id: uuid(index + 1),
    }));

    const result = await presentOpportunityShortlist({ opportunities: references }, clients, {
      presentationId: () => '11111111-1111-4111-8111-111111111111',
    });
    const bytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;

    expect(result.items).toHaveLength(8);
    expect(result.items.every(({ opportunity: item }) => item?.description?.length)).toBe(true);
    expect(new Set(result.items.map(({ source }) => source.name))).toEqual(new Set(providerNames));
    expect(bytes).toBeLessThan(750_000);
  });
});

describe('safeProviderPageUrl', () => {
  const baseOpportunity = opportunity(uuid(1)) as unknown as WireOpportunity;
  const source = client('source', async () => opportunity(uuid(1)));

  it('allows HTTPS and local HTTP only', () => {
    expect(
      safeProviderPageUrl({ ...baseOpportunity, source: 'https://example.gov/grant/1' }, source),
    ).toBe('https://example.gov/grant/1');
    expect(
      safeProviderPageUrl({ ...baseOpportunity, source: 'http://localhost:3000/grant/1' }, source),
    ).toBe('http://localhost:3000/grant/1');
    expect(
      safeProviderPageUrl({ ...baseOpportunity, source: 'http://example.gov/grant/1' }, source),
    ).toBeNull();
    expect(
      safeProviderPageUrl({ ...baseOpportunity, source: 'javascript:alert(1)' }, source),
    ).toBeNull();
  });
});
