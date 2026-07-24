import { definePlugin } from '@common-grants/sdk/extensions';
import { z } from 'zod/v3';

/*
 * Consumer-side subset of the California plugin contract.
 *
 * Source of truth:
 * https://github.com/agilesix/cg-api-ca/blob/main/src/adapter/plugin.ts
 *
 * The API plugin also owns the native California schemas and bidirectional
 * transforms. This MCP consumes the already-normalized CommonGrants API, so it
 * needs only the custom-field contract used to validate responses. Replace
 * this local definition with an import if the California plugin is published.
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

const californiaCustomFields = {
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
  caPortalId: {
    fieldType: 'string',
    description: "California's Grants Portal identifier (the stable source key)",
  },
  caGrantId: {
    fieldType: 'string',
    description: "California's internal grant identifier, when assigned (often absent)",
  },
  caCategories: {
    fieldType: 'array',
    value: z.array(z.string()),
    description: "California's category taxonomy",
  },
  caLoi: {
    fieldType: 'boolean',
    description: 'Whether a Letter of Intent (LOI) is required before applying',
  },
  caApplicantTypeNotes: {
    fieldType: 'string',
    description: 'Free-text notes clarifying applicant eligibility',
  },
  caGeography: {
    fieldType: 'string',
    description: 'Geographic scope or restrictions for the opportunity',
  },
  caFundingSourceNotes: {
    fieldType: 'string',
    description: 'Free-text notes about the funding source',
  },
  caFundingMethod: {
    fieldType: 'string',
    description: 'How funds are disbursed',
  },
  caFundingMethodNotes: {
    fieldType: 'string',
    description: 'Free-text notes about the funding method',
  },
  caEstAwards: {
    fieldType: 'string',
    description: 'California estimate of the number of awards',
  },
  caEstAmountsRaw: {
    fieldType: 'string',
    description: 'Original estimated-award range when it cannot be normalized',
  },
  caRawEstAvailFunds: {
    fieldType: 'string',
    description: 'Original available-funds value when it cannot be normalized',
  },
  caAwardPeriod: {
    fieldType: 'string',
    description: 'California award or performance period',
  },
  caExpAwardDate: {
    fieldType: 'string',
    description: 'California expected award date',
  },
  caElecSubmission: {
    fieldType: 'string',
    description: 'Electronic submission instructions or address',
  },
  caAwardStats: {
    fieldType: 'string',
    description: 'California statistics about prior awards',
  },
  caCategorySuggestion: {
    fieldType: 'string',
    description: 'Suggested category provided by the source',
  },
  caChangeNotes: {
    fieldType: 'string',
    description: 'Source notes describing the latest record change',
  },
  caSubscribeUrl: {
    fieldType: 'string',
    description: 'URL for subscribing to issuing-agency updates',
  },
  caGrantEventsUrl: {
    fieldType: 'string',
    description: 'URL for grant-related events',
  },
} as const;

export const CaliforniaPlugin = definePlugin({
  meta: {
    name: 'ca-grants-consumer',
    version: '0.1.0',
    sourceSystem: 'ca-grants-portal',
    capabilities: ['customFields'],
  },
  schemas: {
    Opportunity: {
      customFields: californiaCustomFields,
    },
  },
} as const);
