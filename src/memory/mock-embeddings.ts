export function deterministicEmbedding(input: string, dimensions = 8): number[] {
  return Array.from({ length: Math.max(0, dimensions) }, (_, index) => {
    let hash = index + 17;

    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i) + index) % 1000;
    }

    return Number((hash / 1000).toFixed(3));
  });
}
