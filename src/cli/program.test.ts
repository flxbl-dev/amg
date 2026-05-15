import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createAmgProgram } from './program.js';

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'amg-program-'));

  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('createAmgProgram', () => {
  it('registers the public top-level commands in order', () => {
    const program = createAmgProgram();

    expect(program.commands.map((command) => command.name())).toEqual([
      'init',
      'status',
      'schema',
      'link',
      'recall',
      'remember',
      'export-context',
      'task',
      'decide',
      'codex-hook',
    ]);
  });

  it('renders help for the public amg binary without legacy pnpm commands', () => {
    const helpText = createAmgProgram().helpInformation();

    expect(helpText).toContain('Usage: amg [options] [command]');
    expect(helpText).toContain('init');
    expect(helpText).toContain('schema');
    expect(helpText).toContain('codex-hook');
    expect(helpText).not.toContain('amg:recall');
    expect(helpText).not.toContain('pnpm amg');
  });

  it('renders help for schema export options', () => {
    const schemaCommand = createAmgProgram().commands.find((command) => command.name() === 'schema');
    const exportCommand = schemaCommand?.commands.find((command) => command.name() === 'export');

    expect(schemaCommand).toBeDefined();
    expect(exportCommand).toBeDefined();

    const helpText = exportCommand!.helpInformation();

    expect(helpText).toContain('Usage: amg schema export');
    expect(helpText).toContain('--output <path>');
    expect(helpText).toContain('--force');
  });

  it('runs status as parseable json without throwing when env is missing', async () => {
    await withTempDir(async (dir) => {
      const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const previousExitCode = process.exitCode;

      try {
        await createAmgProgram({ cwd: dir, env: {} }).parseAsync(['node', 'amg', 'status', '--format', 'json']);

        const output = write.mock.calls.map(([chunk]) => String(chunk)).join('');

        expect(JSON.parse(output)).toMatchObject({
          configured: false,
          safeToUse: false,
        });
        expect(process.exitCode).toBe(1);
      } finally {
        process.exitCode = previousExitCode;
        write.mockRestore();
      }
    });
  });
});
