import type { Memory } from '../generated/entities.js';
import type { TypedFlxblClient } from '../generated/client.js';
import type { ContextPackRequest, EdgeEvidence, MemoryType, RetrievedMemoryCandidate } from '../memory/types.js';

export type MemoryScope = 'workspace' | 'project' | 'agent' | 'user';

export type RememberInput = {
  workspaceId?: string;
  projectId?: string;
  agentId?: string;
  taskId?: string;
  artifactId?: string;
  decisionId?: string;
  title: string;
  body: string;
  type: MemoryType;
  scope: MemoryScope;
  importance: number;
  confidence: number;
};

export type RelationshipDirection = 'out' | 'in' | 'both';

export type RelationshipRecord = Record<string, unknown> & {
  _relationship: {
    id?: string;
    type?: string;
    properties?: Record<string, unknown>;
  };
};

type MemoryEdgeTarget = {
  relationship: string;
  targetType: string;
  shouldFetch: (request: ContextPackRequest) => boolean;
};

const FETCH_LIMIT = 250;
const RETURN_LIMIT = 100;
const MAX_PAGES = 20;

const SCOPE_EDGE_TARGETS: MemoryEdgeTarget[] = [
  {
    relationship: 'SCOPED_TO_WORKSPACE',
    targetType: 'Workspace',
    shouldFetch: (request) => Boolean(request.workspaceId),
  },
  {
    relationship: 'SCOPED_TO_PROJECT',
    targetType: 'Project',
    shouldFetch: (request) => Boolean(request.projectId),
  },
  {
    relationship: 'APPLIES_TO',
    targetType: 'Agent',
    shouldFetch: (request) => Boolean(request.agentId),
  },
  {
    relationship: 'ABOUT_TASK',
    targetType: 'Task',
    shouldFetch: (request) => Boolean(request.taskId),
  },
];

const CONTEXT_EDGE_TARGETS: MemoryEdgeTarget[] = [
  { relationship: 'MENTIONS', targetType: 'Concept', shouldFetch: () => true },
  { relationship: 'RELATED_TO', targetType: 'Memory', shouldFetch: () => true },
  { relationship: 'SUPERSEDES', targetType: 'Memory', shouldFetch: () => true },
  { relationship: 'ABOUT_ARTIFACT', targetType: 'Artifact', shouldFetch: () => true },
  { relationship: 'ABOUT_DECISION', targetType: 'Decision', shouldFetch: () => true },
];

export async function fetchMemoryCandidates({
  client,
  request,
}: {
  client: TypedFlxblClient;
  request: ContextPackRequest;
}): Promise<RetrievedMemoryCandidate[]> {
  const candidates: RetrievedMemoryCandidate[] = [];

  for (let page = 0; page < MAX_PAGES && candidates.length < RETURN_LIMIT; page += 1) {
    const result = await client.memorys.findMany({
      where: {
        status: { $in: ['active', 'superseded'] },
        ...(request.includeTypes && request.includeTypes.length > 0 ? { type: { $in: request.includeTypes } } : {}),
      },
      orderBy: 'updatedAt',
      orderDirection: 'DESC',
      limit: FETCH_LIMIT,
      offset: page * FETCH_LIMIT,
    });

    if (result.items.length === 0) break;

    const pageCandidates = await Promise.all(
      result.items.map(async (memory) => {
        const scopeEdges = await fetchScopeEdges(client, memory.id, request);
        if (!candidateMatchesRequestScope(request, scopeEdges)) return null;

        const contextEdges = await fetchContextEdges(client, memory.id);
        return normalizeMemoryCandidate(memory, [...scopeEdges, ...contextEdges]);
      }),
    );

    candidates.push(...pageCandidates.filter((candidate): candidate is RetrievedMemoryCandidate => candidate !== null));

    if (result.items.length < FETCH_LIMIT) break;
  }

  return candidates.sort(compareCandidates).slice(0, RETURN_LIMIT);
}

export async function rememberMemory({
  client,
  input,
  now,
}: {
  client: TypedFlxblClient;
  input: RememberInput;
  now: Date;
}): Promise<{ memory: Memory }> {
  const createdAt = now.toISOString();

  await Promise.all([
    input.workspaceId ? client.workspaces.findById(input.workspaceId) : Promise.resolve(),
    input.projectId ? client.projects.findById(input.projectId) : Promise.resolve(),
    input.agentId ? client.agents.findById(input.agentId) : Promise.resolve(),
    input.taskId ? client.tasks.findById(input.taskId) : Promise.resolve(),
    input.artifactId ? client.artifacts.findById(input.artifactId) : Promise.resolve(),
    input.decisionId ? client.decisions.findById(input.decisionId) : Promise.resolve(),
  ]);

  const memory = await client.memorys.create({
    title: input.title,
    body: input.body,
    type: input.type,
    scope: input.scope,
    status: 'active',
    confidence: input.confidence,
    importance: input.importance,
    source: 'cli',
    validFrom: createdAt,
    useCount: 0,
  });

  try {
    const relationships = client.memorys.relationships(memory.id);

    if (input.workspaceId) {
      await relationships.scopedToWorkspace.create(input.workspaceId, {
        createdAt,
        scopeReason: 'Created through amg remember',
      });
    }

    if (input.projectId) {
      await relationships.scopedToProject.create(input.projectId, {
        createdAt,
        scopeReason: 'Created through amg remember',
        priority: input.importance,
      });
    }

    if (input.agentId) {
      await relationships.appliesTo.create(input.agentId, {
        createdAt,
        reason: 'Created through amg remember',
        strength: input.confidence,
        required: input.type === 'constraint',
      });
    }

    if (input.taskId) {
      await relationships.aboutTask.create(input.taskId, {
        createdAt,
        relevance: 0.8,
        reason: 'Created through amg remember',
        taskPhase: 'implementation',
      });
    }

    if (input.artifactId) {
      await relationships.aboutArtifact.create(input.artifactId, {
        createdAt,
        relevance: 0.8,
        reason: 'Created through amg remember',
        artifactRole: 'reference',
      });
    }

    if (input.decisionId) {
      await relationships.aboutDecision.create(input.decisionId, {
        createdAt,
        relevance: 0.8,
        reason: 'Created through amg remember',
        decisionRole: 'consequence',
      });
    }
  } catch (error) {
    try {
      await client.memorys.delete(memory.id);
    } catch (rollbackError) {
      throw new Error(
        `Created memory ${memory.id}, but relationship creation failed and rollback failed: ${errorMessage(
          rollbackError,
        )}. Original relationship error: ${errorMessage(error)}`,
      );
    }

    throw new Error(
      `Relationship creation failed after creating memory ${memory.id}; rolled back the memory. ${errorMessage(error)}`,
    );
  }

  return { memory };
}

