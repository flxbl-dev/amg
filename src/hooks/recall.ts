import type { HookCommandRunner } from './types.js';

type RecallOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  runner: HookCommandRunner;
  objective: string;
};

type AmgStatusOutput = {
  safeToUse?: boolean;
};

export async function recallAmgContext(options: RecallOptions): Promise<string | null> {
  if (options.env.AMG_HOOKS_RECALL !== '1') return null;

  const status = await options.runner('pnpm', ['exec', 'amg', 'status', '--format', 'json'], {
    cwd: options.cwd,
    env: options.env,
  });

  const parsedStatus = parseStatus(status.stdout);
  if (!parsedStatus.safeToUse) return null;

  const args = [
    'exec',
    'amg',
    'recall',
    '--objective',
    options.objective,
    '--format',
    'markdown',
  ];

  if (options.env.AMG_WORKSPACE_ID) args.push('--workspace-id', options.env.AMG_WORKSPACE_ID);
  if (options.env.AMG_PROJECT_ID) args.push('--project-id', options.env.AMG_PROJECT_ID);
  if (options.env.AMG_AGENT_ID) args.push('--agent-id', options.env.AMG_AGENT_ID);
  if (options.env.AMG_TASK_ID) args.push('--task-id', options.env.AMG_TASK_ID);

  const recall = await options.runner('pnpm', args, { cwd: options.cwd, env: options.env });
  if (recall.status !== 0 || !recall.stdout.trim()) return null;

  return recall.stdout.trim();
}

function parseStatus(stdout: string): AmgStatusOutput {
  try {
    return JSON.parse(stdout) as AmgStatusOutput;
  } catch {
    return { safeToUse: false };
  }
}
