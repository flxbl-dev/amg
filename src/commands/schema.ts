import { constants } from 'node:fs';
import { access, copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type RunSchemaExportCommandOptions = {
  cwd: string;
  output: string;
  force?: boolean;
};

const PACKAGED_SCHEMA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../templates/flxbl/schema.json');

export async function runSchemaExportCommand(options: RunSchemaExportCommandOptions): Promise<{ output: string }> {
  const outputPath = resolve(options.cwd, options.output);

  if (!options.force && (await pathExists(outputPath))) {
    throw new Error(`Refusing to overwrite existing file at ${outputPath}. Re-run with --force to replace it.`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await copyFile(PACKAGED_SCHEMA_PATH, outputPath);

  process.stdout.write(
    [
      `Exported AMG FLXBL schema to ${outputPath}.`,
      'Import it in platform.flxbl.dev, then verify the tenant with amg status --format json.',
      '',
    ].join('\n'),
  );

  return { output: outputPath };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
