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
        command: 'amg seed',
        env: {},
      }),
    ).toMatchObject({
      behavior: 'deny',
    });
  });

  it('denies AMG seed when it is run after a shell separator', () => {
    expect(
      evaluateHookSafety({
        eventName: 'PreToolUse',
        toolName: 'Bash',
        command: 'cd repo && amg seed',
        env: {},
      }),
    ).toMatchObject({
      behavior: 'deny',
    });
  });

  it('denies AMG seed with env and assignment prefixes', () => {
    for (const command of [
      'env FOO=bar amg seed',
      'env AMG_HOOK_ALLOW_TENANT_WRITES=0 amg seed',
      'FOO=bar amg seed',
      'sudo env FOO=bar amg seed',
    ]) {
      expect(
        evaluateHookSafety({
          eventName: 'PreToolUse',
          toolName: 'Bash',
          command,
          env: {},
        }),
      ).toMatchObject({
        behavior: 'deny',
      });
    }
  });

  it('denies AMG seed inside shell wrappers and command substitutions', () => {
    for (const command of [
      'sh -c "pnpm exec amg seed"',
      'bash -lc "pnpm exec amg seed"',
      'bash --norc -c "pnpm exec amg seed"',
      'echo "$(pnpm exec amg seed)"',
    ]) {
      expect(
        evaluateHookSafety({
          eventName: 'PreToolUse',
          toolName: 'Bash',
          command,
          env: {},
        }),
      ).toMatchObject({
        behavior: 'deny',
      });
    }
  });

  it('warns for non-seed tenant-writing AMG commands', () => {
    for (const command of [
      'amg link --workspace "FLXBL Labs" --project AMG --yes',
      'amg task create --title "Investigate empty graph entities"',
      'amg decide --task-id "$TASK_ID" --title "Persist context packs on request"',
      'amg recall --objective "Prepare task context" --persist',
      'amg export-context --objective "Prepare handoff" --output .amg/context-pack.md --persist',
      'pnpm exec amg task create --title x',
      'pnpm amg:decide --task-id "$TASK_ID" --title x',
      'bash --rcfile /tmp/bashrc -c "pnpm exec amg remember --title x"',
    ]) {
      expect(
        evaluateHookSafety({
          eventName: 'PreToolUse',
          toolName: 'Bash',
          command,
          env: {},
        }),
      ).toMatchObject({
        behavior: 'warn',
      });
    }
  });

  it('allows read-only or local-only AMG commands', () => {
    for (const command of [
      'amg init --assistants codex,cursor',
      'amg schema export --output ./amg-flxbl-schema.json',
      'amg status --format json',
      'amg recall --objective "Prepare task context"',
      'amg export-context --objective "Prepare handoff" --output .amg/context-pack.md',
      'amg task list',
      'pnpm amg:task:list',
    ]) {
      expect(
        evaluateHookSafety({
          eventName: 'PreToolUse',
          toolName: 'Bash',
          command,
          env: {},
        }),
      ).toEqual({
        behavior: 'allow',
      });
    }
  });

  it('keeps denying legacy AMG seed command forms', () => {
    for (const command of ['pnpm exec amg seed', 'pnpm amg:seed', 'npm run amg:seed']) {
      expect(
        evaluateHookSafety({
          eventName: 'PreToolUse',
          toolName: 'Bash',
          command,
          env: {},
        }),
      ).toMatchObject({
        behavior: 'deny',
      });
    }
  });

  it('allows benign commands that mention AMG seed as text', () => {
    for (const command of [
      'rg "amg seed" docs',
      'echo "amg seed"',
      'echo "foo; amg seed"',
      "printf '%s\\n' 'amg seed'",
    ]) {
      expect(
        evaluateHookSafety({
          eventName: 'PreToolUse',
          toolName: 'Bash',
          command,
          env: {},
        }),
      ).toEqual({
        behavior: 'allow',
      });
    }
  });

  it('warns for portable AMG remember commands', () => {
    expect(
      evaluateHookSafety({
        eventName: 'PreToolUse',
        toolName: 'Bash',
        command: 'amg remember --title "Durable rule"',
        env: {},
      }),
    ).toMatchObject({
      behavior: 'warn',
    });
  });

  it('warns for AMG remember inside shell wrappers', () => {
    expect(
      evaluateHookSafety({
        eventName: 'PreToolUse',
        toolName: 'Bash',
        command: 'bash -lc "pnpm exec amg remember --title x"',
        env: {},
      }),
    ).toMatchObject({
      behavior: 'warn',
    });
  });

  it('warns for AMG remember with env prefixes', () => {
    expect(
      evaluateHookSafety({
        eventName: 'PreToolUse',
        toolName: 'Bash',
        command: 'env FOO=bar amg remember --title x --body y',
        env: {},
      }),
    ).toMatchObject({
      behavior: 'warn',
    });
  });

  it('allows benign commands that mention AMG remember as text', () => {
    for (const command of ['rg "amg remember" docs', 'echo "amg remember --title example"']) {
      expect(
        evaluateHookSafety({
          eventName: 'PreToolUse',
          toolName: 'Bash',
          command,
          env: {},
        }),
      ).toEqual({
        behavior: 'allow',
      });
    }
  });
});
