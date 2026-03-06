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
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(
    baseUrl: string,
    options: {
      headers?: Record<string, string>;
      fetch?: FetchFunction;
      maxRetries?: number;
      baseDelayMs?: number;
    } = {}
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultHeaders = options.headers ?? {};
    this.fetchFn = options.fetch ?? fetch;
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
  }

  /**
   * Determine if a response status is retryable
   */
  private isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make an HTTP request with retry logic
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

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchFn(url.toString(), fetchOptions);

        if (!response.ok) {
          if (attempt < this.maxRetries && this.isRetryableStatus(response.status)) {
            const delay = this.baseDelayMs * Math.pow(2, attempt);
            await this.sleep(delay);
            continue;
          }

          const errorText = await response.text();
          throw new HttpError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorText
          );
        }

        return response.json() as Promise<T>;
      } catch (err) {
        if (err instanceof HttpError) {
          throw err; // Non-retryable HTTP errors (already handled above)
        }
        lastError = err as Error;
        if (attempt < this.maxRetries) {
          const delay = this.baseDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
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
      maxRetries: this.maxRetries,
      baseDelayMs: this.baseDelayMs,
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
 * @param retryOptions - Optional retry configuration
 */
export function createBearerClient(
  baseUrl: string,
  token: string,
  fetchFn?: FetchFunction,
  retryOptions?: { maxRetries?: number; baseDelayMs?: number }
): HttpClient {
  return new HttpClient(baseUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    fetch: fetchFn,
    ...retryOptions,
  });
}
