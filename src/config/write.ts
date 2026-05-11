import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { AmgConfigSchema, type AmgConfig } from './schema.js';

export async function writeAmgConfig(path: string, config: AmgConfig): Promise<void> {
  const validated = AmgConfigSchema.parse(config);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(validated, null, 2)}\n`);
}
