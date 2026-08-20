import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { OpportunityBaseSchema } from '@common-grants/sdk/schemas';
import type { Plugin } from '@common-grants/sdk/extensions';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_SERVER_INSTRUCTIONS, createAppServer } from '../../src/app/hosts/skybridge/server.js';
import { defaultSources } from '../../src/config/defaults.js';
import { createServer } from '../../src/core/server.js';
import type { Opportunity, SearchResult, SourceConfig } from '../../src/core/types.js';

interface ConnectableServer {
  connect(transport: ReturnType<typeof InMemoryTransport.createLinkedPair>[1]): Promise<void>;
  close(): Promise<void>;
}

const openConnections: Array<{ client: Client; server: ConnectableServer }> = [];

async function connect(server: ConnectableServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'app-boundary-test', version: '1.0.0' });
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

describe('Skybridge app boundary', () => {
  it('instructs clients to present completed grant research automatically', async () => {
    const client = await connect(createAppServer(defaultSources()));

    expect(client.getInstructions()).toBe(APP_SERVER_INSTRUCTIONS);
    expect(client.getInstructions()).toContain('automatically call present_opportunity_shortlist');
    expect(client.getInstructions()).toContain('Do not wait for the user to request the shortlist');
    expect(client.getInstructions()).toContain('permission');
    expect(client.getInstructions()).toContain('plain-text shortlist instead');
  });

  it('exposes semantically equivalent core tool contracts', async () => {
    const sources = defaultSources();
    const coreClient = await connect(createServer(sources));
    const appClient = await connect(createAppServer(sources));

    const [coreTools, appTools] = await Promise.all([
      coreClient.listTools(),
      appClient.listTools(),
    ]);

    const coreNames = ['list_grant_sources', 'search_opportunities', 'get_opportunity'];
    const contract = ({
      name,
      title,
      description,
      inputSchema,
      outputSchema,
      annotations,
    }: (typeof coreTools.tools)[number]) => ({
      name,
      title,
      description,
      inputSchema,
      outputSchema,
      annotations,
    });
    const hostedCoreTools = appTools.tools.filter(({ name }) => coreNames.includes(name));

    expect(hostedCoreTools.map(contract)).toEqual(coreTools.tools.map(contract));
    expect(hostedCoreTools.map(({ name }) => name)).toEqual(coreNames);
  });

  it('keeps all configured sources available through the app adapter', async () => {
    const client = await connect(createAppServer(defaultSources()));
    const result = await client.callTool({ name: 'list_grant_sources', arguments: {} });

    expect(result.structuredContent).toEqual({
      sources: [
        { name: 'federal', label: 'Federal (Simpler.Grants.gov)' },
        { name: 'pa', label: 'Pennsylvania' },
        { name: 'ca', label: 'California' },
        { name: 'wa', label: 'Washington' },
        { name: 'md', label: 'Maryland Community Compass' },
      ],
    });
  });

  it('validates transform-free opportunity output through the hosted MCP adapter', async () => {
    const opportunity = OpportunityBaseSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Hosted wire contract grant',
      status: { value: 'open' },
      description: 'Exercises nullable and local event times.',
      keyDates: {
        postDate: {
          eventType: 'singleDate',
          name: 'Posted',
          date: '2026-07-01',
          time: null,
        },
        closeDate: {
          eventType: 'dateRange',
          name: 'Application window',
          startDate: '2026-08-01',
          startTime: null,
          endDate: '2026-08-31',
          endTime: '12:00:00',
        },
        otherDates: {
          questionsDue: {
            eventType: 'singleDate',
            name: 'Questions due',
            date: '2026-07-15',
          },
          officeHours: {
            eventType: 'other',
            name: 'Office hours',
            details: 'Every Tuesday',
          },
        },
      },
      customFields: {
        metadata: {
          name: 'metadata',
          fieldType: 'object',
          value: { nested: [{ enabled: true }] },
        },
      },
      createdAt: '2026-06-01T12:00:00Z',
      lastModifiedAt: '2026-07-01T12:30:00Z',
    }) as Opportunity;
    const plugin = {
      schemas: {},
      getClient: () => ({
        opportunities: {
          search: async () =>
            ({
              items: [opportunity],
              errors: [],
              paginationInfo: {
                page: 1,
                pageSize: 1,
                totalItems: 1,
                totalPages: 1,
              },
            }) as unknown as SearchResult,
          get: async () => opportunity,
        },
      }),
    } as unknown as Plugin;
    const sources: SourceConfig[] = [
      {
        name: 'test',
        label: 'Test source',
        baseUrl: 'https://example.gov',
        plugin,
      },
    ];
    const client = await connect(createAppServer(sources));

    await client.listTools();
    const search = await client.callTool({
      name: 'search_opportunities',
      arguments: { source: 'test', limit: 1 },
    });
    const detail = await client.callTool({
      name: 'get_opportunity',
      arguments: { source: 'test', id: opportunity.id },
    });

    expect(search.structuredContent).toMatchObject({
      sources: [
        {
          opportunities: [
            {
              keyDates: {
                postDate: { date: '2026-07-01', time: null },
                closeDate: { endTime: '12:00:00' },
              },
            },
          ],
        },
      ],
    });
    expect(detail.structuredContent).toMatchObject({
      opportunity: {
        keyDates: {
          postDate: { time: null },
          closeDate: { startTime: null, endTime: '12:00:00' },
        },
      },
    });
    const serializedOpportunity = JSON.parse(JSON.stringify(opportunity));
    expect(
      (search.structuredContent as { sources: Array<{ opportunities: unknown[] }> }).sources
        .at(0)!
        .opportunities.at(0),
    ).toEqual(serializedOpportunity);
    expect((detail.structuredContent as { opportunity: unknown }).opportunity).toEqual(
      serializedOpportunity,
    );
  });

  it('adds the final-shortlist tool only to the hosted app', async () => {
    const sources = defaultSources();
    const coreClient = await connect(createServer(sources));
    const appClient = await connect(createAppServer(sources));
    const [coreTools, appTools] = await Promise.all([
      coreClient.listTools(),
      appClient.listTools(),
    ]);

    expect(coreTools.tools.map(({ name }) => name)).not.toContain('present_opportunity_shortlist');
    const presentationTool = appTools.tools.find(
      ({ name }) => name === 'present_opportunity_shortlist',
    );
    expect(presentationTool).toBeDefined();
    expect(presentationTool?.description).toContain('call this tool automatically');
    expect(presentationTool?.description).toContain(
      'Do not wait for the user to request the shortlist',
    );
    expect(presentationTool?.description).toContain('permission');
    expect(presentationTool?.description).toContain('plain-text shortlist instead');
    expect(JSON.stringify(presentationTool?.inputSchema)).toContain('"minItems":1');
    expect(JSON.stringify(presentationTool?.inputSchema)).toContain('"maxItems":8');
    expect(JSON.stringify(presentationTool?.outputSchema)).toContain('"presentationId"');
  });
});
