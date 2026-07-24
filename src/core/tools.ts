import { ApplicantTypeOptionsEnum } from '@common-grants/sdk/schemas';
import type { McpServer } from 'skybridge/server';
import { z } from 'zod3';
import { catalogFieldsValue, catalogOutputSchema } from './catalog-fields.js';
import type { ICommonGrantsClient, Opportunity, SearchParams, SearchResult } from './types.js';

/** The base CommonGrants opportunity statuses (see {@link OpportunityStatus}). */
const STATUS_VALUES = ['open', 'forecasted', 'closed', 'custom'] as const;

const sourceSchema = {
  name: z.string(),
  label: z.string(),
};

const sourceObjectSchema = z.object(sourceSchema);

const moneySchema = z
  .object({
    amount: z.string(),
    currency: z.string().nullable(),
  })
  .nullable();

const eventSchema = z
  .discriminatedUnion('eventType', [
    z.object({
      eventType: z.literal('singleDate'),
      name: z.string(),
      description: z.string().nullable(),
      date: z.string(),
      time: z.string().nullable(),
    }),
    z.object({
      eventType: z.literal('dateRange'),
      name: z.string(),
      description: z.string().nullable(),
      startDate: z.string(),
      startTime: z.string().nullable(),
      endDate: z.string(),
      endTime: z.string().nullable(),
    }),
    z.object({
      eventType: z.literal('other'),
      name: z.string(),
      description: z.string().nullable(),
      details: z.string().nullable(),
    }),
  ])
  .nullable();

const applicantTypeSchema = z.object({
  value: ApplicantTypeOptionsEnum,
  customValue: z.string().nullable(),
  description: z.string().nullable(),
});

const opportunitySummarySchema = {
  source: sourceObjectSchema,
  id: z.string(),
  title: z.string().nullable(),
  status: z.string().nullable(),
  maxAward: moneySchema,
  closeDate: eventSchema,
};

const opportunitySummaryObjectSchema = z.object(opportunitySummarySchema);

const opportunityDetailObjectSchema = opportunitySummaryObjectSchema.extend({
  description: z.string().nullable(),
  minAward: moneySchema,
  postDate: eventSchema,
  originalSourceUrl: z.string().url().nullable(),
  acceptedApplicantTypes: z.array(applicantTypeSchema).nullable(),
  ...catalogOutputSchema,
});

const searchResultSchema = z.object({
  source: sourceObjectSchema,
  status: z.enum(['success', 'empty', 'error']),
  opportunities: z.array(opportunitySummaryObjectSchema),
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
  opportunity: opportunityDetailObjectSchema.nullable(),
  error: z.string().nullable(),
});

export type Source = z.infer<typeof sourceObjectSchema>;
export type OpportunitySummary = z.infer<typeof opportunitySummaryObjectSchema>;
export type OpportunityDetail = z.infer<typeof opportunityDetailObjectSchema>;
export type SearchOutcome = z.infer<typeof searchResultSchema>;
export type ShortlistItem = z.infer<typeof shortlistItemSchema>;

export interface SearchToolInput {
  query?: string;
  statuses?: Array<(typeof STATUS_VALUES)[number]>;
  source?: string;
  page?: number;
  limit?: number;
}

export interface SearchToolOutput {
  sources: SearchOutcome[];
}

export interface GetOpportunityToolInput {
  id: string;
  source: string;
}

