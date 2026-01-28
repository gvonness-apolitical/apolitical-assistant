/**
 * Generic tool routing for MCP servers.
 *
 * Extracts the common try/catch → lookup → JSON response pattern
 * shared by all server handleToolCall functions.
 */

import type { ToolResponse } from './types.js';
import { createJsonResponse, createErrorResponse } from './response.js';

/**
 * A handler registry maps tool names to functions that accept
 * raw args and a handler-specific context value.
 */
export type HandlerRegistry<THandlerContext> = Record<
  string,
  (args: Record<string, unknown>, ctx: THandlerContext) => Promise<unknown>
>;

/**
 * Create a handleToolCall function from a handler registry.
 *
 * @param registry - Map of tool names to handler functions
 * @param extractContext - Extracts the handler context from the server context
 * @returns A function compatible with CreateMcpServerOptions.handleToolCall
 */
export function createToolRouter<TServerContext, THandlerContext>(
  registry: HandlerRegistry<THandlerContext>,
  extractContext: (ctx: TServerContext) => THandlerContext
): (name: string, args: Record<string, unknown>, ctx: TServerContext) => Promise<ToolResponse> {
  return async (name, args, ctx) => {
    try {
      const handler = registry[name];

      if (!handler) {
        return createJsonResponse({ error: `Unknown tool: ${name}` });
      }

      const result = await handler(args, extractContext(ctx));
      return createJsonResponse(result);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
}
