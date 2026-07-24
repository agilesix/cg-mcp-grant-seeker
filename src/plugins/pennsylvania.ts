import { definePlugin } from '@common-grants/sdk/extensions';
import { z } from 'zod/v3';

/*
 * Consumer-side subset of the Pennsylvania plugin contract.
 *
 * Source of truth:
 * https://github.com/agilesix/cg-api-pa/blob/main/src/adapter/plugin.ts
 *
 * The API plugin owns Pennsylvania's native schemas and transformations. This
 * MCP consumes normalized CommonGrants responses and needs only the custom
 * fields used to validate them.
 */

const AgencyValueSchema = z.object({
  code: z.string().nullish(),
  name: z.string().nullish(),
  parentName: z.string().nullish(),
  parentCode: z.string().nullish(),
});

const ContactInfoValueSchema = z.object({
  name: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  description: z.string().nullish(),
});

const AdditionalInfoValueSchema = z.object({
  url: z.string().nullish(),
  description: z.string().nullish(),
});

const CostSharingValueSchema = z.object({
  isRequired: z.boolean().nullish(),
  percentage: z.number().nullish(),
  details: z.string().nullish(),
});

const pennsylvaniaCustomFields = {
  legacySerialId: {
    fieldType: 'integer',
    description: 'An integer ID for the opportunity, needed for compatibility with legacy systems',
  },
  agency: {
    fieldType: 'object',
    value: AgencyValueSchema,
    description: 'Information about the agency offering this opportunity',
  },
  contactInfo: {
    fieldType: 'object',
    value: ContactInfoValueSchema,
    description: 'Contact information (name, email, phone, description) for this resource',
  },
  additionalInfo: {
    fieldType: 'object',
    value: AdditionalInfoValueSchema,
    description: 'URL and description for additional information about the opportunity',
  },
  costSharing: {
    fieldType: 'object',
    value: CostSharingValueSchema,
    description: 'Cost sharing or matching requirement for the opportunity',
  },
  fundingSource: {
    fieldType: 'string',
    description:
      'Where the funding originates (e.g. "State", "Federal", "Federal and State", "Other")',
  },
  fundingInstrument: {
    fieldType: 'string',
    description: 'The funding instrument type (e.g. "Grant", "Loan")',
  },
  lastSyncedAt: {
    fieldType: 'string',
    value: z.string().datetime(),
    description: 'ISO 8601 datetime when this record was last ingested from its source system',
  },
  paSlug: {
    fieldType: 'string',
    description: "Pennsylvania's URL-friendly opportunity identifier",
  },
  paCategory: {
    fieldType: 'string',
    description: "Pennsylvania's category taxonomy (often mirrors the issuing agency)",
  },
  paGrantCycle: {
    fieldType: 'string',
    description: 'PA grant cycle label (e.g. "Annual")',
  },
  paRawMinAward: {
    fieldType: 'string',
    description:
      'Original `minimumAward` string preserved when the value could not be parsed into a numeric amount',
  },
  paRawMaxAward: {
    fieldType: 'string',
    description:
      'Original `maximumAward` string preserved when the value could not be parsed into a numeric amount',
  },
  paRawTotalFunds: {
    fieldType: 'string',
    description:
      'Original `totalFundsToBeAwarded` string preserved when the value could not be parsed into a numeric amount',
  },
  paRawLinkToApply: {
    fieldType: 'string',
    description:
      'Original `linkToApply` string preserved when the value was not a valid absolute URL',
  },
  paProcessSteps: {
    fieldType: 'array',
    value: z.array(
      z.object({
        stepNumber: z.number().int(),
        description: z.string(),
      }),
    ),
    description: 'PA application process steps (HTML descriptions preserved as-is)',
  },
  paAdditionalResources: {
    fieldType: 'array',
    value: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
      }),
    ),
    description: 'Links to supporting documents and pages for the opportunity',
  },
  paFaqs: {
    fieldType: 'array',
    value: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    ),
    description: 'Frequently asked questions for the opportunity',
  },
} as const;

export const PennsylvaniaPlugin = definePlugin({
  meta: {
    name: 'pa-egrants-consumer',
    version: '0.1.0',
    sourceSystem: 'pa-egrants',
    capabilities: ['customFields'],
  },
  schemas: {
    Opportunity: {
      customFields: pennsylvaniaCustomFields,
    },
  },
} as const);
