/**
 * Shared utilities for MCP servers
 */

// Types
export type {
  ContentItem,
  ToolResponse,
  HttpClientOptions,
  FetchFunction,
  McpServerConfig,
  ToolDefinition,
  ToolHandler,
  EnvRequirement,
} from './types.js';

// Response utilities
export {
  createJsonResponse,
  createErrorResponse,
  createTextResponse,
  createImageResponse,
  withErrorHandling,
  RawResponse,
} from './response.js';

// HTTP client
export { HttpClient, HttpError, createBearerClient } from './http-client.js';

// Tool router
export { createToolRouter, type HandlerRegistry } from './tool-router.js';

// Schema utilities
export {
  createToolDefinition,
  defineHandlers,
  type HandlerDef,
  type HandlerBundle,
} from './schema-utils.js';

// Server factory
export {
  createMcpServer,
  runMcpServer,
  validateEnv,
  type CreateMcpServerOptions,
} from './server-factory.js';
