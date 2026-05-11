import { AgentKindSchema, type AgentKind } from '../config/schema.js';
import { loadAmgConfig } from '../config/load.js';
import { writeAmgConfig } from '../config/write.js';
import { createAmgFlxblClient } from '../flxbl/client.js';
import {
  generatedIdentityClient,
  linkIdentities as linkIdentitiesWithClient,
  type IdentityClient,
  type LinkedIdentityConfig,
} from '../flxbl/identity.js';

export type RunLinkCommandOptions = {
  cwd: string;
  env?: Partial<Record<string, string | undefined>>;
  workspace: string;
  project: string;
  agents: string;
  yes: boolean;
  linkIdentities?: (client: IdentityClient, options: LinkIdentitiesCommandOptions) => Promise<LinkedIdentityConfig>;
};

export type LinkIdentitiesCommandOptions = {
  workspaceName: string;
  projectName: string;
  agentKinds: AgentKind[];
};

export async function runLinkCommand(options: RunLinkCommandOptions): Promise<void> {
  if (!options.yes) {
    throw new Error(
      'Refusing to run: amg link writes Workspace, Project, Agent, HAS_PROJECT, and USES_AGENT records. Re-run with --yes to confirm.',
    );
  }

  const agentKinds = parseAgentKinds(options.agents);
  const { config, runtime, paths } = await loadAmgConfig({
    cwd: options.cwd,
    env: options.env,
  });
  const linkOptions = {
    workspaceName: options.workspace,
    projectName: options.project,
    agentKinds,
  };
  let linked: LinkedIdentityConfig;

  if (options.linkIdentities) {
    linked = await options.linkIdentities(createPlaceholderIdentityClient(), linkOptions);
  } else {
    const flxblClient = createAmgFlxblClient({
      instanceUrl: runtime.instanceUrl,
      apiKey: runtime.apiKey,
    });
    linked = await linkIdentitiesWithClient(generatedIdentityClient(flxblClient), linkOptions);
  }

  await writeAmgConfig(paths.configPath, {
    ...config,
    workspaceId: linked.workspaceId,
    projectId: linked.projectId,
    defaultAgent: linked.defaultAgent,
    agents: {
      ...config.agents,
      ...linked.agents,
    },
  });
}

function createPlaceholderIdentityClient(): IdentityClient {
  const fail = async () => {
    throw new Error('Injected amg link mode received a placeholder IdentityClient.');
  };

  return {
    findWorkspaceBySlug: fail,
    createWorkspace: fail,
    findProjectBySlug: fail,
    createProject: fail,
    findAgentByKind: fail,
    createAgent: fail,
    createHasProject: fail,
    createUsesAgent: fail,
  };
}

function parseAgentKinds(value: string): AgentKind[] {
  const parsed = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => AgentKindSchema.parse(part));

  if (parsed.length === 0) {
    throw new Error('amg link requires at least one agent kind in --agents.');
  }

  return parsed;
}
