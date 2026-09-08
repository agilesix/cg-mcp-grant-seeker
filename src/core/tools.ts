import { z } from 'zod3';
import type { ICommonGrantsClient } from './types.js';
import { OpportunityWireSchema } from './wire.js';

import { createGrantService } from './service/grants.js';
import { sourceObjectSchema, searchResultSchema } from './service/contracts.js';
type CoreToolDefinition<TInputSchema extends z.ZodRawShape> = Record<string, unknown> & {
  inputSchema: TInputSchema;
};

/**
 * The only server capability required by the CommonGrants tools. The input
 * schema and handler argument remain linked so adapter casts cannot hide a
 * contract mismatch.
 */
export type CoreToolRegistrar = <TInputSchema extends z.ZodRawShape>(
  name: string,
  definition: CoreToolDefinition<TInputSchema>,
  handler: (input: z.output<z.ZodObject<TInputSchema>>) => Promise<unknown>,
) => void;

/**
 * Registers all grant tools on an McpServer. The set of sources is data-driven:
 * adding a source to the registry automatically extends the `source` argument
 * on every tool and the fan-out behavior of search.
 *
 * Tool annotations (readOnlyHint, openWorldHint) are required by the Claude
 * Connectors Directory and the OpenAI Apps SDK — do not drop them.
 */
export function registerTools(
  registerTool: CoreToolRegistrar,
  clients: ICommonGrantsClient[],
): void {
  if (clients.length === 0) {
    throw new Error('registerTools requires at least one configured source.');
  }

  const service = createGrantService(clients);

  registerTool(
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
      const structuredContent = { sources: service.listSources().sources };
      return {
        content: [],
        structuredContent,
      };
    },
  );

  registerTool(
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
      inputSchema: service.schemas.search.shape,
      outputSchema: {
        sources: z.array(searchResultSchema),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      const structuredContent = await service.search(input);
      const results = structuredContent.sources;
      return {
        content: [],
        structuredContent,
        isError: results.every(({ status }) => status === 'error'),
      };
    },
  );

  registerTool(
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
      inputSchema: service.schemas.get.shape,
      outputSchema: {
        source: sourceObjectSchema,
        status: z.enum(['success', 'error']),
        opportunity: OpportunityWireSchema.nullable(),
        error: z.string().nullable(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (input) => {
      const structuredContent = await service.getOpportunity(input);
      return {
        content: [],
        structuredContent,
        ...(structuredContent.status === 'error' ? { isError: true } : {}),
      };
    },
  );
}
