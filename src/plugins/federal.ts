import { definePlugin } from '@common-grants/sdk/extensions';
import { z } from 'zod/v3';

/*
 * Consumer-side subset of the Simpler.Grants.gov plugin contract.
 *
 * Source of truth:
 * https://github.com/common-grants/ts-cg-grants-gov
 *
 * The published plugin also owns native Simpler.Grants.gov schemas and
 * bidirectional transformations. This MCP consumes the already-normalized
 * CommonGrants API, so it needs only the custom fields and search-filter
 * declarations used at the SDK client boundary. Replace this local definition
 * with the published package once its consumer contract is lossless and its
 * corrected package release is available.
 *
 * Static field descriptions are intentionally omitted: SDK 0.6 materializes
 * them into every parsed opportunity. Nested object schemas are passthrough so
 * provider additions remain available before this consumer is updated.
 */

const AssistanceListingValueSchema = z
  .object({
    identifier: z.string().nullish(),
    programTitle: z.string().nullish(),
  })
  .passthrough();

const AgencyValueSchema = z
  .object({
    code: z.string().nullish(),
    name: z.string().nullish(),
    parentName: z.string().nullish(),
    parentCode: z.string().nullish(),
  })
  .passthrough();

const AttachmentValueSchema = z
  .object({
    downloadUrl: z.string().nullish(),
    name: z.string(),
    description: z.string().nullish(),
    sizeInBytes: z.number().int().nullish(),
    mimeType: z.string().nullish(),
    createdAt: z.string().datetime({ offset: true }),
    lastModifiedAt: z.string().datetime({ offset: true }),
  })
  .passthrough();

const ContactInfoValueSchema = z
  .object({
    name: z.string().nullish(),
    email: z.string().nullish(),
    emailDescription: z.string().nullish(),
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
  })
  .passthrough();

const federalCustomFields = {
  legacySerialId: {
    fieldType: 'integer',
  },
  federalOpportunityNumber: {
    fieldType: 'string',
  },
  assistanceListings: {
    fieldType: 'array',
    value: z.array(AssistanceListingValueSchema),
  },
  agency: {
    fieldType: 'object',
    value: AgencyValueSchema,
  },
  attachments: {
    fieldType: 'array',
    value: z.array(AttachmentValueSchema),
  },
  federalFundingSource: {
    fieldType: 'string',
  },
  contactInfo: {
    fieldType: 'object',
    value: ContactInfoValueSchema,
  },
  additionalInfo: {
    fieldType: 'object',
    value: AdditionalInfoValueSchema,
  },
  fiscalYear: {
    fieldType: 'integer',
  },
  costSharing: {
    fieldType: 'object',
    value: CostSharingValueSchema,
  },
  sourceCreatedAt: {
    fieldType: 'string',
  },
  sourceUpdatedAt: {
    fieldType: 'string',
  },
  summaryCreatedAt: {
    fieldType: 'string',
  },
  summaryUpdatedAt: {
    fieldType: 'string',
  },
  forecastedPostDate: {
    fieldType: 'string',
  },
  forecastedCloseDate: {
    fieldType: 'string',
  },
  fundingInstruments: {
    fieldType: 'array',
    value: z.array(z.string()),
  },
  fundingCategories: {
    fieldType: 'array',
    value: z.array(z.string()),
  },
} as const;

export const FederalPlugin = definePlugin({
  meta: {
    name: 'simpler-grants-gov-consumer',
    version: '0.1.0',
    sourceSystem: 'Simpler.Grants.gov',
    capabilities: ['customFields', 'customFilters'],
  },
  schemas: {
    Opportunity: {
      customFields: federalCustomFields,
    },
  },
  routes: {
    opportunities: {
      search: {
        filters: {
          agency: { filterType: 'stringArray' },
          applicantType: { filterType: 'stringArray' },
          fundingInstrument: { filterType: 'stringArray' },
          costSharing: { filterType: 'booleanComparison' },
        },
      },
    },
  } as const,
} as const);
