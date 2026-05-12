import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFlxblContext } from './context.js';

describe('readFlxblContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the active schema from the configured FLXBL instance', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          name: 'OldSchema',
          version: '1.2.0',
          status: 'INACTIVE',
        },
        {
          name: 'AgentMemoryGraph',
          version: '1.3.0',
          status: 'ACTIVE',
        },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      readFlxblContext({
        instanceUrl: 'https://api.flxbl.dev/',
        apiKey: 'key_secret_value',
      }),
    ).resolves.toEqual({
      tenant: {
        schemaName: 'AgentMemoryGraph',
        schemaVersion: '1.3.0',
        schemaStatus: 'ACTIVE',
        instanceUrl: 'https://api.flxbl.dev',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.flxbl.dev/api/v1/schemas?includeEntities=true&includeFields=true&includeRelationships=true',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer key_secret_value',
          Accept: 'application/json',
        }),
      }),
    );
  });

  it('throws an HTTP-only error when schema context lookup fails', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized key_secret_value',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      readFlxblContext({
        instanceUrl: 'https://api.flxbl.dev',
        apiKey: 'key_secret_value',
      }),
    ).rejects.toThrow('FLXBL schema context request failed with HTTP 401.');
  });
});
