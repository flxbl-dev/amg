import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CODEX_HOOK_TEMPLATE_FILES = [
  'session-start.mjs',
  'user-prompt-submit.mjs',
  'pre-tool-use.mjs',
  'permission-request.mjs',
  'post-tool-use.mjs',
  'stop.mjs',
] as const;

export type CodexHookTemplateFile = (typeof CODEX_HOOK_TEMPLATE_FILES)[number];

export type InitTemplates = {
  amgEnvExample: string;
  agentCommandContract: string;
  agentsBlock: string;
  claudeBlock: string;
  claudeRule: string;
  claudeRecallSkill: string;
  cursorRule: string;
  cursorRecallCommand: string;
  codexConfigExample: string;
  codexHooks: Record<CodexHookTemplateFile, string>;
};

export async function loadInitTemplates(): Promise<InitTemplates> {
  const codexHooks = {} as Record<CodexHookTemplateFile, string>;

  for (const file of CODEX_HOOK_TEMPLATE_FILES) {
    codexHooks[file] = await readTemplate(`codex/hooks/${file}`);
  }

  return {
    amgEnvExample: await readTemplate('amg/env.example'),
    agentCommandContract: await readTemplate('amg/agent-command-contract.md'),
    agentsBlock: await readTemplate('agents/AGENTS.block.md'),
    claudeBlock: await readTemplate('agents/CLAUDE.block.md'),
    claudeRule: await readTemplate('claude/rules/amg.md'),
    claudeRecallSkill: await readTemplate('claude/skills/amg-recall/SKILL.md'),
    cursorRule: await readTemplate('cursor/amg.mdc'),
    cursorRecallCommand: await readTemplate('cursor/commands/amg-recall.md'),
    codexConfigExample: await readTemplate('codex/config.example.toml'),
    codexHooks,
  };
}

async function readTemplate(relativePath: string): Promise<string> {
  return readFile(join(dirname(fileURLToPath(import.meta.url)), '../../templates', relativePath), 'utf8');
}
