import {
  DateRangeEventSchema,
  OpportunityBaseSchema,
  OppTimelineSchema,
  OtherEventSchema,
  SingleDateEventSchema,
} from '@common-grants/sdk/schemas';
import { z } from 'zod3';
import type { ICommonGrantsClient } from './types.js';

const wireDateSchema = z.string().date();
const wireTimeSchema = z
  .string()
  .regex(
    /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?$/,
    'Must be a timezone-unspecified time in HH:MM:SS[.fraction] format',
  );
const wireTimestampSchema = z.string().datetime().regex(/Z$/, 'Must be a UTC timestamp');

const singleDateEventWireSchema = SingleDateEventSchema.extend({
  date: wireDateSchema,
  time: wireTimeSchema.nullish(),
});

const dateRangeEventWireSchema = DateRangeEventSchema.extend({
  startDate: wireDateSchema,
  startTime: wireTimeSchema.nullish(),
  endDate: wireDateSchema,
  endTime: wireTimeSchema.nullish(),
});

const eventWireSchema = z.union([
  singleDateEventWireSchema,
  dateRangeEventWireSchema,
  OtherEventSchema,
]);

const timelineWireSchema = OppTimelineSchema.extend({
  postDate: eventWireSchema.nullish(),
  closeDate: eventWireSchema.nullish(),
  otherDates: z.record(eventWireSchema).nullish(),
});

/**
 * The transform-free JSON contract advertised by MCP opportunity outputs.
 *
 * The SDK schema parses protocol strings into richer JavaScript values. This
 * schema composes the same model after those values have been serialized at the
 * MCP boundary.
 */
export const OpportunityWireSchema = OpportunityBaseSchema.extend({
  keyDates: timelineWireSchema.nullish(),
  createdAt: wireTimestampSchema,
  lastModifiedAt: wireTimestampSchema,
});

export type WireOpportunity = z.output<typeof OpportunityWireSchema>;

export function wireOpportunity(
  opportunity: Awaited<ReturnType<ICommonGrantsClient['getOpportunity']>>,
): WireOpportunity {
  const serialized = JSON.parse(JSON.stringify(opportunity)) as unknown;
  return OpportunityWireSchema.parse(serialized);
}
