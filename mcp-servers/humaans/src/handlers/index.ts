import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { HttpClient } from '@apolitical-assistant/mcp-shared';

import {
  employeeTools,
  ListEmployeesSchema,
  GetEmployeeSchema,
  ListTimeOffSchema,
  GetOrgChartSchema,
  handleListEmployees,
  handleGetEmployee,
  handleListTimeOff,
  handleGetOrgChart,
} from './employees.js';

// Re-export schemas for testing
export { ListEmployeesSchema, GetEmployeeSchema, ListTimeOffSchema, GetOrgChartSchema };

// Re-export handlers for testing
export { handleListEmployees, handleGetEmployee, handleListTimeOff, handleGetOrgChart };

// Combine all tools into a single array
export const allTools: Tool[] = [...employeeTools];

// Handler type definition
type Handler = (args: Record<string, unknown>, client: HttpClient) => Promise<unknown>;

// Handler registry maps tool names to their handler functions
export const handlerRegistry: Record<string, Handler> = {
  humaans_list_employees: (args, client) =>
    handleListEmployees(ListEmployeesSchema.parse(args), client),
  humaans_get_employee: (args, client) => handleGetEmployee(GetEmployeeSchema.parse(args), client),
  humaans_list_time_off: (args, client) => handleListTimeOff(ListTimeOffSchema.parse(args), client),
  humaans_get_org_chart: (args, client) => handleGetOrgChart(GetOrgChartSchema.parse(args), client),
};
