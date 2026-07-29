import { OpportunityBaseSchema } from '@common-grants/sdk/schemas';
import { describe, expect, it } from 'vitest';
import { OpportunityWireSchema, wireOpportunity } from '../../src/core/wire.js';
import type { Opportunity } from '../../src/core/types.js';

const parsedOpportunity = OpportunityBaseSchema.parse({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Wire contract grant',
  status: { value: 'open' },
  description: 'Exercises every transformed event branch.',
  keyDates: {
    postDate: {
      eventType: 'singleDate',
      name: 'Posted',
      date: '2026-07-01',
      time: null,
    },
    closeDate: {
      eventType: 'dateRange',
      name: 'Window',
      startDate: '2026-08-01',
      startTime: null,
      endDate: '2026-08-31',
      endTime: '12:00:00.500',
    },
    otherDates: {
      questions: {
        eventType: 'singleDate',
        name: 'Questions',
        date: '2026-07-15',
      },
      recurring: {
        eventType: 'other',
        name: 'Office hours',
        details: 'Every Tuesday',
      },
    },
  },
  customFields: {
    metadata: {
      name: 'metadata',
      fieldType: 'object',
      value: {
        nested: [{ code: 'A', enabled: true }],
        count: 2,
      },
    },
  },
  createdAt: '2026-06-01T12:00:00Z',
  lastModifiedAt: '2026-07-01T12:30:00Z',
}) as Opportunity;

describe('OpportunityWireSchema', () => {
  it('validates serialized SDK output without transforming or filtering it', () => {
    const serialized = JSON.parse(JSON.stringify(parsedOpportunity));

    expect(OpportunityWireSchema.parse(serialized)).toEqual(serialized);
    expect(wireOpportunity(parsedOpportunity)).toEqual(serialized);
  });

  it('rejects timezone-bearing post-parse times', () => {
    const serialized = JSON.parse(JSON.stringify(parsedOpportunity));
    serialized.keyDates.closeDate.endTime = '12:00:00Z';

    expect(OpportunityWireSchema.safeParse(serialized).success).toBe(false);
  });
});
