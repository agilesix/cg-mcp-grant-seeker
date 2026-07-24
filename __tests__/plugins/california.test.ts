import { describe, expect, it } from 'vitest';
import { CaliforniaPlugin } from '../../src/plugins/california.js';

const opportunity = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'California opportunity',
  status: { value: 'open' },
  description: 'A representative opportunity.',
  funding: {},
  keyDates: {},
  acceptedApplicantTypes: [],
  source: 'https://example.ca.gov/opportunity/ca-1',
  customFields: {
    agency: {
      name: 'agency',
      fieldType: 'object',
      value: {
        code: null,
        name: 'California Agency',
        parentName: null,
        parentCode: null,
        futureAgencyField: 'preserved',
      },
    },
    caCategories: {
      name: 'caCategories',
      fieldType: 'array',
      value: ['Environment & Water'],
    },
    caLoi: {
      name: 'caLoi',
      fieldType: 'boolean',
      value: true,
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

describe('CaliforniaPlugin', () => {
  it('types known California fields and preserves unregistered fields', () => {
    const parsed = CaliforniaPlugin.schemas.Opportunity.commonSchema.parse(opportunity);

    expect(parsed.customFields?.agency?.value.name).toBe('California Agency');
    expect(parsed.customFields?.agency?.value.futureAgencyField).toBe('preserved');
    expect(parsed.customFields?.caCategories?.value).toEqual(['Environment & Water']);
    expect(parsed.customFields?.caLoi?.value).toBe(true);
    expect(parsed.customFields?.unregisteredField?.value).toBe('preserved');
    expect(parsed.customFields).toEqual(opportunity.customFields);
  });

  it('rejects malformed registered California fields', () => {
    const malformed = structuredClone(opportunity);
    malformed.customFields.caLoi.value = 'yes' as unknown as boolean;

    expect(() => CaliforniaPlugin.schemas.Opportunity.commonSchema.parse(malformed)).toThrow();
  });
});
