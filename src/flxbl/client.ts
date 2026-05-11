import { createFlxblClient } from '../generated/client.js';

export type CreateAmgFlxblClientOptions = {
  instanceUrl?: string;
  apiKey?: string;
};

export function createAmgFlxblClient({ instanceUrl, apiKey }: CreateAmgFlxblClientOptions) {
  if (!instanceUrl) {
    throw new Error('Cannot create AMG FLXBL client: missing instanceUrl.');
  }

  if (!apiKey) {
    throw new Error('Cannot create AMG FLXBL client: missing apiKey.');
  }

  return createFlxblClient({ instanceUrl, apiKey });
}
