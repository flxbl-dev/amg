export type MemoryType = 'semantic' | 'episodic' | 'procedural' | 'decision' | 'constraint' | 'warning';
export type MemoryStatus = 'active' | 'superseded' | 'archived';
export type MemorySource = 'manual' | 'seed' | 'api' | 'cli' | 'conversation';
export type ContextPackFormat = 'json' | 'markdown';

export type ContextPackRequest = {
  workspaceId: string;
  projectId?: string;
  agentId?: string;
  taskId?: string;
  objective: string;
  query?: string;
  tokenBudget?: number;
  includeTypes?: MemoryType[];
  format?: ContextPackFormat;
};

export type EdgeEvidence = {
  relationship: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  properties: Record<string, unknown>;
};

export type RetrievedMemoryCandidate = {
  id: string;
  title: string;
  body: string;
  type: MemoryType;
  status: MemoryStatus;
  confidence: number;
  importance: number;
  source: MemorySource;
  validFrom?: string;
  validUntil?: string;
  lastUsedAt?: string;
  useCount: number;
  createdAt: string;
  updatedAt: string;
  relationships: EdgeEvidence[];
};

export type ScoreFactors = {
  textMatchScore: number;
  graphProximityScore: number;
  importanceScore: number;
  confidenceScore: number;
  recencyScore: number;
  typeBoost: number;
  statusPenalty: number;
};

export type ScoredMemory = RetrievedMemoryCandidate & {
  score: number;
  factors: ScoreFactors;
  why: string[];
  relationshipPath: string[];
  edgeEvidence: EdgeEvidence[];
  excluded: boolean;
};

export type ContextPackSection =
  | 'constraints'
  | 'procedural'
  | 'decisions'
  | 'semantic'
  | 'episodic'
  | 'artifacts'
  | 'tasks'
  | 'warnings';

export type ContextPackResult = {
  contextPackId?: string;
  objective: string;
  format: ContextPackFormat;
  markdown: string;
  json: {
    sections: Record<ContextPackSection, ScoredMemory[]>;
    includedMemories: ScoredMemory[];
  };
  includedMemories: ScoredMemory[];
};
