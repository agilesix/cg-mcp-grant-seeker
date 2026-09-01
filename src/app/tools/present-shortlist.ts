import { z } from 'zod3';
import type { ICommonGrantsClient } from '../../core/types.js';
import { OpportunityWireSchema, wireOpportunity } from '../../core/wire.js';
import type { WireOpportunity } from '../../core/wire.js';

const ERROR_CODES = ['timeout', 'not_found', 'unavailable'] as const;
const DEFAULT_BATCH_SIZE = 4;
const DEFAULT_BATCH_TIMEOUT_MS = 8_000;

const sourceSchema = z.object({
  name: z.string(),
  label: z.string(),
});

const itemErrorSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
});

const shortlistItemSchema = z.object({
  rank: z.number().int().positive(),
  source: sourceSchema,
  id: z.string(),
  status: z.enum(['success', 'error']),
  opportunity: OpportunityWireSchema.nullable(),
  providerPageUrl: z.string().url().nullable(),
  error: itemErrorSchema.nullable(),
});

const researchContextSchema = z.object({
  provenance: z.literal('assistant_supplied'),
  searchCount: z.number().int().nonnegative().nullable(),
  queries: z.array(z.string()),
  filters: z.array(z.string()),
  sort: z.string().nullable(),
});

export const PRESENT_SHORTLIST_TOOL_NAME = 'present_opportunity_shortlist';

export const presentShortlistOutputSchema = {
  presentationId: z.string().uuid(),
  items: z.array(shortlistItemSchema),
  researchContext: researchContextSchema,
};

export function createPresentShortlistInputSchema(sourceNames: [string, ...string[]]) {
  return {
    opportunities: z
      .array(
        z.object({
          id: z.string().describe('The source-scoped opportunity ID'),
          source: z.enum(sourceNames).describe('Which source the opportunity belongs to'),
        }),
      )
      .min(1)
      .max(8)
      .describe(
        'Final unique candidates in display order. When researchContext.sort is provided, this order must match it.',
      ),
    researchContext: z
      .object({
        searchCount: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe('Assistant-reported number of research searches'),
        queries: z
          .array(z.string().max(200))
          .max(20)
          .optional()
          .describe('Assistant-reported full-text query terms, in research order'),
        filters: z
          .array(z.string().max(160))
          .max(12)
          .optional()
          .describe(
            'Plain-language criteria actually applied to the final shortlist, such as "Open opportunities" or "Posted in the last 7 days"',
          ),
        sort: z
          .string()
          .max(160)
          .optional()
          .describe(
            'Plain-language ordering actually applied to the final shortlist, such as "Nearest close date first"',
          ),
      })
      .optional(),
  };
}

type PresentShortlistInputObject = z.ZodObject<
  ReturnType<typeof createPresentShortlistInputSchema>
>;
export type PresentShortlistInput = z.output<PresentShortlistInputObject>;
export type ShortlistReference = PresentShortlistInput['opportunities'][number];

export interface ShortlistItemError {
  code: (typeof ERROR_CODES)[number];
  message: string;
}

export interface Source {
  name: string;
  label: string;
}

export interface ShortlistItem {
  rank: number;
  source: Source;
  id: string;
  status: 'success' | 'error';
  opportunity: WireOpportunity | null;
  providerPageUrl: string | null;
  error: ShortlistItemError | null;
}

export interface PresentShortlistOutput {
  presentationId: string;
  items: ShortlistItem[];
  researchContext: {
    provenance: 'assistant_supplied';
    searchCount: number | null;
    queries: string[];
    filters: string[];
    sort: string | null;
  };
}

export const presentShortlistDefinition = {
  title: 'Present grant opportunity shortlist',
  description: [
    'After completed grant research produces one or more recommended opportunities, call this tool automatically to present the final ranked shortlist.',
    'Call it as soon as the current search results provide enough relevant candidates.',
    'For a non-exhaustive request, five or more clearly relevant candidates are ordinarily enough to present.',
    'Do not delay presentation for additional searches that are unlikely to materially improve relevance or coverage.',
    'Search results preserve provider fields needed for ranking, and this tool retrieves every selected opportunity in full.',
    'Do not call get_opportunity for each candidate before this tool unless a search result is missing information required for selection.',
    'Do not wait for the user to request the shortlist or offer it as a separate optional step.',
    'The host may ask the user for permission; that approval flow is sufficient and should not prevent the call.',
    'Call once per completed shortlist revision, not for intermediate searches.',
    'If this call is denied or fails, provide a concise plain-text shortlist instead.',
    'After a successful call, do not duplicate the full shortlist in prose.',
    'Include one to eight unique source-scoped references worth showing, in final display order.',
    'If research context is included, list each distinct full-text query term separately.',
    'Also report any filters and ordering actually applied to the final shortlist so the view can explain the selection.',
    'The server retrieves and preserves each complete SDK-validated opportunity.',
    'The attached view displays a concise subset without narrowing structuredContent.',
  ].join(' '),
  annotations: { readOnlyHint: true, openWorldHint: true },
};

function normalizedQueries(queries: string[] | undefined): string[] {
  const normalized = queries
    ?.map((query) =>
      query
        .trim()
        .replace(/^["“]|["”]$/g, '')
        .trim(),
    )
    .filter(Boolean);
  return [...new Set(normalized ?? [])].slice(0, 20);
}

