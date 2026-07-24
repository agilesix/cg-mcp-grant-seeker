import { describe, expect, it } from 'vitest';
import { classifyFilters, F } from '@common-grants/sdk/extensions';
import { FederalPlugin } from '../../src/plugins/federal.js';

const opportunity = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Federal opportunity',
  status: { value: 'open' },
  description: 'A representative opportunity.',
  funding: {},
  keyDates: {},
  acceptedApplicantTypes: [],
  source: 'https://simpler.grants.gov/opportunity/federal-1',
  customFields: {
    federalOpportunityNumber: {
      name: 'federalOpportunityNumber',
      fieldType: 'string',
      value: 'HHS-2026-TEST',
    },
    agency: {
      name: 'agency',
      fieldType: 'object',
      value: {
        code: 'HHS',
        name: 'Department of Health and Human Services',
        parentName: null,
        parentCode: null,
        futureAgencyField: 'preserved',
      },
    },
    assistanceListings: {
      name: 'assistanceListings',
      fieldType: 'array',
      value: [
        {
          identifier: '93.000',
          programTitle: 'Example Program',
          futureListingField: 'preserved',
        },
      ],
    },
    attachments: {
      name: 'attachments',
      fieldType: 'array',
      value: [
        {
          downloadUrl: 'https://simpler.grants.gov/files/nofo.pdf',
          name: 'NOFO.pdf',
          description: null,
          sizeInBytes: 1024,
          mimeType: 'application/pdf',
          createdAt: '2026-07-24T12:00:00+00:00',
          lastModifiedAt: '2026-07-24T12:00:00.123456+00:00',
        },
      ],
    },
    costSharing: {
      name: 'costSharing',
      fieldType: 'object',
      value: {
        isRequired: false,
        futureCostSharingField: 'preserved',
      },
    },
    unregisteredField: {
      name: 'unregisteredField',
      fieldType: 'string',
      value: 'preserved',
    },
  },
  createdAt: '2026-07-24T12:00:00Z',
  lastModifiedAt: '2026-07-24T12:00:00Z',
};

describe('FederalPlugin', () => {
  it('registers the complete federal custom-field contract', () => {
    expect(Object.keys(FederalPlugin.schemas.Opportunity.customFields ?? {}).sort()).toEqual([
      'additionalInfo',
      'agency',
      'assistanceListings',
      'attachments',
      'contactInfo',
      'costSharing',
      'federalFundingSource',
      'federalOpportunityNumber',
      'fiscalYear',
      'forecastedCloseDate',
      'forecastedPostDate',
      'fundingCategories',
      'fundingInstruments',
      'legacySerialId',
      'sourceCreatedAt',
      'sourceUpdatedAt',
      'summaryCreatedAt',
      'summaryUpdatedAt',
    ]);
  });

  it('types known federal fields and preserves unregistered and nested fields', () => {
    const parsed = FederalPlugin.schemas.Opportunity.commonSchema.parse(opportunity);

    expect(parsed.customFields?.federalOpportunityNumber?.value).toBe('HHS-2026-TEST');
    expect(parsed.customFields?.agency?.value.futureAgencyField).toBe('preserved');
    expect(parsed.customFields?.assistanceListings?.value[0]?.futureListingField).toBe('preserved');
    expect(parsed.customFields?.attachments?.value[0]?.name).toBe('NOFO.pdf');
    expect(parsed.customFields?.costSharing?.value.futureCostSharingField).toBe('preserved');
    expect(parsed.customFields?.unregisteredField?.value).toBe('preserved');
    expect(parsed.customFields).toEqual(opportunity.customFields);
  });

  it('rejects malformed registered federal fields', () => {
    const malformed = structuredClone(opportunity);
    malformed.customFields.costSharing.value.isRequired = 'no' as unknown as boolean;

    expect(() => FederalPlugin.schemas.Opportunity.commonSchema.parse(malformed)).toThrow();
  });

  it('classifies the federal search filters declared by the source adapter', () => {
    const classified = classifyFilters(FederalPlugin.routes!, 'opportunities', 'search', {
      agency: F.in(['HHS']),
      applicantType: F.in(['non_profit_with_501c3']),
      fundingInstrument: F.in(['grant']),
      costSharing: F.eq(false),
      closeDateRange: F.between('2026-07-24', '2026-08-24'),
    });

    expect(classified).toEqual({
      closeDateRange: {
        operator: 'between',
        value: { min: '2026-07-24', max: '2026-08-24' },
      },
      customFilters: {
        agency: { operator: 'in', value: ['HHS'] },
        applicantType: { operator: 'in', value: ['non_profit_with_501c3'] },
        fundingInstrument: { operator: 'in', value: ['grant'] },
        costSharing: { operator: 'eq', value: false },
      },
    });
  });
});
