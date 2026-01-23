/**
 * Response formatting utilities for MCP servers
 */

import type { ToolResponse } from './types.js';

/**
 * Create a successful JSON response
 * @param data - The data to serialize as JSON
 * @returns Formatted tool response
 */
export function createJsonResponse(data: unknown): ToolResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Create an error response
 * @param error - The error to format
 * @returns Formatted error response
 */
export function createErrorResponse(error: unknown): ToolResponse {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
  };
}

/**
 * Create a text response (not JSON)
 * @param text - The text to return
 * @returns Formatted tool response
 */
export function createTextResponse(text: string): ToolResponse {
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Wrap a handler function with error handling
 * @param handler - The handler function to wrap
 * @returns Wrapped handler that catches errors
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<ToolResponse>
): (...args: T) => Promise<ToolResponse> {
  return async (...args: T): Promise<ToolResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return createErrorResponse(error);
    }
  };
}
