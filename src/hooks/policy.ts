import type { CodexHookEventName, HookSafetyDecision } from './types.js';

type SafetyInput = {
  eventName: CodexHookEventName;
  toolName?: string;
  command?: string;
  env: Partial<Record<string, string | undefined>>;
};

type AmgTenantWriteAction = 'seed' | 'link' | 'remember' | 'task create' | 'decide' | 'recall --persist' | 'export-context --persist';
type AmgAction = AmgTenantWriteAction | 'init' | 'schema export' | 'status' | 'recall' | 'export-context' | 'task list';

const SECRET_REFERENCE_PATTERN =
  /(?:\.env(?:\.[\w.-]+)?|\b(?:FLXBL_API_KEY|AMG_DEMO_SEED_SECRET|FLXBL_ACCESS_TOKEN|FLXBL_REFRESH_TOKEN)\b|\bAuthorization\b)/i;

const SECRET_OUTPUT_COMMAND_PATTERN =
  /\b(?:cat|sed|awk|grep|rg|less|more|tail|head|printenv|env|echo|printf)\b|\b(?:node\s+-e|python(?:3)?\s+-c|ruby\s+-e|perl\s+-e|sh\s+-c|bash\s+-c|zsh\s+-c)\b/i;

const MAX_SHELL_SCAN_DEPTH = 6;
const WARNING_TENANT_WRITE_ACTIONS: AmgTenantWriteAction[] = [
  'link',
  'remember',
  'task create',
  'decide',
  'recall --persist',
  'export-context --persist',
];

export function evaluateHookSafety(input: SafetyInput): HookSafetyDecision {
  const command = input.command ?? '';

  if (input.toolName && input.toolName !== 'Bash' && input.toolName !== 'apply_patch') {
    return { behavior: 'allow' };
  }

  if (SECRET_REFERENCE_PATTERN.test(command) && SECRET_OUTPUT_COMMAND_PATTERN.test(command)) {
    return {
      behavior: 'deny',
      message: 'Blocked by AMG hook policy: do not print dotenv files or secret-bearing config.',
    };
  }

  if (commandRunsAmgAction(command, 'seed') && input.env.AMG_HOOK_ALLOW_TENANT_WRITES !== '1') {
    return {
      behavior: 'deny',
      message:
        'Blocked by AMG hook policy: AMG seed writes to FLXBL and requires AMG_HOOK_ALLOW_TENANT_WRITES=1.',
    };
  }

  const tenantWriteAction = WARNING_TENANT_WRITE_ACTIONS.find((action) => commandRunsAmgAction(command, action));

  if (tenantWriteAction) {
    return {
      behavior: 'warn',
      message:
        `AMG ${tenantWriteAction} writes persistent FLXBL data; proceed only for intentional durable facts, decisions, constraints, workflow rules, supersessions, tasks, or context packs.`,
    };
  }

  return { behavior: 'allow' };
}

function commandRunsAmgAction(command: string, action: AmgAction, depth = 0): boolean {
  if (depth > MAX_SHELL_SCAN_DEPTH) {
    return false;
  }

  if (
    extractCommandSubstitutions(command).some((substitution) =>
      commandRunsAmgAction(substitution, action, depth + 1),
    )
  ) {
    return true;
  }

  return splitShellSegments(command).some((segment) =>
    tokensRunAmgAction(stripPrefixTokens(tokenizeShellWords(segment)), action, depth),
  );
}

