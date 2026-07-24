import { describe, expect, it } from 'vitest';
import { PennsylvaniaPlugin } from '../../src/plugins/pennsylvania.js';

const opportunity = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Pennsylvania opportunity',
  status: { value: 'open' },
  description: 'A representative opportunity.',
  funding: {},
  keyDates: {},
  acceptedApplicantTypes: [],
  source: 'https://example.pa.gov/opportunity/pa-1',
  customFields: {
    agency: {
      name: 'agency',
      fieldType: 'object',
      value: {
        code: null,
        name: 'Pennsylvania Agency',
        parentName: null,
        parentCode: null,
        futureAgencyField: 'preserved',
      },
    },
    paProcessSteps: {
      name: 'paProcessSteps',
      fieldType: 'array',
      value: [
        {
          stepNumber: 1,
          description: '<p>Apply online.</p>',
          futureStepField: 'preserved',
        },
      ],
    },
    paFaqs: {
      name: 'paFaqs',
      fieldType: 'array',
      value: [{ question: 'Who can apply?', answer: 'Eligible organizations.' }],
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

describe('PennsylvaniaPlugin', () => {
  it('types known Pennsylvania fields and preserves unregistered fields', () => {
    const parsed = PennsylvaniaPlugin.schemas.Opportunity.commonSchema.parse(opportunity);

    expect(parsed.customFields?.agency?.value.name).toBe('Pennsylvania Agency');
    expect(parsed.customFields?.agency?.value.futureAgencyField).toBe('preserved');
    expect(parsed.customFields?.paProcessSteps?.value[0]?.stepNumber).toBe(1);
    expect(parsed.customFields?.paProcessSteps?.value[0]?.futureStepField).toBe('preserved');
    expect(parsed.customFields?.paFaqs?.value[0]?.question).toBe('Who can apply?');
    expect(parsed.customFields?.unregisteredField?.value).toBe('preserved');
    expect(parsed.customFields).toEqual(opportunity.customFields);
  });

  it('rejects malformed registered Pennsylvania fields', () => {
    const malformed = structuredClone(opportunity);
    malformed.customFields.paProcessSteps.value[0]!.stepNumber = 1.5;

    expect(() => PennsylvaniaPlugin.schemas.Opportunity.commonSchema.parse(malformed)).toThrow();
  });
});
