import { describe, expect, it } from 'vitest';

import { dispatchCodexHook } from './dispatcher.js';
import type { HookCommandRunner } from './types.js';

describe('dispatchCodexHook', () => {
  it('adds recalled context without env ID overrides when config defaults exist', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner: HookCommandRunner = async (command, args) => {
      calls.push({ command, args });

      if (args.includes('status')) {
        return {
          status: 0,
          stdout: JSON.stringify({ safeToUse: true }),
          stderr: '',
        };
      }

      return {
        status: 0,
        stdout: '# Config default context',
        stderr: '',
      };
    };

    await expect(
      dispatchCodexHook(
        {
          hook_event_name: 'SessionStart',
          cwd: process.cwd(),
        },
        {
          env: {
            AMG_HOOKS_RECALL: '1',
          },
          runner,
        },
      ),
    ).resolves.toMatchObject({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: expect.stringContaining('# Config default context'),
      },
    });

    expect(calls).toEqual([
      {
        command: 'amg',
        args: ['status', '--format', 'json'],
      },
      {
        command: 'amg',
        args: [
          'recall',
          '--objective',
          'Recall startup context for this Codex session',
          '--format',
          'markdown',
        ],
      },
    ]);
  });

  it('adds recalled context using portable AMG commands and available env IDs', async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner: HookCommandRunner = async (command, args) => {
      calls.push({ command, args });

      if (args.includes('status')) {
        return {
          status: 0,
          stdout: JSON.stringify({ safeToUse: true }),
          stderr: '',
        };
      }

      return {
        status: 0,
        stdout: '# Recalled context',
        stderr: '',
      };
    };

    await expect(
      dispatchCodexHook(
        {
          hook_event_name: 'UserPromptSubmit',
          cwd: process.cwd(),
          prompt: 'Implement Task 6',
        },
        {
          env: {
            AMG_HOOKS_RECALL: '1',
            AMG_WORKSPACE_ID: 'workspace_123',
            AMG_PROJECT_ID: 'project_123',
            AMG_AGENT_ID: 'agent_123',
            AMG_TASK_ID: 'task_123',
          },
          runner,
        },
      ),
    ).resolves.toMatchObject({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: expect.stringContaining('# Recalled context'),
      },
    });

    expect(calls).toEqual([
      {
        command: 'amg',
        args: ['status', '--format', 'json'],
      },
      {
        command: 'amg',
        args: [
          'recall',
          '--objective',
          'Implement Task 6',
          '--format',
          'markdown',
          '--workspace-id',
          'workspace_123',
          '--project-id',
          'project_123',
          '--agent-id',
          'agent_123',
          '--task-id',
          'task_123',
        ],
      },
    ]);
  });

  it('fails open on SessionStart when status JSON is unsafe', async () => {
    const runner: HookCommandRunner = async () => ({
      status: 1,
      stdout: JSON.stringify({ safeToUse: false }),
      stderr: '',
    });

    await expect(
      dispatchCodexHook(
        {
          hook_event_name: 'SessionStart',
          cwd: process.cwd(),
        },
        {
          env: {
            AMG_HOOKS_RECALL: '1',
            AMG_WORKSPACE_ID: 'workspace_123',
          },
          runner,
        },
      ),
    ).resolves.toEqual({ continue: true });
  });

  it('fails open on SessionStart when recall command fails', async () => {
    const runner: HookCommandRunner = async (_command, args) => {
      if (args.includes('status')) {
        return {
          status: 0,
          stdout: JSON.stringify({ safeToUse: true }),
          stderr: '',
        };
      }

      return {
        status: 1,
        stdout: '',
        stderr: 'recall failed',
      };
    };

    await expect(
      dispatchCodexHook(
        {
          hook_event_name: 'SessionStart',
          cwd: process.cwd(),
        },
        {
          env: {
            AMG_HOOKS_RECALL: '1',
            AMG_WORKSPACE_ID: 'workspace_123',
          },
          runner,
        },
      ),
    ).resolves.toEqual({ continue: true });
  });

  it('returns a Codex deny decision for secret output commands', async () => {
    await expect(
      dispatchCodexHook({
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: {
          command: 'echo $FLXBL_API_KEY',
        },
      }),
    ).resolves.toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
      },
    });
  });
});
