import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { HttpClient } from '@apolitical-assistant/mcp-shared';

// Import handler bundles
import { incidentDefs } from './incidents.js';
import { followupDefs } from './followups.js';
import { postmortemDefs } from './postmortems.js';
import { severityDefs } from './severities.js';

// Re-export schemas for testing
export {
  ListIncidentsSchema,
  GetIncidentSchema,
  CreateIncidentSchema,
  UpdateIncidentSchema,
} from './incidents.js';
export { ListFollowupsSchema, CreateFollowupSchema } from './followups.js';
export { GetPostmortemSchema } from './postmortems.js';
export { ListSeveritiesSchema } from './severities.js';

// Re-export handlers for testing
export {
  handleListIncidents,
  handleGetIncident,
  handleCreateIncident,
  handleUpdateIncident,
} from './incidents.js';
export { handleListFollowups, handleCreateFollowup } from './followups.js';
export { handleGetPostmortem } from './postmortems.js';
export { handleListSeverities } from './severities.js';

// Combine all tools from handler bundles
export const allTools: Tool[] = [
  ...incidentDefs.tools,
  ...followupDefs.tools,
  ...postmortemDefs.tools,
  ...severityDefs.tools,
];

// Combine all handler registries from bundles
export const handlerRegistry: Record<
  string,
  (args: Record<string, unknown>, client: HttpClient) => Promise<unknown>
> = {
  ...incidentDefs.handlers,
  ...followupDefs.handlers,
  ...postmortemDefs.handlers,
  ...severityDefs.handlers,
};
