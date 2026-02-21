import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEnv, createMcpServer } from '../server-factory.js';
import type { EnvRequirement } from '../types.js';

describe('server-factory', () => {
  describe('validateEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should return env values for present variables', () => {
      process.env.TEST_VAR = 'test-value';
      const requirements: EnvRequirement[] = [{ name: 'TEST_VAR', description: 'A test var' }];

      const result = validateEnv(requirements);

      expect(result['TEST_VAR']).toBe('test-value');
    });

    it('should handle optional variables that are missing', () => {
      delete process.env.OPTIONAL_VAR;
      const requirements: EnvRequirement[] = [
        { name: 'OPTIONAL_VAR', required: false, description: 'Optional' },
      ];

      const result = validateEnv(requirements);

      expect(result['OPTIONAL_VAR']).toBeUndefined();
    });

    it('should return multiple env values', () => {
      process.env.VAR_A = 'a';
      process.env.VAR_B = 'b';
      const requirements: EnvRequirement[] = [{ name: 'VAR_A' }, { name: 'VAR_B' }];

      const result = validateEnv(requirements);

      expect(result['VAR_A']).toBe('a');
      expect(result['VAR_B']).toBe('b');
    });

    it('should exit process when required variables are missing', () => {
      delete process.env.MISSING_VAR;
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const requirements: EnvRequirement[] = [
        { name: 'MISSING_VAR', description: 'Required variable' },
      ];

      validateEnv(requirements);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith('Error: Missing required environment variables:');
      expect(errorSpy).toHaveBeenCalledWith('  - MISSING_VAR: Required variable');

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should exit when multiple required variables are missing', () => {
      delete process.env.VAR_1;
      delete process.env.VAR_2;
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const requirements: EnvRequirement[] = [{ name: 'VAR_1' }, { name: 'VAR_2' }];

      validateEnv(requirements);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith('  - VAR_1');
      expect(errorSpy).toHaveBeenCalledWith('  - VAR_2');

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should not exit when all required variables are present', () => {
      process.env.REQUIRED_VAR = 'present';
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const requirements: EnvRequirement[] = [{ name: 'REQUIRED_VAR' }];

      validateEnv(requirements);

      expect(exitSpy).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });

    it('should handle empty requirements array', () => {
      const result = validateEnv([]);

      expect(result).toEqual({});
    });

    it('should handle variables without description in error message', () => {
      delete process.env.NO_DESC_VAR;
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const requirements: EnvRequirement[] = [{ name: 'NO_DESC_VAR' }];

      validateEnv(requirements);

      expect(errorSpy).toHaveBeenCalledWith('  - NO_DESC_VAR');

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('createMcpServer', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should create a server with context', () => {
      process.env.API_KEY = 'test-key';
      const tools = [
        {
          name: 'test_tool',
          description: 'Test',
          inputSchema: { type: 'object' as const, properties: {} },
        },
      ];

      const { server, context } = createMcpServer({
        config: { name: 'test-server', version: '1.0.0' },
        envRequirements: [{ name: 'API_KEY' }],
        createTools: () => tools,
        handleToolCall: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
        createContext: (env) => ({ apiKey: env['API_KEY']! }),
      });

      expect(server).toBeDefined();
      expect(context).toEqual({ apiKey: 'test-key' });
    });

    it('should return a start function', () => {
      const { start } = createMcpServer({
        config: { name: 'test-server', version: '1.0.0' },
        createTools: () => [],
        handleToolCall: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
        createContext: () => null,
      });

      expect(start).toBeTypeOf('function');
    });

    it('should default to empty envRequirements', () => {
      // Should not throw when envRequirements is omitted
      const { context } = createMcpServer({
        config: { name: 'test-server', version: '1.0.0' },
        createTools: () => [],
        handleToolCall: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
        createContext: () => 'default-context',
      });

      expect(context).toBe('default-context');
    });
  });
});
