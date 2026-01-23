import { describe, it, expect } from 'vitest';
import {
  createJsonResponse,
  createErrorResponse,
  createTextResponse,
  withErrorHandling,
} from '../response.js';

describe('response utilities', () => {
  describe('createJsonResponse', () => {
    it('should serialize object to JSON with indentation', () => {
      const data = { foo: 'bar', count: 42 };
      const response = createJsonResponse(data);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]?.type).toBe('text');
      expect(response.content[0]?.text).toBe(JSON.stringify(data, null, 2));
    });

    it('should handle arrays', () => {
      const data = [1, 2, 3];
      const response = createJsonResponse(data);

      expect(response.content[0]?.text).toBe(JSON.stringify(data, null, 2));
    });

    it('should handle null', () => {
      const response = createJsonResponse(null);

      expect(response.content[0]?.text).toBe('null');
    });

    it('should handle nested objects', () => {
      const data = { user: { name: 'John', age: 30 }, items: [1, 2, 3] };
      const response = createJsonResponse(data);

      expect(response.content[0]?.text).toBe(JSON.stringify(data, null, 2));
    });
  });

  describe('createErrorResponse', () => {
    it('should format Error objects', () => {
      const error = new Error('Something went wrong');
      const response = createErrorResponse(error);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]?.type).toBe('text');
      expect(response.content[0]?.text).toBe('Error: Something went wrong');
    });

    it('should format string errors', () => {
      const response = createErrorResponse('String error');

      expect(response.content[0]?.text).toBe('Error: String error');
    });

    it('should handle undefined', () => {
      const response = createErrorResponse(undefined);

      expect(response.content[0]?.text).toBe('Error: undefined');
    });
  });

  describe('createTextResponse', () => {
    it('should create a text response', () => {
      const response = createTextResponse('Hello, world!');

      expect(response.content).toHaveLength(1);
      expect(response.content[0]?.type).toBe('text');
      expect(response.content[0]?.text).toBe('Hello, world!');
    });
  });

  describe('withErrorHandling', () => {
    it('should pass through successful results', async () => {
      const handler = async () => createJsonResponse({ success: true });
      const wrapped = withErrorHandling(handler);

      const result = await wrapped();

      expect(result.content[0]?.text).toContain('"success": true');
    });

    it('should catch and format errors', async () => {
      const handler = async () => {
        throw new Error('Handler failed');
      };
      const wrapped = withErrorHandling(handler);

      const result = await wrapped();

      expect(result.content[0]?.text).toBe('Error: Handler failed');
    });

    it('should pass through arguments', async () => {
      const handler = async (a: number, b: number) => createJsonResponse({ sum: a + b });
      const wrapped = withErrorHandling(handler);

      const result = await wrapped(2, 3);

      expect(result.content[0]?.text).toContain('"sum": 5');
    });
  });
});
