import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.factory';

describe('ShortLink API bootstrap', () => {
  let app: Awaited<ReturnType<typeof createApp>> | undefined;

  beforeEach(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('exposes the health check endpoint', async () => {
    if (!app) {
      throw new Error('App was not initialized.');
    }

    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      status: 'ok',
    });
  });
});
