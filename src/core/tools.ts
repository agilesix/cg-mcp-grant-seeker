import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OpportunityBaseSchema } from '@common-grants/sdk/schemas';
import { z } from 'zod';
import type { ICommonGrantsClient, SearchParams, SearchResult } from './types.js';

/** The base CommonGrants opportunity statuses (see {@link OpportunityStatus}). */
const STATUS_VALUES = ['open', 'forecasted', 'closed', 'custom'] as const;

const sourceSchema = {
  name: z.string(),
  label: z.string(),
};

const sourceObjectSchema = z.object(sourceSchema);

const searchResultSchema = z.object({
  source: sourceObjectSchema,
  status: z.enum(['success', 'empty', 'error']),
  opportunities: z.array(OpportunityBaseSchema),
  total: z.number().int().nonnegative().nullable(),
  page: z.number().int().positive(),
  hasNextPage: z.boolean().nullable(),
  nextPage: z.number().int().positive().nullable(),
  omittedInvalidRows: z.number().int().nonnegative(),
  error: z.string().nullable(),
});

type Source = z.infer<typeof sourceObjectSchema>;

type WireOpportunity = z.input<typeof OpportunityBaseSchema>;
type SearchOutcome = z.input<typeof searchResultSchema>;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sourceValue(client: ICommonGrantsClient): Source {
  return { name: client.name, label: client.label };
}

/**
 * SDK parsing intentionally turns protocol dates and timestamps into Date objects.
 * MCP structuredContent is JSON, so serialize once at the transport boundary.
 * SDK 0.6.1 serializes protocol date-only values as YYYY-MM-DD while ordinary
 * timestamps retain their full ISO representation.
 */
function wireOpportunity(opportunity: Awaited<ReturnType<ICommonGrantsClient['getOpportunity']>>) {
  return JSON.parse(JSON.stringify(opportunity)) as WireOpportunity;
}

function paginationValue(result: SearchResult, requestedPage: number) {
  const { page, totalItems, totalPages } = result.paginationInfo;
  if (
    page !== requestedPage ||
    !Number.isInteger(page) ||
    page < 1 ||
    (totalItems != null && (!Number.isInteger(totalItems) || totalItems < 0)) ||
    (totalPages != null && (!Number.isInteger(totalPages) || totalPages < 0))
  ) {
    throw new Error('Invalid pagination metadata returned by source');
  }
  const hasNextPage = totalPages == null ? null : page < totalPages;
  return {
    page,
    hasNextPage,
    nextPage: hasNextPage ? page + 1 : null,
  };
}

async function searchOne(
  client: ICommonGrantsClient,
  params: SearchParams,
): Promise<SearchOutcome> {
  try {
    const result = await client.searchOpportunities(params);
    const items = result.items ?? [];
    const pagination = paginationValue(result, params.page ?? 1);
    const total = result.paginationInfo.totalItems ?? null;
    return {
      source: sourceValue(client),
      status: items.length === 0 ? 'empty' : 'success',
      opportunities: items.map(wireOpportunity),
      total,
      ...pagination,
      omittedInvalidRows: result.errors?.length ?? 0,
      error: null,
    };
  } catch (err) {
    const message = errorMessage(err);
    return {
      source: sourceValue(client),
      status: 'error',
      opportunities: [],
      total: null,
      page: params.page ?? 1,
      hasNextPage: null,
      nextPage: null,
      omittedInvalidRows: 0,
      error: message,
    };
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
      description:
        'Discover the CommonGrants-compliant APIs this server can search and their source identifiers.',
      inputSchema: {},
      outputSchema: {
        sources: z.array(sourceObjectSchema),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const structuredContent = { sources: clients.map(sourceValue) };
      return {
        content: [],
        structuredContent,
      };
    },
  );

  server.registerTool(
    'search_opportunities',
    {
      title: 'Search grant opportunities',
      description: [
        'Search grant opportunities and return every field provided by the SDK search result.',
        'The MCP does not redefine the summary boundary: standard nested fields, timestamps,',
        'and customFields returned by the source are preserved without projection.',
        '',
        'Omit `source` to fan out across every source and get combined, labeled results.',
        'Provide `source` (see list_grant_sources) to target one.',
        'Use each source result’s `nextPage` and repeat the same search arguments except page',
        'to continue that source. `hasNextPage: null` means continuation is unknown.',
        '`omittedInvalidRows` counts malformed rows removed from the page without exposing them.',
        'Pagination is not a snapshot, so changing source data can cause duplicates or omissions.',
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
        page: z.number().int().min(1).default(1).describe('1-based results page'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .default(5)
          .describe('Requested page size per source'),
      },
      outputSchema: {
        sources: z.array(searchResultSchema),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, statuses, source, page, limit }) => {
      const targets = source ? [byName.get(source)!] : clients;
      const params: SearchParams = { query, statuses, page, pageSize: limit };
      const results = await Promise.all(targets.map((client) => searchOne(client, params)));
      const structuredContent = { sources: results };
      return {
        content: [],
        structuredContent,
        isError: results.every(({ status }) => status === 'error'),
      };
    },
  );

  server.registerTool(
    'get_opportunity',
    {
      title: 'Get grant opportunity',
      description: [
        'Get the complete SDK-validated CommonGrants opportunity by ID from one source.',
        'Pass the `source` and `id` together from a search result; IDs are source-scoped.',
        'The original nested protocol shape, timestamps, and customFields are preserved.',
        'Treat null as unknown or unavailable, not as a negative answer.',
        '`keyDates.closeDate` is source-provided and can be an administrative',
        'horizon for a rolling or continuous program rather than a fixed application cutoff.',
        'Event times are timezone-unspecified. Verify ambiguous deadlines at `source`.',
      ].join(' '),
      inputSchema: {
        id: z.string().describe('The opportunity ID'),
        source: sourceEnum.describe('Which source the opportunity belongs to'),
      },
      outputSchema: {
        source: sourceObjectSchema,
        status: z.enum(['success', 'error']),
        opportunity: OpportunityBaseSchema.nullable(),
        error: z.string().nullable(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id, source }) => {
      const client = byName.get(source)!;
      try {
        const opp = await client.getOpportunity(id);
        return {
          content: [],
          structuredContent: {
            source: sourceValue(client),
            status: 'success' as const,
            opportunity: wireOpportunity(opp),
            error: null,
          },
        };
      } catch (err) {
        const message = errorMessage(err);
        return {
          content: [],
          structuredContent: {
            source: sourceValue(client),
            status: 'error' as const,
            opportunity: null,
            error: message,
          },
          isError: true,
        };
      }
    },
  );
}
