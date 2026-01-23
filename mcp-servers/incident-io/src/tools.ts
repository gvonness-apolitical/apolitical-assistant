import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const INCIDENTIO_API_BASE = 'https://api.incident.io/v2';

// Schemas for tool inputs
const ListIncidentsSchema = z.object({
  status: z.enum(['active', 'resolved', 'all']).optional().default('all').describe('Filter by incident status'),
  severity: z.string().optional().describe('Filter by severity level (e.g., "sev1", "sev2")'),
  limit: z.number().optional().default(25).describe('Maximum number of results'),
});

const GetIncidentSchema = z.object({
  incidentId: z.string().describe('The incident ID'),
});

const ListFollowupsSchema = z.object({
  incidentId: z.string().optional().describe('Filter by specific incident'),
  status: z.enum(['outstanding', 'completed', 'all']).optional().default('outstanding').describe('Follow-up status filter'),
  assigneeId: z.string().optional().describe('Filter by assignee user ID'),
});

const GetPostmortemSchema = z.object({
  incidentId: z.string().describe('The incident ID to get postmortem for'),
});

const CreateIncidentSchema = z.object({
  name: z.string().describe('Incident title/name'),
  summary: z.string().optional().describe('Brief summary of the incident'),
  severity: z.string().optional().describe('Severity ID (get from severities API)'),
  incidentTypeId: z.string().optional().describe('Incident type ID'),
  mode: z.enum(['standard', 'retrospective', 'test']).optional().default('standard').describe('Incident mode'),
});

const UpdateIncidentSchema = z.object({
  incidentId: z.string().describe('The incident ID to update'),
  name: z.string().optional().describe('New incident name'),
  summary: z.string().optional().describe('Updated summary'),
  severity: z.string().optional().describe('New severity ID'),
});

const CreateFollowupSchema = z.object({
  incidentId: z.string().describe('The incident ID to create follow-up for'),
  title: z.string().describe('Follow-up title'),
  description: z.string().optional().describe('Follow-up description'),
  assigneeId: z.string().optional().describe('User ID to assign the follow-up to'),
});

