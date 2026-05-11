import { loadAmgConfig } from '../config/load.js';
import { createAmgFlxblClient } from '../flxbl/client.js';
import { rememberMemory, type MemoryScope } from '../flxbl/memory-repository.js';
import type { MemoryType } from '../memory/types.js';

const MEMORY_TYPES = ['semantic', 'episodic', 'procedural', 'decision', 'constraint', 'warning'] as const;
const MEMORY_SCOPES = ['workspace', 'project', 'agent', 'user'] as const;

export type RunRememberCommandOptions = {
  cwd: string;
  env?: Partial<Record<string, string | undefined>>;
  title: string;
  body: string;
  type?: string;
  scope?: string;
  importance?: number;
  confidence?: number;
  workspaceId?: string;
  projectId?: string;
  agentId?: string;
  taskId?: string;
  artifactId?: string;
  decisionId?: string;
};

export async function runRememberCommand(options: RunRememberCommandOptions) {
  const { config, runtime } = await loadAmgConfig({ cwd: options.cwd, env: options.env });
  const client = createAmgFlxblClient({ instanceUrl: runtime.instanceUrl, apiKey: runtime.apiKey });
  const result = await rememberMemory({
    client,
    now: new Date(),
    input: {
      workspaceId: options.workspaceId ?? config.workspaceId,
      projectId: options.projectId ?? config.projectId,
      agentId: options.agentId ?? (config.defaultAgent ? config.agents[config.defaultAgent] : undefined),
      taskId: options.taskId,
      artifactId: options.artifactId,
      decisionId: options.decisionId,
      title: options.title,
      body: options.body,
      type: parseEnum(options.type, MEMORY_TYPES, 'semantic'),
      scope: parseEnum(options.scope, MEMORY_SCOPES, 'project'),
      importance: boundedNumber(options.importance, { fallback: 3, min: 1, max: 5, integer: true }),
      confidence: boundedNumber(options.confidence, { fallback: 0.8, min: 0, max: 1 }),
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

function boundedNumber(
  value: number | undefined,
  options: { fallback: number; min: number; max: number; integer?: boolean },
): number {
  const next = value ?? options.fallback;

  if (!Number.isFinite(next) || next < options.min || next > options.max) {
    throw new Error(`Expected number between ${options.min} and ${options.max}.`);
  }

  return options.integer ? Math.trunc(next) : next;
}

export type { MemoryScope, MemoryType };
