import { z } from 'zod3';
import { OpportunityWireSchema } from '../wire.js';
/** The base CommonGrants opportunity statuses (see {@link OpportunityStatus}). */
const STATUS_VALUES = ['open', 'forecasted', 'closed', 'custom'] as const;

const sourceSchema = {
  name: z.string(),
  label: z.string(),
};

export const sourceObjectSchema = z.object(sourceSchema);

export const searchResultSchema = z.object({
  source: sourceObjectSchema,
  status: z.enum(['success', 'empty', 'error']),
  opportunities: z.array(OpportunityWireSchema),
  total: z.number().int().nonnegative().nullable(),
  page: z.number().int().positive(),
  hasNextPage: z.boolean().nullable(),
  nextPage: z.number().int().positive().nullable(),
  omittedInvalidRows: z.number().int().nonnegative(),
  error: z.string().nullable(),
});

export type SearchOutcome = z.input<typeof searchResultSchema>;
export type Source = z.infer<typeof sourceObjectSchema>;

export function createSearchInputSchema(sourceNames: [string, ...string[]]) {
  const sourceEnum = z.enum(sourceNames);
  return z.object({
    query: z.string().optional().describe("Full-text search query, e.g. 'workforce development'"),
    statuses: z
      .array(z.enum(STATUS_VALUES))
      .default(['open', 'forecasted'])
      .describe('Filter by opportunity status'),
    source: sourceEnum.optional().describe('Which source to query. Omit to search all.'),
    page: z.number().int().min(1).default(1).describe('1-based results page'),
    limit: z.number().int().min(1).max(25).default(5).describe('Requested page size per source'),
  });
}
export function createGetInputSchema(sourceNames: [string, ...string[]]) {
  return z.object({
    id: z.string().describe('The opportunity ID'),
    source: z.enum(sourceNames).describe('Which source the opportunity belongs to'),
  });
}
