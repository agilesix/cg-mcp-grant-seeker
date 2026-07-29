import { definePlugin } from '@common-grants/sdk/extensions';
import { z } from 'zod3';

/*
 * Consumer-side subset of the Washington FundHub plugin contract.
 *
 * Source of truth:
 * https://github.com/agilesix/cg-api-wa/blob/main/src/adapter/plugin.ts
 *
 * The API plugin owns FundHub's WordPress source schema and bidirectional
 * transforms. This MCP consumes the already-normalized CommonGrants API, so it
 * needs only the custom-field contract used to validate responses. Replace
 * this local definition with an import if the Washington plugin is published.
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

const WashingtonTaxonomiesValueSchema = z.record(z.array(z.string()));

const washingtonCustomFields = {
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
  waWordPressId: {
    fieldType: 'string',
  },
  waSlug: {
    fieldType: 'string',
  },
  waInternalReferenceId: {
    fieldType: 'string',
  },
  waExternalReferenceId: {
    fieldType: 'string',
  },
  waFeatured: {
    fieldType: 'boolean',
  },
  waPreApplicationRequired: {
    fieldType: 'boolean',
  },
  waPreApplicationRaw: {
    fieldType: 'string',
  },
  waCostShareRaw: {
    fieldType: 'string',
  },
  waApplicationLinkTitle: {
    fieldType: 'string',
  },
  waApplicationLinkUrl: {
    fieldType: 'string',
  },
  waApplicationLinkTarget: {
    fieldType: 'string',
  },
  waApplicationLinkRaw: {
    fieldType: 'string',
  },
  waEligibilityHtml: {
    fieldType: 'string',
  },
  waRequirements: {
    fieldType: 'string',
  },
  waContactHtml: {
    fieldType: 'string',
  },
  waTechnicalAssistanceContact: {
    fieldType: 'string',
  },
  waResourcesHtml: {
    fieldType: 'string',
  },
  waTaxonomies: {
    fieldType: 'object',
    value: WashingtonTaxonomiesValueSchema,
  },
  waScore: {
    fieldType: 'number',
  },
  waScoreReason: {
    fieldType: 'string',
  },
  waNumberOfAwardsRaw: {
    fieldType: 'string',
  },
  waTotalAmountRaw: {
    fieldType: 'string',
  },
  waMinAwardAmountRaw: {
    fieldType: 'string',
  },
  waMaxAwardAmountRaw: {
    fieldType: 'string',
  },
  waDisbursementNotes: {
    fieldType: 'string',
  },
  waApplicationCloseTime: {
    fieldType: 'string',
  },
  waDescriptionHtml: {
    fieldType: 'string',
  },
} as const;

export const WashingtonPlugin = definePlugin({
  meta: {
    name: 'wa-fundhub-consumer',
    version: '0.1.0',
    sourceSystem: 'fundhub-wa-wordpress',
    capabilities: ['customFields'],
  },
  schemas: {
    Opportunity: {
      customFields: washingtonCustomFields,
    },
  },
} as const);
