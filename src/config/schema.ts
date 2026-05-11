import { z } from 'zod';

export const AgentKindSchema = z.enum(['codex', 'claude-code', 'cursor', 'custom']);

export const AmgConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    instanceUrl: z.string().url().optional(),
    tenantId: z.string().min(1).optional(),
    workspaceId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    defaultAgent: AgentKindSchema.optional(),
    agents: z.record(AgentKindSchema, z.string().min(1)).default({}),
  })
  .passthrough();

export type AmgConfig = z.infer<typeof AmgConfigSchema>;
export type AgentKind = z.infer<typeof AgentKindSchema>;
