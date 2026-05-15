import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { applyInitPlan, planInit, runInitCommand } from './installer.js';

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'amg-init-'));

  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

describe('planInit', () => {
  it('lists expected paths and does not write files during dry-run planning', async () => {
    await withTempDir(async (dir) => {
      const plan = await planInit({
        cwd: dir,
        assistants: ['codex', 'cursor'],
        codexHooks: false,
      });

      expect(plan.operations.map((operation) => operation.path).sort()).toEqual([
        '.amg/agent-command-contract.md',
        '.amg/config.json',
        '.amg/env.example',
        '.cursor/rules/amg.mdc',
        '.gitignore',
        'AGENTS.md',
      ]);
      expect(await readOptional(join(dir, '.amg/config.json'))).toBeUndefined();
      expect(await readOptional(join(dir, 'AGENTS.md'))).toBeUndefined();
    });
  });

  it('includes codex hook files only when codexHooks is true', async () => {
    await withTempDir(async (dir) => {
      const withoutHooks = await planInit({
        cwd: dir,
        assistants: ['codex'],
        codexHooks: false,
      });
      const withHooks = await planInit({
        cwd: dir,
        assistants: ['codex'],
        codexHooks: true,
      });

      expect(withoutHooks.operations.map((operation) => operation.path)).not.toContain('.codex/config.example.toml');
      expect(withoutHooks.operations.map((operation) => operation.path)).not.toContain(
        '.codex/hooks/session-start.mjs',
      );
      expect(withHooks.operations.map((operation) => operation.path)).toContain('.codex/config.example.toml');
      expect(withHooks.operations.map((operation) => operation.path)).toContain('.codex/hooks/session-start.mjs');
      expect(withHooks.operations.map((operation) => operation.path)).toContain(
        '.codex/hooks/user-prompt-submit.mjs',
      );
      expect(withHooks.operations.map((operation) => operation.path)).toContain('.codex/hooks/pre-tool-use.mjs');
      expect(withHooks.operations.map((operation) => operation.path)).toContain(
        '.codex/hooks/permission-request.mjs',
      );
      expect(withHooks.operations.map((operation) => operation.path)).toContain('.codex/hooks/post-tool-use.mjs');
      expect(withHooks.operations.map((operation) => operation.path)).toContain('.codex/hooks/stop.mjs');
    });
  });

  it('includes Claude skill files only when claudeSkill is true', async () => {
    await withTempDir(async (dir) => {
      const withoutSkill = await planInit({
        cwd: dir,
        assistants: ['claude'],
        codexHooks: false,
        claudeSkill: false,
      });
      const withSkill = await planInit({
        cwd: dir,
        assistants: ['claude'],
        codexHooks: false,
        claudeSkill: true,
      });

      expect(withoutSkill.operations.map((operation) => operation.path)).not.toContain(
        '.claude/skills/amg-recall/SKILL.md',
      );
      expect(withSkill.operations.map((operation) => operation.path)).toContain(
        '.claude/skills/amg-recall/SKILL.md',
      );
    });
  });

  it('includes Cursor command files only when cursorCommands is true', async () => {
    await withTempDir(async (dir) => {
      const withoutCommands = await planInit({
        cwd: dir,
        assistants: ['cursor'],
        codexHooks: false,
        cursorCommands: false,
      });
      const withCommands = await planInit({
        cwd: dir,
        assistants: ['cursor'],
        codexHooks: false,
        cursorCommands: true,
      });

      expect(withoutCommands.operations.map((operation) => operation.path)).not.toContain(
        '.cursor/commands/amg-recall.md',
      );
      expect(withCommands.operations.map((operation) => operation.path)).toContain(
        '.cursor/commands/amg-recall.md',
      );
    });
  });
});

