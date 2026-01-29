import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { HttpClient } from '@apolitical-assistant/mcp-shared';

import { humaansDefs } from './employees.js';

// Re-export schemas for testing
export {
  ListEmployeesSchema,
  GetEmployeeSchema,
  ListTimeOffSchema,
  GetOrgChartSchema,
} from './employees.js';

// Re-export handlers for testing
export {
  handleListEmployees,
  handleGetEmployee,
  handleListTimeOff,
  handleGetOrgChart,
} from './employees.js';

// Combine all tools from handler bundles
export const allTools: Tool[] = [...humaansDefs.tools];

// Combine all handler registries from bundles
export const handlerRegistry: Record<
  string,
  (args: Record<string, unknown>, client: HttpClient) => Promise<unknown>
> = {
  ...humaansDefs.handlers,
};
