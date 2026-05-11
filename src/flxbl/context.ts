export type FlxblTenantContext = {
  schemaName?: string;
  schemaVersion?: string;
  schemaStatus?: string;
  instanceUrl?: string;
};

export type FlxblContext = {
  tenant?: FlxblTenantContext;
};

export async function readFlxblContext(): Promise<FlxblContext> {
  return { tenant: undefined };
}
