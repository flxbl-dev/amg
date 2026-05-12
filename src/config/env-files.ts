import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type EnvMap = Partial<Record<string, string | undefined>>;

const DEFAULT_ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local'];

export function loadEnvFiles(cwd: string, files: string[] = DEFAULT_ENV_FILES): EnvMap {
  const loaded: EnvMap = {};

  for (const file of files) {
    const path = join(cwd, file);
    if (!existsSync(path)) continue;
    applyEnvFile(readFileSync(path, 'utf8'), loaded);
  }

  return loaded;
}

function applyEnvFile(contents: string, target: EnvMap): void {
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trimStart() : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    if (!isValidEnvKey(key)) continue;

    target[key] = parseEnvValue(normalized.slice(separatorIndex + 1).trim());
  }
}

function parseEnvValue(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  const commentIndex = value.indexOf(' #');
  return commentIndex >= 0 ? value.slice(0, commentIndex).trimEnd() : value;
}

function isValidEnvKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}
