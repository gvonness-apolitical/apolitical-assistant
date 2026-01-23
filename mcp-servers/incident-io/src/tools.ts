import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  createJsonResponse,
  createErrorResponse,
  type ToolResponse,
  type HttpClient,
} from '@apolitical-assistant/mcp-shared';
import type { IncidentIoContext } from './index.js';

// ==================== SCHEMAS ====================

export const ListIncidentsSchema = z.object({
  status: z
    .enum(['active', 'resolved', 'all'])
    .optional()
    .default('all')
    .describe('Filter by incident status'),
  severity: z.string().optional().describe('Filter by severity level (e.g., "sev1", "sev2")'),
  limit: z.number().optional().default(25).describe('Maximum number of results'),
});

export const GetIncidentSchema = z.object({
  incidentId: z.string().describe('The incident ID'),
});

export const ListFollowupsSchema = z.object({
  incidentId: z.string().optional().describe('Filter by specific incident'),
  status: z
    .enum(['outstanding', 'completed', 'all'])
    .optional()
    .default('outstanding')
    .describe('Follow-up status filter'),
  assigneeId: z.string().optional().describe('Filter by assignee user ID'),
});

export const GetPostmortemSchema = z.object({
  incidentId: z.string().describe('The incident ID to get postmortem for'),
});

export const CreateIncidentSchema = z.object({
  name: z.string().describe('Incident title/name'),
  summary: z.string().optional().describe('Brief summary of the incident'),
  severity: z.string().optional().describe('Severity ID (get from severities API)'),
  incidentTypeId: z.string().optional().describe('Incident type ID'),
  mode: z
    .enum(['standard', 'retrospective', 'test'])
    .optional()
    .default('standard')
    .describe('Incident mode'),
});

export const UpdateIncidentSchema = z.object({
  incidentId: z.string().describe('The incident ID to update'),
  name: z.string().optional().describe('New incident name'),
  summary: z.string().optional().describe('Updated summary'),
  severity: z.string().optional().describe('New severity ID'),
});

export const CreateFollowupSchema = z.object({
  incidentId: z.string().describe('The incident ID to create follow-up for'),
  title: z.string().describe('Follow-up title'),
  description: z.string().optional().describe('Follow-up description'),
  assigneeId: z.string().optional().describe('User ID to assign the follow-up to'),
});

// ==================== TOOL DEFINITIONS ====================

