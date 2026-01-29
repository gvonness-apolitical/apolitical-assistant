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
