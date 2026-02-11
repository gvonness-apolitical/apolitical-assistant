import { describe, it, expect } from 'vitest';
import {
  createJsonResponse,
  createErrorResponse,
  createTextResponse,
  createImageResponse,
  withErrorHandling,
  RawResponse,
} from '../response.js';
import type { ContentItem } from '../types.js';

/** Helper to extract text from a content item (type-safe). */
function textOf(item: ContentItem | undefined): string | undefined {
  return item?.type === 'text' ? item.text : undefined;
}

describe('response utilities', () => {
  describe('createJsonResponse', () => {
    it('should serialize object to JSON with indentation', () => {
      const data = { foo: 'bar', count: 42 };
      const response = createJsonResponse(data);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]?.type).toBe('text');
      expect(textOf(response.content[0])).toBe(JSON.stringify(data, null, 2));
    });

    it('should handle arrays', () => {
      const data = [1, 2, 3];
      const response = createJsonResponse(data);

      expect(textOf(response.content[0])).toBe(JSON.stringify(data, null, 2));
    });

    it('should handle null', () => {
      const response = createJsonResponse(null);

      expect(textOf(response.content[0])).toBe('null');
    });

    it('should handle nested objects', () => {
      const data = { user: { name: 'John', age: 30 }, items: [1, 2, 3] };
      const response = createJsonResponse(data);

      expect(textOf(response.content[0])).toBe(JSON.stringify(data, null, 2));
    });
  });

  describe('createErrorResponse', () => {
    it('should format Error objects', () => {
      const error = new Error('Something went wrong');
      const response = createErrorResponse(error);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]?.type).toBe('text');
      expect(textOf(response.content[0])).toBe('Error: Something went wrong');
    });

    it('should format string errors', () => {
      const response = createErrorResponse('String error');

      expect(textOf(response.content[0])).toBe('Error: String error');
    });

    it('should handle undefined', () => {
      const response = createErrorResponse(undefined);

      expect(textOf(response.content[0])).toBe('Error: undefined');
    });
  });

  describe('createTextResponse', () => {
    it('should create a text response', () => {
      const response = createTextResponse('Hello, world!');

      expect(response.content).toHaveLength(1);
      expect(response.content[0]?.type).toBe('text');
      expect(textOf(response.content[0])).toBe('Hello, world!');
    });
  });

  describe('createImageResponse', () => {
    it('should create a response with image content', () => {
      const response = createImageResponse('base64data==', 'image/png');

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({
        type: 'image',
        data: 'base64data==',
        mimeType: 'image/png',
      });
    });

    it('should include caption text before image when provided', () => {
      const response = createImageResponse('base64data==', 'image/jpeg', 'Slide 3 thumbnail');

      expect(response.content).toHaveLength(2);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Slide 3 thumbnail' });
      expect(response.content[1]).toEqual({
        type: 'image',
        data: 'base64data==',
        mimeType: 'image/jpeg',
      });
    });
  });

  describe('RawResponse', () => {
    it('should wrap a ToolResponse', () => {
      const toolResponse = createJsonResponse({ key: 'value' });
      const raw = new RawResponse(toolResponse);

      expect(raw.response).toBe(toolResponse);
    });

    it('should be detectable with instanceof', () => {
      const raw = new RawResponse(createTextResponse('test'));

      expect(raw instanceof RawResponse).toBe(true);
    });
  });

  describe('withErrorHandling', () => {
    it('should pass through successful results', async () => {
      const handler = async () => createJsonResponse({ success: true });
      const wrapped = withErrorHandling(handler);

      const result = await wrapped();

      expect(textOf(result.content[0])).toContain('"success": true');
    });

    it('should catch and format errors', async () => {
      const handler = async () => {
        throw new Error('Handler failed');
      };
      const wrapped = withErrorHandling(handler);

      const result = await wrapped();

      expect(textOf(result.content[0])).toBe('Error: Handler failed');
    });

    it('should pass through arguments', async () => {
      const handler = async (a: number, b: number) => createJsonResponse({ sum: a + b });
      const wrapped = withErrorHandling(handler);

      const result = await wrapped(2, 3);

      expect(textOf(result.content[0])).toContain('"sum": 5');
    });
  });
});
