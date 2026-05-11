import { describe, expect, it } from 'vitest';

import { evaluateHookSafety } from './policy.js';

describe('evaluateHookSafety', () => {
  it('denies direct FLXBL API key output', () => {
    expect(
      evaluateHookSafety({
        eventName: 'PreToolUse',
        toolName: 'Bash',
        command: 'echo $FLXBL_API_KEY',
        env: {},
      }),
    ).toMatchObject({
      behavior: 'deny',
    });
  });

  it('denies portable AMG seed by default', () => {
    expect(
      evaluateHookSafety({
        eventName: 'PreToolUse',
        toolName: 'Bash',
        command: 'pnpm exec amg seed',
        env: {},
      }),
    ).toMatchObject({
      behavior: 'deny',
    });
  });

  it('warns for portable AMG remember commands', () => {
    expect(
      evaluateHookSafety({
        eventName: 'PreToolUse',
        toolName: 'Bash',
        command: 'pnpm exec amg remember --title "Durable rule"',
        env: {},
      }),
    ).toMatchObject({
      behavior: 'warn',
    });
  });
});
