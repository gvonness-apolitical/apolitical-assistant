/**
 * Shared Test Utilities for MCP Servers
 *
 * These utilities provide common mock patterns used across all MCP server tests.
 */

import { vi } from 'vitest';
import type { HttpClient } from './http-client.js';

/**
 * Creates a mock Response object for testing.
 *
 * @param data - The data to return from json()
 * @param ok - Whether the response is successful
 * @param status - HTTP status code
 * @returns A mock Response object
 */
export function mockJsonResponse<T>(data: T, ok = true, status?: number): Response {
  return {
    ok,
    status: status ?? (ok ? 200 : 500),
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

/**
 * Creates a mock HttpClient for testing MCP servers that use HttpClient.
 *
 * @returns A mocked HttpClient with vi.fn() mocks for all methods
 */
export function createMockHttpClient(): HttpClient & {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  request: ReturnType<typeof vi.fn>;
  withHeaders: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    withHeaders: vi.fn(),
  } as unknown as HttpClient & {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
    withHeaders: ReturnType<typeof vi.fn>;
  };
}

/**
 * Creates a mock fetch function for testing.
 *
 * @returns A mocked fetch function
 */
export function createMockFetch(): typeof fetch & ReturnType<typeof vi.fn> {
  return vi.fn() as typeof fetch & ReturnType<typeof vi.fn>;
}
