import { describe, expect, it } from 'vitest';

import { getAmgStatus, renderStatusText, type StatusContextReader } from './status.js';

const compatibleContext: StatusContextReader = async () => ({
  tenant: {
    schemaName: 'AgentMemoryGraph',
    schemaVersion: '1.3.0',
    schemaStatus: 'ACTIVE',
    instanceUrl: 'https://api.flxbl.dev',
  },
});

describe('getAmgStatus', () => {
  it('returns parseable unsafe status when FLXBL env is missing', async () => {
    const status = await getAmgStatus({
      cwd: process.cwd(),
      env: {},
      readContext: compatibleContext,
    });

    expect(status).toMatchObject({
      configured: false,
      safeToUse: false,
      warnings: ['Missing required server env: FLXBL_TENANT_ID', 'Missing required server env: FLXBL_API_KEY'],
    });
    expect(status.commands).toEqual([
      'init',
      'status',
      'link',
      'recall',
      'remember',
      'export-context',
      'task:create',
      'task:list',
      'decide',
      'codex-hook',
    ]);
  });

  it('returns safe status for a compatible AgentMemoryGraph tenant', async () => {
    const status = await getAmgStatus({
      cwd: process.cwd(),
      env: {
        FLXBL_TENANT_ID: 'tenant_test',
        FLXBL_API_KEY: 'key_secret_value',
      },
      readContext: compatibleContext,
    });

    expect(status).toMatchObject({
      configured: true,
      safeToUse: true,
      tenant: {
        schemaName: 'AgentMemoryGraph',
        schemaVersion: '1.3.0',
        schemaStatus: 'ACTIVE',
      },
      warnings: [],
    });
    expect(JSON.stringify(status)).not.toContain('key_secret_value');
  });

  it('returns unsafe status for wrong or stale schemas', async () => {
    const status = await getAmgStatus({
      cwd: process.cwd(),
      env: {
        FLXBL_TENANT_ID: 'tenant_test',
        FLXBL_API_KEY: 'key_secret_value',
      },
      readContext: async () => ({
        tenant: {
          schemaName: 'OtherSchema',
          schemaVersion: '1.2.9',
          schemaStatus: 'ACTIVE',
        },
      }),
    });

    expect(status.safeToUse).toBe(false);
    expect(status.warnings).toContain('Expected schemaName AgentMemoryGraph, received OtherSchema.');
    expect(status.warnings).toContain('Expected schemaVersion at least 1.3.0, received 1.2.9.');
  });

  it('redacts secrets from context errors', async () => {
    const status = await getAmgStatus({
      cwd: process.cwd(),
      env: {
        FLXBL_TENANT_ID: 'tenant_test',
        FLXBL_API_KEY: 'key_secret_value',
        FLXBL_ACCESS_TOKEN: 'access_secret_value',
      },
      readContext: async () => {
        throw new Error('Failed Authorization: Bearer access_secret_value with key_secret_value');
      },
    });

    const text = JSON.stringify(status);

    expect(status.safeToUse).toBe(false);
    expect(text).toContain('Authorization: Bearer [REDACTED]');
    expect(text).not.toContain('access_secret_value');
    expect(text).not.toContain('key_secret_value');
  });
});

describe('renderStatusText', () => {
  it('renders concise public command text without legacy pnpm script names or secrets', () => {
    const text = renderStatusText({
      configured: false,
      safeToUse: false,
      commands: ['status', 'recall', 'task:create'],
      warnings: ['Nope FLXBL_API_KEY=key_secret_value Authorization: Bearer bearer_secret'],
    });

    expect(text).toContain('AMG configured: no');
    expect(text).toContain('AMG safe to use: no');
    expect(text).toContain('Commands: amg status, amg recall, amg task create');
    expect(text).not.toContain('amg:status');
    expect(text).not.toContain('pnpm amg');
    expect(text).not.toContain('key_secret_value');
    expect(text).not.toContain('bearer_secret');
  });
});
