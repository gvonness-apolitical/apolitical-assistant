/**
 * Gmail Batch Operation Utility
 *
 * Provides a generic mechanism for executing batch operations on Gmail messages.
 */

import type { GoogleAuth } from '../auth.js';

export interface BatchResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface BatchOperationConfig {
  /**
   * Builds the URL for the operation on a specific message.
   */
  buildUrl: (messageId: string) => string;

  /**
   * HTTP method to use (POST, DELETE, etc.)
   */
  method: string;

  /**
   * Optional request headers
   */
  headers?: Record<string, string>;

  /**
   * Optional body builder for operations that require a request body.
   */
  buildBody?: (messageId: string) => unknown;
}

export interface BatchOperationSummary {
  successCount: number;
  failedCount: number;
  details: BatchResult[];
}

/**
 * Executes a batch operation on multiple Gmail messages.
 *
 * @param messageIds - Array of Gmail message IDs to process
 * @param config - Configuration for the batch operation
 * @param auth - GoogleAuth instance for authenticated requests
 * @returns Summary with success/failure counts and individual results
 */
export async function executeBatchOperation(
  messageIds: string[],
  config: BatchOperationConfig,
  auth: GoogleAuth
): Promise<BatchOperationSummary> {
  const results: BatchResult[] = [];

  for (const messageId of messageIds) {
    try {
      const url = config.buildUrl(messageId);
      const fetchOptions: RequestInit = { method: config.method };

      if (config.headers) {
        fetchOptions.headers = config.headers;
      }

      if (config.buildBody) {
        fetchOptions.body = JSON.stringify(config.buildBody(messageId));
      }

      const response = await auth.fetch(url, fetchOptions);

      if (!response.ok) {
        results.push({ id: messageId, success: false, error: `HTTP ${response.status}` });
      } else {
        results.push({ id: messageId, success: true });
      }
    } catch (err) {
      results.push({ id: messageId, success: false, error: String(err) });
    }
  }

  return {
    successCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
    details: results,
  };
}
