import type { CodexHookEventName, HookSafetyDecision } from './types.js';

type SafetyInput = {
  eventName: CodexHookEventName;
  toolName?: string;
  command?: string;
  env: Partial<Record<string, string | undefined>>;
};

const SECRET_REFERENCE_PATTERN =
  /(?:\.env(?:\.[\w.-]+)?|\b(?:FLXBL_API_KEY|AMG_DEMO_SEED_SECRET|FLXBL_ACCESS_TOKEN|FLXBL_REFRESH_TOKEN)\b|\bAuthorization\b)/i;

const SECRET_OUTPUT_COMMAND_PATTERN =
  /\b(?:cat|sed|awk|grep|rg|less|more|tail|head|printenv|env|echo|printf)\b|\b(?:node\s+-e|python(?:3)?\s+-c|ruby\s+-e|perl\s+-e|sh\s+-c|bash\s+-c|zsh\s+-c)\b/i;

const AMG_SEED_PATTERN =
  /\bpnpm\s+(?:--silent\s+)?exec\s+amg\s+seed\b|\bpnpm\s+(?:--silent\s+)?(?:run\s+)?amg:seed\b|\bnpm\s+run\s+amg:seed\b/i;
const AMG_REMEMBER_PATTERN =
  /\bpnpm\s+(?:--silent\s+)?exec\s+amg\s+remember\b|\bpnpm\s+(?:--silent\s+)?(?:run\s+)?amg:remember\b|\bnpm\s+run\s+amg:remember\b/i;

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

  if (AMG_SEED_PATTERN.test(command) && input.env.AMG_HOOK_ALLOW_TENANT_WRITES !== '1') {
    return {
      behavior: 'deny',
      message:
        'Blocked by AMG hook policy: AMG seed writes to FLXBL and requires AMG_HOOK_ALLOW_TENANT_WRITES=1.',
    };
  }

  if (AMG_REMEMBER_PATTERN.test(command)) {
    return {
      behavior: 'warn',
      message:
        'AMG remember writes persistent FLXBL data; proceed only for durable facts, decisions, constraints, workflow rules, supersessions, or reusable bug lessons.',
    };
  }

  return { behavior: 'allow' };
}
