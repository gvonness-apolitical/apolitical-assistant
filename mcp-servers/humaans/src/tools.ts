import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createToolRouter } from '@apolitical-assistant/mcp-shared';
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

export const handleToolCall = createToolRouter(
  handlerRegistry,
  (ctx: HumaansContext) => ctx.client
);