async function fetchScopeEdges(
  client: TypedFlxblClient,
  memoryId: string,
  request: ContextPackRequest,
): Promise<EdgeEvidence[]> {
  const edgeLists = await Promise.all(
    SCOPE_EDGE_TARGETS.filter((edgeTarget) => edgeTarget.shouldFetch(request)).map((edgeTarget) =>
      edgeEvidence(client, memoryId, edgeTarget.relationship, edgeTarget.targetType),
    ),
  );

  return edgeLists.flat();
}

async function fetchContextEdges(client: TypedFlxblClient, memoryId: string): Promise<EdgeEvidence[]> {
  const edgeLists = await Promise.all(
    CONTEXT_EDGE_TARGETS.map((edgeTarget) =>
      edgeEvidence(client, memoryId, edgeTarget.relationship, edgeTarget.targetType),
    ),
  );

  return edgeLists.flat();
}

async function edgeEvidence(
  client: TypedFlxblClient,
  memoryId: string,
  relationship: string,
  targetType: string,
): Promise<EdgeEvidence[]> {
  const related = await listRelationships(client, 'Memory', memoryId, relationship, {
    direction: 'out',
    limit: 25,
  });

  return edgeEvidenceFromRecords(related, relationship, targetType);
}

export async function listRelationships(
  client: TypedFlxblClient,
  sourceEntity: string,
  sourceId: string,
  relationship: string,
  options: { direction?: RelationshipDirection; limit?: number; offset?: number } = {},
): Promise<RelationshipRecord[]> {
  const result = await client.relationships(sourceEntity, sourceId).list(relationship, {
    direction: options.direction ?? 'out',
    limit: options.limit ?? 50,
    offset: options.offset ?? 0,
  });

  return result.items as RelationshipRecord[];
}

export function normalizeMemoryCandidate(memory: Memory, relationships: EdgeEvidence[]): RetrievedMemoryCandidate {
  return {
    id: memory.id,
    title: memory.title,
    body: memory.body,
    type: memory.type,
    status: memory.status,
    confidence: memory.confidence,
    importance: memory.importance,
    source: memory.source,
    validFrom: memory.validFrom,
    validUntil: memory.validUntil,
    lastUsedAt: memory.lastUsedAt,
    useCount: memory.useCount,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    relationships,
  };
}

export function candidateMatchesRequestScope(request: ContextPackRequest, relationships: EdgeEvidence[]): boolean {
  return (
    scopeMatches(relationships, 'SCOPED_TO_WORKSPACE', request.workspaceId) &&
    scopeMatches(relationships, 'SCOPED_TO_PROJECT', request.projectId) &&
    scopeMatches(relationships, 'APPLIES_TO', request.agentId) &&
    scopeMatches(relationships, 'ABOUT_TASK', request.taskId)
  );
}

export function edgeEvidenceFromRecords(
  records: RelationshipRecord[],
  relationship: string,
  targetType: string,
): EdgeEvidence[] {
  return records.map((item) => toEdgeEvidence(item, relationship, targetType));
}

function toEdgeEvidence(item: RelationshipRecord, relationship: string, targetType: string): EdgeEvidence {
  const targetId = stringValue(item.id, 'unknown');
  const targetLabel = stringValue(item.name, stringValue(item.title, targetId));

  return {
    relationship,
    targetType,
    targetId,
    targetLabel,
    properties: item._relationship.properties ?? {},
  };
}

function scopeMatches(relationships: EdgeEvidence[], relationship: string, targetId: string | undefined): boolean {
  if (!targetId) return true;

  return relationships.some((edge) => edge.relationship === relationship && edge.targetId === targetId);
}

function compareCandidates(left: RetrievedMemoryCandidate, right: RetrievedMemoryCandidate): number {
  return (
    compareTimestampDescending(left.updatedAt, right.updatedAt) ||
    compareCodePoints(left.title, right.title) ||
    compareCodePoints(left.id, right.id)
  );
}

function compareTimestampDescending(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return 1;
  if (Number.isNaN(rightTime)) return -1;

  return rightTime - leftTime;
}

function compareCodePoints(left: string, right: string): number {
  const leftCodePoints = Array.from(left);
  const rightCodePoints = Array.from(right);
  const length = Math.min(leftCodePoints.length, rightCodePoints.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftCodePoints[index]?.codePointAt(0) ?? 0;
    const rightValue = rightCodePoints[index]?.codePointAt(0) ?? 0;

    if (leftValue !== rightValue) return leftValue - rightValue;
  }

  return leftCodePoints.length - rightCodePoints.length;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