describe('applyInitPlan', () => {
  it('preserves user content and creates only one AMG managed block when applied twice', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'AGENTS.md'), '# Project Rules\n\nKeep this line.\n');

      const plan = await planInit({
        cwd: dir,
        assistants: ['codex'],
        codexHooks: false,
      });

      await applyInitPlan(plan);
      await applyInitPlan(await planInit({ cwd: dir, assistants: ['codex'], codexHooks: false }));

      const agents = await readFile(join(dir, 'AGENTS.md'), 'utf8');

      expect(agents).toContain('# Project Rules');
      expect(agents).toContain('Keep this line.');
      expect(agents.match(/<!-- BEGIN AMG MANAGED BLOCK -->/g)).toHaveLength(1);
      expect(agents.match(/<!-- END AMG MANAGED BLOCK -->/g)).toHaveLength(1);
    });
  });

  it('adds gitignore entries once', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, '.gitignore'), 'node_modules\n');

      await applyInitPlan(await planInit({ cwd: dir, assistants: [], codexHooks: false }));
      await applyInitPlan(await planInit({ cwd: dir, assistants: [], codexHooks: false }));

      const gitignore = await readFile(join(dir, '.gitignore'), 'utf8');

      expect(gitignore.match(/\.amg\/config\.local\.json/g)).toHaveLength(1);
      expect(gitignore.match(/\.amg\/context-pack\.md/g)).toHaveLength(1);
      expect(gitignore.match(/\.amg\/context-pack-\*\.md/g)).toHaveLength(1);
    });
  });

  it('does not replace an existing config file', async () => {
    await withTempDir(async (dir) => {
      const existingConfig = `${JSON.stringify({ version: 1, agents: { codex: 'node_agent_codex' } }, null, 2)}\n`;
      await mkdir(join(dir, '.amg'), { recursive: true });
      await writeFile(join(dir, '.amg/config.json'), existingConfig);

      await applyInitPlan(await planInit({ cwd: dir, assistants: [], codexHooks: false }));

      await expect(readFile(join(dir, '.amg/config.json'), 'utf8')).resolves.toBe(existingConfig);
    });
  });

  it('writes a command contract that marks link as tenant-writing', async () => {
    await withTempDir(async (dir) => {
      await applyInitPlan(await planInit({ cwd: dir, assistants: [], codexHooks: false }));

      await expect(readFile(join(dir, '.amg/agent-command-contract.md'), 'utf8')).resolves.toContain(
        'amg link --yes',
      );
    });
  });

  it('writes agent guidance with objective-bearing recall commands and link prerequisites', async () => {
    await withTempDir(async (dir) => {
      await applyInitPlan(
        await planInit({
          cwd: dir,
          assistants: ['codex', 'claude', 'cursor'],
          codexHooks: false,
          claudeSkill: true,
          cursorCommands: true,
        }),
      );

      const files = [
        'AGENTS.md',
        '.claude/rules/amg.md',
        '.cursor/rules/amg.mdc',
        '.amg/agent-command-contract.md',
        '.claude/skills/amg-recall/SKILL.md',
        '.cursor/commands/amg-recall.md',
      ];

      for (const file of files) {
        const text = await readFile(join(dir, file), 'utf8');
        expect(text).toContain('amg recall --objective');
        expect(text).toContain('--format markdown');
        expect(text).not.toContain('pnpm exec amg');
        expect(text).not.toContain('npx amg');
        expect(text).not.toContain('pnpm amg:');
      }

      const agents = await readFile(join(dir, 'AGENTS.md'), 'utf8');
      expect(agents).toContain('after `amg link --yes` has written `.amg/config.json` defaults');
      expect(agents).toContain('explicit `--workspace-id`, `--project-id`, and `--agent-id` overrides');

      const contract = await readFile(join(dir, '.amg/agent-command-contract.md'), 'utf8');
      expect(contract).toContain('During Implementation');
      expect(contract).toContain('amg task create');
      expect(contract).toContain('amg decide');
      expect(contract).toContain('Supersedes prior guidance about');
      expect(contract).toContain('AMG is not a diary');
    });
  });

  it('installs the full Codex hook matrix when codexHooks is true', async () => {
    await withTempDir(async (dir) => {
      await applyInitPlan(await planInit({ cwd: dir, assistants: ['codex'], codexHooks: true }));

      const expected = [
        ['.codex/config.example.toml', 'codex_hooks'],
        ['.codex/hooks/session-start.mjs', 'SessionStart'],
        ['.codex/hooks/user-prompt-submit.mjs', 'UserPromptSubmit'],
        ['.codex/hooks/pre-tool-use.mjs', 'PreToolUse'],
        ['.codex/hooks/permission-request.mjs', 'PermissionRequest'],
        ['.codex/hooks/post-tool-use.mjs', 'PostToolUse'],
        ['.codex/hooks/stop.mjs', 'Stop'],
      ] as const;

      for (const [file, marker] of expected) {
        const text = await readFile(join(dir, file), 'utf8');
        expect(text).toContain(marker);
        expect(text.toLowerCase()).toContain('amg');
      }

      const config = await readFile(join(dir, '.codex/config.example.toml'), 'utf8');
      expect(config).toContain('hooks.SessionStart');
      expect(config).toContain('hooks.UserPromptSubmit');
      expect(config).toContain('hooks.PreToolUse');
      expect(config).toContain('hooks.PermissionRequest');
      expect(config).toContain('hooks.PostToolUse');
      expect(config).toContain('hooks.Stop');
    });
  });

  it('writes a codex hook wrapper that forwards hook stdin to codex-hook', async () => {
    await withTempDir(async (dir) => {
      await applyInitPlan(await planInit({ cwd: dir, assistants: ['codex'], codexHooks: true }));

      const hook = await readFile(join(dir, '.codex/hooks/session-start.mjs'), 'utf8');

      expect(hook).toContain("readFileSync(0, 'utf8')");
      expect(hook).toContain('codex-hook');
      expect(hook).toContain('AMG_CODEX_HOOK_EVENT');
      expect(hook).toContain('result.status !== 0');
      expect(hook).toContain('JSON.stringify({ continue: true })');
    });
  });

  it('writes selected assistant files', async () => {
    await withTempDir(async (dir) => {
      await applyInitPlan(
        await planInit({
          cwd: dir,
          assistants: ['claude', 'cursor'],
          codexHooks: false,
        }),
      );

      await expect(readFile(join(dir, 'CLAUDE.md'), 'utf8')).resolves.toContain('@AGENTS.md');
      await expect(readFile(join(dir, '.cursor/rules/amg.mdc'), 'utf8')).resolves.toContain('Agent Memory Graph');
    });
  });
});

describe('runInitCommand', () => {
  it('prints dry-run JSON paths and writes nothing', async () => {
    await withTempDir(async (dir) => {
      const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await runInitCommand({
        cwd: dir,
        assistants: 'codex,cursor',
        dryRun: true,
        codexHooks: false,
      });

      const output = write.mock.calls.map(([chunk]) => String(chunk)).join('');
      write.mockRestore();

      expect(JSON.parse(output)).toMatchObject({
        dryRun: true,
        paths: expect.arrayContaining(['AGENTS.md', '.cursor/rules/amg.mdc']),
      });
      expect(await readOptional(join(dir, 'AGENTS.md'))).toBeUndefined();
      expect(await readOptional(join(dir, '.cursor/rules/amg.mdc'))).toBeUndefined();
    });
  });

  it('rejects unsupported assistant values with a clear error', async () => {
    await withTempDir(async (dir) => {
      await expect(
        runInitCommand({
          cwd: dir,
          assistants: 'codex,unknown',
          dryRun: true,
          codexHooks: false,
        }),
      ).rejects.toThrow('Unsupported assistant "unknown". Expected one of: codex, claude, cursor.');
    });
  });
});
