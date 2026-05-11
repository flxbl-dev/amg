import type { Agent, Project, Workspace } from '../generated/entities.js';
import type { TypedFlxblClient } from '../generated/index.js';
import type { AgentKind } from '../config/schema.js';

export type IdentityNode = {
  id: string;
};

export type IdentityClient = {
  findWorkspaceBySlug(slug: string): Promise<IdentityNode | null>;
  createWorkspace(input: Pick<Workspace, 'name' | 'slug'>): Promise<IdentityNode>;
  findProjectBySlug(slug: string): Promise<IdentityNode | null>;
  createProject(input: Pick<Project, 'name' | 'slug' | 'status'>): Promise<IdentityNode>;
  findAgentByKind(kind: AgentKind): Promise<IdentityNode | null>;
  createAgent(input: Pick<Agent, 'name' | 'kind' | 'description'>): Promise<IdentityNode>;
  createHasProject(
    workspaceId: string,
    projectId: string,
    properties: {
      createdAt: string;
      role: 'primary';
      reason: string;
    },
  ): Promise<unknown>;
  createUsesAgent(
    projectId: string,
    agentId: string,
    properties: {
      createdAt: string;
      purpose: string;
      defaultForProject: boolean;
      strength: number;
    },
  ): Promise<unknown>;
};

export type LinkIdentitiesOptions = {
  workspaceName: string;
  projectName: string;
  agentKinds: AgentKind[];
  now?: Date;
};

export type LinkedIdentityConfig = {
  workspaceId: string;
  projectId: string;
  defaultAgent: AgentKind;
  agents: Partial<Record<AgentKind, string>>;
};

export async function linkIdentities(
  client: IdentityClient,
  { workspaceName, projectName, agentKinds, now = new Date() }: LinkIdentitiesOptions,
): Promise<LinkedIdentityConfig> {
  if (agentKinds.length === 0) {
    throw new Error('amg link requires at least one agent kind.');
  }

  const createdAt = now.toISOString();
  const workspaceSlug = slugify(workspaceName);
  const projectSlug = slugify(projectName);
  const workspace =
    (await client.findWorkspaceBySlug(workspaceSlug)) ??
    (await client.createWorkspace({
      name: workspaceName,
      slug: workspaceSlug,
    }));
  const project =
    (await client.findProjectBySlug(projectSlug)) ??
    (await client.createProject({
      name: projectName,
      slug: projectSlug,
      status: 'active',
    }));
  const agents: Partial<Record<AgentKind, string>> = {};
  const defaultAgent = agentKinds[0];

  await client.createHasProject(workspace.id, project.id, {
    createdAt,
    role: 'primary',
    reason: 'Created through amg link',
  });

  for (const kind of agentKinds) {
    const agent =
      (await client.findAgentByKind(kind)) ??
      (await client.createAgent({
        name: agentDisplayName(kind),
        kind,
        description: `Agent Memory Graph identity for ${kind}.`,
      }));

    agents[kind] = agent.id;

    await client.createUsesAgent(project.id, agent.id, {
      createdAt,
      purpose: 'coding-agent memory',
      defaultForProject: kind === defaultAgent,
      strength: 1,
    });
  }

  return {
    workspaceId: workspace.id,
    projectId: project.id,
    defaultAgent,
    agents,
  };
}

export function generatedIdentityClient(client: TypedFlxblClient): IdentityClient {
  return {
    findWorkspaceBySlug: async (slug) => client.workspaces.findFirst({ where: { slug } }),
    createWorkspace: async (input) => client.workspaces.create(input),
    findProjectBySlug: async (slug) => client.projects.findFirst({ where: { slug } }),
    createProject: async (input) => client.projects.create(input),
    findAgentByKind: async (kind) => client.agents.findFirst({ where: { kind } }),
    createAgent: async (input) => client.agents.create(input),
    createHasProject: async (workspaceId, projectId, properties) =>
      client.workspaces.relationships(workspaceId).hasProject.create(projectId, properties),
    createUsesAgent: async (projectId, agentId, properties) =>
      client.projects.relationships(projectId).usesAgent.create(agentId, properties),
  };
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function agentDisplayName(kind: AgentKind): string {
  return kind
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
