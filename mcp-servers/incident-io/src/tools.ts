import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createToolRouter } from '@apolitical-assistant/mcp-shared';
import type { IncidentIoContext } from './index.js';
import { allTools, handlerRegistry } from './handlers/index.js';

// Re-export schemas for testing
export {
  ListIncidentsSchema,
  GetIncidentSchema,
  CreateIncidentSchema,
  UpdateIncidentSchema,
  ListFollowupsSchema,
  CreateFollowupSchema,
  GetPostmortemSchema,
} from './handlers/index.js';

// ==================== TOOL DEFINITIONS ====================

export function createTools(): Tool[] {
  return allTools;
}

// ==================== MAIN HANDLER ====================

export const handleToolCall = createToolRouter(
  handlerRegistry,
  (ctx: IncidentIoContext) => ctx.client
);
