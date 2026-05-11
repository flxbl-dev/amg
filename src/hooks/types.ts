export type CodexHookEventName =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'PreToolUse'
  | 'PermissionRequest'
  | 'PostToolUse'
  | 'Stop';

export type CodexHookInput = {
  session_id?: string;
  transcript_path?: string | null;
  cwd?: string;
  hook_event_name: CodexHookEventName;
  model?: string;
  turn_id?: string;
  source?: string;
  prompt?: string;
  tool_name?: string;
  tool_use_id?: string;
  tool_input?: unknown;
  tool_response?: unknown;
  stop_hook_active?: boolean;
  last_assistant_message?: string | null;
};

export type HookSafetyDecision =
  | { behavior: 'allow'; message?: undefined }
  | { behavior: 'warn'; message: string }
  | { behavior: 'deny'; message: string };

export type HookCommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<{ status: number; stdout: string; stderr: string }>;
