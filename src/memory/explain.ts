import type { EdgeEvidence, ScoredMemory } from './types.js';

export function explainEdgeEvidence(edge: EdgeEvidence): string[] {
  const reasons: string[] = [];
  const properties = edge.properties;

  if (typeof properties.reason === 'string') reasons.push(properties.reason);
  if (typeof properties.scopeReason === 'string') reasons.push(properties.scopeReason);
  if (properties.required === true) reasons.push(`${edge.relationship} marks this memory as required`);
  if (typeof properties.salience === 'number') reasons.push(`${edge.relationship} salience ${properties.salience.toFixed(2)}`);
  if (typeof properties.strength === 'number') reasons.push(`${edge.relationship} strength ${properties.strength.toFixed(2)}`);
  if (typeof properties.relevance === 'number') reasons.push(`${edge.relationship} relevance ${properties.relevance.toFixed(2)}`);

  return reasons;
}

export function summarizeMemoryExplanation(memory: ScoredMemory): string {
  return [`${memory.title} scored ${memory.score.toFixed(2)}`, ...memory.why].join('\n');
}
