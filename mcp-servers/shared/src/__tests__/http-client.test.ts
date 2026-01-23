import { describe, it, expect, vi } from 'vitest';
import { HttpClient, HttpError, createBearerClient } from '../http-client.js';

describe('HttpClient', () => {
  const createMockFetch = (response: unknown, ok = true, status = 200) => {
    return vi.fn().mockResolvedValue({
      ok,
      status,
      statusText: ok ? 'OK' : 'Error',
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    });
  };

  describe('request', () => {
    it('should make GET requests', async () => {
      const mockFetch = createMockFetch({ data: 'test' });
      const client = new HttpClient('https://api.example.com', { fetch: mockFetch });

      const result = await client.get('/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('should add query params for GET requests', async () => {
      const mockFetch = createMockFetch({ data: 'test' });
      const client = new HttpClient('https://api.example.com', { fetch: mockFetch });

      await client.get('/endpoint', { foo: 'bar', count: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint?foo=bar&count=10',
        expect.any(Object)
      );
    });

    it('should skip empty/null params', async () => {
      const mockFetch = createMockFetch({ data: 'test' });
      const client = new HttpClient('https://api.example.com', { fetch: mockFetch });

      await client.get('/endpoint', { foo: 'bar', empty: '' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint?foo=bar',
        expect.any(Object)
      );
    });

    it('should make POST requests with body', async () => {
      const mockFetch = createMockFetch({ id: 1 });
      const client = new HttpClient('https://api.example.com', { fetch: mockFetch });

      const result = await client.post('/endpoint', { name: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      );
      expect(result).toEqual({ id: 1 });
    });

    it('should include default headers', async () => {
      const mockFetch = createMockFetch({});
      const client = new HttpClient('https://api.example.com', {
        fetch: mockFetch,
        headers: { 'X-Custom': 'header' },
      });

      await client.get('/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Custom': 'header' }),
        })
      );
    });

    it('should throw HttpError on non-ok response', async () => {
      const mockFetch = createMockFetch({ error: 'Not found' }, false, 404);
      const client = new HttpClient('https://api.example.com', { fetch: mockFetch });

      await expect(client.get('/missing')).rejects.toThrow(HttpError);
      await expect(client.get('/missing')).rejects.toMatchObject({
        status: 404,
      });
    });

    it('should handle trailing slash in baseUrl', async () => {
      const mockFetch = createMockFetch({});
      const client = new HttpClient('https://api.example.com/', { fetch: mockFetch });

      await client.get('/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/endpoint',
        expect.any(Object)
      );
    });
  });

  describe('HTTP methods', () => {
    it('should support PUT', async () => {
      const mockFetch = createMockFetch({});
      const client = new HttpClient('https://api.example.com', { fetch: mockFetch });

      await client.put('/endpoint', { data: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should support PATCH', async () => {
      const mockFetch = createMockFetch({});
      const client = new HttpClient('https://api.example.com', { fetch: mockFetch });

      await client.patch('/endpoint', { data: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should support DELETE', async () => {
      const mockFetch = createMockFetch({});
      const client = new HttpClient('https://api.example.com', { fetch: mockFetch });

      await client.delete('/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('withHeaders', () => {
    it('should create new client with additional headers', async () => {
      const mockFetch = createMockFetch({});
      const client = new HttpClient('https://api.example.com', {
        fetch: mockFetch,
        headers: { 'X-Original': 'value' },
      });

      const newClient = client.withHeaders({ 'X-New': 'header' });
      await newClient.get('/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Original': 'value',
            'X-New': 'header',
          }),
        })
      );
    });
  });
});

describe('createBearerClient', () => {
  it('should create client with Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const client = createBearerClient('https://api.example.com', 'my-token', mockFetch);
    await client.get('/endpoint');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      })
    );
  });
});

describe('HttpError', () => {
  it('should store status and body', () => {
    const error = new HttpError('Not found', 404, '{"error": "Not found"}');

    expect(error.message).toBe('Not found');
    expect(error.status).toBe(404);
    expect(error.body).toBe('{"error": "Not found"}');
    expect(error.name).toBe('HttpError');
  });
});
