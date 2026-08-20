import { describe, expect, it } from 'vitest';
import { MarylandPlugin } from '../../src/plugins/maryland.js';

const opportunity = {
  id: '44444444-4444-4444-8444-444444444444',
  title: 'Maryland opportunity',
  status: { value: 'open' },
  description: 'A representative opportunity.',
  funding: {},
  keyDates: {},
  acceptedApplicantTypes: [],
  source: 'https://compass.maryland.gov/incentives/example/',
  customFields: {
    agency: {
      name: 'agency',
      fieldType: 'object',
      value: {
        code: null,
        name: 'Maryland Agency',
        parentName: null,
        parentCode: null,
        futureAgencyField: 'preserved',
      },
    },
    eligibilityCriteria: {
      name: 'eligibilityCriteria',
      fieldType: 'object',
      value: {
        beneficiaryTypes: [{ code: 'small-business', name: 'Small businesses' }],
        details: 'Must operate in Maryland.',
      },
    },
    mdAcceptingApplications: {
      name: 'mdAcceptingApplications',
      fieldType: 'boolean',
      value: true,
    },
    mdEligibleCounties: {
      name: 'mdEligibleCounties',
      fieldType: 'array',
      value: ['Allegany', 'Garrett'],
    },
    unregisteredField: {
      name: 'unregisteredField',
      fieldType: 'string',
      value: 'preserved',
    },
  },
  createdAt: '2026-08-20T12:00:00Z',
  lastModifiedAt: '2026-08-20T12:00:00Z',
};

describe('MarylandPlugin', () => {
  it('types known Maryland fields and preserves unregistered fields', () => {
    const parsed = MarylandPlugin.schemas.Opportunity.commonSchema.parse(opportunity);

    expect(parsed.customFields?.agency?.value.name).toBe('Maryland Agency');
    expect(parsed.customFields?.agency?.value.futureAgencyField).toBe('preserved');
    expect(parsed.customFields?.mdAcceptingApplications?.value).toBe(true);
    expect(parsed.customFields?.mdEligibleCounties?.value).toEqual(['Allegany', 'Garrett']);
    expect(parsed.customFields?.unregisteredField?.value).toBe('preserved');
    expect(parsed.customFields).toEqual(opportunity.customFields);
  });

  it('rejects malformed registered Maryland fields', () => {
    const malformed = structuredClone(opportunity);
    malformed.customFields.mdAcceptingApplications.value = 'yes' as unknown as boolean;

    expect(() => MarylandPlugin.schemas.Opportunity.commonSchema.parse(malformed)).toThrow();
  });
});
