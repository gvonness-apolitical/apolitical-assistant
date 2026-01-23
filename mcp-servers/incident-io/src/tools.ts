import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  createJsonResponse,
  createErrorResponse,
  type ToolResponse,
} from '@apolitical-assistant/mcp-shared';
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

// Create tools function (for backwards compatibility)
export function createTools(): Tool[] {
  return allTools;
}

// Main handler function that takes context
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: IncidentIoContext
): Promise<ToolResponse> {
  try {
    const handler = handlerRegistry[name];

    if (!handler) {
      return createJsonResponse({ error: `Unknown tool: ${name}` });
    }

    const result = await handler(args, context.client);
    return createJsonResponse(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
