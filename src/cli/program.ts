import { Command } from 'commander';

import { runCodexHookCommand } from '../commands/codex-hook.js';
import { runDecideCommand } from '../commands/decide.js';
import { runExportContextCommand } from '../commands/export-context.js';
import { runInitCommand } from '../commands/init.js';
import { runLinkCommand } from '../commands/link.js';
import { runRecallCommand } from '../commands/recall.js';
import { runRememberCommand } from '../commands/remember.js';
import { getAmgStatus, renderStatusText } from '../commands/status.js';
import { runTaskCreateCommand, runTaskListCommand } from '../commands/task.js';

const commandNames = [
  'init',
  'status',
  'link',
  'recall',
  'remember',
  'export-context',
  'task',
  'decide',
  'codex-hook',
] as const;

export type CreateAmgProgramOptions = {
  cwd?: string;
  env?: Partial<Record<string, string | undefined>>;
};

export function createAmgProgram(options: CreateAmgProgramOptions = {}): Command {
  const program = new Command();
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;

  program
    .name('amg')
    .description('Agent Memory Graph adoption CLI')
    .version('0.1.0');

  for (const commandName of commandNames) {
    if (commandName === 'init') {
      registerInitCommand(program, { cwd });
      continue;
    }

    if (commandName === 'status') {
      registerStatusCommand(program, { cwd, env });
      continue;
    }

    if (commandName === 'link') {
      registerLinkCommand(program, { cwd, env });
      continue;
    }

    if (commandName === 'task') {
      registerTaskCommand(program, { cwd, env });
      continue;
    }

    if (commandName === 'recall') {
      registerRecallCommand(program, { cwd, env });
      continue;
    }

    if (commandName === 'remember') {
      registerRememberCommand(program, { cwd, env });
      continue;
    }

    if (commandName === 'export-context') {
      registerExportContextCommand(program, { cwd, env });
      continue;
    }

    if (commandName === 'decide') {
      registerDecideCommand(program, { cwd, env });
      continue;
    }

    if (commandName === 'codex-hook') {
      registerCodexHookCommand(program);
      continue;
    }

    program
      .command(commandName)
      .description(`${commandName} command placeholder`)
      .action(async () => {
        throw new Error(`The "${commandName}" command is not implemented yet.`);
      });
  }

  return program;
}

function registerCodexHookCommand(program: Command) {
  program
    .command('codex-hook')
    .description('Run the AMG Codex hook dispatcher against stdin JSON')
    .action(async () => {
      await runCodexHookCommand();
    });
}

function registerRecallCommand(
  program: Command,
  options: Required<Pick<CreateAmgProgramOptions, 'cwd' | 'env'>>,
) {
  program
    .command('recall')
    .description('Recall a deterministic context pack for an objective')
    .requiredOption('--objective <objective>', 'Objective for memory retrieval')
    .option('--workspace-id <id>', 'Workspace ID override')
    .option('--project-id <id>', 'Project ID override')
    .option('--agent-id <id>', 'Agent ID override')
    .option('--task-id <id>', 'Task ID override')
    .option('--query <query>', 'Additional query text')
    .option('--token-budget <tokens>', 'Approximate token budget', parseInteger)
    .option('--format <format>', 'Output format: json or markdown', 'json')
    .option('--persist', 'Persist the generated context pack to FLXBL', false)
    .action(
      async (commandOptions: {
        objective: string;
        workspaceId?: string;
        projectId?: string;
        agentId?: string;
        taskId?: string;
        query?: string;
        tokenBudget?: number;
        format?: string;
        persist?: boolean;
      }) => {
        await runRecallCommand({
          cwd: options.cwd,
          env: options.env,
          objective: commandOptions.objective,
          workspaceId: commandOptions.workspaceId,
          projectId: commandOptions.projectId,
          agentId: commandOptions.agentId,
          taskId: commandOptions.taskId,
          query: commandOptions.query,
          tokenBudget: commandOptions.tokenBudget,
          format: commandOptions.format,
          persist: commandOptions.persist,
        });
      },
    );
}

function registerRememberCommand(
  program: Command,
  options: Required<Pick<CreateAmgProgramOptions, 'cwd' | 'env'>>,
) {
  program
    .command('remember')
    .description('Create a memory and optional graph scope relationships')
    .requiredOption('--title <title>', 'Memory title')
    .requiredOption('--body <body>', 'Memory body')
    .option('--type <type>', 'Memory type', 'semantic')
    .option('--scope <scope>', 'Memory scope', 'project')
    .option('--importance <number>', 'Importance from 1 to 5', parseInteger)
    .option('--confidence <number>', 'Confidence from 0 to 1', parseNumber)
    .option('--workspace-id <id>', 'Workspace ID override')
    .option('--project-id <id>', 'Project ID override')
    .option('--agent-id <id>', 'Agent ID override')
    .option('--task-id <id>', 'Task ID to link')
    .option('--artifact-id <id>', 'Artifact ID to link')
    .option('--decision-id <id>', 'Decision ID to link')
    .action(
      async (commandOptions: {
        title: string;
        body: string;
        type?: string;
        scope?: string;
        importance?: number;
        confidence?: number;
        workspaceId?: string;
        projectId?: string;
        agentId?: string;
        taskId?: string;
        artifactId?: string;
        decisionId?: string;
      }) => {
        await runRememberCommand({
          cwd: options.cwd,
          env: options.env,
          ...commandOptions,
        });
      },
    );
}

