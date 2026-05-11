import type { RetrievedMemoryCandidate, ScoredMemory, ScoreFactors } from './types.js';

type ScoreOptions = {
  objective: string;
  query?: string;
  now: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function scoreMemory(candidate: RetrievedMemoryCandidate, options: ScoreOptions): ScoredMemory {
  const now = options.now;
  const why: string[] = [];

  if (candidate.validUntil) {
    const validUntil = new Date(candidate.validUntil);
    if (!isValidDate(validUntil)) {
      return toScored(candidate, zeroFactors(), 0, ['Memory has an invalid validUntil timestamp'], true);
    }
    if (validUntil < now) {
      return toScored(candidate, zeroFactors(), 0, ['Memory expired before the context-pack request'], true);
    }
  }

  if (candidate.validFrom) {
    const validFrom = new Date(candidate.validFrom);
    if (!isValidDate(validFrom)) {
      return toScored(candidate, zeroFactors(), 0, ['Memory has an invalid validFrom timestamp'], true);
    }
    if (validFrom > now) {
      return toScored(candidate, zeroFactors(), 0, ['Memory is not valid yet for the context-pack request'], true);
    }
  }

  const factors: ScoreFactors = {
    textMatchScore: textMatch(candidate, [options.objective, options.query].filter(Boolean).join(' ')),
    graphProximityScore: graphProximity(candidate),
    importanceScore: clamp(candidate.importance / 5),
    confidenceScore: clamp(candidate.confidence),
    recencyScore: recency(candidate.lastUsedAt ?? candidate.updatedAt ?? candidate.createdAt, now),
    typeBoost: typeBoost(candidate.type),
    statusPenalty: statusPenalty(candidate.status),
  };

  const weightedScore =
    factors.textMatchScore * 0.3 +
    factors.graphProximityScore * 0.25 +
    factors.importanceScore * 0.2 +
    factors.confidenceScore * 0.15 +
    factors.recencyScore * 0.1 +
    factors.typeBoost -
    factors.statusPenalty;

  const score = clamp(weightedScore);

  if (factors.textMatchScore > 0) why.push('Memory text matches the objective or query');
  if (factors.graphProximityScore > 0) why.push('Memory has graph relationships relevant to the request');
  if (candidate.type === 'procedural') why.push('Procedural memory is boosted for agent instructions');
  if (candidate.type === 'constraint') why.push('Constraint memory is boosted as critical guidance');
  if (candidate.type === 'decision') why.push('Decision memory is boosted for previously accepted direction');
  if (candidate.status === 'superseded') why.push('Superseded memory is only eligible as historical explanation');
  if (candidate.status === 'archived') why.push('Archived memory is downranked unless directly relevant');

  for (const edge of candidate.relationships) {
    const reason = edge.properties.reason;
    if (typeof reason === 'string' && reason.length > 0) {
      why.push(`Edge ${edge.relationship} explains inclusion: ${reason}`);
    }
  }

  return toScored(candidate, factors, score, why, false);
}

function toScored(
  candidate: RetrievedMemoryCandidate,
  factors: ScoreFactors,
  score: number,
  why: string[],
  excluded: boolean,
): ScoredMemory {
  return {
    ...candidate,
    score,
    factors,
    why,
    relationshipPath: buildRelationshipPath(candidate),
    edgeEvidence: candidate.relationships,
    excluded,
  };
}

function textMatch(candidate: RetrievedMemoryCandidate, text: string): number {
  const terms = uniqueTerms(text);

  if (terms.length === 0) return 0;

  const haystack = `${candidate.title} ${candidate.body}`.toLowerCase();
  const matches = terms.filter((term) => haystack.includes(term)).length;

  return clamp(matches / terms.length);
}

function uniqueTerms(input: string): string[] {
  return Array.from(
    new Set(
      input
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length >= 3),
    ),
  );
}

function graphProximity(candidate: RetrievedMemoryCandidate): number {
  const weighted = candidate.relationships.reduce((total, edge) => {
    const value = firstFiniteNumber(
      edge.properties.strength,
      edge.properties.salience,
      edge.properties.relevance,
    );

    return total + (value ?? 0.5);
  }, 0);

  return clamp(weighted / Math.max(candidate.relationships.length, 1));
}

function recency(dateValue: string | undefined, now: Date): number {
  if (!dateValue) return 0.25;

  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) return 0.25;

  const ageDays = Math.max(0, (now.getTime() - timestamp) / MS_PER_DAY);
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.75;
  if (ageDays <= 90) return 0.5;

  return 0.25;
}

function typeBoost(type: RetrievedMemoryCandidate['type']): number {
  if (type === 'constraint') return 0.1;
  if (type === 'procedural') return 0.08;
  if (type === 'decision') return 0.05;
  if (type === 'warning') return 0.04;

  return 0;
}

function statusPenalty(status: RetrievedMemoryCandidate['status']): number {
  if (status === 'archived') return 0.6;
  if (status === 'superseded') return 0.55;

  return 0;
}

function buildRelationshipPath(candidate: RetrievedMemoryCandidate): string[] {
  const firstEdge = candidate.relationships[0];
  if (!firstEdge) return [`Memory:${candidate.title}`];

  return [`${firstEdge.targetType}:${firstEdge.targetLabel}`, firstEdge.relationship, `Memory:${candidate.title}`];
}

function zeroFactors(): ScoreFactors {
  return {
    textMatchScore: 0,
    graphProximityScore: 0,
    importanceScore: 0,
    confidenceScore: 0,
    recencyScore: 0,
    typeBoost: 0,
    statusPenalty: 0,
  };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function firstFiniteNumber(...values: unknown[]): number | undefined {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function isValidDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}
