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

const pennsylvaniaCustomFields = {
  legacySerialId: {
    fieldType: 'integer',
  },
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
  paSlug: {
    fieldType: 'string',
  },
  paCategory: {
    fieldType: 'string',
  },
  paGrantCycle: {
    fieldType: 'string',
  },
  paRawMinAward: {
    fieldType: 'string',
  },
  paRawMaxAward: {
    fieldType: 'string',
  },
  paRawTotalFunds: {
    fieldType: 'string',
  },
  paRawLinkToApply: {
    fieldType: 'string',
  },
  paProcessSteps: {
    fieldType: 'array',
    value: z.array(
      z
        .object({
          stepNumber: z.number().int(),
          description: z.string(),
        })
        .passthrough(),
    ),
  },
  paAdditionalResources: {
    fieldType: 'array',
    value: z.array(
      z
        .object({
          title: z.string(),
          url: z.string(),
        })
        .passthrough(),
    ),
  },
  paFaqs: {
    fieldType: 'array',
    value: z.array(
      z
        .object({
          question: z.string(),
          answer: z.string(),
        })
        .passthrough(),
    ),
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
