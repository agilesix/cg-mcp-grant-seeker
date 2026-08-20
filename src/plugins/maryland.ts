import { definePlugin } from '@common-grants/sdk/extensions';
import { z } from 'zod3';

/*
 * Consumer-side subset of the Maryland Community Compass plugin contract.
 *
 * Source of truth:
 * https://github.com/agilesix/cg-api-md/blob/main/src/adapter/plugin.ts
 *
 * The API plugin owns the Compass source schema and transforms. This MCP
 * consumes normalized CommonGrants responses, so it only needs the custom-
 * field contract used to validate them.
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

const EligibilityCriteriaValueSchema = z
  .object({
    beneficiaryTypes: z.array(z.object({ code: z.string(), name: z.string() }).passthrough()),
    details: z.string().nullish(),
  })
  .passthrough();

const AttachmentListValueSchema = z.array(
  z
    .object({
      downloadUrl: z.string().url(),
      name: z.string(),
      mimeType: z.string().nullish(),
    })
    .passthrough(),
);

const MdStringListSchema = z.array(z.string());

const marylandCustomFields = {
  agency: { fieldType: 'object', value: AgencyValueSchema },
  contactInfo: { fieldType: 'object', value: ContactInfoValueSchema },
  additionalInfo: { fieldType: 'object', value: AdditionalInfoValueSchema },
  eligibilityCriteria: { fieldType: 'object', value: EligibilityCriteriaValueSchema },
  attachments: { fieldType: 'array', value: AttachmentListValueSchema },
  fundingSource: { fieldType: 'string' },
  fundingInstrument: { fieldType: 'string' },
  lastSyncedAt: { fieldType: 'string', value: z.string().datetime() },
  mdCompassId: { fieldType: 'number' },
  mdSlug: { fieldType: 'string' },
  mdDataQuality: { fieldType: 'string' },
  mdGeographicScope: { fieldType: 'string' },
  mdAcceptingApplications: { fieldType: 'boolean' },
  mdRecurring: { fieldType: 'boolean' },
  mdAssistanceTypes: { fieldType: 'array', value: MdStringListSchema },
  mdEligibleIndustries: { fieldType: 'array', value: MdStringListSchema },
  mdEligibleCounties: { fieldType: 'array', value: MdStringListSchema },
  mdEligibleMunicipalities: { fieldType: 'array', value: MdStringListSchema },
  mdEligibleRegions: { fieldType: 'array', value: MdStringListSchema },
  mdEligibleIncentiveAreas: { fieldType: 'array', value: MdStringListSchema },
  mdEligibleOrganizationTypes: { fieldType: 'array', value: MdStringListSchema },
  mdBusinessStage: { fieldType: 'string' },
  mdApplicationDeadlineRaw: { fieldType: 'string' },
  mdApplicationProcess: { fieldType: 'string' },
  mdProgramAudience: { fieldType: 'string' },
  mdUseOfFunds: { fieldType: 'string' },
  mdGeographicEligibility: { fieldType: 'string' },
  mdRequirements: { fieldType: 'array', value: MdStringListSchema },
  mdSourceUrls: { fieldType: 'array', value: MdStringListSchema },
  mdSourceCount: { fieldType: 'number' },
} as const;

export const MarylandPlugin = definePlugin({
  meta: {
    name: 'md-compass-consumer',
    version: '0.1.0',
    sourceSystem: 'maryland-community-compass',
    capabilities: ['customFields'],
  },
  schemas: {
    Opportunity: {
      customFields: marylandCustomFields,
    },
  },
} as const);
