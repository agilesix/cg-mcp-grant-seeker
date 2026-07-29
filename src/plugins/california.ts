import { definePlugin } from '@common-grants/sdk/extensions';
import { z } from 'zod3';

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
 *
 * Static field descriptions are intentionally omitted: SDK 0.6 materializes
 * them into every parsed opportunity. They belong in a future deduplicated
 * field-definition surface, not repeated in each MCP result.
 */

const AgencyValueSchema = z
  .object({
    code: z.string().nullish(),
    name: z.string().nullish(),
    parentName: z.string().nullish(),
    parentCode: z.string().nullish(),
  })
  .passthrough();

const ContactInfoValueSchema = z
  .object({
    name: z.string().nullish(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
    description: z.string().nullish(),
  })
  .passthrough();

const AdditionalInfoValueSchema = z
  .object({
    url: z.string().nullish(),
    description: z.string().nullish(),
  })
  .passthrough();

const CostSharingValueSchema = z
  .object({
    isRequired: z.boolean().nullish(),
    percentage: z.number().nullish(),
    details: z.string().nullish(),
  })
  .passthrough();

const californiaCustomFields = {
  agency: {
    fieldType: 'object',
    value: AgencyValueSchema,
  },
  contactInfo: {
    fieldType: 'object',
    value: ContactInfoValueSchema,
  },
  additionalInfo: {
    fieldType: 'object',
    value: AdditionalInfoValueSchema,
  },
  costSharing: {
    fieldType: 'object',
    value: CostSharingValueSchema,
  },
  fundingSource: {
    fieldType: 'string',
  },
  fundingInstrument: {
    fieldType: 'string',
  },
  lastSyncedAt: {
    fieldType: 'string',
    value: z.string().datetime(),
  },
  caPortalId: {
    fieldType: 'string',
  },
  caGrantId: {
    fieldType: 'string',
  },
  caCategories: {
    fieldType: 'array',
    value: z.array(z.string()),
  },
  caLoi: {
    fieldType: 'boolean',
  },
  caApplicantTypeNotes: {
    fieldType: 'string',
  },
  caGeography: {
    fieldType: 'string',
  },
  caFundingSourceNotes: {
    fieldType: 'string',
  },
  caFundingMethod: {
    fieldType: 'string',
  },
  caFundingMethodNotes: {
    fieldType: 'string',
  },
  caEstAwards: {
    fieldType: 'string',
  },
  caEstAmountsRaw: {
    fieldType: 'string',
  },
  caRawEstAvailFunds: {
    fieldType: 'string',
  },
  caAwardPeriod: {
    fieldType: 'string',
  },
  caExpAwardDate: {
    fieldType: 'string',
  },
  caElecSubmission: {
    fieldType: 'string',
  },
  caAwardStats: {
    fieldType: 'string',
  },
  caCategorySuggestion: {
    fieldType: 'string',
  },
  caChangeNotes: {
    fieldType: 'string',
  },
  caSubscribeUrl: {
    fieldType: 'string',
  },
  caGrantEventsUrl: {
    fieldType: 'string',
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
