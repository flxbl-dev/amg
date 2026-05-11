import { loadAmgConfig } from '../config/load.js';
import { createAmgFlxblClient } from '../flxbl/client.js';
import { fetchMemoryCandidates } from '../flxbl/memory-repository.js';
import { persistContextPack } from '../flxbl/workbench-repository.js';
import { generateContextPackFromCandidates } from '../memory/retrieval.js';
import type { ContextPackFormat, ContextPackRequest, ContextPackResult } from '../memory/types.js';
import type { TypedFlxblClient } from '../generated/client.js';

export type ContextPackRequestOptions = {
  cwd: string;
  env?: Partial<Record<string, string | undefined>>;
  objective: string;
  workspaceId?: string;
  projectId?: string;
  agentId?: string;
  taskId?: string;
  query?: string;
  tokenBudget?: number;
  format?: string;
};

export type ReadRetryOptions = {
  delaysMs?: number[];
};

export type RecallContextPackOptions = {
  client: TypedFlxblClient;
  request: ContextPackRequest;
  now: Date;
  persist?: boolean;
};

export type RunRecallCommandOptions = ContextPackRequestOptions & {
  persist?: boolean;
};

const DEFAULT_RETRY_DELAYS_MS = [250, 750];

export async function buildContextPackRequest(options: ContextPackRequestOptions): Promise<ContextPackRequest> {
  const { config } = await loadAmgConfig({ cwd: options.cwd, env: options.env });
  const workspaceId = options.workspaceId ?? config.workspaceId;
  const projectId = options.projectId ?? config.projectId;
  const agentId = options.agentId ?? defaultAgentId(config);

  if (!workspaceId) {
    throw new Error('Missing workspaceId. Pass --workspace-id or run amg link to write .amg/config.json defaults.');
  }

  return withoutUndefined({
    workspaceId,
    projectId,
    agentId,
    taskId: options.taskId,
    objective: options.objective,
    query: options.query,
    tokenBudget: options.tokenBudget,
    format: parseContextPackFormat(options.format),
  });
}

export async function withReadRetry<T>(read: () => Promise<T>, options: ReadRetryOptions = {}): Promise<T> {
  const delaysMs = options.delaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  let attempt = 0;

  while (true) {
    try {
      return await read();
    } catch (error) {
      if (!isThrottlingError(error) || attempt >= delaysMs.length) {
        throw error;
      }

      await sleep(delaysMs[attempt] ?? 0);
      attempt += 1;
    }
  }
}

export async function recallContextPack({
  client,
  request,
  now,
  persist,
}: RecallContextPackOptions): Promise<ContextPackResult> {
  const candidates = await withReadRetry(() => fetchMemoryCandidates({ client, request }));
  const pack = generateContextPackFromCandidates({ request, candidates, now });

  if (!persist) return pack;

  const persisted = await persistContextPack({ client, request, pack, now });
  return { ...pack, contextPackId: persisted.contextPackId };
}

export async function runRecallCommand(options: RunRecallCommandOptions): Promise<ContextPackResult> {
  const request = await buildContextPackRequest(options);
  const { runtime } = await loadAmgConfig({ cwd: options.cwd, env: options.env });
  const client = createAmgFlxblClient({ instanceUrl: runtime.instanceUrl, apiKey: runtime.apiKey });
  const pack = await recallContextPack({
    client,
    request,
    now: new Date(),
    persist: options.persist,
  });

  if ((request.format ?? 'json') === 'markdown') {
    process.stdout.write(pack.markdown);
    if (!pack.markdown.endsWith('\n')) process.stdout.write('\n');
  } else {
    process.stdout.write(`${JSON.stringify(pack, null, 2)}\n`);
  }

  return pack;
}

function defaultAgentId(config: Awaited<ReturnType<typeof loadAmgConfig>>['config']): string | undefined {
  if (!config.defaultAgent) return undefined;

  return config.agents[config.defaultAgent];
}

function parseContextPackFormat(format: string | undefined): ContextPackFormat | undefined {
  if (!format) return undefined;
  if (format === 'json' || format === 'markdown') return format;

  throw new Error(`Unsupported format "${format}". Expected json or markdown.`);
}

function withoutUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

function isThrottlingError(error: unknown): boolean {
  const statusCode = statusCodeFromError(error);
  if (statusCode === 429) return true;

  const message = error instanceof Error ? error.message : String(error);
  return /ThrottlerException|Too Many Requests|\b429\b/i.test(message);
}

function statusCodeFromError(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = (error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status;
  return typeof value === 'number' ? value : undefined;
}

async function sleep(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