function splitShellSegments(command: string): string[] {
  const segments: string[] = [];
  let segmentStart = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;
  let commandSubstitutionDepth = 0;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    const nextChar = command[index + 1];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && !singleQuoted) {
      escaped = true;
      continue;
    }

    if (commandSubstitutionDepth > 0) {
      if (char === '$' && nextChar === '(') {
        commandSubstitutionDepth += 1;
        index += 1;
        continue;
      }

      if (char === ')') {
        commandSubstitutionDepth -= 1;
      }

      continue;
    }

    if (char === "'" && !doubleQuoted) {
      singleQuoted = !singleQuoted;
      continue;
    }

    if (char === '"' && !singleQuoted) {
      doubleQuoted = !doubleQuoted;
      continue;
    }

    if (!singleQuoted && char === '$' && nextChar === '(') {
      commandSubstitutionDepth = 1;
      index += 1;
      continue;
    }

    if (singleQuoted || doubleQuoted) {
      continue;
    }

    if (char === ';') {
      pushShellSegment(segments, command.slice(segmentStart, index));
      segmentStart = index + 1;
      continue;
    }

    if (char === '&' && nextChar === '&') {
      pushShellSegment(segments, command.slice(segmentStart, index));
      index += 1;
      segmentStart = index + 1;
      continue;
    }

    if (char === '|') {
      pushShellSegment(segments, command.slice(segmentStart, index));
      if (nextChar === '|') {
        index += 1;
      }
      segmentStart = index + 1;
    }
  }

  pushShellSegment(segments, command.slice(segmentStart));
  return segments;
}

function pushShellSegment(segments: string[], segment: string): void {
  const trimmed = segment.trim();

  if (trimmed) {
    segments.push(trimmed);
  }
}

function extractCommandSubstitutions(command: string): string[] {
  const substitutions: string[] = [];
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    const nextChar = command[index + 1];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && !singleQuoted) {
      escaped = true;
      continue;
    }

    if (char === "'" && !doubleQuoted) {
      singleQuoted = !singleQuoted;
      continue;
    }

    if (char === '"' && !singleQuoted) {
      doubleQuoted = !doubleQuoted;
      continue;
    }

    if (!singleQuoted && char === '$' && nextChar === '(') {
      const substitution = readCommandSubstitution(command, index + 2);

      if (!substitution) {
        continue;
      }

      substitutions.push(substitution.content);
      index = substitution.endIndex;
    }
  }

  return substitutions;
}

function readCommandSubstitution(
  source: string,
  startIndex: number,
): { content: string; endIndex: number } | undefined {
  let depth = 1;
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && !singleQuoted) {
      escaped = true;
      continue;
    }

    if (char === "'" && !doubleQuoted) {
      singleQuoted = !singleQuoted;
      continue;
    }

    if (char === '"' && !singleQuoted) {
      doubleQuoted = !doubleQuoted;
      continue;
    }

    if (!singleQuoted && char === '$' && nextChar === '(') {
      depth += 1;
      index += 1;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === ')') {
      depth -= 1;

      if (depth === 0) {
        return {
          content: source.slice(startIndex, index),
          endIndex: index,
        };
      }
    }
  }

  return undefined;
}

function tokenizeShellWords(segment: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;

  for (const char of segment) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && !singleQuoted) {
      escaped = true;
      continue;
    }

    if (char === "'" && !doubleQuoted) {
      singleQuoted = !singleQuoted;
      continue;
    }

    if (char === '"' && !singleQuoted) {
      doubleQuoted = !doubleQuoted;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && /\s/.test(char)) {
      pushToken(tokens, current);
      current = '';
      continue;
    }

    current += char;
  }

  pushToken(tokens, current);
  return tokens;
}

function pushToken(tokens: string[], token: string): void {
  if (token) {
    tokens.push(token);
  }
}

function stripPrefixTokens(tokens: string[]): string[] {
  const remaining = [...tokens];
  let changed = true;

  while (changed) {
    changed = false;

    if (remaining[0]?.toLowerCase() === 'sudo') {
      remaining.shift();
      changed = true;
      continue;
    }

    if (remaining[0]?.toLowerCase() === 'env') {
      remaining.shift();
      changed = true;

      while (remaining[0] && isEnvironmentAssignment(remaining[0])) {
        remaining.shift();
      }

      continue;
    }

    if (remaining[0] && isEnvironmentAssignment(remaining[0])) {
      remaining.shift();
      changed = true;
    }
  }

  return remaining;
}

