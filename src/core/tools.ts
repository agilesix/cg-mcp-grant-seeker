import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatOpportunityDetail, formatOpportunitySummary } from './format.js';
import type { ICommonGrantsClient, SearchParams } from './types.js';

/** The base CommonGrants opportunity statuses (see {@link OpportunityStatus}). */
const STATUS_VALUES = ['open', 'forecasted', 'closed', 'custom'] as const;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function searchOne(
  client: ICommonGrantsClient,
  params: SearchParams,
  limit: number,
): Promise<string> {
  try {
    const result = await client.searchOpportunities({ ...params, page: 1, pageSize: limit });
    const items = result.items ?? [];
    if (items.length === 0) return `**${client.label}**: no results`;
    const total = result.paginationInfo?.totalItems ?? items.length;
    const formatted = items.map((opp, i) => formatOpportunitySummary(opp, i)).join('\n\n');
    return `**${client.label}** (showing ${items.length} of ${total})\n\n${formatted}`;
  } catch (err) {
    return `**${client.label}**: error — ${errorMessage(err)}`;
  }
}

/**
 * Registers all grant tools on an McpServer. The set of sources is data-driven:
 * adding a source to the registry automatically extends the `source` argument
 * on every tool and the fan-out behavior of search.
 *
 * Tool annotations (readOnlyHint, openWorldHint) are required by the Claude
 * Connectors Directory and the OpenAI Apps SDK — do not drop them.
 */
export function registerTools(server: McpServer, clients: ICommonGrantsClient[]): void {
  if (clients.length === 0) {
    throw new Error('registerTools requires at least one configured source.');
  }

  const byName = new Map(clients.map((c) => [c.name, c]));
  const names = clients.map((c) => c.name) as [string, ...string[]];
  const sourceEnum = z.enum(names);

  server.registerTool(
    'list_grant_sources',
    {
      title: 'List grant sources',
      description: 'List the CommonGrants-compliant APIs this server can search.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: [
            'Available grant sources:\n',
            ...clients.map((c) => `- **${c.name}**: ${c.label}`),
            '\nAll sources implement the CommonGrants protocol, so the same tools work across every one.',
          ].join('\n'),
        },
      ],
    }),
  );

  server.registerTool(
    'search_opportunities',
    {
      title: 'Search grant opportunities',
      description: [
        'Search for grant opportunities across CommonGrants sources.',
        '',
        'Omit `source` to fan out across every source and get combined, labeled results.',
        'Provide `source` (see list_grant_sources) to target one.',
      ].join('\n'),
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Full-text search query, e.g. 'workforce development'"),
        statuses: z
          .array(z.enum(STATUS_VALUES))
          .default(['open', 'forecasted'])
          .describe('Filter by opportunity status'),
        source: sourceEnum.optional().describe('Which source to query. Omit to search all.'),
        limit: z.number().int().min(1).max(25).default(5).describe('Max results per source'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, statuses, source, limit }) => {
      const targets = source ? [byName.get(source)!] : clients;
      const params: SearchParams = { query, statuses };
      const results = await Promise.all(targets.map((client) => searchOne(client, params, limit)));
      return { content: [{ type: 'text', text: results.join('\n\n---\n\n') }] };
    },
  );

  server.registerTool(
    'get_opportunity',
    {
      title: 'Get grant opportunity',
      description: 'Get the full details of a specific grant opportunity by ID from one source.',
      inputSchema: {
        id: z.string().describe('The opportunity ID'),
        source: sourceEnum.describe('Which source the opportunity belongs to'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id, source }) => {
      const client = byName.get(source)!;
      try {
        const opp = await client.getOpportunity(id);
        return { content: [{ type: 'text', text: formatOpportunityDetail(opp, client.label) }] };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `${client.label}: could not retrieve ${id} — ${errorMessage(err)}`,
            },
          ],
        };
      }
    },
  );
}
