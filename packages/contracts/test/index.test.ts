import { describe, expect, it } from 'vitest';

import {
  ERROR_CODES,
  apiErrorEnvelopeSchema,
  createShortUrlRequestSchema,
  customAliasSchema,
  healthResponseSchema,
} from '../src/index';

describe('createShortUrlRequestSchema', () => {
  it('accepts a valid URL creation payload', () => {
    const parsed = createShortUrlRequestSchema.parse({
      url: 'https://example.com/articles/software-engineering/system-design?ref=docs',
      customAlias: 'launch_42',
      expiresAt: '2035-01-01T12:00:00.000Z',
    });

    expect(parsed.customAlias).toBe('launch_42');
  });

  it('rejects non-http URLs', () => {
    expect(() =>
      createShortUrlRequestSchema.parse({
        url: 'ftp://example.com/file.txt',
      }),
    ).toThrow();
  });

  it('rejects URLs with embedded credentials', () => {
    expect(() =>
      createShortUrlRequestSchema.parse({
        url: 'https://user:pass@example.com',
      }),
    ).toThrow();
  });

  it('rejects a reserved alias', () => {
    expect(() =>
      createShortUrlRequestSchema.parse({
        url: 'https://example.com',
        customAlias: 'admin',
      }),
    ).toThrow();
  });
});

describe('customAliasSchema', () => {
  it('validates alias length and allowed characters', () => {
    expect(customAliasSchema.parse('abC_9')).toBe('abC_9');
  });

  it('rejects invalid alias characters', () => {
    expect(() => customAliasSchema.parse('bad alias')).toThrow();
  });
});

describe('apiErrorEnvelopeSchema', () => {
  it('accepts a stable error structure', () => {
    const parsed = apiErrorEnvelopeSchema.parse({
      error: {
        code: ERROR_CODES.ALIAS_TAKEN,
        message: 'Alias unavailable.',
        fields: {
          customAlias: 'Alias already in use.',
        },
      },
    });

    expect(parsed.error.code).toBe(ERROR_CODES.ALIAS_TAKEN);
  });
});

describe('healthResponseSchema', () => {
  it('accepts the health payload', () => {
    const parsed = healthResponseSchema.parse({
      status: 'ok',
      timestamp: '2026-10-30T09:00:00.000Z',
    });

    expect(parsed.status).toBe('ok');
  });
});
