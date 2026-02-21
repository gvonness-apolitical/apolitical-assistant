import { describe, it, expect, vi } from 'vitest';
import { createToolRouter } from '../tool-router.js';
import { RawResponse, createTextResponse } from '../response.js';

describe('tool-router', () => {
  describe('createToolRouter', () => {
    it('should route to the correct handler', async () => {
      const handler = vi.fn().mockResolvedValue({ result: 'ok' });
      const registry = { my_tool: handler };
      const router = createToolRouter(registry, (ctx: string) => ctx);

      await router('my_tool', { key: 'value' }, 'server-ctx');

      expect(handler).toHaveBeenCalledWith({ key: 'value' }, 'server-ctx');
    });

    it('should wrap handler result in createJsonResponse', async () => {
      const registry = {
        my_tool: async () => ({ data: 'test' }),
      };
      const router = createToolRouter(registry, (ctx: string) => ctx);

      const result = await router('my_tool', {}, 'ctx');

      expect(result.content).toHaveLength(1);
      expect(result.content[0]!.type).toBe('text');
      expect(JSON.parse((result.content[0] as { type: 'text'; text: string }).text)).toEqual({
        data: 'test',
      });
    });

    it('should return error JSON for unknown tools', async () => {
      const registry = {};
      const router = createToolRouter(registry, (ctx: string) => ctx);

      const result = await router('nonexistent', {}, 'ctx');
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      expect(JSON.parse(text)).toEqual({ error: 'Unknown tool: nonexistent' });
    });

    it('should return a RawResponse directly without wrapping', async () => {
      const rawResponse = createTextResponse('raw output');
      const registry = {
        raw_tool: async () => new RawResponse(rawResponse),
      };
      const router = createToolRouter(registry, (ctx: string) => ctx);

      const result = await router('raw_tool', {}, 'ctx');

      expect(result).toBe(rawResponse);
    });

    it('should catch handler errors and return error response', async () => {
      const registry = {
        failing_tool: async () => {
          throw new Error('Something broke');
        },
      };
      const router = createToolRouter(registry, (ctx: string) => ctx);

      const result = await router('failing_tool', {}, 'ctx');
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      expect(text).toBe('Error: Something broke');
    });

    it('should catch non-Error throws and return error response', async () => {
      const registry = {
        failing_tool: async () => {
          throw 'string error';
        },
      };
      const router = createToolRouter(registry, (ctx: string) => ctx);

      const result = await router('failing_tool', {}, 'ctx');
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      expect(text).toBe('Error: string error');
    });

    it('should extract context using the provided function', async () => {
      let receivedCtx: number | undefined;
      const registry = {
        my_tool: async (_args: Record<string, unknown>, ctx: number) => {
          receivedCtx = ctx;
          return {};
        },
      };
      const router = createToolRouter(registry, (serverCtx: { value: number }) => serverCtx.value);

      await router('my_tool', {}, { value: 42 });

      expect(receivedCtx).toBe(42);
    });

    it('should handle handlers returning null/undefined', async () => {
      const registry = {
        null_tool: async () => null,
      };
      const router = createToolRouter(registry, (ctx: string) => ctx);

      const result = await router('null_tool', {}, 'ctx');
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      expect(text).toBe('null');
    });

    it('should handle handlers returning arrays', async () => {
      const registry = {
        array_tool: async () => [1, 2, 3],
      };
      const router = createToolRouter(registry, (ctx: string) => ctx);

      const result = await router('array_tool', {}, 'ctx');
      const text = (result.content[0] as { type: 'text'; text: string }).text;

      expect(JSON.parse(text)).toEqual([1, 2, 3]);
    });
  });
});
