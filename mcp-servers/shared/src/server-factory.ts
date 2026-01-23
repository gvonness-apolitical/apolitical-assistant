/**
 * MCP server factory to reduce boilerplate
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { EnvRequirement, McpServerConfig, ToolResponse } from './types.js';

/**
 * Options for creating an MCP server
 */
export interface CreateMcpServerOptions<TContext> {
  /** Server configuration */
  config: McpServerConfig;
  /** Environment variable requirements */
  envRequirements?: EnvRequirement[];
  /** Function to create tools list */
  createTools: () => Tool[];
  /** Function to handle tool calls */
  handleToolCall: (
    name: string,
    args: Record<string, unknown>,
    context: TContext
  ) => Promise<ToolResponse>;
  /** Function to create context from environment */
  createContext: (env: Record<string, string | undefined>) => TContext;
}

/**
 * Validate required environment variables
 * @param requirements - Environment variable requirements
 * @returns Record of validated environment variables
 * @throws Error if required variables are missing
 */
export function validateEnv(
  requirements: EnvRequirement[]
): Record<string, string | undefined> {
  const missing: string[] = [];
  const env: Record<string, string | undefined> = {};

  for (const req of requirements) {
    const value = process.env[req.name];
    env[req.name] = value;

    if (req.required !== false && !value) {
      missing.push(req.name);
    }
  }

  if (missing.length > 0) {
    console.error('Error: Missing required environment variables:');
    for (const name of missing) {
      const req = requirements.find((r) => r.name === name);
      console.error(`  - ${name}${req?.description ? `: ${req.description}` : ''}`);
    }
    process.exit(1);
  }

  return env;
}

/**
 * Create and configure an MCP server
 * @param options - Server options
 * @returns Configured server instance
 */
export function createMcpServer<TContext>(
  options: CreateMcpServerOptions<TContext>
): { server: Server; context: TContext; start: () => Promise<void> } {
  const { config, envRequirements = [], createTools, handleToolCall, createContext } = options;

  // Validate environment
  const env = validateEnv(envRequirements);

  // Create context
  const context = createContext(env);

  // Create server
  const server = new Server(
    {
      name: config.name,
      version: config.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: createTools(),
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args ?? {}, context);
  });

  // Start function
  async function start(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`${config.name} server running on stdio`);
  }

  return { server, context, start };
}

/**
 * Run an MCP server with standard error handling
 * @param options - Server options
 */
export async function runMcpServer<TContext>(
  options: CreateMcpServerOptions<TContext>
): Promise<void> {
  const { start } = createMcpServer(options);

  try {
    await start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}
