import { z } from 'zod3';
import type { ICommonGrantsClient, SearchParams, SearchResult } from '../types.js';
import { wireOpportunity } from '../wire.js';
import { createSearchInputSchema, createGetInputSchema } from './contracts.js';
import type { SearchOutcome, Source } from './contracts.js';
import { createPresentShortlistInputSchema, assembleShortlist } from './shortlist.js';
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function sourceValue(client: ICommonGrantsClient): Source {
  return { name: client.name, label: client.label };
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

export function createGrantService(clients: ICommonGrantsClient[]) {
  if (clients.length === 0)
    throw new Error('Grant service requires at least one configured source.');
  const byName = new Map(clients.map((c) => [c.name, c]));
  if (byName.size !== clients.length) throw new Error('Grant source names must be unique.');
  const names = clients.map((c) => c.name) as [string, ...string[]];
  const schemas = {
    search: createSearchInputSchema(names),
    get: createGetInputSchema(names),
    shortlist: z.object(createPresentShortlistInputSchema(names)),
  };
  return {
    schemas,
    listSources: () => ({ sources: clients.map(sourceValue) }),
    /** Website collection search, before local filtering/sorting/pagination.
     * Separate from the MCP search contract: no default status restriction.
     */
    async searchCollection(input: {
      source: string;
      query?: string;
      statuses?: ('open' | 'forecasted' | 'closed' | 'custom')[];
      pageSize?: number;
    }) {
      const params = z
        .object({
          source: z.enum(names),
          query: z.string().optional(),
          statuses: z.array(z.enum(['open', 'forecasted', 'closed', 'custom'])).optional(),
          pageSize: z.number().int().min(1).max(100).default(100),
        })
        .parse(input);
      const result = await byName.get(params.source)!.searchOpportunities({
        query: params.query,
        statuses: params.statuses,
        pageSize: params.pageSize,
        maxItems: 1000,
      });
      // Errors propagate so callers do not mistake an unavailable source for no results.
      return { items: result.items.slice(0, 1000).map(wireOpportunity) };
    },
    async search(input: z.input<typeof schemas.search>) {
      const { query, statuses, source, page, limit } = schemas.search.parse(input);
      const targets = source ? [byName.get(source)!] : clients;
      const params: SearchParams = { query, statuses, page, pageSize: limit };
      return { sources: await Promise.all(targets.map((client) => searchOne(client, params))) };
    },
    async getOpportunity(input: z.input<typeof schemas.get>) {
      const { id, source } = schemas.get.parse(input);
      const client = byName.get(source)!;
      try {
        const opp = await client.getOpportunity(id);
        return {
          source: sourceValue(client),
          status: 'success' as const,
          opportunity: wireOpportunity(opp),
          error: null,
        };
      } catch (err) {
        const message = errorMessage(err);
        return {
          source: sourceValue(client),
          status: 'error' as const,
          opportunity: null,
          error: message,
        };
      }
    },
    async assembleShortlist(input: z.input<typeof schemas.shortlist>) {
      return assembleShortlist(schemas.shortlist.parse(input), clients);
    },
  };
}
export type GrantService = ReturnType<typeof createGrantService>;