function isEnvironmentAssignment(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function tokensRunAmgAction(tokens: string[], action: AmgAction, depth: number): boolean {
  if (tokens.length === 0) {
    return false;
  }

  const normalized = tokens.map((token) => token.toLowerCase());

  if (tokensMatchAmgAction(normalized, 0, action)) {
    return true;
  }

  if (normalized[0] === 'pnpm') {
    const firstCommandIndex = normalized[1] === '--silent' ? 2 : 1;

    if (
      normalized[firstCommandIndex] === 'exec' &&
      normalized[firstCommandIndex + 1] === 'amg' &&
      tokensMatchAmgAction(normalized, firstCommandIndex + 1, action)
    ) {
      return true;
    }

    if (
      normalized[firstCommandIndex] === 'run' &&
      tokensMatchScriptAction(normalized, firstCommandIndex + 1, action)
    ) {
      return true;
    }

    if (tokensMatchScriptAction(normalized, firstCommandIndex, action)) {
      return true;
    }
  }

  if (normalized[0] === 'npm' && normalized[1] === 'run' && tokensMatchScriptAction(normalized, 2, action)) {
    return true;
  }

  if (isShellRunner(normalized[0])) {
    const script = findShellScript(tokens);

    if (script && commandRunsAmgAction(script, action, depth + 1)) {
      return true;
    }
  }

  return false;
}

function tokensMatchAmgAction(tokens: string[], amgIndex: number, action: AmgAction): boolean {
  if (tokens[amgIndex] !== 'amg') {
    return false;
  }

  if (action === 'task create' || action === 'task list') {
    return tokens[amgIndex + 1] === 'task' && tokens[amgIndex + 2] === action.split(' ')[1];
  }

  if (action === 'schema export') {
    return tokens[amgIndex + 1] === 'schema' && tokens[amgIndex + 2] === 'export';
  }

  if (action === 'recall --persist') {
    return tokens[amgIndex + 1] === 'recall' && tokens.slice(amgIndex + 2).includes('--persist');
  }

  if (action === 'export-context --persist') {
    return tokens[amgIndex + 1] === 'export-context' && tokens.slice(amgIndex + 2).includes('--persist');
  }

  if (action === 'recall') {
    return tokens[amgIndex + 1] === 'recall' && !tokens.slice(amgIndex + 2).includes('--persist');
  }

  if (action === 'export-context') {
    return tokens[amgIndex + 1] === 'export-context' && !tokens.slice(amgIndex + 2).includes('--persist');
  }

  return tokens[amgIndex + 1] === action;
}

function tokensMatchScriptAction(tokens: string[], scriptIndex: number, action: AmgAction): boolean {
  if (tokens[scriptIndex] !== scriptNameForAction(action)) {
    return false;
  }

  if (action === 'recall --persist' || action === 'export-context --persist') {
    return tokens.slice(scriptIndex + 1).includes('--persist');
  }

  if (action === 'recall' || action === 'export-context') {
    return !tokens.slice(scriptIndex + 1).includes('--persist');
  }

  return true;
}

function scriptNameForAction(action: AmgAction): string {
  return `amg:${action.replace(/\s+/g, ':').replace(/^recall:--persist$/, 'recall').replace(/^export-context:--persist$/, 'export-context')}`;
}

function isShellRunner(token: string | undefined): boolean {
  return token === 'sh' || token === 'bash' || token === 'zsh';
}

function findShellScript(tokens: string[]): string | undefined {
  for (let index = 1; index < tokens.length - 1; index += 1) {
    const option = tokens[index];

    if (option === '--') {
      return undefined;
    }

    if (!option.startsWith('-')) {
      continue;
    }

    if (option === '-c' || (option.startsWith('-') && !option.startsWith('--') && option.includes('c'))) {
      return tokens[index + 1];
    }
  }

  return undefined;
}
