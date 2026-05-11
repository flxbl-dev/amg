import { dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

import { loadAmgConfig } from '../config/load.js';
import { createAmgFlxblClient } from '../flxbl/client.js';
import type { ContextPackResult } from '../memory/types.js';
import { buildContextPackRequest, type ContextPackRequestOptions, recallContextPack } from './recall.js';

export type RunExportContextCommandOptions = ContextPackRequestOptions & {
  output: string;
  persist?: boolean;
};

export async function runExportContextCommand(options: RunExportContextCommandOptions): Promise<{
  output: string;
  pack: ContextPackResult;
}> {
  const request = await buildContextPackRequest(options);
  const { runtime } = await loadAmgConfig({ cwd: options.cwd, env: options.env });
  const client = createAmgFlxblClient({ instanceUrl: runtime.instanceUrl, apiKey: runtime.apiKey });
  const pack = await recallContextPack({
    client,
    request,
    now: new Date(),
    persist: options.persist,
  });
  const body = (request.format ?? 'markdown') === 'json' ? `${JSON.stringify(pack, null, 2)}\n` : pack.markdown;

  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, body, 'utf8');
  process.stdout.write(`${JSON.stringify({ output: options.output, contextPackId: pack.contextPackId }, null, 2)}\n`);

  return { output: options.output, pack };
}
