import { describe, expect, it } from 'vitest';
import {
  buildOpportunityDetailModel,
  eventLabel,
  safeDescriptionText,
  statusLabel,
} from '../../src/app/models/opportunity-display.js';
import type { WireOpportunity } from '../../src/core/wire.js';

function opportunity(overrides: Partial<WireOpportunity> = {}): WireOpportunity {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Community Infrastructure Program',
    status: { value: 'open' },
    description: null,
    funding: null,
    keyDates: null,
    acceptedApplicantTypes: [],
    source: null,
    customFields: {},
    createdAt: null,
    lastModifiedAt: null,
    ...overrides,
  } as WireOpportunity;
}

describe('opportunity display model', () => {
  it('uses protocol fields and shared plugin fields without provider branching', () => {
    const model = buildOpportunityDetailModel(
      opportunity({
        description: '<p><strong>Build safer streets</strong>&nbsp;and improve access.</p>',
        funding: {
          totalAmountAvailable: { amount: '100000000', currency: 'USD' },
          minAwardAmount: { amount: '1000000', currency: 'USD' },
          maxAwardAmount: { amount: '65000000', currency: 'USD' },
        },
        keyDates: {
          postDate: { eventType: 'singleDate', name: 'Posted', date: '2026-07-13' },
          closeDate: { eventType: 'other', name: 'Close date', details: 'Continuous' },
          otherDates: {},
        },
        acceptedApplicantTypes: [{ value: 'government_municipal' }],
        customFields: {
          agency: {
            name: 'agency',
            fieldType: 'object',
            value: { name: 'State Infrastructure Bank' },
          },
          contactInfo: {
            name: 'contactInfo',
            fieldType: 'object',
            value: { email: 'grants@example.gov' },
          },
          costSharing: {
            name: 'costSharing',
            fieldType: 'object',
            value: { isRequired: false },
          },
          fundingInstrument: {
            name: 'fundingInstrument',
            fieldType: 'string',
            value: 'Loan',
          },
        },
      }),
      'Example source',
    );

    expect(model.agency).toBe('State Infrastructure Bank');
    expect(model.description).toBe('Build safer streets and improve access.');
    expect(model.applicantTypes).toEqual(['Government Municipal']);
    expect(model.funding).toEqual(
      expect.arrayContaining([
        { label: 'Funding type', value: 'Loan' },
        { label: 'Cost sharing', value: 'Not required' },
      ]),
    );
    expect(model.contact).toEqual([{ label: 'Email', value: 'grants@example.gov' }]);
  });

  it('omits missing sections and produces a clear sparse state', () => {
    const model = buildOpportunityDetailModel(opportunity(), 'Pennsylvania');

    expect(model).toMatchObject({
      agency: 'Pennsylvania',
      applicantTypes: [],
      contact: [],
      dates: [],
      description: null,
      eligibilityNotes: null,
      facts: [{ label: 'Source', value: 'Pennsylvania' }],
      funding: [],
      hasDecisionDetails: false,
      showDeadlineNote: false,
    });
  });

  it('turns source HTML into text and removes active content', () => {
    expect(
      safeDescriptionText(
        '<p>Project background&nbsp;</p><script>alert("ignore")</script><p>Serve &amp; support.</p>',
      ),
    ).toBe('Project background Serve & support.');
  });

  it('uses explanatory protocol status labels and preserves custom statuses', () => {
    expect(statusLabel({ value: 'open' })).toBe('Open for applications');
    expect(statusLabel({ value: 'forecasted' })).toBe('Forecasted: not yet open');
    expect(statusLabel({ value: 'closed' })).toBe('Closed to applications');
    expect(statusLabel({ value: 'custom', customValue: 'Accepting letters of intent' })).toBe(
      'Accepting letters of intent',
    );
    expect(statusLabel({ value: 'custom' })).toBe('Status provided by source');
  });

  it('uses source event names while keeping date labels date-only', () => {
    const model = buildOpportunityDetailModel(
      opportunity({
        keyDates: {
          postDate: {
            eventType: 'singleDate',
            name: 'Published by agency',
            date: '2026-07-13',
            time: '09:30:00',
            description: 'Public notice published',
          },
          closeDate: {
            eventType: 'dateRange',
            name: 'Application window',
            startDate: '2026-08-01',
            startTime: '00:00:00',
            endDate: '2026-08-31',
            endTime: '17:30:00',
          },
          otherDates: {},
        },
      }),
      'Example source',
    );

    expect(model.dates).toEqual([
      {
        label: 'Published by agency',
        value: 'Jul 13, 2026 · Public notice published',
      },
      {
        label: 'Application window',
        value: 'Aug 1, 2026 to Aug 31, 2026',
      },
    ]);
  });

  it('falls back to neutral date labels and supports descriptive events', () => {
    const model = buildOpportunityDetailModel(
      opportunity({
        keyDates: {
          postDate: { eventType: 'singleDate', name: '', date: '2026-07-13' },
          closeDate: {
            eventType: 'other',
            name: '',
            details: 'Applications accepted continuously',
          },
          otherDates: {},
        },
      }),
      'Example source',
    );

    expect(model.dates).toEqual([
      { label: 'Posted date', value: 'Jul 13, 2026' },
      { label: 'Closing date', value: 'Applications accepted continuously' },
    ]);
    expect(eventLabel({ eventType: 'other', name: 'Application deadline' })).toBeNull();
    expect(eventLabel(null)).toBeNull();
  });

  it.each([
    ['Federal', 'Opportunity Posted', 'Application Deadline'],
    ['Pennsylvania', 'Open Date', 'Close Date'],
    ['California', 'Open Date', 'Application Deadline'],
    ['Washington', 'Published', 'Application closes'],
  ])('preserves %s provider event names', (source, postName, closeName) => {
    const model = buildOpportunityDetailModel(
      opportunity({
        keyDates: {
          postDate: { eventType: 'singleDate', name: postName, date: '2026-07-13' },
          closeDate: { eventType: 'singleDate', name: closeName, date: '2026-08-31' },
          otherDates: {},
        },
      }),
      source,
    );

    expect(model.dates.map(({ label }) => label)).toEqual([postName, closeName]);
  });
});
