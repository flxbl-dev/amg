import { describe, expect, it, vi } from 'vitest';

import { createAmgProgram } from './program.js';

describe('createAmgProgram', () => {
  it('registers the public top-level commands in order', () => {
    const program = createAmgProgram();

    expect(program.commands.map((command) => command.name())).toEqual([
      'init',
      'status',
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
    expect(helpText).toContain('codex-hook');
    expect(helpText).not.toContain('amg:recall');
    expect(helpText).not.toContain('pnpm amg');
  });

  it('runs status as parseable json without throwing when env is missing', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const previousExitCode = process.exitCode;

    await createAmgProgram({ cwd: process.cwd(), env: {} }).parseAsync(['node', 'amg', 'status', '--format', 'json']);

    const output = write.mock.calls.map(([chunk]) => String(chunk)).join('');

    expect(JSON.parse(output)).toMatchObject({
      configured: false,
      safeToUse: false,
    });
    expect(process.exitCode).toBe(1);

    process.exitCode = previousExitCode;
    write.mockRestore();
  });
});
