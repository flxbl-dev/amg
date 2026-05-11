export const AMG_MANAGED_BLOCK_BEGIN = '<!-- BEGIN AMG MANAGED BLOCK -->';
export const AMG_MANAGED_BLOCK_END = '<!-- END AMG MANAGED BLOCK -->';

export function buildManagedBlock(content: string): string {
  return `${AMG_MANAGED_BLOCK_BEGIN}\n${content.trim()}\n${AMG_MANAGED_BLOCK_END}`;
}

export function upsertManagedBlock(existing: string | undefined, content: string): string {
  const block = buildManagedBlock(content);

  if (!existing || existing.trim().length === 0) {
    return `${block}\n`;
  }

  const beginIndex = existing.indexOf(AMG_MANAGED_BLOCK_BEGIN);
  const endIndex = existing.indexOf(AMG_MANAGED_BLOCK_END);

  if (beginIndex >= 0 && endIndex >= beginIndex) {
    const afterEndIndex = endIndex + AMG_MANAGED_BLOCK_END.length;
    return ensureTrailingNewline(`${existing.slice(0, beginIndex)}${block}${existing.slice(afterEndIndex)}`);
  }

  return `${ensureTrailingNewline(existing)}\n${block}\n`;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}
