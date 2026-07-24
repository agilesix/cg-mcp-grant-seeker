import { OpportunityBaseSchema } from '@common-grants/sdk/schemas';
import type { McpServer } from 'skybridge/server';
import { z } from 'zod3';
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

const shortlistItemSchema = z.object({
  source: sourceObjectSchema,
  id: z.string(),
  status: z.enum(['success', 'error']),
  opportunity: OpportunityBaseSchema.nullable(),
  providerPageUrl: z.string().url().nullable(),
  error: z.string().nullable(),
});

export type Source = z.infer<typeof sourceObjectSchema>;
export type WireOpportunity = z.input<typeof OpportunityBaseSchema>;
type SearchOutcome = z.input<typeof searchResultSchema>;
export type ShortlistItem = z.input<typeof shortlistItemSchema>;

export interface SearchToolInput {
  query?: string;
  statuses?: Array<(typeof STATUS_VALUES)[number]>;
  source?: string;
  page?: number;
  limit?: number;
}

export interface GetOpportunityToolInput {
  id: string;
  source: string;
}

export interface PresentOpportunityShortlistToolInput {
  opportunities: Array<{
    id: string;
    source: string;
  }>;
  searchesRun?: number;
  queries?: string[];
}

export interface PresentOpportunityShortlistToolOutput {
  items: ShortlistItem[];
  searchesRun: number | null;
  queries: string[];
}

export interface RegisterToolsOptions {
  grantResultsView?: boolean;
}

const DATE_ONLY_KEYS = new Set(['date', 'startDate', 'endDate']);

/**
 * Keeps Skybridge's deeply generic registration signature at this boundary.
 * CommonGrants supplies Zod 3 schemas while Skybridge's build CLI uses Zod 4;
 * inferring across both during emit can exhaust TypeScript's heap.
 */
function registerTool<TInput>(
  server: McpServer,
  config: Record<string, unknown>,
  handler: (input: TInput) => Promise<unknown>,
): void {
  const register = server.registerTool.bind(server) as unknown as (
    definition: Record<string, unknown>,
    callback: (input: TInput) => Promise<unknown>,
  ) => void;
  register(config, handler);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function normalizeSearchQuery(query: string | undefined): string | undefined {
  const trimmed = query?.trim();
  if (!trimmed || trimmed.length < 2) return trimmed;

  const first = trimmed[0];
  const last = trimmed.at(-1);
  const hasEnclosingQuotes = (first === '"' && last === '"') || (first === '“' && last === '”');
  if (!hasEnclosingQuotes) return trimmed;

  const unquoted = trimmed.slice(1, -1).trim();
  return unquoted || trimmed;
}

function normalizeQueries(queries: string[] | undefined): string[] {
  const normalized = queries
    ?.map((query) => normalizeSearchQuery(query))
    .filter((query): query is string => Boolean(query));
  return [...new Set(normalized ?? [])];
}

function sourceValue(client: ICommonGrantsClient): Source {
  return { name: client.name, label: client.label };
}

/**
 * The SDK parses protocol dates and timestamps into Date objects. MCP
 * structuredContent is JSON, so serialize once at the transport boundary while
 * preserving date-only events and full UTC record timestamps.
 */
function wireOpportunity(
  opportunity: Awaited<ReturnType<ICommonGrantsClient['getOpportunity']>>,
): WireOpportunity {
  return JSON.parse(
    JSON.stringify(opportunity, function (key, value) {
      const original = key === '' ? value : (this as Record<string, unknown>)[key];
      if (!(original instanceof Date)) return value;
      const iso = original.toISOString();
      return DATE_ONLY_KEYS.has(key) ? iso.slice(0, 10) : iso;
    }),
  ) as WireOpportunity;
}

function providerPageUrl(
  opportunity: Awaited<ReturnType<ICommonGrantsClient['getOpportunity']>>,
  client: ICommonGrantsClient,
): string | null {
  return (
    opportunity.source ??
    (client.opportunityPageBaseUrl
      ? new URL(encodeURIComponent(opportunity.id), client.opportunityPageBaseUrl).toString()
      : null)
  );
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
    return {
      source: sourceValue(client),
      status: 'error',
      opportunities: [],
      total: null,
      page: params.page ?? 1,
      hasNextPage: null,
      nextPage: null,
      omittedInvalidRows: 0,
      error: errorMessage(err),
    };
  }
}

/**
 * Registers all grant tools on an McpServer. The research tools preserve the
 * SDK contracts; the optional presentation tool adds a view without narrowing
 * the opportunity data available to the assistant.
 */
