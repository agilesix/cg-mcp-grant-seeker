import { describe, expect, it } from 'vitest';
import {
  buildOpportunityDetailModel,
  safeDescriptionText,
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
});
