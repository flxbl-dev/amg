import { readFileSync } from 'node:fs';

import { dispatchCodexHook } from '../hooks/dispatcher.js';
import type { CodexHookInput } from '../hooks/types.js';

export async function runCodexHookCommand(): Promise<void> {
  const raw = readFileSync(0, 'utf8');
  const input = JSON.parse(raw) as CodexHookInput;
  const output = await dispatchCodexHook(input);

  if (Object.keys(output).length > 0) {
    process.stdout.write(`${JSON.stringify(output)}\n`);
  }
}
