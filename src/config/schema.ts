import { z } from 'zod';

const authSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.literal('apiKey'),
    key: z.string().optional(),
    header: z.string().optional(),
  }),
  z.object({ type: z.literal('bearer'), token: z.string().optional() }),
]);

const sourceSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, 'source name must be lowercase alphanumeric, dashes, or underscores'),
  label: z.string().min(1),
  baseUrl: z.string().url(),
  auth: authSchema.optional(),
  isDefault: z.boolean().optional(),
});

export const serverConfigSchema = z
  .object({
    sources: z.array(sourceSchema).min(1, 'at least one source is required'),
  })
  .superRefine((config, ctx) => {
    const names = config.sources.map((s) => s.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate source names: ${[...new Set(dupes)].join(', ')}`,
        path: ['sources'],
      });
    }
    if (config.sources.filter((s) => s.isDefault).length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at most one source may be marked isDefault',
        path: ['sources'],
      });
    }
  });

export type ValidatedServerConfig = z.infer<typeof serverConfigSchema>;
