/**
 * Google MCP Server Utilities
 */

export { buildRfc2822Message, encodeForGmail, type EmailOptions } from './email-builder.js';
export {
  executeBatchOperation,
  type BatchResult,
  type BatchOperationConfig,
  type BatchOperationSummary,
} from './batch-operation.js';
