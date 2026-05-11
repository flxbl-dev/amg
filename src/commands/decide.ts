import { loadAmgConfig } from '../config/load.js';
import { createAmgFlxblClient } from '../flxbl/client.js';
import { createDecision } from '../flxbl/workbench-repository.js';

const DECISION_STATUSES = ['proposed', 'accepted', 'rejected', 'superseded'] as const;

export type RunDecideCommandOptions = {
  cwd: string;
  env?: Partial<Record<string, string | undefined>>;
  taskId: string;
  title: string;
  rationale?: string;
  status?: string;
};

export async function runDecideCommand(options: RunDecideCommandOptions) {
  const { runtime } = await loadAmgConfig({ cwd: options.cwd, env: options.env });
  const client = createAmgFlxblClient({ instanceUrl: runtime.instanceUrl, apiKey: runtime.apiKey });
  const result = await createDecision({
    client,
    taskId: options.taskId,
    now: new Date(),
    input: {
      title: options.title,
      ...(options.rationale ? { rationale: options.rationale } : {}),
      status: parseEnum(options.status, DECISION_STATUSES, 'accepted'),
    },
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function parseEnum<const T extends readonly string[]>(value: string | undefined, values: T, fallback: T[number]): T[number] {
  if (!value) return fallback;
  if ((values as readonly string[]).includes(value)) return value as T[number];

  throw new Error(`Unsupported value "${value}". Expected one of: ${values.join(', ')}.`);
}
