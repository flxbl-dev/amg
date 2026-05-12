export type FlxblTenantContext = {
  schemaName?: string;
  schemaVersion?: string;
  schemaStatus?: string;
  instanceUrl?: string;
};

export type FlxblContext = {
  tenant?: FlxblTenantContext;
};

export type ReadFlxblContextOptions = {
  instanceUrl: string;
  apiKey: string;
};

type TenantSchemaResponse = {
  name?: string;
  version?: string;
  status?: string;
};

export async function readFlxblContext({ instanceUrl, apiKey }: ReadFlxblContextOptions): Promise<FlxblContext> {
  const baseUrl = instanceUrl.replace(/\/+$/, '');
  const response = await fetch(
    `${baseUrl}/api/v1/schemas?includeEntities=true&includeFields=true&includeRelationships=true`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`FLXBL schema context request failed with HTTP ${response.status}.`);
  }

  const schemas = (await response.json()) as TenantSchemaResponse[];
  const active = schemas.find((schema) => schema.status === 'ACTIVE');
  if (!active) return { tenant: undefined };

  return {
    tenant: {
      schemaName: active.name,
      schemaVersion: active.version,
      schemaStatus: active.status,
      instanceUrl: baseUrl,
    },
  };
}
