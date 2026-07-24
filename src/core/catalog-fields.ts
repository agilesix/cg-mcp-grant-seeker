import { getCustomFieldValue } from '@common-grants/sdk/extensions';
import { z } from 'zod3';
import type { Opportunity } from './types.js';

const nullableString = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

const agencyValueSchema = z
  .object({
    code: nullableString,
    name: nullableString,
    parentCode: nullableString,
    parentName: nullableString,
  })
  .strict();

const contactInfoValueSchema = z
  .object({
    name: nullableString,
    email: z
      .string()
      .email()
      .nullish()
      .transform((value) => value ?? null),
    phone: nullableString,
    description: nullableString,
  })
  .strict();

const additionalInfoValueSchema = z
  .object({
    url: z
      .string()
      .url()
      .nullish()
      .transform((value) => value ?? null),
    description: nullableString,
  })
  .strict();

const beneficiaryTypeValueSchema = z
  .object({
    code: nullableString,
    name: nullableString,
  })
  .strict();

const eligibilityCriteriaValueSchema = z
  .object({
    beneficiaryTypes: z
      .array(beneficiaryTypeValueSchema)
      .nullish()
      .transform((value) => value ?? null),
    details: nullableString,
  })
  .strict();

export const catalogOutputSchema = {
  agency: z
    .object({
      code: z.string().nullable(),
      name: z.string().nullable(),
      parentCode: z.string().nullable(),
      parentName: z.string().nullable(),
    })
    .nullable(),
  contactInfo: z
    .object({
      name: z.string().nullable(),
      email: z.string().email().nullable(),
      phone: z.string().nullable(),
      description: z.string().nullable(),
    })
    .nullable(),
  additionalInfo: z
    .object({
      url: z.string().url().nullable(),
      description: z.string().nullable(),
    })
    .nullable(),
  eligibilityCriteria: z
    .object({
      beneficiaryTypes: z
        .array(
          z.object({
            code: z.string().nullable(),
            name: z.string().nullable(),
          }),
        )
        .nullable(),
      details: z.string().nullable(),
    })
    .nullable(),
  warnings: z.array(
    z.object({
      field: z.string(),
      code: z.literal('invalid_catalog_field'),
      message: z.string(),
    }),
  ),
};

type Warning = z.infer<(typeof catalogOutputSchema)['warnings']>[number];

class CatalogFieldEnvelopeError extends Error {}

function catalogFieldValue<T extends z.ZodTypeAny>(
  opportunity: Opportunity,
  field: string,
  schema: T,
  warnings: Warning[],
): z.output<T> | null {
  try {
    const envelope = opportunity.customFields?.[field];
    if (envelope?.value != null && (envelope.name !== field || envelope.fieldType !== 'object')) {
      throw new CatalogFieldEnvelopeError(`expected an object custom field named ${field}`);
    }
    return getCustomFieldValue(opportunity, field, schema) ?? null;
  } catch (error) {
    if (!(error instanceof z.ZodError) && !(error instanceof CatalogFieldEnvelopeError)) {
      throw error;
    }
    const message =
      error instanceof z.ZodError
        ? error.issues
            .map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`)
            .join('; ')
        : error.message;
    warnings.push({ field, code: 'invalid_catalog_field', message });
    return null;
  }
}

export function catalogFieldsValue(opportunity: Opportunity) {
  const warnings: Warning[] = [];
  return {
    agency: catalogFieldValue(opportunity, 'agency', agencyValueSchema, warnings),
    contactInfo: catalogFieldValue(opportunity, 'contactInfo', contactInfoValueSchema, warnings),
    additionalInfo: catalogFieldValue(
      opportunity,
      'additionalInfo',
      additionalInfoValueSchema,
      warnings,
    ),
    eligibilityCriteria: catalogFieldValue(
      opportunity,
      'eligibilityCriteria',
      eligibilityCriteriaValueSchema,
      warnings,
    ),
    warnings,
  };
}
