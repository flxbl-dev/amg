export const AMG_GITIGNORE_ENTRIES = ['.amg/config.local.json', '.amg/context-pack.md', '.amg/context-pack-*.md'] as const;

export function addGitignoreEntries(existing: string | undefined): string {
  const base = existing ?? '';
  const lines = base.split(/\r?\n/);
  const existingEntries = new Set(lines.map((line) => line.trim()).filter(Boolean));
  const missingEntries = AMG_GITIGNORE_ENTRIES.filter((entry) => !existingEntries.has(entry));

  if (missingEntries.length === 0) {
    return ensureTrailingNewline(base);
  }

  const prefix = base.trim().length > 0 ? ensureTrailingNewline(base) : '';
  return `${prefix}${missingEntries.join('\n')}\n`;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}
