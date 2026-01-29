/**
 * Utilities for generating MCP Tool definitions from Zod schemas.
 *
 * Eliminates the need to manually maintain both Zod schemas and JSON Schema
 * tool definitions — the JSON Schema is auto-generated from Zod.
 */

import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Creates an MCP Tool definition from a Zod schema.
 *
 * The JSON Schema `inputSchema` is auto-generated from the Zod schema,
 * preserving descriptions, defaults, enums, and required fields.
 *
 * @param name - Tool name (e.g., 'slack_search')
 * @param description - Tool description for the MCP client
 * @param schema - Zod object schema defining the tool's input
 * @returns A complete MCP Tool definition
 */
export function createToolDefinition(
  name: string,
  description: string,
  schema: z.ZodObject<z.ZodRawShape>
): Tool {
  const jsonSchema = zodToJsonSchema(schema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  });

  // Remove properties that aren't needed for MCP tool definitions
  delete (jsonSchema as Record<string, unknown>)['$schema'];
  delete (jsonSchema as Record<string, unknown>)['additionalProperties'];

  return {
    name,
    description,
    inputSchema: jsonSchema as Tool['inputSchema'],
  };
}

/**
 * A single handler definition combining schema, description, and handler function.
 *
 * Note: The handler args type is `any` to allow strongly-typed handler functions
 * to be assigned. Type safety is preserved because args are parsed through the
 * schema before being passed to the handler.
 */
export interface HandlerDef<TContext> {
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any, ctx: TContext) => Promise<unknown>;
}

/**
 * Result of defineHandlers - contains both tools and handler registry entries.
 */
export interface HandlerBundle<TContext> {
  tools: Tool[];
  handlers: Record<string, (args: Record<string, unknown>, ctx: TContext) => Promise<unknown>>;
}

/**
 * Define a set of handlers with their tools and registry entries in one place.
 *
 * Combines tool definitions and handler registry construction, eliminating
 * the need to maintain them separately in handler index files.
 *
 * @example
 * ```typescript
 * export const incidentDefs = defineHandlers<HttpClient>()({
 *   incidentio_list_incidents: {
 *     description: 'List incidents from Incident.io',
 *     schema: ListIncidentsSchema,
 *     handler: handleListIncidents,
 *   },
 * });
 * ```
 */
export function defineHandlers<TContext>() {
  return function (defs: Record<string, HandlerDef<TContext>>): HandlerBundle<TContext> {
    const tools: Tool[] = [];
    const handlers: Record<
      string,
      (args: Record<string, unknown>, ctx: TContext) => Promise<unknown>
    > = {};

    for (const [name, def] of Object.entries(defs)) {
      tools.push(createToolDefinition(name, def.description, def.schema));
      handlers[name] = (args: Record<string, unknown>, ctx: TContext) =>
        def.handler(def.schema.parse(args), ctx);
    }

    return { tools, handlers };
  };
}
