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

function searchResult(items: Opportunity[]): SearchResult {
  return {
    items,
    paginationInfo: {
      page: 1,
      pageSize: 5,
      totalItems: items.length,
      totalPages: items.length === 0 ? 0 : 1,
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
          opportunities: [],
          error: null,
        },
      ],
    });
  });

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
});