export interface GetOpportunityToolOutput {
  source: Source;
  status: 'success' | 'error';
  opportunity: OpportunityDetail | null;
  error: string | null;
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

/**
 * Keeps Skybridge's deeply generic registration signature at this boundary.
 * CommonGrants currently supplies Zod 3 schemas while Skybridge's build CLI
 * uses Zod 4; inferring across both during emit can exhaust TypeScript's heap.
 * Runtime registration and the public schemas are unchanged.
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

function dateValue(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

function eventValue(event: NonNullable<Opportunity['keyDates']>['closeDate'] | undefined) {
  if (!event) return null;
  if (event.eventType === 'singleDate') {
    const date = dateValue(event.date);
    return date
      ? {
          eventType: 'singleDate' as const,
          name: event.name,
          description: event.description ?? null,
          date,
          time: event.time ?? null,
        }
      : null;
  }
  if (event.eventType === 'dateRange') {
    const startDate = dateValue(event.startDate);
    const endDate = dateValue(event.endDate);
    if (!startDate || !endDate) return null;
    return {
      eventType: 'dateRange' as const,
      name: event.name,
      description: event.description ?? null,
      startDate,
      startTime: event.startTime ?? null,
      endDate,
      endTime: event.endTime ?? null,
    };
  }
  return {
    eventType: 'other' as const,
    name: event.name,
    description: event.description ?? null,
    details: event.details ?? null,
  };
}

function moneyValue(
  money: { amount?: string | number | null; currency?: string | null } | null | undefined,
) {
  if (money?.amount == null || money.amount === '') return null;
  return {
    amount: String(money.amount),
    currency: money.currency ?? null,
  };
}

function opportunitySummary(
  opportunity: Opportunity,
  client: ICommonGrantsClient,
): OpportunitySummary {
  return {
    source: sourceValue(client),
    id: opportunity.id,
    title: opportunity.title ?? null,
    status: opportunity.status?.value ?? null,
    maxAward: moneyValue(opportunity.funding?.maxAwardAmount),
    closeDate: eventValue(opportunity.keyDates?.closeDate),
  };
}

function opportunityDetail(
  opportunity: Opportunity,
  client: ICommonGrantsClient,
): OpportunityDetail {
  const providerPageUrl =
    opportunity.source ??
    (client.opportunityPageBaseUrl
      ? new URL(encodeURIComponent(opportunity.id), client.opportunityPageBaseUrl).toString()
      : null);

  return {
    ...opportunitySummary(opportunity, client),
    description: opportunity.description ?? null,
    minAward: moneyValue(opportunity.funding?.minAwardAmount),
    postDate: eventValue(opportunity.keyDates?.postDate),
    originalSourceUrl: providerPageUrl,
    acceptedApplicantTypes:
      opportunity.acceptedApplicantTypes?.map(({ value, customValue, description }) => ({
        value,
        customValue: customValue ?? null,
        description: description ?? null,
      })) ?? null,
    ...catalogFieldsValue(opportunity),
  };
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
      opportunities: items.map((opportunity) => opportunitySummary(opportunity, client)),
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
export function registerTools(
  server: McpServer,
  clients: ICommonGrantsClient[],
  { grantResultsView = false }: RegisterToolsOptions = {},
): void {
  if (clients.length === 0) {
    throw new Error('registerTools requires at least one configured source.');
  }

  const byName = new Map(clients.map((c) => [c.name, c]));
  const names = clients.map((c) => c.name) as [string, ...string[]];
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
    async () => {
      const structuredContent = { sources: clients.map(sourceValue) };
      return {
        content: [],
        structuredContent,
      };
    },
  );

  registerTool(
    server,
    {
      name: 'search_opportunities',
      title: 'Search grant opportunities',
      description: [
        'Headless research tool for discovering grant opportunities and obtaining source-scoped IDs.',
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
      const structuredContent = { sources: results };
      return {
        content: [],
        structuredContent,
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
        'Present one final, deduplicated grant shortlist to the user after completing research.',
        'Call this exactly once per user request, after any search_opportunities and get_opportunity calls.',
        'Do not call it for intermediate searches or for each query separately.',
        'Include at most eight unique source-scoped references that are genuinely worth showing.',
        'Use searchesRun and queries to accurately disclose the research breadth.',
        'The server retrieves complete normalized details for the visual review experience.',
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
              opportunity: opportunityDetail(opportunity, client),
              error: null,
            };
          } catch (err) {
            return {
              source: sourceValue(client),
              id,
              status: 'error',
              opportunity: null,
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
        'Get normalized details for a specific grant opportunity by ID from one source.',
        'Pass the `source` and `id` together from a search result; IDs are source-scoped.',
        'Includes core fields plus reusable CommonGrants catalog fields for agency, contact,',
        'additional information, and eligibility. Treat null as unknown or unavailable, not',
        'as a negative answer. `closeDate` is source-provided and can be an administrative',
        'horizon for a rolling or continuous program rather than a fixed application cutoff.',
        'Event times are timezone-unspecified. When `originalSourceUrl` is present, use the provider page to verify ambiguous deadlines.',
        'Warnings identify malformed catalog data.',
      ].join(' '),
      inputSchema: {
        id: z.string().describe('The opportunity ID'),
        source: sourceEnum.describe('Which source the opportunity belongs to'),
      },
      outputSchema: {
        source: sourceObjectSchema,
        status: z.enum(['success', 'error']),
        opportunity: opportunityDetailObjectSchema.nullable(),
        error: z.string().nullable(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id, source }: GetOpportunityToolInput) => {
      const client = byName.get(source)!;
      try {
        const opp = await client.getOpportunity(id);
        return {
          content: [],
          structuredContent: {
            source: sourceValue(client),
            status: 'success' as const,
            opportunity: opportunityDetail(opp, client),
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
