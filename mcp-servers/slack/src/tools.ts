import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  createJsonResponse,
  createErrorResponse,
  type ToolResponse,
} from '@apolitical-assistant/mcp-shared';
import type { SlackContext } from './index.js';
import { allTools, handlerRegistry } from './handlers/index.js';

// Re-export schemas for testing compatibility
export {
  SearchSchema,
  ListChannelsSchema,
  ReadChannelSchema,
  GetChannelInfoSchema,
  ReadThreadSchema,
  SendMessageSchema,
  AddReactionSchema,
  ListUsersSchema,
  GetUserSchema,
  ListDmsSchema,
  ReadDmSchema,
  SendDmSchema,
  GetCanvasSchema,
  UpdateCanvasSchema,
  CreateCanvasSchema,
  ListCanvasesSchema,
  GetBookmarksSchema,
} from './handlers/index.js';

// ==================== TOOL DEFINITIONS ====================

export function createTools(): Tool[] {
  return allTools;
}

// ==================== MAIN HANDLER ====================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: SlackContext
): Promise<ToolResponse> {
  try {
    const handler = handlerRegistry[name];

    if (!handler) {
      return createJsonResponse({ error: `Unknown tool: ${name}` });
    }

    const result = await handler(args, context.token);
    return createJsonResponse(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
