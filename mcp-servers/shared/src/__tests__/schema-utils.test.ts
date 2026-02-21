import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createToolDefinition, defineHandlers } from '../schema-utils.js';

describe('schema-utils', () => {
  describe('createToolDefinition', () => {
    it('should create a tool definition from a Zod schema', () => {
      const schema = z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(10).describe('Max results'),
      });

      const tool = createToolDefinition('test_search', 'Search for things', schema);

      expect(tool.name).toBe('test_search');
      expect(tool.description).toBe('Search for things');
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
      expect(tool.inputSchema.properties!['query']).toBeDefined();
      expect(tool.inputSchema.properties!['limit']).toBeDefined();
    });

    it('should preserve required fields from the schema', () => {
      const schema = z.object({
        required_field: z.string(),
        optional_field: z.string().optional(),
      });

      const tool = createToolDefinition('test_tool', 'Test', schema);

      expect(tool.inputSchema.required).toContain('required_field');
      expect(tool.inputSchema.required).not.toContain('optional_field');
    });

    it('should strip $schema and additionalProperties from output', () => {
      const schema = z.object({
        name: z.string(),
      });

      const tool = createToolDefinition('test_tool', 'Test', schema);
      const inputSchema = tool.inputSchema as Record<string, unknown>;

      expect(inputSchema['$schema']).toBeUndefined();
      expect(inputSchema['additionalProperties']).toBeUndefined();
    });

    it('should handle enum fields', () => {
      const schema = z.object({
        status: z.enum(['active', 'inactive', 'pending']).describe('Status filter'),
      });

      const tool = createToolDefinition('test_tool', 'Test', schema);
      const statusProp = (tool.inputSchema.properties as Record<string, Record<string, unknown>>)[
        'status'
      ];

      expect(statusProp!['enum']).toEqual(['active', 'inactive', 'pending']);
    });

    it('should handle nested object schemas', () => {
      const schema = z.object({
        filter: z.object({
          name: z.string(),
          age: z.number(),
        }),
      });

      const tool = createToolDefinition('test_tool', 'Test', schema);
      const filterProp = (tool.inputSchema.properties as Record<string, Record<string, unknown>>)[
        'filter'
      ];

      expect(filterProp!['type']).toBe('object');
      expect(filterProp!['properties']).toBeDefined();
    });

    it('should handle array fields', () => {
      const schema = z.object({
        tags: z.array(z.string()).describe('Tags'),
      });

      const tool = createToolDefinition('test_tool', 'Test', schema);
      const tagsProp = (tool.inputSchema.properties as Record<string, Record<string, unknown>>)[
        'tags'
      ];

      expect(tagsProp!['type']).toBe('array');
    });

    it('should preserve field descriptions', () => {
      const schema = z.object({
        query: z.string().describe('The search query to use'),
      });

      const tool = createToolDefinition('test_tool', 'Test', schema);
      const queryProp = (tool.inputSchema.properties as Record<string, Record<string, unknown>>)[
        'query'
      ];

      expect(queryProp!['description']).toBe('The search query to use');
    });
  });

  describe('defineHandlers', () => {
    it('should create tools and handlers from definitions', () => {
      const schema = z.object({
        id: z.string().describe('Item ID'),
      });

      const handler = async (args: { id: string }, _ctx: string) => ({
        id: args.id,
        found: true,
      });

      const bundle = defineHandlers<string>()({
        get_item: {
          description: 'Get an item by ID',
          schema,
          handler,
        },
      });

      expect(bundle.tools).toHaveLength(1);
      expect(bundle.tools[0]!.name).toBe('get_item');
      expect(bundle.tools[0]!.description).toBe('Get an item by ID');
      expect(bundle.handlers['get_item']).toBeTypeOf('function');
    });

    it('should handle multiple handler definitions', () => {
      const listSchema = z.object({ limit: z.number().optional() });
      const getSchema = z.object({ id: z.string() });

      const bundle = defineHandlers<string>()({
        list_items: {
          description: 'List items',
          schema: listSchema,
          handler: async () => [],
        },
        get_item: {
          description: 'Get item',
          schema: getSchema,
          handler: async (args: { id: string }) => ({ id: args.id }),
        },
      });

      expect(bundle.tools).toHaveLength(2);
      expect(Object.keys(bundle.handlers)).toHaveLength(2);
      expect(bundle.handlers['list_items']).toBeDefined();
      expect(bundle.handlers['get_item']).toBeDefined();
    });

    it('should parse args through the schema before passing to handler', async () => {
      const schema = z.object({
        count: z.number().default(5),
      });

      const handler = async (args: { count: number }) => ({ received: args.count });

      const bundle = defineHandlers<null>()({
        test_tool: {
          description: 'Test',
          schema,
          handler,
        },
      });

      // Pass empty args — schema default should apply
      const result = await bundle.handlers['test_tool']!({}, null);
      expect(result).toEqual({ received: 5 });
    });

    it('should throw on invalid args (schema validation)', async () => {
      const schema = z.object({
        name: z.string(),
      });

      const handler = async (args: { name: string }) => args;

      const bundle = defineHandlers<null>()({
        test_tool: {
          description: 'Test',
          schema,
          handler,
        },
      });

      // Pass invalid args (number instead of string) — ZodError thrown synchronously by parse()
      expect(() =>
        bundle.handlers['test_tool']!({ name: 123 } as unknown as Record<string, unknown>, null)
      ).toThrow();
    });

    it('should pass context to handler', async () => {
      const schema = z.object({});
      let receivedCtx: string | undefined;

      const handler = async (_args: Record<string, never>, ctx: string) => {
        receivedCtx = ctx;
        return {};
      };

      const bundle = defineHandlers<string>()({
        test_tool: {
          description: 'Test',
          schema,
          handler,
        },
      });

      await bundle.handlers['test_tool']!({}, 'my-context');
      expect(receivedCtx).toBe('my-context');
    });
  });
});