function normalizedLabels(values: string[] | undefined, limit: number): string[] {
  const normalized = values?.map((value) => value.trim()).filter(Boolean);
  return [...new Set(normalized ?? [])].slice(0, limit);
}

function normalizedSort(sort: string | undefined): string | null {
  const normalized = sort?.trim();
  return normalized || null;
}

function sourceValue(client: ICommonGrantsClient): Source {
  return { name: client.name, label: client.label };
}

function safeError(client: ICommonGrantsClient, id: string, error: unknown): ShortlistItemError {
  const diagnostic = error instanceof Error ? error.message : String(error);
  console.error('Failed to retrieve shortlist opportunity', {
    source: client.name,
    id,
    error: diagnostic,
  });

  if (/\b404\b|not found/i.test(diagnostic)) {
    return {
      code: 'not_found',
      message: `This opportunity is no longer available from ${client.label}.`,
    };
  }
  return {
    code: 'unavailable',
    message: `This opportunity could not be loaded from ${client.label}.`,
  };
}

export function safeProviderPageUrl(
  opportunity: WireOpportunity,
  client: ICommonGrantsClient,
): string | null {
  const candidate =
    opportunity.source ??
    (client.opportunityPageBaseUrl
      ? new URL(encodeURIComponent(opportunity.id), client.opportunityPageBaseUrl).toString()
      : null);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    const localHttp =
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');
    return url.protocol === 'https:' || localHttp ? url.toString() : null;
  } catch {
    return null;
  }
}

async function retrieveOne(
  reference: ShortlistReference,
  rank: number,
  byName: Map<string, ICommonGrantsClient>,
): Promise<ShortlistItem> {
  const client = byName.get(reference.source);
  if (!client) {
    return {
      rank,
      source: { name: reference.source, label: reference.source },
      id: reference.id,
      status: 'error',
      opportunity: null,
      providerPageUrl: null,
      error: {
        code: 'unavailable',
        message: `The ${reference.source} source is not configured.`,
      },
    };
  }

  try {
    const opportunity = wireOpportunity(await client.getOpportunity(reference.id));
    return {
      rank,
      source: sourceValue(client),
      id: reference.id,
      status: 'success',
      opportunity,
      providerPageUrl: safeProviderPageUrl(opportunity, client),
      error: null,
    };
  } catch (error) {
    return {
      rank,
      source: sourceValue(client),
      id: reference.id,
      status: 'error',
      opportunity: null,
      providerPageUrl: null,
      error: safeError(client, reference.id, error),
    };
  }
}

async function retrieveBatch(
  references: Array<{ reference: ShortlistReference; rank: number }>,
  byName: Map<string, ICommonGrantsClient>,
  timeoutMs: number,
): Promise<ShortlistItem[]> {
  const timeoutMarker = Symbol('shortlist-timeout');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof timeoutMarker>((resolve) => {
    timer = setTimeout(() => resolve(timeoutMarker), timeoutMs);
  });
  const tasks = references.map(({ reference, rank }) => ({
    reference,
    rank,
    promise: retrieveOne(reference, rank, byName),
  }));

  const results = await Promise.all(
    tasks.map(async ({ reference, rank, promise }) => {
      const result = await Promise.race([promise, deadline]);
      if (result !== timeoutMarker) return result;

      const client = byName.get(reference.source);
      return {
        rank,
        source: client ? sourceValue(client) : { name: reference.source, label: reference.source },
        id: reference.id,
        status: 'error' as const,
        opportunity: null,
        providerPageUrl: null,
        error: {
          code: 'timeout' as const,
          message: `This opportunity took too long to load from ${
            client?.label ?? reference.source
          }.`,
        },
      };
    }),
  );

  if (timer) clearTimeout(timer);
  return results;
}

export async function presentOpportunityShortlist(
  input: PresentShortlistInput,
  clients: ICommonGrantsClient[],
  options: {
    batchSize?: number;
    batchTimeoutMs?: number;
    presentationId?: () => string;
  } = {},
): Promise<PresentShortlistOutput> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const batchTimeoutMs = options.batchTimeoutMs ?? DEFAULT_BATCH_TIMEOUT_MS;
  const byName = new Map(clients.map((client) => [client.name, client]));
  const uniqueReferences = [
    ...new Map(
      input.opportunities.map((reference) => [`${reference.source}:${reference.id}`, reference]),
    ).values(),
  ].slice(0, 8);
  const ranked = uniqueReferences.map((reference, index) => ({ reference, rank: index + 1 }));
  const items: ShortlistItem[] = [];

  for (let index = 0; index < ranked.length; index += batchSize) {
    items.push(
      ...(await retrieveBatch(ranked.slice(index, index + batchSize), byName, batchTimeoutMs)),
    );
  }

  return {
    presentationId: options.presentationId?.() ?? crypto.randomUUID(),
    items,
    researchContext: {
      provenance: 'assistant_supplied',
      searchCount: input.researchContext?.searchCount ?? null,
      queries: normalizedQueries(input.researchContext?.queries),
      filters: normalizedLabels(input.researchContext?.filters, 12),
      sort: normalizedSort(input.researchContext?.sort),
    },
  };
}
