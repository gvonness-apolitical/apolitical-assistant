/**
 * Common types for MCP servers
 */

/**
 * Standard MCP tool response format
 * Uses index signature to be compatible with MCP SDK's looser type requirements
 */
export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
}

/**
 * Options for HTTP client requests
 */
export interface HttpClientOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean>;
}

/**
 * Injectable fetch function type for testing
 */
export type FetchFunction = typeof fetch;

/**
 * Configuration for creating an MCP server
 */
export interface McpServerConfig {
  name: string;
  version: string;
}

/**
 * Tool definition and handler pair
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Handler function type for tool calls
 */
export type ToolHandler<TContext = unknown> = (
  args: Record<string, unknown>,
  context: TContext
) => Promise<ToolResponse>;

/**
 * Environment variable requirement definition
 */
export interface EnvRequirement {
  name: string;
  description?: string;
  required?: boolean;
}
