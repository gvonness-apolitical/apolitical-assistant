import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createToolRouter } from '@apolitical-assistant/mcp-shared';
import type { GoogleContext } from './index.js';
import { allTools, handlerRegistry } from './handlers/index.js';

// Re-export schemas for external access (testing, etc.)
export * from './handlers/index.js';

// ==================== TOOL DEFINITIONS ====================

export function createTools(): Tool[] {
  return allTools;
}

// ==================== MAIN HANDLER ====================

export const handleToolCall = createToolRouter(handlerRegistry, (ctx: GoogleContext) => ctx.auth);
