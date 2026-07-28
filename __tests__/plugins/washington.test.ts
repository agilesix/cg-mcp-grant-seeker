import { describe, expect, it } from 'vitest';
import { WashingtonPlugin } from '../../src/plugins/washington.js';

const opportunity = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Washington opportunity',
  status: { value: 'open' },
  description: 'A representative opportunity.',
  funding: {},
  keyDates: {},
  acceptedApplicantTypes: [],
  source: 'https://fundhub.wa.gov/funding/example/',
  customFields: {
    agency: {
      name: 'agency',
      fieldType: 'object',
      value: {
        code: null,
        name: 'Washington Agency',
        parentName: null,
        parentCode: null,
        futureAgencyField: 'preserved',
      },
    },
    waFeatured: {
      name: 'waFeatured',
      fieldType: 'boolean',
      value: true,
    },
    waTaxonomies: {
      name: 'waTaxonomies',
      fieldType: 'object',
      value: {
        'funding-audience': ['Nonprofits'],
        'funding-sector': ['Housing'],
      },
    },
    unregisteredField: {
      name: 'unregisteredField',
      fieldType: 'string',
      value: 'preserved',
    },
  },
  createdAt: '2026-07-28T12:00:00Z',
  lastModifiedAt: '2026-07-28T12:00:00Z',
};

describe('WashingtonPlugin', () => {
  it('types known Washington fields and preserves unregistered fields', () => {
    const parsed = WashingtonPlugin.schemas.Opportunity.commonSchema.parse(opportunity);

    expect(parsed.customFields?.agency?.value.name).toBe('Washington Agency');
    expect(parsed.customFields?.agency?.value.futureAgencyField).toBe('preserved');
    expect(parsed.customFields?.waFeatured?.value).toBe(true);
    expect(parsed.customFields?.waTaxonomies?.value['funding-audience']).toEqual(['Nonprofits']);
    expect(parsed.customFields?.unregisteredField?.value).toBe('preserved');
    expect(parsed.customFields).toEqual(opportunity.customFields);
  });

  it('rejects malformed registered Washington fields', () => {
    const malformed = structuredClone(opportunity);
    malformed.customFields.waFeatured.value = 'yes' as unknown as boolean;

    expect(() => WashingtonPlugin.schemas.Opportunity.commonSchema.parse(malformed)).toThrow();
  });
});
