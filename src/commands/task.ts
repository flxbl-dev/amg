import { loadAmgConfig } from '../config/load.js';
import { createAmgFlxblClient } from '../flxbl/client.js';
import { createWorkbenchTask, listWorkbenchTasks } from '../flxbl/workbench-repository.js';

const TASK_STATUSES = ['todo', 'doing', 'blocked', 'done'] as const;
const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

export type RunTaskCreateCommandOptions = {
  cwd: string;
  env?: Partial<Record<string, string | undefined>>;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
};

export type RunTaskListCommandOptions = {
  cwd: string;
  env?: Partial<Record<string, string | undefined>>;
};

export async function runTaskCommand(
  options: RunTaskCreateCommandOptions | RunTaskListCommandOptions,
  action: 'create' | 'list',
) {
  if (action === 'create') {
    return runTaskCreateCommand(options as RunTaskCreateCommandOptions);
  }

  return runTaskListCommand(options);
}

export async function runTaskCreateCommand(options: RunTaskCreateCommandOptions) {
  const { runtime } = await loadAmgConfig({ cwd: options.cwd, env: options.env });
  const client = createAmgFlxblClient({ instanceUrl: runtime.instanceUrl, apiKey: runtime.apiKey });
  const result = await createWorkbenchTask({
    client,
    input: {
      title: options.title,
      ...(options.description ? { description: options.description } : {}),
      status: parseEnum(options.status, TASK_STATUSES, 'todo'),
      priority: parseEnum(options.priority, TASK_PRIORITIES, 'medium'),
    },
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

export async function runTaskListCommand(options: RunTaskListCommandOptions) {
  const { runtime } = await loadAmgConfig({ cwd: options.cwd, env: options.env });
  const client = createAmgFlxblClient({ instanceUrl: runtime.instanceUrl, apiKey: runtime.apiKey });
  const result = { tasks: await listWorkbenchTasks({ client }) };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function parseEnum<const T extends readonly string[]>(value: string | undefined, values: T, fallback: T[number]): T[number] {
  if (!value) return fallback;
  if ((values as readonly string[]).includes(value)) return value as T[number];

  throw new Error(`Unsupported value "${value}". Expected one of: ${values.join(', ')}.`);
}
