import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const endpoint = process.argv[2];

if (!endpoint) {
  console.error('Usage: node scripts/smoke-remote.mjs <mcp-url>');
  process.exit(2);
}

const expectedTools = ['list_grant_sources', 'search_opportunities', 'get_opportunity'];
let lastError;

for (let attempt = 1; attempt <= 5; attempt += 1) {
  const client = new Client({ name: 'deployed-preview-smoke', version: '1.0.0' });

  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));

    const tools = await client.listTools();
    const toolNames = tools.tools.map(({ name }) => name);
    for (const name of expectedTools) {
      if (!toolNames.includes(name)) {
        throw new Error(`Missing core tool: ${name}`);
      }
    }

    const result = await client.callTool({
      name: 'search_opportunities',
      arguments: { source: 'wa', query: 'agriculture', limit: 1 },
    });
    const washington = result.structuredContent?.sources?.[0];
    if (!washington || washington.source?.name !== 'wa') {
      throw new Error('Washington source result was not returned');
    }
    if (washington.status === 'error') {
      throw new Error(`Washington source failed: ${washington.error}`);
    }

    console.log(
      `Preview smoke passed: ${expectedTools.length} core tools; Washington status ${washington.status}.`,
    );
    await client.close();
    process.exit(0);
  } catch (error) {
    lastError = error;
    await client.close().catch(() => undefined);
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
}

console.error('Preview smoke failed:', lastError);
process.exit(1);