export function createTools(): Tool[] {
  return [
    {
      name: 'incidentio_list_incidents',
      description:
        'List incidents from Incident.io. Can filter by status (active/resolved) and severity level. Returns incident details including title, status, severity, and timestamps.',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'resolved', 'all'],
            default: 'all',
            description: 'Filter by incident status',
          },
          severity: {
            type: 'string',
            description: 'Filter by severity level (e.g., "sev1", "sev2")',
          },
          limit: {
            type: 'number',
            default: 25,
            description: 'Maximum number of results',
          },
        },
      },
    },
    {
      name: 'incidentio_get_incident',
      description:
        'Get detailed information about a specific incident including full timeline, affected services, and team members involved.',
      inputSchema: {
        type: 'object',
        properties: {
          incidentId: {
            type: 'string',
            description: 'The incident ID',
          },
        },
        required: ['incidentId'],
      },
    },
    {
      name: 'incidentio_list_followups',
      description:
        'List follow-up actions from incidents. Useful for tracking outstanding action items that need completion.',
      inputSchema: {
        type: 'object',
        properties: {
          incidentId: {
            type: 'string',
            description: 'Filter by specific incident',
          },
          status: {
            type: 'string',
            enum: ['outstanding', 'completed', 'all'],
            default: 'outstanding',
            description: 'Follow-up status filter',
          },
          assigneeId: {
            type: 'string',
            description: 'Filter by assignee user ID',
          },
        },
      },
    },
    {
      name: 'incidentio_get_postmortem',
      description:
        'Get the postmortem/retrospective document for a resolved incident. Contains root cause analysis, timeline, and learnings.',
      inputSchema: {
        type: 'object',
        properties: {
          incidentId: {
            type: 'string',
            description: 'The incident ID to get postmortem for',
          },
        },
        required: ['incidentId'],
      },
    },
    {
      name: 'incidentio_create_incident',
      description:
        'Create a new incident in Incident.io. Returns the created incident with its ID and status.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Incident title/name',
          },
          summary: {
            type: 'string',
            description: 'Brief summary of the incident',
          },
          severity: {
            type: 'string',
            description: 'Severity ID (use incidentio_list_severities to get available options)',
          },
          incidentTypeId: {
            type: 'string',
            description: 'Incident type ID',
          },
          mode: {
            type: 'string',
            enum: ['standard', 'retrospective', 'test'],
            default: 'standard',
            description:
              'Incident mode: standard (real incident), retrospective (past incident), test (for testing)',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'incidentio_update_incident',
      description: 'Update an existing incident (name, summary, severity).',
      inputSchema: {
        type: 'object',
        properties: {
          incidentId: {
            type: 'string',
            description: 'The incident ID to update',
          },
          name: {
            type: 'string',
            description: 'New incident name',
          },
          summary: {
            type: 'string',
            description: 'Updated summary',
          },
          severity: {
            type: 'string',
            description: 'New severity ID',
          },
        },
        required: ['incidentId'],
      },
    },
    {
      name: 'incidentio_create_followup',
      description: 'Create a follow-up action item for an incident.',
      inputSchema: {
        type: 'object',
        properties: {
          incidentId: {
            type: 'string',
            description: 'The incident ID to create follow-up for',
          },
          title: {
            type: 'string',
            description: 'Follow-up title',
          },
          description: {
            type: 'string',
            description: 'Follow-up description',
          },
          assigneeId: {
            type: 'string',
            description: 'User ID to assign the follow-up to',
          },
        },
        required: ['incidentId', 'title'],
      },
    },
    {
      name: 'incidentio_list_severities',
      description:
        'List available severity levels. Use this to get severity IDs for creating/updating incidents.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

// ==================== API RESPONSE TYPES ====================

interface Incident {
  id: string;
  name: string;
  status: { category: string; name: string };
  severity?: { name: string };
  created_at: string;
  updated_at: string;
  incident_role_assignments?: Array<{
    role: { name: string };
    assignee?: { name: string };
  }>;
  postmortem_document_url?: string;
  summary?: string;
  custom_field_entries?: Array<{
    custom_field: { name: string };
    values: Array<{ value_text?: string }>;
  }>;
  permalink?: string;
}

interface FollowUp {
  id: string;
  title: string;
  description?: string;
  status: { name: string };
  assignee?: { name: string; email: string };
  incident: { id: string; name: string };
  created_at: string;
  completed_at?: string;
}

interface Severity {
  id: string;
  name: string;
  description?: string;
  rank: number;
}

// ==================== HANDLERS ====================

async function handleListIncidents(
  args: z.infer<typeof ListIncidentsSchema>,
  client: HttpClient
): Promise<unknown> {
  const params: Record<string, string | number | boolean> = {};
  if (args.limit) params['page_size'] = args.limit;

  const data = await client.get<{ incidents: Incident[] }>('/incidents', params);

  let incidents = data.incidents;

  // Apply filters
  if (args.status !== 'all') {
    const statusMap: Record<string, string[]> = {
      active: ['triage', 'investigating', 'fixing', 'monitoring'],
      resolved: ['resolved', 'closed'],
    };
    const allowedStatuses = statusMap[args.status] || [];
    incidents = incidents.filter((i) =>
      allowedStatuses.includes(i.status.category.toLowerCase())
    );
  }

  if (args.severity) {
    incidents = incidents.filter(
      (i) => i.severity?.name?.toLowerCase() === args.severity?.toLowerCase()
    );
  }

  return incidents.map((i) => ({
    id: i.id,
    name: i.name,
    status: i.status.name,
    severity: i.severity?.name,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    lead: i.incident_role_assignments?.find((r) => r.role.name === 'Lead')?.assignee?.name,
  }));
}

async function handleGetIncident(
  args: z.infer<typeof GetIncidentSchema>,
  client: HttpClient
): Promise<unknown> {
  const data = await client.get<{ incident: Incident }>(`/incidents/${args.incidentId}`);
  return data.incident;
}

async function handleListFollowups(
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

async function handleGetPostmortem(
  args: z.infer<typeof GetPostmortemSchema>,
  client: HttpClient
): Promise<unknown> {
  const data = await client.get<{ incident: Incident }>(`/incidents/${args.incidentId}`);
  const incident = data.incident;

  // Try to get postmortem content from custom fields or summary
  return {
    incidentId: incident.id,
    incidentName: incident.name,
    postmortemUrl: incident.postmortem_document_url,
    summary: incident.summary,
    customFields: incident.custom_field_entries?.reduce(
      (acc, entry) => {
        acc[entry.custom_field.name] = entry.values
          .map((v) => v.value_text)
          .filter(Boolean)
          .join(', ');
        return acc;
      },
      {} as Record<string, string>
    ),
  };
}

async function handleCreateIncident(
  args: z.infer<typeof CreateIncidentSchema>,
  client: HttpClient
): Promise<unknown> {
  const body: Record<string, unknown> = {
    idempotency_key: `create-${Date.now()}`,
    visibility: 'public',
    name: args.name,
    mode: args.mode,
  };

  if (args.summary) body.summary = args.summary;
  if (args.severity) body.severity_id = args.severity;
  if (args.incidentTypeId) body.incident_type_id = args.incidentTypeId;

  const data = await client.post<{ incident: Incident }>('/incidents', body);

  return {
    success: true,
    incidentId: data.incident.id,
    name: data.incident.name,
    status: data.incident.status.name,
    severity: data.incident.severity?.name,
    permalink: data.incident.permalink,
  };
}

async function handleUpdateIncident(
  args: z.infer<typeof UpdateIncidentSchema>,
  client: HttpClient
): Promise<unknown> {
  const body: Record<string, unknown> = {};
  if (args.name) body.name = args.name;
  if (args.summary) body.summary = args.summary;
  if (args.severity) body.severity_id = args.severity;

  const data = await client.patch<{ incident: Incident }>(`/incidents/${args.incidentId}`, {
    incident: body,
  });

  return {
    success: true,
    incidentId: data.incident.id,
    name: data.incident.name,
    status: data.incident.status.name,
    severity: data.incident.severity?.name,
  };
}

async function handleCreateFollowup(
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

async function handleListSeverities(client: HttpClient): Promise<unknown> {
  const data = await client.get<{ severities: Severity[] }>('/severities');

  return data.severities.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    rank: s.rank,
  }));
}

