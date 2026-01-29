import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createToolRouter } from '@apolitical-assistant/mcp-shared';
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

export const handleToolCall = createToolRouter(
  handlerRegistry,
  (ctx: SlackContext) => ctx.slackClient
);
