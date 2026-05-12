import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { loadEnvFiles, type EnvMap } from './env-files.js';
import { AmgConfigSchema, type AmgConfig } from './schema.js';

export type AmgRuntimeConfig = {
  instanceUrl?: string;
  tenantId?: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
};

export type LoadAmgConfigOptions = {
  cwd: string;
  env?: Partial<Record<string, string | undefined>>;
};

export type LoadAmgConfigResult = {
  config: AmgConfig;
  runtime: AmgRuntimeConfig;
  paths: {
    configPath: string;
    localConfigPath: string;
  };
};

type RawConfig = Record<string, unknown>;

export async function loadAmgConfig({ cwd, env = process.env }: LoadAmgConfigOptions): Promise<LoadAmgConfigResult> {
  const paths = {
    configPath: join(cwd, '.amg/config.json'),
    localConfigPath: join(cwd, '.amg/config.local.json'),
  };

  const base = await readOptionalJson(paths.configPath);
  const local = await readOptionalJson(paths.localConfigPath);
  const config = AmgConfigSchema.parse(mergeConfig(base, local));
  const envFiles = loadEnvFiles(cwd);
  const runtimeEnv = mergeEnv(envFiles, env);

  return {
    config,
    runtime: runtimeFromConfigAndEnv(config, runtimeEnv),
    paths,
  };
}

function mergeEnv(fileEnv: EnvMap, providedEnv: EnvMap): EnvMap {
  const merged: EnvMap = { ...fileEnv };

  for (const [key, value] of Object.entries(providedEnv)) {
    if (value !== undefined) merged[key] = value;
  }

  return merged;
}

function mergeConfig(base: RawConfig, local: RawConfig): RawConfig {
  return {
    ...base,
    ...local,
    agents: {
      ...(isRecord(base.agents) ? base.agents : {}),
      ...(isRecord(local.agents) ? local.agents : {}),
    },
  };
}

async function readOptionalJson(path: string): Promise<RawConfig> {
  try {
    const text = await readFile(path, 'utf8');
    const parsed = JSON.parse(text) as unknown;

    if (!isRecord(parsed)) {
      throw new Error(`Expected ${path} to contain a JSON object.`);
    }

    return parsed;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return {};
    throw error;
  }
}

function runtimeFromConfigAndEnv(
  config: AmgConfig,
  env: Partial<Record<string, string | undefined>>,
): AmgRuntimeConfig {
  const runtime: AmgRuntimeConfig = {};
  setIfPresent(runtime, 'instanceUrl', env.FLXBL_INSTANCE_URL ?? config.instanceUrl);
  setIfPresent(runtime, 'tenantId', env.FLXBL_TENANT_ID ?? config.tenantId);
  setIfPresent(runtime, 'apiKey', env.FLXBL_API_KEY);
  setIfPresent(runtime, 'accessToken', env.FLXBL_ACCESS_TOKEN);
  setIfPresent(runtime, 'refreshToken', env.FLXBL_REFRESH_TOKEN);
  return runtime;
}

function setIfPresent<T extends keyof AmgRuntimeConfig>(
  target: AmgRuntimeConfig,
  key: T,
  value: AmgRuntimeConfig[T],
) {
  if (value) target[key] = value;
}

function isRecord(value: unknown): value is RawConfig {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
