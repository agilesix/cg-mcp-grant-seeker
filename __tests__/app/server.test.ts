import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppServer } from '../../src/app/hosts/skybridge/server.js';
import { defaultSources } from '../../src/config/defaults.js';
import { createServer } from '../../src/core/server.js';

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
      ],
    });
  });
});
