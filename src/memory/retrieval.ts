import { buildContextPack } from './context-pack.js';
import { scoreMemory } from './scoring.js';
import type { ContextPackRequest, ContextPackResult, RetrievedMemoryCandidate } from './types.js';

export function generateContextPackFromCandidates(input: {
  request: ContextPackRequest;
  candidates: RetrievedMemoryCandidate[];
  now: Date;
}): ContextPackResult {
  const scored = input.candidates
    .filter((candidate) => shouldIncludeType(candidate, input.request))
    .map((candidate) =>
      scoreMemory(candidate, {
        objective: input.request.objective,
        query: input.request.query,
        now: input.now,
      }),
    )
    .filter((memory) => !memory.excluded);

  return buildContextPack({
    objective: input.request.objective,
    format: input.request.format ?? 'json',
    memories: scored,
  });
}

function shouldIncludeType(candidate: RetrievedMemoryCandidate, request: ContextPackRequest): boolean {
  if (!request.includeTypes || request.includeTypes.length === 0) return true;

  return request.includeTypes.includes(candidate.type);
}
