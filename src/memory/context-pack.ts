import type { ContextPackFormat, ContextPackResult, ContextPackSection, ScoredMemory } from './types.js';

const SECTION_ORDER: Array<{ key: ContextPackSection; title: string; types: ScoredMemory['type'][] }> = [
  { key: 'constraints', title: 'Critical constraints', types: ['constraint'] },
  { key: 'procedural', title: 'Active procedural rules', types: ['procedural'] },
  { key: 'decisions', title: 'Accepted decisions', types: ['decision'] },
  { key: 'semantic', title: 'Relevant semantic facts', types: ['semantic'] },
  { key: 'episodic', title: 'Relevant episodic examples', types: ['episodic'] },
  { key: 'artifacts', title: 'Related artifacts', types: [] },
  { key: 'tasks', title: 'Open tasks', types: [] },
  { key: 'warnings', title: 'Warnings and known failure modes', types: ['warning'] },
];

export function buildContextPack(input: {
  objective: string;
  format: ContextPackFormat;
  memories: ScoredMemory[];
  contextPackId?: string;
}): ContextPackResult {
  const included = input.memories
    .filter((memory) => !memory.excluded)
    .map((memory) => ({ ...memory, score: sanitizeScore(memory.score) }))
    .sort((a, b) => b.score - a.score || compareCodePoints(a.title, b.title) || compareCodePoints(a.id, b.id));

  const sections = SECTION_ORDER.reduce(
    (accumulator, section) => {
      accumulator[section.key] = [];
      return accumulator;
    },
    {} as Record<ContextPackSection, ScoredMemory[]>,
  );

  for (const memory of included) {
    const section = SECTION_ORDER.find((candidate) => candidate.types.includes(memory.type))?.key ?? 'semantic';
    sections[section].push(memory);
  }

  const markdown = renderMarkdown(input.objective, sections);

  return {
    contextPackId: input.contextPackId,
    objective: input.objective,
    format: input.format,
    markdown,
    json: {
      sections,
      includedMemories: included,
    },
    includedMemories: included,
  };
}

function renderMarkdown(objective: string, sections: Record<ContextPackSection, ScoredMemory[]>): string {
  const lines = ['# Context Pack', '', `Objective: ${objective}`, ''];

  for (const section of SECTION_ORDER) {
    lines.push(`## ${section.title}`);

    const memories = sections[section.key];
    if (memories.length === 0) {
      lines.push('', 'No matching memories.', '');
      continue;
    }

    for (const memory of memories) {
      lines.push(`- **${memory.title}** (${memory.type}, score ${memory.score.toFixed(2)})`);
      for (const why of memory.why) {
        lines.push(`  - ${why}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
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

function sanitizeScore(score: number): number {
  if (!Number.isFinite(score)) return 0;

  return Math.min(1, Math.max(0, score));
}
