import { runHookCommand } from './command.js';
import { evaluateHookSafety } from './policy.js';
import { recallAmgContext } from './recall.js';
import type { CodexHookInput, HookCommandRunner } from './types.js';

type DispatchOptions = {
  env?: NodeJS.ProcessEnv | Partial<Record<string, string | undefined>>;
  runner?: HookCommandRunner;
};

type HookOutput = Record<string, unknown>;

export async function dispatchCodexHook(input: CodexHookInput, options: DispatchOptions = {}): Promise<HookOutput> {
  const cwd = input.cwd || process.cwd();
  const env = { ...process.env, ...options.env } as NodeJS.ProcessEnv;
  const runner = options.runner ?? runHookCommand;

  if (input.hook_event_name === 'PreToolUse') {
    return renderPreToolUse(input, env);
  }

  if (input.hook_event_name === 'PermissionRequest') {
    return renderPermissionRequest(input, env);
  }

  if (input.hook_event_name === 'UserPromptSubmit' || input.hook_event_name === 'SessionStart') {
    try {
      const objective =
        input.hook_event_name === 'UserPromptSubmit'
          ? input.prompt || 'Recall context for this Codex prompt'
          : 'Recall startup context for this Codex session';
      const markdown = await recallAmgContext({ cwd, env, runner, objective });

      if (!markdown) return { continue: true };

      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: input.hook_event_name,
          additionalContext: `AMG recalled context for this turn:\n${markdown}`,
        },
      };
    } catch {
      return { continue: true };
    }
  }

  if (input.hook_event_name === 'PostToolUse') {
    return { continue: true };
  }

  if (input.hook_event_name === 'Stop') {
    return { continue: true };
  }

  return { continue: true };
}

function renderPreToolUse(input: CodexHookInput, env: NodeJS.ProcessEnv): HookOutput {
  const decision = evaluateHookSafety({
    eventName: 'PreToolUse',
    toolName: input.tool_name,
    command: commandFromToolInput(input.tool_input),
    env,
  });

  if (decision.behavior === 'deny') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: decision.message,
      },
    };
  }

  if (decision.behavior === 'warn') {
    return { systemMessage: decision.message };
  }

  return {};
}

function renderPermissionRequest(input: CodexHookInput, env: NodeJS.ProcessEnv): HookOutput {
  const decision = evaluateHookSafety({
    eventName: 'PermissionRequest',
    toolName: input.tool_name,
    command: commandFromToolInput(input.tool_input),
    env,
  });

  if (decision.behavior === 'deny') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'deny',
          message: decision.message,
        },
      },
    };
  }

  if (decision.behavior === 'warn') {
    return { systemMessage: decision.message };
  }

  return {};
}

function commandFromToolInput(toolInput: unknown): string {
  if (typeof toolInput !== 'object' || toolInput === null) return '';
  const value = (toolInput as { command?: unknown }).command;
  return typeof value === 'string' ? value : '';
}
