import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { addGitignoreEntries } from './gitignore.js';
import { upsertManagedBlock } from './managed-block.js';
import { CODEX_HOOK_TEMPLATE_FILES, loadInitTemplates } from './templates.js';

export const SUPPORTED_ASSISTANTS = ['codex', 'claude', 'cursor'] as const;

export type InitAssistant = (typeof SUPPORTED_ASSISTANTS)[number];

export type InitOperation = {
  path: string;
  content: string;
};

export type InitPlan = {
  cwd: string;
  operations: InitOperation[];
};

export type PlanInitOptions = {
  cwd: string;
  assistants?: InitAssistant[];
  codexHooks?: boolean;
  claudeSkill?: boolean;
  cursorCommands?: boolean;
};

export type RunInitCommandOptions = {
  cwd: string;
  assistants?: string;
  dryRun?: boolean;
  codexHooks?: boolean;
  claudeSkill?: boolean;
  cursorCommands?: boolean;
};

export async function planInit({
  cwd,
  assistants = ['codex'],
  codexHooks = false,
  claudeSkill = false,
  cursorCommands = false,
}: PlanInitOptions): Promise<InitPlan> {
  const templates = await loadInitTemplates();
  const operations: InitOperation[] = [];
  const configPath = join(cwd, '.amg/config.json');

  operations.push({
    path: '.amg/config.json',
    content: (await readText(configPath)) ?? `${JSON.stringify({ version: 1, agents: {} }, null, 2)}\n`,
  });
  operations.push({
    path: '.amg/env.example',
    content: templates.amgEnvExample,
  });
  operations.push({
    path: '.amg/agent-command-contract.md',
    content: templates.agentCommandContract,
  });
  operations.push({
    path: '.gitignore',
    content: addGitignoreEntries(await readText(join(cwd, '.gitignore'))),
  });

  if (assistants.includes('codex')) {
    operations.push({
      path: 'AGENTS.md',
      content: upsertManagedBlock(await readText(join(cwd, 'AGENTS.md')), templates.agentsBlock),
    });
  }

  if (assistants.includes('claude')) {
    operations.push({
      path: 'CLAUDE.md',
      content: upsertManagedBlock(await readText(join(cwd, 'CLAUDE.md')), templates.claudeBlock),
    });
    operations.push({
      path: '.claude/rules/amg.md',
      content: templates.claudeRule,
    });
  }

  if (claudeSkill) {
    operations.push({
      path: '.claude/skills/amg-recall/SKILL.md',
      content: templates.claudeRecallSkill,
    });
  }

  if (assistants.includes('cursor')) {
    operations.push({
      path: '.cursor/rules/amg.mdc',
      content: templates.cursorRule,
    });
  }

  if (cursorCommands) {
    operations.push({
      path: '.cursor/commands/amg-recall.md',
      content: templates.cursorRecallCommand,
    });
  }

  if (codexHooks) {
    operations.push({
      path: '.codex/config.example.toml',
      content: templates.codexConfigExample,
    });
    for (const file of CODEX_HOOK_TEMPLATE_FILES) {
      operations.push({
        path: `.codex/hooks/${file}`,
        content: templates.codexHooks[file],
      });
    }
  }

  return { cwd, operations };
}

export async function applyInitPlan(plan: InitPlan): Promise<void> {
  for (const operation of plan.operations) {
    const target = join(plan.cwd, operation.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, operation.content);
  }
}

export async function runInitCommand({
  cwd,
  assistants,
  dryRun = false,
  codexHooks = false,
  claudeSkill = false,
  cursorCommands = false,
}: RunInitCommandOptions): Promise<void> {
  const plan = await planInit({
    cwd,
    assistants: parseAssistants(assistants),
    codexHooks,
    claudeSkill,
    cursorCommands,
  });

  if (dryRun) {
    process.stdout.write(`${JSON.stringify({ dryRun: true, paths: plan.operations.map((operation) => operation.path) }, null, 2)}\n`);
    return;
  }

  await applyInitPlan(plan);
  process.stdout.write(`Installed AMG files: ${plan.operations.map((operation) => operation.path).join(', ')}\n`);
}

export function parseAssistants(value: string | undefined): InitAssistant[] {
  if (!value || value.trim().length === 0) {
    return ['codex'];
  }

  const rawAssistants = value
    .split(',')
    .map((assistant) => assistant.trim())
    .filter(Boolean);
  const assistants: InitAssistant[] = [];

  for (const assistant of rawAssistants) {
    if (!isSupportedAssistant(assistant)) {
      throw new Error(`Unsupported assistant "${assistant}". Expected one of: ${SUPPORTED_ASSISTANTS.join(', ')}.`);
    }
    assistants.push(assistant);
  }

  return assistants;
}

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function isSupportedAssistant(value: string): value is InitAssistant {
  return SUPPORTED_ASSISTANTS.includes(value as InitAssistant);
}
