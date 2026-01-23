/**
 * Injectable HTTP client wrapper for testability
 */

import type { FetchFunction, HttpClientOptions } from './types.js';

/**
 * HTTP client with injectable fetch function for testing
 */
export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private fetchFn: FetchFunction;

  constructor(
    baseUrl: string,
    options: {
      headers?: Record<string, string>;
      fetch?: FetchFunction;
    } = {}
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultHeaders = options.headers ?? {};
    this.fetchFn = options.fetch ?? fetch;
  }

  /**
   * Make an HTTP request
   * @param endpoint - API endpoint (will be appended to baseUrl)
   * @param options - Request options
   * @returns Parsed JSON response
   * @throws Error if response is not ok
   */
  async request<T = unknown>(endpoint: string, options: HttpClientOptions = {}): Promise<T> {
    const { method = 'GET', headers = {}, body, params = {} } = options;

    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add query parameters for GET requests
    if (method === 'GET') {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const requestHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...headers,
    };

    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
      if (!requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
      }
    }

    const response = await this.fetchFn(url.toString(), fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new HttpError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(
    endpoint: string,
    params?: Record<string, string | number | boolean>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  /**
   * Make a PUT request
   */
  async put<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  /**
   * Make a PATCH request
   */
  async patch<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Create a new client with additional headers
   */
  withHeaders(headers: Record<string, string>): HttpClient {
    return new HttpClient(this.baseUrl, {
      headers: { ...this.defaultHeaders, ...headers },
      fetch: this.fetchFn,
    });
  }
}

/**
 * HTTP error with status code and response body
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Create an HTTP client with Bearer token authentication
 * @param baseUrl - Base URL for the API
 * @param token - Bearer token
 * @param fetchFn - Optional fetch function for testing
 */
export function createBearerClient(
  baseUrl: string,
  token: string,
  fetchFn?: FetchFunction
): HttpClient {
  return new HttpClient(baseUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    fetch: fetchFn,
  });
}
