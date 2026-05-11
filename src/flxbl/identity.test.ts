import { describe, expect, it, vi, type Mock } from 'vitest';

import { linkIdentities, slugify, type IdentityClient } from './identity.js';

const now = new Date('2026-05-11T10:00:00.000Z');
type MockIdentityClient = {
  [K in keyof IdentityClient]: Mock;
};

describe('slugify', () => {
  it('normalizes names into lowercase dash-separated slugs', () => {
    expect(slugify('  Agent Memory Graph / Phase 2!  ')).toBe('agent-memory-graph-phase-2');
  });
});

describe('linkIdentities', () => {
  it('creates missing identities and relationships with edge fields', async () => {
    const client = createMockIdentityClient();

    client.findWorkspaceBySlug.mockResolvedValue(null);
    client.findProjectBySlug.mockResolvedValue(null);
    client.findAgentByKind.mockResolvedValue(null);
    client.createWorkspace.mockResolvedValue({ id: 'node_workspace' });
    client.createProject.mockResolvedValue({ id: 'node_project' });
    client.createAgent.mockResolvedValue({ id: 'node_agent_codex' });

    const result = await linkIdentities(client, {
      workspaceName: 'Agent Memory Graph',
      projectName: 'Phase 2 Adoption Layer',
      agentKinds: ['codex'],
      now,
    });

    expect(client.createWorkspace).toHaveBeenCalledWith({
      name: 'Agent Memory Graph',
      slug: 'agent-memory-graph',
    });
    expect(client.createProject).toHaveBeenCalledWith({
      name: 'Phase 2 Adoption Layer',
      slug: 'phase-2-adoption-layer',
      status: 'active',
    });
    expect(client.createAgent).toHaveBeenCalledWith({
      name: 'Codex',
      kind: 'codex',
      description: 'Agent Memory Graph identity for codex.',
    });
    expect(client.createHasProject).toHaveBeenCalledWith('node_workspace', 'node_project', {
      createdAt: now.toISOString(),
      role: 'primary',
      reason: 'Created through amg link',
    });
    expect(client.createUsesAgent).toHaveBeenCalledWith('node_project', 'node_agent_codex', {
      createdAt: now.toISOString(),
      purpose: 'coding-agent memory',
      defaultForProject: true,
      strength: 1,
    });
    expect(result).toEqual({
      workspaceId: 'node_workspace',
      projectId: 'node_project',
      defaultAgent: 'codex',
      agents: {
        codex: 'node_agent_codex',
      },
    });
  });

  it('reuses existing identities and still links relationships', async () => {
    const client = createMockIdentityClient();

    client.findWorkspaceBySlug.mockResolvedValue({ id: 'node_workspace_existing' });
    client.findProjectBySlug.mockResolvedValue({ id: 'node_project_existing' });
    client.findAgentByKind.mockResolvedValue({ id: 'node_agent_existing' });

    const result = await linkIdentities(client, {
      workspaceName: 'Agent Memory Graph',
      projectName: 'Phase 2 Adoption Layer',
      agentKinds: ['codex'],
      now,
    });

    expect(client.createWorkspace).not.toHaveBeenCalled();
    expect(client.createProject).not.toHaveBeenCalled();
    expect(client.createAgent).not.toHaveBeenCalled();
    expect(client.createHasProject).toHaveBeenCalledWith(
      'node_workspace_existing',
      'node_project_existing',
      expect.objectContaining({ role: 'primary' }),
    );
    expect(client.createUsesAgent).toHaveBeenCalledWith(
      'node_project_existing',
      'node_agent_existing',
      expect.objectContaining({ defaultForProject: true }),
    );
    expect(result).toEqual({
      workspaceId: 'node_workspace_existing',
      projectId: 'node_project_existing',
      defaultAgent: 'codex',
      agents: {
        codex: 'node_agent_existing',
      },
    });
  });
});

function createMockIdentityClient(): MockIdentityClient {
  return {
    findWorkspaceBySlug: vi.fn(),
    createWorkspace: vi.fn(),
    findProjectBySlug: vi.fn(),
    createProject: vi.fn(),
    findAgentByKind: vi.fn(),
    createAgent: vi.fn(),
    createHasProject: vi.fn(),
    createUsesAgent: vi.fn(),
  };
}
