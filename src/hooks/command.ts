import { execFile } from 'node:child_process';

import type { HookCommandRunner } from './types.js';

export const runHookCommand: HookCommandRunner = (command, args, options) =>
  new Promise((resolve) => {
    execFile(command, args, { cwd: options.cwd, env: options.env, encoding: 'utf8' }, (error, stdout, stderr) => {
      const errorCode = (error as NodeJS.ErrnoException | null)?.code;
      const status = typeof errorCode === 'number' ? errorCode : error ? 1 : 0;

      resolve({
        status,
        stdout: stdout ?? '',
        stderr: stderr ?? '',
      });
    });
  });
