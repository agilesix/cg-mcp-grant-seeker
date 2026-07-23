import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerTools } from '../../src/core/tools.js';
import type { ICommonGrantsClient, Opportunity, SearchResult } from '../../src/core/types.js';

const opportunity = {
  id: 'opp-1',
  title: 'Workforce Development Grant',
  status: { value: 'open' },
  description: 'Funds job training programs.',
  funding: {
    maxAwardAmount: { amount: '500000', currency: 'USD' },
    minAwardAmount: { amount: '10000', currency: 'USD' },
  },
  keyDates: {
    closeDate: { eventType: 'singleDate', name: 'Close date', date: '2026-09-01' },
    postDate: { eventType: 'singleDate', name: 'Post date', date: '2026-06-01' },
  },
} as unknown as Opportunity;

function searchResult(
  items: Opportunity[],
  pagination: Partial<SearchResult['paginationInfo']> = {},
): SearchResult {
  return {
    items,
    paginationInfo: {
      page: 1,
      pageSize: 5,
      totalItems: items.length,
      totalPages: items.length === 0 ? 0 : 1,
      ...pagination,
    },
  } as unknown as SearchResult;
}

function fakeClient(
  name: string,
  search: () => Promise<SearchResult>,
  get: () => Promise<Opportunity> = async () => opportunity,
): ICommonGrantsClient {
  return {
    name,
    label: `${name} grants`,
    searchOpportunities: vi.fn(search),
    getOpportunity: vi.fn(get),
  };
}

const openConnections: Array<{ client: Client; server: McpServer }> = [];

async function connect(clients: ICommonGrantsClient[]): Promise<Client> {
  const server = new McpServer({ name: 'test-server', version: '1.0.0' });
  registerTools(server, clients);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  openConnections.push({ client, server });
  return client;
}

afterEach(async () => {
  await Promise.all(
    openConnections.splice(0).map(async ({ client, server }) => {
      await client.close();
      await server.close();
    }),
  );
});

