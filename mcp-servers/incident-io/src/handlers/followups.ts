import { z } from 'zod';
import { defineHandlers, type HttpClient } from '@apolitical-assistant/mcp-shared';
import type { FollowUp } from './types.js';

// ==================== SCHEMAS ====================

export const ListFollowupsSchema = z.object({
  incidentId: z.string().optional().describe('Filter by specific incident'),
  status: z
    .enum(['outstanding', 'completed', 'all'])
    .optional()
    .default('outstanding')
    .describe('Follow-up status filter'),
  assigneeId: z.string().optional().describe('Filter by assignee user ID'),
});

export const CreateFollowupSchema = z.object({
  incidentId: z.string().describe('The incident ID to create follow-up for'),
  title: z.string().describe('Follow-up title'),
  description: z.string().optional().describe('Follow-up description'),
  assigneeId: z.string().optional().describe('User ID to assign the follow-up to'),
});

// ==================== HANDLERS ====================

export async function handleListFollowups(
  args: z.infer<typeof ListFollowupsSchema>,
  client: HttpClient
): Promise<unknown> {
  const params: Record<string, string | number | boolean> = {};
  if (args.incidentId) params['incident_id'] = args.incidentId;

  const data = await client.get<{ follow_ups: FollowUp[] }>('/follow_ups', params);

  let followups = data.follow_ups;

  // Apply status filter
  if (args.status !== 'all') {
    followups = followups.filter((f) => {
      if (args.status === 'outstanding') {
        return f.status.name.toLowerCase() !== 'completed';
      }
      return f.status.name.toLowerCase() === 'completed';
    });
  }

  if (args.assigneeId) {
    followups = followups.filter((f) => f.assignee?.email === args.assigneeId);
  }

  return followups.map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    status: f.status.name,
    assignee: f.assignee?.name,
    incident: f.incident.name,
    createdAt: f.created_at,
    completedAt: f.completed_at,
  }));
}

export async function handleCreateFollowup(
  args: z.infer<typeof CreateFollowupSchema>,
  client: HttpClient
): Promise<unknown> {
  const body: Record<string, unknown> = {
    incident_id: args.incidentId,
    title: args.title,
  };

  if (args.description) body.description = args.description;
  if (args.assigneeId) body.assignee_id = args.assigneeId;

  const data = await client.post<{ follow_up: FollowUp }>('/follow_ups', body);

  return {
    success: true,
    followUpId: data.follow_up.id,
    title: data.follow_up.title,
    status: data.follow_up.status.name,
    assignee: data.follow_up.assignee?.name,
  };
}

// ==================== HANDLER BUNDLE ====================

export const followupDefs = defineHandlers<HttpClient>()({
  incidentio_list_followups: {
    description:
      'List follow-up actions from incidents. Useful for tracking outstanding action items that need completion.',
    schema: ListFollowupsSchema,
    handler: handleListFollowups,
  },
  incidentio_create_followup: {
    description: 'Create a follow-up action item for an incident.',
    schema: CreateFollowupSchema,
    handler: handleCreateFollowup,
  },
});
