import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { addGitignoreEntries } from './gitignore.js';
import { upsertManagedBlock } from './managed-block.js';

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
  const operations: InitOperation[] = [];
  const configPath = join(cwd, '.amg/config.json');

  operations.push({
    path: '.amg/config.json',
    content: (await readText(configPath)) ?? `${JSON.stringify({ version: 1, agents: {} }, null, 2)}\n`,
  });
  operations.push({
    path: '.amg/env.example',
    content: AMG_ENV_EXAMPLE,
  });
  operations.push({
    path: '.amg/agent-command-contract.md',
    content: AGENT_COMMAND_CONTRACT,
  });
  operations.push({
    path: '.gitignore',
    content: addGitignoreEntries(await readText(join(cwd, '.gitignore'))),
  });

  if (assistants.includes('codex')) {
    operations.push({
      path: 'AGENTS.md',
      content: upsertManagedBlock(await readText(join(cwd, 'AGENTS.md')), AGENTS_BLOCK),
    });
  }

  if (assistants.includes('claude')) {
    operations.push({
      path: 'CLAUDE.md',
      content: upsertManagedBlock(await readText(join(cwd, 'CLAUDE.md')), CLAUDE_BLOCK),
    });
    operations.push({
      path: '.claude/rules/amg.md',
      content: CLAUDE_RULE,
    });
  }

  if (claudeSkill) {
    operations.push({
      path: '.claude/skills/amg-recall/SKILL.md',
      content: CLAUDE_RECALL_SKILL,
    });
  }

  if (assistants.includes('cursor')) {
    operations.push({
      path: '.cursor/rules/amg.mdc',
      content: CURSOR_RULE,
    });
  }

  if (cursorCommands) {
    operations.push({
      path: '.cursor/commands/amg-recall.md',
      content: CURSOR_RECALL_COMMAND,
    });
  }

  if (codexHooks) {
    operations.push({
      path: '.codex/config.example.toml',
      content: CODEX_CONFIG_EXAMPLE,
    });
    operations.push({
      path: '.codex/hooks/session-start.mjs',
      content: CODEX_SESSION_START_HOOK,
    });
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

const AMG_ENV_EXAMPLE = `FLXBL_INSTANCE_URL=https://api.flxbl.dev
FLXBL_TENANT_ID=
FLXBL_API_KEY=
`;

const AGENT_COMMAND_CONTRACT = `# Agent Memory Graph Command Contract

Use \`pnpm exec amg\` from the project root when working with Agent Memory Graph.

## Read-Only Commands

These commands inspect local configuration or read context without writing tenant data:

\`\`\`sh
pnpm exec amg status --format json
pnpm exec amg recall --objective "Describe the current task"
pnpm exec amg export-context --objective "Prepare a handoff" --output .amg/context-pack.md
\`\`\`

Parse \`status --format json\` even when it exits nonzero. A nonzero exit can still include valid JSON when \`safeToUse\` is false.
Use \`--workspace-id\`, \`--project-id\`, \`--agent-id\`, or \`--task-id\` only when overriding IDs from \`.amg/config.json\`.

## Tenant-Writing Commands

These commands write persistent data to the configured FLXBL tenant:

- \`pnpm exec amg remember\`
- \`pnpm exec amg link\`
- \`pnpm exec amg task create\`
- \`pnpm exec amg decide\`
- \`pnpm exec amg recall --persist\`
- \`pnpm exec amg export-context --persist\`

Run tenant-writing commands only when you intend to mutate the configured FLXBL tenant.
Never print \`.env\`, FLXBL keys, seed secrets, tokens, or authorization headers.
Current files, tests, and explicit user instructions take precedence over recalled memory.
`;

const AGENTS_BLOCK = `## Agent Memory Graph

- Use \`.amg/agent-command-contract.md\` as the local AMG command contract.
- Run \`pnpm exec amg status --format json\` when AMG configuration is uncertain.
- Use \`pnpm exec amg recall\` for context-sensitive work when AMG is safe to use.
- Tenant-writing commands require explicit intent: \`link\`, \`remember\`, \`task create\`, \`decide\`, \`recall --persist\`, and \`export-context --persist\`.
- Never print \`.env\`, FLXBL keys, seed secrets, tokens, or authorization headers.
`;

const CLAUDE_BLOCK = `@AGENTS.md

Use the Agent Memory Graph guidance imported from AGENTS.md. The canonical command contract is \`.amg/agent-command-contract.md\`.
`;

const CLAUDE_RULE = `# Agent Memory Graph

Use \`.amg/agent-command-contract.md\` as the local AMG command contract.
Run \`pnpm exec amg status --format json\` when AMG configuration is uncertain.
Use \`pnpm exec amg recall\` for context-sensitive work when AMG is safe to use.
Tenant-writing commands require explicit intent: \`link\`, \`remember\`, \`task create\`, \`decide\`, \`recall --persist\`, and \`export-context --persist\`.
Never print \`.env\`, FLXBL keys, seed secrets, tokens, or authorization headers.
`;

const CLAUDE_RECALL_SKILL = `---
name: amg-recall
description: Use when project memory may materially affect the task and the workspace has Agent Memory Graph configured.
---

# AMG Recall

1. Run \`pnpm exec amg status --format json\` from the project root when AMG configuration is uncertain.
2. If \`safeToUse\` is true, run \`pnpm exec amg recall --objective "<current objective>" --format markdown\`.
3. Include \`--workspace-id\`, \`--project-id\`, \`--agent-id\`, or \`--task-id\` only when overriding config defaults.
4. Treat recall as advisory context. Current files, tests, and explicit user instructions take precedence.
5. Do not run tenant-writing AMG commands unless the user explicitly intends to write persistent FLXBL data.
`;

const CURSOR_RULE = `---
description: Agent Memory Graph guidance
alwaysApply: true
---

# Agent Memory Graph

Use \`.amg/agent-command-contract.md\` as the local AMG command contract.
Run \`pnpm exec amg status --format json\` when AMG configuration is uncertain.
Use \`pnpm exec amg recall\` for context-sensitive work when AMG is safe to use.
Tenant-writing commands require explicit intent: \`link\`, \`remember\`, \`task create\`, \`decide\`, \`recall --persist\`, and \`export-context --persist\`.
Never print \`.env\`, FLXBL keys, seed secrets, tokens, or authorization headers.
`;

const CURSOR_RECALL_COMMAND = `# AMG Recall

Run this when Agent Memory Graph context may materially affect the task.

\`\`\`sh
pnpm exec amg status --format json
pnpm exec amg recall --objective "<current objective>" --format markdown
\`\`\`

Add \`--workspace-id\`, \`--project-id\`, \`--agent-id\`, or \`--task-id\` only when overriding config defaults.
Treat recalled context as advisory and never print \`.env\`, FLXBL keys, seed secrets, tokens, or authorization headers.
`;

const CODEX_CONFIG_EXAMPLE = `[hooks]
session_start = ".codex/hooks/session-start.mjs"
`;

const CODEX_SESSION_START_HOOK = `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const input = readFileSync(0, 'utf8');

const result = spawnSync('pnpm', ['exec', 'amg', 'codex-hook'], {
  input,
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

process.exitCode = result.status ?? 0;
`;