// ==================== MAIN HANDLER ====================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: IncidentIoContext
): Promise<ToolResponse> {
  try {
    let result: unknown;

    switch (name) {
      case 'incidentio_list_incidents': {
        const parsed = ListIncidentsSchema.parse(args);
        result = await handleListIncidents(parsed, context.client);
        break;
      }

      case 'incidentio_get_incident': {
        const parsed = GetIncidentSchema.parse(args);
        result = await handleGetIncident(parsed, context.client);
        break;
      }

      case 'incidentio_list_followups': {
        const parsed = ListFollowupsSchema.parse(args);
        result = await handleListFollowups(parsed, context.client);
        break;
      }

      case 'incidentio_get_postmortem': {
        const parsed = GetPostmortemSchema.parse(args);
        result = await handleGetPostmortem(parsed, context.client);
        break;
      }

      case 'incidentio_create_incident': {
        const parsed = CreateIncidentSchema.parse(args);
        result = await handleCreateIncident(parsed, context.client);
        break;
      }

      case 'incidentio_update_incident': {
        const parsed = UpdateIncidentSchema.parse(args);
        result = await handleUpdateIncident(parsed, context.client);
        break;
      }

      case 'incidentio_create_followup': {
        const parsed = CreateFollowupSchema.parse(args);
        result = await handleCreateFollowup(parsed, context.client);
        break;
      }

      case 'incidentio_list_severities': {
        result = await handleListSeverities(context.client);
        break;
      }

      default:
        return createJsonResponse({ error: `Unknown tool: ${name}` });
    }

    return createJsonResponse(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
