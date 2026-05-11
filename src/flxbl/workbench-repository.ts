import type { CreateContextPackInput, CreateDecisionInput, CreateTaskInput } from '../generated/create-dtos.js';
import type { ContextPack, Decision, Task } from '../generated/entities.js';
import type { TypedFlxblClient } from '../generated/client.js';
import type { ContextPackRequest, ContextPackResult, ContextPackSection, ScoredMemory } from '../memory/types.js';

export type TaskInput = CreateTaskInput;
export type DecisionInput = CreateDecisionInput;

const DEFAULT_TASK_LIMIT = 50;

export async function listWorkbenchTasks({
  client,
  limit = DEFAULT_TASK_LIMIT,
}: {
  client: TypedFlxblClient;
  limit?: number;
}): Promise<Task[]> {
  const result = await client.tasks.findMany({
    orderBy: 'updatedAt',
    orderDirection: 'DESC',
    limit,
    offset: 0,
  });

  return result.items;
}

export async function createWorkbenchTask({
  client,
  input,
}: {
  client: TypedFlxblClient;
  input: TaskInput;
}): Promise<{ task: Task }> {
  const task = await client.tasks.create(input);

  return { task };
}

export async function createDecision({
  client,
  input,
  now,
  taskId,
}: {
  client: TypedFlxblClient;
  input: DecisionInput;
  now: Date;
  taskId?: string;
}): Promise<{ decision: Decision }> {
  if (taskId) {
    await client.tasks.findById(taskId);
  }

  const decision = await client.decisions.create({
    ...input,
    decidedAt: input.decidedAt ?? now.toISOString(),
  });

  if (!taskId) return { decision };

  try {
    await client.relationships('Task', taskId).create('RECORDED_DECISION', decision.id, {
      createdAt: now.toISOString(),
      role: 'primary',
      reason: 'Created through amg decide',
    });
  } catch (error) {
    try {
      await client.decisions.delete(decision.id);
    } catch (rollbackError) {
      throw new Error(
        `Created decision ${decision.id}, but relationship creation failed and rollback failed: ${errorMessage(
          rollbackError,
        )}. Original relationship error: ${errorMessage(error)}`,
      );
    }

    throw new Error(
      `Relationship creation failed after creating decision ${decision.id}; rolled back the decision. ${errorMessage(
        error,
      )}`,
    );
  }

  return { decision };
}

export async function persistContextPack(args: {
  client: TypedFlxblClient;
  request: ContextPackRequest;
  pack: ContextPackResult;
  now: Date;
}): Promise<{ contextPackId: string; contextPack: ContextPack }> {
  const createdAt = args.now.toISOString();

  await Promise.all([
    args.request.projectId ? args.client.projects.findById(args.request.projectId) : Promise.resolve(),
    args.request.agentId ? args.client.agents.findById(args.request.agentId) : Promise.resolve(),
    args.request.taskId ? args.client.tasks.findById(args.request.taskId) : Promise.resolve(),
  ]);

  const contextPack = await args.client.contextPacks.create(toContextPackInput(args.request, args.pack));

  try {
    const relationships = args.client.contextPacks.relationships(contextPack.id);

    if (args.request.projectId) {
      await relationships.forProject.create(args.request.projectId, {
        createdAt,
        objectiveRole: 'primary',
      });
    }

    if (args.request.agentId) {
      await relationships.forAgent.create(args.request.agentId, {
        createdAt,
        agentRole: 'primary',
      });
    }

    if (args.request.taskId) {
      await args.client.relationships('ContextPack', contextPack.id).create('FOR_TASK', args.request.taskId, {
        createdAt,
        taskRole: 'primary',
      });
    }

    for (const memory of args.pack.includedMemories) {
      await relationships.includes.create(memory.id, contextPackIncludeProperties(args.pack, memory, createdAt));
    }
  } catch (error) {
    try {
      await args.client.contextPacks.delete(contextPack.id);
    } catch (rollbackError) {
      throw new Error(
        `Created context pack ${contextPack.id}, but relationship creation failed and rollback failed: ${errorMessage(
          rollbackError,
        )}. Original relationship error: ${errorMessage(error)}`,
      );
    }

    throw new Error(
      `Relationship creation failed after creating context pack ${contextPack.id}; rolled back the context pack. ${errorMessage(
        error,
      )}`,
    );
  }

  return { contextPackId: contextPack.id, contextPack };
}

function toContextPackInput(request: ContextPackRequest, pack: ContextPackResult): CreateContextPackInput {
  return {
    objective: request.objective,
    query: request.query,
    format: pack.format,
    resultJson: JSON.stringify(pack.json),
    resultMarkdown: pack.markdown,
    tokenBudget: request.tokenBudget,
  };
}

function contextPackIncludeProperties(pack: ContextPackResult, memory: ScoredMemory, createdAt: string) {
  const section = sectionForMemory(pack, memory.id);

  return {
    createdAt,
    section,
    rank: rankInSection(pack, section, memory.id),
    score: finiteScore(memory.score),
    why: { items: memory.why },
    relationshipPath: { items: memory.relationshipPath },
    retrievalFactors: memory.factors,
    tokenEstimate: estimateTokens(memory),
  };
}

function sectionForMemory(pack: ContextPackResult, memoryId: string): ContextPackSection {
  for (const [section, memories] of Object.entries(pack.json.sections) as Array<[ContextPackSection, ScoredMemory[]]>) {
    if (memories.some((memory) => memory.id === memoryId)) return section;
  }

  return 'semantic';
}

function rankInSection(pack: ContextPackResult, section: ContextPackSection, memoryId: string): number {
  const index = pack.json.sections[section].findIndex((memory) => memory.id === memoryId);
  return index >= 0 ? index + 1 : 1;
}

function estimateTokens(memory: ScoredMemory): number {
  return Math.max(1, Math.ceil(`${memory.title}\n${memory.body}`.length / 4));
}

function finiteScore(score: number): number {
  return Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
