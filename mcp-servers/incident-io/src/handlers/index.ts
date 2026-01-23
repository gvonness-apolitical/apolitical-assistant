import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { HttpClient } from '@apolitical-assistant/mcp-shared';

// Import tools, schemas, and handlers from each module
import {
  incidentTools,
  ListIncidentsSchema,
  GetIncidentSchema,
  CreateIncidentSchema,
  UpdateIncidentSchema,
  handleListIncidents,
  handleGetIncident,
  handleCreateIncident,
  handleUpdateIncident,
} from './incidents.js';

import {
  followupTools,
  ListFollowupsSchema,
  CreateFollowupSchema,
  handleListFollowups,
  handleCreateFollowup,
} from './followups.js';

import { postmortemTools, GetPostmortemSchema, handleGetPostmortem } from './postmortems.js';

import { severityTools, handleListSeverities } from './severities.js';

// Re-export all schemas for testing
export {
  // Incident schemas
  ListIncidentsSchema,
  GetIncidentSchema,
  CreateIncidentSchema,
  UpdateIncidentSchema,
  // Followup schemas
  ListFollowupsSchema,
  CreateFollowupSchema,
  // Postmortem schemas
  GetPostmortemSchema,
};

// Re-export handlers for testing
export {
  handleListIncidents,
  handleGetIncident,
  handleCreateIncident,
  handleUpdateIncident,
  handleListFollowups,
  handleCreateFollowup,
  handleGetPostmortem,
  handleListSeverities,
};

// Combine all tools into a single array
export const allTools: Tool[] = [
  ...incidentTools,
  ...followupTools,
  ...postmortemTools,
  ...severityTools,
];

// Handler type definition
type Handler = (args: Record<string, unknown>, client: HttpClient) => Promise<unknown>;

// Handler registry maps tool names to their handler functions
export const handlerRegistry: Record<string, Handler> = {
  // Incident handlers
  incidentio_list_incidents: (args, client) =>
    handleListIncidents(ListIncidentsSchema.parse(args), client),
  incidentio_get_incident: (args, client) =>
    handleGetIncident(GetIncidentSchema.parse(args), client),
  incidentio_create_incident: (args, client) =>
    handleCreateIncident(CreateIncidentSchema.parse(args), client),
  incidentio_update_incident: (args, client) =>
    handleUpdateIncident(UpdateIncidentSchema.parse(args), client),

  // Followup handlers
  incidentio_list_followups: (args, client) =>
    handleListFollowups(ListFollowupsSchema.parse(args), client),
  incidentio_create_followup: (args, client) =>
    handleCreateFollowup(CreateFollowupSchema.parse(args), client),

  // Postmortem handlers
  incidentio_get_postmortem: (args, client) =>
    handleGetPostmortem(GetPostmortemSchema.parse(args), client),

  // Severity handlers
  incidentio_list_severities: (_, client) => handleListSeverities(client),
};
