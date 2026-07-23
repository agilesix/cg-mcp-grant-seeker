import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatOpportunityDetail, formatOpportunitySummary } from './format.js';
import type { ICommonGrantsClient, Opportunity, SearchParams } from './types.js';

/** The base CommonGrants opportunity statuses (see {@link OpportunityStatus}). */
const STATUS_VALUES = ['open', 'forecasted', 'closed', 'custom'] as const;

const sourceSchema = {
  name: z.string(),
  label: z.string(),
};

const moneySchema = z
  .object({
    amount: z.string(),
    currency: z.string().nullable(),
  })
  .nullable();

const eventSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('singleDate'), date: z.string() }),
    z.object({
      type: z.literal('dateRange'),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
    }),
  ])
  .nullable();

const opportunitySummarySchema = {
  source: z.object(sourceSchema),
  id: z.string(),
  title: z.string().nullable(),
  status: z.string().nullable(),
  maxAward: moneySchema,
  closeDate: eventSchema,
};

const opportunityDetailSchema = {
  ...opportunitySummarySchema,
  description: z.string().nullable(),
  minAward: moneySchema,
  postDate: eventSchema,
};

type Source = z.infer<z.ZodObject<typeof sourceSchema>>;
type OpportunitySummary = z.infer<z.ZodObject<typeof opportunitySummarySchema>>;
type OpportunityDetail = z.infer<z.ZodObject<typeof opportunityDetailSchema>>;

interface SearchOutcome {
  source: Source;
  status: 'success' | 'empty' | 'error';
  returned: number;
  total: number | null;
  opportunities: OpportunitySummary[];
  error: string | null;
  text: string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
    return date ? { type: 'singleDate' as const, date } : null;
  }
  if (event.eventType === 'dateRange') {
    return {
      type: 'dateRange' as const,
      startDate: dateValue(event.startDate),
      endDate: dateValue(event.endDate),
    };
  }
  return null;
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
  return {
    ...opportunitySummary(opportunity, client),
    description: opportunity.description ?? null,
    minAward: moneyValue(opportunity.funding?.minAwardAmount),
    postDate: eventValue(opportunity.keyDates?.postDate),
  };
}

async function searchOne(
  client: ICommonGrantsClient,
  params: SearchParams,
  limit: number,
): Promise<SearchOutcome> {
  try {
    const result = await client.searchOpportunities({ ...params, page: 1, pageSize: limit });
    const items = result.items ?? [];
    if (items.length === 0) {
      return {
        source: sourceValue(client),
        status: 'empty',
        returned: 0,
        total: result.paginationInfo?.totalItems ?? 0,
        opportunities: [],
        error: null,
        text: `**${client.label}**: no results`,
      };
    }
    const total = result.paginationInfo?.totalItems ?? items.length;
    const formatted = items.map((opp, i) => formatOpportunitySummary(opp, i)).join('\n\n');
    return {
      source: sourceValue(client),
      status: 'success',
      returned: items.length,
      total,
      opportunities: items.map((opportunity) => opportunitySummary(opportunity, client)),
      error: null,
      text: `**${client.label}** (showing ${items.length} of ${total})\n\n${formatted}`,
    };
  } catch (err) {
    const message = errorMessage(err);
    return {
      source: sourceValue(client),
      status: 'error',
      returned: 0,
      total: null,
      opportunities: [],
      error: message,
      text: `**${client.label}**: error — ${message}`,
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
      description: 'List the CommonGrants-compliant APIs this server can search.',
      inputSchema: {},
      outputSchema: {
        sources: z.array(z.object(sourceSchema)),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const structuredContent = { sources: clients.map(sourceValue) };
      return {
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
        structuredContent,
      };
    },
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
      outputSchema: {
        sources: z.array(
          z.object({
            source: z.object(sourceSchema),
            status: z.enum(['success', 'empty', 'error']),
            returned: z.number().int().nonnegative(),
            total: z.number().int().nonnegative().nullable(),
            opportunities: z.array(z.object(opportunitySummarySchema)),
            error: z.string().nullable(),
          }),
        ),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, statuses, source, limit }) => {
      const targets = source ? [byName.get(source)!] : clients;
      const params: SearchParams = { query, statuses };
      const results = await Promise.all(targets.map((client) => searchOne(client, params, limit)));
      const structuredContent = {
        sources: results.map(({ text: _text, ...result }) => result),
      };
      return {
        content: [{ type: 'text', text: results.map(({ text }) => text).join('\n\n---\n\n') }],
        structuredContent,
        isError: results.every(({ status }) => status === 'error'),
      };
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
      outputSchema: {
        source: z.object(sourceSchema),
        status: z.enum(['success', 'error']),
        opportunity: z.object(opportunityDetailSchema).nullable(),
        error: z.string().nullable(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ id, source }) => {
      const client = byName.get(source)!;
      try {
        const opp = await client.getOpportunity(id);
        return {
          content: [{ type: 'text', text: formatOpportunityDetail(opp, client.label) }],
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
          content: [
            {
              type: 'text',
              text: `${client.label}: could not retrieve ${id} — ${message}`,
            },
          ],
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
