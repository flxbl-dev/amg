import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadAmgConfig } from './load.js';
import { writeAmgConfig } from './write.js';

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'amg-config-'));

  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('loadAmgConfig', () => {
  it('merges base and local config files, including agent maps', async () => {
    await withTempDir(async (dir) => {
      await mkdir(join(dir, '.amg'));
      await writeFile(
        join(dir, '.amg/config.json'),
        JSON.stringify({
          instanceUrl: 'https://base.example',
          tenantId: 'tenant_base',
          workspaceId: 'workspace_base',
          projectId: 'project_base',
          defaultAgent: 'codex',
          agents: {
            codex: 'node_agent_codex',
            cursor: 'node_agent_cursor',
          },
        }),
      );
      await writeFile(
        join(dir, '.amg/config.local.json'),
        JSON.stringify({
          tenantId: 'tenant_local',
          agents: {
            cursor: 'node_agent_cursor_local',
            custom: 'node_agent_custom',
          },
        }),
      );

      const { config, paths } = await loadAmgConfig({ cwd: dir, env: {} });

      expect(paths.configPath).toBe(join(dir, '.amg/config.json'));
      expect(paths.localConfigPath).toBe(join(dir, '.amg/config.local.json'));
      expect(config).toMatchObject({
        version: 1,
        instanceUrl: 'https://base.example',
        tenantId: 'tenant_local',
        workspaceId: 'workspace_base',
        projectId: 'project_base',
        defaultAgent: 'codex',
        agents: {
          codex: 'node_agent_codex',
          cursor: 'node_agent_cursor_local',
          custom: 'node_agent_custom',
        },
      });
    });
  });

  it('keeps environment overrides in runtime without writing secrets into config', async () => {
    await withTempDir(async (dir) => {
      await mkdir(join(dir, '.amg'));
      await writeFile(
        join(dir, '.amg/config.json'),
        JSON.stringify({
          instanceUrl: 'https://base.example',
          tenantId: 'tenant_base',
        }),
      );

      const { config, runtime } = await loadAmgConfig({
        cwd: dir,
        env: {
          FLXBL_INSTANCE_URL: 'https://env.example',
          FLXBL_TENANT_ID: 'tenant_env',
          FLXBL_API_KEY: 'key_secret_value',
          FLXBL_ACCESS_TOKEN: 'access_secret_value',
          FLXBL_REFRESH_TOKEN: 'refresh_secret_value',
        },
      });

      expect(config.tenantId).toBe('tenant_base');
      expect(runtime).toMatchObject({
        instanceUrl: 'https://env.example',
        tenantId: 'tenant_env',
        apiKey: 'key_secret_value',
        accessToken: 'access_secret_value',
        refreshToken: 'refresh_secret_value',
      });
      expect(JSON.stringify(config)).not.toContain('key_secret_value');
      expect(JSON.stringify(config)).not.toContain('access_secret_value');
      expect(JSON.stringify(config)).not.toContain('refresh_secret_value');
    });
  });

  it('defaults optional config fields to portable empty values', async () => {
    await withTempDir(async (dir) => {
      const { config, runtime } = await loadAmgConfig({ cwd: dir, env: {} });

      expect(config).toEqual({
        version: 1,
        agents: {},
      });
      expect(runtime).toEqual({});
    });
  });
});

describe('writeAmgConfig', () => {
  it('creates parent directories and writes validated pretty JSON with a trailing newline', async () => {
    await withTempDir(async (dir) => {
      const target = join(dir, '.amg/config.json');

      await writeAmgConfig(target, {
        version: 1,
        tenantId: 'tenant_test',
        agents: {
          codex: 'node_agent_codex',
        },
      });

      const text = await readFile(target, 'utf8');

      expect(text).toBe(
        `${JSON.stringify({ version: 1, tenantId: 'tenant_test', agents: { codex: 'node_agent_codex' } }, null, 2)}\n`,
      );
    });
  });
});
