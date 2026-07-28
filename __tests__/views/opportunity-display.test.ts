import { describe, expect, it } from 'vitest';
import type { WireOpportunity } from '../../src/core/tools.js';
import {
  buildOpportunityDetailModel,
  safeDescriptionText,
} from '../../src/views/opportunity-display.js';

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

describe('opportunity detail presentation model', () => {
  it('builds a rich detail view from standard and recognized plugin fields', () => {
    const model = buildOpportunityDetailModel(
      opportunity({
        description: '<p><strong>Build safer streets</strong>&nbsp;and improve transit access.</p>',
        funding: {
          totalAmountAvailable: { amount: '100000000', currency: 'USD' },
          minAwardAmount: { amount: '1000000', currency: 'USD' },
          maxAwardAmount: { amount: '65000000', currency: 'USD' },
        },
        keyDates: {
          postDate: { eventType: 'singleDate', name: 'Open date', date: '2026-07-13' },
          closeDate: { eventType: 'other', name: 'Close date', details: 'Continuous' },
          otherDates: {
            expectedAwardDate: {
              eventType: 'other',
              name: 'Expected award',
              details: 'Continuous',
            },
          },
        },
        acceptedApplicantTypes: [
          { value: 'custom', customValue: 'Public agency' },
          { value: 'government_local' },
        ],
        customFields: {
          agency: {
            name: 'agency',
            fieldType: 'object',
            value: { name: 'State Infrastructure Bank' },
          },
          contactInfo: {
            name: 'contactInfo',
            fieldType: 'object',
            value: { email: 'grants@example.gov', phone: '555-0100' },
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
          caCategories: {
            name: 'caCategories',
            fieldType: 'array',
            value: ['Infrastructure', 'Transit'],
          },
          caGeography: {
            name: 'caGeography',
            fieldType: 'string',
            value: 'California',
          },
          caLoi: {
            name: 'caLoi',
            fieldType: 'boolean',
            value: false,
          },
        },
      }),
      'California',
    );

    expect(model.agency).toBe('State Infrastructure Bank');
    expect(model.description).toBe('Build safer streets and improve transit access.');
    expect(model.facts).toEqual(
      expect.arrayContaining([
        { label: 'Award range', value: '$1,000,000 – $65,000,000' },
        { label: 'Close date', value: 'Continuous' },
        { label: 'Source', value: 'California' },
      ]),
    );
    expect(model.applicantTypes).toEqual(['Public Agency', 'Government Local']);
    expect(model.funding).toEqual(
      expect.arrayContaining([
        { label: 'Funding type', value: 'Loan' },
        { label: 'Cost sharing', value: 'Not required' },
      ]),
    );
    expect(model.contact).toHaveLength(2);
    expect(model.additionalDetails).toEqual(
      expect.arrayContaining([
        { label: 'Geography', value: 'California' },
        { label: 'Program categories', value: 'Infrastructure, Transit' },
        { label: 'Letter of intent', value: 'Not required' },
      ]),
    );
    expect(model.hasDecisionDetails).toBe(true);
    expect(model.showDeadlineNote).toBe(true);
  });

  it('omits unavailable medium-data sections without inventing values', () => {
    const model = buildOpportunityDetailModel(
      opportunity({
        description: 'Supports community-based workforce programs.',
        keyDates: {
          postDate: { eventType: 'singleDate', name: 'Posted', date: '2026-07-01' },
          closeDate: null,
          otherDates: {},
        },
        acceptedApplicantTypes: [{ value: 'nonprofit' }],
      }),
      'Federal (Simpler.Grants.gov)',
    );

    expect(model.facts).toEqual([
      { label: 'Posted', value: 'Jul 1, 2026' },
      { label: 'Source', value: 'Federal (Simpler.Grants.gov)' },
    ]);
    expect(model.applicantTypes).toEqual(['Nonprofit']);
    expect(model.funding).toEqual([]);
    expect(model.contact).toEqual([]);
    expect(model.additionalDetails).toEqual([]);
    expect(model.showDeadlineNote).toBe(false);
    expect(model.hasDecisionDetails).toBe(true);
  });

  it('produces a compact sparse state anchored by the source', () => {
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
      additionalDetails: [],
      hasDecisionDetails: false,
      showDeadlineNote: false,
    });
  });

  it('converts provider HTML to readable text instead of rendering markup', () => {
    expect(
      safeDescriptionText(
        '<p><strong>Project background</strong>&nbsp;</p><script>alert("ignore")</script><p>Serve &amp; support youth.</p>',
      ),
    ).toBe('Project background Serve & support youth.');
  });
});
