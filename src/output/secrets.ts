const SECRET_ASSIGNMENT_NAMES = [
  'FLXBL_API_KEY',
  'AMG_DEMO_SEED_SECRET',
  'FLXBL_ACCESS_TOKEN',
  'FLXBL_REFRESH_TOKEN',
] as const;

export function secretValuesFromEnv(source: Partial<Record<string, string | undefined>> = process.env): string[] {
  return SECRET_ASSIGNMENT_NAMES.map((name) => source[name]).filter(
    (value): value is string => Boolean(value && value.length >= 6),
  );
}

export function redactSecrets(input: string, secrets: string[] = secretValuesFromEnv()): string {
  let output = input;

  for (const secret of secrets) {
    output = output.split(secret).join('[REDACTED]');
  }

  for (const name of SECRET_ASSIGNMENT_NAMES) {
    output = output.replace(new RegExp(`(${name}=)[^\\s]+`, 'g'), '$1[REDACTED]');
  }

  output = output.replace(/(Authorization:\s*Bearer\s+)[^\s]+/gi, '$1[REDACTED]');

  return output;
}

export function formatError(error: unknown, secrets: string[] = secretValuesFromEnv()): string {
  const message = error instanceof Error ? error.message : String(error);
  return redactSecrets(message, secrets);
}
