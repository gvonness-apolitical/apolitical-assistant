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

describe('retry behavior', () => {
  it('should retry on 429 status', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve('Rate limited'),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'success' }),
      });

    const client = new HttpClient('https://api.example.com', {
      fetch: mockFetch,
      maxRetries: 3,
      baseDelayMs: 1, // Use 1ms for fast tests
    });

    const result = await client.get('/endpoint');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: 'success' });
  });

  it('should retry on 500 status', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'success' }),
      });

    const client = new HttpClient('https://api.example.com', {
      fetch: mockFetch,
      maxRetries: 3,
      baseDelayMs: 1,
    });

    const result = await client.get('/endpoint');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: 'success' });
  });

  it('should not retry on 400 status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: () => Promise.resolve('Bad request'),
    });

    const client = new HttpClient('https://api.example.com', {
      fetch: mockFetch,
      maxRetries: 3,
      baseDelayMs: 1,
    });

    await expect(client.get('/endpoint')).rejects.toThrow(HttpError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should not retry on 404 status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('Not found'),
    });

    const client = new HttpClient('https://api.example.com', {
      fetch: mockFetch,
      maxRetries: 3,
      baseDelayMs: 1,
    });

    await expect(client.get('/endpoint')).rejects.toThrow(HttpError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should exhaust retries and throw on persistent 500', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('Server error'),
    });

    const client = new HttpClient('https://api.example.com', {
      fetch: mockFetch,
      maxRetries: 2,
      baseDelayMs: 1,
    });

    await expect(client.get('/endpoint')).rejects.toThrow(HttpError);
    expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should retry on network errors', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'recovered' }),
      });

    const client = new HttpClient('https://api.example.com', {
      fetch: mockFetch,
      maxRetries: 3,
      baseDelayMs: 1,
    });

    const result = await client.get('/endpoint');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: 'recovered' });
  });

  it('should use default retry settings', () => {
    const client = new HttpClient('https://api.example.com');
    // Just verify it can be instantiated with defaults
    expect(client).toBeDefined();
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
