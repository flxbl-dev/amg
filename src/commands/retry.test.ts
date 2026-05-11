import { describe, expect, it, vi } from 'vitest';

import { withReadRetry } from './recall.js';

describe('withReadRetry', () => {
  it('retries throttling errors twice before returning the read result', async () => {
    const read = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('ThrottlerException: slow down'))
      .mockRejectedValueOnce(new Error('Too Many Requests'))
      .mockResolvedValueOnce('context pack');

    await expect(withReadRetry(read, { delaysMs: [0, 0] })).resolves.toBe('context pack');
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('does not retry unauthorized or other non-throttling errors', async () => {
    const error = new Error('Unauthorized');
    const read = vi.fn<() => Promise<string>>().mockRejectedValue(error);

    await expect(withReadRetry(read, { delaysMs: [0, 0] })).rejects.toThrow('Unauthorized');
    expect(read).toHaveBeenCalledTimes(1);
  });
});