export function registerTools(
  server: McpServer,
  clients: ICommonGrantsClient[],
  { grantResultsView = false }: RegisterToolsOptions = {},
): void {
  if (clients.length === 0) {
    throw new Error('registerTools requires at least one configured source.');
  }

  const byName = new Map(clients.map((client) => [client.name, client]));
  const names = clients.map((client) => client.name) as [string, ...string[]];
  const sourceEnum = z.enum(names);

  registerTool(
    server,
    {
      name: 'list_grant_sources',
      title: 'List grant sources',
      description:
        'Discover the CommonGrants-compliant APIs this server can search and their source identifiers.',
      inputSchema: {},
      outputSchema: {
        sources: z.array(sourceObjectSchema),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => ({
      content: [],
      structuredContent: { sources: clients.map(sourceValue) },
    }),
  );

  registerTool(
    server,
    {
      name: 'search_opportunities',
      title: 'Search grant opportunities',
      description: [
        'Headless research tool that returns every field provided by the SDK search result.',
        'The MCP does not redefine the summary boundary: nested fields, timestamps, and',
        'customFields returned by the source are preserved without projection.',
        'Call repeatedly with varied plain-language queries when useful; intermediate searches do not render a user-facing card.',
        'After research is complete, call present_opportunity_shortlist exactly once with the strongest unique candidates.',
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
          .describe(
            'Plain full-text keywords, e.g. workforce development. Do not enclose the query in quotation marks; providers may treat them as literal characters.',
          ),
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
    async ({ query, statuses, source, page, limit }: SearchToolInput) => {
      const targets = source ? [byName.get(source)!] : clients;
      const params: SearchParams = {
        query: normalizeSearchQuery(query),
        statuses,
        page,
        pageSize: limit,
      };
      const results = await Promise.all(targets.map((client) => searchOne(client, params)));
      return {
        content: [],
        structuredContent: { sources: results },
        isError: results.every(({ status }) => status === 'error'),
      };
    },
  );

  registerTool(
    server,
    {
      name: 'present_opportunity_shortlist',
      title: 'Present grant opportunity shortlist',
      description: [
        'Present one final, deduplicated grant shortlist after completing research.',
        'Call this exactly once per user request, not for intermediate searches.',
        'Include at most eight unique source-scoped references worth showing.',
        'The server retrieves and preserves each complete SDK-validated opportunity.',
        'The attached view displays a concise subset without narrowing structuredContent.',
      ].join(' '),
      inputSchema: {
        opportunities: z
          .array(
            z.object({
              id: z.string().describe('The source-scoped opportunity ID'),
              source: sourceEnum.describe('Which source the opportunity belongs to'),
            }),
          )
          .max(8)
          .describe('Final unique candidates to show, ordered strongest first'),
        searchesRun: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe('Total number of search_opportunities calls used for this request'),
        queries: z
          .array(z.string())
          .max(20)
          .optional()
          .describe('Plain-language search queries used, in research order'),
      },
      outputSchema: {
        items: z.array(shortlistItemSchema),
        searchesRun: z.number().int().nonnegative().nullable(),
        queries: z.array(z.string()),
      },
      ...(grantResultsView
        ? {
            view: {
              component: 'grant-results',
              description:
                'Review one final grant shortlist assembled from the assistant’s completed research.',
              prefersBorder: false,
            },
          }
        : {}),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ opportunities, searchesRun, queries }: PresentOpportunityShortlistToolInput) => {
      const uniqueReferences = [
        ...new Map(
          opportunities.map((reference) => [`${reference.source}:${reference.id}`, reference]),
        ).values(),
      ];
      const items = await Promise.all(
        uniqueReferences.map(async ({ id, source }): Promise<ShortlistItem> => {
          const client = byName.get(source)!;
          try {
            const opportunity = await client.getOpportunity(id);
            return {
              source: sourceValue(client),
              id,
              status: 'success',
              opportunity: wireOpportunity(opportunity),
              providerPageUrl: providerPageUrl(opportunity, client),
              error: null,
            };
          } catch (err) {
            return {
              source: sourceValue(client),
              id,
              status: 'error',
              opportunity: null,
              providerPageUrl: null,
              error: errorMessage(err),
            };
          }
        }),
      );
      const structuredContent: PresentOpportunityShortlistToolOutput = {
        items,
        searchesRun: searchesRun ?? null,
        queries: normalizeQueries(queries),
      };
      return {
        content: [],
        structuredContent,
        isError: items.length > 0 && items.every(({ status }) => status === 'error'),
      };
    },
  );

  registerTool(
    server,
    {
      name: 'get_opportunity',
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
    async ({ id, source }: GetOpportunityToolInput) => {
      const client = byName.get(source)!;
      try {
        const opportunity = await client.getOpportunity(id);
        return {
          content: [],
          structuredContent: {
            source: sourceValue(client),
            status: 'success' as const,
            opportunity: wireOpportunity(opportunity),
            error: null,
          },
        };
      } catch (err) {
        return {
          content: [],
          structuredContent: {
            source: sourceValue(client),
            status: 'error' as const,
            opportunity: null,
            error: errorMessage(err),
          },
          isError: true,
        };
      }
    },
  );
}
