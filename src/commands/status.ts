import { loadAmgConfig } from '../config/load.js';
import { readFlxblContext, type FlxblContext } from '../flxbl/context.js';
import { formatError, redactSecrets, secretValuesFromEnv } from '../output/secrets.js';

const MIN_SCHEMA_VERSION = '1.3.0';
const EXPECTED_SCHEMA_NAME = 'AgentMemoryGraph';

export const STATUS_COMMANDS = [
  'init',
  'status',
  'link',
  'recall',
  'remember',
  'export-context',
  'task:create',
  'task:list',
  'decide',
  'codex-hook',
] as const;

export type StatusCommandName = (typeof STATUS_COMMANDS)[number];

export type AmgStatus = {
  configured: boolean;
  safeToUse: boolean;
  tenant?: FlxblContext['tenant'];
  commands: StatusCommandName[];
  warnings: string[];
};

export type StatusContextReader = () => Promise<FlxblContext>;

export type GetAmgStatusOptions = {
  cwd: string;
  env?: Partial<Record<string, string | undefined>>;
  readContext?: StatusContextReader;
};

export async function getAmgStatus({
  cwd,
  env = process.env,
  readContext = readFlxblContext,
}: GetAmgStatusOptions): Promise<AmgStatus> {
  const warnings: string[] = [];
  const secrets = secretValuesFromEnv(env);
  const { runtime } = await loadAmgConfig({ cwd, env });

  if (!runtime.tenantId) warnings.push('Missing required server env: FLXBL_TENANT_ID');
  if (!runtime.apiKey) warnings.push('Missing required server env: FLXBL_API_KEY');

  if (warnings.length > 0) {
    return {
      configured: false,
      safeToUse: false,
      commands: [...STATUS_COMMANDS],
      warnings,
    };
  }

  try {
    const context = await readContext();
    const schemaWarnings = schemaCompatibilityWarnings(context.tenant);

    return {
      configured: true,
      safeToUse: schemaWarnings.length === 0,
      tenant: context.tenant,
      commands: [...STATUS_COMMANDS],
      warnings: schemaWarnings,
    };
  } catch (error) {
    return {
      configured: true,
      safeToUse: false,
      commands: [...STATUS_COMMANDS],
      warnings: [formatError(error, secrets)],
    };
  }
}

export function renderStatusText(status: AmgStatus): string {
  const lines = [
    `AMG configured: ${status.configured ? 'yes' : 'no'}`,
    `AMG safe to use: ${status.safeToUse ? 'yes' : 'no'}`,
  ];

  if (status.tenant?.schemaName) {
    lines.push(
      `Schema: ${status.tenant.schemaName}${status.tenant.schemaVersion ? ` ${status.tenant.schemaVersion}` : ''}`,
    );
  }

  if (status.commands.length > 0) {
    lines.push(`Commands: ${status.commands.map((command) => `amg ${displayCommandName(command)}`).join(', ')}`);
  }

  for (const warning of status.warnings) {
    lines.push(`Warning: ${redactSecrets(warning)}`);
  }

  return `${lines.join('\n')}\n`;
}

function displayCommandName(command: StatusCommandName): string {
  return command.replaceAll(':', ' ');
}

function schemaCompatibilityWarnings(tenant: FlxblContext['tenant']): string[] {
  const warnings: string[] = [];

  if (!tenant) {
    return ['Unable to read FLXBL tenant context.'];
  }

  if (tenant.schemaName !== EXPECTED_SCHEMA_NAME) {
    warnings.push(`Expected schemaName ${EXPECTED_SCHEMA_NAME}, received ${tenant.schemaName ?? 'unknown'}.`);
  }

  if (!tenant.schemaVersion || compareSemver(tenant.schemaVersion, MIN_SCHEMA_VERSION) < 0) {
    warnings.push(`Expected schemaVersion at least ${MIN_SCHEMA_VERSION}, received ${tenant.schemaVersion ?? 'unknown'}.`);
  }

  if (tenant.schemaStatus && tenant.schemaStatus !== 'ACTIVE') {
    warnings.push(`Expected schemaStatus ACTIVE, received ${tenant.schemaStatus}.`);
  }

  return warnings;
}

function compareSemver(left: string, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);

  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index] - rightParts[index];
    if (difference !== 0) return difference;
  }

  return 0;
}

function parseSemver(version: string): [number, number, number] {
  const [major = '0', minor = '0', patch = '0'] = version.split('.');
  return [Number(major) || 0, Number(minor) || 0, Number(patch) || 0];
}
