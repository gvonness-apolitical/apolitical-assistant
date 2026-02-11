/**
 * Response formatting utilities for MCP servers
 */

import type { ToolResponse, ContentItem } from './types.js';

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
 * Wrapper that signals the tool router to return a pre-built ToolResponse
 * instead of wrapping the result in createJsonResponse.
 */
export class RawResponse {
  constructor(public readonly response: ToolResponse) {}
}

/**
 * Create a response containing an image (and optional caption text).
 * @param base64Data - Base64-encoded image data
 * @param mimeType - Image MIME type (e.g. 'image/png')
 * @param caption - Optional text caption shown alongside the image
 * @returns Formatted tool response with image content
 */
export function createImageResponse(
  base64Data: string,
  mimeType: string,
  caption?: string
): ToolResponse {
  const content: ContentItem[] = [];
  if (caption) content.push({ type: 'text', text: caption });
  content.push({ type: 'image', data: base64Data, mimeType });
  return { content };
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