function registerExportContextCommand(
  program: Command,
  options: Required<Pick<CreateAmgProgramOptions, 'cwd' | 'env'>>,
) {
  program
    .command('export-context')
    .description('Recall and write a context pack to a file')
    .requiredOption('--objective <objective>', 'Objective for memory retrieval')
    .requiredOption('--output <path>', 'Output file path')
    .option('--workspace-id <id>', 'Workspace ID override')
    .option('--project-id <id>', 'Project ID override')
    .option('--agent-id <id>', 'Agent ID override')
    .option('--task-id <id>', 'Task ID override')
    .option('--query <query>', 'Additional query text')
    .option('--token-budget <tokens>', 'Approximate token budget', parseInteger)
    .option('--format <format>', 'Output format: json or markdown', 'markdown')
    .option('--persist', 'Persist the generated context pack to FLXBL', false)
    .action(
      async (commandOptions: {
        objective: string;
        output: string;
        workspaceId?: string;
        projectId?: string;
        agentId?: string;
        taskId?: string;
        query?: string;
        tokenBudget?: number;
        format?: string;
        persist?: boolean;
      }) => {
        await runExportContextCommand({
          cwd: options.cwd,
          env: options.env,
          ...commandOptions,
        });
      },
    );
}

function registerDecideCommand(
  program: Command,
  options: Required<Pick<CreateAmgProgramOptions, 'cwd' | 'env'>>,
) {
  program
    .command('decide')
    .description('Create a decision and link it to a task')
    .requiredOption('--task-id <id>', 'Task ID to link')
    .requiredOption('--title <title>', 'Decision title')
    .option('--rationale <text>', 'Decision rationale')
    .option('--status <status>', 'Decision status', 'accepted')
    .action(
      async (commandOptions: { taskId: string; title: string; rationale?: string; status?: string }) => {
        await runDecideCommand({
          cwd: options.cwd,
          env: options.env,
          ...commandOptions,
        });
      },
    );
}

function registerLinkCommand(
  program: Command,
  options: Required<Pick<CreateAmgProgramOptions, 'cwd' | 'env'>>,
) {
  program
    .command('link')
    .description('Create or resolve AMG Workspace, Project, and Agent identities')
    .requiredOption('--workspace <name>', 'Workspace name to create or reuse')
    .requiredOption('--project <name>', 'Project name to create or reuse')
    .option('--agents <list>', 'Comma-separated agent kinds: codex, claude-code, cursor, custom', 'codex')
    .option('--yes', 'Confirm tenant writes for identity and relationship records', false)
    .action(
      async (commandOptions: { workspace: string; project: string; agents: string; yes: boolean }) => {
        await runLinkCommand({
          cwd: options.cwd,
          env: options.env,
          workspace: commandOptions.workspace,
          project: commandOptions.project,
          agents: commandOptions.agents,
          yes: commandOptions.yes,
        });
      },
    );
}

function registerInitCommand(
  program: Command,
  options: Required<Pick<CreateAmgProgramOptions, 'cwd'>>,
) {
  program
    .command('init')
    .description('Install local AMG config, command guidance, and assistant files')
    .option('--assistants <list>', 'Comma-separated assistants: codex, claude, cursor', 'codex')
    .option('--dry-run', 'Print planned file paths without writing files', false)
    .option('--codex-hooks', 'Install optional Codex hook wrapper files', false)
    .option('--claude-skill', 'Install optional Claude recall skill files', false)
    .option('--cursor-commands', 'Install optional Cursor command files', false)
    .action(
      async (commandOptions: {
        assistants: string;
        dryRun: boolean;
        codexHooks: boolean;
        claudeSkill: boolean;
        cursorCommands: boolean;
      }) => {
      await runInitCommand({
        cwd: options.cwd,
        assistants: commandOptions.assistants,
        dryRun: commandOptions.dryRun,
        codexHooks: commandOptions.codexHooks,
        claudeSkill: commandOptions.claudeSkill,
        cursorCommands: commandOptions.cursorCommands,
      });
    },
    );
}

function registerStatusCommand(
  program: Command,
  options: Required<Pick<CreateAmgProgramOptions, 'cwd' | 'env'>>,
) {
  program
    .command('status')
    .description('Check whether AMG is configured and safe to use')
    .option('--format <format>', 'Output format: json or text', 'text')
    .action(async (commandOptions: { format: string }) => {
      const format = commandOptions.format;

      if (format !== 'json' && format !== 'text') {
        throw new Error(`Unsupported status format "${format}". Expected json or text.`);
      }

      const status = await getAmgStatus({ cwd: options.cwd, env: options.env });

      if (format === 'json') {
        process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
      } else {
        process.stdout.write(renderStatusText(status));
      }

      if (!status.safeToUse) {
        process.exitCode = 1;
      }
    });
}

function registerTaskCommand(
  program: Command,
  options: Required<Pick<CreateAmgProgramOptions, 'cwd' | 'env'>>,
) {
  const task = program.command('task').description('Create and list AMG tasks');

  task
    .command('create')
    .description('Create a task')
    .requiredOption('--title <title>', 'Task title')
    .option('--description <text>', 'Task description')
    .option('--status <status>', 'Task status', 'todo')
    .option('--priority <priority>', 'Task priority', 'medium')
    .action(
      async (commandOptions: { title: string; description?: string; status?: string; priority?: string }) => {
        await runTaskCreateCommand({
          cwd: options.cwd,
          env: options.env,
          ...commandOptions,
        });
      },
    );

  task
    .command('list')
    .description('List recent tasks')
    .action(async () => {
      await runTaskListCommand({
        cwd: options.cwd,
        env: options.env,
      });
    });
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) throw new Error(`Expected integer, received "${value}".`);
  return parsed;
}

function parseNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected number, received "${value}".`);
  return parsed;
}
