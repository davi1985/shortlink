import { z } from 'zod';

export const SHORT_LINK_LIMITS = {
  DEFAULT_EXPIRATION_HOURS: 24,
  MAX_EXPIRATION_HOURS: 24,
  MAX_URL_LENGTH: 2048,
  MAX_BODY_SIZE_BYTES: 16 * 1024,
  SHORT_CODE_LENGTH: 7,
  MIN_ALIAS_LENGTH: 3,
  MAX_ALIAS_LENGTH: 32,
  RATE_LIMIT_MAX: 10,
  RATE_LIMIT_WINDOW_MS: 60_000,
} as const;

export const RESERVED_ALIASES = [
  'api',
  'health',
  'docs',
  'admin',
  'assets',
  'favicon.ico',
] as const;

export const ERROR_CODES = {
  INVALID_URL: 'INVALID_URL',
  INVALID_ALIAS: 'INVALID_ALIAS',
  ALIAS_TAKEN: 'ALIAS_TAKEN',
  INVALID_EXPIRATION: 'INVALID_EXPIRATION',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const isReservedAlias = (value: string): boolean =>
  RESERVED_ALIASES.includes(value as (typeof RESERVED_ALIASES)[number]);

export const aliasPattern = /^[A-Za-z0-9_-]+$/;

const httpUrlSchema = z
  .string()
  .trim()
  .min(1, 'URL is required.')
  .max(SHORT_LINK_LIMITS.MAX_URL_LENGTH, 'URL exceeds the allowed length.')
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'URL must use the HTTP or HTTPS protocol.')
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }, 'URL must not include embedded credentials.');

export const customAliasSchema = z
  .string()
  .trim()
  .min(
    SHORT_LINK_LIMITS.MIN_ALIAS_LENGTH,
    `Alias must have at least ${SHORT_LINK_LIMITS.MIN_ALIAS_LENGTH} characters.`,
  )
  .max(
    SHORT_LINK_LIMITS.MAX_ALIAS_LENGTH,
    `Alias must have at most ${SHORT_LINK_LIMITS.MAX_ALIAS_LENGTH} characters.`,
  )
  .regex(aliasPattern, 'Alias may contain only letters, numbers, hyphens and underscores.')
  .refine((value) => !isReservedAlias(value), 'Alias is reserved and cannot be used.');

export const createShortUrlRequestSchema = z
  .object({
    url: httpUrlSchema,
    customAlias: customAliasSchema.optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const shortUrlResponseSchema = z
  .object({
    code: z.string().min(1),
    originalUrl: httpUrlSchema,
    shortUrl: z.string().url('Short URL must be a valid URL.'),
    createdAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    customAlias: customAliasSchema.optional(),
  })
  .strict();

export const healthResponseSchema = z
  .object({
    status: z.literal('ok'),
    timestamp: z.string().datetime({ offset: true }),
  })
  .strict();

export const errorFieldMapSchema = z.record(z.string(), z.string()).optional();

export const apiErrorSchema = z
  .object({
    code: z.enum([
      ERROR_CODES.INVALID_URL,
      ERROR_CODES.INVALID_ALIAS,
      ERROR_CODES.ALIAS_TAKEN,
      ERROR_CODES.INVALID_EXPIRATION,
      ERROR_CODES.PAYLOAD_TOO_LARGE,
      ERROR_CODES.RATE_LIMITED,
      ERROR_CODES.INTERNAL_ERROR,
    ]),
    message: z.string().min(1),
    fields: errorFieldMapSchema,
  })
  .strict();

export const apiErrorEnvelopeSchema = z
  .object({
    error: apiErrorSchema,
  })
  .strict();

export type CreateShortUrlRequest = z.infer<typeof createShortUrlRequestSchema>;
export type ShortUrlResponse = z.infer<typeof shortUrlResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
