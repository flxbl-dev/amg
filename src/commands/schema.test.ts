import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it, vi } from 'vitest';

import { runSchemaExportCommand } from './schema.js';

const execFileAsync = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'amg-schema-export-'));

  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('runSchemaExportCommand', () => {
  it('exports the packaged canonical schema without FLXBL env', async () => {
    await withTempDir(async (dir) => {
      const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        await runSchemaExportCommand({
          cwd: dir,
          output: './amg-flxbl-schema.json',
          force: false,
        });

        const exported = JSON.parse(await readFile(join(dir, 'amg-flxbl-schema.json'), 'utf8')) as {
          name?: string;
          version?: string;
        };
        const output = write.mock.calls.map(([chunk]) => String(chunk)).join('');

        expect(exported).toMatchObject({
          name: 'AgentMemoryGraph',
          version: '1.0.0',
        });
        expect(output).toContain('Exported AMG FLXBL schema');
        expect(output).toContain('platform.flxbl.dev');
        expect(output).toContain('amg status --format json');
      } finally {
        write.mockRestore();
      }
    });
  });

  it('creates parent directories for the exported schema', async () => {
    await withTempDir(async (dir) => {
      const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        await runSchemaExportCommand({
          cwd: dir,
          output: 'nested/flxbl/schema.json',
        });

        const exported = JSON.parse(await readFile(join(dir, 'nested/flxbl/schema.json'), 'utf8')) as {
          name?: string;
        };

        expect(exported.name).toBe('AgentMemoryGraph');
      } finally {
        write.mockRestore();
      }
    });
  });

  it('refuses to overwrite existing files by default', async () => {
    await withTempDir(async (dir) => {
      const outputPath = join(dir, 'flxbl/schema.json');
      await mkdir(join(dir, 'flxbl'), { recursive: true });
      await writeFile(outputPath, '{"name":"Existing"}\n', 'utf8');

      await expect(
        runSchemaExportCommand({
          cwd: dir,
          output: 'flxbl/schema.json',
        }),
      ).rejects.toThrow(/Refusing to overwrite existing file.*--force/);

      await expect(readFile(outputPath, 'utf8')).resolves.toBe('{"name":"Existing"}\n');
    });
  });

  it('overwrites existing files when force is true', async () => {
    await withTempDir(async (dir) => {
      const outputPath = join(dir, 'flxbl/schema.json');
      await mkdir(join(dir, 'flxbl'), { recursive: true });
      await writeFile(outputPath, '{"name":"Existing"}\n', 'utf8');
      const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      try {
        await runSchemaExportCommand({
          cwd: dir,
          output: 'flxbl/schema.json',
          force: true,
        });

        const exported = JSON.parse(await readFile(outputPath, 'utf8')) as {
          name?: string;
          version?: string;
        };

        expect(exported).toMatchObject({
          name: 'AgentMemoryGraph',
          version: '1.0.0',
        });
      } finally {
        write.mockRestore();
      }
    });
  });

  it('resolves the packaged schema from the bundled CLI layout', async () => {
    await withTempDir(async (dir) => {
      await execFileAsync('pnpm', ['build'], {
        cwd: packageRoot,
      });

      const outputPath = join(dir, 'bundle-schema.json');
      const { stdout } = await execFileAsync('node', [
        join(packageRoot, 'dist/bin/amg.js'),
        'schema',
        'export',
        '--output',
        outputPath,
      ]);
      const exported = JSON.parse(await readFile(outputPath, 'utf8')) as {
        name?: string;
        version?: string;
      };

      expect(stdout).toContain('Exported AMG FLXBL schema');
      expect(exported).toMatchObject({
        name: 'AgentMemoryGraph',
        version: '1.0.0',
      });
    });
  }, 20_000);
});
