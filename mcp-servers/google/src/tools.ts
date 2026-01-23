import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  createJsonResponse,
  createErrorResponse,
  type ToolResponse,
} from '@apolitical-assistant/mcp-shared';
import type { GoogleContext } from './index.js';
import { allTools, handlerRegistry } from './handlers/index.js';

// Re-export schemas for external access (testing, etc.)
export * from './handlers/index.js';

// ==================== TOOL DEFINITIONS ====================

export function createTools(): Tool[] {
  return allTools;
}

// ==================== MAIN HANDLER ====================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: GoogleContext
): Promise<ToolResponse> {
  try {
    const handler = handlerRegistry[name];

    if (!handler) {
      return createJsonResponse({ error: `Unknown tool: ${name}` });
    }

    const result = await handler(args, context.auth);
    return createJsonResponse(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
