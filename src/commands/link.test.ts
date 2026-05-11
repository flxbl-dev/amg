import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAmgFlxblClient } from '../flxbl/client.js';
import { runLinkCommand } from './link.js';

vi.mock('../flxbl/client.js', () => ({
  createAmgFlxblClient: vi.fn(() => {
    throw new Error('Injected link tests must not create a real FLXBL client.');
  }),
}));

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'amg-link-'));

  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('runLinkCommand', () => {
  beforeEach(() => {
    vi.mocked(createAmgFlxblClient).mockClear();
  });

  it('rejects without --yes before calling the injected link function', async () => {
    const linkIdentities = vi.fn();

    await withTempDir(async (dir) => {
      await expect(
        runLinkCommand({
          cwd: dir,
          workspace: 'Agent Memory Graph',
          project: 'Phase 2',
          agents: 'codex',
          yes: false,
          linkIdentities,
        }),
      ).rejects.toThrow(/amg link writes Workspace, Project, Agent, HAS_PROJECT, and USES_AGENT records/);
    });

    expect(linkIdentities).not.toHaveBeenCalled();
  });

  it('writes resolved identity IDs in injected mode without FLXBL env or real client creation', async () => {
    await withTempDir(async (dir) => {
      await mkdir(join(dir, '.amg'));
      await writeFile(
        join(dir, '.amg/config.json'),
        JSON.stringify({
          version: 1,
          instanceUrl: 'https://api.flxbl.dev',
          tenantId: 'tenant_test',
          workspaceId: 'node_old_workspace',
          agents: {
            cursor: 'node_agent_cursor',
          },
        }),
      );

      const linkIdentities = vi.fn().mockResolvedValue({
        workspaceId: 'node_workspace',
        projectId: 'node_project',
        defaultAgent: 'codex',
        agents: {
          codex: 'node_agent_codex',
        },
      });

      await runLinkCommand({
        cwd: dir,
        env: {},
        workspace: 'Agent Memory Graph',
        project: 'Phase 2',
        agents: 'codex',
        yes: true,
        linkIdentities,
      });

      const text = await readFile(join(dir, '.amg/config.json'), 'utf8');
      const config = JSON.parse(text) as Record<string, unknown>;

      expect(config).toMatchObject({
        version: 1,
        instanceUrl: 'https://api.flxbl.dev',
        tenantId: 'tenant_test',
        workspaceId: 'node_workspace',
        projectId: 'node_project',
        defaultAgent: 'codex',
        agents: {
          cursor: 'node_agent_cursor',
          codex: 'node_agent_codex',
        },
      });
      expect(createAmgFlxblClient).not.toHaveBeenCalled();
      expect(text).not.toContain('key_secret_value');
    });
  });

  it('does not write config when identity linking fails', async () => {
    await withTempDir(async (dir) => {
      await mkdir(join(dir, '.amg'));
      const configPath = join(dir, '.amg/config.json');
      const originalConfig = `${JSON.stringify({ version: 1, agents: { cursor: 'node_agent_cursor' } }, null, 2)}\n`;
      await writeFile(configPath, originalConfig);

      await expect(
        runLinkCommand({
          cwd: dir,
          workspace: 'Agent Memory Graph',
          project: 'Phase 2',
          agents: 'codex',
          yes: true,
          linkIdentities: vi.fn().mockRejectedValue(new Error('relationship write failed')),
        }),
      ).rejects.toThrow('relationship write failed');

      await expect(readFile(configPath, 'utf8')).resolves.toBe(originalConfig);
    });
  });
});
