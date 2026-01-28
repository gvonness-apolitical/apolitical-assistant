import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  createJsonResponse,
  createErrorResponse,
  type ToolResponse,
} from '@apolitical-assistant/mcp-shared';
import type { HumaansContext } from './index.js';
import { allTools, handlerRegistry } from './handlers/index.js';

// Re-export schemas for testing compatibility
export {
  ListEmployeesSchema,
  GetEmployeeSchema,
  ListTimeOffSchema,
  GetOrgChartSchema,
} from './handlers/index.js';

// ==================== TOOL DEFINITIONS ====================

export function createTools(): Tool[] {
  return allTools;
}

// ==================== MAIN HANDLER ====================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  context: HumaansContext
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