describe('MCP tool result contracts', () => {
  it('advertises output schemas and returns structured source data', async () => {
    const client = await connect([fakeClient('federal', async () => searchResult([]))]);

    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(3);
    expect(tools.tools.every((tool) => tool.outputSchema?.type === 'object')).toBe(true);
    const searchSchema = JSON.stringify(
      tools.tools.find(({ name }) => name === 'search_opportunities')?.outputSchema,
    );
    expect(searchSchema).toContain('"const":"success"');
    expect(searchSchema).toContain('"const":"empty"');
    expect(searchSchema).toContain('"const":"error"');

    const result = await client.callTool({ name: 'list_grant_sources', arguments: {} });
    expect(result.structuredContent).toEqual({
      sources: [{ name: 'federal', label: 'federal grants' }],
    });
  });

  it('validates referenced search and detail output schemas after discovery', async () => {
    const client = await connect([fakeClient('federal', async () => searchResult([opportunity]))]);

    await client.listTools();

    const search = await client.callTool({
      name: 'search_opportunities',
      arguments: { source: 'federal' },
    });
    const detail = await client.callTool({
      name: 'get_opportunity',
      arguments: { source: 'federal', id: 'opp-1' },
    });

    expect(search.structuredContent).toMatchObject({
      sources: [{ status: 'success', opportunities: [{ id: 'opp-1' }] }],
    });
    expect(detail.structuredContent).toMatchObject({
      status: 'success',
      opportunity: { id: 'opp-1' },
    });
  });

  it('distinguishes successful and empty source searches', async () => {
    const client = await connect([
      fakeClient('federal', async () => searchResult([opportunity])),
      fakeClient('california', async () => searchResult([])),
    ]);

    const result = await client.callTool({
      name: 'search_opportunities',
      arguments: { query: 'workforce' },
    });

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({
      sources: [
        {
          source: { name: 'federal', label: 'federal grants' },
          status: 'success',
          returned: 1,
          total: 1,
          pagination: {
            page: 1,
            pageSize: 5,
            totalPages: 1,
            hasNextPage: false,
            nextPage: null,
          },
          opportunities: [
            {
              source: { name: 'federal', label: 'federal grants' },
              id: 'opp-1',
              title: 'Workforce Development Grant',
              status: 'open',
              maxAward: { amount: '500000', currency: 'USD' },
              closeDate: {
                eventType: 'singleDate',
                name: 'Close date',
                description: null,
                date: '2026-09-01',
                time: null,
              },
            },
          ],
          error: null,
        },
        {
          source: { name: 'california', label: 'california grants' },
          status: 'empty',
          returned: 0,
          total: 0,
          pagination: {
            page: 1,
            pageSize: 5,
            totalPages: 0,
            hasNextPage: false,
            nextPage: null,
          },
          opportunities: [],
          error: null,
        },
      ],
    });
  });

  it('returns source pagination and passes the requested page to the SDK boundary', async () => {
    const federal = fakeClient('federal', async () =>
      searchResult([opportunity], {
        page: 2,
        pageSize: 1,
        totalItems: 5,
        totalPages: 3,
      }),
    );
    const client = await connect([federal]);

    const result = await client.callTool({
      name: 'search_opportunities',
      arguments: { source: 'federal', page: 2, limit: 2 },
    });

    expect(federal.searchOpportunities).toHaveBeenCalledWith({
      query: undefined,
      statuses: ['open', 'forecasted'],
      page: 2,
      pageSize: 2,
    });
    expect(result.structuredContent).toMatchObject({
      sources: [
        {
          status: 'success',
          returned: 1,
          total: 5,
          pagination: {
            page: 2,
            pageSize: 1,
            totalPages: 3,
            hasNextPage: true,
            nextPage: 3,
          },
        },
      ],
    });
    if (!('content' in result)) throw new Error('Expected an immediate tool result');
    const content = result.content as unknown[];
    expect(content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('page 2 of 3'),
    });
  });

  it('passes bounded default pagination to every source', async () => {
    const federal = fakeClient('federal', async () => searchResult([]));
    const california = fakeClient('california', async () => searchResult([]));
    const client = await connect([federal, california]);

    await client.callTool({ name: 'search_opportunities', arguments: {} });

    for (const source of [federal, california]) {
      expect(source.searchOpportunities).toHaveBeenCalledWith({
        query: undefined,
        statuses: ['open', 'forecasted'],
        page: 1,
        pageSize: 5,
      });
    }
  });

  for (const [argument, value] of [
    ['page', 0],
    ['page', 1.5],
    ['limit', 0],
    ['limit', 26],
    ['limit', 1.5],
  ] as const) {
    it(`rejects invalid ${argument} ${value} before calling a source`, async () => {
      const federal = fakeClient('federal', async () => searchResult([]));
      const client = await connect([federal]);

      const result = await client.callTool({
        name: 'search_opportunities',
        arguments: { [argument]: value },
      });

      expect(result.isError).toBe(true);
      expect(federal.searchOpportunities).not.toHaveBeenCalled();
    });
  }

  it('reports independent continuation state for each fanout source', async () => {
    const client = await connect([
      fakeClient('federal', async () =>
        searchResult([opportunity], {
          page: 1,
          pageSize: 1,
          totalItems: 3,
          totalPages: 3,
        }),
      ),
      fakeClient('california', async () =>
        searchResult([opportunity], {
          page: 1,
          pageSize: 1,
          totalItems: 1,
          totalPages: 1,
        }),
      ),
    ]);

    const result = await client.callTool({
      name: 'search_opportunities',
      arguments: { limit: 1 },
    });

    expect(result.structuredContent).toMatchObject({
      sources: [
        {
          source: { name: 'federal' },
          pagination: { hasNextPage: true, nextPage: 2 },
        },
        {
          source: { name: 'california' },
          pagination: { hasNextPage: false, nextPage: null },
        },
      ],
    });
  });

  it('distinguishes an exhausted page from a search with no matches', async () => {
    const client = await connect([
      fakeClient('federal', async () =>
        searchResult([], {
          page: 3,
          pageSize: 0,
          totalItems: 4,
          totalPages: 2,
        }),
      ),
    ]);

    const result = await client.callTool({
      name: 'search_opportunities',
      arguments: { source: 'federal', page: 3, limit: 2 },
    });

    expect(result.structuredContent).toMatchObject({
      sources: [
        {
          status: 'empty',
          returned: 0,
          total: 4,
          pagination: {
            page: 3,
            pageSize: 0,
            totalPages: 2,
            hasNextPage: false,
            nextPage: null,
          },
        },
      ],
    });
    if (!('content' in result)) throw new Error('Expected an immediate tool result');
    const content = result.content as unknown[];
    expect(content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('page 3 has no results (4 total)'),
    });
  });

  it('represents unknown totals and continuation without guessing', async () => {
    const client = await connect([
      fakeClient('federal', async () =>
        searchResult([opportunity], {
          page: 1,
          pageSize: 1,
          totalItems: null,
          totalPages: null,
        }),
      ),
    ]);

    const result = await client.callTool({
      name: 'search_opportunities',
      arguments: { source: 'federal', limit: 1 },
    });

    expect(result.structuredContent).toMatchObject({
      sources: [
        {
          status: 'success',
          total: null,
          pagination: {
            page: 1,
            pageSize: 1,
            totalPages: null,
            hasNextPage: null,
            nextPage: null,
          },
        },
      ],
    });
  });

  it('turns impossible pagination metadata into a source-level error', async () => {
    const client = await connect([
      fakeClient('federal', async () =>
        searchResult([opportunity], {
          page: 1,
          pageSize: 1,
          totalItems: 1,
          totalPages: 1,
        }),
      ),
    ]);

    const result = await client.callTool({
      name: 'search_opportunities',
      arguments: { source: 'federal', page: 2, limit: 1 },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      sources: [
        {
          source: { name: 'federal', label: 'federal grants' },
          status: 'error',
          returned: 0,
          total: null,
          pagination: null,
          opportunities: [],
          error: 'Invalid pagination metadata returned for requested page 2',
        },
      ],
    });
  });

  for (const [name, items, pagination] of [
    [
      'more items than the reported page size',
      [opportunity, { ...opportunity, id: 'opp-2' }],
      { page: 1, pageSize: 1, totalItems: 2, totalPages: 2 },
    ],
    [
      'more returned items than total items',
      [opportunity, { ...opportunity, id: 'opp-2' }],
      { page: 1, pageSize: 2, totalItems: 1, totalPages: 1 },
    ],
    [
      'items beyond the reported final page',
      [opportunity],
      { page: 2, pageSize: 1, totalItems: 1, totalPages: 1 },
    ],
    [
      'zero total items with positive total pages',
      [],
      { page: 1, pageSize: 0, totalItems: 0, totalPages: 1 },
    ],
    [
      'positive total items with zero total pages',
      [],
      { page: 1, pageSize: 0, totalItems: 1, totalPages: 0 },
    ],
  ] as const) {
    it(`rejects pagination metadata with ${name}`, async () => {
      const client = await connect([
        fakeClient('federal', async () =>
          searchResult([...items] as Opportunity[], { ...pagination }),
        ),
      ]);

      const result = await client.callTool({
        name: 'search_opportunities',
        arguments: { source: 'federal', page: pagination.page },
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        sources: [{ status: 'error', pagination: null }],
      });
    });
  }

  it('returns partial fanout results without marking the whole call as an error', async () => {
    const client = await connect([
      fakeClient('federal', async () => searchResult([opportunity])),
      fakeClient('california', async () => {
        throw new Error('source unavailable');
      }),
    ]);

    const result = await client.callTool({
      name: 'search_opportunities',
      arguments: {},
    });

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      sources: [
        { source: { name: 'federal' }, status: 'success' },
        {
          source: { name: 'california' },
          status: 'error',
          returned: 0,
          total: null,
          pagination: null,
          opportunities: [],
          error: 'source unavailable',
        },
      ],
    });
  });

  it('marks a complete fanout failure as a tool error', async () => {
    const client = await connect([
      fakeClient('federal', async () => {
        throw new Error('federal unavailable');
      }),
      fakeClient('california', async () => {
        throw new Error('california unavailable');
      }),
    ]);

    const result = await client.callTool({
      name: 'search_opportunities',
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      sources: [
        { source: { name: 'federal' }, status: 'error', error: 'federal unavailable' },
        { source: { name: 'california' }, status: 'error', error: 'california unavailable' },
      ],
    });
  });

  it('marks a targeted search failure as a tool error', async () => {
    const client = await connect([
      fakeClient('federal', async () => {
        throw new Error('federal unavailable');
      }),
      fakeClient('california', async () => searchResult([opportunity])),
    ]);

    const result = await client.callTool({
      name: 'search_opportunities',
      arguments: { source: 'federal' },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      sources: [
        {
          source: { name: 'federal', label: 'federal grants' },
          status: 'error',
          returned: 0,
          total: null,
          pagination: null,
          opportunities: [],
          error: 'federal unavailable',
        },
      ],
    });
  });

  it('marks a targeted retrieval failure as a tool error', async () => {
    const client = await connect([
      fakeClient(
        'federal',
        async () => searchResult([]),
        async () => {
          throw new Error('not found');
        },
      ),
    ]);

    const result = await client.callTool({
      name: 'get_opportunity',
      arguments: { source: 'federal', id: 'missing' },
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      source: { name: 'federal', label: 'federal grants' },
      status: 'error',
      opportunity: null,
      error: 'not found',
    });
  });

  it('returns structured opportunity detail for a successful retrieval', async () => {
    const completeDescription = 'A'.repeat(1_000);
    const detailedOpportunity = {
      ...opportunity,
      description: completeDescription,
      source: 'https://example.gov/grants/opp-1',
      acceptedApplicantTypes: [
        {
          value: 'custom',
          customValue: 'California public agency',
          description: 'A state or local public agency in California',
        },
        {
          value: 'non_profit_with_501c3',
        },
      ],
      customFields: {
        agency: {
          name: 'agency',
          fieldType: 'object',
          value: { code: 'EDD', name: 'Employment Development Department', parentCode: null },
        },
        contactInfo: {
          name: 'contactInfo',
          fieldType: 'object',
          value: { name: 'Grant Office', email: 'grants@example.gov', phone: null },
        },
        additionalInfo: {
          name: 'additionalInfo',
          fieldType: 'object',
          value: { url: 'https://example.gov/grants/opp-1/details', description: null },
        },
        eligibilityCriteria: {
          name: 'eligibilityCriteria',
          fieldType: 'object',
          value: {
            beneficiaryTypes: [{ code: 'EL020000', name: 'Youth' }],
            details: 'Applicants must serve rural communities.',
          },
        },
      },
    } as Opportunity;
    const client = await connect([
      fakeClient(
        'federal',
        async () => searchResult([]),
        async () => detailedOpportunity,
      ),
    ]);

    const result = await client.callTool({
      name: 'get_opportunity',
      arguments: { source: 'federal', id: 'opp-1' },
    });

    expect(result.isError).toBeUndefined();
    if (!('content' in result)) throw new Error('Expected an immediate tool result');
    const content = result.content as unknown[];
    expect(content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining(`${'A'.repeat(500)}…`),
    });
    expect(result.structuredContent).toMatchObject({
      source: { name: 'federal', label: 'federal grants' },
      status: 'success',
      opportunity: {
        source: { name: 'federal', label: 'federal grants' },
        id: 'opp-1',
        description: completeDescription,
        minAward: { amount: '10000', currency: 'USD' },
        originalSourceUrl: 'https://example.gov/grants/opp-1',
        acceptedApplicantTypes: [
          {
            value: 'custom',
            customValue: 'California public agency',
            description: 'A state or local public agency in California',
          },
          {
            value: 'non_profit_with_501c3',
            customValue: null,
            description: null,
          },
        ],
        agency: {
          code: 'EDD',
          name: 'Employment Development Department',
          parentCode: null,
          parentName: null,
        },
        contactInfo: {
          name: 'Grant Office',
          email: 'grants@example.gov',
          phone: null,
          description: null,
        },
        additionalInfo: {
          url: 'https://example.gov/grants/opp-1/details',
          description: null,
        },
        eligibilityCriteria: {
          beneficiaryTypes: [{ code: 'EL020000', name: 'Youth' }],
          details: 'Applicants must serve rural communities.',
        },
        warnings: [],
        postDate: {
          eventType: 'singleDate',
          name: 'Post date',
          description: null,
          date: '2026-06-01',
          time: null,
        },
      },
      error: null,
    });
  });

  it('preserves complete date-range and other event semantics', async () => {
    const eventfulOpportunity = {
      ...opportunity,
      keyDates: {
        postDate: {
          eventType: 'dateRange',
          name: 'Application period',
          description: 'Primary application period',
          startDate: '2026-06-01',
          startTime: '09:00:00',
          endDate: '2026-06-30',
          endTime: '17:00:00',
        },
        closeDate: {
          eventType: 'other',
          name: 'Rolling deadline',
          description: 'Applications are reviewed as received',
          details: 'Rolling until funds are exhausted',
        },
      },
    } as unknown as Opportunity;
    const client = await connect([
      fakeClient(
        'california',
        async () => searchResult([eventfulOpportunity]),
        async () => eventfulOpportunity,
      ),
    ]);

    const result = await client.callTool({
      name: 'get_opportunity',
      arguments: { source: 'california', id: 'opp-1' },
    });

    expect(result.structuredContent).toMatchObject({
      opportunity: {
        postDate: {
          eventType: 'dateRange',
          name: 'Application period',
          description: 'Primary application period',
          startDate: '2026-06-01',
          startTime: '09:00:00',
          endDate: '2026-06-30',
          endTime: '17:00:00',
        },
        closeDate: {
          eventType: 'other',
          name: 'Rolling deadline',
          description: 'Applications are reviewed as received',
          details: 'Rolling until funds are exhausted',
        },
      },
    });
  });

  it('returns explicit nulls and warns without failing on malformed catalog fields', async () => {
    const malformedOpportunity = {
      ...opportunity,
      customFields: {
        agency: {
          name: 'agency',
          fieldType: 'object',
          value: { name: 42 },
        },
        contactInfo: {
          name: 'contactInfo',
          fieldType: 'object',
          value: { email: 'not an email' },
        },
        additionalInfo: {
          name: 'additionalInfo',
          fieldType: 'object',
          value: { url: 'not a URL' },
        },
        eligibilityCriteria: {
          name: 'eligibilityCriteria',
          fieldType: 'object',
          value: { details: 'Eligible', unexpected: true },
        },
      },
    } as unknown as Opportunity;
    const client = await connect([
      fakeClient(
        'federal',
        async () => searchResult([]),
        async () => malformedOpportunity,
      ),
    ]);

    const result = await client.callTool({
      name: 'get_opportunity',
      arguments: { source: 'federal', id: 'opp-1' },
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      status: 'success',
      opportunity: {
        originalSourceUrl: null,
        acceptedApplicantTypes: null,
        agency: null,
        contactInfo: null,
        additionalInfo: null,
        eligibilityCriteria: null,
        warnings: [
          {
            field: 'agency',
            code: 'invalid_catalog_field',
            message: expect.stringContaining('Expected string'),
          },
          {
            field: 'contactInfo',
            code: 'invalid_catalog_field',
            message: expect.stringContaining('Invalid email'),
          },
          {
            field: 'additionalInfo',
            code: 'invalid_catalog_field',
            message: expect.stringContaining('Invalid url'),
          },
          {
            field: 'eligibilityCriteria',
            code: 'invalid_catalog_field',
            message: expect.stringContaining("Unrecognized key(s) in object: 'unexpected'"),
          },
        ],
      },
    });
  });

  it('preserves an explicitly empty applicant list', async () => {
    const client = await connect([
      fakeClient(
        'pa',
        async () => searchResult([]),
        async () => ({ ...opportunity, acceptedApplicantTypes: [] }) as Opportunity,
      ),
    ]);

    const result = await client.callTool({
      name: 'get_opportunity',
      arguments: { source: 'pa', id: 'opp-1' },
    });

    expect(result.structuredContent).toMatchObject({
      opportunity: { acceptedApplicantTypes: [], warnings: [] },
    });
  });

  it('warns when a catalog field has the wrong envelope', async () => {
    const client = await connect([
      fakeClient(
        'ca',
        async () => searchResult([]),
        async () =>
          ({
            ...opportunity,
            customFields: {
              agency: {
                name: 'notAgency',
                fieldType: 'string',
                value: { name: 'Department of Transportation' },
              },
            },
          }) as unknown as Opportunity,
      ),
    ]);

    const result = await client.callTool({
      name: 'get_opportunity',
      arguments: { source: 'ca', id: 'opp-1' },
    });

    expect(result.structuredContent).toMatchObject({
      status: 'success',
      opportunity: {
        agency: null,
        warnings: [
          {
            field: 'agency',
            code: 'invalid_catalog_field',
            message: 'expected an object custom field named agency',
          },
        ],
      },
    });
  });
});
