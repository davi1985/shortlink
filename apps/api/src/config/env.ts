import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanString = z.preprocess((value) => {
  if (value === undefined || value === '') return false;

  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase());

  return Boolean(value);
}, z.boolean());

export const appEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_BASE_URL: z.url().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  TRUST_PROXY: booleanString.default(false),
  SWAGGER_ENABLED: booleanString.default(false),
  MAX_BODY_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(16 * 1024),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type AppConfig = z.infer<typeof appEnvSchema>;

export const appConfig = appEnvSchema.parse(process.env);
