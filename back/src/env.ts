import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),

  RATE_LIMIT_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
});

export const env = envSchema.parse(process.env);
