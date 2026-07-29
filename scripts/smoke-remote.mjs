import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const endpoint = process.argv[2];

if (!endpoint) {
  console.error('Usage: node scripts/smoke-remote.mjs <mcp-url>');
  process.exit(2);
}

const expectedTools = [
  'list_grant_sources',
  'search_opportunities',
  'get_opportunity',
  'present_opportunity_shortlist',
];
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

    const references = [];
    for (const source of ['federal', 'pa', 'ca', 'wa']) {
      const result = await client.callTool({
        name: 'search_opportunities',
        arguments: { source, limit: 1 },
      });
      const sourceResult = result.structuredContent?.sources?.[0];
      if (!sourceResult || sourceResult.source?.name !== source) {
        throw new Error(`${source} source result was not returned`);
      }
      if (sourceResult.status === 'error') {
        throw new Error(`${source} source failed: ${sourceResult.error}`);
      }
      const opportunity = sourceResult.opportunities?.[0];
      if (!opportunity?.id) {
        throw new Error(`${source} search returned no opportunity to present`);
      }
      references.push({ source, id: opportunity.id });
    }

    const presentation = await client.callTool({
      name: 'present_opportunity_shortlist',
      arguments: {
        opportunities: references,
        researchContext: { searchCount: 4, queries: ['one result per configured source'] },
      },
    });
    const presented = presentation.structuredContent;
    if (!presented?.presentationId || presented.items?.length !== references.length) {
      throw new Error('Final-shortlist presentation did not return every source');
    }
    const failed = presented.items.filter(({ status }) => status !== 'success');
    if (failed.length > 0) {
      throw new Error(
        `Final-shortlist presentation failed to hydrate: ${failed
          .map(({ source }) => source.name)
          .join(', ')}`,
      );
    }

    console.log(
      `Preview smoke passed: ${expectedTools.length} tools; all four providers searched and presented.`,
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