export function createTools(): Tool[] {
  return [
    {
      name: 'incidentio_list_incidents',
      description: 'List incidents from Incident.io. Can filter by status (active/resolved) and severity level. Returns incident details including title, status, severity, and timestamps.',
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
      description: 'Get detailed information about a specific incident including full timeline, affected services, and team members involved.',
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
      description: 'List follow-up actions from incidents. Useful for tracking outstanding action items that need completion.',
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
      description: 'Get the postmortem/retrospective document for a resolved incident. Contains root cause analysis, timeline, and learnings.',
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
      description: 'Create a new incident in Incident.io. Returns the created incident with its ID and status.',
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
            description: 'Incident mode: standard (real incident), retrospective (past incident), test (for testing)',
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
      description: 'List available severity levels. Use this to get severity IDs for creating/updating incidents.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

async function apiRequest(
  endpoint: string,
  token: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT';
    params?: Record<string, string>;
    body?: Record<string, unknown>;
  } = {}
): Promise<unknown> {
  const { method = 'GET', params = {}, body } = options;
  const url = new URL(`${INCIDENTIO_API_BASE}${endpoint}`);

  if (method === 'GET') {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.append(key, value);
    });
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Incident.io API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  token: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    let result: unknown;

    switch (name) {
      case 'incidentio_list_incidents': {
        const parsed = ListIncidentsSchema.parse(args);
        const params: Record<string, string> = {};

        if (parsed.limit) params['page_size'] = parsed.limit.toString();

        const data = (await apiRequest('/incidents', token, { params })) as {
          incidents: Array<{
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
          }>;
        };

        let incidents = data.incidents;

        // Apply filters
        if (parsed.status !== 'all') {
          const statusMap: Record<string, string[]> = {
            active: ['triage', 'investigating', 'fixing', 'monitoring'],
            resolved: ['resolved', 'closed'],
          };
          const allowedStatuses = statusMap[parsed.status] || [];
          incidents = incidents.filter((i) =>
            allowedStatuses.includes(i.status.category.toLowerCase())
          );
        }

        if (parsed.severity) {
          incidents = incidents.filter(
            (i) => i.severity?.name?.toLowerCase() === parsed.severity?.toLowerCase()
          );
        }

        result = incidents.map((i) => ({
          id: i.id,
          name: i.name,
          status: i.status.name,
          severity: i.severity?.name,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
          lead: i.incident_role_assignments?.find((r) => r.role.name === 'Lead')?.assignee
            ?.name,
        }));
        break;
      }

      case 'incidentio_get_incident': {
        const parsed = GetIncidentSchema.parse(args);
        const data = (await apiRequest(`/incidents/${parsed.incidentId}`, token, {})) as {
          incident: unknown;
        };
        result = data.incident;
        break;
      }

      case 'incidentio_list_followups': {
        const parsed = ListFollowupsSchema.parse(args);
        const params: Record<string, string> = {};

        if (parsed.incidentId) params['incident_id'] = parsed.incidentId;

        const data = (await apiRequest('/follow_ups', token, { params })) as {
          follow_ups: Array<{
            id: string;
            title: string;
            description?: string;
            status: { name: string };
            assignee?: { name: string; email: string };
            incident: { id: string; name: string };
            created_at: string;
            completed_at?: string;
          }>;
        };

        let followups = data.follow_ups;

        // Apply status filter
        if (parsed.status !== 'all') {
          followups = followups.filter((f) => {
            if (parsed.status === 'outstanding') {
              return f.status.name.toLowerCase() !== 'completed';
            }
            return f.status.name.toLowerCase() === 'completed';
          });
        }

        if (parsed.assigneeId) {
          followups = followups.filter((f) => f.assignee?.email === parsed.assigneeId);
        }

        result = followups.map((f) => ({
          id: f.id,
          title: f.title,
          description: f.description,
          status: f.status.name,
          assignee: f.assignee?.name,
          incident: f.incident.name,
          createdAt: f.created_at,
          completedAt: f.completed_at,
        }));
        break;
      }

      case 'incidentio_get_postmortem': {
        const parsed = GetPostmortemSchema.parse(args);

        // First get the incident to find the postmortem
        const incidentData = (await apiRequest(
          `/incidents/${parsed.incidentId}`,
          token,
          {}
        )) as {
          incident: {
            id: string;
            name: string;
            postmortem_document_url?: string;
            summary?: string;
            custom_field_entries?: Array<{
              custom_field: { name: string };
              values: Array<{ value_text?: string }>;
            }>;
          };
        };

        const incident = incidentData.incident;

        // Try to get postmortem content from custom fields or summary
        result = {
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
        break;
      }

      case 'incidentio_create_incident': {
        const parsed = CreateIncidentSchema.parse(args);

        const body: Record<string, unknown> = {
          idempotency_key: `create-${Date.now()}`,
          visibility: 'public',
          name: parsed.name,
          mode: parsed.mode,
        };

        if (parsed.summary) body.summary = parsed.summary;
        if (parsed.severity) body.severity_id = parsed.severity;
        if (parsed.incidentTypeId) body.incident_type_id = parsed.incidentTypeId;

        const data = (await apiRequest('/incidents', token, {
          method: 'POST',
          body,
        })) as {
          incident: {
            id: string;
            name: string;
            status: { name: string };
            severity?: { name: string };
            permalink: string;
          };
        };

        result = {
          success: true,
          incidentId: data.incident.id,
          name: data.incident.name,
          status: data.incident.status.name,
          severity: data.incident.severity?.name,
          permalink: data.incident.permalink,
        };
        break;
      }

      case 'incidentio_update_incident': {
        const parsed = UpdateIncidentSchema.parse(args);

        const body: Record<string, unknown> = {};
        if (parsed.name) body.name = parsed.name;
        if (parsed.summary) body.summary = parsed.summary;
        if (parsed.severity) body.severity_id = parsed.severity;

        const data = (await apiRequest(`/incidents/${parsed.incidentId}`, token, {
          method: 'PATCH',
          body: { incident: body },
        })) as {
          incident: {
            id: string;
            name: string;
            status: { name: string };
            severity?: { name: string };
          };
        };

        result = {
          success: true,
          incidentId: data.incident.id,
          name: data.incident.name,
          status: data.incident.status.name,
          severity: data.incident.severity?.name,
        };
        break;
      }

      case 'incidentio_create_followup': {
        const parsed = CreateFollowupSchema.parse(args);

        const body: Record<string, unknown> = {
          incident_id: parsed.incidentId,
          title: parsed.title,
        };

        if (parsed.description) body.description = parsed.description;
        if (parsed.assigneeId) body.assignee_id = parsed.assigneeId;

        const data = (await apiRequest('/follow_ups', token, {
          method: 'POST',
          body,
        })) as {
          follow_up: {
            id: string;
            title: string;
            status: { name: string };
            assignee?: { name: string };
          };
        };

        result = {
          success: true,
          followUpId: data.follow_up.id,
          title: data.follow_up.title,
          status: data.follow_up.status.name,
          assignee: data.follow_up.assignee?.name,
        };
        break;
      }

      case 'incidentio_list_severities': {
        const data = (await apiRequest('/severities', token, {})) as {
          severities: Array<{
            id: string;
            name: string;
            description?: string;
            rank: number;
          }>;
        };

        result = data.severities.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          rank: s.rank,
        }));
        break;
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
    };
  }
}
