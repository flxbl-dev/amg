import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildContextPackRequest } from './recall.js';

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'amg-memory-commands-'));

  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeConfig(dir: string, config: Record<string, unknown>) {
  await mkdir(join(dir, '.amg'), { recursive: true });
  await writeFile(join(dir, '.amg/config.json'), `${JSON.stringify(config, null, 2)}\n`);
}

describe('buildContextPackRequest', () => {
  it('uses workspace, project, and default agent IDs from .amg/config.json', async () => {
    await withTempDir(async (dir) => {
      await writeConfig(dir, {
        version: 1,
        workspaceId: 'node_workspace',
        projectId: 'node_project',
        defaultAgent: 'codex',
        agents: {
          codex: 'node_agent_codex',
          cursor: 'node_agent_cursor',
        },
      });

      const request = await buildContextPackRequest({
        cwd: dir,
        env: {},
        objective: 'Implement portable recall',
        query: 'context pack',
        tokenBudget: 1200,
        format: 'markdown',
      });

      expect(request).toEqual({
        workspaceId: 'node_workspace',
        projectId: 'node_project',
        agentId: 'node_agent_codex',
        objective: 'Implement portable recall',
        query: 'context pack',
        tokenBudget: 1200,
        format: 'markdown',
      });
    });
  });

  it('lets explicit flags override config defaults', async () => {
    await withTempDir(async (dir) => {
      await writeConfig(dir, {
        version: 1,
        workspaceId: 'node_workspace_config',
        projectId: 'node_project_config',
        defaultAgent: 'codex',
        agents: {
          codex: 'node_agent_config',
        },
      });

      const request = await buildContextPackRequest({
        cwd: dir,
        env: {},
        objective: 'Override defaults',
        workspaceId: 'node_workspace_flag',
        projectId: 'node_project_flag',
        agentId: 'node_agent_flag',
        taskId: 'node_task_flag',
        format: 'json',
      });

      expect(request).toMatchObject({
        workspaceId: 'node_workspace_flag',
        projectId: 'node_project_flag',
        agentId: 'node_agent_flag',
        taskId: 'node_task_flag',
        objective: 'Override defaults',
        format: 'json',
      });
    });
  });

  it('throws a clear error when neither flags nor config provide a workspace ID', async () => {
    await withTempDir(async (dir) => {
      await writeConfig(dir, {
        version: 1,
        defaultAgent: 'codex',
        agents: {
          codex: 'node_agent_codex',
        },
      });

      await expect(
        buildContextPackRequest({
          cwd: dir,
          env: {},
          objective: 'Missing workspace',
        }),
      ).rejects.toThrow(/Missing workspaceId.*--workspace-id.*amg link/);
    });
  });
});
