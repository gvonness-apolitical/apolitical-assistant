import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { HttpClient } from '@apolitical-assistant/mcp-shared';
import type { Incident } from './types.js';

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

// ==================== TOOL DEFINITIONS ====================

export const incidentTools: Tool[] = [
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
];

// ==================== HANDLERS ====================

export async function handleListIncidents(
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
    incidents = incidents.filter((i) => allowedStatuses.includes(i.incident_status.category.toLowerCase()));
  }

  if (args.severity) {
    incidents = incidents.filter(
      (i) => i.severity?.name?.toLowerCase() === args.severity?.toLowerCase()
    );
  }

  return incidents.map((i) => ({
    id: i.id,
    name: i.name,
    status: i.incident_status.name,
    severity: i.severity?.name,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    lead: i.incident_role_assignments?.find((r) => r.role.name === 'Incident Lead')?.assignee?.name,
  }));
}

export async function handleGetIncident(
  args: z.infer<typeof GetIncidentSchema>,
  client: HttpClient
): Promise<unknown> {
  const data = await client.get<{ incident: Incident }>(`/incidents/${args.incidentId}`);
  return data.incident;
}

export async function handleCreateIncident(
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
    status: data.incident.incident_status.name,
    severity: data.incident.severity?.name,
    permalink: data.incident.permalink,
  };
}

export async function handleUpdateIncident(
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
    status: data.incident.incident_status.name,
    severity: data.incident.severity?.name,
  };
}
